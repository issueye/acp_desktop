package agent

import (
	"bufio"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"sync"

	"acp_go_ui/internal/config"
)

type AgentInstance struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type AgentMessage struct {
	AgentID string `json:"agent_id"`
	Message string `json:"message"`
}

type AgentStderr struct {
	AgentID string `json:"agent_id"`
	Line    string `json:"line"`
}

type runningAgent struct {
	cmd     *exec.Cmd
	stdin   io.WriteCloser
	stdinMu sync.Mutex
}

type Manager struct {
	mu      sync.RWMutex
	agents  map[string]*runningAgent
	emitter func(string, any)
}

func NewManager(emitter func(string, any)) *Manager {
	return &Manager{
		agents:  map[string]*runningAgent{},
		emitter: emitter,
	}
}

func (m *Manager) SpawnAgent(name string, cfg config.AgentConfig, envOverrides map[string]string) (AgentInstance, error) {
	if cfg.Command == "" {
		return AgentInstance{}, errors.New("agent command is required")
	}

	agentID, err := newAgentID()
	if err != nil {
		return AgentInstance{}, fmt.Errorf("generate agent id: %w", err)
	}

	cmd := buildCommand(cfg)
	cmd.Env = mergeEnvs(os.Environ(), cfg.Env, envOverrides)

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return AgentInstance{}, fmt.Errorf("open stdin: %w", err)
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return AgentInstance{}, fmt.Errorf("open stdout: %w", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return AgentInstance{}, fmt.Errorf("open stderr: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return AgentInstance{}, fmt.Errorf("spawn agent: %w", err)
	}

	ra := &runningAgent{
		cmd:   cmd,
		stdin: stdin,
	}

	m.mu.Lock()
	m.agents[agentID] = ra
	m.mu.Unlock()

	go m.streamStdout(agentID, stdout)
	go m.streamStderr(agentID, stderr)
	go m.waitAgentExit(agentID, cmd)

	return AgentInstance{
		ID:   agentID,
		Name: name,
	}, nil
}

func (m *Manager) SendToAgent(agentID, message string) error {
	m.mu.RLock()
	agent := m.agents[agentID]
	m.mu.RUnlock()
	if agent == nil {
		return fmt.Errorf("agent not found: %s", agentID)
	}

	agent.stdinMu.Lock()
	defer agent.stdinMu.Unlock()

	_, err := io.WriteString(agent.stdin, message+"\n")
	if err != nil {
		return fmt.Errorf("write to agent stdin: %w", err)
	}
	return nil
}

func (m *Manager) KillAgent(agentID string) error {
	m.mu.Lock()
	agent, ok := m.agents[agentID]
	if ok {
		delete(m.agents, agentID)
	}
	m.mu.Unlock()

	if !ok {
		return nil
	}

	if agent.cmd.Process != nil {
		if err := agent.cmd.Process.Kill(); err != nil && !errors.Is(err, os.ErrProcessDone) {
			return fmt.Errorf("kill agent process: %w", err)
		}
	}
	return nil
}

func (m *Manager) ListRunningAgents() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	ids := make([]string, 0, len(m.agents))
	for id := range m.agents {
		ids = append(ids, id)
	}
	return ids
}

func (m *Manager) Shutdown() {
	m.mu.Lock()
	agents := make(map[string]*runningAgent, len(m.agents))
	for id, ag := range m.agents {
		agents[id] = ag
	}
	m.agents = map[string]*runningAgent{}
	m.mu.Unlock()

	for _, ag := range agents {
		if ag.cmd.Process != nil {
			_ = ag.cmd.Process.Kill()
		}
	}
}

func (m *Manager) streamStdout(agentID string, reader io.ReadCloser) {
	defer reader.Close()
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, 0, 64*1024), 8*1024*1024)
	for scanner.Scan() {
		if m.emitter != nil {
			m.emitter("agent-message", AgentMessage{
				AgentID: agentID,
				Message: scanner.Text(),
			})
		}
	}
}

func (m *Manager) streamStderr(agentID string, reader io.ReadCloser) {
	defer reader.Close()
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, 0, 64*1024), 8*1024*1024)
	for scanner.Scan() {
		if m.emitter != nil {
			m.emitter("agent-stderr", AgentStderr{
				AgentID: agentID,
				Line:    scanner.Text(),
			})
		}
	}
}

func (m *Manager) waitAgentExit(agentID string, cmd *exec.Cmd) {
	_ = cmd.Wait()

	m.mu.Lock()
	delete(m.agents, agentID)
	m.mu.Unlock()

	if m.emitter != nil {
		m.emitter("agent-closed", agentID)
	}
}

func buildCommand(cfg config.AgentConfig) *exec.Cmd {
	var cmd *exec.Cmd
	if isWindows() {
		args := append([]string{"/C", cfg.Command}, cfg.Args...)
		cmd = exec.Command("cmd.exe", args...)
	} else {
		cmd = exec.Command(cfg.Command, cfg.Args...)
	}
	applyPlatformCmdAttrs(cmd)
	return cmd
}

func newAgentID() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func mergeEnvs(base []string, layers ...map[string]string) []string {
	merged := map[string]string{}
	keyNames := map[string]string{}

	addPair := func(key, value string) {
		normalizedKey := normalizeEnvKey(key)
		if normalizedKey == "" {
			return
		}
		keyNames[normalizedKey] = key
		merged[normalizedKey] = value
	}

	for _, entry := range base {
		key, value, ok := strings.Cut(entry, "=")
		if !ok {
			continue
		}
		addPair(key, value)
	}

	for _, layer := range layers {
		for key, value := range layer {
			addPair(key, value)
		}
	}

	env := make([]string, 0, len(merged))
	for normalizedKey, value := range merged {
		env = append(env, fmt.Sprintf("%s=%s", keyNames[normalizedKey], value))
	}
	return env
}

func normalizeEnvKey(key string) string {
	return strings.ToUpper(strings.TrimSpace(key))
}

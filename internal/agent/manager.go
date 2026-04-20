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
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/issueye/acp_desktop/internal/config"
)

type AgentStatus string

const (
	AgentStatusRunning  AgentStatus = "running"
	AgentStatusStopping AgentStatus = "stopping"
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

type RunningAgentInfo struct {
	ID              string      `json:"id"`
	Name            string      `json:"name"`
	PID             int         `json:"pid"`
	Command         string      `json:"command"`
	Args            []string    `json:"args"`
	CommandLine     string      `json:"commandLine"`
	WorkingDir      string      `json:"workingDir,omitempty"`
	StartedAt       string      `json:"startedAt"`
	Status          AgentStatus `json:"status"`
	EnvOverrideKeys []string    `json:"envOverrideKeys,omitempty"`
}

type AgentClosedInfo struct {
	ID       string      `json:"id"`
	AgentID  string      `json:"agentID"`
	Name     string      `json:"name,omitempty"`
	PID      int         `json:"pid,omitempty"`
	ClosedAt string      `json:"closedAt"`
	Status   AgentStatus `json:"status,omitempty"`
	ExitCode *int        `json:"exitCode,omitempty"`
	Error    string      `json:"error,omitempty"`
}

type runningAgent struct {
	cmd     *exec.Cmd
	stdin   io.WriteCloser
	stdinMu sync.Mutex
	info    RunningAgentInfo
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

	info := RunningAgentInfo{
		ID:              agentID,
		Name:            name,
		PID:             processPID(cmd),
		Command:         cfg.Command,
		Args:            cloneStrings(cfg.Args),
		CommandLine:     formatCommandLine(cfg.Command, cfg.Args),
		StartedAt:       time.Now().Format(time.RFC3339Nano),
		Status:          AgentStatusRunning,
		EnvOverrideKeys: sortedKeys(envOverrides),
	}

	ra := &runningAgent{
		cmd:   cmd,
		stdin: stdin,
		info:  info,
	}

	m.mu.Lock()
	m.agents[agentID] = ra
	m.mu.Unlock()

	if m.emitter != nil {
		m.emitter("agent-started", cloneRunningAgentInfo(info))
	}

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
		agent.info.Status = AgentStatusStopping
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
	sort.Strings(ids)
	return ids
}

func (m *Manager) ListRunningAgentDetails() []RunningAgentInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	infos := make([]RunningAgentInfo, 0, len(m.agents))
	for _, agent := range m.agents {
		infos = append(infos, cloneRunningAgentInfo(agent.info))
	}

	sort.Slice(infos, func(i, j int) bool {
		leftTime := parseTime(infos[i].StartedAt)
		rightTime := parseTime(infos[j].StartedAt)
		return rightTime.Before(leftTime)
	})

	return infos
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
	waitErr := cmd.Wait()

	closed := AgentClosedInfo{
		ID:       agentID,
		AgentID:  agentID,
		ClosedAt: time.Now().Format(time.RFC3339Nano),
	}

	m.mu.Lock()
	if agent := m.agents[agentID]; agent != nil {
		closed.Name = agent.info.Name
		closed.PID = agent.info.PID
		closed.Status = agent.info.Status
		delete(m.agents, agentID)
	}
	m.mu.Unlock()

	if closed.PID == 0 {
		closed.PID = processPID(cmd)
	}
	if closed.Status == "" {
		closed.Status = AgentStatusStopping
	}
	if cmd.ProcessState != nil {
		exitCode := cmd.ProcessState.ExitCode()
		closed.ExitCode = &exitCode
	}
	if waitErr != nil && !errors.Is(waitErr, os.ErrProcessDone) {
		closed.Error = waitErr.Error()
	}

	if m.emitter != nil {
		m.emitter("agent-closed", closed)
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

func cloneRunningAgentInfo(info RunningAgentInfo) RunningAgentInfo {
	info.Args = cloneStrings(info.Args)
	info.EnvOverrideKeys = cloneStrings(info.EnvOverrideKeys)
	return info
}

func cloneStrings(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	return append([]string(nil), values...)
}

func sortedKeys(values map[string]string) []string {
	if len(values) == 0 {
		return nil
	}
	keys := make([]string, 0, len(values))
	for key := range values {
		normalized := strings.TrimSpace(key)
		if normalized == "" {
			continue
		}
		keys = append(keys, normalized)
	}
	sort.Strings(keys)
	return keys
}

func formatCommandLine(command string, args []string) string {
	parts := make([]string, 0, len(args)+1)
	if command != "" {
		parts = append(parts, quoteCommandPart(command))
	}
	for _, arg := range args {
		parts = append(parts, quoteCommandPart(arg))
	}
	return strings.Join(parts, " ")
}

func quoteCommandPart(value string) string {
	if value == "" {
		return `""`
	}
	if strings.ContainsAny(value, " \t\n\r\"") {
		return strconv.Quote(value)
	}
	return value
}

func parseTime(value string) time.Time {
	if value == "" {
		return time.Time{}
	}
	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		return time.Time{}
	}
	return parsed
}

func processPID(cmd *exec.Cmd) int {
	if cmd == nil || cmd.Process == nil {
		return 0
	}
	return cmd.Process.Pid
}

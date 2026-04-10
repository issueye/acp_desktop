package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type AgentConfig struct {
	Command string            `json:"command"`
	Args    []string          `json:"args"`
	Env     map[string]string `json:"env,omitempty"`
}

type AgentsConfig struct {
	Agents map[string]AgentConfig `json:"agents"`
}

type Manager struct {
	mu          sync.RWMutex
	path        string
	cfg         AgentsConfig
	emit        func(string, any)
	lastModTime time.Time
	stopCh      chan struct{}
}

func NewManager(appName string, emit func(string, any)) (*Manager, error) {
	path, err := configFilePath(appName)
	if err != nil {
		return nil, err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, fmt.Errorf("create config dir: %w", err)
	}

	m := &Manager{
		path:   path,
		emit:   emit,
		stopCh: make(chan struct{}),
	}

	if _, err := os.Stat(path); errors.Is(err, os.ErrNotExist) {
		m.cfg = defaultConfig()
		if err := m.saveLocked(); err != nil {
			return nil, err
		}
	} else {
		cfg, loadErr := loadConfig(path)
		if loadErr != nil {
			return nil, loadErr
		}
		m.cfg = cfg
	}

	m.lastModTime = fileModTime(path)
	return m, nil
}

func (m *Manager) StartWatcher() {
	ticker := time.NewTicker(1 * time.Second)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				m.checkForExternalChanges()
			case <-m.stopCh:
				return
			}
		}
	}()
}

func (m *Manager) Close() {
	select {
	case <-m.stopCh:
		return
	default:
		close(m.stopCh)
	}
}

func (m *Manager) checkForExternalChanges() {
	modTime := fileModTime(m.path)
	if modTime.IsZero() || !modTime.After(m.lastModTime) {
		return
	}

	cfg, err := loadConfig(m.path)
	if err != nil {
		return
	}

	m.mu.Lock()
	m.cfg = cfg
	m.lastModTime = modTime
	m.mu.Unlock()

	if m.emit != nil {
		m.emit("config-changed", cfg)
	}
}

func (m *Manager) GetConfig() AgentsConfig {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return cloneConfig(m.cfg)
}

func (m *Manager) Reload() (AgentsConfig, error) {
	cfg, err := loadConfig(m.path)
	if err != nil {
		return AgentsConfig{}, err
	}

	m.mu.Lock()
	m.cfg = cfg
	m.lastModTime = fileModTime(m.path)
	m.mu.Unlock()
	return cloneConfig(cfg), nil
}

func (m *Manager) GetConfigPath() string {
	return m.path
}

func (m *Manager) AddAgent(name string, cfg AgentConfig) (AgentsConfig, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.cfg.Agents == nil {
		m.cfg.Agents = map[string]AgentConfig{}
	}
	m.cfg.Agents[name] = sanitizeAgentConfig(cfg)
	if err := m.saveLocked(); err != nil {
		return AgentsConfig{}, err
	}
	return cloneConfig(m.cfg), nil
}

func (m *Manager) RemoveAgent(name string) (AgentsConfig, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.cfg.Agents, name)
	if err := m.saveLocked(); err != nil {
		return AgentsConfig{}, err
	}
	return cloneConfig(m.cfg), nil
}

func (m *Manager) UpdateAgent(name string, cfg AgentConfig) (AgentsConfig, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.cfg.Agents[name]; !ok {
		return AgentsConfig{}, fmt.Errorf("agent '%s' not found", name)
	}
	m.cfg.Agents[name] = sanitizeAgentConfig(cfg)
	if err := m.saveLocked(); err != nil {
		return AgentsConfig{}, err
	}
	return cloneConfig(m.cfg), nil
}

func (m *Manager) saveLocked() error {
	content, err := json.MarshalIndent(m.cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}
	if err := os.WriteFile(m.path, content, 0o644); err != nil {
		return fmt.Errorf("write config: %w", err)
	}
	m.lastModTime = fileModTime(m.path)
	return nil
}

func defaultConfig() AgentsConfig {
	return AgentsConfig{
		Agents: map[string]AgentConfig{
			"GitHub Copilot": {Command: "npx", Args: []string{"@github/copilot-language-server@latest", "--acp"}, Env: map[string]string{}},
			"Claude Code":    {Command: "npx", Args: []string{"@zed-industries/claude-code-acp@latest"}, Env: map[string]string{}},
			"Gemini CLI":     {Command: "npx", Args: []string{"@google/gemini-cli@latest", "--experimental-acp"}, Env: map[string]string{}},
			"Qwen Code":      {Command: "npx", Args: []string{"@qwen-code/qwen-code@latest", "--acp", "--experimental-skills"}, Env: map[string]string{}},
			"Auggie CLI": {
				Command: "npx",
				Args:    []string{"@augmentcode/auggie@latest", "--acp"},
				Env:     map[string]string{"AUGMENT_DISABLE_AUTO_UPDATE": "1"},
			},
			"Qoder CLI": {Command: "npx", Args: []string{"@qoder-ai/qodercli@latest", "--acp"}, Env: map[string]string{}},
			"Codex CLI": {Command: "npx", Args: []string{"@zed-industries/codex-acp@latest"}, Env: map[string]string{}},
			"OpenCode":  {Command: "npx", Args: []string{"opencode-ai@latest", "acp"}, Env: map[string]string{}},
			"OpenClaw":  {Command: "npx", Args: []string{"openclaw", "acp"}, Env: map[string]string{}},
		},
	}
}

func loadConfig(path string) (AgentsConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return AgentsConfig{}, fmt.Errorf("read config: %w", err)
	}

	var cfg AgentsConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return AgentsConfig{}, fmt.Errorf("parse config: %w", err)
	}
	if cfg.Agents == nil {
		cfg.Agents = map[string]AgentConfig{}
	}
	for name, agent := range cfg.Agents {
		cfg.Agents[name] = sanitizeAgentConfig(agent)
	}
	return cfg, nil
}

func sanitizeAgentConfig(cfg AgentConfig) AgentConfig {
	if cfg.Args == nil {
		cfg.Args = []string{}
	}
	if cfg.Env == nil {
		cfg.Env = map[string]string{}
	}
	return cfg
}

func configFilePath(appName string) (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("resolve user config dir: %w", err)
	}
	return filepath.Join(base, appName, "agents.json"), nil
}

func fileModTime(path string) time.Time {
	stat, err := os.Stat(path)
	if err != nil {
		return time.Time{}
	}
	return stat.ModTime()
}

func cloneConfig(cfg AgentsConfig) AgentsConfig {
	out := AgentsConfig{Agents: make(map[string]AgentConfig, len(cfg.Agents))}
	for name, agent := range cfg.Agents {
		env := make(map[string]string, len(agent.Env))
		for k, v := range agent.Env {
			env[k] = v
		}
		args := make([]string, len(agent.Args))
		copy(args, agent.Args)
		out.Agents[name] = AgentConfig{
			Command: agent.Command,
			Args:    args,
			Env:     env,
		}
	}
	return out
}

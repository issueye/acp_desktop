package app

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/issueye/acp_desktop/internal/agent"
	"github.com/issueye/acp_desktop/internal/config"
	"github.com/issueye/acp_desktop/internal/store"
	"github.com/issueye/acp_desktop/internal/system"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx           context.Context
	appName       string
	configManager *config.Manager
	agentManager  *agent.Manager
	storeManager  *store.Manager
	tray          trayController
}

type trayController interface {
	Close()
}

func New(appName, version string) (*App, error) {
	system.SetVersion(version)

	app := &App{
		appName: appName,
	}

	cfgManager, err := config.NewManager(appName, app.emit)
	if err != nil {
		return nil, err
	}
	app.configManager = cfgManager

	app.agentManager = agent.NewManager(app.emit)

	storeManager, err := store.NewManager(appName)
	if err != nil {
		return nil, err
	}
	app.storeManager = storeManager

	return app, nil
}

func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	a.configManager.StartWatcher()
	if err := a.initTray(); err != nil {
		log.Printf("tray initialization failed: %v", err)
	}
}

func (a *App) Shutdown(ctx context.Context) {
	if a.tray != nil {
		a.tray.Close()
	}
	a.configManager.Close()
	a.agentManager.Shutdown()
}

func (a *App) emit(event string, payload any) {
	if a.ctx == nil {
		return
	}
	runtime.EventsEmit(a.ctx, event, payload)
}

func (a *App) GetConfig() (config.AgentsConfig, error) {
	return a.configManager.GetConfig(), nil
}

func (a *App) ReloadConfig() (config.AgentsConfig, error) {
	return a.configManager.Reload()
}

func (a *App) GetConfigPath() (string, error) {
	return a.configManager.GetConfigPath(), nil
}

func (a *App) SpawnAgent(name string, envOverrides map[string]string) (agent.AgentInstance, error) {
	cfg := a.configManager.GetConfig()
	agentCfg, ok := cfg.Agents[name]
	if !ok {
		return agent.AgentInstance{}, fmt.Errorf("agent '%s' not found in config", name)
	}
	return a.agentManager.SpawnAgent(name, agentCfg, envOverrides)
}

func (a *App) SendToAgent(agentID, message string) error {
	return a.agentManager.SendToAgent(agentID, message)
}

func (a *App) KillAgent(agentID string) error {
	return a.agentManager.KillAgent(agentID)
}

func (a *App) ListRunningAgents() []string {
	return a.agentManager.ListRunningAgents()
}

func (a *App) ListRunningAgentDetails() []agent.RunningAgentInfo {
	return a.agentManager.ListRunningAgentDetails()
}

func (a *App) AddAgent(name, command string, args []string, env map[string]string) (config.AgentsConfig, error) {
	return a.configManager.AddAgent(name, config.AgentConfig{
		Command: command,
		Args:    args,
		Env:     env,
	})
}

func (a *App) RemoveAgent(name string) (config.AgentsConfig, error) {
	return a.configManager.RemoveAgent(name)
}

func (a *App) UpdateAgent(name, command string, args []string, env map[string]string) (config.AgentsConfig, error) {
	return a.configManager.UpdateAgent(name, config.AgentConfig{
		Command: command,
		Args:    args,
		Env:     env,
	})
}

func (a *App) GetMachineID() (string, error) {
	return system.GetMachineID(a.appName)
}

func (a *App) GetAppVersion() string {
	return system.GetVersion()
}

func (a *App) SelectDirectory() (string, error) {
	if a.ctx == nil {
		return "", errors.New("app runtime not initialized")
	}
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Working Directory",
	})
}

func (a *App) LoadStore(name string) (map[string]any, error) {
	return a.storeManager.LoadStore(name)
}

func (a *App) SaveStore(name string, value map[string]any) error {
	return a.storeManager.SaveStore(name, value)
}

func (a *App) ReadTextFile(path string, line *int, limit *int) (string, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}

	fullText := string(content)
	if line == nil && limit == nil {
		return fullText, nil
	}

	lines := strings.Split(fullText, "\n")
	start := 0
	if line != nil && *line > 0 {
		start = *line - 1
	}
	if start < 0 {
		start = 0
	}
	if start > len(lines) {
		return "", nil
	}

	end := len(lines)
	if limit != nil && *limit >= 0 {
		candidate := start + *limit
		if candidate < end {
			end = candidate
		}
	}
	if end < start {
		end = start
	}

	return strings.Join(lines[start:end], "\n"), nil
}

func (a *App) WriteTextFile(path, content string) error {
	if path == "" {
		return errors.New("path is required")
	}
	dir := filepath.Dir(path)
	if dir != "." && dir != "" {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return err
		}
	}
	return os.WriteFile(path, []byte(content), 0o644)
}

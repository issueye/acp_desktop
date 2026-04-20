package app

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/issueye/acp_desktop/internal/agent"
	"github.com/issueye/acp_desktop/internal/config"
	"github.com/issueye/acp_desktop/internal/store"
	"github.com/issueye/acp_desktop/internal/system"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const maxImageSizeBytes = 10 * 1024 * 1024

type SelectedImage struct {
	Name         string `json:"name"`
	MimeType     string `json:"mimeType"`
	DataBase64   string `json:"dataBase64"`
	Path         string `json:"path"`
	RelativePath string `json:"relativePath"`
}

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

func (a *App) SelectImageFiles(cwd string) ([]SelectedImage, error) {
	if a.ctx == nil {
		return nil, errors.New("app runtime not initialized")
	}

	workspaceDir, err := normalizeWorkspaceDir(cwd)
	if err != nil {
		return nil, err
	}

	paths, err := runtime.OpenMultipleFilesDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Images",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "Images (*.png;*.jpg;*.jpeg;*.webp;*.gif)",
				Pattern:     "*.png;*.jpg;*.jpeg;*.webp;*.gif",
			},
		},
	})
	if err != nil {
		return nil, err
	}
	if len(paths) == 0 {
		return []SelectedImage{}, nil
	}

	images := make([]SelectedImage, 0, len(paths))
	for _, path := range paths {
		image, readErr := readSelectedImage(path, workspaceDir)
		if readErr != nil {
			return nil, readErr
		}
		images = append(images, image)
	}

	return images, nil
}

func normalizeWorkspaceDir(cwd string) (string, error) {
	trimmed := strings.TrimSpace(cwd)
	if trimmed == "" {
		return "", errors.New("working directory is required")
	}

	absolutePath, err := filepath.Abs(trimmed)
	if err != nil {
		return "", fmt.Errorf("resolve working directory: %w", err)
	}

	info, err := os.Stat(absolutePath)
	if err != nil {
		return "", fmt.Errorf("stat working directory: %w", err)
	}
	if !info.IsDir() {
		return "", fmt.Errorf("%s is not a directory", absolutePath)
	}

	return absolutePath, nil
}

func readSelectedImage(path, workspaceDir string) (SelectedImage, error) {
	info, err := os.Stat(path)
	if err != nil {
		return SelectedImage{}, err
	}
	if info.IsDir() {
		return SelectedImage{}, fmt.Errorf("%s is a directory", filepath.Base(path))
	}
	if info.Size() > maxImageSizeBytes {
		return SelectedImage{}, fmt.Errorf("%s exceeds the 10MB limit", filepath.Base(path))
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return SelectedImage{}, err
	}
	if len(data) == 0 {
		return SelectedImage{}, fmt.Errorf("%s is empty", filepath.Base(path))
	}

	mimeType := http.DetectContentType(data)
	if mimeType == "application/octet-stream" {
		mimeType = mimeTypeFromExtension(path)
	}
	if !strings.HasPrefix(mimeType, "image/") {
		return SelectedImage{}, fmt.Errorf("%s is not a supported image file", filepath.Base(path))
	}

	targetPath, relativePath, err := copyImageToWorkspace(path, data, mimeType, workspaceDir)
	if err != nil {
		return SelectedImage{}, err
	}

	return SelectedImage{
		Name:         filepath.Base(path),
		MimeType:     mimeType,
		DataBase64:   base64.StdEncoding.EncodeToString(data),
		Path:         targetPath,
		RelativePath: relativePath,
	}, nil
}

func copyImageToWorkspace(sourcePath string, data []byte, mimeType, workspaceDir string) (string, string, error) {
	targetDir := filepath.Join(workspaceDir, ".acp_desktop", "temp", "images")
	if err := os.MkdirAll(targetDir, 0o755); err != nil {
		return "", "", fmt.Errorf("create image temp dir: %w", err)
	}

	targetName, err := buildTempImageName(filepath.Base(sourcePath), mimeType)
	if err != nil {
		return "", "", err
	}

	targetPath := filepath.Join(targetDir, targetName)
	if err := os.WriteFile(targetPath, data, 0o644); err != nil {
		return "", "", fmt.Errorf("write temp image file: %w", err)
	}

	relativePath, err := filepath.Rel(workspaceDir, targetPath)
	if err != nil {
		return "", "", fmt.Errorf("resolve image relative path: %w", err)
	}

	return targetPath, filepath.ToSlash(relativePath), nil
}

func buildTempImageName(fileName, mimeType string) (string, error) {
	ext := strings.ToLower(filepath.Ext(fileName))
	if ext == "" {
		ext = extensionFromMimeType(mimeType)
	}
	if ext == "" {
		ext = ".img"
	}

	base := sanitizeFileName(strings.TrimSuffix(filepath.Base(fileName), filepath.Ext(fileName)))
	suffix, err := randomHex(6)
	if err != nil {
		return "", fmt.Errorf("generate image file name: %w", err)
	}

	return fmt.Sprintf("%s-%s%s", base, suffix, ext), nil
}

func sanitizeFileName(name string) string {
	var builder strings.Builder
	for _, r := range name {
		switch {
		case r >= 'a' && r <= 'z':
			builder.WriteRune(r)
		case r >= 'A' && r <= 'Z':
			builder.WriteRune(r)
		case r >= '0' && r <= '9':
			builder.WriteRune(r)
		case r == '-', r == '_':
			builder.WriteRune(r)
		default:
			builder.WriteRune('-')
		}
	}

	sanitized := strings.Trim(builder.String(), "-_. ")
	if sanitized == "" {
		return "image"
	}
	return sanitized
}

func randomHex(byteLength int) (string, error) {
	buffer := make([]byte, byteLength)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return hex.EncodeToString(buffer), nil
}

func mimeTypeFromExtension(path string) string {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".webp":
		return "image/webp"
	case ".gif":
		return "image/gif"
	default:
		return "application/octet-stream"
	}
}

func extensionFromMimeType(mimeType string) string {
	switch strings.ToLower(mimeType) {
	case "image/png":
		return ".png"
	case "image/jpeg":
		return ".jpg"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	default:
		return ""
	}
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

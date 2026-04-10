package store

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

type Manager struct {
	mu      sync.Mutex
	baseDir string
}

func NewManager(appName string) (*Manager, error) {
	cfgDir, err := os.UserConfigDir()
	if err != nil {
		return nil, fmt.Errorf("resolve user config dir: %w", err)
	}

	baseDir := filepath.Join(cfgDir, appName, "stores")
	if err := os.MkdirAll(baseDir, 0o755); err != nil {
		return nil, fmt.Errorf("create store dir: %w", err)
	}

	return &Manager{baseDir: baseDir}, nil
}

func (m *Manager) LoadStore(name string) (map[string]any, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	path, err := m.resolvePath(name)
	if err != nil {
		return nil, err
	}

	data, readErr := os.ReadFile(path)
	if errors.Is(readErr, os.ErrNotExist) {
		return map[string]any{}, nil
	}
	if readErr != nil {
		return nil, fmt.Errorf("read store file: %w", readErr)
	}

	var out map[string]any
	if len(strings.TrimSpace(string(data))) == 0 {
		return map[string]any{}, nil
	}
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, fmt.Errorf("parse store file: %w", err)
	}
	if out == nil {
		out = map[string]any{}
	}
	return out, nil
}

func (m *Manager) SaveStore(name string, value map[string]any) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	path, err := m.resolvePath(name)
	if err != nil {
		return err
	}

	if value == nil {
		value = map[string]any{}
	}

	content, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return fmt.Errorf("serialize store file: %w", err)
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("ensure store dir: %w", err)
	}
	if err := os.WriteFile(path, content, 0o644); err != nil {
		return fmt.Errorf("write store file: %w", err)
	}
	return nil
}

func (m *Manager) resolvePath(name string) (string, error) {
	clean := filepath.Clean(name)
	if clean == "." || clean == "" {
		return "", errors.New("store name is required")
	}
	if filepath.IsAbs(clean) || strings.HasPrefix(clean, "..") || strings.Contains(clean, string(filepath.Separator)+"..") {
		return "", errors.New("invalid store name")
	}
	return filepath.Join(m.baseDir, clean), nil
}

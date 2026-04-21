package jsengine

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/dop251/goja"
)

type SessionScanConfig struct {
	Enabled bool   `json:"enabled"`
	Script  string `json:"script"`
}

type SessionScanContext struct {
	AgentName string            `json:"agentName"`
	Command   string            `json:"command"`
	Args      []string          `json:"args"`
	Env       map[string]string `json:"env"`
}

type SessionScanResult struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Path      string `json:"path"`
	Cwd       string `json:"cwd,omitempty"`
	UpdatedAt int64  `json:"updatedAt"`
}

type dirEntryInfo struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	IsDir   bool   `json:"isDir"`
	Size    int64  `json:"size"`
	ModTime int64  `json:"modTime"`
}

func ScanSessions(cfg SessionScanConfig, ctx SessionScanContext) ([]SessionScanResult, error) {
	if !cfg.Enabled {
		return []SessionScanResult{}, nil
	}
	if strings.TrimSpace(cfg.Script) == "" {
		return nil, errors.New("session scan script is empty")
	}

	vm := goja.New()
	timer := time.AfterFunc(3*time.Second, func() {
		vm.Interrupt("session scan timed out")
	})
	defer timer.Stop()

	if err := injectNative(vm); err != nil {
		return nil, err
	}
	if err := vm.Set("context", ctx); err != nil {
		return nil, fmt.Errorf("inject context: %w", err)
	}

	if _, err := vm.RunString(cfg.Script); err != nil {
		return nil, fmt.Errorf("run session scan script: %w", err)
	}

	scanValue := vm.Get("scan")
	if goja.IsUndefined(scanValue) || goja.IsNull(scanValue) {
		return nil, errors.New("session scan script must define scan(context, native)")
	}

	scanFn, ok := goja.AssertFunction(scanValue)
	if !ok {
		return nil, errors.New("scan must be a function")
	}

	resultValue, err := scanFn(goja.Undefined(), vm.ToValue(ctx), vm.Get("native"))
	if err != nil {
		return nil, fmt.Errorf("execute scan: %w", err)
	}

	var results []SessionScanResult
	if err := vm.ExportTo(resultValue, &results); err != nil {
		return nil, fmt.Errorf("read scan results: %w", err)
	}

	for i := range results {
		results[i].Path = filepath.Clean(results[i].Path)
		if results[i].ID == "" {
			results[i].ID = results[i].Path
		}
		if results[i].Title == "" {
			results[i].Title = filepath.Base(results[i].Path)
		}
	}

	return results, nil
}

func injectNative(vm *goja.Runtime) error {
	native := map[string]any{
		"homeDir": func() string {
			dir, _ := os.UserHomeDir()
			return dir
		},
		"appDataDir": func() string {
			dir, _ := os.UserConfigDir()
			return dir
		},
		"joinPath": func(parts ...string) string {
			return filepath.Join(parts...)
		},
		"cleanPath": func(path string) string {
			return filepath.Clean(path)
		},
		"pathExists": func(path string) bool {
			_, err := os.Stat(path)
			return err == nil
		},
		"isDir": func(path string) bool {
			info, err := os.Stat(path)
			return err == nil && info.IsDir()
		},
		"listDir": func(path string) ([]dirEntryInfo, error) {
			entries, err := os.ReadDir(path)
			if err != nil {
				return nil, err
			}
			out := make([]dirEntryInfo, 0, len(entries))
			for _, entry := range entries {
				info, err := entry.Info()
				if err != nil {
					continue
				}
				out = append(out, dirEntryInfo{
					Name:    entry.Name(),
					Path:    filepath.Join(path, entry.Name()),
					IsDir:   entry.IsDir(),
					Size:    info.Size(),
					ModTime: info.ModTime().UnixMilli(),
				})
			}
			return out, nil
		},
		"listDirs": func(path string) ([]dirEntryInfo, error) {
			entries, err := os.ReadDir(path)
			if err != nil {
				return nil, err
			}
			out := make([]dirEntryInfo, 0, len(entries))
			for _, entry := range entries {
				if !entry.IsDir() {
					continue
				}
				info, err := entry.Info()
				if err != nil {
					continue
				}
				out = append(out, dirEntryInfo{
					Name:    entry.Name(),
					Path:    filepath.Join(path, entry.Name()),
					IsDir:   true,
					Size:    info.Size(),
					ModTime: info.ModTime().UnixMilli(),
				})
			}
			return out, nil
		},
		"readTextFile": func(path string) (string, error) {
			data, err := os.ReadFile(path)
			return string(data), err
		},
		"readJsonFile": func(path string) (any, error) {
			data, err := os.ReadFile(path)
			if err != nil {
				return nil, err
			}
			var value any
			if err := json.Unmarshal(data, &value); err != nil {
				return nil, err
			}
			return value, nil
		},
	}

	return vm.Set("native", native)
}

func DefaultClaudeCodeSessionScanScript() string {
	return `function scan(context, native) {
  const root = native.joinPath(native.homeDir(), ".claude", "projects");
  if (!native.pathExists(root)) return [];

  function decodeProjectName(name) {
    return name.replace(/^([A-Za-z])--/, "$1:/").replace(/-/g, "/");
  }

  return native.listDirs(root).map((dir) => {
    const title = decodeProjectName(dir.name);
    return {
      id: dir.path,
      title,
      path: dir.path,
      cwd: title,
      updatedAt: dir.modTime,
    };
  }).sort((a, b) => b.updatedAt - a.updatedAt);
}`
}

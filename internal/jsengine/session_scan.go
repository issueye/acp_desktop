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

	var rawResults []map[string]any
	if err := vm.ExportTo(resultValue, &rawResults); err != nil {
		return nil, fmt.Errorf("read scan results: %w", err)
	}

	results := make([]SessionScanResult, 0, len(rawResults))
	for _, raw := range rawResults {
		result := SessionScanResult{
			ID:        readStringField(raw, "id", "ID"),
			Title:     readStringField(raw, "title", "Title"),
			Path:      readStringField(raw, "path", "Path"),
			Cwd:       readStringField(raw, "cwd", "Cwd", "CWD"),
			UpdatedAt: readInt64Field(raw, "updatedAt", "UpdatedAt", "modTime", "ModTime"),
		}
		result.Path = strings.TrimSpace(result.Path)
		if result.Path == "" {
			continue
		}
		result.Path = filepath.Clean(result.Path)
		if result.ID == "" {
			result.ID = result.Path
		}
		if result.Title == "" {
			result.Title = filepath.Base(result.Path)
		}
		results = append(results, result)
	}

	return results, nil
}

func readStringField(values map[string]any, keys ...string) string {
	for _, key := range keys {
		value, ok := values[key]
		if !ok || value == nil {
			continue
		}
		switch typed := value.(type) {
		case string:
			return strings.TrimSpace(typed)
		default:
			text := strings.TrimSpace(fmt.Sprint(typed))
			if text != "" && text != "<nil>" {
				return text
			}
		}
	}
	return ""
}

func readInt64Field(values map[string]any, keys ...string) int64 {
	for _, key := range keys {
		value, ok := values[key]
		if !ok || value == nil {
			continue
		}
		switch typed := value.(type) {
		case int64:
			return typed
		case int:
			return int64(typed)
		case int32:
			return int64(typed)
		case float64:
			return int64(typed)
		case float32:
			return int64(typed)
		case json.Number:
			if number, err := typed.Int64(); err == nil {
				return number
			}
		case string:
			var number int64
			if _, err := fmt.Sscan(typed, &number); err == nil {
				return number
			}
		}
	}
	return 0
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
		"listDir": func(path string) ([]map[string]any, error) {
			entries, err := os.ReadDir(path)
			if err != nil {
				return nil, err
			}
			out := make([]map[string]any, 0, len(entries))
			for _, entry := range entries {
				info, err := entry.Info()
				if err != nil {
					continue
				}
				out = append(out, map[string]any{
					"name":    entry.Name(),
					"path":    filepath.Join(path, entry.Name()),
					"isDir":   entry.IsDir(),
					"size":    info.Size(),
					"modTime": info.ModTime().UnixMilli(),
				})
			}
			return out, nil
		},
		"listDirs": func(path string) ([]map[string]any, error) {
			entries, err := os.ReadDir(path)
			if err != nil {
				return nil, err
			}
			out := make([]map[string]any, 0, len(entries))
			for _, entry := range entries {
				if !entry.IsDir() {
					continue
				}
				info, err := entry.Info()
				if err != nil {
					continue
				}
				out = append(out, map[string]any{
					"name":    entry.Name(),
					"path":    filepath.Join(path, entry.Name()),
					"isDir":   true,
					"size":    info.Size(),
					"modTime": info.ModTime().UnixMilli(),
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
    return String(name || "").replace(/^([A-Za-z])--/, "$1:/").replace(/-/g, "/");
  }

  return native.listDirs(root).map((dir) => {
    const name = dir.name || dir.Name || "";
    const path = dir.path || dir.Path || "";
    const title = decodeProjectName(name);
    return {
      id: path,
      title,
      path,
      cwd: title,
      updatedAt: dir.modTime || dir.ModTime || 0,
    };
  }).filter((item) => item.path).sort((a, b) => b.updatedAt - a.updatedAt);
}`
}

func DefaultCodexCLISessionScanScript() string {
	return `function scan(context, native) {
  const roots = [
    native.joinPath(native.homeDir(), ".codex", "sessions"),
    native.joinPath(native.homeDir(), ".codex", "threads"),
  ].filter(native.pathExists);

  const items = [];

  function basename(path) {
    const parts = String(path || "").split(/[\\/]/).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : String(path || "");
  }

  function stripExt(name) {
    return String(name || "").replace(/\.(json|jsonl|md)$/i, "");
  }

  function collectJsonlFiles(root, out) {
    for (const entry of native.listDir(root)) {
      const path = entry.path || entry.Path || "";
      const name = entry.name || entry.Name || "";
      const isDir = entry.isDir || entry.IsDir || false;
      if (!path) continue;
      if (isDir) {
        collectJsonlFiles(path, out);
        continue;
      }
      if (/\.jsonl$/i.test(name)) {
        out.push(entry);
      }
    }
  }

  function readSessionInfo(path) {
    const info = { id: path, title: stripExt(basename(path)), cwd: "" };
    try {
      const lines = String(native.readTextFile(path) || "").split(/\r?\n/).slice(0, 80);
      for (const line of lines) {
        if (!line) continue;
        let record;
        try {
          record = JSON.parse(line);
        } catch (_) {
          continue;
        }

        if (record.type === "session_meta" && record.payload) {
          info.id = record.payload.id || info.id;
          info.cwd = record.payload.cwd || info.cwd;
          if (!info.title && info.cwd) info.title = basename(info.cwd);
          continue;
        }

        if (record.type === "event_msg" && record.payload?.type === "user_message") {
          info.title = record.payload.message || info.title;
          break;
        }

        if (record.type === "response_item" && record.payload?.type === "message" && record.payload?.role === "user") {
          const content = record.payload.content || [];
          const textPart = content.find((part) => part?.text || part?.type === "input_text");
          if (textPart?.text) {
            info.title = textPart.text;
            break;
          }
        }
      }
    } catch (_) {}

    if (!info.title && info.cwd) info.title = basename(info.cwd);
    if (info.title.length > 80) info.title = info.title.slice(0, 80) + "...";
    return info;
  }

  for (const root of roots) {
    const files = [];
    collectJsonlFiles(root, files);
    for (const entry of files) {
      const name = entry.name || entry.Name || "";
      const path = entry.path || entry.Path || "";
      const info = readSessionInfo(path);
      items.push({
        id: info.id || path,
        title: info.title || stripExt(name),
        path,
        cwd: info.cwd,
        updatedAt: entry.modTime || entry.ModTime || 0,
      });
    }
  }
  return items.filter((item) => item.path).sort((a, b) => b.updatedAt - a.updatedAt);
}`
}

func DefaultOpenCodeSessionScanScript() string {
	return `function scan(context, native) {
  const roots = [
    native.joinPath(native.homeDir(), ".local", "share", "opencode", "sessions"),
    native.joinPath(native.homeDir(), ".opencode", "sessions"),
    native.joinPath(native.appDataDir(), "opencode", "sessions"),
  ].filter(native.pathExists);

  const items = [];
  for (const root of roots) {
    for (const entry of native.listDir(root)) {
      const name = entry.name || entry.Name || "";
      const path = entry.path || entry.Path || "";
      items.push({
        id: path,
        title: String(name).replace(/\.(json|jsonl|md)$/i, ""),
        path,
        updatedAt: entry.modTime || entry.ModTime || 0,
      });
    }
  }
  return items.filter((item) => item.path).sort((a, b) => b.updatedAt - a.updatedAt);
}`
}

func DefaultGeminiCLISessionScanScript() string {
	return `function scan(context, native) {
  const roots = [
    native.joinPath(native.homeDir(), ".gemini", "sessions"),
    native.joinPath(native.homeDir(), ".gemini", "history"),
    native.joinPath(native.appDataDir(), "gemini", "sessions"),
  ].filter(native.pathExists);

  const items = [];
  for (const root of roots) {
    for (const entry of native.listDir(root)) {
      const name = entry.name || entry.Name || "";
      const path = entry.path || entry.Path || "";
      items.push({
        id: path,
        title: String(name).replace(/\.(json|jsonl|md)$/i, ""),
        path,
        updatedAt: entry.modTime || entry.ModTime || 0,
      });
    }
  }
  return items.filter((item) => item.path).sort((a, b) => b.updatedAt - a.updatedAt);
}`
}

func DefaultSessionScanScript(agentName string) string {
	switch agentName {
	case "Claude Code":
		return DefaultClaudeCodeSessionScanScript()
	case "Codex CLI":
		return DefaultCodexCLISessionScanScript()
	case "OpenCode":
		return DefaultOpenCodeSessionScanScript()
	case "Gemini CLI":
		return DefaultGeminiCLISessionScanScript()
	default:
		return ""
	}
}

# ACP UI Wails Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current Tauri (Rust) desktop runtime with a Go + Wails runtime while preserving ACP UI feature parity and release quality.

**Architecture:** Keep the existing Vue 3 + Pinia frontend and replace the desktop integration layer only. Move Tauri commands/events from `src-tauri/src/*.rs` to Go services bound through Wails. Keep JSON-RPC ACP flow and UI state logic intact by swapping `src/lib/tauri.ts` with a Wails bridge and runtime event listeners.

**Tech Stack:** Go 1.23+, Wails v2, Vue 3, Vite, Pinia, `@agentclientprotocol/sdk`, GitHub Actions.

---

## Current-State Analysis (acp-ui)

1. Frontend stack is `Vue 3 + Vite + Pinia` in `src/`.
2. Desktop host is Tauri v2 in `src-tauri/` with Rust commands:
   - Config APIs: `get_config`, `reload_config`, `get_config_path`, CRUD for agents.
   - Process APIs: `spawn_agent`, `send_to_agent`, `kill_agent`, `list_running_agents`.
   - System API: `get_machine_id`.
3. Tauri event bus drives core runtime behavior:
   - `agent-message`, `agent-stderr`, `agent-closed`, `config-changed`.
4. Frontend currently depends on Tauri plugins:
   - `@tauri-apps/api/core`, `@tauri-apps/api/event`
   - `@tauri-apps/plugin-dialog` (folder picker)
   - `@tauri-apps/plugin-fs` (ACP file read/write)
   - `@tauri-apps/plugin-store` (preferences/sessions persistence)
   - `@tauri-apps/api/app` (`getVersion`)
5. CI/release pipelines are fully Tauri/Rust oriented in:
   - `.github/workflows/ci.yml`
   - `.github/workflows/release.yml`

## Migration Principles

1. Preserve behavior first, refactor second.
2. One backend capability at a time with tests.
3. Do not rewrite UI components unless integration requires it.
4. Keep app data format stable (`agents.json`, `sessions.json`, `preferences.json`).
5. Commit after each passing test slice.

## Target Structure

1. `main.go` (Wails bootstrap and options)
2. `app/app.go` (bound API surface for frontend)
3. `internal/config/*` (agent config file + hot reload)
4. `internal/agent/*` (process spawn/io/kill/event emission)
5. `internal/store/*` (JSON key-value store for preferences and sessions)
6. `internal/system/*` (machine id, app version helpers)
7. `src/lib/wails.ts` + `src/lib/acp-bridge.ts` updates (replace Tauri bridge)
8. Wails-generated JS bindings in `wailsjs/`

## Task-by-Task Plan

### Task 1: Bootstrap Wails Skeleton And Build Scripts

**Skills:** `@Code`, `@git-essentials`

**Files:**
- Create: `main.go`
- Create: `app/app.go`
- Create: `wails.json`
- Modify: `package.json`
- Modify: `.gitignore`
- Test: `main_test.go`

**Step 1: Write the failing test**

```go
package main

import "testing"

func TestAppBootstrap_ConfiguresWails(t *testing.T) {
    if buildAppOptions() == nil {
        t.Fatal("expected non-nil app options")
    }
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./... -run TestAppBootstrap_ConfiguresWails -v`  
Expected: FAIL with `undefined: buildAppOptions`

**Step 3: Write minimal implementation**

```go
func buildAppOptions() *options.App {
    return &options.App{
        Title: "ACP UI",
        Width: 1200,
        Height: 800,
        Bind: []interface{}{app.New()},
    }
}
```

**Step 4: Run test to verify it passes**

Run: `go test ./... -run TestAppBootstrap_ConfiguresWails -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add main.go app/app.go wails.json package.json .gitignore main_test.go
git commit -m "chore: scaffold wails runtime shell"
```

### Task 2: Implement Config Manager With Hot Reload

**Skills:** `@Code`

**Files:**
- Create: `internal/config/types.go`
- Create: `internal/config/manager.go`
- Create: `internal/config/manager_test.go`
- Modify: `app/app.go`
- Test: `internal/config/manager_test.go`

**Step 1: Write the failing test**

```go
func TestManager_LoadsDefaultConfigWhenMissing(t *testing.T) {
    dir := t.TempDir()
    m, err := NewManager(dir)
    if err != nil { t.Fatal(err) }
    cfg := m.GetConfig()
    if len(cfg.Agents) == 0 {
        t.Fatal("expected default agents")
    }
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/config -run TestManager_LoadsDefaultConfigWhenMissing -v`  
Expected: FAIL with `undefined: NewManager`

**Step 3: Write minimal implementation**

```go
type Manager struct {
    mu sync.RWMutex
    path string
    cfg AgentsConfig
}

func NewManager(appConfigDir string) (*Manager, error) { /* create dir/load default/save */ }
func (m *Manager) GetConfig() AgentsConfig { /* copy + return */ }
func (m *Manager) Reload() (AgentsConfig, error) { /* reload file */ }
```

**Step 4: Run test to verify it passes**

Run: `go test ./internal/config -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add internal/config app/app.go
git commit -m "feat: add config manager with default config and reload support"
```

### Task 3: Implement Agent Process Manager + Event Streaming

**Skills:** `@Code`

**Files:**
- Create: `internal/agent/types.go`
- Create: `internal/agent/manager.go`
- Create: `internal/agent/manager_test.go`
- Modify: `app/app.go`
- Test: `internal/agent/manager_test.go`

**Step 1: Write the failing test**

```go
func TestManager_SpawnSendKill(t *testing.T) {
    m := NewManager(testEmitter{})
    inst, err := m.Spawn("echo-agent", AgentConfig{
        Command: "go",
        Args: []string{"run", "./internal/agent/testdata/echo_agent.go"},
    })
    if err != nil { t.Fatal(err) }
    if err := m.Send(inst.ID, `{"ping":1}`); err != nil { t.Fatal(err) }
    if err := m.Kill(inst.ID); err != nil { t.Fatal(err) }
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/agent -run TestManager_SpawnSendKill -v`  
Expected: FAIL with `undefined: NewManager`

**Step 3: Write minimal implementation**

```go
type Manager struct {
    mu sync.RWMutex
    procs map[string]*runningAgent
    emitter Emitter
}

func (m *Manager) Spawn(name string, cfg config.AgentConfig) (AgentInstance, error) { /* start process + goroutines */ }
func (m *Manager) Send(agentID, message string) error { /* stdin write + flush */ }
func (m *Manager) Kill(agentID string) error { /* kill + cleanup */ }
```

**Step 4: Run test to verify it passes**

Run: `go test ./internal/agent -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add internal/agent app/app.go
git commit -m "feat: port agent process lifecycle and event streaming to go"
```

### Task 4: Expose Wails-Bound Backend API For Frontend

**Skills:** `@Code`

**Files:**
- Modify: `app/app.go`
- Create: `app/app_test.go`
- Create: `internal/system/machineid.go`
- Create: `internal/system/machineid_test.go`
- Test: `app/app_test.go`

**Step 1: Write the failing test**

```go
func TestApp_GetMachineID_NotEmpty(t *testing.T) {
    a := New()
    id, err := a.GetMachineID()
    if err != nil { t.Fatal(err) }
    if id == "" { t.Fatal("expected machine id") }
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./app -run TestApp_GetMachineID_NotEmpty -v`  
Expected: FAIL with `undefined: (*App).GetMachineID`

**Step 3: Write minimal implementation**

```go
type App struct {
    cfg *config.Manager
    agents *agent.Manager
}

func (a *App) GetConfig() (config.AgentsConfig, error) { /* delegate */ }
func (a *App) SpawnAgent(name string) (agent.AgentInstance, error) { /* delegate */ }
func (a *App) GetMachineID() (string, error) { return system.GetMachineID() }
```

**Step 4: Run test to verify it passes**

Run: `go test ./app -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add app internal/system
git commit -m "feat: add wails app bindings for config agent and system apis"
```

### Task 5: Replace Frontend Tauri Bridge With Wails Bridge

**Skills:** `@Code`

**Files:**
- Create: `src/lib/wails.ts`
- Modify: `src/lib/acp-bridge.ts`
- Modify: `src/stores/config.ts`
- Modify: `src/stores/session.ts`
- Modify: `src/App.vue`
- Delete: `src/lib/tauri.ts`
- Test: `src/lib/wails.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { normalizeAgentMessage } from "./wails";

describe("normalizeAgentMessage", () => {
  it("maps wails event payload to ui shape", () => {
    expect(normalizeAgentMessage({ agentId: "a", message: "x" })).toEqual({
      agent_id: "a",
      message: "x",
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/wails.test.ts`  
Expected: FAIL with missing `normalizeAgentMessage` or missing vitest config

**Step 3: Write minimal implementation**

```ts
import { EventsOn } from "../wailsjs/runtime/runtime";
import { GetConfig, SpawnAgent, SendToAgent } from "../wailsjs/go/app/App";

export async function onAgentMessage(cb: (msg: AgentMessage) => void) {
  return EventsOn("agent-message", (payload) => cb(normalizeAgentMessage(payload)));
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/wails.test.ts && npm run build`  
Expected: PASS and frontend build success

**Step 5: Commit**

```bash
git add src/lib src/stores src/App.vue package.json
git commit -m "refactor: switch frontend desktop bridge from tauri to wails"
```

### Task 6: Port Store And File APIs (Session/Preferences + ACP FS Ops)

**Skills:** `@Code`

**Files:**
- Create: `internal/store/jsonstore.go`
- Create: `internal/store/jsonstore_test.go`
- Modify: `app/app.go`
- Modify: `src/stores/session.ts`
- Modify: `src/App.vue`
- Modify: `src/lib/acp-bridge.ts`
- Test: `internal/store/jsonstore_test.go`

**Step 1: Write the failing test**

```go
func TestJSONStore_SetGetRoundtrip(t *testing.T) {
    s := New(filepath.Join(t.TempDir(), "sessions.json"))
    if err := s.Set("sessions", []string{"s1"}); err != nil { t.Fatal(err) }
    var out []string
    if err := s.Get("sessions", &out); err != nil { t.Fatal(err) }
    if len(out) != 1 || out[0] != "s1" { t.Fatal("unexpected value") }
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/store -run TestJSONStore_SetGetRoundtrip -v`  
Expected: FAIL with `undefined: New`

**Step 3: Write minimal implementation**

```go
func (a *App) SelectDirectory() (string, error) { /* runtime.OpenDirectoryDialog */ }
func (a *App) StoreGet(file, key string) (json.RawMessage, error) { /* json store */ }
func (a *App) StoreSet(file, key string, value json.RawMessage) error { /* json store */ }
func (a *App) ReadTextFile(path string, line *int, limit *int) (string, error) { /* os.ReadFile + slice */ }
func (a *App) WriteTextFile(path, content string) error { /* os.WriteFile */ }
```

**Step 4: Run test to verify it passes**

Run: `go test ./internal/store -v && go test ./app -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add internal/store app src/stores src/lib/acp-bridge.ts src/App.vue
git commit -m "feat: port local store dialog and fs apis to wails backend"
```

### Task 7: Restore Runtime UX Details (Startup Progress, Telemetry, Version)

**Skills:** `@Code`

**Files:**
- Modify: `app/app.go`
- Modify: `src/lib/telemetry.ts`
- Modify: `src/stores/session.ts`
- Create: `internal/system/version.go`
- Test: `internal/system/version_test.go`

**Step 1: Write the failing test**

```go
func TestVersion_DefaultWhenUnset(t *testing.T) {
    if GetVersion() == "" {
        t.Fatal("version must not be empty")
    }
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/system -run TestVersion_DefaultWhenUnset -v`  
Expected: FAIL with `undefined: GetVersion`

**Step 3: Write minimal implementation**

```go
var version = "dev"

func GetVersion() string { return version }
func (a *App) GetAppVersion() string { return system.GetVersion() }
```

**Step 4: Run test to verify it passes**

Run: `go test ./internal/system -v && npm run build`  
Expected: PASS

**Step 5: Commit**

```bash
git add app internal/system src/lib/telemetry.ts src/stores/session.ts
git commit -m "feat: restore machine-id version and startup telemetry behavior"
```

### Task 8: Migrate CI And Release Pipelines To Go + Wails

**Skills:** `@Code`, `@git-essentials`

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `README.md`
- Test: `.github/workflows/ci.yml` (dry-run validation)

**Step 1: Write the failing test**

```bash
# workflow lint (example)
actionlint .github/workflows/ci.yml .github/workflows/release.yml
```

**Step 2: Run test to verify it fails**

Run: `actionlint .github/workflows/ci.yml .github/workflows/release.yml`  
Expected: FAIL because Rust/Tauri actions remain and Go/Wails steps missing

**Step 3: Write minimal implementation**

```yaml
- uses: actions/setup-go@v5
  with:
    go-version-file: go.mod
- run: go test ./...
- run: npm ci && npm run build
- run: wails build
```

**Step 4: Run test to verify it passes**

Run: `actionlint .github/workflows/ci.yml .github/workflows/release.yml`  
Expected: PASS

**Step 5: Commit**

```bash
git add .github/workflows README.md
git commit -m "ci: migrate pipelines from tauri rust to go wails"
```

### Task 9: Remove Tauri Residue And Run Full Regression

**Skills:** `@Code`

**Files:**
- Delete: `src-tauri/`
- Modify: `package.json`
- Modify: `README.md`
- Test: `smoke/manual-regression.md`

**Step 1: Write the failing test**

```bash
rg -n "@tauri-apps|src-tauri|tauri" src package.json README.md
```

**Step 2: Run test to verify it fails**

Run: `rg -n "@tauri-apps|src-tauri|tauri" src package.json README.md`  
Expected: FAIL (matches found)

**Step 3: Write minimal implementation**

```bash
# remove tauri deps/scripts and delete src-tauri after wails parity is confirmed
```

**Step 4: Run test to verify it passes**

Run: `rg -n "@tauri-apps|src-tauri|tauri" src package.json README.md && go test ./... && npm run build`  
Expected: No Tauri matches, Go tests PASS, frontend build PASS

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: finalize wails migration and remove tauri runtime"
```

## Acceptance Criteria

1. User can create, resume, and disconnect ACP sessions exactly as before.
2. Config file hot reload still updates agent list without restart.
3. Permission dialogs, auth method selection, mode/model switching still work.
4. Startup stderr progress and traffic monitor still update in real time.
5. Session/prefs persistence survives app restart.
6. CI builds pass on Windows/macOS/Linux with Wails output artifacts.

## Risks And Mitigations

1. **Process spawning differences (Windows shell behavior):** keep dedicated Windows spawn path (`cmd /C`) and add tests.
2. **Event payload shape drift:** define normalized TS mapping functions and unit tests in bridge layer.
3. **Store format incompatibility:** keep same keys (`sessions`, `lastCwd`, `telemetryEnabled`) and JSON schema.
4. **Packaging parity gap (MSI/NSIS):** validate release artifact format early in Task 8 before deleting Tauri.

## Rollout Sequence

1. Run Tasks 1-4 on a feature branch.
2. Run Task 5-7 and execute manual smoke test.
3. Migrate CI in Task 8.
4. Delete Tauri in Task 9 only after release candidate passes.

Plan complete and saved to `docs/plans/2026-04-10-acp-ui-wails-migration.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?

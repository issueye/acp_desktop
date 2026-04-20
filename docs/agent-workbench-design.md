# Agent 工作台深化设计

本文档针对 `docs/project-directions.md` 中“多 Agent 工作台”方向展开，描述 ACP DESKTOP 如何从当前的 Agent 配置管理，升级为可复用、可校验、可诊断、可沉淀的本地 Agent 工作台。

## 设计目标

Agent 工作台的目标不是简单增加一个设置页，而是把“启动一个 Agent 会话”拆解为可管理的资产：Agent 定义、工作区 Profile、启动环境、授权策略、最近使用记录和健康状态。

核心目标：

- 降低首次配置成本：通过模板和校验减少用户手写命令的错误。
- 提升日常启动效率：通过 Profile 和最近使用组合减少重复选择。
- 增强启动可靠性：在真正启动 Agent 前发现命令、依赖、cwd、代理、环境变量问题。
- 支持多 Agent 并行维护：让用户清楚知道每个 Agent 的用途、状态、能力和风险边界。
- 为后续 API 开放打基础：将 Agent 启动能力抽象成稳定服务，而不是只服务 UI。

## 当前现状

当前项目已有较完整的基础能力：

- `internal/config/config.go` 保存 Agent 配置，结构为 `command`、`args`、`env`。
- `SettingsView.vue` 支持新增、编辑、删除 Agent，并可维护环境变量。
- `WorkspaceSessionDialog.vue` 支持选择 Agent、工作目录和代理配置，然后创建会话。
- `internal/agent/manager.go` 负责根据配置启动 Agent 子进程。
- 前端通过 `configStore` 获取 Agent 列表，通过 Wails 方法增删改 Agent。

当前短板：

- Agent 配置没有分类、描述、标签、模板来源、版本和健康状态。
- 工作目录、代理、授权模式和 Agent 没有组成可复用 Profile。
- 启动前校验较弱，错误主要在启动后暴露。
- 缺少启动诊断报告，用户难以判断失败发生在命令、依赖、认证、协议还是网络层。
- 缺少“最近使用”和“推荐启动组合”，重复创建会话成本偏高。

## 核心概念

### Agent Definition

Agent Definition 表示一个 ACP Agent 的启动定义，是当前 `AgentConfig` 的增强版。

建议字段：

```json
{
  "name": "Claude Code",
  "displayName": "Claude Code",
  "description": "Claude Code ACP adapter",
  "command": "npx",
  "args": ["@zed-industries/claude-code-acp@latest"],
  "env": {},
  "tags": ["coding", "official"],
  "templateId": "claude-code",
  "enabled": true,
  "createdAt": "2026-04-20T00:00:00Z",
  "updatedAt": "2026-04-20T00:00:00Z"
}
```

设计要点：

- `name` 保持兼容当前配置键，短期仍可作为唯一标识。
- `displayName` 用于 UI 展示，后续可允许重命名。
- `description` 和 `tags` 用于列表筛选和帮助用户理解用途。
- `templateId` 记录来源，便于模板升级或重置。
- `enabled` 用于隐藏临时不可用 Agent，而不是删除配置。

### Agent Template

Agent Template 是内置或远端维护的 Agent 配置模板，用于降低添加成本。

模板示例：

```json
{
  "id": "qwen-code",
  "name": "Qwen Code",
  "command": "npx",
  "args": ["@qwen-code/qwen-code@latest", "--acp", "--experimental-skills"],
  "env": {},
  "tags": ["coding"],
  "requiredTools": ["node", "npm"],
  "docsUrl": "https://example.invalid/qwen-code-acp"
}
```

模板能力：

- 一键添加常见 Agent。
- 复制模板为自定义 Agent。
- 标记需要的本地工具，例如 `node`、`npm`、`git`。
- 后续可做模板版本检查，但初期不需要远程更新。

### Workspace Profile

Workspace Profile 表示一个可复用启动组合，将 Agent、cwd、代理和授权模式绑定起来。

建议字段：

```json
{
  "id": "profile_abc123",
  "name": "ACP DESKTOP / Claude Code",
  "agentName": "Claude Code",
  "cwd": "E:/codes/acp_go_ui",
  "proxy": {
    "enabled": false,
    "httpProxy": "",
    "httpsProxy": "",
    "allProxy": "",
    "noProxy": ""
  },
  "authorizationMode": "manual",
  "lastUsedAt": "2026-04-20T00:00:00Z",
  "pinned": true
}
```

设计要点：

- Profile 是用户日常启动的主入口。
- 当前 `WorkspaceSessionDialog.vue` 中的选择项可以逐步演进为 Profile 编辑器。
- `lastUsedAt` 支持最近使用排序。
- `pinned` 支持固定常用工作区。

### Launch Check

Launch Check 是启动前检查结果，用于提前发现失败风险。

建议检查项：

- command 是否为空。
- command 是否可执行或能被 PATH 找到。
- cwd 是否存在且可读。
- env 是否包含空 key。
- 代理地址格式是否合法。
- 模板声明的 requiredTools 是否存在。
- Agent 配置是否被禁用。

结果结构：

```json
{
  "status": "warning",
  "items": [
    {
      "id": "command-not-found",
      "level": "error",
      "message": "Command npx was not found in PATH.",
      "suggestion": "Install Node.js or use an absolute command path."
    }
  ]
}
```

状态建议：

- `ok`：可启动。
- `warning`：可启动，但存在风险。
- `error`：阻止启动。

### Launch Diagnostic

Launch Diagnostic 是启动后的诊断记录，用于定位失败阶段。

阶段建议：

1. `config_resolved`：配置解析完成。
2. `preflight_checked`：启动前检查完成。
3. `process_spawned`：子进程已启动。
4. `stderr_received`：收到启动日志。
5. `initialize_sent`：已发送 ACP initialize。
6. `initialize_completed`：初始化成功。
7. `auth_checked`：认证状态确认。
8. `session_created`：会话创建完成。
9. `ready`：进入聊天可用状态。
10. `failed`：失败并附带原因。

## 信息架构

建议把 Agent 工作台拆成三个主要入口。

### 1. Agent 管理

位置：设置页中的 Agent 页签。

功能：

- Agent 列表。
- 新增 Agent。
- 从模板添加。
- 编辑命令、参数、环境变量、标签、描述。
- 启用/停用 Agent。
- 复制 Agent。
- 删除 Agent。
- 运行配置检查。

推荐列表列信息：

| 字段 | 用途 |
| --- | --- |
| 名称 | 识别 Agent |
| 命令 | 快速判断启动方式 |
| 标签 | 分类和筛选 |
| 环境变量数量 | 判断配置复杂度 |
| 最近检查状态 | 展示健康状态 |
| 操作 | 编辑、复制、检查、删除 |

### 2. Profile 管理

位置：新建会话弹窗和设置页均可进入。

功能：

- Profile 列表。
- 固定常用 Profile。
- 最近使用 Profile。
- 编辑 Agent、cwd、代理和授权模式。
- 从当前新建会话表单保存为 Profile。
- 从 Profile 一键启动。

推荐展示方式：

- 新建会话弹窗顶部展示“最近使用”和“固定 Profile”。
- 完整 Profile 管理放在设置页，避免新建会话流程过重。

### 3. 启动诊断

位置：新建会话弹窗右侧摘要区或启动进度区。

功能：

- 启动前检查结果。
- 启动阶段时间线。
- stderr 日志摘要。
- 失败原因和修复建议。
- 复制诊断报告。

推荐交互：

- 点击“创建会话”前自动运行轻量检查。
- 检查失败时阻止启动，并给出明确修复项。
- 检查警告时允许继续，但需要提示风险。
- 启动失败后保留诊断面板，而不是只弹 toast。

## 页面设计建议

### Agent 管理页

当前 `SettingsView.vue` 已经是较好的基础，可以按以下方式增强。

#### 顶部区域

- 左侧：标题、说明、Agent 数量。
- 右侧：`从模板添加`、`新增自定义 Agent`、`打开配置文件`。
- 搜索框：按名称、命令、标签搜索。

#### Agent 列表

建议从纯表格逐步升级为“密集列表 + 展开编辑”。

每一行包含：

- Agent 名称和标签。
- command + args 摘要。
- env 数量。
- 健康状态 badge。
- 最近检查时间。
- 操作按钮：检查、复制、编辑、停用、删除。

#### 编辑区域

编辑时建议分组：

- 基础信息：名称、描述、标签、启用状态。
- 启动命令：command、args。
- 环境变量：复用 `EnvVarEditor.vue`。
- 检查结果：展示配置校验和依赖检查。

### 新建会话弹窗

当前 `WorkspaceSessionDialog.vue` 已经包含 Agent、cwd、proxy、summary 和启动进度。建议演进为两层结构：

#### 快速启动层

- 最近 Profile。
- 固定 Profile。
- 当前选中的 Profile 摘要。
- 一键启动。

#### 高级配置层

- Agent 选择。
- 工作目录选择。
- 代理配置。
- 授权模式。
- 保存为 Profile。
- 启动前检查结果。

### 启动进度区

现有 `StartupProgress.vue` 可进一步承载 Launch Diagnostic：

- 阶段名称。
- 阶段耗时。
- 当前日志。
- 错误原因。
- 建议动作。
- 复制诊断。

## 数据模型建议

### 配置文件分层

当前只有：

```text
<UserConfigDir>/acp_desktop/agents.json
```

建议逐步扩展为：

```text
<UserConfigDir>/acp_desktop/agents.json
<UserConfigDir>/acp_desktop/agent_profiles.json
<UserConfigDir>/acp_desktop/agent_templates.json
<UserConfigDir>/acp_desktop/launch_history.json
```

短期也可以把 profile 合并进现有 store，避免一次性迁移过大。

### Go 结构草案

```go
type AgentConfig struct {
    Command     string            `json:"command"`
    Args        []string          `json:"args"`
    Env         map[string]string `json:"env,omitempty"`
    Description string            `json:"description,omitempty"`
    Tags        []string          `json:"tags,omitempty"`
    TemplateID  string            `json:"templateId,omitempty"`
    Enabled     bool              `json:"enabled"`
    CreatedAt   time.Time         `json:"createdAt,omitempty"`
    UpdatedAt   time.Time         `json:"updatedAt,omitempty"`
}

type AgentProfile struct {
    ID                string      `json:"id"`
    Name              string      `json:"name"`
    AgentName         string      `json:"agentName"`
    CWD               string      `json:"cwd"`
    Proxy             ProxyConfig `json:"proxy"`
    AuthorizationMode string      `json:"authorizationMode"`
    Pinned            bool        `json:"pinned"`
    LastUsedAt        time.Time   `json:"lastUsedAt,omitempty"`
}

type LaunchCheckResult struct {
    Status string            `json:"status"`
    Items  []LaunchCheckItem `json:"items"`
}

type LaunchCheckItem struct {
    ID         string `json:"id"`
    Level      string `json:"level"`
    Message    string `json:"message"`
    Suggestion string `json:"suggestion,omitempty"`
}
```

兼容策略：

- 读取旧 agents.json 时，如果字段缺失，自动补默认值。
- `enabled` 缺失时默认 `true`。
- 不强制迁移用户现有配置。
- 保存时可以输出新字段，但保持 command/args/env 可读。

## 后端能力拆分

建议新增或扩展以下模块。

### `internal/config`

职责：

- Agent Definition 的读取、保存、热更新。
- 配置 sanitize。
- 配置版本兼容。
- 基础字段校验。

新增方法建议：

```go
ValidateAgent(name string) (LaunchCheckResult, error)
CloneAgent(sourceName string, targetName string) (AgentsConfig, error)
SetAgentEnabled(name string, enabled bool) (AgentsConfig, error)
```

### `internal/profile`

职责：

- Profile 的增删改查。
- 最近使用和固定状态维护。
- Profile 与会话创建参数转换。

新增方法建议：

```go
ListProfiles() ([]AgentProfile, error)
SaveProfile(profile AgentProfile) ([]AgentProfile, error)
RemoveProfile(id string) ([]AgentProfile, error)
TouchProfile(id string) error
```

### `internal/agent`

职责：

- 启动前检查。
- Agent 子进程生命周期。
- 启动阶段事件。
- stderr 日志分类。

新增方法建议：

```go
PreflightCheck(cfg config.AgentConfig, cwd string, proxy ProxyConfig) LaunchCheckResult
SpawnWithDiagnostics(req LaunchRequest) (*ProcessHandle, LaunchDiagnostic, error)
```

### `app`

职责：

- 对 Wails 暴露方法。
- 聚合 config/profile/agent/store 能力。
- 统一错误结构。

新增 Wails 方法建议：

```go
ListAgentTemplates() ([]AgentTemplate, error)
ValidateAgent(name string) (LaunchCheckResult, error)
ValidateLaunch(profile AgentProfile) (LaunchCheckResult, error)
ListAgentProfiles() ([]AgentProfile, error)
SaveAgentProfile(profile AgentProfile) ([]AgentProfile, error)
RemoveAgentProfile(id string) ([]AgentProfile, error)
```

## 前端状态设计

### Config Store

现有 `stores/config.js` 可以继续管理 Agent 定义。建议扩展：

- `agentTemplates`
- `agentHealthByName`
- `isValidatingAgent`
- `loadAgentTemplates()`
- `validateAgent(name)`
- `cloneAgent(name)`
- `setAgentEnabled(name, enabled)`

### Session Store

`stores/session.js` 继续负责创建和恢复会话，但应减少对表单字段的直接理解。

建议新增：

- `createSessionFromProfile(profileId)`
- `createSessionFromDraft(draft)`
- `launchCheckResult`
- `launchDiagnostic`

### Profile Store

可以新增 `stores/profile.js`，避免把 Profile 逻辑塞进 session store。

职责：

- Profile 列表。
- 最近使用。
- 固定状态。
- 从当前表单保存 Profile。

## 启动流程设计

建议流程：

```text
选择 Profile 或填写启动表单
        |
        v
前端生成 LaunchDraft
        |
        v
调用 ValidateLaunch
        |
        +-- error: 阻止启动，展示修复建议
        |
        +-- warning: 展示风险，允许继续
        |
        v
SpawnAgent
        |
        v
Initialize ACP
        |
        v
Authenticate / Load Session / New Session
        |
        v
进入 ChatView
```

关键点：

- ValidateLaunch 不应产生副作用。
- SpawnAgent 后产生 LaunchDiagnostic。
- 启动失败时保留用户的 draft，不清空表单。
- Profile 成功启动后更新 `lastUsedAt`。

## 校验规则建议

### Agent Definition 校验

| 规则 | 等级 | 行为 |
| --- | --- | --- |
| name 为空 | error | 阻止保存 |
| command 为空 | error | 阻止保存 |
| command 不在 PATH | error 或 warning | 取决于是否允许 shell 解析 |
| args 解析失败 | error | 阻止保存 |
| env key 为空 | error | 阻止保存 |
| env value 为空 | warning | 允许保存 |
| name 为纯数字 | error | 延续当前逻辑 |
| 与已有 name 重复 | error | 阻止创建 |

### Launch Draft 校验

| 规则 | 等级 | 行为 |
| --- | --- | --- |
| Agent 未选择 | error | 阻止启动 |
| Agent disabled | error | 阻止启动 |
| cwd 不存在 | error | 阻止启动 |
| cwd 不可读 | error | 阻止启动 |
| proxy enabled 但无代理值 | warning | 允许用户决定 |
| proxy URL 非法 | error | 阻止启动 |
| requiredTools 缺失 | warning 或 error | 模板可定义严格程度 |

## UI 状态与反馈

### 健康状态

建议状态：

- `Unchecked`：未检查。
- `OK`：检查通过。
- `Warning`：可用但有风险。
- `Error`：不可用。
- `Checking`：检查中。

展示形式：

- 列表 badge。
- 详情页检查卡片。
- 新建会话摘要区提示。

### 错误文案原则

错误文案应该包含：

- 发生了什么。
- 影响是什么。
- 用户下一步能做什么。

示例：

```text
未找到命令 npx。当前 Agent 无法启动。请安装 Node.js，或在 Agent 配置中使用 npx 的绝对路径。
```

## 分阶段落地计划

### Phase 1：Agent 配置增强

目标：不改变主流程，增强当前 Settings 页。

交付：

- Agent 描述、标签、启用状态。
- 从模板添加 Agent。
- 复制 Agent。
- Agent 配置校验。
- 配置兼容读取。

涉及文件：

- `internal/config/config.go`
- `frontend/src/components/SettingsView.vue`
- `frontend/src/stores/config.js`
- `frontend/src/components/AgentSelector.vue`

### Phase 2：Profile 与最近使用

目标：减少重复创建会话的成本。

交付：

- Profile 数据结构。
- 保存当前启动配置为 Profile。
- 最近使用 Profile。
- 固定 Profile。
- 从 Profile 一键启动。

涉及文件：

- `internal/store/store.go` 或新增 `internal/profile`
- `frontend/src/components/WorkspaceSessionDialog.vue`
- `frontend/src/components/WelcomePanel.vue`
- `frontend/src/stores/session.js`
- 新增 `frontend/src/stores/profile.js`

### Phase 3：启动前检查与诊断

目标：降低启动失败排查成本。

交付：

- ValidateLaunch Wails 方法。
- 启动前检查 UI。
- 启动阶段时间线。
- 失败诊断报告。
- 复制诊断信息。

涉及文件：

- `internal/agent/manager.go`
- `app/app.go`
- `frontend/src/components/StartupProgress.vue`
- `frontend/src/components/WorkspaceSessionDialog.vue`

### Phase 4：API 与外部集成准备

目标：把 Agent 工作台能力抽象为可复用服务。

交付：

- Agent/Profile service 层。
- API DTO。
- 本地 API server 首批接口可调用 Agent/Profile 数据。
- API 调用也走同一套启动校验和权限策略。

涉及文件：

- 新增 `internal/api`
- 新增 `internal/profile`
- `app/app.go`
- `docs/` API 文档

## 可拆 issue 建议

1. 扩展 AgentConfig：增加 description、tags、templateId、enabled、createdAt、updatedAt。
2. Agent 模板列表：内置当前 defaultConfig 中的常见 Agent 模板，并支持一键添加。
3. Agent 复制功能：在 SettingsView 中增加复制为新 Agent。
4. Agent 启用/停用：停用后在 AgentSelector 中隐藏或置灰。
5. Agent 配置校验：保存前校验字段，启动前校验 command 和 env。
6. Profile 数据结构：新增本地存储和 Wails 方法。
7. 保存为 Profile：在 WorkspaceSessionDialog 中将当前表单保存为 Profile。
8. 最近 Profile：按 lastUsedAt 展示最近启动组合。
9. 启动前检查面板：创建会话前展示 ok/warning/error 结果。
10. 启动诊断报告：启动失败时展示阶段、stderr、错误和建议。
11. Profile 一键启动：从 WelcomePanel 或 Session launcher 直接启动。
12. Agent 工作台文档同步：README 增加 Agent 工作台能力说明。

## 风险与取舍

### 数据迁移风险

扩展 `agents.json` 时要保证旧配置可读。不要要求用户手动迁移。

建议：

- 字段缺失自动补默认值。
- 保存时保留可读 JSON。
- 对外文档说明新旧字段兼容。

### UI 复杂度风险

Agent 工作台功能多，容易把设置页变得过重。

建议：

- Settings 页负责完整管理。
- 新建会话弹窗只保留启动所需的最小入口。
- 高级项默认折叠。

### 校验准确性风险

跨平台 command 查找、shell 行为和 npx 启动方式可能有差异。

建议：

- 初期校验只做明确可靠的规则。
- command-not-found 可以先作为 warning，再逐步严格。
- 允许用户使用绝对路径绕过 PATH 问题。

### API 复用风险

如果后续开放 API，UI 和 API 各自实现启动逻辑会造成分叉。

建议：

- 早期就抽出 Agent/Profile service。
- UI 和 API 调用同一套 service。
- 诊断、权限、校验都走同一套模型。

## 验收标准

Agent 工作台第一阶段可按以下标准验收：

- 用户可以从模板创建 Agent。
- 用户可以为 Agent 添加描述和标签。
- 用户可以复制、启用、停用 Agent。
- 保存 Agent 前能看到明确字段校验。
- 新建会话前能看到启动检查结果。
- 启动失败时能看到失败阶段和建议动作。
- 老版本 `agents.json` 能正常读取。

Profile 阶段可按以下标准验收：

- 用户可以保存当前 Agent + cwd + proxy + authorizationMode 为 Profile。
- 用户可以从最近 Profile 一键启动。
- Profile 成功启动后会更新最近使用时间。
- 用户可以固定、重命名、删除 Profile。
- Profile 不会破坏原有手动创建会话流程。

## 结论

Agent 工作台是 ACP DESKTOP 最适合优先深化的产品方向。它直接连接当前已有能力，也能为权限治理、会话沉淀、可观测性和 API 开放提供共同基础。建议先从 Agent 配置增强和启动前校验开始，随后引入 Profile 和启动诊断，最后再将这些能力抽象为本地 API 可复用的服务层。

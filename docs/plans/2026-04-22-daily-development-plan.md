# ACP DESKTOP 今日开发计划

**日期：** 2026-04-22

**目标：** 按当前产品方向推进三条可落地能力：会话 metadata 使用 JSON 文件落库、Traffic Monitor 增加耗时展示和错误诊断文案、工作区增加 Git 提交信息生成与提交功能。

**今日原则：**

1. 优先围绕已有会话、工作区和调试面板扩展，不重做现有架构。
2. 数据落库保持向后兼容，旧 `sessions.json` 可无迁移读取。
3. Git 提交必须有用户确认，不做静默提交。
4. 每个功能都要能通过构建和手工回归验证。

---

## 当前功能分析

### 1. 会话与工作区现状

当前会话数据由前端 `session` store 管理，并通过 Wails 后端的 JSON store 保存到用户配置目录。主要持久化入口是：

- `frontend/src/stores/session.js`
  - 使用 `STORE_PATH = 'sessions.json'`
  - 保存 `sessions` 和 `workspaces`
  - 负责新建、恢复、刷新、删除和断开会话
- `frontend/src/stores/session/session-models.js`
  - 提供工作区路径标准化、代理配置标准化、消息和 plan 克隆
- `internal/store/store.go`
  - 提供 `LoadStore(name)` / `SaveStore(name, value)`
  - 防止绝对路径和 `..` 逃逸，适合继续承载 JSON 落库

已有能力已经可以支撑 session metadata 扩展。短板是会话当前主要保存标题、消息、cwd、Agent、代理和 plan 等运行态信息，缺少独立的摘要、标签、状态、提交关联等资产化字段。

### 2. Traffic Monitor 现状

当前 Traffic Monitor 由三部分组成：

- `frontend/src/lib/acp-bridge.js`
  - 在 JSON-RPC request、response、notification 进出时写入 traffic store
  - 已记录 direction、type、method、requestId、payload、error
- `frontend/src/stores/traffic.js`
  - 保存最多 500 条通信记录
  - 支持暂停、清空、类型过滤、搜索
- `frontend/src/views/traffic/TrafficMonitor.vue`
  - 展示通信列表、展开 JSON、复制 payload

短板是缺少 request 到 response 的耗时关联，也缺少对常见错误的诊断文案。用户能看到协议报文，但不容易知道“慢在哪里”和“下一步该怎么处理”。

### 3. 工作区 Git 能力现状

当前工作区页 `frontend/src/views/workspace/WorkspacesView.vue` 主要按 Agent 展示会话列表和会话预览，还没有 Git 状态、diff、提交信息生成或提交能力。

后端 `app/app.go` 暴露了文件、store、Agent、配置和系统 API，但还没有 Git 相关 API。要实现提交功能，需要新增后端能力，并在前端工作区页提供明确的确认流程。

### 4. 今日聚焦范围

今日不推进 Agent 启动前校验和权限弹窗改造，主线调整为：

1. 会话 metadata JSON 文件落库。
2. Traffic Monitor 耗时展示和错误诊断文案。
3. 工作区 Git 提交信息生成和提交。

---

## 方向一：会话 Metadata 使用 JSON 文件落库

### 目标

把会话从“可恢复聊天记录”推进为“可管理工作资产”。先通过 JSON 文件保存最小 metadata，后续再扩展摘要编辑、标签过滤、导出和提交关联。

### 数据设计

继续使用现有 store 文件：

```text
<UserConfigDir>/acp_desktop/stores/sessions.json
```

在每个 session 对象中新增 metadata 字段：

```json
{
  "summary": "",
  "status": "active",
  "tags": [],
  "git": {
    "lastCommitHash": "",
    "lastCommitSubject": "",
    "lastCommittedAt": 0
  },
  "createdAt": 0,
  "metadataUpdatedAt": 0
}
```

字段说明：

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `summary` | string | `""` | 会话摘要，先支持空值和展示 |
| `status` | string | `active` | 会话状态，先保留 `active` / `archived` |
| `tags` | string[] | `[]` | 标签数组，后续用于过滤 |
| `git.lastCommitHash` | string | `""` | 最近一次关联提交 hash |
| `git.lastCommitSubject` | string | `""` | 最近一次关联提交标题 |
| `git.lastCommittedAt` | number | `0` | 最近一次关联提交时间戳 |
| `createdAt` | number | 当前时间 | 会话创建时间 |
| `metadataUpdatedAt` | number | 当前时间 | metadata 更新时间 |

### 涉及文件

- `frontend/src/stores/session.js`
- `frontend/src/stores/session/session-models.js`
- `frontend/src/views/chat/SessionPreview.vue`
- `frontend/src/views/workspace/WorkspacesView.vue`
- `internal/store/store.go`

### 实施步骤

1. 在 `session-models.js` 新增 `normalizeSessionMetadata(session)` 或 `normalizeSession(session)`。
2. 在 `initStore()` 读取旧 sessions 时补齐新增字段。
3. 新建会话时写入默认 metadata。
4. 保存会话时保留 metadata，不因 runtime snapshot 覆盖丢失。
5. 在 `SessionPreview` 中展示 summary：
   - 有 summary 时展示 summary。
   - 无 summary 时展示会话标题、最近用户消息或空状态提示。
6. 在工作区会话列表中预留 tags/status 展示位置，但今日不做复杂标签编辑器。

### 验收标准

- 旧 `sessions.json` 可正常读取。
- 新建会话会写入 `summary`、`status`、`tags`、`git`、`createdAt`、`metadataUpdatedAt`。
- 已有会话恢复、断开、刷新后 metadata 不丢失。
- `sessions.json` 仍是合法格式化 JSON。
- `cd frontend && npm run build` 通过。

---

## 方向二：Traffic Monitor 耗时展示和错误诊断文案

### 目标

让 Traffic Monitor 从“报文记录器”升级为“协议排错面板”：用户不仅能看到 JSON-RPC 报文，还能看到请求耗时、慢请求提示和常见错误解释。

### 数据设计

Traffic entry 增加字段：

```js
{
  startedAt: 0,
  completedAt: 0,
  durationMs: 0,
  diagnostic: ''
}
```

说明：

- request entry 写入 `startedAt`。
- response entry 根据 `requestId` 匹配 request，写入 `durationMs`。
- error response 写入 `diagnostic`。
- notification 不强制要求耗时。

### 涉及文件

- `frontend/src/lib/acp-bridge.js`
- `frontend/src/stores/traffic.js`
- `frontend/src/views/traffic/TrafficMonitor.vue`
- `frontend/src/lib/i18n.js`
- 可选新增 `frontend/src/lib/diagnostics.js`

### 实施步骤

1. 在 traffic store 增加 pending request 索引：
   - key 使用 `requestId`
   - value 保存 method、timestamp
2. 发送 request 时记录开始时间。
3. 收到 response 时按 `requestId` 计算耗时。
4. Traffic Monitor 列表中展示耗时：
   - `< 1000ms` 显示如 `83ms`
   - `>= 1000ms` 显示如 `1.4s`
   - 超过阈值的请求使用轻量 warning 样式
5. 新增错误诊断函数，首批覆盖：
   - `Request timeout: initialize`
   - `Request timeout: session/new`
   - `Request timeout: session/prompt`
   - JSON-RPC `Method not found`
   - authentication cancelled
   - connection cancelled
   - command / executable not found
6. 在展开 payload 时显示诊断文案，不替代原始错误。

### UI 建议

Traffic Monitor 单行信息建议调整为：

```text
12:30:15.123 -> session/prompt #8  4.2s  (response)
```

错误 response 展开后显示：

```text
诊断建议：请求超时，Agent 可能仍在启动、认证阻塞或协议未返回响应。可查看启动日志和 Process Manager。
```

### 验收标准

- request 和 response 能正确关联耗时。
- initialize、session/new、session/prompt 都能看到耗时。
- response 缺少匹配 request 时不报错。
- error response 可显示诊断建议。
- 暂停、清空、搜索、类型过滤仍可用。
- `cd frontend && npm run build` 通过。

---

## 方向三：工作区添加 Git 提交信息生成和提交功能

### 目标

在工作区页增加 Git 工作流能力：读取当前工作区 Git 状态，基于变更生成提交信息，用户确认后执行提交，并把提交结果关联回会话 metadata。

### 产品流程

1. 用户进入工作区页。
2. 选择一个工作区或会话对应的 cwd。
3. 点击“Git 提交”。
4. 系统读取 Git 状态和 diff 摘要。
5. 系统生成提交信息草稿。
6. 用户可编辑提交信息。
7. 用户点击提交。
8. 应用执行 `git add` 和 `git commit`。
9. 提交成功后显示 commit hash，并可写入当前会话 metadata。

### 安全边界

1. 不做静默提交，必须用户点击确认。
2. 默认只提交工作区内变更。
3. 提交前展示将要提交的文件列表。
4. 如果工作区不是 Git 仓库，显示明确提示。
5. 如果没有变更，不允许提交。
6. 如果存在 merge/rebase 状态，先提示用户处理，不自动继续。

### 后端 API 设计

建议在 Go 后端新增 Git service，例如：

```text
internal/git/git.go
```

Wails 绑定方法可放在 `app/app.go`：

```go
GetGitStatus(cwd string) (git.Status, error)
GenerateGitCommitMessage(cwd string) (git.CommitMessageDraft, error)
CommitWorkspaceChanges(cwd string, message string) (git.CommitResult, error)
```

数据结构建议：

```go
type Status struct {
  IsRepo bool `json:"isRepo"`
  Branch string `json:"branch"`
  Ahead int `json:"ahead"`
  Behind int `json:"behind"`
  Files []FileStatus `json:"files"`
  HasStaged bool `json:"hasStaged"`
  HasUnstaged bool `json:"hasUnstaged"`
  HasUntracked bool `json:"hasUntracked"`
  MergeInProgress bool `json:"mergeInProgress"`
}

type FileStatus struct {
  Path string `json:"path"`
  Status string `json:"status"`
}

type CommitMessageDraft struct {
  Subject string `json:"subject"`
  Body string `json:"body"`
  Files []FileStatus `json:"files"`
}

type CommitResult struct {
  Hash string `json:"hash"`
  Subject string `json:"subject"`
}
```

### 提交信息生成策略

今日先做本地规则生成，不依赖外部模型：

1. 读取 `git status --short`。
2. 读取 `git diff --stat` 和可选 `git diff --cached --stat`。
3. 根据文件类型和路径生成提交类型：
   - docs 变更：`docs: ...`
   - frontend 变更：`feat: ...` 或 `fix: ...`
   - Go 后端变更：`feat: ...` 或 `fix: ...`
   - 配置/CI 变更：`chore: ...`
4. 默认 subject 使用简洁中文或英文需要保持项目风格。当前项目文档主语言为中文，但 Git commit 可继续使用 conventional commit 英文前缀。

示例：

```text
feat: add workspace git commit workflow

- add git status summary for selected workspace
- generate commit message draft from changed files
- commit confirmed workspace changes
```

### 前端 UI 设计

建议在 `WorkspacesView.vue` 右侧详情区域增加 Git 面板：

- 仓库状态：branch、变更文件数、是否有 staged/unstaged/untracked。
- 文件列表：状态码 + path。
- 操作按钮：
  - 刷新
  - 生成提交信息
  - 提交
- 提交信息编辑：
  - subject input
  - body textarea
- 提交确认弹窗：
  - 展示文件数、branch、subject
  - 用户确认后提交

如果 WorkspacesView 变得过重，建议拆分：

```text
frontend/src/views/workspace/GitCommitPanel.vue
```

### 涉及文件

- 新增 `internal/git/git.go`
- 修改 `app/app.go`
- 修改 `wailsjs` 绑定生成结果
- 修改 `frontend/src/lib/wails.js`
- 修改 `frontend/src/views/workspace/WorkspacesView.vue`
- 可选新增 `frontend/src/views/workspace/GitCommitPanel.vue`
- 修改 `frontend/src/lib/i18n.js`
- 修改 `frontend/src/stores/session.js`

### 验收标准

- 非 Git 目录显示“当前工作区不是 Git 仓库”。
- Git 仓库无变更时不允许提交。
- Git 仓库有变更时可看到文件列表。
- 可生成提交信息草稿。
- 用户可编辑提交信息。
- 点击提交前有确认弹窗。
- 提交成功后显示 hash 和 subject。
- 如果当前选中会话存在，可把提交信息写入 session metadata 的 `git` 字段。
- `go test ./...` 通过。
- `cd frontend && npm run build` 通过。

---

## 今日建议实施顺序

| 顺序 | 任务 | 原因 | 产出 |
| --- | --- | --- | --- |
| 1 | 会话 metadata JSON 落库 | 数据基础最小、风险较低，也为 Git 提交关联做准备 | session metadata 默认字段和展示 |
| 2 | Traffic Monitor 耗时展示 | 只改前端桥接和面板，能快速提升排错体验 | durationMs、慢请求样式、错误诊断 |
| 3 | Git 后端 API | Git 提交需要后端能力，先打通 status/message/commit | `internal/git` 和 Wails API |
| 4 | Git 前端面板 | 在工作区页接入 Git 工作流 | 状态、草稿、确认提交 |
| 5 | 元数据关联提交结果 | 把方向一和方向三闭环 | commit hash 写入 session metadata |
| 6 | 构建与回归 | 确认没有破坏现有会话主线 | Go 测试、前端构建、手工检查 |

---

## 今日时间安排

| 时间段 | 内容 | 产出 |
| --- | --- | --- |
| 09:30-10:30 | 会话 metadata normalize 和 JSON 落库 | 兼容旧数据、新会话默认 metadata |
| 10:30-11:30 | SessionPreview / WorkspacesView 展示 metadata | 摘要、标签、状态预留展示 |
| 13:30-14:30 | Traffic request/response 耗时关联 | `durationMs` 和慢请求标识 |
| 14:30-15:10 | 错误诊断文案第一版 | diagnostic 函数和 UI 展示 |
| 15:10-16:20 | Git 后端 API | status、message draft、commit |
| 16:20-17:20 | 工作区 Git 提交 UI | GitCommitPanel、确认提交 |
| 17:20-18:00 | 构建、测试、手工回归 | 验证结果与遗留问题 |

---

## 自动化验证

```bash
go test ./...
cd frontend && npm run build
```

如修改 Wails 绑定，需要补充：

```bash
wails generate module
```

如果本地 Wails CLI 不可用，则记录阻塞，并至少完成 Go 编译和前端构建前的接口适配检查。

---

## 手工回归清单

### 会话 metadata

1. 删除或备份旧 `sessions.json` 后启动应用，新建会话，确认 store 文件生成。
2. 使用已有旧格式 `sessions.json` 启动，确认不会报错。
3. 新建、断开、恢复会话，确认 metadata 不丢失。
4. 工作区页和会话预览可正常展示摘要/状态信息。

### Traffic Monitor

1. 创建会话并发送 prompt，确认 request/response 都记录。
2. 查看 initialize、session/new、session/prompt 的耗时。
3. 模拟或等待错误 response，确认诊断文案显示。
4. 暂停、清空、搜索、过滤功能正常。

### Git 提交功能

1. 选择非 Git 工作区，确认显示非仓库提示。
2. 选择无变更 Git 工作区，确认提交按钮不可用。
3. 选择有变更 Git 工作区，确认文件列表正确。
4. 点击生成提交信息，确认 subject/body 可编辑。
5. 点击提交，确认弹窗出现。
6. 确认提交后，检查 commit hash 显示。
7. 在终端运行 `git status --short` 和 `git log -1 --oneline` 核对结果。
8. 如果选中了会话，确认 session metadata 记录提交结果。

---

## 风险与取舍

### 1. Git commit 会修改用户仓库历史

这是今日最高风险点。

处理方式：必须显示确认弹窗；不自动 push；提交前展示文件列表、branch 和 message；失败时展示原始错误。

### 2. `git add` 策略需要保守

如果直接 `git add -A`，可能提交用户不想包含的未跟踪文件。

处理方式：今日可先提交全部工作区变更，但 UI 必须展示完整文件列表，并在确认弹窗中写明“将提交当前工作区全部变更”。后续再做文件勾选。

### 3. 提交信息生成不能过度承诺

今日先用本地规则生成草稿，不声称 AI 总结。

处理方式：按钮命名为“生成草稿”，允许用户编辑；后续可再接入 Agent 辅助生成。

### 4. session metadata 要兼容旧数据

旧数据缺字段很常见。

处理方式：所有新增字段通过 normalize 补齐，不写一次性迁移脚本。

### 5. Traffic 耗时匹配可能缺失

如果 response 无匹配 request，不应影响 UI。

处理方式：耗时为空时显示 `--`，保留原始 payload。

---

## 次日候选任务

1. Git 文件勾选提交：允许选择部分文件 stage/commit。
2. 使用当前会话内容生成更准确的提交信息。
3. 会话 summary 和 tags 编辑 UI。
4. 按 tags/status 搜索和过滤会话。
5. Traffic Monitor 增加 method、耗时区间、错误状态的高级过滤。
6. Git 提交历史与会话关联列表。

---

## 今日完成定义

今日完成后，ACP DESKTOP 应具备一条更完整的工作闭环：

会话信息能结构化落库，协议调试能看到耗时和诊断，工作区变更能在用户确认后生成提交信息并完成 Git 提交，同时提交结果可以回写到会话 metadata。

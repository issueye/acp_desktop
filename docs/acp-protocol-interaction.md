# ACP 协议交互说明

本文档基于当前项目实现，说明 ACP DESKTOP 与 ACP Agent 之间的协议交互链路、消息流转方式和前后端职责边界。

## 总体架构

ACP DESKTOP 将 ACP Agent 作为本地子进程启动，并通过标准输入/输出进行 JSON-RPC 消息交互。Go 后端负责进程生命周期和 Wails IPC 转发，Vue 前端负责 ACP JSON-RPC 封装、会话状态管理、权限确认和 UI 渲染。

```mermaid
flowchart LR
  UI["Vue UI"]
  Store["Pinia Session Store"]
  Bridge["AcpClientBridge"]
  Wails["Wails Binding"]
  GoApp["Go App"]
  AgentMgr["Agent Manager"]
  Agent["ACP Agent Process"]

  UI <--> Store
  Store <--> Bridge
  Bridge <--> Wails
  Wails <--> GoApp
  GoApp <--> AgentMgr
  AgentMgr <--> Agent
```

## 关键文件

- `frontend/src/lib/acp-bridge.js`：ACP JSON-RPC 桥接层，负责发送请求、接收响应、处理通知和 Agent 反向请求。
- `frontend/src/stores/session.js`：会话状态管理，负责创建会话、恢复会话、发送 Prompt、处理 `session/update`。
- `frontend/src/lib/wails.js`：前端调用 Wails 后端能力的封装。
- `internal/agent/manager.go`：Agent 子进程管理，负责启动进程、写入 stdin、读取 stdout/stderr。
- `app/app.go`：Wails 绑定方法，暴露 Agent、配置、存储和文件读写能力。
- `frontend/src/stores/traffic.js`：ACP 通信监控数据存储。
- `frontend/src/components/TrafficMonitor.vue`：ACP 通信监控面板。
- `frontend/src/components/PermissionDialog.vue`：权限确认弹窗。

## 进程与消息通道

Agent 启动流程由 Go 后端完成：

1. 前端调用 `spawnAgent(agentName, envOverrides)`。
2. Wails 调用 Go 方法 `App.SpawnAgent`。
3. `internal/agent.Manager` 根据 `agents.json` 中的 `command`、`args` 和 `env` 启动子进程。
4. Go 后端保存该 Agent 的 stdin，并持续扫描 stdout/stderr。
5. stdout 每一行会作为一条 `agent-message` 事件发给前端。
6. stderr 每一行会作为 `agent-stderr` 事件发给前端，用于启动过程日志和阶段识别。

当前实现中，ACP JSON-RPC 消息以“单行 JSON 字符串”的形式通过子进程 stdin/stdout 传输。

```text
Frontend -> Wails -> Go -> Agent stdin
Agent stdout -> Go -> Wails event -> Frontend
```

## JSON-RPC 处理模型

`AcpClientBridge` 统一处理三类 JSON-RPC 消息：

- Response：包含 `id`，不包含 `method`，用于匹配前端发出的请求。
- Request：包含 `id` 和 `method`，表示 Agent 调用客户端能力。
- Notification：不包含 `id`，包含 `method`，表示 Agent 推送事件。

发送请求时，桥接层会：

1. 生成自增 `id`。
2. 记录 `id -> method`，用于 Traffic Monitor 展示。
3. 将 JSON-RPC 请求写入 Agent stdin。
4. 等待相同 `id` 的响应。
5. 如果响应包含 `error`，转换为前端 Error。

请求超时策略：

- `session/prompt`：不设置超时，因为长任务可能持续较久。
- `initialize`、`authenticate`、`session/new`、`session/load`：180 秒。
- 其他请求：60 秒。

## 初始化交互

创建或恢复会话前，前端会先初始化 Agent。

请求方法：

```text
initialize
```

当前客户端发送的关键参数：

```json
{
  "protocolVersion": 1,
  "clientCapabilities": {
    "fs": {
      "readTextFile": true,
      "writeTextFile": true
    }
  },
  "clientInfo": {
    "name": "acp-ui",
    "title": "ACP DESKTOP",
    "version": "<appVersion>"
  }
}
```

初始化响应会被用于：

- 判断 Agent 是否支持 `loadSession`。
- 获取可用认证方式 `authMethods`。
- 为后续新建或恢复会话做能力判断。

## 创建会话

创建新会话由 `session.js` 中的 `createSession(agentName, cwd, proxy)` 发起。

主要流程：

1. 根据 Agent 配置启动 Agent 子进程。
2. 创建 `AcpClientBridge` 并监听 `agent-message`。
3. 调用 `initialize`。
4. 调用 `session/new`。
5. 保存返回的 ACP `sessionId`。
6. 创建本地会话快照，并写入 `sessions.json`。
7. 绑定 `client.onSessionUpdate`，用于处理后续流式更新。

请求方法：

```text
session/new
```

当前请求参数：

```json
{
  "cwd": "<selected-working-directory>",
  "mcpServers": []
}
```

如果 `session/new` 返回认证相关错误，并且初始化响应提供了 `authMethods`，应用会弹出认证方式选择，选择后调用：

```text
authenticate
```

认证完成后再次调用 `session/new`。

## 恢复会话

恢复会话由 `resumeSession(savedSession)` 发起。

主要流程：

1. 按保存的 Agent 名称重新启动 Agent 子进程。
2. 调用 `initialize`。
3. 调用 `session/load`。
4. 应用 Agent 返回的模式、模型等能力信息。
5. 如果本地保存了历史消息，则恢复到 UI。
6. 更新本地会话时间并保存快照。

请求方法：

```text
session/load
```

当前请求参数：

```json
{
  "sessionId": "<acp-session-id>",
  "cwd": "<saved-working-directory>",
  "mcpServers": []
}
```

## 发送 Prompt

用户在聊天输入框发送消息后，`session.js` 中的 `sendPrompt(text)` 会：

1. 先在本地消息列表追加用户消息，保证 UI 即时响应。
2. 设置当前会话 `isLoading = true`。
3. 调用 ACP `session/prompt`。
4. 等待 Agent 返回 stop reason。
5. 同步本地会话快照到 `sessions.json`。
6. 将 `isLoading` 置回 `false`。

请求方法：

```text
session/prompt
```

当前请求参数：

```json
{
  "sessionId": "<acp-session-id>",
  "prompt": [
    {
      "type": "text",
      "text": "<user-input>"
    }
  ]
}
```

## 取消操作

当用户点击取消时，前端发送 JSON-RPC Notification，而不是 Request。

通知方法：

```text
session/cancel
```

参数：

```json
{
  "sessionId": "<acp-session-id>"
}
```

## 会话更新通知

Agent 通过 Notification 推送会话更新。

通知方法：

```text
session/update
```

`AcpClientBridge` 收到该通知后，会调用 `client.onSessionUpdate(params)`。当前项目在 `session.js` 中处理以下更新类型：

| update.sessionUpdate | UI 行为 |
| --- | --- |
| `user_message_chunk` | 将文本追加到用户消息 |
| `agent_message_chunk` | 将文本追加到助手消息 |
| `agent_thought_chunk` | 将文本追加到助手思考内容 |
| `tool_call` | 新增工具调用并展示工具状态 |
| `tool_call_update` | 更新工具调用状态或标题 |
| `plan` | 更新右侧当前计划面板 |
| `current_mode_update` | 更新当前模式 |
| `session_info_update` | 更新会话标题和更新时间 |
| `available_commands_update` | 更新 `/` 命令提示列表 |

消息渲染层会将内容拆成 `parts`：

- `content`：普通正文。
- `thought`：思考内容。
- `tool_call`：工具调用。
- `plan`：任务计划。

这样可以在同一条助手消息中按不同类型渲染内容。

## 工具调用展示

Agent 发出 `tool_call` 更新后，前端会记录：

- `toolCallId`
- `title`
- `kind`
- `status`
- `locations`

工具状态变化通过 `tool_call_update` 更新。UI 中会展示工具名称、状态、路径和长内容展开/收起。

常见状态包括：

- `pending`
- `in_progress`
- `completed`
- `failed`

## 权限确认

当 Agent 需要执行敏感操作时，会向客户端发起 JSON-RPC Request：

```text
session/request_permission
```

桥接层会将请求转换为前端可渲染的 `pendingPermissionRequest`，包含：

- `sessionId`
- `toolCall`
- `options`

`PermissionDialog.vue` 会展示：

- 工具类型
- 命令预览
- 涉及路径
- Agent 提供的可选操作
- 取消按钮

用户选择后，前端返回：

```json
{
  "outcome": {
    "outcome": "selected",
    "optionId": "<selected-option-id>"
  }
}
```

用户取消时返回：

```json
{
  "outcome": {
    "outcome": "cancelled"
  }
}
```

## 文件系统能力

客户端在 `initialize` 中声明支持：

```json
{
  "fs": {
    "readTextFile": true,
    "writeTextFile": true
  }
}
```

Agent 可以通过 JSON-RPC Request 调用客户端文件能力。

### 读取文本文件

方法：

```text
fs/read_text_file
```

桥接流程：

1. Agent 发送 `fs/read_text_file`。
2. `AcpClientBridge.readTextFile(params)` 调用前端 `readTextFile`。
3. Wails 调用 Go 后端 `App.ReadTextFile(path, line, limit)`。
4. Go 后端读取本地文件并返回文本。
5. 前端返回 JSON-RPC Response：

```json
{
  "content": "<file-content>"
}
```

### 写入文本文件

方法：

```text
fs/write_text_file
```

桥接流程：

1. Agent 发送 `fs/write_text_file`。
2. `AcpClientBridge.writeTextFile(params)` 调用前端 `writeTextFile`。
3. Wails 调用 Go 后端 `App.WriteTextFile(path, content)`。
4. Go 后端自动创建目录并写入文件。
5. 前端返回空对象：

```json
{}
```

## 模式与模型切换

当 Agent 提供模式或模型能力时，前端会展示对应选择器。

模式切换：

```text
session/set_mode
```

参数：

```json
{
  "sessionId": "<acp-session-id>",
  "modeId": "<mode-id>"
}
```

模型切换：

```text
session/set_model
```

参数：

```json
{
  "sessionId": "<acp-session-id>",
  "modelId": "<model-id>"
}
```

## ACP Traffic Monitor

项目内置 ACP 通信监控面板，用于观察 JSON-RPC 消息。

记录内容包括：

- 方向：`in` / `out`
- 类型：`request` / `response` / `notification`
- 方法名
- 请求 ID
- 原始 payload
- 是否为错误响应
- 时间戳

监控面板支持：

- 暂停/恢复采集
- 清空记录
- 按 Request/Response/Notification 过滤
- 搜索 method 或 payload
- 展开查看 JSON
- 复制 JSON

为避免内存持续增长，当前最多保留 500 条记录。

## 错误处理

当前实现中的主要错误处理策略：

- JSON-RPC Response 包含 `error` 时，会转换为 JavaScript `Error`。
- 未识别的 Agent Request 方法返回 `-32601 Method not found`。
- Agent Request 处理异常返回 `-32603`。
- 请求超时后 reject 对应 Promise。
- Agent 输出无法解析为 JSON 时写入控制台错误。
- 会话创建、恢复、发送 Prompt 的错误会同步到 session store 的 `error` 状态并显示到 UI。

## 本地持久化

ACP 交互产生的会话快照会保存到：

```text
<UserConfigDir>/acp_desktop/stores/sessions.json
```

会话快照包含：

- 本地会话 ID
- ACP `sessionId`
- Agent 名称
- 工作目录
- 代理配置
- 消息历史
- 当前任务计划
- 更新时间
- 是否支持 `loadSession`

## 当前实现边界

- ACP 消息以 stdout/stdin 的单行 JSON 方式传输。
- 当前客户端声明的文件能力仅包含文本文件读写。
- `session/prompt` 不设置超时，适合长任务，但需要用户手动取消。
- 未识别的 `session/update` 类型会记录到控制台，不会阻塞会话。
- `mcpServers` 当前传空数组，暂未在 UI 中配置 MCP Server。

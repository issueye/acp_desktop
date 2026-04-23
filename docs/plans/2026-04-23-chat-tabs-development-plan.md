# 聊天界面右侧 Tabs 标签页改造开发计划

**日期：** 2026-04-23

**目标：** 将聊天页右侧对话区域改造为多标签页交互。左侧点击会话后，右侧打开或激活对应 session tab，并在 tab 内容区展示该会话的实时聊天或会话预览。

---

## 一、背景与现状

当前聊天页由 `App.vue` 统一编排左侧会话面板与右侧内容区域：

- 左侧会话列表：`frontend/src/views/chat/ChatSessionPanel.vue`
- 左侧交互逻辑：`frontend/src/views/chat/useChatSessionPanel.js`
- 会话点击/连接/激活：`frontend/src/views/chat/useChatSessionActions.js`
- 右侧实时聊天：`frontend/src/views/chat/ChatView.vue`
- 右侧离线预览：`frontend/src/views/chat/SessionPreview.vue`
- 会话状态源：`frontend/src/stores/session.js`

当前关键逻辑如下：

1. `App.vue` 中维护 `previewSessionId`，用于记录左侧当前预览会话。
   - `frontend/src/App.vue:48`
   - `frontend/src/App.vue:69`
2. 左侧 `ChatSessionPanel` 通过 `v-model:preview-session-id` 更新当前预览会话。
   - `frontend/src/App.vue:348`
3. 右侧根据 `shouldShowLiveChat` 决定展示实时 `ChatView` 或 `SessionPreview`。
   - `frontend/src/App.vue:362`
4. 左侧点击已连接会话时，会调用 `sessionStore.setActiveSession(sessionId)` 激活实时会话；点击未连接会话时，只更新 `previewSessionId`。
   - `frontend/src/views/chat/useChatSessionActions.js`
5. `ChatView.vue` 目前强依赖 `sessionStore.activeSessionId` 派生出的 `currentSession`、`messageList`、`isLoading`、模型、模式、计划等状态。
   - `frontend/src/views/chat/ChatView.vue`
6. `sessionStore` 当前已经支持多个 connected sessions，但所有“当前聊天内容”都通过 `activeSessionId` 取值。
   - `frontend/src/stores/session.js`

因此本次改造不需要重写会话连接模型，核心是新增右侧 tabs 状态管理和 tab 容器，并把“左侧点击会话”的行为从“切换单个预览区”升级为“打开/激活对应标签页”。

---

## 二、改造目标

### 2.1 用户交互目标

1. 左侧点击任意会话：
   - 若右侧已存在该会话 tab，则激活该 tab。
   - 若右侧不存在该会话 tab，则新增一个 tab 并激活。
2. 已连接会话 tab：
   - 展示实时聊天界面。
   - 支持继续输入、发送、取消、刷新、切换模型/模式。
3. 未连接或 external 会话 tab：
   - 默认展示 `SessionPreview`。
   - 可通过预览页继续使用现有 resume 行为连接会话。
4. tab 支持关闭：
   - 关闭非激活 tab 不影响当前展示。
   - 关闭激活 tab 后，按相邻 tab 自动激活；无 tab 时回到欢迎页。
   - 关闭 tab 不主动断开会话，避免误中断运行中的 agent。
5. 左侧选中态与右侧 tab 激活态保持一致。

### 2.2 技术目标

1. 尽量复用现有 `sessionStore.connectedSessions`、`activeSessionId` 和 `previewSessionId`。
2. 新增 tab 状态只承担 UI 级别职责，不重复保存消息、计划、模型等运行时状态。
3. 优先改造 `App.vue` 编排层和聊天区容器，避免大规模改动底层 ACP 连接逻辑。
4. 保持现有单会话实时聊天能力不退化。
5. 保持未连接会话预览、连接、删除、置顶、工作区筛选等现有功能可用。

---

## 三、方案设计

### 3.1 新增右侧 Chat Tabs 容器

新增组件：

```text
frontend/src/views/chat/ChatTabsView.vue
```

职责：

- 渲染 tab header 列表。
- 渲染当前 active tab 内容。
- 管理 tab 关闭按钮点击、tab 激活事件。
- 根据 tab session 状态决定展示：
  - `ChatView`：已连接并被设为 `sessionStore.activeSessionId` 的会话。
  - `SessionPreview`：未连接、external 或仅可预览的会话。
  - `WelcomePanel`：无 tab 时展示空状态。

建议 props：

```js
{
  tabs: Array,
  activeTabId: String,
  previewSession: Object,
  hasAgents: Boolean,
  selectedAgentLabel: String,
  workspaceLabel: String,
  savedSessionCount: Number,
  isConnecting: Boolean,
}
```

建议 emits：

```js
[
  'activate-tab',
  'close-tab',
  'resume-session',
  'open-workspace',
  'open-add-agent',
  'notify',
  'open-git',
]
```

### 3.2 Tab 数据结构

在 `App.vue` 或后续抽出的 composable 中维护：

```js
const chatTabs = ref([]);
const activeChatTabId = ref('');
```

单个 tab 建议结构：

```js
{
  id: session.id,
  sessionId: session.id,
  title: session.title,
  agentName: session.agentName,
  cwd: session.cwd,
  workspaceId: session.workspaceId,
  external: session.external === true,
  openedAt: Date.now(),
  lastActivatedAt: Date.now()
}
```

注意：

- `id` 直接使用 `session.id`，便于去重。
- tab 只保存展示必要字段，真实 session 数据仍以 `sessionStore.visibleSessions` 和 `sessionStore.connectedSessions` 为准。
- 渲染时优先通过 `sessionStore.visibleSessions.find(...)` 获取最新 session 标题、agent、cwd，避免 tab 标题陈旧。

### 3.3 新增 tabs composable

建议新增：

```text
frontend/src/views/chat/useChatTabs.js
```

职责：

- `openSessionTab(session)`：打开或激活 tab。
- `activateChatTab(sessionId)`：激活指定 tab；若已连接，同步 `sessionStore.setActiveSession(sessionId)`。
- `closeChatTab(sessionId)`：关闭 tab，并计算下一个 active tab。
- `syncTabFromSession(session)`：会话标题、workspace 等变化时同步 tab 基本信息。
- `removeClosedSessionTab(sessionId)`：删除会话后移除对应 tab。
- `activeTabSession`：当前 tab 对应的 session。
- `activeTabIsConnected`：当前 tab 是否已连接。

这样可以避免继续加重 `App.vue`。

### 3.4 左侧点击行为调整

当前点击行为在 `useChatSessionActions.js`：

```js
function handleSessionClick(session) {
  previewSessionId.value = session.id;
  if (session.external) return;
  if (isConnectedSession(session.id)) {
    handleActivateSession(session.id);
  }
}
```

改造方向：

1. 左侧点击仍设置 `previewSessionId`，保留现有选中态兼容。
2. 增加事件通知父级打开 tab，例如：

```js
emit('open-session-tab', session);
```

3. `ChatSessionPanel.vue` 增加 emit：

```js
'open-session-tab'
```

4. `App.vue` 接收事件：

```vue
@open-session-tab="handleOpenSessionTab"
```

5. 若 session 已连接，仍调用 `handleActivateSession(session.id)`，保证 `ChatView` 读取到正确 active session。
6. 若 session 未连接，只打开 tab 并展示 `SessionPreview`，不自动连接。

### 3.5 右侧渲染逻辑调整

当前 `App.vue` 中右侧逻辑：

```vue
<ChatView v-if="shouldShowLiveChat" />
<SessionPreview v-else-if="previewSession" />
<WelcomePanel v-else />
```

改造为：

```vue
<ChatTabsView
  v-show="activeRoute === 'chat'"
  :tabs="chatTabs"
  :active-tab-id="activeChatTabId"
  ...
  @activate-tab="handleActivateChatTab"
  @close-tab="handleCloseChatTab"
  @resume-session="chatSessionPanelRef?.handleResumeSession($event)"
/>
```

`ChatTabsView` 内部根据 active tab session 判断：

- active tab session 已连接：
  1. 激活 tab 时调用 `sessionStore.setActiveSession(sessionId)`。
  2. 渲染 `ChatView`。
- active tab session 未连接：
  1. 渲染 `SessionPreview`。
  2. 用户点击 resume 后复用 `ChatSessionPanel` 暴露的 `handleResumeSession`。
- 无 active tab：
  1. 渲染 `WelcomePanel`。

### 3.6 ChatView 适配策略

短期方案：保持 `ChatView.vue` 不接收 `sessionId`，继续读取 `sessionStore.activeSessionId`。

原因：

- 当前 `ChatView.vue` 内部所有 computed 都基于当前 active runtime。
- `sendPrompt`、`setMode`、`setModel`、`refreshCurrentSession` 等 action 默认都作用于 active session。
- 只要 tab 激活时同步调用 `sessionStore.setActiveSession(sessionId)`，即可最小改动复用现有逻辑。

中期可选增强：后续如需后台 tab 保持各自局部输入框草稿，可再让 `ChatView` 接收 `sessionId`，并把 `inputText` 按 sessionId 存储。

### 3.7 输入草稿策略

本次建议先做最小实现：

- `ChatView.vue` 的 `inputText` 仍为组件局部状态。
- 切换 tab 时 `ChatView` 会重新渲染，未发送草稿可能丢失。

如果产品要求保留每个 tab 的输入草稿，则增加：

```js
const chatDraftsBySessionId = ref({});
```

并将 `ChatComposer` 的 `v-model` 提升到 `ChatTabsView` 或 `App.vue`。该增强可作为第二阶段，不阻塞 tabs 主流程。

---

## 四、涉及文件

### 必改文件

```text
frontend/src/App.vue
frontend/src/views/chat/ChatSessionPanel.vue
frontend/src/views/chat/useChatSessionActions.js
```

### 新增文件

```text
frontend/src/views/chat/ChatTabsView.vue
frontend/src/views/chat/useChatTabs.js
```

### 可能调整文件

```text
frontend/src/views/chat/ChatView.vue
frontend/src/views/chat/SessionPreview.vue
frontend/src/views/chat/ChatHeader.vue
frontend/src/lib/i18n.js 或对应 i18n 资源文件
```

说明：

- `ChatView.vue` 只有在需要处理草稿保留、按 sessionId 局部化状态时才调整。
- `ChatHeader.vue` 暂时不需要承担 tab header 职责，避免把会话工具栏和 tabs 导航混在一起。
- i18n 需要增加 tab 相关文案，例如关闭标签页、无标签页、会话已断开等。

---

## 五、实施步骤

### 阶段 1：抽象 Tabs 状态

1. 新增 `useChatTabs.js`。
2. 在 composable 中实现：
   - `chatTabs`
   - `activeChatTabId`
   - `openSessionTab(session)`
   - `activateChatTab(sessionId)`
   - `closeChatTab(sessionId)`
   - `activeTabSession`
   - `activeTabIsConnected`
3. 在 `App.vue` 接入 composable。
4. 先不改变 UI，只通过左侧点击验证 tabs 状态可正确变化。

### 阶段 2：改造左侧点击事件

1. `ChatSessionPanel.vue` 增加 `open-session-tab` emit。
2. `useChatSessionActions.js` 的 `handleSessionClick(session)` 中发出打开 tab 事件。
3. `App.vue` 监听 `@open-session-tab`，调用 `openSessionTab(session)`。
4. 已连接会话点击时，继续调用 `sessionStore.setActiveSession(session.id)`。
5. 未连接会话点击时，只打开/激活 tab，不自动连接。

### 阶段 3：新增 ChatTabsView

1. 新增 `ChatTabsView.vue`。
2. 设计 tab header：
   - 标题：session title。
   - 副信息：agentName 或 cwd 简写。
   - 状态点：已连接、加载中、external。
   - 关闭按钮。
3. 设计 tab content：
   - connected + active：渲染 `ChatView`。
   - disconnected/external：渲染 `SessionPreview`。
   - empty：渲染 `WelcomePanel`。
4. 样式复用现有 UED 变量：
   - `var(--ued-bg-panel)`
   - `var(--ued-border-default)`
   - `var(--ued-text-primary)`
   - `var(--ued-accent)`

### 阶段 4：替换 App.vue 右侧渲染

1. 移除 `shouldShowLiveChat` 对右侧展示的直接控制，或将其降级为 `ChatTabsView` 内部判断。
2. 用 `ChatTabsView` 替换当前 `ChatView / SessionPreview / WelcomePanel` 三段条件渲染。
3. 保留 `WelcomePanel` 的原事件：
   - `open-workspace`
   - `open-add-agent`
4. 保留 `SessionPreview` 的 resume 行为。
5. 保留 `ChatView` 的 notify 和 open-git 行为。

### 阶段 5：删除/断开/恢复后的同步

1. 删除 session 后：
   - 移除对应 tab。
   - 若删除的是 active tab，自动激活相邻 tab。
2. 断开 session 后：
   - 不关闭 tab。
   - active tab 内容从 `ChatView` 切换为 `SessionPreview` 或断开提示。
3. 恢复 session 后：
   - 保持当前 tab 激活。
   - 调用 `sessionStore.setActiveSession(session.id)` 后展示 `ChatView`。
4. 工作区筛选或折叠不影响已打开 tabs。

### 阶段 6：样式与交互细节

1. tab header 支持横向滚动，避免 session 较多时挤压聊天区。
2. tab 关闭按钮点击需要 `stopPropagation`，避免关闭同时触发激活。
3. tab 标题过长时使用省略号。
4. 当前 active tab 高亮，connected/loading 状态用轻量状态点表达。
5. 窄屏下 tabs 区域保持可横向滚动，不改变现有聊天主区域纵向布局。

---

## 六、验收标准

### 功能验收

1. 点击左侧未连接会话：右侧打开一个新 tab，并展示 `SessionPreview`。
2. 点击左侧已连接会话：右侧打开或激活对应 tab，并展示实时 `ChatView`。
3. 多次点击同一个会话：不会重复创建 tab，只激活已有 tab。
4. 点击多个会话：右侧出现多个 tabs。
5. 点击 tab header：能切换右侧展示内容。
6. 关闭 tab：能正确切换到相邻 tab；关闭最后一个 tab 后展示欢迎页。
7. 在某个已连接 tab 中发送消息：消息进入对应 session，不串到其他 tab。
8. 切换已连接 tabs 后，`ChatView` 展示对应 session 的消息、模型、模式和 plan 状态。
9. 断开会话后 tab 不自动关闭，内容切换为预览或断开状态。
10. 删除会话后，对应 tab 被移除。

### 回归验收

1. 新建会话流程正常。
2. 恢复会话流程正常。
3. 删除会话确认流程正常。
4. 置顶会话功能正常。
5. 工作区展开、折叠、搜索正常。
6. Git 面板打开逻辑正常。
7. 权限弹窗和授权模式不受影响。
8. Traffic Monitor、Settings、Workspaces 路由不受影响。

### 构建验收

```bash
cd frontend && npm run build
```

若项目已有 lint/test 脚本，则补充执行：

```bash
cd frontend && npm run lint
cd frontend && npm run test
```

---

## 七、风险与处理

### 风险 1：ChatView 依赖全局 activeSessionId

**表现：** 如果 tab 激活时未同步 `sessionStore.setActiveSession(sessionId)`，发送消息或模型切换可能作用到错误会话。

**处理：** `activateChatTab(sessionId)` 中统一处理 active tab 与 active session 同步；所有 tab 切换入口都必须走该函数。

### 风险 2：previewSessionId 与 activeChatTabId 状态重复

**表现：** 左侧选中态、右侧 active tab、sessionStore active session 可能不一致。

**处理：** 明确职责：

- `activeChatTabId`：右侧当前 tab。
- `previewSessionId`：左侧选中/预览兼容状态。
- `sessionStore.activeSessionId`：当前实时连接会话。

左侧点击和 tab 激活时，同时同步 `activeChatTabId` 与 `previewSessionId`；仅当目标会话已连接时同步 `sessionStore.activeSessionId`。

### 风险 3：关闭 tab 是否断开会话存在产品歧义

**建议：** 本期关闭 tab 不断开 session。断开仍使用左侧会话操作按钮，避免误中断任务。

### 风险 4：未发送草稿切换 tab 丢失

**建议：** 本期可接受则不处理；如要保留草稿，作为第二阶段把草稿状态提升为 `chatDraftsBySessionId`。

### 风险 5：删除 session 后 tab 残留

**处理：** 在删除成功后调用 `removeClosedSessionTab(sessionId)`，并增加 watch 清理不存在于 `sessionStore.visibleSessions` 和 `connectedSessions` 的 tab。

---

## 八、推荐实现顺序

1. 新增 `useChatTabs.js` 并在 `App.vue` 接入。
2. 修改 `ChatSessionPanel.vue` 和 `useChatSessionActions.js`，让左侧点击能通知打开 tab。
3. 新增 `ChatTabsView.vue`，先完成基础 tab header 和内容切换。
4. 用 `ChatTabsView` 替换 `App.vue` 中当前聊天区条件渲染。
5. 补齐关闭、删除、断开、恢复后的同步逻辑。
6. 调整样式和 i18n 文案。
7. 执行构建与手工回归。

---

## 九、暂不纳入本期范围

1. tab 拖拽排序。
2. tab 持久化到本地，下次启动自动恢复。
3. 每个 tab 独立输入草稿保存。
4. tab 分屏展示。
5. 跨 workspace 的 tab 分组。
6. 关闭 tab 时自动断开 session。

这些能力可以在主流程稳定后迭代。

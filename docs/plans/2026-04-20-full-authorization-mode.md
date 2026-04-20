# ACP DESKTOP 弹窗自动确认授权模式实施计划

**目标：** 增加“弹窗自动确认授权模式”，使 ACP 会话在收到 `session/request_permission` 时仍然展示权限弹窗，但当可选项数量为 2 个或更多时，系统按弹窗最左侧选项自动确认；当只有 1 个选项时，必须等待用户手动确认。

**范围：** 本计划覆盖前端会话层、权限弹窗、设置界面、偏好持久化、国际化文案与验证方案；不修改 ACP 协议结构，不新增 Go 后端 API。

**核心原则：**

1. 不做静默授权。自动确认前必须让用户看到权限弹窗。
2. 默认行为不变。未启用该模式时，仍保持当前人工确认流程。
3. 自动确认规则必须简单、可预测：选项数大于等于 2 时选择最左侧选项；只有 1 个选项时不自动确认。
4. 自动确认逻辑应集中在权限请求/弹窗协调层，避免散落在多个 UI 组件中。
5. 配置持久化到现有 `preferences.json`，不引入新的配置文件。

---

## 现状分析

### 1. 权限请求入口

当前权限请求由前端 ACP bridge 处理：

- `frontend/src/lib/acp-bridge.js`
  - `handleRequest()` 处理 `session/request_permission`
  - `requestPermission(params)` 构造 `pendingPermissionRequest`
  - 当前实现通过 Promise 挂起，等待用户在弹窗中选择后返回结果

### 2. 权限弹窗展示链路

- `frontend/src/stores/session.js`
  - `attachPermissionWatcher(runtime)` 监听 `runtime.client.pendingPermissionRequest`
  - 将请求写入全局 `pendingPermission`
  - `resolvePermission()` / `cancelPermission()` 将选择回传给 ACP client
- `frontend/src/App.vue`
  - 当 `pendingPermission` 存在时渲染 `PermissionDialog`
- `frontend/src/components/PermissionDialog.vue`
  - 按 `request.options` 顺序渲染按钮
  - 当前按钮顺序决定了视觉上的“最左侧选项”

结论：新模式不应在 `AcpClientBridge.requestPermission()` 中直接静默 resolve，否则用户看不到弹窗。应让请求照常进入 `pendingPermission`，再由弹窗或 session store 在展示后触发自动确认。

### 3. 当前设置与持久化能力

- `frontend/src/App.vue`
  - 已通过 `preferences.json` 保存 `lastCwd`、代理设置、Telemetry、Proxy 等偏好
- `frontend/src/components/SettingsView.vue`
  - 当前仅管理 Agent 列表，没有授权策略入口
- `internal/store/store.go` + `app/app.go`
  - 已具备 `LoadStore` / `SaveStore` 能力，可继续复用

建议持久化字段：

```json
{
  "authorizationMode": "manual"
}
```

模式枚举：

- `manual`: 手动确认，当前默认行为
- `popup_auto_first`: 弹窗自动确认，显示弹窗后在选项数大于等于 2 时自动选择最左侧选项

---

## 目标行为

### 1. 手动确认模式

行为保持现状：

1. 收到 `session/request_permission`
2. 设置 `pendingPermission`
3. 展示 `PermissionDialog`
4. 用户点击某个选项或取消
5. 将用户选择回传给 ACP agent

### 2. 弹窗自动确认模式

收到权限请求后：

1. 仍然设置 `pendingPermission`
2. 仍然展示 `PermissionDialog`
3. 如果 `request.options.length >= 2`：
   - 等待弹窗至少完成一次渲染
   - 自动选择 `request.options[0].optionId`
   - 等价于用户点击最左侧按钮
   - 弹窗随后关闭
4. 如果 `request.options.length === 1`：
   - 不自动确认
   - 用户必须手动点击该选项或取消
5. 如果 `request.options` 为空或异常：
   - 不自动确认
   - 保持当前请求可见，或按现有错误处理兜底

### 3. “最左侧选项”的定义

当前 `PermissionDialog.vue` 使用：

```vue
<UEDButton
  v-for="option in request.options"
  :key="option.optionId"
>
```

因此最左侧选项就是 `request.options[0]`。

如果未来 UI 改成换行、排序或分组，必须保持自动确认逻辑与视觉顺序一致。建议不要在弹窗组件内重新排序 `request.options`。

---

## 目标设计

### 1. 授权模式工具模块

建议新增：

- `frontend/src/lib/authorization.js`

职责：

1. 定义授权模式常量
2. 标准化存储值
3. 判断某个权限请求是否应自动确认
4. 返回需要自动确认的 optionId

建议接口：

```js
export const AUTHORIZATION_MODES = {
  MANUAL: 'manual',
  POPUP_AUTO_FIRST: 'popup_auto_first',
};

export function normalizeAuthorizationMode(value) {}

export function getAutoConfirmOptionId(request, mode) {}
```

`getAutoConfirmOptionId()` 规则：

1. 只有 `mode === 'popup_auto_first'` 才可能返回 optionId
2. `request.options` 必须是数组
3. `request.options.length >= 2` 才返回 `request.options[0].optionId`
4. 其他情况返回空值

### 2. 自动确认触发位置

推荐在 `App.vue` 或 `PermissionDialog.vue` 层触发，而不是在 `AcpClientBridge.requestPermission()` 中触发。

原因：

1. 需求明确要求“使用弹窗之后自动确认”，不是静默授权
2. bridge 层无法保证 UI 已展示
3. UI 层能更直接地保证“弹窗已出现，再自动点最左侧”

推荐方案：

- `App.vue` 负责根据 `pendingPermission` 和 `authorizationMode` 计算是否需要自动确认
- 使用 `nextTick()` 确保 `PermissionDialog` 已经挂载
- 再用一个短延迟，例如 `setTimeout(..., 150)`，让用户能感知弹窗出现
- 调用现有 `handlePermissionSelect(optionId)`，复用当前人工确认路径

这样自动确认和人工点击共用同一条回传逻辑。

### 3. 避免重复自动确认

需要防止同一个权限请求被重复自动确认。

建议维护一个本地集合：

```js
const autoConfirmedPermissionKeys = ref(new Set());
```

key 可由以下字段组合：

- `sessionId`
- `toolCall.toolCallId`
- `options[0].optionId`

当 `pendingPermission` 变化时：

1. 计算 key
2. 如果已经处理过，跳过
3. 如果未处理且满足自动确认条件，加入集合并触发确认
4. 请求结束后可保留 key，避免同一请求因响应延迟重复触发

### 4. 会话 store 的职责

`frontend/src/stores/session.js` 不需要静默 resolve 权限请求，但需要持有或接收当前授权模式，方便已连接会话行为一致。

两种可选实现：

1. `App.vue` 完全持有 `authorizationMode`，并在 `pendingPermission` watcher 中自动确认
2. `session.js` 持有 `authorizationMode`，提供 `setAuthorizationMode(mode)`，`App.vue` 只负责偏好读取和设置同步

推荐第 2 种，职责更清晰：

- `App.vue` 管偏好读写和 UI 设置传递
- `session.js` 暴露 `authorizationMode`
- `App.vue` 根据 `sessionStore.authorizationMode` 做弹窗自动确认

---

## 具体改造任务

### 任务 1：新增授权模式工具模块

**目标：** 固化模式枚举和“最左侧选项”选择规则。

**涉及文件：**

- 新增 `frontend/src/lib/authorization.js`
- 可选新增 `frontend/src/lib/authorization.test.js`

**实现内容：**

1. 定义 `AUTHORIZATION_MODES.MANUAL`
2. 定义 `AUTHORIZATION_MODES.POPUP_AUTO_FIRST`
3. 实现 `normalizeAuthorizationMode(value)`
4. 实现 `getAutoConfirmOptionId(request, mode)`

**验收点：**

1. 非法模式回退到 `manual`
2. `popup_auto_first` 且选项数为 2 时返回第一个 optionId
3. `popup_auto_first` 且选项数大于 2 时仍返回第一个 optionId
4. `popup_auto_first` 且选项数为 1 时返回空值
5. `manual` 模式永远返回空值

### 任务 2：在偏好存储中接入授权模式

**目标：** 将授权模式加入现有 `preferences.json`。

**涉及文件：**

- `frontend/src/App.vue`
- `frontend/src/stores/session.js`

**实现内容：**

1. 应用启动时读取 `prefsStoreData.authorizationMode`
2. 使用 `normalizeAuthorizationMode()` 标准化
3. 同步到 `sessionStore.setAuthorizationMode(mode)`
4. 设置变化后写回 `preferences.json`

**验收点：**

1. 默认值为 `manual`
2. 切换到 `popup_auto_first` 后重启仍保持
3. 非法存储值不会导致异常，会回退到 `manual`

### 任务 3：在设置页暴露模式开关

**目标：** 给用户明确入口启用或关闭弹窗自动确认。

**涉及文件：**

- `frontend/src/components/SettingsView.vue`
- `frontend/src/lib/i18n.js`

**UI 建议：**

新增“授权模式”区块：

1. 手动确认
   - 每次权限请求都等待用户选择
2. 弹窗自动确认
   - 仍显示权限弹窗
   - 当选项数为 2 个或更多时，自动选择最左侧选项
   - 当只有 1 个选项时，仍需手动确认

**交互建议：**

切换到 `popup_auto_first` 时可以显示一次设置确认弹窗，说明风险。但这只是设置阶段确认，不是每次权限请求确认。

### 任务 4：实现弹窗后自动确认

**目标：** 权限弹窗出现后，满足条件时自动选择最左侧选项。

**涉及文件：**

- `frontend/src/App.vue`
- 可能修改 `frontend/src/components/PermissionDialog.vue`

**推荐实现：**

在 `App.vue` 中监听 `pendingPermission` 和授权模式：

```js
watch(
  [pendingPermission, () => sessionStore.authorizationMode],
  async ([request, mode]) => {
    const optionId = getAutoConfirmOptionId(request, mode);
    if (!optionId) return;

    const key = buildPermissionAutoConfirmKey(request, optionId);
    if (autoConfirmedPermissionKeys.value.has(key)) return;
    autoConfirmedPermissionKeys.value.add(key);

    await nextTick();
    window.setTimeout(() => {
      if (sessionStore.pendingPermission === request) {
        handlePermissionSelect(optionId);
      }
    }, 150);
  }
);
```

注意点：

1. 必须先 `nextTick()`，保证弹窗已挂载
2. 短延迟用于满足“使用弹窗之后自动确认”的可感知要求
3. 自动确认走 `handlePermissionSelect()`，与用户点击共用逻辑
4. 定时器触发时要确认当前 pending request 仍是同一个请求，避免误确认新请求

### 任务 5：保持单选项必须人工确认

**目标：** 当 `request.options.length === 1` 时不自动点击。

**涉及文件：**

- `frontend/src/lib/authorization.js`
- `frontend/src/App.vue`

**实现内容：**

1. 自动确认函数对单选项返回空值
2. 弹窗保持显示
3. 用户必须手动点击唯一选项或取消

**验收点：**

1. 只有一个按钮时不会自动确认
2. 用户点击后仍正常回传结果
3. 取消仍正常返回 `cancelled`

### 任务 6：补充文案与风险提示

**目标：** 让用户明确理解该模式不是静默授权，而是弹窗后自动选择。

**涉及文件：**

- `frontend/src/lib/i18n.js`

**建议文案：**

中文：

- `settings.authorizationMode`: `授权模式`
- `settings.authorizationManual`: `手动确认`
- `settings.authorizationPopupAutoFirst`: `弹窗后自动选择最左侧选项`
- `settings.authorizationPopupAutoFirstDesc`: `权限请求仍会弹窗；当存在两个或更多选项时，系统会自动选择最左侧选项。只有一个选项时仍需手动确认。`

英文：

- `Authorization mode`
- `Manual confirmation`
- `Auto-select leftmost option after showing dialog`
- `Permission dialogs are still shown. When two or more options are available, the app automatically selects the leftmost option. Single-option requests still require manual confirmation.`

---

## 不做的事情

1. 不静默授权：不会在未展示弹窗时直接 resolve 权限请求。
2. 不按 `allow` / `reject` 语义筛选：新规则明确按最左侧选项，不再推断哪个选项更安全。
3. 不修改 Go 后端：当前权限请求链路在前端，后端无需新增接口。
4. 不影响其他确认弹窗：删除 Agent、删除会话、终止进程等 `AppConfirmDialog` 不在本模式范围内。
5. 不影响认证方式选择：`AuthMethodDialog` 仍保持用户手动选择。

---

## 风险与缓解

### 1. 最左侧选项可能不是允许项

风险：不同 agent 可能把拒绝选项放在最左侧。

缓解：

1. 这是用户明确指定的规则，按视觉顺序执行
2. 设置文案必须明确“自动选择最左侧选项”，而不是“自动允许”
3. 后续如需更安全策略，可新增独立模式，不改变此模式语义

### 2. 弹窗闪现时间过短

风险：用户看不到弹窗，体验接近静默授权。

缓解：

1. 使用 `nextTick()` 后再延迟确认
2. 延迟建议 150-300ms，可根据体验调整
3. 如果需要更明显，可在弹窗上显示“即将自动选择最左侧选项”提示

### 3. 重复触发自动确认

风险：watcher 多次触发导致重复 resolve。

缓解：

1. 为每个权限请求生成稳定 key
2. 已自动处理过的 key 不再处理
3. 定时器执行前再次检查 pending request 是否仍然匹配

### 4. 请求切换时误确认

风险：第一个请求的定时器晚于第二个请求触发，误点第二个请求。

缓解：

1. 定时器闭包保存原始 request 和 key
2. 执行前确认当前 pending request 的 key 仍一致
3. 不一致则放弃自动确认

---

## 测试计划

### 单元测试

1. `authorization.js`
   - `manual` 模式不返回自动确认 option
   - `popup_auto_first` + 0 个选项不返回 option
   - `popup_auto_first` + 1 个选项不返回 option
   - `popup_auto_first` + 2 个选项返回第 1 个 optionId
   - `popup_auto_first` + 3 个选项返回第 1 个 optionId
   - 非法模式回退到 `manual`

### 前端集成验证

1. 默认模式为手动确认
2. 手动模式下，权限请求弹窗出现并等待用户选择
3. 切换到弹窗自动确认模式
4. 权限请求有 2 个选项时，弹窗先出现，然后自动选择最左侧选项
5. 权限请求有 3 个或更多选项时，同样自动选择最左侧选项
6. 权限请求只有 1 个选项时，弹窗保持等待用户手动确认
7. 切回手动模式后，不再自动确认
8. 重启应用后授权模式保持上次设置

### 回归检查

1. 会话创建和恢复不受影响
2. `PermissionDialog` 的人工选择仍可用
3. `AuthMethodDialog` 不受影响
4. Agent 管理、会话删除、进程终止确认不受影响
5. `npm run build` 通过

---

## 建议实施顺序

1. 新增 `authorization.js`，实现模式与自动确认规则
2. 在 `session.js` 增加 `authorizationMode` 和 `setAuthorizationMode()`
3. 在 `App.vue` 读取/保存 `preferences.json` 中的授权模式
4. 在 `App.vue` 添加 `pendingPermission` watcher，实现弹窗后自动确认
5. 在 `SettingsView.vue` 增加授权模式设置 UI
6. 补充 `i18n.js` 中英文文案
7. 运行构建和手工验证

---

## 预期交付

完成后系统行为应为：

1. 默认仍为手动确认
2. 用户可在设置中启用“弹窗自动确认”模式
3. 启用后，权限请求仍会弹窗
4. 选项数量大于等于 2 时，系统自动选择最左侧选项
5. 只有 1 个选项时，必须用户手动确认
6. 设置持久化，并在应用重启后保持

---

## 备注

这版计划已按“不是静默授权，而是弹窗后自动确认”的规则调整。实现时应避免在 `AcpClientBridge.requestPermission()` 中直接完成自动 resolve，否则会违反弹窗展示要求。

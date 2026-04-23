# ACP Desktop 优化建议

**日期：** 2026-04-23

**目标：** 补齐工程化基础设施，提升代码质量和可维护性

**当前版本：** v0.1.10

---

## 项目现状评估

### 代码规模

| 类别 | 文件数 | 代码行数 |
|------|--------|----------|
| Go 源码（含测试） | 13 | ~2,566 |
| Vue 组件 | ~68 | ~11,592 |
| JavaScript | ~25 | ~3,799 |
| CSS | 1 | ~946 |
| **总计** | ~96 | **~18,900** |

### 主要优势

- 技术选型合理（Wails v2 + Vue 3 + Pinia）
- Go 后端模块化设计清晰
- 跨平台 CI/CD 完善
- 自建 UED 设计系统，UI 一致性好
- ACP 协议桥接层设计精巧

### 主要短板

- 测试覆盖率接近零
- 缺少自动化代码质量工具
- 个别核心文件过大
- 存在潜在安全风险

---

## 优化建议

### 高优先级

#### 1. 补充测试覆盖

**问题：** 仅 1 个测试文件（`internal/git/git_test.go`，3 个测试用例），无前端测试。

**建议：**

- Go 后端：为 `agent.Manager`、`config.Manager`、`store.Manager` 添加单元测试
- 前端：引入 Vitest 测试框架，为 stores 和 utils 添加测试

**涉及文件：**

```
internal/agent/manager_test.go
internal/config/config_test.go
internal/store/store_test.go
frontend/vitest.config.js
frontend/src/stores/__tests__/
```

**验收标准：**

- `go test ./...` 通过
- `npm run test` 通过
- 核心模块测试覆盖率达到 60%+

---

#### 2. 添加 Linting 配置

**问题：** 无 ESLint、Prettier、golangci-lint 配置，代码风格依赖人工保证。

**建议：**

- 前端：添加 ESLint + Prettier
- Go：添加 golangci-lint

**涉及文件：**

```
frontend/.eslintrc.js
frontend/.prettierrc
.golangci.yml
package.json (添加 lint scripts)
```

**验收标准：**

- `npm run lint` 通过
- `golangci-lint run` 通过
- CI 中集成 lint 检查

---

#### 3. 拆分 App.vue

**问题：** `App.vue` 658 行，职责过重，包含路由管理、偏好设置、权限处理等逻辑。

**建议：**

- 抽取路由管理逻辑到 `useRouter` composable
- 抽取偏好设置逻辑到 `usePreferences` composable
- 抽取权限处理逻辑到 `useAuthorization` composable

**涉及文件：**

```
frontend/src/composables/useRouter.js
frontend/src/composables/usePreferences.js
frontend/src/composables/useAuthorization.js
frontend/src/App.vue (精简)
```

**验收标准：**

- `App.vue` 降至 300 行以下
- 功能行为无变化
- `npm run build` 通过

---

#### 4. 修复 WriteTextFile 安全风险

**问题：** `WriteTextFile` 方法无路径白名单限制，可能存在任意文件写入风险。

**建议：**

- 添加路径白名单机制
- 限制只能写入用户配置目录和工作区目录
- 阻止路径遍历攻击（`../`）

**涉及文件：**

```
app/app.go
internal/store/store.go
```

**验收标准：**

- 尝试写入白名单外路径返回错误
- 路径遍历攻击被阻止
- 正常写入功能不受影响

---

### 中优先级

#### 5. 移除未使用的 vue-router

**问题：** `package.json` 依赖 `vue-router@^5.0.1`，但实际路由通过 `window.location.hash` 手动管理。

**建议：**

- 移除 `vue-router` 依赖
- 或正式迁移到 vue-router

**涉及文件：**

```
frontend/package.json
```

**验收标准：**

- `npm run build` 通过
- 路由功能正常

---

#### 6. Agent 名称白名单改为配置驱动

**问题：** `allowedAgentNames` 硬编码在代码中，扩展性差。

**建议：**

- 将白名单移到配置文件
- 支持用户自定义 Agent 名称

**涉及文件：**

```
internal/config/config.go
frontend/src/views/settings/
```

**验收标准：**

- 配置文件可定义允许的 Agent 名称
- 重启后生效

---

#### 7. 配置文件监听改为 fsnotify

**问题：** 当前配置文件通过 1 秒间隔轮询检测变更，资源消耗较大。

**建议：**

- 使用 fsnotify 文件系统监听
- 减少不必要的轮询

**涉及文件：**

```
internal/config/config.go
go.mod
```

**验收标准：**

- 配置变更实时响应
- CPU 占用降低

---

#### 8. 补充代码文档

**问题：** Go 函数和类型缺少 godoc 注释，前端组件缺少 JSDoc。

**建议：**

- 为导出函数和类型添加文档注释
- 为 Vue 组件添加 props 说明

**涉及文件：**

```
internal/agent/manager.go
internal/config/config.go
internal/store/store.go
frontend/src/stores/session.js
```

**验收标准：**

- `go doc` 可查看函数说明
- IDE 提示完整

---

### 低优先级

#### 9. 统一使用 any 代替 interface{}

**问题：** Go 端多处使用 `interface{}` 而非 `any`（Go 1.18+ 推荐）。

**建议：**

- 全局替换 `interface{}` 为 `any`

**涉及文件：**

```
app/app.go
internal/**/*.go
```

**验收标准：**

- `go build` 通过
- 无 `interface{}` 残留

---

#### 10. 添加 .editorconfig

**问题：** 不同开发者编辑器配置不一致。

**建议：**

- 添加 `.editorconfig` 统一缩进和换行

**涉及文件：**

```
.editorconfig
```

**验收标准：**

- 文件格式统一

---

## 实施建议

### 第一阶段（1-2 天）

| 任务 | 预计时间 | 产出 |
|------|----------|------|
| 添加 ESLint + Prettier 配置 | 2h | `.eslintrc.js`、`.prettierrc` |
| 添加 golangci-lint 配置 | 1h | `.golangci.yml` |
| 修复 WriteTextFile 安全风险 | 2h | 路径白名单机制 |
| 移除未使用的 vue-router | 0.5h | `package.json` 更新 |

### 第二阶段（3-5 天）

| 任务 | 预计时间 | 产出 |
|------|----------|------|
| 拆分 App.vue | 4h | 3 个 composable |
| 补充 Go 单元测试 | 6h | 3 个 `_test.go` 文件 |
| 引入 Vitest 并添加前端测试 | 4h | 测试框架和基础测试 |

### 第三阶段（1 周+）

| 任务 | 预计时间 | 产出 |
|------|----------|------|
| 配置文件监听改为 fsnotify | 3h | 实时配置更新 |
| 补充代码文档 | 4h | godoc/JSDoc |
| 统一使用 any | 1h | 代码现代化 |

---

## 验证命令

```bash
# Go 测试
go test ./...

# Go lint
golangci-lint run

# 前端 lint
cd frontend && npm run lint

# 前端测试
cd frontend && npm run test

# 前端构建
cd frontend && npm run build

# Wails 构建
wails build
```

---

## 风险与注意事项

### 1. Linting 规则可能过于严格

初次引入 lint 工具可能产生大量警告。

**处理方式：** 先配置宽松规则，逐步收紧；使用 `--fix` 自动修复简单问题。

### 2. 测试补充需要时间

当前测试覆盖接近零，补充测试需要较大工作量。

**处理方式：** 优先覆盖核心模块（agent、config、store），非核心模块后续补充。

### 3. 拆分 App.vue 可能引入 bug

大规模重构可能影响现有功能。

**处理方式：** 拆分后进行完整手工回归测试；保持 git 提交粒度小，便于回滚。

### 4. 安全修复可能影响正常功能

路径白名单可能误拦截合法写入。

**处理方式：** 白名单范围先宽松，根据实际使用情况收紧；添加日志记录被拦截的请求。

---

## 次日候选任务

1. 为 Traffic Monitor 添加请求耗时统计
2. 会话 metadata 增加摘要和标签功能
3. 工作区 Git 提交历史查看
4. 国际化完善（补充遗漏的翻译项）
5. 添加单元测试覆盖率报告

---

## 总结

当前项目功能基本完整，但工程化基础设施需要补齐。建议优先处理：

1. **安全风险**：修复 `WriteTextFile` 路径限制
2. **代码质量**：添加 Linting 配置
3. **可维护性**：拆分过大的文件
4. **可靠性**：补充测试覆盖

这些改进不会改变功能行为，但能显著提升项目的长期可维护性和团队协作效率。

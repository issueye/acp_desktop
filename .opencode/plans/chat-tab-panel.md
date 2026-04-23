# Chat Tab Panel 实现计划

## 概述

在聊天界面的右边添加 tabs 功能，当点击会话时生成一个 tab 页，会话的 git 也生成对应的 tab 页，不使用弹窗的方式。

## 需要修改的文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `frontend/src/stores/tab.js` | 新建 | Tab 状态管理 |
| `frontend/src/views/chat/ChatTabPanel.vue` | 新建 | Tab 面板组件 |
| `frontend/src/App.vue` | 修改 | 添加 ChatTabPanel 到布局 |
| `frontend/src/views/chat/ChatSessionPanel.vue` | 修改 | 点击会话时触发打开 tab |
| `frontend/src/views/chat/ChatHeader.vue` | 修改 | Git 按钮触发打开 git tab |

---

## 1. 创建 Tab Store

**文件**: `frontend/src/stores/tab.js`

```javascript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useTabStore = defineStore('tab', () => {
  const openTabs = ref([]);
  const activeTabId = ref('');
  const panelWidth = ref(300);
  const isPanelVisible = ref(false);

  const activeTab = computed(() =>
    openTabs.value.find((tab) => tab.id === activeTabId.value) ?? null
  );

  const hasOpenTabs = computed(() => openTabs.value.length > 0);

  function openTab(tab) {
    const existingIndex = openTabs.value.findIndex((t) => t.id === tab.id);
    if (existingIndex >= 0) {
      activeTabId.value = tab.id;
      return;
    }
    openTabs.value = [...openTabs.value, tab];
    activeTabId.value = tab.id;
    isPanelVisible.value = true;
  }

  function openSessionTab(sessionId, sessionTitle, cwd) {
    const tab = {
      id: `session-${sessionId}`,
      type: 'session',
      sessionId,
      title: sessionTitle || 'Session',
      cwd,
    };
    openTab(tab);
  }

  function openGitTab(cwd) {
    if (!cwd) return;
    const tabId = `git-${cwd}`;
    const tab = {
      id: tabId,
      type: 'git',
      cwd,
      title: 'Git',
    };
    openTab(tab);
  }

  function closeTab(tabId) {
    const index = openTabs.value.findIndex((t) => t.id === tabId);
    if (index < 0) return;

    const newTabs = openTabs.value.filter((t) => t.id !== tabId);
    openTabs.value = newTabs;

    if (activeTabId.value === tabId) {
      if (newTabs.length > 0) {
        const nextIndex = Math.min(index, newTabs.length - 1);
        activeTabId.value = newTabs[nextIndex].id;
      } else {
        activeTabId.value = '';
        isPanelVisible.value = false;
      }
    }
  }

  function setActiveTab(tabId) {
    const exists = openTabs.value.some((t) => t.id === tabId);
    if (exists) {
      activeTabId.value = tabId;
    }
  }

  function setPanelWidth(width) {
    panelWidth.value = Math.max(240, Math.min(400, width));
  }

  function togglePanel() {
    isPanelVisible.value = !isPanelVisible.value;
  }

  function closeAllTabs() {
    openTabs.value = [];
    activeTabId.value = '';
    isPanelVisible.value = false;
  }

  return {
    openTabs,
    activeTabId,
    panelWidth,
    isPanelVisible,
    activeTab,
    hasOpenTabs,
    openTab,
    openSessionTab,
    openGitTab,
    closeTab,
    setActiveTab,
    setPanelWidth,
    togglePanel,
    closeAllTabs,
  };
});
```

---

## 2. 创建 ChatTabPanel 组件

**文件**: `frontend/src/views/chat/ChatTabPanel.vue`

```vue
<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useTabStore } from '../../stores/tab';
import { useSessionStore } from '../../stores/session';
import { useI18n } from '../../lib/i18n';
import SvgIcon from '../../components/common/SvgIcon.vue';
import SessionPreview from './SessionPreview.vue';
import GitCommitPanel from './GitCommitPanel.vue';

const emit = defineEmits(['notify', 'open-git']);

const tabStore = useTabStore();
const sessionStore = useSessionStore();
const { t } = useI18n();

const isResizing = ref(false);
const resizeStartX = ref(0);
const resizeStartWidth = ref(0);

const openTabs = computed(() => tabStore.openTabs);
const activeTab = computed(() => tabStore.activeTab);
const panelWidth = computed(() => tabStore.panelWidth);
const isPanelVisible = computed(() => tabStore.isPanelVisible);

const sessionForTab = computed(() => {
  if (!activeTab.value || activeTab.value.type !== 'session') return null;
  return sessionStore.visibleSessions.find((s) => s.id === activeTab.value.sessionId) ?? null;
});

function handleTabClick(tabId) {
  tabStore.setActiveTab(tabId);
}

function handleCloseTab(event, tabId) {
  event.stopPropagation();
  tabStore.closeTab(tabId);
}

function handleSessionResume(session) {
  sessionStore.resumeSession(session);
}

function handleGitNotify(event) {
  emit('notify', event);
}

function handleGitCommitted(result) {
  const currentSession = sessionStore.currentSession;
  if (currentSession?.id && activeTab.value?.type === 'session') {
    sessionStore.recordSessionGitCommit(currentSession.id, result);
  }
}

function handleResizeStart(event) {
  event.preventDefault();
  isResizing.value = true;
  resizeStartX.value = event.clientX;
  resizeStartWidth.value = panelWidth.value;
  document.addEventListener('mousemove', handleResizeMove);
  document.addEventListener('mouseup', handleResizeEnd);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
}

function handleResizeMove(event) {
  if (!isResizing.value) return;
  const diff = resizeStartX.value - event.clientX;
  const newWidth = resizeStartWidth.value + diff;
  tabStore.setPanelWidth(newWidth);
}

function handleResizeEnd() {
  isResizing.value = false;
  document.removeEventListener('mousemove', handleResizeMove);
  document.removeEventListener('mouseup', handleResizeEnd);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
}

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', handleResizeMove);
  document.removeEventListener('mouseup', handleResizeEnd);
});
</script>

<template>
  <div
    v-if="isPanelVisible && hasOpenTabs"
    class="tab-panel"
    :style="{ width: `${panelWidth}px`, minWidth: `${panelWidth}px` }"
  >
    <div class="tab-panel__resize-handle" @mousedown="handleResizeStart" />

    <div class="tab-panel__header">
      <div class="tab-panel__tabs">
        <button
          v-for="tab in openTabs"
          :key="tab.id"
          class="tab-panel__tab"
          :class="{ 'is-active': tab.id === activeTab?.id }"
          @click="handleTabClick(tab.id)"
        >
          <SvgIcon :name="tab.type === 'git' ? 'git-commit' : 'chat-header-01'" class="tab-panel__tab-icon" />
          <span class="tab-panel__tab-title">{{ tab.title }}</span>
          <button
            class="tab-panel__tab-close"
            @click="(e) => handleCloseTab(e, tab.id)"
          >
            <SvgIcon name="close" />
          </button>
        </button>
      </div>
    </div>

    <div class="tab-panel__content">
      <template v-if="activeTab">
        <SessionPreview
          v-if="activeTab.type === 'session' && sessionForTab"
          :session="sessionForTab"
          :show-connect-button="true"
          @resume="handleSessionResume"
        />
        <GitCommitPanel
          v-else-if="activeTab.type === 'git'"
          :cwd="activeTab.cwd"
          @notify="handleGitNotify"
          @committed="handleGitCommitted"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.tab-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--ued-bg-panel);
  border-left: 1px solid var(--ued-border-default);
  overflow: hidden;
}

.tab-panel__resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  cursor: col-resize;
  z-index: 10;
  background: transparent;
  transition: background-color 0.15s ease;
}

.tab-panel__resize-handle:hover {
  background: var(--ued-accent);
}

.tab-panel__header {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--ued-border-default);
  background: color-mix(in srgb, var(--ued-bg-panel) 94%, white);
  overflow-x: auto;
  scrollbar-width: none;
}

.tab-panel__header::-webkit-scrollbar {
  display: none;
}

.tab-panel__tabs {
  display: flex;
  min-width: 0;
}

.tab-panel__tab {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.65rem;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--ued-text-secondary);
  font-size: 0.76rem;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-panel__tab:hover {
  color: var(--ued-text-primary);
  background: color-mix(in srgb, var(--ued-accent) 5%, transparent);
}

.tab-panel__tab.is-active {
  color: var(--ued-accent);
  border-bottom-color: var(--ued-accent);
  background: color-mix(in srgb, var(--ued-accent) 8%, transparent);
}

.tab-panel__tab-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.tab-panel__tab-title {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-panel__tab-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--ued-text-muted);
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s ease;
}

.tab-panel__tab:hover .tab-panel__tab-close {
  opacity: 1;
}

.tab-panel__tab-close:hover {
  background: color-mix(in srgb, var(--ued-danger) 15%, transparent);
  color: var(--ued-danger);
}

.tab-panel__tab-close .svg-icon {
  width: 12px;
  height: 12px;
}

.tab-panel__content {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
</style>
```

---

## 3. 修改 App.vue

**文件**: `frontend/src/App.vue`

### 3.1 添加导入

在 import 部分添加:
```javascript
import { useTabStore } from './stores/tab';
import ChatTabPanel from './views/chat/ChatTabPanel.vue';
```

### 3.2 添加 store 实例

在 setup 部分添加:
```javascript
const tabStore = useTabStore();
```

### 3.3 添加事件处理函数

```javascript
function handleOpenSessionTab(sessionId, sessionTitle, cwd) {
  tabStore.openSessionTab(sessionId, sessionTitle, cwd);
}

function handleOpenGitTab(cwd) {
  tabStore.openGitTab(cwd);
}
```

### 3.4 修改模板布局

在 `<main class="main-content">` 后面添加 ChatTabPanel:

```vue
<main class="main-content">
  <!-- 现有内容保持不变 -->
</main>

<ChatTabPanel
  v-if="activeRoute === 'chat'"
  @notify="pushToast($event.message, $event.tone)"
  @open-git="handleOpenGitDialog"
/>
```

### 3.5 修改 CSS 布局

修改 `.content-stage` 的样式，使其适应新的布局:

```css
.content-stage {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: row;
  gap: 0;
  background: var(--ued-bg-panel);
}
```

---

## 4. 修改 ChatSessionPanel.vue

**文件**: `frontend/src/views/chat/ChatSessionPanel.vue`

### 4.1 添加 tab store 导入

```javascript
import { useTabStore } from '../../stores/tab';
```

### 4.2 添加 store 实例

```javascript
const tabStore = useTabStore();
```

### 4.3 修改会话点击处理

找到处理会话点击的函数，添加打开 tab 的逻辑:

```javascript
function handleSessionClick(session) {
  // 现有的逻辑...
  
  // 添加: 打开 session tab
  tabStore.openSessionTab(session.id, session.title, session.cwd);
}
```

---

## 5. 修改 ChatHeader.vue

**文件**: `frontend/src/views/chat/ChatHeader.vue`

### 5.1 添加 tab store 导入

```javascript
import { useTabStore } from '../../stores/tab';
```

### 5.2 添加 store 实例

```javascript
const tabStore = useTabStore();
```

### 5.3 修改 Git 按钮点击事件

将 Git 按钮的点击事件从 `$emit('open-git')` 改为:

```vue
<button
  class="chat-header-action ued-icon-btn"
  :title="t('git.open')"
  :aria-label="t('git.open')"
  :disabled="!currentSession?.cwd"
  @click="handleOpenGit"
>
  <SvgIcon name="git-commit" />
</button>
```

添加处理函数:

```javascript
function handleOpenGit() {
  if (currentSession?.cwd) {
    tabStore.openGitTab(currentSession.cwd);
  }
}
```

---

## 布局说明

修改后的布局结构:

```
┌─────────────────────────────────────────────────────────┐
│                    AppHeaderBar                          │
├────┬──────────────┬─────────────────────┬───────────────┤
│    │              │                     │               │
│ A  │ ChatSession  │    ChatView         │  ChatTabPanel │
│ p  │ Panel        │                     │  (240-400px)  │
│ p  │ (300px)      │                     │               │
│ S  │              │                     │               │
│ i  │              │                     │               │
│ d  │              │                     │               │
│ e  │              │                     │               │
│ b  │              │                     │               │
│ a  │              │                     │               │
│ r  │              │                     │               │
│    │              │                     │               │
├────┴──────────────┴─────────────────────┴───────────────┤
│                    AppFooter                             │
└─────────────────────────────────────────────────────────┘
```

## 功能特性

1. **Session Tab**: 点击会话时打开，显示会话预览（复用 SessionPreview 组件）
2. **Git Tab**: 点击 Git 按钮时打开，内嵌 GitCommitPanel 组件
3. **可调整宽度**: 拖拽左边缘调整面板宽度（240-400px）
4. **可关闭**: 每个 tab 右上角有关闭按钮
5. **自动隐藏**: 当所有 tab 关闭时，面板自动隐藏

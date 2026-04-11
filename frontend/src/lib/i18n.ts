import { computed, ref } from 'vue';

type Locale = 'en' | 'zh-CN';
type Dict = Record<string, string>;

const STORAGE_KEY = 'acp-ui-locale';

const messages: Record<Locale, Dict> = {
  en: {
    'app.desktopClient': 'Desktop Client',
    'app.settings': 'Settings',
    'app.close': 'Close',
    'app.minimise': 'Minimise',
    'app.expandSidebar': 'Expand sidebar',
    'app.collapseSidebar': 'Collapse sidebar',
    'app.trafficMonitor': 'ACP Traffic Monitor',
    'app.workspace': 'Workspace',
    'app.workspaceSummary': 'Workspace Summary',
    'app.workingDirectory': 'Working Directory',
    'app.currentDirectory': 'Current directory',
    'app.selectFolder': 'Select folder',
    'app.selectingFolder': 'Selecting...',
    'app.connecting': 'Connecting...',
    'app.newSession': 'New Session',
    'app.openWorkspace': 'Session Workspace',
    'app.sessionLauncher': 'Quick Launch',
    'app.sessionSetupTitle': 'Create a new session',
    'app.sessionSetupDesc': 'Pick an agent, confirm the workspace, and connect with the right environment.',
    'app.noAgentTitle': 'No agent configured yet',
    'app.noAgentDesc': 'Add an agent first, then come back here to launch a workspace session.',
    'app.disconnect': 'Disconnect',
    'app.statusIdle': 'Idle',
    'app.statusConnecting': 'Connecting',
    'app.statusConnected': 'Connected',
    'app.proxy': 'Network Proxy',
    'app.proxyEnable': 'Enable',
    'app.proxyDisabled': 'Disabled',
    'app.proxyHttp': 'HTTP Proxy',
    'app.proxyHttps': 'HTTPS Proxy',
    'app.proxyAll': 'ALL Proxy',
    'app.proxyNo': 'No Proxy',
    'app.proxySampleHost': 'e.g. http://127.0.0.1:7890',
    'app.proxySampleNo': 'e.g. localhost,127.0.0.1',
    'app.validationAgentRequired': 'Choose an agent before creating the session.',
    'app.validationProxyRequired': 'Enable proxy only after filling at least one proxy address.',
    'app.validationProxyHttpInvalid': 'HTTP proxy format is invalid.',
    'app.validationProxyHttpsInvalid': 'HTTPS proxy format is invalid.',
    'app.validationProxyAllInvalid': 'ALL proxy format is invalid.',
    'app.validationProxyIssueTitle': 'Check proxy settings',
    'app.validationActionRequired': 'Complete the required fields',
    'app.validationReady': 'Ready to create the session.',
    'app.validationWorkspaceHint': 'If no folder is selected, the current workspace will be used.',
    'app.savedSessions': 'Saved Sessions',
    'app.searchSessions': 'Search sessions...',
    'app.welcomeEyebrow': 'Desktop Workspace',
    'app.welcomeTitle': 'Welcome to ACP UI',
    'app.welcomeDesc': 'Select an agent and create a new session to get started.',
    'app.configureAgentsHint': 'Configure agents in your config file to begin.',
    'app.language': 'Language',
    'app.langLabelEn': 'EN',
    'app.langLabelZh': '中文',

    'agent.label': 'Agent',
    'agent.select': 'Select an agent...',
    'agent.noneConfigured': 'No agents configured',
    'agent.noneFound': 'No agents found. Add agents to:',

    'session.noMatching': 'No matching sessions.',
    'session.tryAnotherKeyword': 'Try another keyword.',
    'session.noneSaved': 'No saved sessions yet.',
    'session.createHint': 'Create a new session to get started.',
    'session.delete': 'Delete session',
    'session.connect': 'Connect',
    'session.connecting': 'Connecting...',
    'session.disconnect': 'Disconnect',
    'session.disconnecting': 'Disconnecting...',
    'session.deleting': 'Deleting...',
    'session.switchTo': 'Switch',
    'session.activeNow': 'Live',
    'session.live': 'Connected',
    'session.proxy': 'Proxy',
    'session.pin': 'Pin session',
    'session.unpin': 'Unpin session',
    'session.pinned': 'PIN',
    'session.confirmDelete': 'Delete this session?',

    'chat.titleFallback': 'Chat',
    'chat.roleYou': 'You',
    'chat.roleAssistant': 'Assistant',
    'chat.hideThinking': 'Hide Thinking',
    'chat.showThinking': 'Show Thinking',
    'chat.thinking': 'Thinking...',
    'chat.cancel': 'Cancel',
    'chat.send': 'Send',
    'chat.placeholder': 'Type your message...',
    'chat.placeholderCommands': 'Type your message... (/ for commands)',
    'chat.emptyTitle': 'Start the first prompt',
    'chat.emptyDesc': 'Ask for code changes, reviews, or explanations. The conversation will stay tied to this workspace.',
    'chat.planTitle': 'Execution Plan',
    'chat.planCompletedCount': 'completed',
    'chat.planStatusPending': 'Pending',
    'chat.planStatusInProgress': 'In Progress',
    'chat.planStatusCompleted': 'Completed',
    'chat.planPriorityHigh': 'High Priority',
    'chat.planPriorityMedium': 'Medium Priority',
    'chat.planPriorityLow': 'Low Priority',
    'chat.currentPlan': 'Current Plan',
    'chat.planItems': 'items',
    'chat.planToggleShow': 'Show',
    'chat.planToggleHide': 'Hide',

    'permission.required': 'Permission Required',
    'common.cancel': 'Cancel',

    'auth.required': 'Authentication Required',
    'auth.description': '{agent} requires authentication to continue.',
    'auth.selectMethod': 'Select an authentication method:',

    'startup.connectingTo': 'Connecting to {agent}...',
    'startup.phase.starting': 'Starting process...',
    'startup.phase.downloading': 'Downloading packages...',
    'startup.phase.installing': 'Installing dependencies...',
    'startup.phase.building': 'Building...',
    'startup.phase.initializing': 'Initializing agent...',
    'startup.phase.connecting': 'Connecting to agent...',
    'startup.phase.waiting': 'Please wait...',
    'startup.firstRunHint': 'First run may take longer while dependencies are installed.',
    'startup.hideDetails': 'Hide Details ▲',
    'startup.showDetails': 'Show Details ▼',
    'startup.output': 'Output',
    'startup.waitingOutput': 'Waiting for output...',

    'settings.title': 'Settings',
    'settings.agents': 'Agents',
    'settings.addAgent': '+ Add Agent',
    'settings.editAgent': 'Edit Agent',
    'settings.addNewAgent': 'Add New Agent',
    'settings.name': 'Name',
    'settings.command': 'Command',
    'settings.arguments': 'Arguments',
    'settings.argsHint': 'Space-separated. Use quotes for args with spaces.',
    'settings.nameRequired': 'Name is required',
    'settings.commandRequired': 'Command is required',
    'settings.nameNumeric': 'Agent name cannot be purely numeric',
    'settings.duplicate': 'An agent with this name already exists',
    'settings.save': 'Save',
    'settings.saving': 'Saving...',
    'settings.edit': 'Edit',
    'settings.delete': 'Delete',
    'settings.noAgents': 'No agents configured. Add one to get started!',
    'settings.configFile': 'Config File',
    'settings.configReloadHint': 'Changes to this file are automatically reloaded.',
    'settings.confirmDeleteAgent': 'Delete agent "{name}"?',
    'settings.placeholder.agentName': 'My Agent',

    'env.title': 'Environment Variables',
    'env.add': '+ Add',
    'env.value': 'value',
    'env.remove': 'Remove',
    'env.empty': 'No environment variables configured.',
  },
  'zh-CN': {
    'app.desktopClient': '桌面客户端',
    'app.settings': '设置',
    'app.close': '关闭',
    'app.minimise': '最小化',
    'app.expandSidebar': '展开侧边栏',
    'app.collapseSidebar': '收起侧边栏',
    'app.trafficMonitor': 'ACP 流量监控',
    'app.workspace': '工作区',
    'app.workspaceSummary': '工作区摘要',
    'app.workingDirectory': '工作目录',
    'app.currentDirectory': '当前目录',
    'app.selectFolder': '选择文件夹',
    'app.selectingFolder': '选择中...',
    'app.connecting': '连接中...',
    'app.newSession': '新建会话',
    'app.openWorkspace': '会话工作区',
    'app.sessionLauncher': '快速启动',
    'app.sessionSetupTitle': '创建新会话',
    'app.sessionSetupDesc': '选择 Agent，确认工作目录与代理配置，然后开始连接。',
    'app.noAgentTitle': '还没有可用 Agent',
    'app.noAgentDesc': '请先添加 Agent，随后再回到这里启动工作区会话。',
    'app.disconnect': '断开连接',
    'app.statusIdle': '空闲',
    'app.statusConnecting': '连接中',
    'app.statusConnected': '已连接',
    'app.proxy': '网络代理',
    'app.proxyEnable': '启用',
    'app.proxyDisabled': '未启用',
    'app.proxyHttp': 'HTTP 代理',
    'app.proxyHttps': 'HTTPS 代理',
    'app.proxyAll': 'ALL 代理',
    'app.proxyNo': '不走代理',
    'app.proxySampleHost': '例如 http://127.0.0.1:7890',
    'app.proxySampleNo': '例如 localhost,127.0.0.1',
    'app.validationAgentRequired': '请先选择一个 Agent 再创建会话。',
    'app.validationProxyRequired': '启用代理后，至少填写一个代理地址。',
    'app.validationProxyHttpInvalid': 'HTTP 代理格式不正确。',
    'app.validationProxyHttpsInvalid': 'HTTPS 代理格式不正确。',
    'app.validationProxyAllInvalid': 'ALL 代理格式不正确。',
    'app.validationProxyIssueTitle': '请检查代理配置',
    'app.validationActionRequired': '请先完成必要配置',
    'app.validationReady': '当前配置可直接创建会话。',
    'app.validationWorkspaceHint': '如果不选择目录，将使用当前工作区。',
    'app.savedSessions': '已保存会话',
    'app.searchSessions': '搜索会话...',
    'app.welcomeEyebrow': '桌面工作区',
    'app.welcomeTitle': '欢迎使用 ACP UI',
    'app.welcomeDesc': '请选择一个 Agent 并创建新会话开始使用。',
    'app.configureAgentsHint': '请先在配置文件中配置 Agent。',
    'app.language': '语言',
    'app.langLabelEn': 'EN',
    'app.langLabelZh': '中文',

    'agent.label': 'Agent',
    'agent.select': '请选择一个 Agent...',
    'agent.noneConfigured': '未配置 Agent',
    'agent.noneFound': '未发现 Agent，请添加到：',

    'session.noMatching': '没有匹配的会话。',
    'session.tryAnotherKeyword': '请尝试其他关键词。',
    'session.noneSaved': '暂无已保存会话。',
    'session.createHint': '创建新会话后会显示在这里。',
    'session.delete': '删除会话',
    'session.connect': '连接',
    'session.connecting': '连接中...',
    'session.disconnect': '断开',
    'session.disconnecting': '断开中...',
    'session.deleting': '删除中...',
    'session.switchTo': '切换',
    'session.activeNow': '当前会话',
    'session.live': '在线',
    'session.proxy': '代理',
    'session.pin': '置顶会话',
    'session.unpin': '取消置顶',
    'session.pinned': '置顶',
    'session.confirmDelete': '确认删除该会话？',

    'chat.titleFallback': '聊天',
    'chat.roleYou': '你',
    'chat.roleAssistant': '助手',
    'chat.hideThinking': '隐藏思考',
    'chat.showThinking': '显示思考',
    'chat.thinking': '思考中...',
    'chat.cancel': '取消',
    'chat.send': '发送',
    'chat.placeholder': '输入你的消息...',
    'chat.placeholderCommands': '输入你的消息...（/ 可查看命令）',
    'chat.emptyTitle': '开始第一条指令',
    'chat.emptyDesc': '可以直接提代码修改、审查或解释需求，这段会话会一直绑定当前工作区。',
    'chat.planTitle': '执行计划',
    'chat.planCompletedCount': '项已完成',
    'chat.planStatusPending': '待处理',
    'chat.planStatusInProgress': '进行中',
    'chat.planStatusCompleted': '已完成',
    'chat.planPriorityHigh': '高优先级',
    'chat.planPriorityMedium': '中优先级',
    'chat.planPriorityLow': '低优先级',
    'chat.currentPlan': '当前计划',
    'chat.planItems': '项',
    'chat.planToggleShow': '展开',
    'chat.planToggleHide': '收起',

    'permission.required': '需要权限确认',
    'common.cancel': '取消',

    'auth.required': '需要认证',
    'auth.description': '{agent} 需要认证后才能继续。',
    'auth.selectMethod': '请选择认证方式：',

    'startup.connectingTo': '正在连接 {agent}...',
    'startup.phase.starting': '正在启动进程...',
    'startup.phase.downloading': '正在下载包...',
    'startup.phase.installing': '正在安装依赖...',
    'startup.phase.building': '正在构建...',
    'startup.phase.initializing': '正在初始化 Agent...',
    'startup.phase.connecting': '正在连接 Agent...',
    'startup.phase.waiting': '请稍候...',
    'startup.firstRunHint': '首次运行可能较慢，需要安装依赖。',
    'startup.hideDetails': '隐藏详情 ▲',
    'startup.showDetails': '查看详情 ▼',
    'startup.output': '输出',
    'startup.waitingOutput': '等待输出中...',

    'settings.title': '设置',
    'settings.agents': 'Agent 列表',
    'settings.addAgent': '+ 添加 Agent',
    'settings.editAgent': '编辑 Agent',
    'settings.addNewAgent': '新增 Agent',
    'settings.name': '名称',
    'settings.command': '命令',
    'settings.arguments': '参数',
    'settings.argsHint': '参数以空格分隔，带空格的参数请用引号。',
    'settings.nameRequired': '名称不能为空',
    'settings.commandRequired': '命令不能为空',
    'settings.nameNumeric': 'Agent 名称不能是纯数字',
    'settings.duplicate': '已存在同名 Agent',
    'settings.save': '保存',
    'settings.saving': '保存中...',
    'settings.edit': '编辑',
    'settings.delete': '删除',
    'settings.noAgents': '暂无 Agent，请先添加。',
    'settings.configFile': '配置文件',
    'settings.configReloadHint': '修改此文件后将自动热更新。',
    'settings.confirmDeleteAgent': '确认删除 Agent “{name}”？',
    'settings.placeholder.agentName': '我的 Agent',

    'env.title': '环境变量',
    'env.add': '+ 添加',
    'env.value': '值',
    'env.remove': '移除',
    'env.empty': '当前未配置环境变量。',
  },
};

function detectInitialLocale(): Locale {
  if (typeof window === 'undefined') {
    return 'en';
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'zh-CN') {
    return stored;
  }
  const lang = window.navigator.language.toLowerCase();
  if (lang.startsWith('zh')) {
    return 'zh-CN';
  }
  return 'en';
}

const localeRef = ref<Locale>(detectInitialLocale());

function persistLocale(locale: Locale) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, locale);
  }
}

export function setLocale(locale: Locale) {
  localeRef.value = locale;
  persistLocale(locale);
}

export function toggleLocale() {
  setLocale(localeRef.value === 'en' ? 'zh-CN' : 'en');
}

function template(input: string, params?: Record<string, string | number>) {
  if (!params) {
    return input;
  }
  return input.replace(/\{(\w+)\}/g, (_, key: string) =>
    params[key] === undefined ? `{${key}}` : String(params[key])
  );
}

export function translate(key: string, params?: Record<string, string | number>) {
  const dict = messages[localeRef.value];
  const fallback = messages.en;
  const raw = dict[key] ?? fallback[key] ?? key;
  return template(raw, params);
}

export function useI18n() {
  const locale = computed(() => localeRef.value);
  return {
    locale,
    t: translate,
    setLocale,
    toggleLocale,
  };
}

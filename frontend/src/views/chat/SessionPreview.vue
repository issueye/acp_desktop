<script setup>
import { computed, ref, watch } from 'vue';
import { listDirectory, readTextFile } from '../../lib/wails';
import { useI18n } from '../../lib/i18n';
import ChatMessages from './ChatMessages.vue';
import UEDButton from '../../components/common/UEDButton.vue';

const props = defineProps({
  session: { type: Object, default: null },
  showConnectButton: { type: Boolean, default: true },
});

const emit = defineEmits(['resume']);

const { t } = useI18n();
const externalMessages = ref([]);
const isLoading = ref(false);
const error = ref('');

const messages = computed(() => {
  if (!props.session) {
    return [];
  }
  if (!props.session.external) {
    return Array.isArray(props.session.messages) ? props.session.messages : [];
  }
  return externalMessages.value;
});

const updatedAtLabel = computed(() => {
  const value = Number(props.session?.lastUpdated ?? 0);
  return value > 0 ? new Date(value).toLocaleString() : '';
});

const summaryText = computed(() => {
  const summary = props.session?.summary;
  if (typeof summary === 'string' && summary.trim()) {
    return summary.trim();
  }
  const firstUserMessage = messages.value.find((message) => message.role === 'user');
  if (firstUserMessage?.content) {
    return firstUserMessage.content;
  }
  return '';
});

const tagItems = computed(() => (
  Array.isArray(props.session?.tags) ? props.session.tags.filter(Boolean) : []
));

const gitSummary = computed(() => {
  const git = props.session?.git;
  if (!git?.lastCommitHash) {
    return '';
  }
  const shortHash = String(git.lastCommitHash).slice(0, 8);
  return git.lastCommitSubject ? `${shortHash} ${git.lastCommitSubject}` : shortHash;
});

watch(
  () => props.session?.id,
  async () => {
    externalMessages.value = [];
    error.value = '';
    if (!props.session?.external) {
      return;
    }
    await loadExternalSession();
  },
  { immediate: true }
);

async function loadExternalSession() {
  const path = props.session?.path;
  if (!path) {
    return;
  }

  isLoading.value = true;
  try {
    const source = await resolveReadableTranscript(path);
    if (!source) {
      externalMessages.value = [];
      return;
    }
    const text = await readTextFile(source.path, null, null);
    externalMessages.value = parseTranscript(text, source.path);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    isLoading.value = false;
  }
}

async function resolveReadableTranscript(path) {
  try {
    await readTextFile(path, 1, 1);
    return { path };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!message.toLowerCase().includes('incorrect function') && !message.toLowerCase().includes('is a directory')) {
      throw e;
    }
  }

  const files = await collectTranscriptFiles(path, 0);
  files.sort((a, b) => Number(b.modTime || 0) - Number(a.modTime || 0));
  return files[0] ? { path: files[0].path } : null;
}

async function collectTranscriptFiles(path, depth) {
  if (depth > 4) {
    return [];
  }
  const entries = await listDirectory(path);
  const files = [];
  for (const entry of entries) {
    if (entry.isDir) {
      files.push(...await collectTranscriptFiles(entry.path, depth + 1));
      continue;
    }
    if (/\.(jsonl|json|md|txt)$/i.test(entry.name || entry.path || '')) {
      files.push(entry);
    }
  }
  return files;
}

function parseTranscript(text, sourcePath = props.session?.path || '') {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return [];
  }
  if (sourcePath.toLowerCase().endsWith('.jsonl')) {
    return parseJsonlTranscript(text);
  }
  if (sourcePath.toLowerCase().endsWith('.json')) {
    return parseJsonTranscript(text);
  }
  return [
    {
      id: `text-${props.session?.id || 'session'}`,
      role: 'assistant',
      content: text,
      timestamp: props.session?.lastUpdated || Date.now(),
      parts: [{ type: 'content', content: text }],
    },
  ];
}

function parseJsonTranscript(text) {
  try {
    const value = JSON.parse(text);
    const records = Array.isArray(value) ? value : value.messages || value.transcript || [];
    if (!Array.isArray(records)) {
      return [];
    }
    return records
      .map((record) => {
        const role = record.role === 'user' ? 'user' : 'assistant';
        const content = extractContent(record.content || record.message || record.text);
        return content ? createMessage(role, content, Date.parse(record.timestamp || '') || Date.now()) : null;
      })
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

function parseJsonlTranscript(text) {
  const messages = [];
  const lines = text.split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    let record;
    try {
      record = JSON.parse(line);
    } catch (_) {
      continue;
    }

    const message = recordToMessage(record);
    if (message) {
      messages.push(message);
    }
  }
  return messages;
}

function recordToMessage(record) {
  const timestamp = Date.parse(record?.timestamp || '') || props.session?.lastUpdated || Date.now();

  if (record?.type === 'event_msg' && record.payload?.type === 'user_message') {
    return createMessage('user', record.payload.message, timestamp);
  }

  if (record?.type !== 'response_item') {
    return null;
  }

  const payload = record.payload || {};
  if (payload.type !== 'message') {
    return null;
  }

  const role = payload.role === 'user' ? 'user' : 'assistant';
  const content = extractContent(payload.content);
  if (!content) {
    return null;
  }
  return createMessage(role, content, timestamp);
}

function extractContent(content) {
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return '';
  }
  return content
    .map((part) => {
      if (typeof part === 'string') {
        return part;
      }
      return part?.text || part?.content || '';
    })
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function createMessage(role, content, timestamp) {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp,
    parts: [{ type: 'content', content }],
  };
}
</script>

<template>
  <div class="session-preview">
    <header class="preview-header">
      <div class="preview-title">
        <h2>{{ session?.title || t('chat.titleFallback') }}</h2>
        <p>
          <span>{{ session?.agentName }}</span>
          <span v-if="session?.cwd">{{ session.cwd }}</span>
          <span v-if="updatedAtLabel">{{ updatedAtLabel }}</span>
        </p>
      </div>
      <UEDButton
        v-if="showConnectButton && session && !session.external"
        variant="secondary"
        size="sm"
        @click="emit('resume', session)"
      >
        {{ t('session.connect') }}
      </UEDButton>
    </header>

    <div v-if="error" class="preview-error">
      {{ t('session.previewLoadFailed') }}: {{ error }}
    </div>

    <ChatMessages
      class="preview-messages"
      :messages="messages"
      :is-loading="isLoading"
      :current-plan-entries="[]"
      :is-plan-collapsed="false"
    />
  </div>
</template>

<style scoped>
.session-preview {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, var(--ued-bg-panel) 0%, var(--ued-bg-window) 100%);
}

.preview-header {
  min-height: 78px;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.8rem 1.2rem;
  border-bottom: 1px solid var(--ued-border-default);
  background: color-mix(in srgb, var(--ued-bg-panel) 94%, white);
}

.preview-title {
  min-width: 0;
  flex: 1;
}

.preview-kicker {
  display: block;
  margin-bottom: 0.16rem;
  color: var(--ued-text-muted);
  font-size: 0.72rem;
}

.preview-title h2 {
  margin: 0;
  color: var(--ued-text-primary);
  font-size: 1rem;
  font-weight: 650;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preview-title p {
  display: flex;
  gap: 0.5rem;
  min-width: 0;
  margin: 0.22rem 0 0;
  color: var(--ued-text-muted);
  font-size: 0.76rem;
}

.preview-title p span {
  min-width: 0;
  max-width: 38%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preview-metadata {
  display: grid;
  gap: 0.35rem;
  margin-top: 0.45rem;
}

.preview-summary {
  max-width: 100%;
  margin: 0;
  color: var(--ued-text-secondary);
  font-size: 0.78rem;
  line-height: 1.45;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preview-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.preview-badge {
  display: inline-flex;
  align-items: center;
  max-width: 220px;
  min-height: 22px;
  padding: 0 0.45rem;
  border: 1px solid var(--ued-border-subtle);
  border-radius: 6px;
  background: var(--ued-bg-panel-muted);
  color: var(--ued-text-muted);
  font-size: 0.68rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-badge--git {
  color: var(--ued-accent);
  background: color-mix(in srgb, var(--ued-accent) 8%, white);
}

.preview-error {
  padding: 0.7rem 1rem;
  color: var(--ued-danger);
  background: var(--ued-danger-soft);
  border-bottom: 1px solid color-mix(in srgb, var(--ued-danger) 18%, var(--ued-border-default));
  font-size: 0.84rem;
}

.preview-messages {
  flex: 1;
  min-height: 0;
}
</style>

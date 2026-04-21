<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { basicSetup, EditorView } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';

const props = defineProps({
  modelValue: { type: String, default: '' },
  language: { type: String, default: 'javascript' },
  minHeight: { type: String, default: '260px' },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);

const editorHost = ref(null);
let editorView = null;
let applyingExternalValue = false;

const updateListener = EditorView.updateListener.of((update) => {
  if (!update.docChanged || applyingExternalValue) {
    return;
  }
  emit('update:modelValue', update.state.doc.toString());
});

function getExtensions() {
  const extensions = [
    basicSetup,
    updateListener,
    EditorView.lineWrapping,
    EditorView.theme({
      '&': {
        minHeight: props.minHeight,
        fontSize: '12.8px',
        borderRadius: '7px',
        border: '1px solid var(--ued-border-default)',
        background: 'var(--ued-bg-panel)',
        color: 'var(--ued-text-primary)',
      },
      '&.cm-focused': {
        outline: 'none',
        borderColor: 'var(--ued-accent)',
        boxShadow: 'var(--ued-shadow-focus)',
      },
      '.cm-scroller': {
        minHeight: props.minHeight,
        fontFamily: 'var(--ued-font-mono)',
        lineHeight: '1.55',
      },
      '.cm-content': {
        padding: '10px 0',
      },
      '.cm-line': {
        padding: '0 12px',
      },
      '.cm-gutters': {
        background: 'var(--ued-bg-panel-muted)',
        color: 'var(--ued-text-muted)',
        borderRight: '1px solid var(--ued-border-subtle)',
      },
      '.cm-activeLine': {
        background: 'color-mix(in srgb, var(--ued-accent) 7%, transparent)',
      },
      '.cm-activeLineGutter': {
        background: 'color-mix(in srgb, var(--ued-accent) 9%, transparent)',
        color: 'var(--ued-text-primary)',
      },
      '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
        background: 'color-mix(in srgb, var(--ued-accent) 24%, transparent)',
      },
    }),
    EditorState.readOnly.of(props.disabled),
    EditorView.editable.of(!props.disabled),
  ];

  if (props.language === 'javascript') {
    extensions.push(javascript());
  }

  return extensions;
}

function createEditor() {
  if (!editorHost.value || editorView) {
    return;
  }
  editorView = new EditorView({
    parent: editorHost.value,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: getExtensions(),
    }),
  });
}

function replaceDocument(value) {
  if (!editorView || editorView.state.doc.toString() === value) {
    return;
  }
  applyingExternalValue = true;
  editorView.dispatch({
    changes: {
      from: 0,
      to: editorView.state.doc.length,
      insert: value,
    },
  });
  applyingExternalValue = false;
}

nextTick(createEditor);

watch(
  () => props.modelValue,
  (value) => replaceDocument(value ?? '')
);

watch(
  () => [props.disabled, props.language, props.minHeight],
  () => {
    const currentValue = editorView?.state.doc.toString() ?? props.modelValue;
    editorView?.destroy();
    editorView = null;
    nextTick(() => {
      createEditor();
      replaceDocument(currentValue);
    });
  }
);

onBeforeUnmount(() => {
  editorView?.destroy();
  editorView = null;
});
</script>

<template>
  <div ref="editorHost" class="code-editor"></div>
</template>

<style scoped>
.code-editor {
  width: 100%;
}

.code-editor :deep(.cm-editor) {
  overflow: hidden;
}
</style>

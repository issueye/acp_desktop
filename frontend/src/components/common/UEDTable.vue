<template>
  <div class="ued-table-shell ued-panel">
    <div v-if="$slots.toolbar" class="ued-table-shell__toolbar ued-toolbar">
      <slot name="toolbar" />
    </div>

    <div class="ued-table-shell__table ued-scroll">
      <table class="ued-table">
        <thead>
          <tr>
            <th
              v-for="column in columns"
              :key="column.key || column.title"
              :class="[
                column.class || '',
                column.align === 'center' ? 'is-center' : '',
                column.align === 'right' ? 'is-right' : '',
              ]"
            >
              {{ column.title }}
            </th>
          </tr>
        </thead>

        <tbody>
          <tr v-if="loading">
            <td :colspan="columns.length" class="ued-table__state-cell">
              <div class="ued-empty">
                <div class="ued-title-2">正在加载</div>
                <div class="ued-meta">请稍候，数据正在同步。</div>
              </div>
            </td>
          </tr>

          <tr v-else-if="data.length === 0">
            <td :colspan="columns.length" class="ued-table__state-cell">
              <div class="ued-empty">
                <div class="ued-title-2">{{ emptyTitle }}</div>
                <div class="ued-meta">{{ emptyText }}</div>
                <slot name="empty" />
              </div>
            </td>
          </tr>

          <tr
            v-else
            v-for="(row, index) in data"
            :key="resolveRowKey(row, index)"
            class="ued-table__row"
            :class="{ 'is-clickable': clickable }"
            @click="handleRowClick(row, index)"
          >
            <td
              v-for="column in columns"
              :key="column.key || column.title"
              :class="[
                column.class || '',
                column.align === 'center' ? 'is-center' : '',
                column.align === 'right' ? 'is-right' : '',
              ]"
            >
              <slot
                :name="`cell-${column.key}`"
                :row="row"
                :column="column"
                :value="row[column.key]"
                :index="index"
              >
                {{ row[column.key] ?? '-' }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  columns: {
    type: Array,
    required: true,
  },
  data: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  emptyTitle: {
    type: String,
    default: '暂无数据',
  },
  emptyText: {
    type: String,
    default: '当前没有可显示的数据。',
  },
  rowKey: {
    type: String,
    default: 'id',
  },
  clickable: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['row-click'])

function resolveRowKey(row, index) {
  return row?.[props.rowKey] ?? index
}

function handleRowClick(row, index) {
  if (!props.clickable) return
  emit('row-click', row, index)
}
</script>

<style scoped>
.ued-table-shell {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.ued-table-shell__toolbar {
  border-bottom: 1px solid var(--ued-border-subtle);
  border-radius: 0;
  border-left: 0;
  border-right: 0;
  border-top: 0;
  background: var(--ued-bg-toolbar);
}

.ued-table-shell__table {
  width: 100%;
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.ued-table {
  width: 100%;
  border-collapse: collapse;
}

.ued-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  height: 38px;
  padding: 0 12px;
  background: var(--ued-bg-panel-muted);
  border-bottom: 1px solid var(--ued-border-default);
  color: var(--ued-text-muted);
  font-size: var(--ued-text-caption);
  font-weight: 700;
  letter-spacing: 0.02em;
  text-align: left;
  white-space: nowrap;
}

.ued-table tbody td {
  height: 44px;
  padding: 10px 12px;
  border-top: 1px solid var(--ued-border-subtle);
  color: var(--ued-text-secondary);
  vertical-align: middle;
}

.ued-table__row.is-clickable {
  cursor: pointer;
}

.ued-table__row.is-clickable:hover {
  background: var(--ued-bg-panel-hover);
}

.ued-table__state-cell {
  padding: 20px;
}

.is-center {
  text-align: center;
}

.is-right {
  text-align: right;
}
</style>
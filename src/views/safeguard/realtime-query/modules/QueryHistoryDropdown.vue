<template>
  <div class="qhd-container">
    <div v-if="history.length > 0" class="qhd-list">
      <div
        v-for="record in history"
        :key="record.id"
        class="qhd-item"
        @click="$emit('select', record)"
      >
        <div class="qhd-item-main">
          <div class="qhd-item-promql">{{ record.promql }}</div>
          <div class="qhd-item-meta">
            <span>{{ record.datasourceName || '数据源 #' + record.selectedDsId }}</span>
            <span class="qhd-meta-sep">|</span>
            <span>{{ formatTimeRange(record.timeRangeMinutes) }}</span>
            <span class="qhd-meta-sep">|</span>
            <span>{{ record.resultMode === 'table' ? 'Table' : 'Graph' }}</span>
            <span class="qhd-meta-sep">|</span>
            <span>{{ relativeTime(record.createdAt) }}</span>
          </div>
        </div>
        <button class="qhd-delete-btn" @click.stop="$emit('delete', record.id)">
          <ArtSvgIcon icon="ri:close-line" />
        </button>
      </div>
    </div>
    <div v-else class="qhd-empty">暂无查询历史</div>
    <div v-if="history.length > 0" class="qhd-footer">
      <button class="qhd-clear-btn" @click="$emit('clear')">清空全部</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { QueryHistoryRecord } from '../useQueryHistory'

defineProps<{
  history: QueryHistoryRecord[]
}>()

defineEmits<{
  select: [record: QueryHistoryRecord]
  delete: [id: string]
  clear: []
}>()

function formatTimeRange(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  if (minutes < 1440) return `${minutes / 60}h`
  return `${minutes / 1440}d`
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return '刚刚'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  return `${days}天前`
}
</script>

<style scoped>
.qhd-container {
  display: flex;
  flex-direction: column;
  max-height: 320px;
}

.qhd-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.qhd-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.15s;
  gap: 8px;
}

.qhd-item:hover {
  background: var(--el-color-primary-light-9);
}

.qhd-item-main {
  flex: 1;
  min-width: 0;
}

.qhd-item-promql {
  font-size: 12px;
  color: var(--el-text-color-primary);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qhd-item-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-primary);
}

.qhd-meta-sep {
  color: var(--el-text-color-primary);
}

.qhd-delete-btn {
  flex: none;
  opacity: 0;
  transition: opacity 0.15s;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--el-text-color-secondary);
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.qhd-item:hover .qhd-delete-btn {
  opacity: 1;
}

.qhd-delete-btn:hover {
  color: var(--el-color-danger);
}

.qhd-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.qhd-footer {
  display: flex;
  justify-content: center;
  padding: 6px 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.qhd-clear-btn {
  background: none;
  border: none;
  color: var(--el-color-primary);
  font-size: 12px;
  cursor: pointer;
  padding: 2px 8px;
}

.qhd-clear-btn:hover {
  color: var(--el-color-primary-light-3);
}
</style>

<template>
  <div class="overview-table overview-table--embedded">
    <table v-if="loading || rows.length" class="overview-table__table">
      <thead>
        <tr>
          <th>集群</th>
          <th>状态</th>
          <th>总CPU</th>
          <th>CPU使用率</th>
          <th>总内存</th>
          <th>内存使用率</th>
          <th>剩余磁盘</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody v-if="loading && !rows.length">
        <tr>
          <td colspan="8" class="overview-table__empty">正在查询集群…</td>
        </tr>
      </tbody>
      <tbody v-else>
        <tr
          v-for="row in rows"
          :key="row.name"
          class="overview-table__row"
          :class="{ 'is-danger': row.danger, 'is-warning': row.hot }"
        >
          <td class="overview-table__name" :title="row.displayName">{{ row.displayName }}</td>
          <td>
            <span class="overview-table__status" :class="statusClass(row)">
              <span class="overview-table__dot" />
              {{ row.statusText }}
            </span>
          </td>
          <td class="overview-table__num overview-table__num--left">
            {{ formatCores(row.cpuTotal) }}
          </td>
          <td>
            <div class="overview-table__metric overview-table__metric--usage">
              <div class="overview-table__bar">
                <div
                  class="overview-table__bar-fill"
                  :class="levelClass(row.cpuPercent)"
                  :style="{ width: `${clampPercent(row.cpuPercent)}%` }"
                />
              </div>
              <span class="overview-table__num">{{ formatPercent(row.cpuPercent) }}</span>
            </div>
          </td>
          <td class="overview-table__num overview-table__num--left">
            {{ formatBytes(row.memoryTotal) }}
          </td>
          <td>
            <div class="overview-table__metric overview-table__metric--usage">
              <div class="overview-table__bar">
                <div
                  class="overview-table__bar-fill"
                  :class="levelClass(row.memoryPercent)"
                  :style="{ width: `${clampPercent(row.memoryPercent)}%` }"
                />
              </div>
              <span class="overview-table__num">{{ formatPercent(row.memoryPercent) }}</span>
            </div>
          </td>
          <td class="overview-table__num" :class="{ 'is-warn-text': row.diskLow }">
            {{ formatBytes(row.diskAvail) }}
          </td>
          <td class="overview-table__actions" @click.stop>
            <ElButton link type="primary" @click="emit('cluster-enter', row)">进入</ElButton>
            <ElButton link type="primary" @click="emit('cluster-monitor', row)">监控</ElButton>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="overview-table__empty">暂无集群数据</div>
  </div>
</template>

<script setup lang="ts">
  import type { WorkbenchClusterRow } from '../useWorkbenchPage'
  import {
    clampPercent,
    formatBytes,
    formatCores,
    formatPercent,
    levelClass
  } from '@/views/container/cluster-detail/prometheus/embed/overview-table-format'

  defineProps<{
    rows: WorkbenchClusterRow[]
    loading?: boolean
  }>()

  const emit = defineEmits<{
    'cluster-enter': [row: WorkbenchClusterRow]
    'cluster-monitor': [row: WorkbenchClusterRow]
  }>()

  function statusClass(row: WorkbenchClusterRow): string {
    if (row.status === 0 && row.nodeNotReady === 0) return 'is-ready'
    if (row.status === 0 && row.nodeNotReady > 0) return 'is-not-ready'
    if (row.status === 3 || row.status === 4) return 'is-not-ready'
    return ''
  }
</script>

<style scoped lang="scss">
  @use '@/views/container/cluster-detail/prometheus/embed/overview-table.scss';

  .overview-table__row {
    cursor: default;
  }

  .overview-table__table {
    min-width: 720px;
  }

  .overview-table__actions {
    display: flex;
    gap: 2px;
    align-items: center;
    white-space: nowrap;

    :deep(.el-button) {
      padding: 0 2px;
      margin-left: 0 !important;
      font-size: 12px;
    }
  }
</style>

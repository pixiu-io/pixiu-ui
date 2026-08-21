<template>
  <div class="node-overview-table">
    <div v-if="loading && !rows.length" class="node-overview-table__empty">正在查询节点…</div>
    <div v-else-if="!rows.length" class="node-overview-table__empty">暂无节点数据</div>
    <table v-else class="node-overview-table__table">
      <thead>
        <tr>
          <th>节点</th>
          <th>状态</th>
          <th>Pod</th>
          <th>总CPU</th>
          <th>CPU使用率</th>
          <th>总内存</th>
          <th>内存使用率</th>
          <th>剩余磁盘</th>
          <th>发送</th>
          <th>接收</th>
          <th>连接数</th>
          <th>重传率</th>
          <th>Load</th>
          <th>在线时间</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.name"
          class="node-overview-table__row"
          :class="{ 'is-danger': row.ready === false, 'is-warning': row.hot }"
          @click="emit('node-select', row)"
        >
          <td class="node-overview-table__name" :title="row.name">{{ row.name }}</td>
          <td>
            <span
              class="node-overview-table__status"
              :class="
                row.ready === true ? 'is-ready' : row.ready === false ? 'is-not-ready' : ''
              "
            >
              <span class="node-overview-table__dot" />
              {{ row.ready === true ? 'Ready' : row.ready === false ? 'NotReady' : '-' }}
            </span>
          </td>
          <td class="node-overview-table__num">{{ formatPod(row.pods) }}</td>
          <td class="node-overview-table__num node-overview-table__num--left">
            {{ formatCores(row.cpuTotal) }}
          </td>
          <td>
            <div class="node-overview-table__metric node-overview-table__metric--usage">
              <div class="node-overview-table__bar">
                <div
                  class="node-overview-table__bar-fill"
                  :class="levelClass(row.cpu)"
                  :style="{ width: `${clampPercent(row.cpu)}%` }"
                />
              </div>
              <span class="node-overview-table__num">{{ formatPercent(row.cpu) }}</span>
            </div>
          </td>
          <td class="node-overview-table__num node-overview-table__num--left">
            {{ formatBytes(row.memoryTotal) }}
          </td>
          <td>
            <div class="node-overview-table__metric node-overview-table__metric--usage">
              <div class="node-overview-table__bar">
                <div
                  class="node-overview-table__bar-fill"
                  :class="levelClass(row.memory)"
                  :style="{ width: `${clampPercent(row.memory)}%` }"
                />
              </div>
              <span class="node-overview-table__num">{{ formatPercent(row.memory) }}</span>
            </div>
          </td>
          <td class="node-overview-table__num" :class="{ 'is-warn-text': row.diskLow }">
            {{ formatBytes(row.diskAvail) }}
          </td>
          <td>
            <div class="node-overview-table__metric node-overview-table__metric--net">
              <div class="node-overview-table__bar">
                <div
                  class="node-overview-table__bar-fill is-net"
                  :style="{ width: `${relativeBar(row.netTx, maxNet)}%` }"
                />
              </div>
              <span class="node-overview-table__num">{{ formatRate(row.netTx) }}</span>
            </div>
          </td>
          <td>
            <div class="node-overview-table__metric node-overview-table__metric--net">
              <div class="node-overview-table__bar">
                <div
                  class="node-overview-table__bar-fill is-net"
                  :style="{ width: `${relativeBar(row.netRx, maxNet)}%` }"
                />
              </div>
              <span class="node-overview-table__num">{{ formatRate(row.netRx) }}</span>
            </div>
          </td>
          <td class="node-overview-table__num">{{ formatConn(row.connections) }}</td>
          <td class="node-overview-table__num" :class="{ 'is-warn-text': row.retransHigh }">
            {{ formatRetrans(row.retrans) }}
          </td>
          <td class="node-overview-table__num">{{ formatLoad(row.load5) }}</td>
          <td class="node-overview-table__num node-overview-table__num--left">
            {{ formatUptime(row.uptime) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import type { DashboardPanelResult } from '@/api/dashboard'

  export type NodeOverviewRow = {
    name: string
    ready: boolean | null
    cpu: number | null
    cpuTotal: number | null
    memory: number | null
    memoryTotal: number | null
    diskAvail: number | null
    netTx: number | null
    netRx: number | null
    connections: number | null
    retrans: number | null
    load5: number | null
    uptime: number | null
    pods: number | null
    hot: boolean
    diskLow: boolean
    retransHigh: boolean
  }

  const props = defineProps<{
    resultMap: Record<string, DashboardPanelResult>
    loading?: boolean
  }>()

  const emit = defineEmits<{
    'node-select': [row: NodeOverviewRow]
  }>()

  const DISK_LOW_BYTES = 20 * 1024 ** 3
  const RETRANS_HIGH = 1

  const OVERVIEW_PANEL_IDS = [
    'node.embed.ready',
    'node.embed.overview_cpu',
    'node.embed.overview_cpu_total',
    'node.embed.overview_memory',
    'node.embed.overview_memory_total',
    'node.embed.overview_disk',
    'node.embed.overview_net_transmit',
    'node.embed.overview_net_receive',
    'node.embed.overview_connections',
    'node.embed.overview_retrans',
    'node.embed.overview_load5',
    'node.embed.overview_uptime',
    'node.embed.pods'
  ] as const

  function lastValue(result: DashboardPanelResult | undefined, node: string): number | null {
    if (result?.status !== 'success') return null
    let byInstance: number | null = null
    for (const series of result.series) {
      const value = Number(series.values.at(-1)?.value)
      if (!Number.isFinite(value)) continue
      const direct = series.metric.node?.trim() || series.metric.nodename?.trim()
      if (direct === node) return value
      const instance = series.metric.instance?.trim()
      if (!instance || byInstance !== null) continue
      const host = instance.split(':')[0]?.trim()
      if (host === node || instance.startsWith(`${node}:`)) byInstance = value
    }
    return byInstance
  }

  function collectNodeNames(resultMap: Record<string, DashboardPanelResult>): string[] {
    const names = new Set<string>()
    for (const id of OVERVIEW_PANEL_IDS) {
      const result = resultMap[id]
      if (result?.status !== 'success') continue
      for (const series of result.series) {
        const name = series.metric.node?.trim() || series.metric.nodename?.trim()
        if (name) names.add(name)
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  }

  const rows = computed<NodeOverviewRow[]>(() => {
    const names = collectNodeNames(props.resultMap)
    return names.map((name) => {
      const readyRaw = lastValue(props.resultMap['node.embed.ready'], name)
      const cpu = lastValue(props.resultMap['node.embed.overview_cpu'], name)
      const cpuTotal = lastValue(props.resultMap['node.embed.overview_cpu_total'], name)
      const memory = lastValue(props.resultMap['node.embed.overview_memory'], name)
      const memoryTotal = lastValue(props.resultMap['node.embed.overview_memory_total'], name)
      const diskAvail = lastValue(props.resultMap['node.embed.overview_disk'], name)
      const netTx = lastValue(props.resultMap['node.embed.overview_net_transmit'], name)
      const netRx = lastValue(props.resultMap['node.embed.overview_net_receive'], name)
      const connections = lastValue(props.resultMap['node.embed.overview_connections'], name)
      const retrans = lastValue(props.resultMap['node.embed.overview_retrans'], name)
      const load5 = lastValue(props.resultMap['node.embed.overview_load5'], name)
      const uptime = lastValue(props.resultMap['node.embed.overview_uptime'], name)
      const pods = lastValue(props.resultMap['node.embed.pods'], name)
      const ready = readyRaw === null ? null : readyRaw > 0
      const hot =
        (cpu !== null && cpu > 70) || (memory !== null && memory > 70) || ready === false
      const diskLow = diskAvail !== null && diskAvail < DISK_LOW_BYTES
      const retransHigh = retrans !== null && retrans > RETRANS_HIGH
      return {
        name,
        ready,
        cpu,
        cpuTotal,
        memory,
        memoryTotal,
        diskAvail,
        netTx,
        netRx,
        connections,
        retrans,
        load5,
        uptime,
        pods,
        hot,
        diskLow,
        retransHigh
      }
    })
  })

  const maxNet = computed(() => {
    let max = 0
    for (const row of rows.value) {
      if (row.netTx !== null && row.netTx > max) max = row.netTx
      if (row.netRx !== null && row.netRx > max) max = row.netRx
    }
    return max
  })

  function clampPercent(value: number | null): number {
    if (value === null || !Number.isFinite(value)) return 0
    return Math.max(0, Math.min(100, value))
  }

  function relativeBar(value: number | null, max: number): number {
    if (value === null || !Number.isFinite(value) || max <= 0) return 0
    return Math.max(2, Math.min(100, (value / max) * 100))
  }

  function levelClass(value: number | null): string {
    if (value === null) return ''
    if (value > 85) return 'is-danger'
    if (value > 70) return 'is-warning'
    return 'is-ok'
  }

  function formatPercent(value: number | null): string {
    if (value === null) return '-'
    return `${value.toFixed(1)}%`
  }

  function formatCores(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return '-'
    const digits = Number.isInteger(value) || Math.abs(value) >= 10 ? 0 : 1
    return `${value.toFixed(digits)} 核`
  }

  function formatBytes(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return '-'
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
    let current = Math.abs(value)
    let index = 0
    while (current >= 1024 && index < units.length - 1) {
      current /= 1024
      index += 1
    }
    return `${current.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
  }

  function formatRate(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return '-'
    const units = ['B/s', 'KiB/s', 'MiB/s', 'GiB/s']
    let current = Math.abs(value)
    let index = 0
    while (current >= 1024 && index < units.length - 1) {
      current /= 1024
      index += 1
    }
    const digits = current >= 100 || index === 0 ? 0 : 1
    return `${current.toFixed(digits)} ${units[index]}`
  }

  function formatLoad(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return '-'
    return value.toFixed(2)
  }

  function formatConn(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return '-'
    return String(Math.round(value))
  }

  function formatRetrans(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return '-'
    return `${value.toFixed(1)}%`
  }

  function formatUptime(seconds: number | null): string {
    if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '-'
    const sec = Math.floor(seconds)
    const weeks = Math.floor(sec / (7 * 24 * 3600))
    if (weeks >= 1) return `${weeks} weeks`
    const days = Math.floor(sec / (24 * 3600))
    if (days >= 1) return `${days} days`
    const hours = Math.floor(sec / 3600)
    if (hours >= 1) return `${hours} hours`
    const minutes = Math.floor(sec / 60)
    if (minutes >= 1) return `${minutes} min`
    return `${sec}s`
  }

  function formatPod(value: number | null): string {
    if (value === null) return '-'
    return String(Math.round(value))
  }
</script>

<style scoped lang="scss">
  .node-overview-table {
    margin: 0 16px 12px;
    overflow: auto;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
  }

  .node-overview-table__empty {
    padding: 28px 16px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
    text-align: center;
  }

  .node-overview-table__table {
    width: 100%;
    min-width: 1280px;
    border-collapse: collapse;
    font-size: 12px;
  }

  .node-overview-table__table th,
  .node-overview-table__table td {
    padding: 10px 12px;
    text-align: left;
    border-bottom: 1px solid var(--el-border-color-extra-light);
    white-space: nowrap;
  }

  .node-overview-table__table th {
    font-weight: 600;
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-blank);
  }

  .node-overview-table__row {
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .node-overview-table__row:hover {
    background: var(--el-fill-color-light);
  }

  .node-overview-table__table tbody tr.is-danger {
    background: rgb(245 108 108 / 6%);
  }

  .node-overview-table__table tbody tr.is-danger:hover {
    background: rgb(245 108 108 / 12%);
  }

  .node-overview-table__table tbody tr.is-warning:not(.is-danger) {
    background: rgb(230 162 60 / 5%);
  }

  .node-overview-table__table tbody tr.is-warning:not(.is-danger):hover {
    background: rgb(230 162 60 / 10%);
  }

  .node-overview-table__name {
    max-width: 200px;
    overflow: hidden;
    font-weight: 500;
    color: var(--el-text-color-primary);
    text-overflow: ellipsis;
  }

  .node-overview-table__status {
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }

  .node-overview-table__dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--el-text-color-placeholder);
  }

  .node-overview-table__status.is-ready .node-overview-table__dot {
    background: #2e9b62;
  }

  .node-overview-table__status.is-not-ready {
    color: #e45757;
  }

  .node-overview-table__status.is-not-ready .node-overview-table__dot {
    background: #e45757;
  }

  .node-overview-table__metric {
    display: flex;
    gap: 8px;
    align-items: center;
    min-width: 132px;
  }

  .node-overview-table__metric--usage {
    gap: 6px;
    min-width: 0;
    width: 90px;
  }

  .node-overview-table__metric--usage .node-overview-table__bar {
    flex: 0 0 42px;
    width: 42px;
  }

  .node-overview-table__metric--usage .node-overview-table__num {
    min-width: 38px;
  }

  .node-overview-table__metric--net {
    gap: 6px;
    min-width: 0;
    width: 90px;
  }

  .node-overview-table__metric--net .node-overview-table__bar {
    flex: 0 0 42px;
    width: 42px;
  }

  .node-overview-table__metric--net .node-overview-table__num {
    min-width: 38px;
  }

  .node-overview-table__bar {
    flex: 1 1 auto;
    height: 6px;
    overflow: hidden;
    background: var(--el-fill-color);
    border-radius: 999px;
  }

  .node-overview-table__bar-fill {
    height: 100%;
    border-radius: inherit;
    background: #2e9b62;
  }

  .node-overview-table__bar-fill.is-warning {
    background: #d99a2b;
  }

  .node-overview-table__bar-fill.is-danger {
    background: #e45757;
  }

  .node-overview-table__bar-fill.is-net {
    background: linear-gradient(90deg, #5b8def, #7c6af0);
  }

  .node-overview-table__num {
    flex: 0 0 auto;
    min-width: 52px;
    font-variant-numeric: tabular-nums;
    color: var(--el-text-color-regular);
    text-align: right;
  }

  .node-overview-table__num--left {
    text-align: left;
  }

  .node-overview-table__num.is-warn-text {
    color: #d99a2b;
    font-weight: 600;
  }
</style>

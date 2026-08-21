<template>
  <div class="node-network-board">
    <div class="node-network-board__col node-network-board__col--left">
      <DashboardPanel
        class="node-network-board__chart"
        :panel="panelOf('node.embed.board.traffic_trend')"
        :result="resultMap['node.embed.board.traffic_trend']"
        :loading="loading"
        :show-legend="true"
        overview-line
      />
      <DashboardPanel
        class="node-network-board__chart"
        :panel="panelOf('node.embed.board.rate_by_node')"
        :result="resultMap['node.embed.board.rate_by_node']"
        :loading="loading"
        :show-legend="false"
        overview-line
      />
    </div>

    <div class="node-network-board__col node-network-board__col--mid">
      <div class="node-network-board__kpis">
        <div class="node-network-board__stat">
          <div class="node-network-board__stat-label">在线实例</div>
          <div class="node-network-board__stat-value is-ok">{{ onlineCount }}</div>
        </div>
        <div class="node-network-board__stat">
          <div class="node-network-board__stat-label">总连接数</div>
          <div class="node-network-board__stat-value">{{ totalConnections }}</div>
        </div>
        <div class="node-network-board__stat">
          <div class="node-network-board__stat-label">总吞吐速率</div>
          <div class="node-network-board__stat-value is-accent">{{ totalThroughput }}</div>
        </div>
      </div>

      <div class="node-network-board__rank">
        <div class="node-network-board__rank-title">节点吞吐排名</div>
        <div class="node-network-board__rank-head">
          <span>节点</span>
          <span>Mean</span>
          <span>Max</span>
        </div>
        <div v-if="!rankRows.length" class="node-network-board__rank-empty">
          {{ loading ? '查询中…' : '暂无吞吐数据' }}
        </div>
        <div v-for="row in rankRows" :key="row.name" class="node-network-board__rank-row">
          <div class="node-network-board__rank-name" :title="row.name">
            <span class="node-network-board__rank-bar">
              <i :style="{ width: `${row.share}%` }" />
            </span>
            <span class="node-network-board__rank-text">{{ row.name }}</span>
          </div>
          <span class="node-network-board__rank-num">{{ formatRate(row.mean) }}</span>
          <span class="node-network-board__rank-num">{{ formatRate(row.max) }}</span>
        </div>
      </div>

      <div class="node-network-board__period">
        <div class="node-network-board__stat node-network-board__stat--period">
          <div class="node-network-board__stat-label">30日内传输</div>
          <div class="node-network-board__stat-value is-accent">{{ formatBytes(tx30d) }}</div>
        </div>
        <div class="node-network-board__stat node-network-board__stat--period">
          <div class="node-network-board__stat-label">30日内接收</div>
          <div class="node-network-board__stat-value">{{ formatBytes(rx30d) }}</div>
        </div>
        <div class="node-network-board__stat node-network-board__stat--period">
          <div class="node-network-board__stat-label">30日内总计</div>
          <div class="node-network-board__stat-value is-warn">{{ formatBytes(total30d) }}</div>
        </div>
      </div>
    </div>

    <div class="node-network-board__col node-network-board__col--right">
      <DashboardPanel
        class="node-network-board__chart"
        :panel="panelOf('node.embed.board.load_trend')"
        :result="resultMap['node.embed.board.load_trend']"
        :loading="loading"
        :show-legend="false"
        overview-line
      />
      <DashboardPanel
        class="node-network-board__chart"
        :panel="panelOf('node.embed.board.conn_trend')"
        :result="resultMap['node.embed.board.conn_trend']"
        :loading="loading"
        :show-legend="true"
        overview-line
      />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import type {
    DashboardDefinition,
    DashboardPanelDefinition,
    DashboardPanelResult
  } from '@/api/dashboard'
  import { countNodeReady } from './utils'
  import { getDashboardDefinition } from '@/utils/metrics/dashboard-catalog'
  import DashboardPanel from '@/views/safeguard/dashboard/modules/DashboardPanel.vue'

  const props = defineProps<{
    definition: DashboardDefinition
    resultMap: Record<string, DashboardPanelResult>
    loading?: boolean
  }>()

  function panelOf(id: string): DashboardPanelDefinition {
    const fromProp = props.definition.panels.find((panel) => panel.id === id)
    if (fromProp) return fromProp
    const fromCatalog = getDashboardDefinition().panels.find((panel) => panel.id === id)
    if (fromCatalog) return fromCatalog
    return {
      id,
      section: 'node-resource-embed',
      title: id,
      kind: 'line',
      unit: 'Bps',
      span: 12
    }
  }

  function lastValue(result: DashboardPanelResult | undefined): number | null {
    if (result?.status !== 'success') return null
    let sum = 0
    let hit = false
    for (const series of result.series) {
      const value = Number(series.values.at(-1)?.value)
      if (!Number.isFinite(value)) continue
      sum += value
      hit = true
    }
    return hit ? sum : null
  }

  const onlineCount = computed(() => {
    const nodes = countNodeReady(props.resultMap)
    return nodes.total > 0 ? String(nodes.ready) : '-'
  })

  const totalConnections = computed(() => {
    const value = lastValue(props.resultMap['node.embed.overview_connections'])
    return value === null ? '-' : String(Math.round(value))
  })

  const totalThroughput = computed(() => {
    const tx = lastValue(props.resultMap['node.embed.overview_net_transmit'])
    const rx = lastValue(props.resultMap['node.embed.overview_net_receive'])
    if (tx === null && rx === null) return '-'
    return formatRate((tx ?? 0) + (rx ?? 0))
  })

  const tx30d = computed(() => lastValue(props.resultMap['node.embed.board.tx_30d']))
  const rx30d = computed(() => lastValue(props.resultMap['node.embed.board.rx_30d']))
  const total30d = computed(() => lastValue(props.resultMap['node.embed.board.total_30d']))

  type RankRow = { name: string; mean: number; max: number; share: number }

  const rankRows = computed<RankRow[]>(() => {
    const result = props.resultMap['node.embed.board.rate_by_node']
    if (result?.status !== 'success') return []
    const rows: Omit<RankRow, 'share'>[] = []
    for (const series of result.series) {
      const name = series.metric.node?.trim() || series.metric.nodename?.trim()
      if (!name || !series.values.length) continue
      const values = series.values
        .map((point) => Number(point.value))
        .filter((value) => Number.isFinite(value))
      if (!values.length) continue
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length
      const max = Math.max(...values)
      rows.push({ name, mean, max })
    }
    rows.sort((a, b) => b.mean - a.mean)
    const top = rows.slice(0, 8)
    const peak = Math.max(...top.map((row) => row.mean), 1)
    return top.map((row) => ({
      ...row,
      share: Math.max(4, Math.min(100, (row.mean / peak) * 100))
    }))
  })

  function formatRate(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return '-'
    const bits = Math.abs(value) * 8
    const units = ['b/s', 'Kb/s', 'Mb/s', 'Gb/s']
    let current = bits
    let index = 0
    while (current >= 1000 && index < units.length - 1) {
      current /= 1000
      index += 1
    }
    const digits = current >= 100 || index === 0 ? 0 : 1
    return `${current.toFixed(digits)} ${units[index]}`
  }

  function formatBytes(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return '-'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let current = Math.abs(value)
    let index = 0
    while (current >= 1000 && index < units.length - 1) {
      current /= 1000
      index += 1
    }
    return `${current.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
  }
</script>

<style scoped lang="scss">
  .node-network-board {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr) minmax(0, 1.1fr);
    gap: 12px;
    margin: 0 16px 16px;
    min-height: 520px;
  }

  .node-network-board__col {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }

  .node-network-board__chart {
    display: flex;
    flex: 1 1 0;
    flex-direction: column;
    min-height: 240px;
    margin: 0;
  }

  .node-network-board__chart :deep(.dashboard-panel__chart-shell),
  .node-network-board__chart :deep(.dashboard-panel__state) {
    flex: 1;
    min-height: 180px;
  }

  .node-network-board__kpis {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .node-network-board__stat {
    padding: 12px 12px 10px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
  }

  .node-network-board__stat--period {
    padding: 10px 12px;
  }

  .node-network-board__stat-label {
    margin-bottom: 6px;
    font-size: 12px;
    line-height: 1.2;
    color: var(--el-text-color-secondary);
  }

  .node-network-board__stat-value {
    font-size: 16px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--el-text-color-primary);
    font-variant-numeric: tabular-nums;
  }

  .node-network-board__stat-value.is-ok {
    color: #2e9b62;
  }

  .node-network-board__stat-value.is-accent {
    color: var(--el-color-primary);
  }

  .node-network-board__stat-value.is-warn {
    color: #d99a2b;
  }

  .node-network-board__rank {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 200px;
    padding: 12px 14px;
    overflow: auto;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
  }

  .node-network-board__rank-title {
    margin-bottom: 10px;
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .node-network-board__rank-head,
  .node-network-board__rank-row {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) 0.75fr 0.75fr;
    gap: 10px;
    align-items: center;
    font-size: 12px;
  }

  .node-network-board__rank-head {
    padding-bottom: 8px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
    border-bottom: 1px solid var(--el-border-color-extra-light);
  }

  .node-network-board__rank-row {
    padding: 9px 0;
    border-bottom: 1px solid var(--el-border-color-extra-light);
  }

  .node-network-board__rank-row:last-child {
    border-bottom: none;
  }

  .node-network-board__rank-name {
    display: flex;
    gap: 8px;
    align-items: center;
    min-width: 0;
  }

  .node-network-board__rank-text {
    overflow: hidden;
    color: var(--el-text-color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .node-network-board__rank-bar {
    flex: 0 0 40px;
    height: 6px;
    overflow: hidden;
    background: var(--el-fill-color);
    border-radius: 999px;
  }

  .node-network-board__rank-bar i {
    display: block;
    height: 100%;
    background: var(--el-color-primary);
    border-radius: inherit;
    opacity: 0.85;
  }

  .node-network-board__rank-num {
    font-variant-numeric: tabular-nums;
    color: var(--el-text-color-regular);
    text-align: right;
  }

  .node-network-board__rank-empty {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    padding: 24px 0;
    color: var(--el-text-color-secondary);
  }

  .node-network-board__period {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  @media (max-width: 1200px) {
    .node-network-board {
      grid-template-columns: 1fr;
    }
  }
</style>

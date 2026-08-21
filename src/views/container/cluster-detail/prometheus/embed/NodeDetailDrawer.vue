<template>
  <ElDrawer
    v-model="visible"
    direction="rtl"
    size="950px"
    :destroy-on-close="true"
    class="node-detail-drawer"
  >
    <template #header>
      <div class="node-detail-drawer__header">
        <div class="node-detail-drawer__title-wrap">
          <span class="node-detail-drawer__title">{{ row?.name || '节点详情' }}</span>
          <span
            v-if="row"
            class="node-detail-drawer__status"
            :class="
              row.ready === true ? 'is-ready' : row.ready === false ? 'is-not-ready' : ''
            "
          >
            <span class="node-detail-drawer__dot" />
            {{ row.ready === true ? 'Ready' : row.ready === false ? 'NotReady' : '-' }}
          </span>
        </div>
      </div>
    </template>

    <div v-if="row" class="node-detail-drawer__body">
      <div class="node-detail-drawer__kpis">
        <div v-for="kpi in kpis" :key="kpi.key" class="node-detail-drawer__kpi">
          <div class="node-detail-drawer__kpi-label">{{ kpi.label }}</div>
          <div class="node-detail-drawer__kpi-value" :class="kpi.className">{{ kpi.value }}</div>
        </div>
      </div>

      <div class="node-detail-drawer__section-title">资源趋势</div>
      <div class="node-detail-drawer__grid">
        <DashboardPanel
          v-for="panel in resourcePanels"
          :key="panel.id"
          :panel="panel"
          :result="resultMap[panel.id]"
          :loading="loading"
          :show-legend="false"
          overview-line
        />
      </div>

      <div class="node-detail-drawer__section-title">网络</div>
      <div class="node-detail-drawer__grid">
        <DashboardPanel
          v-for="panel in networkPanels"
          :key="panel.id"
          :panel="panel"
          :result="resultMap[panel.id]"
          :loading="loading"
          :show-legend="false"
          overview-line
        />
      </div>
    </div>
  </ElDrawer>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import {
    fetchDashboardQuery,
    type DashboardDefinition,
    type DashboardPanelResult
  } from '@/api/dashboard'
  import type { DatasourceItem } from '@/api/datasource'
  import {
    NODE_DETAIL_DRAWER_PANEL_IDS
  } from '@/utils/metrics/dashboard-catalog'
  import type { MetricsGranularityOption } from '@/utils/metrics/granularity'
  import { METRICS_TIME_PRESETS, type MetricsTimeRange } from '@/utils/metrics/time-range'
  import DashboardPanel from '@/views/safeguard/dashboard/modules/DashboardPanel.vue'
  import type { NodeOverviewRow } from './NodeOverviewTable.vue'

  const RESOURCE_PANEL_IDS = [
    'node.detail.cpu_trend',
    'node.detail.memory_trend',
    'node.detail.disk_trend',
    'node.detail.pods_trend'
  ] as const

  const NETWORK_PANEL_IDS = [
    'node.detail.net_receive',
    'node.detail.net_transmit'
  ] as const

  const props = defineProps<{
    modelValue: boolean
    row: NodeOverviewRow | null
    definition: DashboardDefinition
    datasource: DatasourceItem | null
    timeRange: MetricsTimeRange
    granularity: MetricsGranularityOption
  }>()

  const emit = defineEmits<{
    'update:modelValue': [value: boolean]
  }>()

  const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
  })

  const loading = ref(false)
  const resultMap = reactive<Record<string, DashboardPanelResult>>({})
  let querySequence = 0

  const panelById = computed(() => {
    const map = new Map(props.definition.panels.map((panel) => [panel.id, panel]))
    return map
  })

  const resourcePanels = computed(() =>
    RESOURCE_PANEL_IDS.map((id) => panelById.value.get(id)).filter(
      (panel): panel is NonNullable<typeof panel> => Boolean(panel)
    )
  )

  const networkPanels = computed(() =>
    NETWORK_PANEL_IDS.map((id) => panelById.value.get(id)).filter(
      (panel): panel is NonNullable<typeof panel> => Boolean(panel)
    )
  )

  function formatPercent(value: number | null): string {
    if (value === null) return '-'
    return `${value.toFixed(1)}%`
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

  function formatPod(value: number | null): string {
    if (value === null) return '-'
    return String(Math.round(value))
  }

  function lastSeriesValue(result: DashboardPanelResult | undefined): number | null {
    if (result?.status !== 'success') return null
    const value = Number(result.series[0]?.values.at(-1)?.value)
    return Number.isFinite(value) ? value : null
  }

  const load5Value = computed(() => lastSeriesValue(resultMap['node.detail.load5']))

  const kpis = computed(() => {
    const row = props.row
    if (!row) return []
    const cpuClass =
      row.cpu !== null && row.cpu > 85
        ? 'is-danger'
        : row.cpu !== null && row.cpu > 70
          ? 'is-warning'
          : ''
    const memClass =
      row.memory !== null && row.memory > 85
        ? 'is-danger'
        : row.memory !== null && row.memory > 70
          ? 'is-warning'
          : ''
    return [
      { key: 'cpu', label: 'CPU', value: formatPercent(row.cpu), className: cpuClass },
      { key: 'mem', label: '内存', value: formatPercent(row.memory), className: memClass },
      {
        key: 'disk',
        label: '剩余磁盘',
        value: formatBytes(row.diskAvail),
        className: row.diskLow ? 'is-warning' : ''
      },
      { key: 'pods', label: 'Pods', value: formatPod(row.pods), className: '' },
      {
        key: 'load',
        label: 'Load 5m',
        value: load5Value.value === null ? '-' : load5Value.value.toFixed(2),
        className: ''
      }
    ]
  })

  function normalizedRange(): { start: number; end: number } {
    const preset = METRICS_TIME_PRESETS.find((item) => item.key === props.timeRange.presetKey)
    const range =
      !preset ||
      props.timeRange.presetKey === 'custom' ||
      props.timeRange.presetKey === 'yesterday'
        ? props.timeRange
        : preset.getRange(new Date())
    return {
      start: Math.floor(range.start.getTime() / 1000),
      end: Math.floor(range.end.getTime() / 1000)
    }
  }

  async function queryDetail() {
    const datasource = props.datasource
    const node = props.row?.name?.trim()
    if (!datasource || !node || !visible.value) {
      Object.keys(resultMap).forEach((key) => delete resultMap[key])
      return
    }

    const sequence = ++querySequence
    loading.value = true
    try {
      const { start, end } = normalizedRange()
      const durationSeconds = Math.max(1, end - start)
      const step = Math.max(
        Math.ceil(props.granularity.stepMs / 1000),
        Math.ceil(durationSeconds / 600)
      )
      const response = await fetchDashboardQuery(datasource, {
        panelIds: [...NODE_DETAIL_DRAWER_PANEL_IDS],
        start,
        end,
        step,
        filters: { node }
      })
      if (sequence !== querySequence) return
      for (const key of Object.keys(resultMap)) delete resultMap[key]
      for (const result of response.results) resultMap[result.id] = result
    } catch {
      if (sequence !== querySequence) return
      for (const key of Object.keys(resultMap)) delete resultMap[key]
    } finally {
      if (sequence === querySequence) loading.value = false
    }
  }

  watch(
    () =>
      [
        props.modelValue,
        props.row?.name,
        props.datasource?.id,
        props.timeRange.presetKey,
        props.timeRange.start?.getTime(),
        props.timeRange.end?.getTime(),
        props.granularity.stepMs
      ] as const,
    ([open]) => {
      if (!open) return
      void queryDetail()
    },
    { immediate: true }
  )
</script>

<style scoped lang="scss">
  .node-detail-drawer__header {
    display: flex;
    align-items: center;
    width: 100%;
    padding-right: 8px;
  }

  .node-detail-drawer__title-wrap {
    display: flex;
    gap: 10px;
    align-items: center;
    min-width: 0;
  }

  .node-detail-drawer__title {
    overflow: hidden;
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .node-detail-drawer__status {
    display: inline-flex;
    flex-shrink: 0;
    gap: 6px;
    align-items: center;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .node-detail-drawer__dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--el-text-color-placeholder);
  }

  .node-detail-drawer__status.is-ready .node-detail-drawer__dot {
    background: #2e9b62;
  }

  .node-detail-drawer__status.is-not-ready {
    color: #c45656;
  }

  .node-detail-drawer__status.is-not-ready .node-detail-drawer__dot {
    background: #c45656;
  }

  .node-detail-drawer__body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-bottom: 16px;
  }

  .node-detail-drawer__kpis {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 12px;
  }

  .node-detail-drawer__kpi {
    padding: 10px 12px;
    background: var(--el-fill-color-lighter);
    border-radius: 8px;
  }

  .node-detail-drawer__kpi-label {
    margin-bottom: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .node-detail-drawer__kpi-value {
    font-size: 16px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--el-text-color-primary);
  }

  .node-detail-drawer__kpi-value.is-warning {
    color: #e6a23c;
  }

  .node-detail-drawer__kpi-value.is-danger {
    color: #f56c6c;
  }

  .node-detail-drawer__section-title {
    margin: 8px 0 10px;
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .node-detail-drawer__grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 8px;
  }

  .node-detail-drawer__grid :deep(.dashboard-panel) {
    grid-column: span 1 / span 1;
    min-height: 220px;
    margin: 0;
  }

  @media (max-width: 640px) {
    .node-detail-drawer__kpis {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .node-detail-drawer__grid {
      grid-template-columns: 1fr;
    }
  }
</style>

<style lang="scss">
  .node-detail-drawer.el-drawer .el-drawer__header {
    margin-bottom: 12px;
    padding: 12px 20px 0;
  }

  .node-detail-drawer.el-drawer .el-drawer__body {
    padding: 0 20px 16px;
  }
</style>

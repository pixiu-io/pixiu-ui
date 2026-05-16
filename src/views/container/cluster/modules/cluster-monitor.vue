<template>
  <ElDrawer
    v-model="visible"
    direction="rtl"
    size="50%"
    :destroy-on-close="true"
    :show-close="false"
    class="cluster-monitor-drawer"
  >
    <template #header>
      <div class="cluster-monitor-drawer-header">
        <span class="cluster-monitor-drawer-title">{{ cluster?.clusterName }}</span>
        <div class="cluster-monitor-drawer-actions">
          <ElButton
            text
            circle
            class="cluster-monitor-drawer-icon-btn"
            title="刷新"
            :loading="metricsLoading"
            @click="handleRefresh"
          >
            <ElIcon :size="16"><Refresh /></ElIcon>
          </ElButton>
          <ElButton
            text
            circle
            class="cluster-monitor-drawer-icon-btn"
            title="关闭"
            @click="closeDrawer"
          >
            <ElIcon :size="16"><Close /></ElIcon>
          </ElButton>
        </div>
      </div>
    </template>
    <div v-loading="metricsLoading" class="resource-metrics-pane">
      <div class="tab-section-title">CPU</div>
      <div class="chart-grid">
        <div v-for="item in cpuMetrics" :key="item.title" class="chart-panel">
          <div class="panel-header">
            <span class="panel-title">{{ item.title }}</span>
          </div>
          <ArtLineChart
            :data="item.data"
            :x-axis-data="cpuTimeLabels"
            :show-area-color="true"
            :smooth="true"
            :line-width="1"
            :is-empty="!item.data.length"
            :silent-update="metricsChartReady"
            height="180px"
          />
        </div>
      </div>

      <div class="tab-section-title tab-section-title--spaced">内存</div>
      <div class="chart-grid">
        <div v-for="item in memoryMetrics" :key="item.title" class="chart-panel">
          <div class="panel-header">
            <span class="panel-title">{{ item.title }}</span>
          </div>
          <ArtLineChart
            :data="item.data"
            :x-axis-data="memoryTimeLabels"
            :show-area-color="true"
            :smooth="true"
            :line-width="1"
            :is-empty="!item.data.length"
            :silent-update="metricsChartReady"
            height="180px"
          />
        </div>
      </div>
    </div>
  </ElDrawer>
</template>

<script setup lang="ts">
  import { Close, Refresh } from '@element-plus/icons-vue'
  import ArtLineChart from '@/components/core/charts/art-line-chart/index.vue'
  import {
    aggregateDashboardMetricPoints,
    bytesToGib,
    fetchNodesUsageMetrics,
    parseNodeCpuMillicores,
    parseNodeMemoryBytes
  } from '@/api/kubernetes/metrics'
  import { fetchKubeListAll } from '@/api/kubernetes/list'
  import type { K8sNode } from '@/api/kubernetes/node'

  interface ClusterItem {
    id: number
    name: string
    clusterName: string
  }

  interface Props {
    modelValue: boolean
    cluster: ClusterItem | null
  }
  interface Emits {
    (e: 'update:modelValue', val: boolean): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const visible = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
  })

  const metricsLoading = ref(false)
  const metricsChartReady = ref(false)
  const cpuTimeLabels = ref<string[]>([])
  const memoryTimeLabels = ref<string[]>([])
  const cpuMetrics = ref<{ title: string; data: number[] }[]>([
    { title: 'CPU 总配置（核）', data: [] },
    { title: 'CPU 利用率（%）', data: [] },
    { title: 'CPU 使用量（核）', data: [] }
  ])
  const memoryMetrics = ref<{ title: string; data: number[] }[]>([
    { title: '内存总量（GB）', data: [] },
    { title: '内存使用率（%）', data: [] },
    { title: '内存使用量（GB）', data: [] }
  ])

  let metricsRefreshTimer: ReturnType<typeof setInterval> | null = null

  function resetResourceCharts() {
    metricsChartReady.value = false
    cpuTimeLabels.value = []
    memoryTimeLabels.value = []
    cpuMetrics.value[0].data = []
    cpuMetrics.value[1].data = []
    cpuMetrics.value[2].data = []
    memoryMetrics.value[0].data = []
    memoryMetrics.value[1].data = []
    memoryMetrics.value[2].data = []
  }

  function applyCpuChartData(
    labels: string[],
    totalCores: number,
    totalMillic: number,
    usageMillicSeries: number[]
  ) {
    cpuTimeLabels.value = labels
    cpuMetrics.value[0].data = usageMillicSeries.map(() => totalCores)
    cpuMetrics.value[1].data = usageMillicSeries.map((v) =>
      totalMillic > 0 ? +((v / totalMillic) * 100).toFixed(2) : 0
    )
    cpuMetrics.value[2].data = usageMillicSeries.map((v) => +(v / 1000).toFixed(2))
  }

  function applyMemoryChartData(
    labels: string[],
    totalBytes: number,
    usageBytesSeries: number[]
  ) {
    memoryTimeLabels.value = labels
    const totalGib = bytesToGib(totalBytes)
    memoryMetrics.value[0].data = usageBytesSeries.map(() => totalGib)
    memoryMetrics.value[1].data = usageBytesSeries.map((v) =>
      totalBytes > 0 ? +((v / totalBytes) * 100).toFixed(2) : 0
    )
    memoryMetrics.value[2].data = usageBytesSeries.map((v) => bytesToGib(v))
  }

  async function loadResourceMetrics(silent = false) {
    const cluster = props.cluster?.name
    if (!cluster) {
      resetResourceCharts()
      return
    }

    if (!silent) {
      metricsLoading.value = true
    }
    try {
      const nodes = await fetchKubeListAll<K8sNode>({
        path: `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/nodes`
      })
      const nodeNames = nodes
        .map((n) => n.metadata?.name)
        .filter((name): name is string => Boolean(name))

      if (!nodeNames.length) {
        if (!silent) resetResourceCharts()
        return
      }

      const totalMillic = nodes.reduce(
        (sum, n) =>
          sum +
          parseNodeCpuMillicores(n.status?.capacity?.cpu ?? n.status?.allocatable?.cpu),
        0
      )
      const totalCores = totalMillic > 0 ? +(totalMillic / 1000).toFixed(2) : 0
      const totalMemoryBytes = nodes.reduce(
        (sum, n) =>
          sum +
          parseNodeMemoryBytes(n.status?.capacity?.memory ?? n.status?.allocatable?.memory),
        0
      )

      const [cpuRes, memRes] = await Promise.all([
        fetchNodesUsageMetrics(cluster, nodeNames, 'cpu', 'usage'),
        fetchNodesUsageMetrics(cluster, nodeNames, 'memory', 'usage')
      ])
      const cpuAgg = aggregateDashboardMetricPoints(cpuRes.items)
      const memAgg = aggregateDashboardMetricPoints(memRes.items)

      if (!cpuAgg.labels.length && !memAgg.labels.length) {
        if (!silent) resetResourceCharts()
        return
      }

      if (cpuAgg.labels.length) {
        applyCpuChartData(cpuAgg.labels, totalCores, totalMillic, cpuAgg.values)
      }
      if (memAgg.labels.length) {
        applyMemoryChartData(memAgg.labels, totalMemoryBytes, memAgg.values)
      }
      metricsChartReady.value = true
    } catch {
      if (!silent) resetResourceCharts()
    } finally {
      if (!silent) metricsLoading.value = false
    }
  }

  function stopMetricsRefresh() {
    if (metricsRefreshTimer) {
      clearInterval(metricsRefreshTimer)
      metricsRefreshTimer = null
    }
  }

  function startMetricsRefresh() {
    stopMetricsRefresh()
    void loadResourceMetrics(false)
    metricsRefreshTimer = setInterval(() => void loadResourceMetrics(true), 60_000)
  }

  function handleRefresh() {
    void loadResourceMetrics(false)
  }

  function closeDrawer() {
    visible.value = false
  }

  watch(
    () => [visible.value, props.cluster?.name] as const,
    ([open, clusterName]) => {
      if (open && clusterName) {
        startMetricsRefresh()
      } else {
        stopMetricsRefresh()
        resetResourceCharts()
      }
    }
  )

  onUnmounted(() => stopMetricsRefresh())
</script>

<style scoped>
  .cluster-monitor-drawer {
    font-size: 12px;
  }

  .cluster-monitor-drawer :deep(.el-drawer__header) {
    margin-bottom: 0;
    padding-top: 16px;
    padding-bottom: 0;
  }

  .cluster-monitor-drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding-right: 4px;
  }

  .cluster-monitor-drawer-title {
    font-size: 14px;
    font-weight: 500;
    line-height: 1.2;
    color: var(--el-text-color-primary);
  }

  .cluster-monitor-drawer-actions {
    display: flex;
    align-items: center;
    gap: 0;
  }

  .cluster-monitor-drawer-actions .cluster-monitor-drawer-icon-btn + .cluster-monitor-drawer-icon-btn {
    margin-left: -4px;
  }

  .cluster-monitor-drawer-icon-btn {
    width: 32px;
    height: 32px;
    padding: 0;
    color: var(--el-text-color-regular);
  }

  .cluster-monitor-drawer-icon-btn:hover {
    color: var(--el-text-color-primary);
  }

  .cluster-monitor-drawer :deep(.el-drawer) {
    display: flex;
    flex-direction: column;
  }

  .cluster-monitor-drawer :deep(.el-drawer__body) {
    flex: 1;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    padding-top: 0;
  }

  .resource-metrics-pane {
    min-height: 120px;
    padding-bottom: 16px;
    margin-top: -20px;
  }

  .resource-metrics-pane > .tab-section-title:first-child {
    margin-top: 0;
  }

  .tab-section-title {
    margin: 0 0 12px;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.5;
    color: var(--el-text-color-primary);
  }

  .tab-section-title--spaced {
    margin-top: 20px;
  }

  .chart-panel :deep(text) {
    font-size: 12px;
  }

  .chart-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .chart-panel {
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    padding: 16px;
    background: var(--el-bg-color);
  }

  .panel-header {
    margin-bottom: 8px;
  }

  .panel-title {
    font-size: 12px;
    font-weight: 500;
    color: var(--el-text-color-primary);
  }
</style>

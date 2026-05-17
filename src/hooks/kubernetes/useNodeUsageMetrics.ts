import { type ComputedRef, type Ref, computed, ref, unref } from 'vue'
import {
  aggregateDashboardMetricPoints,
  bytesToGib,
  fetchNodeUsageMetrics,
  parseNodeCpuMillicores,
  parseNodeMemoryBytes
} from '@/api/kubernetes/metrics'
import type { K8sNode } from '@/api/kubernetes/node'
import type { ClusterMetricChartItem } from '@/hooks/kubernetes/useClusterNodesUsageMetrics'

const CPU_METRIC_TITLES = ['CPU 总配置（核）', 'CPU 利用率（%）', 'CPU 使用量（核）'] as const
const MEMORY_METRIC_TITLES = ['内存总量（GB）', '内存使用率（%）', '内存使用量（GB）'] as const

function createMetricCharts(titles: readonly string[]): ClusterMetricChartItem[] {
  return titles.map((title) => ({ title, data: [] }))
}

/**
 * 单节点 CPU/内存时序指标（dashboard nodes/{nodeName}/metrics API）
 */
export function useNodeUsageMetrics(
  clusterName: Ref<string> | ComputedRef<string>,
  nodeName: Ref<string> | ComputedRef<string>,
  node: Ref<K8sNode | null> | ComputedRef<K8sNode | null>
) {
  const cluster = computed(() => String(unref(clusterName) || '').trim())
  const nodeKey = computed(() => String(unref(nodeName) || '').trim())

  const loading = ref(false)
  const chartReady = ref(false)
  const cpuTimeLabels = ref<string[]>([])
  const memoryTimeLabels = ref<string[]>([])
  const cpuMetrics = ref<ClusterMetricChartItem[]>(createMetricCharts(CPU_METRIC_TITLES))
  const memoryMetrics = ref<ClusterMetricChartItem[]>(createMetricCharts(MEMORY_METRIC_TITLES))

  let refreshTimer: ReturnType<typeof setInterval> | null = null

  function resetCharts() {
    chartReady.value = false
    cpuTimeLabels.value = []
    memoryTimeLabels.value = []
    for (const item of cpuMetrics.value) item.data = []
    for (const item of memoryMetrics.value) item.data = []
  }

  function getNodeCapacity() {
    const n = unref(node)
    const totalMillic = parseNodeCpuMillicores(
      n?.status?.capacity?.cpu ?? n?.status?.allocatable?.cpu
    )
    const totalCores = totalMillic > 0 ? +(totalMillic / 1000).toFixed(2) : 0
    const totalMemoryBytes = parseNodeMemoryBytes(
      n?.status?.capacity?.memory ?? n?.status?.allocatable?.memory
    )
    return { totalMillic, totalCores, totalMemoryBytes }
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

  async function load(silent = false) {
    const clusterId = cluster.value
    const name = nodeKey.value
    if (!clusterId || !name) {
      resetCharts()
      return
    }

    if (!silent) loading.value = true
    try {
      const { totalMillic, totalCores, totalMemoryBytes } = getNodeCapacity()

      const [cpuRes, memRes] = await Promise.all([
        fetchNodeUsageMetrics(clusterId, name, 'cpu', 'usage'),
        fetchNodeUsageMetrics(clusterId, name, 'memory', 'usage')
      ])
      const cpuAgg = aggregateDashboardMetricPoints(cpuRes.items)
      const memAgg = aggregateDashboardMetricPoints(memRes.items)

      if (!cpuAgg.labels.length && !memAgg.labels.length) {
        if (!silent) resetCharts()
        return
      }

      if (cpuAgg.labels.length) {
        applyCpuChartData(cpuAgg.labels, totalCores, totalMillic, cpuAgg.values)
      }
      if (memAgg.labels.length) {
        applyMemoryChartData(memAgg.labels, totalMemoryBytes, memAgg.values)
      }
      chartReady.value = true
    } catch {
      if (!silent) resetCharts()
    } finally {
      if (!silent) loading.value = false
    }
  }

  function stopRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
  }

  function startRefresh() {
    stopRefresh()
    void load(false)
    refreshTimer = setInterval(() => void load(true), 60_000)
  }

  function refresh() {
    return load(true)
  }

  return {
    loading,
    chartReady,
    cpuTimeLabels,
    memoryTimeLabels,
    cpuMetrics,
    memoryMetrics,
    load,
    refresh,
    startRefresh,
    stopRefresh,
    resetCharts
  }
}

import { type ComputedRef, type Ref, computed, ref, unref } from 'vue'
import {
  aggregateDashboardMetricPoints,
  bytesToGib,
  fetchNodesUsageMetrics,
  parseNodeCpuMillicores,
  parseNodeMemoryBytes
} from '@/api/kubernetes/metrics'
import { fetchKubeListAll } from '@/api/kubernetes/list'
import type { K8sNode } from '@/api/kubernetes/node'
import type { MetricsGranularityOption } from '@/utils/metrics/granularity'
import type { MetricsTimeRange } from '@/utils/metrics/time-range'

export type ClusterMetricChartItem = { title: string; data: number[] }

const CPU_METRIC_TITLES = ['CPU 总配置（核）', 'CPU 利用率（%）', 'CPU 使用量（核）'] as const
const MEMORY_METRIC_TITLES = ['内存总量（GB）', '内存使用率（%）', '内存使用量（GB）'] as const

function createMetricCharts(titles: readonly string[]): ClusterMetricChartItem[] {
  return titles.map((title) => ({ title, data: [] }))
}

/**
 * 集群节点 CPU/内存时序指标（与 cluster-monitor 抽屉同源：nodes + metrics.pixiu.io dashboard API）
 */
export function useClusterNodesUsageMetrics(
  clusterName: Ref<string> | ComputedRef<string>,
  timeRange?: Ref<MetricsTimeRange> | ComputedRef<MetricsTimeRange>,
  granularity?: Ref<MetricsGranularityOption> | ComputedRef<MetricsGranularityOption>
) {
  const cluster = computed(() => String(unref(clusterName) || '').trim())
  const metricsTimeRange = computed(() => unref(timeRange))
  const metricsGranularity = computed(() => unref(granularity))

  const loading = ref(false)
  const chartReady = ref(false)
  const cpuTimeLabels = ref<string[]>([])
  const memoryTimeLabels = ref<string[]>([])
  const cpuMetrics = ref<ClusterMetricChartItem[]>(createMetricCharts(CPU_METRIC_TITLES))
  const memoryMetrics = ref<ClusterMetricChartItem[]>(createMetricCharts(MEMORY_METRIC_TITLES))

  const cpuUtilPercent = computed(() => cpuMetrics.value[1]?.data ?? [])
  const cpuUsageCores = computed(() => cpuMetrics.value[2]?.data ?? [])
  const memUtilPercent = computed(() => memoryMetrics.value[1]?.data ?? [])
  const memUsageGib = computed(() => memoryMetrics.value[2]?.data ?? [])

  let refreshTimer: ReturnType<typeof setInterval> | null = null

  function resetCharts() {
    chartReady.value = false
    cpuTimeLabels.value = []
    memoryTimeLabels.value = []
    for (const item of cpuMetrics.value) item.data = []
    for (const item of memoryMetrics.value) item.data = []
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

  function applyGranularity(
    labels: string[],
    timestamps: number[],
    values: number[]
  ): { labels: string[]; values: number[] } {
    const stepMs = metricsGranularity.value?.stepMs ?? 0
    if (stepMs <= 0 || timestamps.length <= 2 || labels.length !== timestamps.length) {
      return { labels, values }
    }
    const pickIndexes: number[] = [0]
    let lastTs = timestamps[0]
    for (let i = 1; i < timestamps.length - 1; i++) {
      const ts = timestamps[i]
      if (ts - lastTs >= stepMs) {
        pickIndexes.push(i)
        lastTs = ts
      }
    }
    const lastIndex = timestamps.length - 1
    if (pickIndexes[pickIndexes.length - 1] !== lastIndex) pickIndexes.push(lastIndex)
    return {
      labels: pickIndexes.map((i) => labels[i]),
      values: pickIndexes.map((i) => values[i])
    }
  }

  async function load(silent = false) {
    const name = cluster.value
    if (!name) {
      resetCharts()
      return
    }

    if (!silent) loading.value = true
    try {
      const nodes = await fetchKubeListAll<K8sNode>({
        path: `/pixiu/proxy/${encodeURIComponent(name)}/api/v1/nodes`
      })
      const nodeNames = nodes
        .map((n) => n.metadata?.name)
        .filter((nodeName): nodeName is string => Boolean(nodeName))

      if (!nodeNames.length) {
        if (!silent) resetCharts()
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
        fetchNodesUsageMetrics(name, nodeNames, 'cpu', 'usage'),
        fetchNodesUsageMetrics(name, nodeNames, 'memory', 'usage')
      ])
      const cpuAgg = aggregateDashboardMetricPoints(cpuRes.items, {
        timeRange: metricsTimeRange.value
      })
      const memAgg = aggregateDashboardMetricPoints(memRes.items, {
        timeRange: metricsTimeRange.value
      })

      if (!cpuAgg.labels.length && !memAgg.labels.length) {
        if (!silent) resetCharts()
        return
      }

      if (cpuAgg.labels.length) {
        const sampled = applyGranularity(cpuAgg.labels, cpuAgg.timestamps, cpuAgg.values)
        applyCpuChartData(sampled.labels, totalCores, totalMillic, sampled.values)
      }
      if (memAgg.labels.length) {
        const sampled = applyGranularity(memAgg.labels, memAgg.timestamps, memAgg.values)
        applyMemoryChartData(sampled.labels, totalMemoryBytes, sampled.values)
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

  function startRefresh(intervalMs = 60_000) {
    stopRefresh()
    void load(false)
    if (intervalMs > 0) {
      refreshTimer = setInterval(() => void load(true), intervalMs)
    }
  }

  /** 手动刷新：静默拉数（不整页 loading），返回 Promise 供调用方触发图表重绘动画 */
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
    cpuUtilPercent,
    cpuUsageCores,
    memUtilPercent,
    memUsageGib,
    load,
    refresh,
    startRefresh,
    stopRefresh,
    resetCharts
  }
}

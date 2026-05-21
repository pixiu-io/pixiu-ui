import { type ComputedRef, type Ref, computed, ref, unref } from 'vue'
import { kubeProxyAxios } from '@/api/kubeProxy'
import { fetchK8sPod, type K8sPod } from '@/api/kubernetes/pod'
import {
  alignPodMetricSeries,
  bytesToGib,
  fetchPodsUsageMetrics,
  getPodCpuQuotaMillicores,
  getPodMemoryQuotaBytes,
  splitDashboardPodMetricPoints,
  type MetricsPodSpec
} from '@/api/kubernetes/metrics'
import type { LineDataItem } from '@/types/component/chart'

const CPU_METRIC_TITLES = ['CPU 总配置（核）', 'CPU 利用率（%）', 'CPU 使用量（核）'] as const
const MEMORY_METRIC_TITLES = ['内存总量（GB）', '内存使用率（%）', '内存使用量（GB）'] as const

export type WorkloadMetricChartItem = {
  title: string
  data: number[] | LineDataItem[]
}

function createMetricCharts(titles: readonly string[]): WorkloadMetricChartItem[] {
  return titles.map((title) => ({ title, data: [] }))
}

export function isMultiSeriesData(data: number[] | LineDataItem[]): data is LineDataItem[] {
  return Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && 'name' in data[0]
}

function mapSeriesValues(
  series: LineDataItem[],
  mapper: (value: number) => number
): LineDataItem[] {
  return series.map((item) => ({
    ...item,
    data: item.data.map((v) => (v == null || Number.isNaN(v) ? v : mapper(v)))
  }))
}

function buildUtilizationSeries(
  usageSeries: LineDataItem[],
  quota: number,
  toPercent: (usage: number) => number
): LineDataItem[] {
  if (quota <= 0) {
    return usageSeries.map((item) => ({
      ...item,
      data: item.data.map(() => 0)
    }))
  }
  return usageSeries.map((item) => ({
    ...item,
    data: item.data.map((v) =>
      v == null || Number.isNaN(v) ? v : +toPercent(v).toFixed(2)
    )
  }))
}

async function fetchWorkloadPods(
  cluster: string,
  namespace: string,
  labelSelector: string
): Promise<K8sPod[]> {
  const path = `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(namespace)}/pods`
  const query: Record<string, unknown> = { limit: 500 }
  if (labelSelector.trim()) query.labelSelector = labelSelector.trim()
  const { data } = await kubeProxyAxios.get<{ items?: K8sPod[] }>(path, { params: query })
  return data.items ?? []
}

/**
 * Workload 下多 Pod CPU/内存时序（pod-list 逗号拼接一次请求，每 Pod 一条折线）
 */
export function useWorkloadPodsUsageMetrics(
  clusterName: Ref<string> | ComputedRef<string>,
  namespace: Ref<string> | ComputedRef<string>,
  labelSelector: Ref<string> | ComputedRef<string>,
  /** 固定 Pod 列表（如 Pod 详情单 Pod）；有值时忽略 labelSelector */
  fixedPodNames?: Ref<string[]> | ComputedRef<string[]>
) {
  const cluster = computed(() => String(unref(clusterName) || '').trim())
  const ns = computed(() => String(unref(namespace) || '').trim())
  const selector = computed(() => String(unref(labelSelector) || '').trim())
  const podNamesOverride = computed(() => {
    const raw = unref(fixedPodNames)
    return Array.isArray(raw) ? raw.map((n) => String(n).trim()).filter(Boolean) : []
  })

  const loading = ref(false)
  const chartReady = ref(false)
  const podNames = ref<string[]>([])
  const cpuTimeLabels = ref<string[]>([])
  const memoryTimeLabels = ref<string[]>([])
  const cpuMetrics = ref<WorkloadMetricChartItem[]>(createMetricCharts(CPU_METRIC_TITLES))
  const memoryMetrics = ref<WorkloadMetricChartItem[]>(createMetricCharts(MEMORY_METRIC_TITLES))

  const podQuotaMap = ref<Map<string, { cpuMillic: number; memoryBytes: number }>>(new Map())

  let refreshTimer: ReturnType<typeof setInterval> | null = null

  function resetCharts() {
    chartReady.value = false
    podNames.value = []
    cpuTimeLabels.value = []
    memoryTimeLabels.value = []
    podQuotaMap.value = new Map()
    for (const item of cpuMetrics.value) item.data = []
    for (const item of memoryMetrics.value) item.data = []
  }

  async function resolvePods(): Promise<MetricsPodSpec[]> {
    const override = podNamesOverride.value
    if (override.length) {
      const results = await Promise.all(
        override.map((name) =>
          fetchK8sPod(cluster.value, ns.value, name).catch(() => null)
        )
      )
      return results.filter(Boolean) as any[]
    }
    if (!selector.value) return []
    return fetchWorkloadPods(cluster.value, ns.value, selector.value) as any
  }

  function applyCpuCharts(labels: string[], usageSeries: LineDataItem[]) {
    cpuTimeLabels.value = labels
    const quotaByPod = podQuotaMap.value
    cpuMetrics.value[0].data = usageSeries.map((s) => {
      const millic = quotaByPod.get(s.name)?.cpuMillic ?? 0
      const cores = millic > 0 ? +(millic / 1000).toFixed(2) : 0
      return { ...s, data: s.data.map((v) => (v == null ? v : cores)) }
    })
    cpuMetrics.value[1].data = usageSeries.map((s) => {
      const millic = quotaByPod.get(s.name)?.cpuMillic ?? 0
      return buildUtilizationSeries([s], millic, (v) => (millic > 0 ? (v / millic) * 100 : 0))[0]
    })
    cpuMetrics.value[2].data = mapSeriesValues(usageSeries, (v) => +(v / 1000).toFixed(2))
  }

  function applyMemoryCharts(labels: string[], usageSeries: LineDataItem[]) {
    memoryTimeLabels.value = labels
    const quotaByPod = podQuotaMap.value
    memoryMetrics.value[0].data = usageSeries.map((s) => {
      const bytes = quotaByPod.get(s.name)?.memoryBytes ?? 0
      const gib = bytesToGib(bytes)
      return { ...s, data: s.data.map((v) => (v == null ? v : gib)) }
    })
    memoryMetrics.value[1].data = usageSeries.map((s) => {
      const bytes = quotaByPod.get(s.name)?.memoryBytes ?? 0
      return buildUtilizationSeries([s], bytes, (v) => (bytes > 0 ? (v / bytes) * 100 : 0))[0]
    })
    memoryMetrics.value[2].data = mapSeriesValues(usageSeries, (v) => bytesToGib(v))
  }

  async function load(silent = false) {
    const clusterId = cluster.value
    const namespace = ns.value
    if (!clusterId || !namespace) {
      resetCharts()
      return
    }

    if (!silent) loading.value = true
    try {
      const pods = await resolvePods()
      const names = pods
        .map((p) => p.metadata?.name ?? '')
        .filter(Boolean)
        .sort()
      podNames.value = names

      const quota = new Map<string, { cpuMillic: number; memoryBytes: number }>()
      for (const p of pods) {
        const name = p.metadata?.name
        if (!name) continue
        quota.set(name, {
          cpuMillic: getPodCpuQuotaMillicores(p),
          memoryBytes: getPodMemoryQuotaBytes(p)
        })
      }
      podQuotaMap.value = quota

      if (!names.length) {
        if (!silent) resetCharts()
        return
      }

      const [cpuRes, memRes] = await Promise.all([
        fetchPodsUsageMetrics(clusterId, namespace, names, 'cpu', 'usage'),
        fetchPodsUsageMetrics(clusterId, namespace, names, 'memory', 'usage')
      ])

      const cpuMaps = splitDashboardPodMetricPoints(cpuRes.items)
      const memMaps = splitDashboardPodMetricPoints(memRes.items)

      const cpuAligned = alignPodMetricSeries(cpuMaps, names)
      const memAligned = alignPodMetricSeries(memMaps, names)

      if (cpuAligned.labels.length) {
        applyCpuCharts(cpuAligned.labels, cpuAligned.series)
      } else {
        cpuTimeLabels.value = []
        for (const item of cpuMetrics.value) item.data = []
      }

      if (memAligned.labels.length) {
        applyMemoryCharts(memAligned.labels, memAligned.series)
      } else {
        memoryTimeLabels.value = []
        for (const item of memoryMetrics.value) item.data = []
      }

      chartReady.value = cpuAligned.labels.length > 0 || memAligned.labels.length > 0
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
    podNames,
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

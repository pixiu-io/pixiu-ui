import { type ComputedRef, type Ref, computed, ref, unref, watch } from 'vue'
import { kubeProxyAxios } from '@/api/kubeProxy'
import { fetchK8sPod, type K8sPod } from '@/api/kubernetes/pod'
import { fetchDashboardQuery, type DashboardPanelResult } from '@/api/dashboard'
import {
  bytesToGib,
  getPodCpuQuotaMillicores,
  getPodMemoryQuotaBytes,
  type MetricsPodSpec
} from '@/api/kubernetes/metrics'
import type { LineDataItem } from '@/types/component/chart'
import { loadPrometheusDatasource } from '@/utils/datasource/prometheus-datasource'
import { METRICS_TIME_PRESETS, type MetricsTimeRange } from '@/utils/metrics/time-range'

const CPU_METRIC_TITLES = ['CPU 总配置（核）', 'CPU 利用率（%）', 'CPU 使用量（核）'] as const
const MEMORY_METRIC_TITLES = ['内存总量（GB）', '内存使用率（%）', '内存使用量（GB）'] as const

const POD_PANEL_IDS = ['pod.cpu_usage_trend', 'pod.memory_usage_trend'] as const

const TWENTY_FOUR_HOURS_SECONDS = 24 * 60 * 60

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
    data: item.data.map((v) => (v == null || Number.isNaN(v) ? v : +toPercent(v).toFixed(2)))
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

function round(value: number, digits: number): number {
  return Number.isFinite(value) ? +value.toFixed(digits) : 0
}

function toTimeLabel(timestamp: number): string {
  const d = new Date(timestamp * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 将 Prometheus 逐 Pod 折线系列对齐到指定 Pod 顺序：
 * series 缺 Pod（当前窗口无该 Pod 样本）时补全为全 null 序列，保证折线数量与 Pod 数一致。
 */
function buildAlignedPodSeries(
  result: DashboardPanelResult,
  podOrder: string[]
): { labels: string[]; series: LineDataItem[] } {
  const byPod = new Map<string, LineDataItem>()
  for (const s of result.series ?? []) {
    const pod = s.metric.pod ?? ''
    if (!pod) continue
    byPod.set(pod, {
      name: pod,
      data: s.values.map((p) => Number(p.value))
    })
  }
  const labels = result.series?.[0]?.values.map((p) => toTimeLabel(p.timestamp)) ?? []
  const series: LineDataItem[] = []
  for (const podName of podOrder) {
    const item = byPod.get(podName)
    series.push(item ?? { name: podName, data: labels.map(() => null as unknown as number) })
  }
  return { labels, series }
}

/**
 * Workload 下多 Pod CPU/内存时序（Prometheus 数据源，每 Pod 一条折线）
 *
 * Pod 列表（labelSelector / fixedPodNames）仍从 K8s API 解析，用量从 Prometheus 拉取：
 * pod.cpu_usage_trend（核）/ pod.memory_usage_trend（字节）按 pod label 聚合。
 * 总配置（CPU/内存 quota）来自 Pod spec，利用率 = 用量 / quota 回算。
 */
export function useWorkloadPodsUsageMetrics(
  clusterName: Ref<string> | ComputedRef<string>,
  namespace: Ref<string> | ComputedRef<string>,
  labelSelector: Ref<string> | ComputedRef<string>,
  /** 固定 Pod 列表（如 Pod 详情单 Pod）；有值时忽略 labelSelector */
  fixedPodNames?: Ref<string[]> | ComputedRef<string[]>,
  /** 时间范围（最大化弹窗内选择器调整）；未传时固定近 24h */
  timeRange?: Ref<MetricsTimeRange> | ComputedRef<MetricsTimeRange>
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

  /**
   * 时间范围归一化：相对 preset（如 24h/7d）以当前时间重算，保证自动刷新时时间窗滑动；
   * custom/yesterday 用传入值；未传 timeRange 时固定回退近 24 小时。
   * 返回秒级 [start, end]。
   */
  function normalizedTimeRange(): { start: number; end: number } {
    if (!timeRange) {
      const end = Math.floor(Date.now() / 1000)
      return { start: end - TWENTY_FOUR_HOURS_SECONDS, end }
    }
    const range = unref(timeRange)
    const preset = METRICS_TIME_PRESETS.find((item) => item.key === range.presetKey)
    if (!preset || range.presetKey === 'custom' || range.presetKey === 'yesterday') {
      return {
        start: Math.floor(range.start.getTime() / 1000),
        end: Math.floor(range.end.getTime() / 1000)
      }
    }
    const normalized = preset.getRange(new Date())
    return {
      start: Math.floor(normalized.start.getTime() / 1000),
      end: Math.floor(normalized.end.getTime() / 1000)
    }
  }

  async function resolvePods(): Promise<MetricsPodSpec[]> {
    const override = podNamesOverride.value
    if (override.length) {
      const results = await Promise.all(
        override.map((name) => fetchK8sPod(cluster.value, ns.value, name).catch(() => null))
      )
      return results.filter(Boolean) as any[]
    }
    if (!selector.value) return []
    return fetchWorkloadPods(cluster.value, ns.value, selector.value) as any
  }

  /** usageSeries 单位：核（Prometheus rate）；总配置/利用率按 Pod quota 回算 */
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
      const cores = millic > 0 ? millic / 1000 : 0
      return buildUtilizationSeries([s], cores, (v) => (cores > 0 ? (v / cores) * 100 : 0))[0]
    })
    cpuMetrics.value[2].data = mapSeriesValues(usageSeries, (v) => round(v, 2))
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

      const datasource = await loadPrometheusDatasource(clusterId)
      if (!datasource) {
        if (!silent) resetCharts()
        return
      }

      const { start, end } = normalizedTimeRange()
      const durationSeconds = Math.max(1, end - start)
      const step = Math.max(60, Math.ceil(durationSeconds / 600))

      let cpuResult: DashboardPanelResult | undefined
      let memResult: DashboardPanelResult | undefined
      let panelIndex = 0
      const workerCount = Math.min(6, POD_PANEL_IDS.length)
      const workers = Array.from({ length: workerCount }, async () => {
        while (panelIndex < POD_PANEL_IDS.length) {
          const panelId = POD_PANEL_IDS[panelIndex]
          panelIndex += 1
          try {
            const response = await fetchDashboardQuery(datasource, {
              panelIds: [panelId],
              start,
              end,
              step,
              filters: { namespace, pod: names.join(',') }
            })
            const result = response.results[0]
            if (result?.id === 'pod.cpu_usage_trend') cpuResult = result
            else if (result?.id === 'pod.memory_usage_trend') memResult = result
          } catch {
            /* 单个面板失败不影响其他卡 */
          }
        }
      })
      await Promise.all(workers)

      if (cpuResult) {
        const aligned = buildAlignedPodSeries(cpuResult, names)
        if (aligned.labels.length) {
          applyCpuCharts(aligned.labels, aligned.series)
        } else {
          cpuTimeLabels.value = []
          for (const item of cpuMetrics.value) item.data = []
        }
      } else {
        cpuTimeLabels.value = []
        for (const item of cpuMetrics.value) item.data = []
      }

      if (memResult) {
        const aligned = buildAlignedPodSeries(memResult, names)
        if (aligned.labels.length) {
          applyMemoryCharts(aligned.labels, aligned.series)
        } else {
          memoryTimeLabels.value = []
          for (const item of memoryMetrics.value) item.data = []
        }
      } else {
        memoryTimeLabels.value = []
        for (const item of memoryMetrics.value) item.data = []
      }

      chartReady.value = cpuTimeLabels.value.length > 0 || memoryTimeLabels.value.length > 0
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

  // 时间范围调整（最大化弹窗内选择器）时静默重新查询
  if (timeRange) {
    watch(timeRange, () => {
      void load(true)
    })
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

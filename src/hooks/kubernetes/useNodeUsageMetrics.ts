import { type ComputedRef, type Ref, computed, ref, unref, watch } from 'vue'
import { fetchDashboardQuery, type DashboardPanelResult } from '@/api/dashboard'
import { bytesToGib, parseNodeCpuMillicores, parseNodeMemoryBytes } from '@/api/kubernetes/metrics'
import type { K8sNode } from '@/api/kubernetes/node'
import { loadPrometheusDatasource } from '@/utils/datasource/prometheus-datasource'
import { METRICS_TIME_PRESETS, type MetricsTimeRange } from '@/utils/metrics/time-range'

const CPU_METRIC_TITLES = ['CPU 总配置（核）', 'CPU 利用率（%）', 'CPU 使用量（核）'] as const
const MEMORY_METRIC_TITLES = ['内存总量（GB）', '内存使用率（%）', '内存使用量（GB）'] as const

const NODE_USAGE_PANEL_IDS = ['node.cpu_usage_trend', 'node.memory_usage_trend'] as const

const TWENTY_FOUR_HOURS_SECONDS = 24 * 60 * 60

type NodeMetricChartItem = { title: string; data: number[] }

function createMetricCharts(titles: readonly string[]): NodeMetricChartItem[] {
  return titles.map((title) => ({ title, data: [] }))
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
 * 单节点 CPU/内存时序（Prometheus 数据源）。
 * 总配置/总量从 node 对象 status.allocatable 解析（与节点详情资源卡片一致），
 * 用量来自 cAdvisor（container_* 按 node label 匹配）；
 * 利用率=用量/总量在 hook 内计算，不依赖 node_exporter。
 */
export function useNodeUsageMetrics(
  clusterName: Ref<string> | ComputedRef<string>,
  nodeName: Ref<string> | ComputedRef<string>,
  /** 节点对象（异步加载），其 status.allocatable 提供 CPU 总配置/内存总量 */
  node: Ref<K8sNode | null> | ComputedRef<K8sNode | null>,
  /** 时间范围（最大化弹窗内选择器调整）；未传时固定近 24h */
  timeRange?: Ref<MetricsTimeRange> | ComputedRef<MetricsTimeRange>
) {
  const cluster = computed(() => String(unref(clusterName) || '').trim())
  const nodeKey = computed(() => String(unref(nodeName) || '').trim())

  const loading = ref(false)
  const chartReady = ref(false)
  const cpuTimeLabels = ref<string[]>([])
  const memoryTimeLabels = ref<string[]>([])
  const cpuMetrics = ref<NodeMetricChartItem[]>(createMetricCharts(CPU_METRIC_TITLES))
  const memoryMetrics = ref<NodeMetricChartItem[]>(createMetricCharts(MEMORY_METRIC_TITLES))

  let refreshTimer: ReturnType<typeof setInterval> | null = null

  function resetCharts() {
    chartReady.value = false
    cpuTimeLabels.value = []
    memoryTimeLabels.value = []
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

  async function load(silent = false) {
    const clusterId = cluster.value
    const name = nodeKey.value
    if (!clusterId || !name) {
      resetCharts()
      return
    }

    if (!silent) loading.value = true
    try {
      // 总配置/总量来自 node 对象 allocatable（单位：CPU 核 / 内存字节）
      const n = unref(node)
      const totalCores = parseNodeCpuMillicores(String(n?.status?.allocatable?.cpu)) / 1000
      const totalMemoryBytes = parseNodeMemoryBytes(n?.status?.allocatable?.memory)

      const datasource = await loadPrometheusDatasource(clusterId)
      if (!datasource) {
        if (!silent) resetCharts()
        return
      }

      const { start, end } = normalizedTimeRange()
      const durationSeconds = Math.max(1, end - start)
      // 无粒度选择：step 控制返回点位数不过密（约 600 点/窗口）
      const step = Math.max(60, Math.ceil(durationSeconds / 600))

      // 逐面板查询：并发 2，收集 CPU/内存用量面板结果后统一渲染
      let cpuResult: DashboardPanelResult | undefined
      let memResult: DashboardPanelResult | undefined
      let panelIndex = 0
      const workerCount = Math.min(2, NODE_USAGE_PANEL_IDS.length)
      const workers = Array.from({ length: workerCount }, async () => {
        while (panelIndex < NODE_USAGE_PANEL_IDS.length) {
          const panelId = NODE_USAGE_PANEL_IDS[panelIndex]
          panelIndex += 1
          try {
            const response = await fetchDashboardQuery(datasource, {
              panelIds: [panelId],
              start,
              end,
              step,
              filters: { node: name }
            })
            const result = response.results[0]
            if (result?.id === 'node.cpu_usage_trend') cpuResult = result
            else if (result?.id === 'node.memory_usage_trend') memResult = result
          } catch {
            /* 单个面板失败不影响其他卡 */
          }
        }
      })
      await Promise.all(workers)

      // CPU：总配置来自 allocatable（常量线），利用率 = 用量 / 总配置
      if (cpuResult) {
        const values = cpuResult.series?.[0]?.values ?? []
        if (values.length) {
          cpuTimeLabels.value = values.map((p) => toTimeLabel(p.timestamp))
          cpuMetrics.value[0].data = totalCores > 0 ? values.map(() => round(totalCores, 2)) : []
          cpuMetrics.value[1].data =
            totalCores > 0 ? values.map((p) => round((Number(p.value) / totalCores) * 100, 2)) : []
          cpuMetrics.value[2].data = values.map((p) => round(Number(p.value), 2))
        } else {
          cpuTimeLabels.value = []
          for (const item of cpuMetrics.value) item.data = []
        }
      } else {
        cpuTimeLabels.value = []
        for (const item of cpuMetrics.value) item.data = []
      }

      // 内存：总量来自 allocatable（常量线），利用率 = 用量 / 总量
      if (memResult) {
        const values = memResult.series?.[0]?.values ?? []
        if (values.length) {
          memoryTimeLabels.value = values.map((p) => toTimeLabel(p.timestamp))
          memoryMetrics.value[0].data =
            totalMemoryBytes > 0 ? values.map(() => round(bytesToGib(totalMemoryBytes), 2)) : []
          memoryMetrics.value[1].data =
            totalMemoryBytes > 0
              ? values.map((p) => round((Number(p.value) / totalMemoryBytes) * 100, 2))
              : []
          memoryMetrics.value[2].data = values.map((p) => bytesToGib(Number(p.value)))
        } else {
          memoryTimeLabels.value = []
          for (const item of memoryMetrics.value) item.data = []
        }
      } else {
        memoryTimeLabels.value = []
        for (const item of memoryMetrics.value) item.data = []
      }

      const hasCpuData = cpuMetrics.value.some((item) => item.data.length > 0)
      const hasMemoryData = memoryMetrics.value.some((item) => item.data.length > 0)
      if (!hasCpuData && !hasMemoryData) {
        if (!silent) resetCharts()
        return
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

  // 时间范围调整（最大化弹窗内选择器）时静默重新查询
  if (timeRange) {
    watch(timeRange, () => {
      void load(true)
    })
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

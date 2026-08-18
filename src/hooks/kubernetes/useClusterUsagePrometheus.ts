import { type ComputedRef, type Ref, computed, ref, unref, watch } from 'vue'
import { fetchDashboardQuery, type DashboardPanelResult } from '@/api/dashboard'
import { loadPrometheusDatasource } from '@/utils/datasource/prometheus-datasource'
import { METRICS_TIME_PRESETS, type MetricsTimeRange } from '@/utils/metrics/time-range'

/**
 * 集群概览用量数据（Prometheus 数据源）
 *
 * 用量趋势（近 24h，4 张折线）与用量情况（6 个指标饼图）统一从 Prometheus 拉取，
 * 取代原先 metrics.pixiu.io 接口（useClusterNodesUsageMetrics / useClusterRequestCommitment）。
 * 未关联 Prometheus 数据源时暴露 datasourceMissing=true，由调用方展示空态引导。
 */
const TREND_PANEL_IDS = [
  'cluster.cpu_usage_trend',
  'cluster.memory_usage_trend',
  'cluster.cpu_usage_cores_trend',
  'cluster.memory_usage_bytes_trend',
  'cluster.memory_usage_bytes_with_cache_trend',
  'cluster.cpu_total_trend',
  'cluster.memory_total_trend'
] as const
const GAUGE_PANEL_IDS = [
  'cluster.cpu_usage',
  'cluster.memory_usage',
  'cluster.cpu_requests'
] as const
const ALL_PANEL_IDS = [...TREND_PANEL_IDS, ...GAUGE_PANEL_IDS]

const TWENTY_FOUR_HOURS_SECONDS = 24 * 60 * 60

function round(value: number, digits: number): number {
  return Number.isFinite(value) ? +value.toFixed(digits) : 0
}

function toTimeLabel(timestamp: number): string {
  const d = new Date(timestamp * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function seriesValues(result: DashboardPanelResult | undefined) {
  return result?.series?.[0]?.values ?? []
}

function lastSeriesValue(result: DashboardPanelResult | undefined): number {
  const values = seriesValues(result)
  const point = values[values.length - 1]
  const n = Number(point?.value)
  return Number.isFinite(n) ? n : 0
}

export function useClusterUsagePrometheus(
  clusterName: Ref<string> | ComputedRef<string>,
  timeRange?: Ref<MetricsTimeRange> | ComputedRef<MetricsTimeRange>
) {
  const cluster = computed(() => String(unref(clusterName) || '').trim())

  const loading = ref(false)
  const chartReady = ref(false)
  /** 当前集群未关联 Prometheus 数据源（由调用方展示空态） */
  const datasourceMissing = ref(false)
  const cpuTimeLabels = ref<string[]>([])
  const cpuUtilPercent = ref<number[]>([])
  const memUtilPercent = ref<number[]>([])
  const cpuUsageCores = ref<number[]>([])
  const memUsageGib = ref<number[]>([])
  const cpuTotalCores = ref<number[]>([])
  const memTotalGib = ref<number[]>([])
  const memUsageWithCacheGib = ref<number[]>([])
  const memUtilWithCachePercent = ref<number[]>([])
  const cpuGaugeCurrent = ref(0)
  const memGaugeCurrent = ref(0)
  const cpuRequestCommitPercent = ref(0)

  /** 含Cache内存原始字节（面板值），用于内存总量就绪后回算利用率 */
  let memUsageWithCacheBytes: { timestamp: number; value: string }[] = []

  let refreshTimer: ReturnType<typeof setInterval> | null = null

  function resetCharts() {
    chartReady.value = false
    cpuTimeLabels.value = []
    cpuUtilPercent.value = []
    memUtilPercent.value = []
    cpuUsageCores.value = []
    memUsageGib.value = []
    cpuTotalCores.value = []
    memTotalGib.value = []
    memUsageWithCacheGib.value = []
    memUtilWithCachePercent.value = []
    memUsageWithCacheBytes = []
    cpuGaugeCurrent.value = 0
    memGaugeCurrent.value = 0
    cpuRequestCommitPercent.value = 0
  }

  /**
   * 回算内存利用率（含Cache）：含Cache内存字节 / 内存总量 × 100。
   * 依赖 memUsageWithCacheBytes 与 memTotalGib 就绪；任一缺失则置空，待对方面板返回时再补齐。
   */
  function updateMemUtilWithCache() {
    if (!memUsageWithCacheBytes.length || !memTotalGib.value.length) {
      memUtilWithCachePercent.value = []
      return
    }
    memUtilWithCachePercent.value = memUsageWithCacheBytes.map((point, i) => {
      const totalBytes = (memTotalGib.value[i] ?? 0) * 1024 ** 3
      return totalBytes > 0 ? round((Number(point.value) / totalBytes) * 100, 2) : 0
    })
  }

  /** 逐面板应用结果：每个面板返回后立即更新对应卡数据（先返回先显示） */
  function applyPanelResult(result: DashboardPanelResult) {
    const values = seriesValues(result)
    switch (result.id) {
      case 'cluster.cpu_usage_trend':
        cpuTimeLabels.value = values.map((point) => toTimeLabel(point.timestamp))
        cpuUtilPercent.value = values.map((point) => round(Number(point.value), 2))
        break
      case 'cluster.memory_usage_trend':
        memUtilPercent.value = values.map((point) => round(Number(point.value), 2))
        break
      case 'cluster.cpu_usage_cores_trend':
        cpuUsageCores.value = values.map((point) => round(Number(point.value), 2))
        break
      case 'cluster.memory_usage_bytes_trend':
        memUsageGib.value = values.map((point) => round(Number(point.value) / 1024 ** 3, 2))
        break
      case 'cluster.memory_usage_bytes_with_cache_trend':
        memUsageWithCacheBytes = values
        memUsageWithCacheGib.value = values.map((point) =>
          round(Number(point.value) / 1024 ** 3, 2)
        )
        updateMemUtilWithCache()
        break
      case 'cluster.cpu_total_trend':
        cpuTotalCores.value = values.map((point) => round(Number(point.value), 2))
        break
      case 'cluster.memory_total_trend':
        memTotalGib.value = values.map((point) => round(Number(point.value) / 1024 ** 3, 2))
        updateMemUtilWithCache()
        break
      case 'cluster.cpu_usage':
        cpuGaugeCurrent.value = round(lastSeriesValue(result), 2)
        break
      case 'cluster.memory_usage':
        memGaugeCurrent.value = round(lastSeriesValue(result), 2)
        break
      case 'cluster.cpu_requests':
        cpuRequestCommitPercent.value = round(lastSeriesValue(result), 2)
        break
    }
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
    const name = cluster.value
    if (!name) {
      datasourceMissing.value = false
      if (!silent) resetCharts()
      return
    }
    // 数据源缺失时停止静默轮询；非静默（startRefresh 首次 / 手动刷新）仍会重试探测
    if (silent && datasourceMissing.value) return

    if (!silent) loading.value = true
    try {
      const datasource = await loadPrometheusDatasource(name)
      if (!datasource) {
        datasourceMissing.value = true
        if (!silent) resetCharts()
        return
      }
      datasourceMissing.value = false

      const { start, end } = normalizedTimeRange()
      const durationSeconds = Math.max(1, end - start)
      // 用量趋势无粒度选择：step 为秒，控制返回点位数不过密（约 600 点/窗口）
      const step = Math.max(60, Math.ceil(durationSeconds / 600))

      // 逐面板查询：并发 6，每张卡完成后立即更新（先返回先显示，不被慢面板拖累）
      let panelIndex = 0
      const workerCount = Math.min(6, ALL_PANEL_IDS.length)
      const workers = Array.from({ length: workerCount }, async () => {
        while (panelIndex < ALL_PANEL_IDS.length) {
          const panelId = ALL_PANEL_IDS[panelIndex]
          panelIndex += 1
          try {
            const response = await fetchDashboardQuery(datasource, {
              panelIds: [panelId],
              start,
              end,
              step,
              filters: {}
            })
            const result = response.results[0]
            if (result) applyPanelResult(result)
          } catch {
            /* 单个面板失败不影响其他卡 */
          }
        }
      })
      await Promise.all(workers)
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

  // 时间范围调整（最大化弹窗内选择器）时静默重新查询
  if (timeRange) {
    watch(timeRange, () => {
      void load(true)
    })
  }

  return {
    loading,
    chartReady,
    datasourceMissing,
    cpuTimeLabels,
    cpuUtilPercent,
    memUtilPercent,
    cpuUsageCores,
    memUsageGib,
    cpuTotalCores,
    memTotalGib,
    memUsageWithCacheGib,
    memUtilWithCachePercent,
    cpuGaugeCurrent,
    memGaugeCurrent,
    cpuRequestCommitPercent,
    load,
    refresh,
    startRefresh,
    stopRefresh,
    resetCharts
  }
}

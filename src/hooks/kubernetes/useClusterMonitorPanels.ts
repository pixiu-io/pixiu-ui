import { type ComputedRef, type Ref, computed, reactive, ref, unref } from 'vue'
import { fetchDashboardQuery, type DashboardPanelResult } from '@/api/dashboard'
import { loadPrometheusDatasource } from '@/utils/datasource/prometheus-datasource'
import type { MetricsGranularityOption } from '@/utils/metrics/granularity'
import { METRICS_TIME_PRESETS, type MetricsTimeRange } from '@/utils/metrics/time-range'

/** 集群监控抽屉固定展示面板 id（CPU/内存/网络全部指标） */
const ALL_PANEL_IDS = [
  'cluster.cpu_total_trend',
  'cluster.cpu_usage_trend',
  'cluster.cpu_usage_cores_trend',
  'cluster.memory_total_trend',
  'cluster.memory_usage_trend',
  'cluster.memory_usage_bytes_trend',
  'network.transmit_rate_mb_trend',
  'network.receive_rate_mb_trend',
  'network.bandwidth_trend',
  'network.packet_rate_trend',
  'storage.disk_reads_trend',
  'storage.disk_write_bytes_trend',
  'storage.disk_writes_trend',
  'storage.disk_read_bytes_trend'
]

/**
 * 集群监控抽屉面板数据（Prometheus 数据源）
 *
 * 取代原先 metrics.pixiu.io 接口（useClusterNodesUsageMetrics）：固定拉取 CPU/内存/网络
 * 全部 trend 面板，经 fetchDashboardQuery 拉取并缓存到 resultMap，由调用方转成
 * MetricChartPanel 折线卡片渲染。
 * 未关联 Prometheus 数据源时暴露 datasourceMissing=true，由调用方展示空态引导。
 */
export function useClusterMonitorPanels(
  clusterName: Ref<string> | ComputedRef<string>,
  timeRange: Ref<MetricsTimeRange>,
  granularity: Ref<MetricsGranularityOption>
) {
  const cluster = computed(() => String(unref(clusterName) || '').trim())

  const loading = ref(false)
  const chartReady = ref(false)
  /** 当前集群未关联 Prometheus 数据源（由调用方展示空态引导） */
  const datasourceMissing = ref(false)
  /** 面板查询结果，按面板 id 缓存 */
  const resultMap = reactive<Record<string, DashboardPanelResult>>({})

  let refreshTimer: ReturnType<typeof setInterval> | null = null
  let querySequence = 0

  function resetCharts() {
    chartReady.value = false
    for (const key of Object.keys(resultMap)) delete resultMap[key]
  }

  /** 相对时间区间以当前时间重算，保证自动刷新时时间窗滑动 */
  function normalizedTimeRange(): MetricsTimeRange {
    const preset = METRICS_TIME_PRESETS.find((item) => item.key === timeRange.value.presetKey)
    if (
      !preset ||
      timeRange.value.presetKey === 'custom' ||
      timeRange.value.presetKey === 'yesterday'
    ) {
      return timeRange.value
    }
    return preset.getRange(new Date())
  }

  async function load(silent = false) {
    const name = cluster.value
    if (!name) return
    // 数据源缺失时停止静默轮询；非静默（startRefresh 首次 / 手动刷新）仍会重试探测
    if (silent && datasourceMissing.value) return

    const sequence = ++querySequence
    if (!silent) loading.value = true
    try {
      const datasource = await loadPrometheusDatasource(name)
      if (!datasource) {
        datasourceMissing.value = true
        if (!silent) resetCharts()
        return
      }
      datasourceMissing.value = false

      const range = normalizedTimeRange()
      const start = Math.floor(range.start.getTime() / 1000)
      const end = Math.floor(range.end.getTime() / 1000)
      const durationSeconds = Math.max(1, end - start)
      // 与 Prometheus 监控大盘一致：step 取粒度与时间窗抽样上限的较大值，控制返回点位数
      const step = Math.max(
        Math.ceil(granularity.value.stepMs / 1000),
        Math.ceil(durationSeconds / 600)
      )

      // 逐面板查询：并发 6，每张卡完成后立即写入 resultMap（先返回先显示，不被最慢面板拖累）
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
            if (sequence !== querySequence) return
            const result = response.results[0]
            if (result) resultMap[result.id] = result
          } catch {
            /* 单个面板查询失败不影响其他卡 */
          }
        }
      })
      await Promise.all(workers)
      if (sequence !== querySequence) return
      chartReady.value = true
    } catch {
      if (!silent) resetCharts()
    } finally {
      if (sequence === querySequence && !silent) loading.value = false
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
    datasourceMissing,
    resultMap,
    load,
    refresh,
    startRefresh,
    stopRefresh,
    resetCharts
  }
}

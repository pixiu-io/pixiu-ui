<!--
  集群监控概览（集群详情"监控"Tab）
  顶部摘要卡 + CPU/内存资源卡 + 核心趋势 + 折叠更多（网络/存储）。
  自包含：挂载即加载、卸载即停止；时间范围/粒度/自动刷新与 cluster-monitor-metrics 保持一致。
-->
<template>
  <div class="cluster-monitor-overview">
    <div v-if="toolbar && !datasourceMissing" class="overview-toolbar">
      <MetricsMonitorToolbar
        v-model:timeRange="timeRange"
        v-model:granularity="granularity"
        v-model:autoRefresh="autoRefresh"
        v-model:showLegend="showLegend"
        :show-granularity="false"
        class="overview-toolbar__main"
      />
      <ElButton
        class="overview-toolbar__refresh"
        :loading="metricsInitialLoading"
        title="刷新"
        @click="refresh"
      >
        <ElIcon :size="14"><Refresh /></ElIcon>
      </ElButton>
    </div>

    <PrometheusOnboarding v-if="datasourceMissing" @associate="goDatasource" />

    <template v-else>
      <!-- 告警 / 事件入口 -->
      <div class="overview-actions">
        <ElLink
          type="primary"
          underline="never"
          class="overview-actions__link"
          @click="goPage('events')"
        >
          <ElIcon :size="14"><Bell /></ElIcon>
          <span>事件与告警</span>
        </ElLink>
      </div>

      <!-- L1 摘要卡 -->
      <div class="summary-grid">
        <div
          v-for="card in summaryCards"
          :key="card.key"
          class="summary-card"
          :class="{ 'is-danger': card.danger, 'is-clickable': !!card.onClick }"
          @click="card.onClick"
        >
          <div class="summary-card__head">
            <span class="summary-card__title">{{ card.title }}</span>
            <span
              class="summary-card__icon"
              :style="{ color: card.iconColor, background: card.iconBg }"
            >
              <ElIcon :size="16"><component :is="card.icon" /></ElIcon>
            </span>
          </div>
          <div class="summary-card__value" :class="{ 'is-danger': card.danger }">
            {{ card.value }}
          </div>
          <div class="summary-card__sub">{{ card.sub }}</div>
        </div>
      </div>

      <!-- L2 资源卡 -->
      <div class="section-title section-title--spaced">资源使用情况</div>
      <div class="resource-grid">
        <ElCard shadow="never" class="resource-card" @click="scrollToTrend">
          <div class="resource-card__header">
            <span class="resource-card__name">
              <ElIcon class="resource-card__icon"><Cpu /></ElIcon>
              CPU
            </span>
            <span class="resource-card__value" :class="{ 'is-warning': isHigh(cpuUsagePct) }">
              {{ pct(cpuUsagePct) }}
            </span>
          </div>
          <div class="resource-card__meta">
            <span
              >用量 <strong>{{ num(cpuUsageCoresLast) }}</strong> / 总量
              <strong>{{ num(cpuTotalCoresLast) }}</strong> 核</span
            >
            <span
              >Request 承诺率 <strong>{{ pct(cpuRequestsPct) }}</strong></span
            >
            <span class="resource-card__trend"
              >近24h 平均 <strong>{{ pct(cpuUtilAvg) }}</strong> · 峰值
              <strong>{{ pct(cpuUtilMax) }}</strong></span
            >
          </div>
          <div class="resource-card__bars">
            <div class="resource-bar">
              <span class="resource-bar__label">使用率</span>
              <ElProgress
                :percentage="barValue(cpuUsagePct)"
                :show-text="false"
                :stroke-width="8"
                color="var(--el-color-primary)"
              />
            </div>
          </div>
        </ElCard>

        <ElCard shadow="never" class="resource-card" @click="scrollToTrend">
          <div class="resource-card__header">
            <span class="resource-card__name">
              <ElIcon class="resource-card__icon"><Coin /></ElIcon>
              内存
            </span>
            <span class="resource-card__value" :class="{ 'is-warning': isHigh(memUsagePct) }">
              {{ pct(memUsagePct) }}
            </span>
          </div>
          <div class="resource-card__meta">
            <span
              >用量 <strong>{{ num(memUsageGibLast) }}</strong> / 总量
              <strong>{{ num(memTotalGibLast) }}</strong> GB</span
            >
            <span
              >Request 承诺率 <strong>{{ pct(memRequestsPct) }}</strong></span
            >
            <span class="resource-card__trend"
              >近24h 平均 <strong>{{ pct(memUtilAvg) }}</strong> · 峰值
              <strong>{{ pct(memUtilMax) }}</strong></span
            >
          </div>
          <div class="resource-card__bars">
            <div class="resource-bar">
              <span class="resource-bar__label">使用率</span>
              <ElProgress
                :percentage="barValue(memUsagePct)"
                :show-text="false"
                :stroke-width="8"
                color="var(--el-color-primary)"
              />
            </div>
          </div>
        </ElCard>

        <ElCard shadow="never" class="resource-card" @click="scrollToTrend">
          <div class="resource-card__header">
            <span class="resource-card__name">
              <ElIcon class="resource-card__icon"><DataLine /></ElIcon>
              磁盘
            </span>
            <span class="resource-card__value" :class="{ 'is-warning': isHigh(diskUsagePct) }">
              {{ pct(diskUsagePct) }}
            </span>
          </div>
          <div class="resource-card__meta">
            <span
              >使用率 <strong>{{ pct(diskUsagePct) }}</strong></span
            >
          </div>
          <div class="resource-card__bars">
            <div class="resource-bar">
              <span class="resource-bar__label">使用率</span>
              <ElProgress
                :percentage="barValue(diskUsagePct)"
                :show-text="false"
                :stroke-width="8"
                color="var(--el-color-primary)"
              />
            </div>
          </div>
        </ElCard>
      </div>

      <!-- L3 核心趋势 -->
      <div ref="trendSectionRef" class="section-title section-title--spaced">资源趋势</div>
      <div class="trend-grid">
        <MetricChartPanel
          title="CPU 使用率（%）"
          :data="cpuUtilPercent"
          :x-axis-data="cpuTimeLabels"
          :is-empty="!cpuUtilPercent.length"
          :silent-update="chartSilentUpdate"
          :show-legend="showLegend"
          height="136px"
          :axis-font-size="10"
          :max-x-axis-labels="axisLabelCount"
          :expand-time-range="timeRange"
          @expand-time-range-change="onExpandTimeRangeChange"
        />
        <MetricChartPanel
          title="CPU 使用量（核）"
          :data="cpuUsageCores"
          :x-axis-data="cpuTimeLabels"
          :is-empty="!cpuUsageCores.length"
          :silent-update="chartSilentUpdate"
          :show-legend="showLegend"
          height="136px"
          :axis-font-size="10"
          :max-x-axis-labels="axisLabelCount"
          :expand-time-range="timeRange"
          @expand-time-range-change="onExpandTimeRangeChange"
        />
        <MetricChartPanel
          title="内存使用率（%）"
          :data="memUtilPercent"
          :x-axis-data="cpuTimeLabels"
          :is-empty="!memUtilPercent.length"
          :silent-update="chartSilentUpdate"
          :show-legend="showLegend"
          height="136px"
          :axis-font-size="10"
          :max-x-axis-labels="axisLabelCount"
          :expand-time-range="timeRange"
          @expand-time-range-change="onExpandTimeRangeChange"
        />
        <MetricChartPanel
          title="内存使用量（GB）"
          :data="memUsageGib"
          :x-axis-data="cpuTimeLabels"
          :is-empty="!memUsageGib.length"
          :silent-update="chartSilentUpdate"
          :show-legend="showLegend"
          height="136px"
          :axis-font-size="10"
          :max-x-axis-labels="axisLabelCount"
          :expand-time-range="timeRange"
          @expand-time-range-change="onExpandTimeRangeChange"
        />
        <MetricChartPanel
          title="磁盘使用率（%）"
          :data="diskUtilPercent"
          :x-axis-data="cpuTimeLabels"
          :is-empty="!diskUtilPercent.length"
          :silent-update="chartSilentUpdate"
          :show-legend="showLegend"
          height="136px"
          :axis-font-size="10"
          :max-x-axis-labels="axisLabelCount"
          :expand-time-range="timeRange"
          @expand-time-range-change="onExpandTimeRangeChange"
        />
      </div>

      <!-- 折叠更多：网络 + 存储 -->
      <ElCollapse v-model="moreActiveNames" class="more-collapse">
        <ElCollapseItem title="网络与存储趋势" name="more">
          <div class="more-grid">
            <div class="more-grid__group">
              <div class="more-grid__group-title">网络</div>
              <div class="chart-grid">
                <MetricChartPanel
                  title="网络出流量(MBytes)"
                  :data="networkTransmitMb"
                  :x-axis-data="cpuTimeLabels"
                  :is-empty="isTrendEmpty(networkTransmitMb)"
                  :silent-update="chartSilentUpdate"
                  :show-legend="showLegend"
                  height="136px"
                  :axis-font-size="10"
                  :max-x-axis-labels="axisLabelCount"
                  :expand-time-range="timeRange"
                  @expand-time-range-change="onExpandTimeRangeChange"
                />
                <MetricChartPanel
                  title="网络入流量(MBytes)"
                  :data="networkReceiveMb"
                  :x-axis-data="cpuTimeLabels"
                  :is-empty="isTrendEmpty(networkReceiveMb)"
                  :silent-update="chartSilentUpdate"
                  :show-legend="showLegend"
                  height="136px"
                  :axis-font-size="10"
                  :max-x-axis-labels="axisLabelCount"
                  :expand-time-range="timeRange"
                  @expand-time-range-change="onExpandTimeRangeChange"
                />
                <MetricChartPanel
                  title="网络带宽(Mbps)"
                  :data="networkBandwidthMbps"
                  :x-axis-data="cpuTimeLabels"
                  :is-empty="isTrendEmpty(networkBandwidthMbps)"
                  :silent-update="chartSilentUpdate"
                  :show-legend="showLegend"
                  height="136px"
                  :axis-font-size="10"
                  :max-x-axis-labels="axisLabelCount"
                  :expand-time-range="timeRange"
                  @expand-time-range-change="onExpandTimeRangeChange"
                />
                <MetricChartPanel
                  title="网络包容量(个/s)"
                  :data="networkPacketRate"
                  :x-axis-data="cpuTimeLabels"
                  :is-empty="isTrendEmpty(networkPacketRate)"
                  :silent-update="chartSilentUpdate"
                  :show-legend="showLegend"
                  height="136px"
                  :axis-font-size="10"
                  :max-x-axis-labels="axisLabelCount"
                  :expand-time-range="timeRange"
                  @expand-time-range-change="onExpandTimeRangeChange"
                />
              </div>
            </div>
            <div class="more-grid__group">
              <div class="more-grid__group-title">存储</div>
              <div class="chart-grid">
                <MetricChartPanel
                  title="块设备 读取次数(次)"
                  :data="diskReadsValues"
                  :x-axis-data="cpuTimeLabels"
                  :is-empty="isTrendEmpty(diskReadsValues)"
                  :silent-update="chartSilentUpdate"
                  :show-legend="showLegend"
                  height="136px"
                  :axis-font-size="10"
                  :max-x-axis-labels="axisLabelCount"
                  :expand-time-range="timeRange"
                  @expand-time-range-change="onExpandTimeRangeChange"
                />
                <MetricChartPanel
                  title="块设备 写入大小(MBytes)"
                  :data="diskWriteBytesValues"
                  :x-axis-data="cpuTimeLabels"
                  :is-empty="isTrendEmpty(diskWriteBytesValues)"
                  :silent-update="chartSilentUpdate"
                  :show-legend="showLegend"
                  height="136px"
                  :axis-font-size="10"
                  :max-x-axis-labels="axisLabelCount"
                  :expand-time-range="timeRange"
                  @expand-time-range-change="onExpandTimeRangeChange"
                />
                <MetricChartPanel
                  title="块设备 写入次数(次)"
                  :data="diskWritesValues"
                  :x-axis-data="cpuTimeLabels"
                  :is-empty="isTrendEmpty(diskWritesValues)"
                  :silent-update="chartSilentUpdate"
                  :show-legend="showLegend"
                  height="136px"
                  :axis-font-size="10"
                  :max-x-axis-labels="axisLabelCount"
                  :expand-time-range="timeRange"
                  @expand-time-range-change="onExpandTimeRangeChange"
                />
                <MetricChartPanel
                  title="块设备 读取大小(MBytes)"
                  :data="diskReadBytesValues"
                  :x-axis-data="cpuTimeLabels"
                  :is-empty="isTrendEmpty(diskReadBytesValues)"
                  :silent-update="chartSilentUpdate"
                  :show-legend="showLegend"
                  height="136px"
                  :axis-font-size="10"
                  :max-x-axis-labels="axisLabelCount"
                  :expand-time-range="timeRange"
                  @expand-time-range-change="onExpandTimeRangeChange"
                />
              </div>
            </div>
          </div>
        </ElCollapseItem>
      </ElCollapse>
    </template>
  </div>
</template>

<script setup lang="ts">
  import type { Component } from 'vue'
  import {
    Bell,
    Box,
    CircleCheckFilled,
    Coin,
    Cpu,
    DataLine,
    Folder,
    Monitor,
    Refresh,
    WarningFilled
  } from '@element-plus/icons-vue'
  import MetricsMonitorToolbar from '@/components/container/metrics-monitor-toolbar.vue'
  import PrometheusOnboarding from '@/components/monitor/prometheus-onboarding.vue'
  import MetricChartPanel from '@/components/container/metric-chart-panel.vue'
  import { useClusterMonitorPanels } from '@/hooks/kubernetes/useClusterMonitorPanels'
  import { fetchDashboardQuery, type DashboardPanelResult } from '@/api/dashboard'
  import type { DatasourceItem } from '@/api/datasource'
  import { loadPrometheusDatasource } from '@/utils/datasource/prometheus-datasource'
  import {
    getDefaultMetricsAutoRefresh,
    type MetricsAutoRefreshOption
  } from '@/utils/metrics/auto-refresh'
  import {
    getDefaultMetricsGranularity,
    type MetricsGranularityOption
  } from '@/utils/metrics/granularity'
  import {
    getDefaultMetricsTimeRange,
    METRICS_TIME_PRESETS,
    type MetricsTimeRange
  } from '@/utils/metrics/time-range'

  defineOptions({ name: 'ClusterMonitorOverview' })

  const props = withDefaults(
    defineProps<{
      clusterName: string
      toolbar?: boolean
      /** 外部已选 Prometheus 实例（监控大盘）；优先于按 clusterName 探测 */
      datasource?: DatasourceItem | null
      externalTimeRange?: MetricsTimeRange
      externalGranularity?: MetricsGranularityOption
      externalAutoRefresh?: MetricsAutoRefreshOption
    }>(),
    {
      toolbar: true,
      datasource: null
    }
  )

  const emit = defineEmits<{
    (e: 'update:externalTimeRange', value: MetricsTimeRange): void
    (e: 'update:externalGranularity', value: MetricsGranularityOption): void
    (e: 'update:externalAutoRefresh', value: MetricsAutoRefreshOption): void
  }>()

  const router = useRouter()

  const clusterName = computed(() => props.clusterName)
  const datasourceRef = computed(() => props.datasource ?? null)
  /** 打开默认最近 24 小时（外部未提供时间范围时的内部默认） */
  const internalTimeRange = ref<MetricsTimeRange>(
    METRICS_TIME_PRESETS.find((p) => p.key === '24h')?.getRange(new Date()) ??
      getDefaultMetricsTimeRange()
  )
  const internalGranularity = ref<MetricsGranularityOption>(getDefaultMetricsGranularity())
  const internalAutoRefresh = ref<MetricsAutoRefreshOption>(getDefaultMetricsAutoRefresh())
  /** 优先使用外部时间范围/粒度/自动刷新（prometheus 监控页页面级工具栏），否则回退内部 */
  const timeRange = computed<MetricsTimeRange>({
    get: () => props.externalTimeRange ?? internalTimeRange.value,
    set: (value) => {
      if (props.externalTimeRange) emit('update:externalTimeRange', value)
      else internalTimeRange.value = value
    }
  })
  const granularity = computed<MetricsGranularityOption>({
    get: () => props.externalGranularity ?? internalGranularity.value,
    set: (value) => {
      if (props.externalGranularity) emit('update:externalGranularity', value)
      else internalGranularity.value = value
    }
  })
  const autoRefresh = computed<MetricsAutoRefreshOption>({
    get: () => props.externalAutoRefresh ?? internalAutoRefresh.value,
    set: (value) => {
      if (props.externalAutoRefresh) emit('update:externalAutoRefresh', value)
      else internalAutoRefresh.value = value
    }
  })
  const showLegend = ref(true)

  const {
    loading: queryLoading,
    chartReady,
    datasourceMissing,
    resultMap,
    load: loadTrendPanels,
    resetCharts
  } = useClusterMonitorPanels(clusterName, timeRange, granularity, datasourceRef)

  /** 仅首次加载时展示 loading，手动/定时刷新不遮罩整页 */
  const metricsInitialLoading = computed(() => queryLoading.value && !chartReady.value)

  // ---- 摘要/资源卡额外 stat/gauge 面板（useClusterMonitorPanels 仅查趋势，这里补查一次） ----
  const EXTRA_PANEL_IDS = [
    'cluster.nodes',
    'cluster.ready_nodes',
    'cluster.running_pods',
    'cluster.namespaces',
    'cluster.cpu_usage',
    'cluster.memory_usage',
    'cluster.cpu_requests',
    'cluster.disk_usage_trend',
    'workload.deployments',
    'workload.statefulsets',
    'workload.daemonsets'
  ] as const

  const statResultMap = reactive<Record<string, DashboardPanelResult>>({})

  function resetStatPanels() {
    for (const key of Object.keys(statResultMap)) delete statResultMap[key]
  }

  /** 相对时间区间以当前时间重算，保证自动刷新时时间窗滑动（与 hook 内一致） */
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

  async function loadStatPanels(silent = false) {
    const name = clusterName.value
    const override = props.datasource
    if (!override && !name) return
    if (silent && datasourceMissing.value) return
    try {
      const datasource = override ?? (await loadPrometheusDatasource(name))
      if (!datasource) {
        if (!silent) resetStatPanels()
        return
      }
      const range = normalizedTimeRange()
      const start = Math.floor(range.start.getTime() / 1000)
      const end = Math.floor(range.end.getTime() / 1000)
      const durationSeconds = Math.max(1, end - start)
      const step = Math.max(
        Math.ceil(granularity.value.stepMs / 1000),
        Math.ceil(durationSeconds / 600)
      )

      let panelIndex = 0
      const workerCount = Math.min(6, EXTRA_PANEL_IDS.length)
      const workers = Array.from({ length: workerCount }, async () => {
        while (panelIndex < EXTRA_PANEL_IDS.length) {
          const panelId = EXTRA_PANEL_IDS[panelIndex]
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
            if (result) statResultMap[result.id] = result
          } catch {
            /* 单个面板查询失败不影响其他卡 */
          }
        }
      })
      await Promise.all(workers)
    } catch {
      if (!silent) resetStatPanels()
    }
  }

  /** 同时刷新趋势面板与摘要 stat/gauge 面板 */
  function loadAll(silent: boolean) {
    return Promise.all([loadTrendPanels(silent), loadStatPanels(silent)])
  }

  let refreshTimer: ReturnType<typeof setInterval> | null = null

  function stopRefreshLoop() {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
  }

  function startRefreshLoop(intervalMs = 60_000) {
    stopRefreshLoop()
    void loadAll(false)
    if (intervalMs > 0) {
      refreshTimer = setInterval(() => void loadAll(true), intervalMs)
    }
  }

  // ---- 趋势面板 id 映射，结果取自 useClusterMonitorPanels 的 resultMap ----
  const TREND_PANEL_ID = {
    cpuTotalCores: 'cluster.cpu_total_trend',
    cpuUsagePercent: 'cluster.cpu_usage_trend',
    cpuUsageCores: 'cluster.cpu_usage_cores_trend',
    memoryTotalGib: 'cluster.memory_total_trend',
    memoryUsagePercent: 'cluster.memory_usage_trend',
    memoryUsageGib: 'cluster.memory_usage_bytes_trend',
    networkTransmitMb: 'network.transmit_rate_mb_trend',
    networkReceiveMb: 'network.receive_rate_mb_trend',
    networkBandwidthMbps: 'network.bandwidth_trend',
    networkPacketRate: 'network.packet_rate_trend',
    diskReads: 'storage.disk_reads_trend',
    diskWriteBytes: 'storage.disk_write_bytes_trend',
    diskWrites: 'storage.disk_writes_trend',
    diskReadBytes: 'storage.disk_read_bytes_trend'
  } as const

  function round(value: number, digits: number): number {
    return Number.isFinite(value) ? +value.toFixed(digits) : 0
  }

  /** 网络速率：低流量集群常见 <0.01 MB/s，保留更多小数避免被抹成全 0 */
  function roundNetworkRate(value: number): number {
    if (!Number.isFinite(value)) return 0
    const absolute = Math.abs(value)
    if (absolute >= 1) return +value.toFixed(2)
    if (absolute >= 0.01) return +value.toFixed(3)
    return +value.toFixed(5)
  }

  /** 趋势数据是否无有效指标：仅空数组（无序列）视为无指标；有序列（即使值全为 0）视为真实数据 */
  function isTrendEmpty(values: number[]): boolean {
    return !values.length
  }

  function trendSeriesValues(result: DashboardPanelResult | undefined) {
    return result?.series?.[0]?.values ?? []
  }

  /** 时间标签：time 只显示 HH:mm；date 只显示 MM-DD（>24h）；datetime 显示 MM-DD HH:mm */
  function formatAxisTime(timestamp: number, mode: 'time' | 'date' | 'datetime'): string {
    const d = new Date(timestamp * 1000)
    const pad = (n: number) => String(n).padStart(2, '0')
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
    const date = `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    if (mode === 'date') return date
    if (mode === 'datetime') return `${date} ${time}`
    return time
  }

  /** 时间跨度是否超过 24 小时（超过时 x 轴标签带日期，且减少数量避免挤压） */
  const axisOver24h = computed(() => {
    const source = Object.values(TREND_PANEL_ID)
      .map((id) => trendSeriesValues(resultMap[id]))
      .find((values) => values.length > 0)
    const timestamps = (source ?? []).map((point) => point.timestamp)
    return timestamps.length > 1 && timestamps[timestamps.length - 1] - timestamps[0] > 24 * 60 * 60
  })
  /** x 轴标签最大数量：最多显示 10 个（日期或时间标签） */
  const axisLabelCount = computed(() => 10)
  /** 折线图时间标签：取任一有数据面板的时间戳（避免某面板无数据导致 x 轴为空），超过 24h 带日期、否则只显示时间 */
  const cpuTimeLabels = computed<string[]>(() => {
    const source = Object.values(TREND_PANEL_ID)
      .map((id) => trendSeriesValues(resultMap[id]))
      .find((values) => values.length > 0)
    return (source ?? []).map((point) =>
      formatAxisTime(point.timestamp, axisOver24h.value ? 'date' : 'time')
    )
  })
  const cpuUtilPercent = computed<number[]>(() =>
    trendSeriesValues(resultMap[TREND_PANEL_ID.cpuUsagePercent]).map((point) =>
      round(Number(point.value), 2)
    )
  )
  const cpuTotalCores = computed<number[]>(() =>
    trendSeriesValues(resultMap[TREND_PANEL_ID.cpuTotalCores]).map((point) =>
      round(Number(point.value), 2)
    )
  )
  const cpuUsageCores = computed<number[]>(() =>
    trendSeriesValues(resultMap[TREND_PANEL_ID.cpuUsageCores]).map((point) =>
      round(Number(point.value), 2)
    )
  )
  const memTotalGib = computed<number[]>(() =>
    trendSeriesValues(resultMap[TREND_PANEL_ID.memoryTotalGib]).map((point) =>
      round(Number(point.value) / 1024 ** 3, 2)
    )
  )
  const memUtilPercent = computed<number[]>(() =>
    trendSeriesValues(resultMap[TREND_PANEL_ID.memoryUsagePercent]).map((point) =>
      round(Number(point.value), 2)
    )
  )
  const memUsageGib = computed<number[]>(() =>
    trendSeriesValues(resultMap[TREND_PANEL_ID.memoryUsageGib]).map((point) =>
      round(Number(point.value) / 1024 ** 3, 2)
    )
  )
  /** 磁盘使用率趋势：useClusterMonitorPanels 未查该面板，从 statResultMap 取值 */
  const diskUtilPercent = computed<number[]>(() =>
    trendSeriesValues(statResultMap['cluster.disk_usage_trend']).map((point) =>
      round(Number(point.value), 2)
    )
  )
  const networkTransmitMb = computed<number[]>(() =>
    trendSeriesValues(resultMap[TREND_PANEL_ID.networkTransmitMb]).map((point) =>
      roundNetworkRate(Number(point.value))
    )
  )
  const networkReceiveMb = computed<number[]>(() =>
    trendSeriesValues(resultMap[TREND_PANEL_ID.networkReceiveMb]).map((point) =>
      roundNetworkRate(Number(point.value))
    )
  )
  const networkBandwidthMbps = computed<number[]>(() =>
    trendSeriesValues(resultMap[TREND_PANEL_ID.networkBandwidthMbps]).map((point) =>
      roundNetworkRate(Number(point.value))
    )
  )
  const networkPacketRate = computed<number[]>(() =>
    trendSeriesValues(resultMap[TREND_PANEL_ID.networkPacketRate]).map((point) =>
      roundNetworkRate(Number(point.value))
    )
  )
  const diskReadsValues = computed<number[]>(() =>
    trendSeriesValues(resultMap[TREND_PANEL_ID.diskReads]).map((point) =>
      round(Number(point.value), 2)
    )
  )
  const diskWriteBytesValues = computed<number[]>(() =>
    trendSeriesValues(resultMap[TREND_PANEL_ID.diskWriteBytes]).map((point) =>
      round(Number(point.value), 2)
    )
  )
  const diskWritesValues = computed<number[]>(() =>
    trendSeriesValues(resultMap[TREND_PANEL_ID.diskWrites]).map((point) =>
      round(Number(point.value), 2)
    )
  )
  const diskReadBytesValues = computed<number[]>(() =>
    trendSeriesValues(resultMap[TREND_PANEL_ID.diskReadBytes]).map((point) =>
      round(Number(point.value), 2)
    )
  )

  // ---- 摘要/资源卡数据 ----
  /** 趋势数组末项；空或非数字返回 null */
  function lastOf(arr: number[]): number | null {
    const n = arr[arr.length - 1]
    return Number.isFinite(n) ? n : null
  }

  /** stat/gauge 面板末值（瞬时查询为单点）；无数据返回 null */
  function lastGauge(result: DashboardPanelResult | undefined): number | null {
    const values = result?.series?.[0]?.values ?? []
    const point = values[values.length - 1]
    const n = Number(point?.value)
    return Number.isFinite(n) ? n : null
  }

  /** 趋势数组均值；空数组返回 null */
  function avgOf(values: number[]): number | null {
    if (!values.length) return null
    return values.reduce((acc, v) => acc + v, 0) / values.length
  }

  /** 趋势数组峰值；空数组返回 null */
  function maxOf(values: number[]): number | null {
    if (!values.length) return null
    return Math.max(...values)
  }

  const nodesTotal = computed(() => lastGauge(statResultMap['cluster.nodes']))
  const nodesReady = computed(() => lastGauge(statResultMap['cluster.ready_nodes']))
  const runningPods = computed(() => lastGauge(statResultMap['cluster.running_pods']))
  const nsCount = computed(() => lastGauge(statResultMap['cluster.namespaces']))
  const cpuUsagePct = computed(() => lastGauge(statResultMap['cluster.cpu_usage']))
  const memUsagePct = computed(() => lastGauge(statResultMap['cluster.memory_usage']))
  const cpuRequestsPct = computed(() => lastGauge(statResultMap['cluster.cpu_requests']))
  const diskUsagePct = computed(() => lastGauge(statResultMap['cluster.disk_usage_trend']))
  /** CPU/内存近 24h 均值/峰值（从趋势数组计算，空数据返回 null 显示 -） */
  const cpuUtilAvg = computed(() => avgOf(cpuUtilPercent.value))
  const cpuUtilMax = computed(() => maxOf(cpuUtilPercent.value))
  const memUtilAvg = computed(() => avgOf(memUtilPercent.value))
  const memUtilMax = computed(() => maxOf(memUtilPercent.value))
  /** 内存 Request 承诺率：目录无对应 gauge 面板，置空不编造数据 */
  const memRequestsPct = computed(() => null as number | null)

  const cpuUsageCoresLast = computed(() => lastOf(cpuUsageCores.value))
  const cpuTotalCoresLast = computed(() => lastOf(cpuTotalCores.value))
  const memUsageGibLast = computed(() => lastOf(memUsageGib.value))
  const memTotalGibLast = computed(() => lastOf(memTotalGib.value))

  const workloadKinds = ['workload.deployments', 'workload.statefulsets', 'workload.daemonsets']
  const workloadAvail = computed(() => workloadKinds.map((id) => lastGauge(statResultMap[id])))
  const workloadHasData = computed(() => workloadAvail.value.some((v) => v !== null))
  const abnormalWorkload = computed(
    () => workloadAvail.value.filter((v) => v !== null && v < 100).length
  )

  function pct(v: number | null, digits = 1): string {
    return v === null ? '-' : `${v.toFixed(digits)}%`
  }

  function num(v: number | null, digits = 2): string {
    return v === null ? '-' : v.toFixed(digits)
  }

  function barValue(v: number | null): number {
    if (v === null) return 0
    return Math.min(100, Math.max(0, v))
  }

  function isHigh(v: number | null): boolean {
    return v !== null && v > 90
  }

  type SummaryCard = {
    key: string
    title: string
    icon: Component
    iconColor: string
    iconBg: string
    value: string
    sub: string
    danger?: boolean
    onClick?: () => void
  }

  /** L1 摘要卡（集群健康由其余卡片派生） */
  const summaryCards = computed<SummaryCard[]>(() => {
    const total = nodesTotal.value
    const ready = nodesReady.value
    const notReady = total !== null && ready !== null ? Math.max(0, total - ready) : null

    const healthOk = total !== null && ready === total
    const healthError = total !== null && ready !== total

    return [
      {
        key: 'health',
        title: '集群健康',
        icon: healthOk ? CircleCheckFilled : healthError ? WarningFilled : Monitor,
        iconColor: healthOk
          ? '#67c23a'
          : healthError
            ? '#f56c6c'
            : 'var(--el-text-color-secondary)',
        iconBg: healthOk
          ? 'rgba(103, 194, 58, 0.12)'
          : healthError
            ? 'rgba(245, 108, 108, 0.12)'
            : 'var(--el-fill-color-light)',
        value: healthOk ? '正常' : healthError ? '异常' : '-',
        sub: healthOk ? '节点与 Pod 运行正常' : healthError ? '存在异常资源' : '暂无数据',
        danger: healthError
      },
      {
        key: 'nodes',
        title: '节点',
        icon: Monitor,
        iconColor: notReady ? '#f56c6c' : '#409eff',
        iconBg: notReady ? 'rgba(245, 108, 108, 0.12)' : 'rgba(64, 158, 255, 0.12)',
        value: total === null ? '-' : `${ready}/${total}`,
        sub: notReady === null ? '暂无数据' : notReady > 0 ? `${notReady} 个不可用` : '全部就绪',
        danger: notReady !== null && notReady > 0,
        onClick: () => goPage('nodes')
      },
      {
        key: 'pods',
        title: '运行 Pod',
        icon: Box,
        iconColor: '#409eff',
        iconBg: 'rgba(64, 158, 255, 0.12)',
        value: runningPods.value === null ? '-' : String(runningPods.value),
        sub: runningPods.value === null ? '暂无数据' : '运行中',
        onClick: () => goPage('pods')
      },
      {
        key: 'namespaces',
        title: 'Namespace',
        icon: Folder,
        iconColor: '#7c6af0',
        iconBg: 'rgba(124, 106, 240, 0.12)',
        value: nsCount.value === null ? '-' : String(nsCount.value),
        sub: nsCount.value === null ? '暂无数据' : '命名空间',
        onClick: () => goPage('namespaces')
      },
      {
        key: 'workload',
        title: '异常 Workload',
        icon: WarningFilled,
        iconColor: abnormalWorkload.value > 0 ? '#e6a23c' : 'var(--el-text-color-secondary)',
        iconBg:
          abnormalWorkload.value > 0 ? 'rgba(230, 162, 60, 0.12)' : 'var(--el-fill-color-light)',
        value: workloadHasData.value ? String(abnormalWorkload.value) : '-',
        sub: workloadHasData.value
          ? abnormalWorkload.value > 0
            ? '可用率 < 100%'
            : '全部可用'
          : '无数据',
        danger: abnormalWorkload.value > 0,
        onClick: () => goPage('workloads')
      }
    ]
  })

  // ---- 折叠更多 ----
  const moreActiveNames = ref<string[]>([])

  // ---- 图表动画与手动刷新 ----
  /** false 时折线图走生成动画；定时刷新为 true 静默更新 */
  const chartSilentUpdate = ref(false)
  let chartAnimateTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleChartSilentUpdate() {
    if (chartAnimateTimer) clearTimeout(chartAnimateTimer)
    chartAnimateTimer = setTimeout(() => {
      chartSilentUpdate.value = true
      chartAnimateTimer = null
    }, 1500)
  }

  watch(chartReady, (ready) => {
    if (ready && !chartSilentUpdate.value) scheduleChartSilentUpdate()
  })

  async function refresh() {
    chartSilentUpdate.value = false
    await loadAll(true)
    await nextTick()
    scheduleChartSilentUpdate()
  }

  /** 供外部（prometheus 监控页）通过 ref 触发手动刷新 */
  defineExpose({ refresh })

  /** 最大化弹窗内调整时间范围：同步 timeRange，由下方 watch 触发 loadAll(false) 刷新 */
  function onExpandTimeRangeChange(range: MetricsTimeRange) {
    timeRange.value = range
  }

  function goDatasource() {
    router.push({ name: 'MonitorDatasource' })
  }

  /** 跳转到集群详情对应子页（与 overview.vue go() 路由格式一致：/container/<页>?cluster=<name>） */
  function goPage(page: string) {
    router.push({ path: `/container/${page}`, query: { cluster: clusterName.value } })
  }

  /** 资源卡点击：滚动到本页 L3 趋势 */
  const trendSectionRef = ref<HTMLElement | null>(null)
  function scrollToTrend() {
    trendSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // 挂载即加载、卸载即停止
  onMounted(() => {
    if (clusterName.value || props.datasource) startRefreshLoop(autoRefresh.value.intervalMs)
  })

  onUnmounted(() => {
    stopRefreshLoop()
    if (chartAnimateTimer) clearTimeout(chartAnimateTimer)
  })

  // 集群名 / 外部数据源变化：重置图表并按当前自动刷新间隔重新加载
  watch(clusterName, (name, prevName) => {
    if (name && name !== prevName) {
      resetCharts()
      resetStatPanels()
      chartSilentUpdate.value = false
      startRefreshLoop(autoRefresh.value.intervalMs)
    }
  })

  watch(
    () => props.datasource?.id,
    (id, prevId) => {
      if (id && id !== prevId) {
        resetCharts()
        resetStatPanels()
        chartSilentUpdate.value = false
        startRefreshLoop(autoRefresh.value.intervalMs)
      }
    }
  )

  // 切换时间/粒度：强制非静默刷新，确保重新查询（不受数据源缺失静默跳过影响）
  watch(
    () =>
      [
        timeRange.value.start.getTime(),
        timeRange.value.end.getTime(),
        granularity.value.key
      ] as const,
    ([start, end, granularityKey], [prevStart, prevEnd, prevGranularity]) => {
      if (prevStart !== start || prevEnd !== end || prevGranularity !== granularityKey) {
        void loadAll(false)
      }
    }
  )

  // 自动刷新间隔变化：重启定时器
  watch(
    () => autoRefresh.value.intervalMs,
    (intervalMs) => {
      if (clusterName.value || props.datasource) startRefreshLoop(intervalMs)
    }
  )
</script>

<style scoped>
  .cluster-monitor-overview {
    min-height: 120px;
    padding: 0 16px 16px;
  }

  .overview-toolbar {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-top: 10px;
  }

  .overview-toolbar__main {
    flex: 1;
    min-width: 0;
  }

  .overview-toolbar__main :deep(.metrics-monitor-toolbar) {
    margin-bottom: 0;
  }
  /* 工具栏视觉与 namespace 大盘（prometheus-dashboard__toolbar）保持一致 */
  .overview-toolbar__main :deep(.metrics-monitor-toolbar__bar) {
    gap: 8px;
    justify-content: flex-end;
    padding: 0 10px 0 0;
    background: transparent;
    border: none;
    border-radius: 0;
  }
  .overview-toolbar__main :deep(.metrics-monitor-toolbar__time) {
    flex: 0 0 auto;
  }
  .overview-toolbar__main :deep(.metrics-monitor-toolbar__divider) {
    height: 24px;
    margin: 0 2px;
    background: var(--el-border-color-light);
    opacity: 1;
  }
  .overview-toolbar__main :deep(.metrics-time-range-picker) {
    width: 240px;
    min-width: 240px;
    max-width: 240px;
    transition: width 0.2s ease;
  }
  .overview-toolbar__main :deep(.metrics-time-range-picker.is-custom-range) {
    width: 340px;
    min-width: 340px;
    max-width: 340px;
  }
  .overview-toolbar__main :deep(.metrics-time-range-picker__trigger) {
    min-height: 32px;
    padding: 0 8px;
    font-size: 12px;
    background: var(--el-bg-color);
    border-color: var(--el-border-color);
    border-radius: 2px;
  }
  .overview-toolbar__main :deep(.metrics-time-range-picker__picker) {
    display: none !important;
  }
  .overview-toolbar__main :deep(.metrics-monitor-toolbar__select .el-select__wrapper) {
    min-height: 32px;
    padding: 0 10px;
    background: var(--el-bg-color);
    border-radius: 2px;
    box-shadow: 0 0 0 1px var(--el-border-color) inset;
  }

  .overview-toolbar__refresh {
    flex-shrink: 0;
    width: 36px;
    height: 32px;
    padding: 0;
    margin-left: -4px;
    border-radius: 6px;
  }

  .section-title {
    margin: 0 0 12px;
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .section-title--spaced {
    margin-top: 20px;
  }

  /* 告警 / 事件入口 */
  .overview-actions {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 12px;
  }

  .overview-actions__link {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    font-size: 12px;
  }

  /* L1 摘要卡 */
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 12px;
  }

  .summary-card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    padding: 12px 14px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .summary-card.is-danger {
    border-color: rgb(245 108 108 / 45%);
  }

  .summary-card.is-clickable {
    cursor: pointer;
  }

  .summary-card.is-clickable:hover {
    border-color: var(--el-color-primary-light-5);
    box-shadow: 0 6px 18px rgb(31 45 61 / 6%);
  }

  .summary-card__head {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
  }

  .summary-card__title {
    overflow: hidden;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .summary-card__icon {
    display: flex;
    flex: 0 0 28px;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
  }

  .summary-card__value {
    font-size: 20px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
    color: var(--el-text-color-primary);
  }

  .summary-card__value.is-danger {
    color: var(--el-color-danger);
  }

  .summary-card__sub {
    overflow: hidden;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* L2 资源卡 */
  .resource-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }

  .resource-card {
    display: flex;
    flex-direction: column;
    cursor: pointer;
    border-radius: 8px;
  }

  .resource-card:hover {
    border-color: var(--el-color-primary-light-5);
  }

  .resource-card :deep(.el-card__body) {
    display: flex;
    flex: 1;
    flex-direction: column;
    padding: 16px;
  }

  .resource-card__header {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
  }

  .resource-card__name {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .resource-card__icon {
    font-size: 16px;
    color: var(--el-color-primary);
  }

  .resource-card__value {
    font-size: 20px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
    color: var(--el-text-color-primary);
  }

  .resource-card__value.is-warning {
    color: var(--el-color-warning);
  }

  .resource-card__meta {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    gap: 4px 16px;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .resource-card__trend {
    font-size: 11px;
  }

  .resource-card__meta strong {
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    color: var(--el-text-color-primary);
  }

  .resource-card__bars {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 14px;
  }

  .resource-bar {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .resource-bar__label {
    flex: 0 0 auto;
    width: 56px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .resource-bar :deep(.el-progress) {
    flex: 1;
  }

  /* L3 趋势 */
  .trend-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  .trend-grid > :deep(.metric-chart-panel),
  .chart-grid > :deep(.metric-chart-panel) {
    display: flex;
    flex-direction: column;
    height: 195px;
    padding-top: 11px;
    overflow: hidden;
  }

  .trend-grid > :deep(.metric-chart-panel .relative.w-full),
  .chart-grid > :deep(.metric-chart-panel .relative.w-full) {
    flex: 1;
    height: auto !important;
    min-height: 0;
  }

  /* 折叠更多 */
  .more-collapse {
    margin-top: 20px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
  }

  .more-collapse :deep(.el-collapse-item__header) {
    height: 40px;
    padding: 0 16px;
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .more-collapse :deep(.el-collapse-item__content) {
    padding: 0 16px 16px;
  }

  .more-grid {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .more-grid__group-title {
    margin-bottom: 10px;
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-regular);
  }

  .chart-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  @media (width <= 1200px) {
    .summary-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (width <= 991.98px) {
    .resource-grid,
    .trend-grid,
    .chart-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (width <= 640px) {
    .summary-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

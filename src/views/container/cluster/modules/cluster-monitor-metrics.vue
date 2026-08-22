<!--
  集群监控指标面板（CPU/内存/网络/存储 折线卡）
  自包含：挂载即加载、卸载即停止。供集群监控抽屉与集群详情概览"监控"Tab 复用。
-->
<template>
  <div class="resource-metrics-pane">
    <MetricsMonitorToolbar
      v-if="!datasourceMissing"
      v-model:timeRange="timeRange"
      v-model:granularity="granularity"
      v-model:autoRefresh="autoRefresh"
      :show-legend="false"
      class="resource-metrics-pane__toolbar"
    />

    <PrometheusOnboarding v-if="datasourceMissing" @associate="goDatasource" />

    <template v-else>
      <template v-if="menuMode">
        <div class="metrics-menu-layout">
          <aside class="metrics-menu">
            <div
              v-for="item in metricMenu"
              :key="item.key"
              class="metrics-menu__item"
              :class="{ 'is-active': activeMetric === item.key }"
              @click="scrollToMetric(item.key)"
            >
              {{ item.label }}
            </div>
          </aside>
          <main class="metrics-menu-main">
            <div
              v-for="item in metricMenu"
              :key="item.key"
              :id="`metric-${item.key}`"
              class="metrics-metric-block"
            >
              <MetricChartPanel
                :title="item.label"
                :data="item.data"
                :x-axis-data="cpuTimeLabels"
                :is-empty="!item.data.length"
                :silent-update="chartSilentUpdate"
                :show-legend="showLegend"
                height="260px"
                :axis-font-size="10"
                :max-x-axis-labels="axisLabelCount"
                :expand-time-range="timeRange"
                @expand-time-range-change="onExpandTimeRangeChange"
              />
            </div>
          </main>
        </div>
      </template>
      <template v-else>
        <div class="tab-section-title">CPU</div>
      <div class="chart-grid">
        <MetricChartPanel
          title="CPU 总配置（核）"
          :data="cpuTotalCores"
          :x-axis-data="cpuTimeLabels"
          :is-empty="!cpuTotalCores.length"
          :silent-update="chartSilentUpdate"
          :show-legend="showLegend"
          height="136px"
          :axis-font-size="10"
          :max-x-axis-labels="axisLabelCount"
          :expand-time-range="timeRange"
          @expand-time-range-change="onExpandTimeRangeChange"
        />
        <MetricChartPanel
          title="CPU 利用率（%）"
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
      </div>
      <div class="tab-section-title tab-section-title--spaced">内存</div>
      <div class="chart-grid">
        <MetricChartPanel
          title="内存总量（GB）"
          :data="memTotalGib"
          :x-axis-data="cpuTimeLabels"
          :is-empty="!memTotalGib.length"
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
      </div>
      <div class="tab-section-title tab-section-title--spaced">网络</div>
      <div class="chart-grid">
        <MetricChartPanel
          title="网络出流量(MBytes)"
          :data="networkTransmitMb"
          :x-axis-data="cpuTimeLabels"
          :is-empty="!networkTransmitMb.length"
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
          :is-empty="!networkReceiveMb.length"
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
          :is-empty="!networkBandwidthMbps.length"
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
          :is-empty="!networkPacketRate.length"
          :silent-update="chartSilentUpdate"
          :show-legend="showLegend"
          height="136px"
          :axis-font-size="10"
          :max-x-axis-labels="axisLabelCount"
          :expand-time-range="timeRange"
          @expand-time-range-change="onExpandTimeRangeChange"
        />
      </div>
      <div class="tab-section-title tab-section-title--spaced">存储</div>
      <div class="chart-grid">
        <MetricChartPanel
          title="块设备 读取次数(次)"
          :data="diskReadsValues"
          :x-axis-data="cpuTimeLabels"
          :is-empty="!diskReadsValues.length"
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
          :is-empty="!diskWriteBytesValues.length"
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
          :is-empty="!diskWritesValues.length"
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
          :is-empty="!diskReadBytesValues.length"
          :silent-update="chartSilentUpdate"
          :show-legend="showLegend"
          height="136px"
          :axis-font-size="10"
          :max-x-axis-labels="axisLabelCount"
          :expand-time-range="timeRange"
          @expand-time-range-change="onExpandTimeRangeChange"
        />
      </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { useRouter } from 'vue-router'
  import MetricsMonitorToolbar from '@/components/container/metrics-monitor-toolbar.vue'
  import PrometheusOnboarding from '@/components/monitor/prometheus-onboarding.vue'
  import MetricChartPanel from '@/components/container/metric-chart-panel.vue'
  import { useClusterMonitorPanels } from '@/hooks/kubernetes/useClusterMonitorPanels'
  import { type DashboardPanelResult } from '@/api/dashboard'
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

  defineOptions({ name: 'ClusterMonitorMetrics' })

  const props = withDefaults(
    defineProps<{
      clusterName: string
      /** 菜单模式：左侧指标菜单 + 右侧单指标主图（集群详情监控 Tab 用）；默认分组展示（抽屉用） */
      menuMode?: boolean
    }>(),
    { menuMode: false }
  )

  const router = useRouter()

  const clusterName = computed(() => props.clusterName)
  /** 打开默认最近 24 小时 */
  const timeRange = ref(
    METRICS_TIME_PRESETS.find((p) => p.key === '24h')?.getRange(new Date()) ??
      getDefaultMetricsTimeRange()
  )
  const granularity = ref<MetricsGranularityOption>(getDefaultMetricsGranularity())
  const autoRefresh = ref<MetricsAutoRefreshOption>(getDefaultMetricsAutoRefresh())
  const showLegend = ref(true)

  const {
    loading: queryLoading,
    chartReady,
    datasourceMissing,
    resultMap,
    load: loadPanels,
    refresh: queryRefresh,
    startRefresh,
    stopRefresh,
    resetCharts
  } = useClusterMonitorPanels(clusterName, timeRange, granularity)

  /** 仅首次加载时展示 loading，手动/定时刷新不遮罩整页 */
  const metricsInitialLoading = computed(() => queryLoading.value && !chartReady.value)

  /** 趋势面板 id 映射，结果取自 useClusterMonitorPanels 的 resultMap */
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

  function trendSeriesValues(result: DashboardPanelResult | undefined) {
    return result?.series?.[0]?.values ?? []
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

  /** 指标菜单（菜单模式）：key 对应下方 computed，data 为对应趋势数组 */
  const metricMenu = computed(() => [
    { key: 'cpuTotalCores', label: 'CPU 总配置', data: cpuTotalCores.value },
    { key: 'cpuUtilPercent', label: 'CPU 利用率', data: cpuUtilPercent.value },
    { key: 'cpuUsageCores', label: 'CPU 使用量', data: cpuUsageCores.value },
    { key: 'memTotalGib', label: '内存总量', data: memTotalGib.value },
    { key: 'memUtilPercent', label: '内存使用率', data: memUtilPercent.value },
    { key: 'memUsageGib', label: '内存使用量', data: memUsageGib.value },
    { key: 'networkTransmitMb', label: '网络出流量', data: networkTransmitMb.value },
    { key: 'networkReceiveMb', label: '网络入流量', data: networkReceiveMb.value },
    { key: 'networkBandwidthMbps', label: '网络带宽', data: networkBandwidthMbps.value },
    { key: 'networkPacketRate', label: '网络包容量', data: networkPacketRate.value },
    { key: 'diskReadsValues', label: '块设备读取次数', data: diskReadsValues.value },
    { key: 'diskWriteBytesValues', label: '块设备写入大小', data: diskWriteBytesValues.value },
    { key: 'diskWritesValues', label: '块设备写入次数', data: diskWritesValues.value },
    { key: 'diskReadBytesValues', label: '块设备读取大小', data: diskReadBytesValues.value }
  ])
  const activeMetric = ref('cpuUtilPercent')

  /** 菜单锚点导航：点击菜单项滚动到对应指标卡片 */
  function scrollToMetric(key: string) {
    activeMetric.value = key
    nextTick(() => {
      document.getElementById(`metric-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

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
    await queryRefresh()
    await nextTick()
    scheduleChartSilentUpdate()
  }

  /** 最大化弹窗内调整时间范围：同步 timeRange，由下方 watch 触发静默刷新 */
  function onExpandTimeRangeChange(range: MetricsTimeRange) {
    timeRange.value = range
  }

  function goDatasource() {
    router.push({ name: 'MonitorDatasource' })
  }

  // 挂载即加载、卸载即停止
  onMounted(() => {
    if (props.clusterName) startRefresh(autoRefresh.value.intervalMs)
  })

  onUnmounted(() => {
    stopRefresh()
    if (chartAnimateTimer) clearTimeout(chartAnimateTimer)
  })

  // 集群名变化（如抽屉切换集群）：重置图表并按当前自动刷新间隔重新加载
  watch(clusterName, (name, prevName) => {
    if (name && name !== prevName) {
      resetCharts()
      chartSilentUpdate.value = false
      startRefresh(autoRefresh.value.intervalMs)
    }
  })

  // 切换时间/粒度：已有数据时静默刷新，避免整页闪白
  watch(
    () =>
      [
        timeRange.value.start.getTime(),
        timeRange.value.end.getTime(),
        granularity.value.key
      ] as const,
    ([start, end, granularityKey], [prevStart, prevEnd, prevGranularity]) => {
      if (prevStart !== start || prevEnd !== end || prevGranularity !== granularityKey) {
        void loadPanels(chartReady.value)
      }
    }
  )

  // 自动刷新间隔变化：重启定时器
  watch(
    () => autoRefresh.value.intervalMs,
    (intervalMs) => {
      if (props.clusterName) startRefresh(intervalMs)
    }
  )

  defineExpose({ refresh, metricsInitialLoading })
</script>

<style scoped>
  .resource-metrics-pane {
    min-height: 120px;
    padding-bottom: 16px;
    margin-top: 0;
  }

  /* 监控指标卡片：整体高度固定 195px，标题距上边框调小 5px */
  .resource-metrics-pane :deep(.metric-chart-panel) {
    display: flex;
    flex-direction: column;
    height: 195px;
    padding-top: 11px;
    overflow: hidden;
  }

  /* 图表区域填满卡片剩余高度（配合 ResizeObserver 自动 resize） */
  .resource-metrics-pane :deep(.metric-chart-panel .relative.w-full) {
    flex: 1;
    min-height: 0;
    height: auto !important;
  }

  .resource-metrics-pane__toolbar {
    margin-top: 10px;
    margin-bottom: 12px;
  }

  /* 工具栏视觉压缩：贴近监控台样式 */
  .resource-metrics-pane__toolbar :deep(.metrics-monitor-toolbar) {
    margin-bottom: 0;
  }

  .resource-metrics-pane__toolbar :deep(.metrics-monitor-toolbar__bar) {
    gap: 8px;
    justify-content: flex-end;
    padding: 0;
    border: none;
    border-radius: 0;
    background: transparent;
  }

  .resource-metrics-pane__toolbar :deep(.metrics-monitor-toolbar__divider) {
    height: 24px;
    background: var(--el-border-color-light);
    opacity: 1;
    margin: 0 2px;
  }

  .resource-metrics-pane__toolbar :deep(.metrics-time-range-picker) {
    width: 200px;
    min-width: 200px;
    max-width: 200px;
    transition: width 0.2s ease;
  }

  .resource-metrics-pane__toolbar :deep(.metrics-time-range-picker.is-custom-range) {
    width: 340px;
    min-width: 340px;
    max-width: 340px;
  }

  .resource-metrics-pane__toolbar :deep(.metrics-time-range-picker__trigger) {
    min-height: 32px;
    padding: 0 8px;
    border-color: var(--el-border-color);
    border-radius: 2px;
    background: var(--el-bg-color);
    font-size: 12px;
  }

  /* 隐藏内部 DatePicker 输入框，只保留自定义触发按钮（1小时） */
  .resource-metrics-pane__toolbar :deep(.metrics-time-range-picker__picker) {
    display: none !important;
  }

  .resource-metrics-pane__toolbar :deep(.metrics-monitor-toolbar__select .el-select__wrapper) {
    min-height: 32px;
    border-radius: 2px;
    box-shadow: 0 0 0 1px var(--el-border-color) inset;
    background: var(--el-bg-color);
    padding: 0 10px;
  }

  .resource-metrics-pane__toolbar :deep(.metrics-monitor-toolbar__group) {
    gap: 6px;
    align-items: center;
  }

  .resource-metrics-pane__toolbar :deep(.metrics-monitor-toolbar__group-label) {
    display: inline-flex;
    align-items: center;
    gap: 0;
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .resource-metrics-pane__toolbar :deep(.metrics-monitor-toolbar__group-icon) {
    display: none;
  }

  .resource-metrics-pane__toolbar :deep(.metrics-monitor-toolbar__select) {
    width: 92px;
  }

  .resource-metrics-pane__toolbar :deep(.metrics-monitor-toolbar__select--refresh) {
    width: 86px;
  }

  .resource-metrics-pane__toolbar :deep(.metrics-monitor-toolbar__legend) {
    margin-left: 6px;
    font-size: 12px;
    height: 32px;
    display: inline-flex;
    align-items: center;
  }

  .resource-metrics-pane__toolbar :deep(.metrics-monitor-toolbar__legend .el-checkbox__inner) {
    width: 14px;
    height: 14px;
    border-color: var(--el-border-color);
    border-radius: 2px;
  }

  .resource-metrics-pane__toolbar :deep(.metrics-monitor-toolbar__legend .el-checkbox__label) {
    font-size: 12px;
    padding-left: 5px;
    color: var(--el-text-color-primary);
  }

  .monitor-empty {
    margin-top: 48px;
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

  .chart-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  .metrics-menu-layout {
    display: grid;
    grid-template-columns: 120px minmax(0, 1fr);
    gap: 16px;
    align-items: stretch;
    max-height: calc(100vh - 220px);
  }

  .metrics-menu {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px 0;
    overflow-y: auto;
    border-right: 1px solid var(--el-border-color-lighter);
  }

  .metrics-menu__item {
    display: block;
    width: 100%;
    height: 32px;
    padding: 0 10px;
    font-size: 12px;
    line-height: 32px;
    color: var(--el-text-color-regular);
    text-align: left;
    cursor: pointer;
    border: 0;
    border-radius: 4px;
    background: transparent;
    transition: background-color 0.15s, color 0.15s;
  }

  .metrics-menu__item:hover {
    color: var(--theme-color);
    background: var(--el-fill-color-light);
  }

  .metrics-menu__item.is-active {
    color: var(--theme-color);
    font-weight: 600;
    background: var(--el-fill-color-light);
  }

  .metrics-menu-main {
    min-width: 0;
    max-height: calc(100vh - 220px);
    overflow-y: auto;
    scroll-behavior: smooth;
  }

  .metrics-menu-main :deep(.metric-chart-panel) {
    height: 260px;
  }

  .metrics-metric-block {
    scroll-margin-top: 12px;
  }

  .metrics-metric-block + .metrics-metric-block {
    margin-top: 16px;
  }
</style>

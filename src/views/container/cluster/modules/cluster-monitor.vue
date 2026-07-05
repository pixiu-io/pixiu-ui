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
            :loading="metricsInitialLoading"
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
    <div class="resource-metrics-pane">
      <MetricsMonitorToolbar
        v-model:timeRange="timeRange"
        v-model:granularity="granularity"
        v-model:autoRefresh="autoRefresh"
        v-model:showLegend="showLegend"
        class="resource-metrics-pane__toolbar"
      />

      <div class="tab-section-title">CPU</div>
      <div class="chart-grid">
        <MetricChartPanel
          v-for="item in cpuMetrics"
          :key="item.title"
          :title="item.title"
          :data="item.data"
          :x-axis-data="cpuTimeLabels"
          :is-empty="!item.data.length"
          :silent-update="chartSilentUpdate"
          :show-legend="showLegend"
        />
      </div>

      <div class="tab-section-title tab-section-title--spaced">内存</div>
      <div class="chart-grid">
        <MetricChartPanel
          v-for="item in memoryMetrics"
          :key="item.title"
          :title="item.title"
          :data="item.data"
          :x-axis-data="memoryTimeLabels"
          :is-empty="!item.data.length"
          :silent-update="chartSilentUpdate"
          :show-legend="showLegend"
        />
      </div>
    </div>
  </ElDrawer>
</template>

<script setup lang="ts">
  import { Close, Refresh } from '@element-plus/icons-vue'
  import MetricsMonitorToolbar from '@/components/container/metrics-monitor-toolbar.vue'
  import MetricChartPanel from '@/components/container/metric-chart-panel.vue'
  import { useClusterNodesUsageMetrics } from '@/hooks/kubernetes/useClusterNodesUsageMetrics'
  import {
    getDefaultMetricsAutoRefresh,
    type MetricsAutoRefreshOption
  } from '@/utils/metrics/auto-refresh'
  import {
    getDefaultMetricsGranularity,
    type MetricsGranularityOption
  } from '@/utils/metrics/granularity'
  import { getDefaultMetricsTimeRange } from '@/utils/metrics/time-range'

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

  const clusterName = computed(() => props.cluster?.name ?? '')
  const timeRange = ref(getDefaultMetricsTimeRange())
  const granularity = ref<MetricsGranularityOption>(getDefaultMetricsGranularity())
  const autoRefresh = ref<MetricsAutoRefreshOption>(getDefaultMetricsAutoRefresh())
  const showLegend = ref(true)

  const {
    loading: metricsLoading,
    chartReady: metricsChartReady,
    refresh,
    cpuTimeLabels,
    memoryTimeLabels,
    cpuMetrics,
    memoryMetrics,
    startRefresh,
    stopRefresh,
    resetCharts
  } = useClusterNodesUsageMetrics(clusterName, timeRange, granularity)

  /** 仅首次加载时展示 loading，手动/定时刷新不遮罩整页 */
  const metricsInitialLoading = computed(() => metricsLoading.value && !metricsChartReady.value)

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

  watch(metricsChartReady, (ready) => {
    if (ready && !chartSilentUpdate.value) scheduleChartSilentUpdate()
  })

  async function handleRefresh() {
    chartSilentUpdate.value = false
    await refresh()
    await nextTick()
    scheduleChartSilentUpdate()
  }

  function closeDrawer() {
    visible.value = false
  }

  watch(
    () => [visible.value, props.cluster?.name] as const,
    ([open, name]) => {
      if (open && name) {
        startRefresh(autoRefresh.value.intervalMs)
      } else {
        stopRefresh()
        resetCharts()
        chartSilentUpdate.value = false
        if (chartAnimateTimer) {
          clearTimeout(chartAnimateTimer)
          chartAnimateTimer = null
        }
      }
    }
  )

  watch(
    () =>
      [
        visible.value,
        timeRange.value.start.getTime(),
        timeRange.value.end.getTime(),
        granularity.value.key
      ] as const,
    ([open], [prevOpen, prevStart, prevEnd, prevGranularity]) => {
      if (!open) return
      if (
        !prevOpen ||
        prevStart !== timeRange.value.start.getTime() ||
        prevEnd !== timeRange.value.end.getTime() ||
        prevGranularity !== granularity.value.key
      ) {
        void handleRefresh()
      }
    }
  )

  watch(
    () => [visible.value, autoRefresh.value.intervalMs] as const,
    ([open, intervalMs], [prevOpen, prevIntervalMs]) => {
      if (!open) return
      if (!prevOpen || prevIntervalMs !== intervalMs) {
        startRefresh(intervalMs)
      }
    }
  )

  onUnmounted(() => {
    stopRefresh()
    if (chartAnimateTimer) clearTimeout(chartAnimateTimer)
  })
</script>

<style scoped>
  .cluster-monitor-drawer {
    font-size: 12px;
  }

  .cluster-monitor-drawer :deep(.el-drawer__header) {
    margin-bottom: 0;
    padding: 8px 20px 0;
  }

  .cluster-monitor-drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: 24px;
    padding-right: 4px;
  }

  .cluster-monitor-drawer-title {
    font-size: 14px;
    font-weight: 500;
    line-height: 1;
    color: var(--el-text-color-primary);
  }

  .cluster-monitor-drawer-actions {
    display: flex;
    align-items: center;
    gap: 0;
  }

  .cluster-monitor-drawer-actions
    .cluster-monitor-drawer-icon-btn
    + .cluster-monitor-drawer-icon-btn {
    margin-left: -4px;
  }

  .cluster-monitor-drawer-icon-btn {
    width: 28px;
    height: 28px;
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
    padding: 0 20px 16px;
  }

  .resource-metrics-pane {
    min-height: 120px;
    padding-bottom: 16px;
    margin-top: 0;
  }

  .resource-metrics-pane__toolbar {
    margin-top: 20px;
    margin-bottom: 12px;
  }

  /* 抽屉内工具栏视觉压缩：贴近监控台样式 */
  .resource-metrics-pane__toolbar :deep(.metrics-monitor-toolbar) {
    margin-bottom: 0;
  }

  .resource-metrics-pane__toolbar :deep(.metrics-monitor-toolbar__bar) {
    gap: 8px;
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
    padding: 0 12px;
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

  .chart-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
</style>

<style>
  /* ElDrawer 挂载到 body，需全局样式确保标题与工具栏间距生效 */
  .cluster-monitor-drawer.el-drawer .el-drawer__header {
    margin-bottom: 0 !important;
    padding: 8px 20px 0 !important;
  }

  .cluster-monitor-drawer.el-drawer .el-drawer__body {
    padding: 0 20px 16px !important;
  }
</style>

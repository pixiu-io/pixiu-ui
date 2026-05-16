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
    <div v-loading="metricsInitialLoading" class="resource-metrics-pane">
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
        />
      </div>
    </div>
  </ElDrawer>
</template>

<script setup lang="ts">
  import { Close, Refresh } from '@element-plus/icons-vue'
  import MetricChartPanel from '@/components/container/metric-chart-panel.vue'
  import { useClusterNodesUsageMetrics } from '@/hooks/kubernetes/useClusterNodesUsageMetrics'

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
  } = useClusterNodesUsageMetrics(clusterName)

  /** 仅首次加载时展示 loading，手动/定时刷新不遮罩整页 */
  const metricsInitialLoading = computed(
    () => metricsLoading.value && !metricsChartReady.value
  )

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
        startRefresh()
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
    padding-top: 16px;
    padding-bottom: 0;
  }

  .cluster-monitor-drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding-right: 4px;
  }

  .cluster-monitor-drawer-title {
    font-size: 14px;
    font-weight: 500;
    line-height: 1.2;
    color: var(--el-text-color-primary);
  }

  .cluster-monitor-drawer-actions {
    display: flex;
    align-items: center;
    gap: 0;
  }

  .cluster-monitor-drawer-actions .cluster-monitor-drawer-icon-btn + .cluster-monitor-drawer-icon-btn {
    margin-left: -4px;
  }

  .cluster-monitor-drawer-icon-btn {
    width: 32px;
    height: 32px;
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
    padding-top: 0;
  }

  .resource-metrics-pane {
    min-height: 120px;
    padding-bottom: 16px;
    margin-top: -20px;
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

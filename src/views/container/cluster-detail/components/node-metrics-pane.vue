<!-- 节点详情 - 监控指标（与集群监控抽屉同源展示） -->
<template>
  <div class="node-metrics-pane" v-loading="metricsInitialLoading">
    <div class="node-metrics-pane__section-head">
      <div class="tab-section-title tab-section-title--first">CPU</div>
      <ElButton
        text
        circle
        class="node-metrics-pane__refresh"
        title="刷新"
        :loading="metricsInitialLoading"
        @click="handleRefresh"
      >
        <ElIcon :size="16"><Refresh /></ElIcon>
      </ElButton>
    </div>
    <div class="chart-grid">
      <MetricChartPanel
        v-for="item in cpuMetrics"
        :key="item.title"
        :title="item.title"
        :data="item.data"
        :x-axis-data="cpuTimeLabels"
        :is-empty="!item.data.length"
        :silent-update="chartSilentUpdate"
        :expand-time-range="usageTimeRange"
        @expand-time-range-change="onUsageTimeRangeChange"
        height="120px"
        :axis-font-size="10"
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
        :expand-time-range="usageTimeRange"
        @expand-time-range-change="onUsageTimeRangeChange"
        height="120px"
        :axis-font-size="10"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Refresh } from '@element-plus/icons-vue'
  import MetricChartPanel from '@/components/container/metric-chart-panel.vue'
  import { useNodeUsageMetrics } from '@/hooks/kubernetes/useNodeUsageMetrics'
  import type { K8sNode } from '@/api/kubernetes/node'
  import {
    getDefaultMetricsTimeRange,
    METRICS_TIME_PRESETS,
    type MetricsTimeRange
  } from '@/utils/metrics/time-range'

  const props = defineProps<{
    cluster: string
    nodeName: string
    node: K8sNode | null
    /** 当前 Tab 是否激活 */
    active?: boolean
  }>()

  const clusterRef = computed(() => props.cluster)
  const nodeNameRef = computed(() => props.nodeName)
  const nodeRef = computed(() => props.node)

  /** 监控时间范围：默认最近 24 小时；最大化弹窗内可调整，由 hook 内 watch 触发重新查询 */
  const usageTimeRange = ref<MetricsTimeRange>(
    METRICS_TIME_PRESETS.find((p) => p.key === '24h')?.getRange(new Date()) ??
      getDefaultMetricsTimeRange()
  )

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
  } = useNodeUsageMetrics(clusterRef, nodeNameRef, nodeRef, usageTimeRange)

  const metricsInitialLoading = computed(() => metricsLoading.value && !metricsChartReady.value)

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

  /** 最大化弹窗内调整时间范围：更新 usageTimeRange，hook 内 watch 触发静默刷新 */
  function onUsageTimeRangeChange(range: MetricsTimeRange) {
    usageTimeRange.value = range
  }

  watch(
    () =>
      [
        props.active,
        props.cluster,
        props.nodeName,
        props.node?.metadata?.name,
        props.node?.status?.allocatable?.cpu
      ] as const,
    ([active, cluster, nodeName]) => {
      if (active && cluster && nodeName) {
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
    },
    { immediate: true }
  )

  onUnmounted(() => {
    stopRefresh()
    if (chartAnimateTimer) clearTimeout(chartAnimateTimer)
  })
</script>

<style scoped>
  .node-metrics-pane {
    min-height: 200px;
    padding-top: 0;
  }

  .node-metrics-pane__section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
  }

  .node-metrics-pane__refresh {
    flex-shrink: 0;
    margin: -4px 0 0;
  }

  .tab-section-title {
    margin: 0 0 12px;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.5;
    color: var(--el-text-color-primary);
  }

  .tab-section-title--first {
    margin-bottom: 0;
  }

  .tab-section-title--spaced {
    margin-top: 16px;
  }

  .chart-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  @media (max-width: 992px) {
    .chart-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

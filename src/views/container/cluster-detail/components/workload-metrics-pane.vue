<!-- Workload 详情 - 监控指标（多 Pod 折线，样式与节点监控一致） -->
<template>
  <div class="workload-metrics-pane" v-loading="metricsInitialLoading">
    <div class="workload-metrics-pane__section-head">
      <div class="tab-section-title tab-section-title--first">CPU</div>
      <ElButton
        text
        circle
        class="workload-metrics-pane__refresh"
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
        :is-empty="isChartEmpty(item.data)"
        :silent-update="chartSilentUpdate"
        :show-legend="isMultiSeriesData(item.data)"
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
        :is-empty="isChartEmpty(item.data)"
        :silent-update="chartSilentUpdate"
        :show-legend="isMultiSeriesData(item.data)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Refresh } from '@element-plus/icons-vue'
  import MetricChartPanel from '@/components/container/metric-chart-panel.vue'
  import {
    isMultiSeriesData,
    useWorkloadPodsUsageMetrics
  } from '@/hooks/kubernetes/useWorkloadPodsUsageMetrics'
  import type { LineDataItem } from '@/types/component/chart'

  const props = defineProps<{
    cluster: string
    namespace: string
    labelSelector?: string
    /** 固定 Pod 名称列表（Pod 详情等场景） */
    podNames?: string[]
    active?: boolean
  }>()

  const clusterRef = computed(() => props.cluster)
  const namespaceRef = computed(() => props.namespace)
  const selectorRef = computed(() => props.labelSelector ?? '')
  const podNamesRef = computed(() => props.podNames ?? [])

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
  } = useWorkloadPodsUsageMetrics(clusterRef, namespaceRef, selectorRef, podNamesRef)

  const metricsInitialLoading = computed(
    () => metricsLoading.value && !metricsChartReady.value
  )

  const chartSilentUpdate = ref(false)
  let chartAnimateTimer: ReturnType<typeof setTimeout> | null = null

  function isChartEmpty(data: number[] | LineDataItem[]) {
    if (!Array.isArray(data) || !data.length) return true
    if (isMultiSeriesData(data)) {
      return data.every((s) => !s.data?.length || s.data.every((v) => v == null || v === 0))
    }
    return data.every((v) => v === 0)
  }

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

  watch(
    () =>
      [
        props.active,
        props.cluster,
        props.namespace,
        props.labelSelector,
        (props.podNames ?? []).join(',')
      ] as const,
    ([active, cluster, namespace]) => {
      const hasTarget =
        Boolean(props.podNames?.length) || Boolean(String(props.labelSelector ?? '').trim())
      if (active && cluster && namespace && hasTarget) {
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
  .workload-metrics-pane {
    min-height: 200px;
    padding-top: 0;
  }

  .workload-metrics-pane__section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
  }

  .workload-metrics-pane__refresh {
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
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }

  @media (max-width: 1200px) {
    .chart-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

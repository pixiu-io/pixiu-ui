<!-- 监控指标卡片：标题 + 右上角最大化 + 折线图 -->
<template>
  <div class="metric-chart-panel" :class="{ 'metric-chart-panel--plain': plain }">
    <div class="metric-chart-panel__header">
      <span class="metric-chart-panel__title">{{ title }}</span>
      <ElButton
        text
        circle
        class="metric-chart-panel__maximize"
        title="最大化"
        @click="expandedVisible = true"
      >
        <ElIcon :size="14"><FullScreen /></ElIcon>
      </ElButton>
    </div>
    <ArtLineChart
      :height="height"
      :data="data"
      :x-axis-data="xAxisData"
      :show-area-color="showAreaColor"
      :smooth="smooth"
      :line-width="lineWidth"
      :is-empty="isEmpty"
      :silent-update="silentUpdate"
      :show-legend="showLegend"
      :axis-font-size="axisFontSize"
      :max-x-axis-labels="maxXAxisLabels"
    />

    <ElDialog
      v-model="expandedVisible"
      :title="title"
      width="72%"
      top="8vh"
      destroy-on-close
      append-to-body
      class="metric-chart-panel-dialog"
    >
      <div v-if="props.expandTimeRange != null" class="metric-chart-panel-dialog__toolbar">
        <MetricsTimeRangePicker v-model="expandRange" />
      </div>
      <ArtLineChart
        :height="expandedHeight"
        :data="data"
        :x-axis-data="xAxisData"
        :show-area-color="showAreaColor"
        :smooth="smooth"
        :line-width="lineWidth"
        :is-empty="isEmpty"
        :silent-update="true"
        :show-legend="showLegend"
        :axis-font-size="axisFontSize"
        :max-x-axis-labels="maxXAxisLabels"
      />
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { FullScreen } from '@element-plus/icons-vue'
  import ArtLineChart from '@/components/core/charts/art-line-chart/index.vue'
  import MetricsTimeRangePicker from './metrics-time-range-picker.vue'
  import { getDefaultMetricsTimeRange, type MetricsTimeRange } from '@/utils/metrics/time-range'
  import type { LineDataItem } from '@/types/component/chart'

  const props = withDefaults(
    defineProps<{
      title: string
      data: number[] | LineDataItem[]
      xAxisData: string[]
      height?: string
      expandedHeight?: string
      showAreaColor?: boolean
      smooth?: boolean
      lineWidth?: number
      isEmpty?: boolean
      silentUpdate?: boolean
      showLegend?: boolean
      /** 无描边卡片（节点监控等场景） */
      plain?: boolean
      /** 坐标轴标签字号（px），透传给折线图 */
      axisFontSize?: number
      /** x 轴标签最大显示数量，透传给折线图 */
      maxXAxisLabels?: number
      /** 最大化弹窗内时间范围，未传则不显示时间调整 */
      expandTimeRange?: MetricsTimeRange
    }>(),
    {
      height: '180px',
      expandedHeight: '400px',
      showAreaColor: true,
      smooth: true,
      lineWidth: 1,
      isEmpty: false,
      silentUpdate: false,
      showLegend: false,
      plain: false
    }
  )

  const emit = defineEmits<{
    (e: 'expandTimeRangeChange', range: MetricsTimeRange): void
  }>()

  /** 最大化弹窗内时间范围双向绑定：未传 expandTimeRange 时不渲染选择器 */
  const expandRange = computed<MetricsTimeRange>({
    get: () => props.expandTimeRange ?? getDefaultMetricsTimeRange(),
    set: (v) => emit('expandTimeRangeChange', v)
  })

  const expandedVisible = ref(false)
</script>

<style scoped>
  .metric-chart-panel {
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    padding: 16px;
    background: var(--el-bg-color);
  }

  .metric-chart-panel--plain {
    border: none;
    border-radius: 0;
    padding: 0;
    background: transparent;
  }

  .metric-chart-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }

  .metric-chart-panel__title {
    flex: 1;
    min-width: 0;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.5;
    color: var(--el-text-color-primary);
  }

  .metric-chart-panel--plain .metric-chart-panel__title {
    font-size: 12px;
    font-weight: 600;
  }

  .metric-chart-panel__maximize {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    padding: 0;
    margin: -4px -4px 0 0;
    color: var(--el-text-color-secondary);
  }

  .metric-chart-panel__maximize:hover {
    color: var(--el-text-color-primary);
  }

  .metric-chart-panel :deep(text) {
    font-size: 12px;
  }
</style>

<style>
  .metric-chart-panel-dialog .el-dialog__body {
    padding-top: 8px;
    padding-bottom: 24px;
  }

  .metric-chart-panel-dialog .metric-chart-panel-dialog__toolbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 12px;
  }

  /* 最大化弹窗内时间选择器与监控抽屉一致（240px，靠右） */
  .metric-chart-panel-dialog .metrics-time-range-picker {
    width: 240px !important;
    min-width: 240px !important;
    max-width: 240px !important;
    flex: none;
  }
</style>

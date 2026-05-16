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
      />
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { FullScreen } from '@element-plus/icons-vue'
  import ArtLineChart from '@/components/core/charts/art-line-chart/index.vue'

  withDefaults(
    defineProps<{
      title: string
      data: number[]
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
    font-size: 14px;
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
</style>

<template>
  <div class="workbench-resource">
    <div class="workbench-resource__head">
      <div class="workbench-resource__title-wrap">
        <span class="workbench-resource__title">系统资源</span>
        <ElTooltip content="运行中集群 Prometheus 指标聚合" placement="top">
          <ElIcon class="workbench-resource__info" :size="13"><InfoFilled /></ElIcon>
        </ElTooltip>
        <span v-if="updatedText" class="workbench-resource__updated">最后更新：{{ updatedText }}</span>
      </div>
      <button type="button" class="workbench-resource__link" @click="emit('view-detail')">
        查看详情
        <ElIcon :size="12"><ArrowRight /></ElIcon>
      </button>
    </div>

    <div class="workbench-resource__body">
      <div
        v-for="item in metricRows"
        :key="item.key"
        class="workbench-resource__row"
      >
        <span class="workbench-resource__icon" :style="{ color: item.color, background: item.iconBg }">
          <ElIcon :size="14"><component :is="item.icon" /></ElIcon>
        </span>

        <div class="workbench-resource__content">
          <div class="workbench-resource__top">
            <span class="workbench-resource__name">{{ item.label }}</span>
            <span class="workbench-resource__capacity">{{ item.capacityText }}</span>
            <span class="workbench-resource__percent">{{ item.percentText }}</span>
          </div>
          <div class="workbench-resource__bar">
            <div
              class="workbench-resource__bar-fill"
              :style="{ width: `${item.percent}%`, background: item.color }"
            />
          </div>
        </div>
      </div>

      <div class="workbench-resource__row workbench-resource__row--network">
        <div class="workbench-resource__lead">
          <span
            class="workbench-resource__icon"
            :style="{ color: networkTheme.color, background: networkTheme.iconBg }"
          >
            <ElIcon :size="14"><Connection /></ElIcon>
          </span>
          <div class="workbench-resource__lead-text">
            <span class="workbench-resource__name">网络</span>
            <div class="workbench-resource__net-rate">
              <span>↑ {{ formatNetRate(summary.netTxMbps) }}</span>
              <span>↓ {{ formatNetRate(summary.netRxMbps) }}</span>
            </div>
          </div>
        </div>

        <div class="workbench-resource__network-chart" v-loading="trendLoading">
          <ArtLineChart
            height="40px"
            :data="networkChartData"
            :x-axis-data="networkTrendLabels"
            :colors="['#5b8def', '#7c6af0']"
            :show-area-color="true"
            :show-axis-label="false"
            :show-axis-line="false"
            :show-split-line="false"
            :show-tooltip="false"
            :smooth="true"
            :line-width="1.5"
            :is-empty="!networkTrendValues.length"
            :silent-update="true"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ArrowRight, Coin, Connection, Cpu, DataLine, InfoFilled } from '@element-plus/icons-vue'
  import { computed, type Component } from 'vue'
  import ArtLineChart from '@/components/core/charts/art-line-chart/index.vue'
  import type { WorkbenchResourceSummary } from '../useWorkbenchPage'

  const props = defineProps<{
    trendLoading?: boolean
    summary: WorkbenchResourceSummary
    lastUpdatedAt: number | null
    cpuTrendValues: number[]
    memoryTrendValues: number[]
    diskTrendValues: number[]
    networkTrendLabels: string[]
    networkTrendValues: number[]
    networkTxTrendValues: number[]
    networkRxTrendValues: number[]
  }>()

  const emit = defineEmits<{
    'view-detail': []
  }>()

  const networkTheme = {
    color: '#5b8def',
    iconBg: 'rgba(91, 141, 239, 0.12)'
  }

  const updatedText = computed(() => formatRelativeTime(props.lastUpdatedAt))

  const networkChartData = computed(() => {
    if (props.networkTxTrendValues.length || props.networkRxTrendValues.length) {
      return [
        { name: '发送', data: props.networkTxTrendValues },
        { name: '接收', data: props.networkRxTrendValues }
      ]
    }
    return [{ name: '带宽', data: props.networkTrendValues }]
  })

  type MetricRow = {
    key: string
    label: string
    icon: Component
    color: string
    iconBg: string
    percent: number
    percentText: string
    capacityText: string
  }

  const metricRows = computed<MetricRow[]>(() => {
    const s = props.summary
    return [
      {
        key: 'cpu',
        label: 'CPU',
        icon: Cpu,
        color: '#409eff',
        iconBg: 'rgba(64, 158, 255, 0.12)',
        percent: clampPercent(s.cpuAvg),
        percentText: formatPercent(s.cpuAvg),
        capacityText:
          s.cpuTotalCores === null
            ? '-'
            : `${formatCores(s.cpuTotalCores)}`
      },
      {
        key: 'memory',
        label: '内存',
        icon: Coin,
        color: '#7c6af0',
        iconBg: 'rgba(124, 106, 240, 0.12)',
        percent: clampPercent(s.memAvg),
        percentText: formatPercent(s.memAvg),
        capacityText: formatMemoryCapacity(s.memoryUsedGiB, s.memoryTotalGiB)
      },
      {
        key: 'disk',
        label: '磁盘',
        icon: DataLine,
        color: '#67c23a',
        iconBg: 'rgba(103, 194, 58, 0.12)',
        percent: clampPercent(s.diskAvg),
        percentText: formatPercent(s.diskAvg),
        capacityText: formatDiskCapacity(s.diskUsedGiB, s.diskTotalGiB, s.diskAvg)
      }
    ]
  })

  function clampPercent(value: number | null): number {
    if (value === null || !Number.isFinite(value)) return 0
    return Math.max(0, Math.min(100, value))
  }

  function formatPercent(value: number | null): string {
    return value === null ? '-' : `${value.toFixed(1)}%`
  }

  function formatCores(value: number): string {
    const digits = Number.isInteger(value) || value >= 10 ? 0 : 1
    return `${value.toFixed(digits)} 核心`
  }

  function formatGiB(value: number | null, digits = 1): string {
    if (value === null || !Number.isFinite(value)) return '-'
    return `${value.toFixed(digits)} GB`
  }

  function formatMemoryCapacity(used: number | null, total: number | null): string {
    if (used === null || total === null) return '-'
    return `${formatGiB(used)} / ${formatGiB(total)}`
  }

  function formatDiskCapacity(used: number | null, total: number | null, percent: number | null): string {
    if (used !== null && total !== null) return `${formatGiB(used)} / ${formatGiB(total)}`
    if (percent !== null) return `使用率 ${percent.toFixed(1)}%`
    return '-'
  }

  function formatNetRate(mbps: number | null): string {
    if (mbps === null || !Number.isFinite(mbps)) return '-'
    if (mbps >= 1024) return `${(mbps / 1024).toFixed(1)} GB/s`
    if (mbps >= 1) return `${mbps.toFixed(1)} MB/s`
    if (mbps >= 0.01) return `${(mbps * 1024).toFixed(1)} KB/s`
    return `${mbps.toFixed(2)} MB/s`
  }

  function formatRelativeTime(timestamp: number | null): string {
    if (!timestamp) return ''
    const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
    if (diffSec < 60) return '刚刚'
    const minutes = Math.floor(diffSec / 60)
    if (minutes < 60) return `${minutes} 分钟前`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} 小时前`
    return `${Math.floor(hours / 24)} 天前`
  }
</script>

<style scoped lang="scss">
  .workbench-resource {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .workbench-resource__head {
    display: flex;
    flex-shrink: 0;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 15px;
  }

  .workbench-resource__title-wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    min-width: 0;
  }

  .workbench-resource__title {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .workbench-resource__info {
    color: var(--el-text-color-placeholder);
    cursor: help;
  }

  .workbench-resource__updated {
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }

  .workbench-resource__link {
    display: inline-flex;
    flex-shrink: 0;
    gap: 2px;
    align-items: center;
    padding: 0;
    font-size: 12px;
    line-height: 1;
    color: var(--el-color-primary);
    cursor: pointer;
    background: transparent;
    border: none;

    &:hover {
      opacity: 0.85;
    }
  }

  .workbench-resource__body {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    min-height: 0;
  }

  .workbench-resource__row {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 6px 0;

    &:first-child {
      padding-top: 0;
    }
  }

  .workbench-resource__row--network {
    align-items: center;
    padding-top: 6px;
    padding-bottom: 0;
  }

  .workbench-resource__icon {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
  }

  .workbench-resource__content {
    flex: 1;
    min-width: 0;
  }

  .workbench-resource__top {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 6px;
  }

  .workbench-resource__lead {
    display: flex;
    flex: 1;
    gap: 8px;
    align-items: flex-start;
    min-width: 0;
  }

  .workbench-resource__lead-text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .workbench-resource__name {
    flex-shrink: 0;
    font-size: 12px;
    font-weight: 400;
    line-height: 1.2;
    color: #29343d;
  }

  .workbench-resource__capacity {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-size: 11px;
    line-height: 1.2;
    color: var(--el-text-color-secondary);
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .workbench-resource__bar {
    width: 100%;
    height: 6px;
    overflow: hidden;
    background: var(--el-fill-color);
    border-radius: 999px;
  }

  .workbench-resource__bar-fill {
    height: 100%;
    border-radius: inherit;
    transition: width 0.3s ease;
  }

  .workbench-resource__percent {
    flex-shrink: 0;
    font-size: 13px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--el-text-color-primary);
    text-align: right;
  }

  .workbench-resource__net-rate {
    display: flex;
    flex-direction: row;
    gap: 10px;
    font-size: 10px;
    line-height: 1.2;
    color: var(--el-text-color-regular);
    white-space: nowrap;
  }

  .workbench-resource__network-chart {
    flex: 1;
    min-width: 0;
    height: 40px;
  }
</style>

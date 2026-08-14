<template>
  <article class="dashboard-panel" :class="[`is-${panel.kind}`, `span-${panel.span}`]">
    <header class="dashboard-panel__header">
      <div class="dashboard-panel__heading">
        <h3>{{ panel.title }}</h3>
        <ElTooltip v-if="panel.description" :content="panel.description" placement="top">
          <ElIcon class="dashboard-panel__info"><InfoFilled /></ElIcon>
        </ElTooltip>
      </div>
      <span v-if="loading" class="dashboard-panel__refreshing">
        <ElIcon class="is-loading"><Loading /></ElIcon>
        更新中
      </span>
      <span v-else-if="result?.status === 'success'" class="dashboard-panel__live">实时</span>
    </header>

    <div v-if="loading && !result" class="dashboard-panel__state">
      <ElIcon class="is-loading dashboard-panel__loading"><Loading /></ElIcon>
      <span>正在查询</span>
    </div>

    <div v-else-if="!result || result.status !== 'success'" class="dashboard-panel__state">
      <div class="dashboard-panel__empty-icon" :class="result?.status || 'no_data'">
        <ElIcon><DataAnalysis /></ElIcon>
      </div>
      <strong>{{ stateTitle }}</strong>
      <span>{{ stateMessage }}</span>
      <ElTooltip v-if="result?.status === 'error'" :content="result.message || ''">
        <button class="dashboard-panel__error-detail" type="button">查看原因</button>
      </ElTooltip>
    </div>

    <div v-else-if="panel.kind === 'stat'" class="dashboard-panel__stat">
      <strong>{{ formatValue(primaryValue, panel.unit) }}</strong>
      <span>{{ statCaption }}</span>
    </div>

    <div v-else-if="panel.kind === 'gauge'" class="dashboard-panel__gauge-wrap">
      <div class="dashboard-panel__gauge" :style="gaugeStyle">
        <div class="dashboard-panel__gauge-center">
          <strong>{{ formatValue(primaryValue, panel.unit) }}</strong>
          <span>当前值</span>
        </div>
      </div>
      <div class="dashboard-panel__gauge-scale"><span>0%</span><span>100%</span></div>
    </div>

    <div v-else-if="panel.kind === 'status'" class="dashboard-panel__status-list">
      <div v-for="item in statusItems" :key="item.name" class="dashboard-panel__status-item">
        <span class="dashboard-panel__status-dot" :class="item.healthy ? 'healthy' : 'warning'" />
        <span class="dashboard-panel__status-name" :title="item.name">{{ item.name }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </div>

    <div
      v-else
      class="dashboard-panel__chart-shell"
      @pointerdown.capture="startChartRangeSelection"
      @pointermove.capture="handleChartMouseMove"
      @pointerup.capture="finishChartRangeSelection"
      @mousedown.capture="startChartRangeSelection"
      @mousemove.capture="handleChartMouseMove"
      @mouseup.capture="finishChartRangeSelection"
      @mouseleave="handleChartMouseLeave"
      @pointerleave="hideChartTooltip"
    >
      <div ref="chartRef" class="dashboard-panel__chart" />
      <div
        v-if="rangeSelection"
        class="dashboard-panel__range-selection"
        :style="rangeSelectionStyle"
      />
    </div>
  </article>
</template>

<script setup lang="ts">
  import { DataAnalysis, InfoFilled, Loading } from '@element-plus/icons-vue'
  import type { CSSProperties } from 'vue'
  import type { EChartsOption } from '@/plugins/echarts'
  import { useChart } from '@/hooks/core/useChart'
  import type {
    DashboardPanelDefinition,
    DashboardPanelResult,
    DashboardSeries
  } from '@/api/dashboard'

  const props = defineProps<{
    panel: DashboardPanelDefinition
    result?: DashboardPanelResult
    loading?: boolean
  }>()
  const emit = defineEmits<{
    timeRangeSelect: [range: { start: number; end: number }]
  }>()

  const { chartRef, initChart, isDark, getTooltipStyle, getChartInstance } = useChart()
  const rangeSelection = ref<{ left: number; width: number } | null>(null)
  const rangeSelectionStyle = computed<CSSProperties>(() => ({
    left: `${rangeSelection.value?.left ?? 0}px`,
    width: `${rangeSelection.value?.width ?? 0}px`
  }))
  let dragStartX: number | null = null

  const primaryValue = computed(() => {
    const value = Number(props.result?.series?.[0]?.values?.at(-1)?.value)
    return Number.isFinite(value) ? value : 0
  })

  const stateTitle = computed(() => {
    if (props.result?.status === 'metric_missing') return '指标未采集'
    if (props.result?.status === 'error') return '查询失败'
    return '暂无数据'
  })

  const stateMessage = computed(() => {
    if (props.result?.status === 'metric_missing') return '当前 Prometheus 缺少所需指标'
    if (props.result?.status === 'error') return '该面板暂时无法显示'
    return '当前筛选范围没有匹配结果'
  })

  const statCaption = computed(() => {
    const metric = props.result?.series?.[0]?.metric ?? {}
    return metric.namespace || metric.node || metric.pod || '当前集群'
  })

  const gaugeValue = computed(() => Math.max(0, Math.min(100, primaryValue.value)))
  const gaugeColor = computed(() =>
    gaugeValue.value >= 85 ? '#e45757' : gaugeValue.value >= 70 ? '#d99a2b' : '#2e9b62'
  )
  const gaugeStyle = computed<CSSProperties>(() => ({
    background: `conic-gradient(${gaugeColor.value} ${gaugeValue.value * 3.6}deg, var(--el-fill-color-dark) 0deg)`
  }))

  const statusItems = computed(() =>
    (props.result?.series ?? []).slice(0, 10).map((series) => {
      const value = Number(series.values.at(-1)?.value ?? 0)
      const phase = series.metric.phase || series.metric.condition || ''
      return {
        name: seriesLabel(series),
        value: phase || formatValue(value, props.panel.unit),
        healthy: value > 0 && !['Failed', 'Pending', 'Lost'].includes(phase)
      }
    })
  )

  function seriesLabel(series: DashboardSeries): string {
    const labels = series.metric
    const resource =
      labels.pod ||
      labels.node ||
      labels.namespace ||
      labels.persistentvolumeclaim ||
      labels.deployment ||
      labels.statefulset ||
      labels.daemonset ||
      labels.operation_type ||
      labels.instance
    if (resource) return resource
    const keys = Object.keys(labels).filter((key) => key !== '__name__')
    return keys.length ? keys.map((key) => `${key}=${labels[key]}`).join(', ') : '当前值'
  }

  function formatValue(value: number, unit?: string): string {
    if (!Number.isFinite(value)) return '-'
    if (unit === 'percent') return `${value.toFixed(value >= 10 ? 1 : 2)}%`
    if (unit === 'bytes' || unit === 'Bps') {
      const suffix = unit === 'Bps' ? '/s' : ''
      const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
      let current = Math.abs(value)
      let index = 0
      while (current >= 1024 && index < units.length - 1) {
        current /= 1024
        index += 1
      }
      return `${(value < 0 ? -current : current).toFixed(index === 0 ? 0 : 1)} ${units[index]}${suffix}`
    }
    if (unit === 'cores') return `${value.toFixed(value >= 10 ? 1 : 3)} 核`
    if (unit === 'ops') {
      const absolute = Math.abs(value)
      const digits = absolute >= 1 ? 2 : absolute >= 0.01 ? 3 : 4
      return `${value.toFixed(digits)}/s`
    }
    return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value)
  }

  function tooltipPosition(point: number[], size: { contentSize: number[] }): number[] {
    const gap = 12
    const bounds = chartRef.value?.getBoundingClientRect()
    const chartLeft = bounds?.left ?? 0
    const chartTop = bounds?.top ?? 0
    const [contentWidth, contentHeight] = size.contentSize

    let left = point[0] + gap
    let top = point[1] + gap
    if (chartLeft + left + contentWidth > window.innerWidth - gap) {
      left = point[0] - contentWidth - gap
    }
    if (chartTop + top + contentHeight > window.innerHeight - gap) {
      top = point[1] - contentHeight - gap
    }

    left = Math.min(
      Math.max(left, gap - chartLeft),
      window.innerWidth - contentWidth - gap - chartLeft
    )
    top = Math.min(
      Math.max(top, gap - chartTop),
      window.innerHeight - contentHeight - gap - chartTop
    )
    return [left, top]
  }

  function chartOption(): EChartsOption {
    const source = props.result?.series ?? []
    const textColor = isDark.value ? '#c8ccd4' : '#5c6370'
    const splitColor = isDark.value ? '#30343b' : '#edf0f3'
    const colors = ['#2878d4', '#2e9b62', '#d99a2b', '#8c62c7', '#d45f75', '#2c9ea0']
    const tooltip = (unit?: string) =>
      getTooltipStyle('axis', {
        appendTo: 'body',
        confine: false,
        enterable: false,
        hideDelay: 100,
        extraCssText: 'max-width: min(420px, calc(100vw - 24px)); z-index: 3000;',
        position: (
          point: number[],
          _params: unknown,
          _dom: HTMLElement,
          _rect: unknown,
          size: any
        ) => tooltipPosition(point, size),
        valueFormatter: (value: number) => formatValue(value, unit)
      })

    if (props.panel.kind === 'line') {
      const isRuntimeErrorRate = props.panel.id === 'kubelet.error_rate'
      return {
        color: colors,
        animationDuration: 450,
        tooltip: tooltip(props.panel.unit),
        grid: { left: 14, right: 18, top: 24, bottom: 30, containLabel: true },
        xAxis: {
          type: 'time',
          axisLine: { lineStyle: { color: splitColor } },
          axisLabel: { color: textColor, hideOverlap: true }
        },
        yAxis: {
          type: 'value',
          axisLabel: {
            color: textColor,
            formatter: (value: number) => formatValue(value, props.panel.unit)
          },
          splitLine: { lineStyle: { color: splitColor, type: 'dashed' } }
        },
        series: source.slice(0, 8).map((item) => ({
          name: seriesLabel(item),
          type: 'line',
          showSymbol: false,
          smooth: !isRuntimeErrorRate,
          step: isRuntimeErrorRate ? 'end' : false,
          lineStyle: { width: 2 },
          data: item.values.map((point) => [point.timestamp * 1000, Number(point.value)])
        }))
      }
    }

    const rows = source
      .map((item) => ({ name: seriesLabel(item), value: Number(item.values.at(-1)?.value ?? 0) }))
      .filter((item) => Number.isFinite(item.value))
      .slice(0, 10)
      .reverse()
    const isContainerFilesystem = props.panel.id === 'storage.container_fs'
    return {
      color: colors,
      animationDuration: 450,
      tooltip: tooltip(props.panel.unit),
      grid: {
        left: 168,
        right: 30,
        top: 16,
        bottom: 22
      },
      xAxis: {
        type: 'value',
        splitNumber: isContainerFilesystem ? 3 : 4,
        axisLabel: {
          color: textColor,
          hideOverlap: true,
          formatter: (value: number) => formatValue(value, props.panel.unit)
        },
        splitLine: { lineStyle: { color: splitColor, type: 'dashed' } }
      },
      yAxis: {
        type: 'category',
        data: rows.map((item) => item.name),
        axisLabel: {
          color: textColor,
          width: 140,
          overflow: 'truncate',
          align: 'left',
          margin: 150
        },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      series: [
        {
          type: 'bar',
          data: rows.map((item) => item.value),
          barMaxWidth: 18,
          itemStyle: { borderRadius: [0, 3, 3, 0] }
        }
      ]
    }
  }

  function hideChartTooltip() {
    chartPointerActive = false
    const chart = getChartInstance()
    chart?.dispatchAction({ type: 'hideTip' })
    chart?.dispatchAction({ type: 'updateAxisPointer', currTrigger: 'leave' })
  }

  let chartPointerActive = false

  function markChartPointerActive() {
    chartPointerActive = true
  }

  function chartRelativeX(event: MouseEvent): number | null {
    const bounds = chartRef.value?.getBoundingClientRect()
    if (!bounds || event.clientX < bounds.left || event.clientX > bounds.right) return null
    return Math.max(0, Math.min(bounds.width, event.clientX - bounds.left))
  }

  function startChartRangeSelection(event: MouseEvent) {
    if (props.panel.kind !== 'line' || event.button !== 0) return
    const bounds = chartRef.value?.getBoundingClientRect()
    const x = chartRelativeX(event)
    if (!bounds || x === null) return
    const y = event.clientY - bounds.top
    if (y < 24 || y > bounds.height - 30) return
    dragStartX = x
    rangeSelection.value = { left: x, width: 0 }
    if ('pointerId' in event && event.currentTarget instanceof HTMLElement) {
      event.currentTarget.setPointerCapture((event as PointerEvent).pointerId)
    }
    event.preventDefault()
    hideChartTooltip()
  }

  function handleChartMouseMove(event: MouseEvent) {
    markChartPointerActive()
    if (dragStartX === null) return
    const x = chartRelativeX(event)
    if (x === null) return
    const left = Math.min(dragStartX, x)
    rangeSelection.value = { left, width: Math.abs(x - dragStartX) }
    event.preventDefault()
  }

  function finishChartRangeSelection(event?: MouseEvent) {
    if (dragStartX === null) return
    if (event) handleChartMouseMove(event)
    const selection = rangeSelection.value
    const chart = getChartInstance()
    dragStartX = null
    rangeSelection.value = null
    if (!chart || !selection || selection.width < 8) return

    const startValue = Number(chart.convertFromPixel({ xAxisIndex: 0 }, selection.left))
    const endValue = Number(
      chart.convertFromPixel({ xAxisIndex: 0 }, selection.left + selection.width)
    )
    if (!Number.isFinite(startValue) || !Number.isFinite(endValue) || startValue === endValue)
      return
    emit('timeRangeSelect', {
      start: Math.min(startValue, endValue),
      end: Math.max(startValue, endValue)
    })
  }

  function finishChartPointerSelection(event: PointerEvent) {
    finishChartRangeSelection(event)
  }

  function handleChartMouseLeave() {
    hideChartTooltip()
  }

  function hideTooltipOutsideChart(event: MouseEvent) {
    if (!chartPointerActive || !chartRef.value) return
    const bounds = chartRef.value.getBoundingClientRect()
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    ) {
      hideChartTooltip()
    }
  }

  function applyChartOption() {
    const option = chartOption()
    const chart = getChartInstance()
    if (chart) {
      chart.setOption(option, { replaceMerge: ['series'] })
      return
    }
    initChart(option)
  }

  function renderChart() {
    if (!['line', 'bar'].includes(props.panel.kind)) return
    if (props.result?.status !== 'success' || !props.result.series?.length) return
    nextTick(applyChartOption)
  }

  function handleChartVisible() {
    applyChartOption()
  }

  onMounted(() => {
    chartRef.value?.addEventListener('chartVisible', handleChartVisible)
    renderChart()
    window.addEventListener('mousemove', hideTooltipOutsideChart, true)
    window.addEventListener('mouseup', finishChartRangeSelection, true)
    window.addEventListener('pointerup', finishChartPointerSelection, true)
    window.addEventListener('resize', hideChartTooltip)
    window.addEventListener('scroll', hideChartTooltip, true)
  })
  onBeforeUnmount(() => {
    chartRef.value?.removeEventListener('chartVisible', handleChartVisible)
    window.removeEventListener('mousemove', hideTooltipOutsideChart, true)
    window.removeEventListener('mouseup', finishChartRangeSelection, true)
    window.removeEventListener('pointerup', finishChartPointerSelection, true)
    window.removeEventListener('resize', hideChartTooltip)
    window.removeEventListener('scroll', hideChartTooltip, true)
  })
  watch(() => [props.result, props.panel.id, props.loading, isDark.value], renderChart, {
    deep: true
  })
</script>

<style scoped lang="scss">
  .dashboard-panel {
    display: flex;
    flex-direction: column;
    grid-column: span 6;
    min-width: 0;
    height: 300px;
    overflow: hidden;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
  }

  .dashboard-panel.is-stat,
  .dashboard-panel.is-gauge,
  .dashboard-panel.is-empty {
    height: 188px;
  }

  .dashboard-panel.is-bar,
  .dashboard-panel.is-line,
  .dashboard-panel.is-status {
    height: 310px;
  }

  .dashboard-panel.span-3 {
    grid-column: span 3;
  }

  .dashboard-panel.span-4 {
    grid-column: span 4;
  }

  .dashboard-panel.span-6 {
    grid-column: span 6;
  }

  .dashboard-panel.span-12 {
    grid-column: span 12;
  }

  .dashboard-panel__header {
    display: flex;
    flex: 0 0 46px;
    align-items: center;
    justify-content: space-between;
    height: 46px;
    padding: 0 15px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .dashboard-panel__heading {
    display: flex;
    gap: 6px;
    align-items: center;
    min-width: 0;
  }

  .dashboard-panel__heading h3 {
    margin: 0;
    overflow: hidden;
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
    color: var(--el-text-color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dashboard-panel__info {
    color: var(--el-text-color-placeholder);
  }

  .dashboard-panel__live {
    font-size: 11px;
    color: #2e9b62;
  }

  .dashboard-panel__refreshing {
    display: inline-flex;
    flex: 0 0 auto;
    gap: 4px;
    align-items: center;
    font-size: 11px;
    color: var(--el-color-primary);
  }

  .dashboard-panel__state {
    display: flex;
    flex-direction: column;
    gap: 7px;
    align-items: center;
    justify-content: center;
    height: calc(100% - 46px);
    padding: 20px;
    color: var(--el-text-color-secondary);
    text-align: center;
  }

  .dashboard-panel__state strong {
    font-size: 14px;
    color: var(--el-text-color-primary);
  }

  .dashboard-panel__state span {
    font-size: 12px;
  }

  .dashboard-panel__loading {
    font-size: 22px;
    color: var(--el-color-primary);
  }

  .dashboard-panel__empty-icon {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    font-size: 19px;
    color: var(--el-text-color-placeholder);
    background: var(--el-fill-color-light);
    border-radius: 50%;
  }

  .dashboard-panel__empty-icon.metric_missing {
    color: #b27a20;
    background: #fff5dc;
  }

  .dashboard-panel__empty-icon.error {
    color: #c64e4e;
    background: #fdeaea;
  }

  .dashboard-panel__error-detail {
    padding: 0;
    font-size: 12px;
    color: var(--el-color-primary);
    cursor: help;
    background: none;
    border: 0;
  }

  .dashboard-panel__stat,
  .dashboard-panel__gauge-wrap {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    justify-content: center;
    height: calc(100% - 46px);
  }

  .dashboard-panel__stat strong {
    font-size: 38px;
    font-weight: 600;
    line-height: 1;
    color: var(--el-text-color-primary);
  }

  .dashboard-panel__stat span {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .dashboard-panel__gauge {
    display: grid;
    place-items: center;
    width: 100px;
    height: 100px;
    border-radius: 50%;
  }

  .dashboard-panel__gauge-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 76px;
    height: 76px;
    background: var(--el-bg-color);
    border-radius: 50%;
  }

  .dashboard-panel__gauge-center strong {
    font-size: 20px;
  }

  .dashboard-panel__gauge-center span {
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }

  .dashboard-panel__gauge-scale {
    display: flex;
    justify-content: space-between;
    width: 104px;
    font-size: 10px;
    color: var(--el-text-color-placeholder);
  }

  .dashboard-panel__status-list {
    display: grid;
    align-content: start;
    height: calc(100% - 46px);
    padding: 6px 14px;
    overflow-y: auto;
  }

  .dashboard-panel__status-item {
    display: grid;
    grid-template-columns: 10px minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
    min-height: 34px;
    font-size: 12px;
    border-bottom: 1px solid var(--el-border-color-extra-light);
  }

  .dashboard-panel__status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  .dashboard-panel__status-dot.healthy {
    background: #2e9b62;
  }

  .dashboard-panel__status-dot.warning {
    background: #d99a2b;
  }

  .dashboard-panel__status-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dashboard-panel__chart-shell {
    position: relative;
    width: 100%;
    height: calc(100% - 46px);
  }

  .dashboard-panel__chart {
    width: 100%;
    height: 100%;
  }

  .dashboard-panel.is-line .dashboard-panel__chart-shell {
    cursor: crosshair;
  }

  .dashboard-panel__range-selection {
    position: absolute;
    top: 24px;
    bottom: 30px;
    z-index: 10;
    pointer-events: none;
    background: rgb(40 120 212 / 20%);
    border: 1px solid rgb(80 156 226 / 90%);
  }

  @media (width <= 1280px) {
    .dashboard-panel.span-3,
    .dashboard-panel.span-4 {
      grid-column: span 6;
    }

    .dashboard-panel.span-4:last-child:nth-child(odd) {
      grid-column: span 12;
    }
  }

  @media (width <= 760px) {
    .dashboard-panel,
    .dashboard-panel.span-3,
    .dashboard-panel.span-4,
    .dashboard-panel.span-6,
    .dashboard-panel.span-12 {
      grid-column: 1 / -1;
    }
  }
</style>

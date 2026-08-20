<!-- 折线图，支持多组数据，支持阶梯式动画效果 -->
<template>
  <div
    ref="chartRef"
    class="relative w-full"
    :style="{ height: props.height }"
    v-loading="props.loading"
  >
  </div>
</template>

<script setup lang="ts">
  import { graphic, type EChartsOption } from '@/plugins/echarts'
  import { getCssVar, hexToRgba } from '@/utils/ui'
  import { useChartOps, useChartComponent } from '@/hooks/core/useChart'
  import type { LineChartProps, LineDataItem } from '@/types/component/chart'

  defineOptions({ name: 'ArtLineChart' })

  const props = withDefaults(defineProps<LineChartProps>(), {
    // 基础配置
    height: useChartOps().chartHeight,
    loading: false,
    isEmpty: false,
    colors: () => useChartOps().colors,

    // 数据配置
    data: () => [0, 0, 0, 0, 0, 0, 0],
    xAxisData: () => [],
    lineWidth: 2.5,
    showAreaColor: false,
    smooth: true,
    symbol: 'none',
    symbolSize: 6,
    animationDelay: 200,
    silentUpdate: false,
    axisFontSize: undefined,
    maxXAxisLabels: undefined,

    // 轴线显示配置
    showAxisLabel: true,
    showAxisLine: true,
    showSplitLine: true,

    // 交互配置
    showTooltip: true,
    showLegend: false,
    legendPosition: 'bottom'
  })

  // 动画状态管理
  const isAnimating = ref(false)
  const animationTimers = ref<number[]>([])
  const animatedData = ref<number[] | LineDataItem[]>([])

  // 清理所有定时器
  const clearAnimationTimers = () => {
    animationTimers.value.forEach((timer) => clearTimeout(timer))
    animationTimers.value = []
    clearRaf()
  }

  // 判断是否为多数据（使用 VueUse 的 computedEager 优化）
  const isMultipleData = computed(() => {
    return (
      Array.isArray(props.data) &&
      props.data.length > 0 &&
      typeof props.data[0] === 'object' &&
      'name' in props.data[0]
    )
  })

  // 缓存计算的最大值，避免重复计算
  const maxValue = computed(() => {
    if (isMultipleData.value) {
      const multiData = props.data as LineDataItem[]
      return multiData.reduce((max, item) => {
        if (item.data?.length) {
          const itemMax = Math.max(...item.data)
          return Math.max(max, itemMax)
        }
        return max
      }, 0)
    } else {
      const singleData = props.data as number[]
      return singleData?.length ? Math.max(...singleData) : 0
    }
  })

  // 复制真实数据（优化：使用结构化克隆）
  const copyRealData = (): number[] | LineDataItem[] => {
    if (isMultipleData.value) {
      return (props.data as LineDataItem[]).map((item) => ({ ...item, data: [...item.data] }))
    }
    return [...(props.data as number[])]
  }

  // 获取颜色配置（优化：缓存主题色）
  const primaryColor = computed(() => getCssVar('--el-color-primary'))

  const getColor = (customColor?: string, index?: number): string => {
    if (customColor) return customColor
    if (index !== undefined) return props.colors![index % props.colors!.length]
    return primaryColor.value
  }

  // 生成区域样式
  const generateAreaStyle = (item: LineDataItem, color: string) => {
    // 如果有 areaStyle 配置，或者显式开启了区域颜色，则显示区域样式
    if (!item.areaStyle && !item.showAreaColor && !props.showAreaColor) return undefined

    const areaConfig = item.areaStyle || {}
    if (areaConfig.custom) return areaConfig.custom

    return {
      color: new graphic.LinearGradient(0, 0, 0, 1, [
        {
          offset: 0,
          color: hexToRgba(color, areaConfig.startOpacity || 0.2).rgba
        },
        {
          offset: 1,
          color: hexToRgba(color, areaConfig.endOpacity || 0.02).rgba
        }
      ])
    }
  }

  // 生成单数据区域样式
  const generateSingleAreaStyle = () => {
    if (!props.showAreaColor) return undefined

    const color = getColor(props.colors[0])
    return {
      color: new graphic.LinearGradient(0, 0, 0, 1, [
        {
          offset: 0,
          color: hexToRgba(color, 0.2).rgba
        },
        {
          offset: 1,
          color: hexToRgba(color, 0.02).rgba
        }
      ])
    }
  }

  const LEFT_TO_RIGHT_TOTAL_MS = 300
  const LEFT_TO_RIGHT_SKIP_ANIM_THRESHOLD = 100
  const LEFT_TO_RIGHT_STEP_COUNT_MAX = 30
  let rafId: number | null = null

  function clearRaf() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  function getDataPointCount(): number {
    if (!Array.isArray(props.data) || !props.data.length) return 0
    if (typeof props.data[0] === 'object' && 'name' in (props.data[0] as any)) {
      const multiData = props.data as LineDataItem[]
      return multiData.reduce((max, item) => Math.max(max, item.data?.length ?? 0), 0)
    }
    return (props.data as number[]).length
  }

  function shouldSkipLeftToRightAnimation(): boolean {
    return getDataPointCount() > LEFT_TO_RIGHT_SKIP_ANIM_THRESHOLD
  }

  function buildLeftToRightDataValues(values: number[], ratio: number): (number | null)[] {
    const len = values.length
    if (!len) return []
    if (ratio >= 1) return values.slice()
    const revealFloat = Math.max(1, ratio * len)
    const revealIdx = Math.floor(revealFloat)
    const frac = revealFloat - revealIdx
    const result: (number | null)[] = values.map((v, idx) => {
      if (idx < revealIdx) return v
      if (idx === revealIdx && frac > 0) {
        const prev = revealIdx > 0 ? (values[revealIdx - 1] ?? 0) : 0
        return +(prev + (v - prev) * frac).toFixed(2)
      }
      return null
    })
    return result
  }

  function runRafAnimation(totalMs: number, onTick: (ratio: number) => void, onDone: () => void) {
    const startTime = performance.now()
    const tick = (now: number) => {
      const elapsed = now - startTime
      const ratio = Math.min(1, elapsed / totalMs)
      onTick(ratio)
      if (ratio >= 1) {
        rafId = null
        onDone()
        return
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
  }

  // 创建系列配置
  const createSeriesItem = (config: {
    name?: string
    data: (number | null)[]
    color?: string
    smooth?: boolean
    symbol?: string
    symbolSize?: number
    lineWidth?: number
    areaStyle?: any
  }) => {
    return {
      name: config.name,
      data: config.data,
      type: 'line' as const,
      connectNulls: false,
      color: config.color,
      smooth: config.smooth ?? props.smooth,
      symbol: config.symbol ?? props.symbol,
      symbolSize: config.symbolSize ?? props.symbolSize,
      lineStyle: {
        width: config.lineWidth ?? props.lineWidth,
        color: config.color
      },
      areaStyle: config.areaStyle,
      emphasis: {
        focus: 'series' as const,
        lineStyle: {
          width: config.lineWidth ?? props.lineWidth
        }
      }
    }
  }

  // 生成图表配置
  const generateChartOptions = (_isInitial = false, stepReveal = false): EChartsOption => {
    const options: EChartsOption = {
      animation: !stepReveal,
      animationDuration: 150,
      animationDurationUpdate: 150,
      grid: getGridWithLegend(props.showLegend && isMultipleData.value, props.legendPosition, {
        top: 15,
        right: 15,
        left: 0
      }),
      tooltip: props.showTooltip ? getTooltipStyle() : undefined,
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: props.xAxisData,
        axisTick: getAxisTickStyle(),
        axisLine: getAxisLineStyle(props.showAxisLine),
        axisLabel: {
          ...getAxisLabelStyle(props.showAxisLabel),
          ...(props.axisFontSize != null ? { fontSize: props.axisFontSize } : {}),
          ...(props.maxXAxisLabels != null && props.xAxisData.length > props.maxXAxisLabels
            ? { interval: Math.ceil(props.xAxisData.length / props.maxXAxisLabels) }
            : {})
        }
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: maxValue.value,
        axisLabel: {
          ...getAxisLabelStyle(props.showAxisLabel),
          ...(props.axisFontSize != null ? { fontSize: props.axisFontSize } : {})
        },
        axisLine: getAxisLineStyle(props.showAxisLine),
        splitLine: getSplitLineStyle(props.showSplitLine)
      }
    }

    // 添加图例配置
    if (props.showLegend && isMultipleData.value) {
      options.legend = getLegendStyle(props.legendPosition)
    }

    // 生成系列数据
    if (isMultipleData.value) {
      const multiData = animatedData.value as LineDataItem[]
      options.series = multiData.map((item, index) => {
        const itemColor = getColor(props.colors[index], index)
        const areaStyle = generateAreaStyle(item, itemColor)

        return createSeriesItem({
          name: item.name,
          data: item.data,
          color: itemColor,
          smooth: item.smooth,
          symbol: item.symbol,
          lineWidth: item.lineWidth,
          areaStyle
        })
      })
    } else {
      // 单数据情况
      const singleData = animatedData.value as number[]
      const computedColor = getColor(props.colors[0])
      const areaStyle = generateSingleAreaStyle()

      options.series = [
        createSeriesItem({
          data: singleData,
          color: computedColor,
          areaStyle
        })
      ]
    }

    return options
  }

  // 更新图表
  const updateChartOptions = (options: EChartsOption) => {
    initChart(options)
  }

  /** 单条折线从左到右逐点生成 */
  function runSingleSeriesLeftToRightAnimation(realData: number[]) {
    const pointCount = realData.length
    if (!pointCount) {
      isAnimating.value = false
      return
    }

    if (shouldSkipLeftToRightAnimation() || pointCount === 1) {
      animatedData.value = realData.slice() as any
      updateChartOptions(generateChartOptions(false, false))
      isAnimating.value = false
      return
    }

    animatedData.value = buildLeftToRightDataValues(realData, 0) as any
    updateChartOptions(generateChartOptions(true, true))

    let lastRenderRatio = -1
    runRafAnimation(
      LEFT_TO_RIGHT_TOTAL_MS,
      (ratio) => {
        const step = 1 / LEFT_TO_RIGHT_STEP_COUNT_MAX
        if (ratio - lastRenderRatio < step && ratio < 1) return
        lastRenderRatio = ratio
        animatedData.value = buildLeftToRightDataValues(realData, ratio) as any
        updateChartOptions(generateChartOptions(false, true))
      },
      () => {
        animatedData.value = realData.slice() as any
        updateChartOptions(generateChartOptions(false, true))
        isAnimating.value = false
      }
    )
  }

  /** 多条折线同步从左到右逐点生成 */
  function runMultiSeriesLeftToRightAnimation(multiData: LineDataItem[]) {
    const maxLen = Math.max(...multiData.map((item) => item.data?.length ?? 0), 0)
    if (!maxLen) {
      isAnimating.value = false
      return
    }

    if (shouldSkipLeftToRightAnimation() || maxLen === 1) {
      animatedData.value = copyRealData()
      updateChartOptions(generateChartOptions(false, false))
      isAnimating.value = false
      return
    }

    animatedData.value = multiData.map((item) => ({
      ...item,
      data: buildLeftToRightDataValues(item.data ?? [], 0) as any
    }))
    updateChartOptions(generateChartOptions(true, true))

    let lastRenderRatio = -1
    runRafAnimation(
      LEFT_TO_RIGHT_TOTAL_MS,
      (ratio) => {
        const step = 1 / LEFT_TO_RIGHT_STEP_COUNT_MAX
        if (ratio - lastRenderRatio < step && ratio < 1) return
        lastRenderRatio = ratio
        animatedData.value = multiData.map((item) => ({
          ...item,
          data: buildLeftToRightDataValues(item.data ?? [], ratio) as any
        }))
        updateChartOptions(generateChartOptions(false, true))
      },
      () => {
        animatedData.value = copyRealData()
        updateChartOptions(generateChartOptions(false, true))
        isAnimating.value = false
      }
    )
  }

  // 初始化动画：折线从左向右逐点展开
  const initChartWithAnimation = () => {
    clearAnimationTimers()
    isAnimating.value = true

    if (isMultipleData.value) {
      runMultiSeriesLeftToRightAnimation(props.data as LineDataItem[])
    } else {
      runSingleSeriesLeftToRightAnimation([...(props.data as number[])])
    }
  }

  // 空数据：仅无点视为空。全 0 是合法低流量，不能当成「暂无数据」
  const checkIsEmpty = () => {
    if (Array.isArray(props.data) && typeof props.data[0] === 'number') {
      return !(props.data as number[]).length
    }

    if (Array.isArray(props.data) && typeof props.data[0] === 'object') {
      const multiData = props.data as LineDataItem[]
      return (
        !multiData.length ||
        multiData.every((item) => !item.data?.length || item.data.every((val) => val == null))
      )
    }

    return !Array.isArray(props.data) || !props.data.length
  }

  function hasRenderableData() {
    if (props.isEmpty) return false
    return !checkIsEmpty()
  }

  // 使用新的图表组件抽象（数据更新由 renderChart 统一处理，避免与从左到右动画冲突）
  const {
    chartRef,
    initChart,
    getAxisLineStyle,
    getAxisLabelStyle,
    getAxisTickStyle,
    getSplitLineStyle,
    getTooltipStyle,
    getLegendStyle,
    getGridWithLegend,
    isDark,
    emptyStateManager
  } = useChartComponent({
    props,
    checkEmpty: () => {
      if (isAnimating.value && hasRenderableData()) return false
      return checkIsEmpty()
    },
    watchSources: [],
    onVisible: () => {
      if (hasRenderableData()) forceReplayAnimation()
    },
    generateOptions: () => generateChartOptions(false)
  })

  function forceReplayAnimation() {
    if (!hasRenderableData()) return
    clearAnimationTimers()
    isAnimating.value = false
    emptyStateManager.remove()
    void nextTick().then(() => {
      if (!hasRenderableData()) return
      initChartWithAnimation()
    })
  }

  // 图表渲染：保留从左到右逐点展开，但大幅加速
  const renderChart = () => {
    if (!hasRenderableData()) {
      clearAnimationTimers()
      isAnimating.value = false
      return
    }

    if (props.silentUpdate) {
      clearAnimationTimers()
      isAnimating.value = false
      emptyStateManager.remove()
      void nextTick().then(() => {
        if (!hasRenderableData()) return
        animatedData.value = copyRealData()
        updateChartOptions(generateChartOptions(false))
      })
      return
    }

    forceReplayAnimation()
  }

  watch([() => props.data, () => props.xAxisData, () => props.colors], renderChart, { deep: true })

  watch(
    () => props.silentUpdate,
    (silent, prev) => {
      if (prev && !silent && hasRenderableData()) forceReplayAnimation()
    }
  )

  watch(isDark, () => {
    if (hasRenderableData()) renderChart()
  })

  // 生命周期
  onMounted(() => {
    renderChart()
  })

  onBeforeUnmount(() => {
    clearAnimationTimers()
  })
</script>

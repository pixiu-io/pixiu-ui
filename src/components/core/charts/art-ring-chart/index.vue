<!-- 环形图 -->
<template>
  <div
    ref="chartRef"
    class="relative w-full overflow-visible"
    :style="{ height: props.height }"
    v-loading="props.loading"
  >
  </div>
</template>

<script setup lang="ts">
  import type { EChartsOption } from '@/plugins/echarts'
  import { useChartOps, useChartComponent } from '@/hooks/core/useChart'
  import type { PieDataItem, RingChartProps } from '@/types/component/chart'

  defineOptions({ name: 'ArtRingChart' })

  const props = withDefaults(defineProps<RingChartProps>(), {
    // 基础配置
    height: useChartOps().chartHeight,
    loading: false,
    isEmpty: false,
    colors: () => useChartOps().colors,

    // 数据配置
    data: () => [],
    radius: () => ['50%', '80%'],
    borderRadius: 10,
    centerText: '',
    centerTextFontSize: 16,
    showLabel: false,

    // 交互配置
    showTooltip: true,
    showLegend: false,
    legendPosition: 'right'
  })

  // 使用新的图表组件抽象
  const { chartRef, isDark, getAnimationConfig, getTooltipStyle, getLegendStyle } =
    useChartComponent({
      props,
      checkEmpty: () => !props.data?.length,
      watchSources: [
        () => props.data,
        () => props.centerText,
        () => props.showLabel,
        () => props.centerTextFontSize
      ],
      generateOptions: (): EChartsOption => {
        const labelInset = props.showLabel ? '16%' : undefined

        // 根据图例位置计算环形图中心位置（相对 series 绘图区）
        const getCenterPosition = (): [string, string] => {
          if (!props.showLegend) return ['50%', '50%']

          switch (props.legendPosition) {
            case 'left':
              return ['60%', '50%']
            case 'right':
              return ['40%', '50%']
            case 'top':
              return ['50%', '60%']
            case 'bottom':
              return ['50%', '40%']
            default:
              return ['50%', '50%']
          }
        }

        const centerPos = getCenterPosition()

        const raw = props.data ?? []
        const vals = raw.map((d) => Number(d.value) || 0)
        const sum = vals.reduce((a, b) => a + b, 0)

        /** 饼图在和为 0 时不画扇区，用手动等分 + 弱显色占位，tooltip 仍展示真实 0 */
        let seriesData: PieDataItem[] | Array<PieDataItem & { itemStyle?: { opacity?: number } }>
        let tooltipExtras: Record<string, unknown> = {}

        if (sum === 0 && raw.length > 0) {
          seriesData = raw.map((d, i) => ({
            name: d.name,
            value: 1,
            itemStyle: {
              color: props.colors[i % props.colors.length],
              opacity: 0.28
            }
          }))
          tooltipExtras = {
            formatter: (p: { dataIndex?: number; name?: string }) => {
              const i = typeof p.dataIndex === 'number' ? p.dataIndex : 0
              const name = raw[i]?.name ?? p.name ?? ''
              return `${name}: 0 (0%)`
            }
          }
        } else {
          seriesData = raw.map((d, i) => ({
            name: d.name,
            value: vals[i] ?? 0
          }))
        }

        const option: EChartsOption = {
          tooltip: props.showTooltip
            ? getTooltipStyle('item', {
                formatter: '{b}: {c} ({d}%)',
                textStyle: { fontSize: 12 },
                ...tooltipExtras
              })
            : undefined,
          legend: props.showLegend ? getLegendStyle(props.legendPosition) : undefined,
          series: [
            {
              name: '数据占比',
              type: 'pie',
              ...(labelInset
                ? { left: labelInset, right: labelInset, top: labelInset, bottom: labelInset }
                : {}),
              radius: props.radius,
              center: centerPos,
              avoidLabelOverlap: true,
              itemStyle: {
                borderRadius: props.borderRadius,
                borderColor: isDark.value ? '#2c2c2c' : '#fff',
                borderWidth: 0
              },
              label: {
                show: props.showLabel,
                formatter: '{b} {d}%',
                position: 'outside',
                color: isDark.value ? '#ccc' : '#999',
                fontSize: 11,
                lineHeight: 14
              },
              emphasis: {
                label: {
                  show: props.showLabel,
                  fontSize: 12,
                  fontWeight: 'bold'
                }
              },
              labelLine: {
                show: props.showLabel,
                length: 8,
                length2: 10,
                smooth: false
              },
              data: seriesData,
              color: props.colors,
              ...getAnimationConfig(),
              animationType: 'expansion'
            }
          ]
        }

        // 添加中心文字
        if (props.centerText) {
          option.title = {
            text: props.centerText,
            left: centerPos[0],
            top: centerPos[1],
            textAlign: 'center',
            textVerticalAlign: 'middle',
            textStyle: {
              fontSize: props.centerTextFontSize,
              fontWeight: 500,
              color: isDark.value ? '#999' : '#ADB0BC'
            }
          }
        }

        return option
      }
    })
</script>

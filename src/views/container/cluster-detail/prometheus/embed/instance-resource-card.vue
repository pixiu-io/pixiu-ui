<!-- API Server 实例资源卡：used/request/limit 三条趋势 + 底部实例图例（可点击切换） -->
<template>
  <div class="instance-resource-card">
    <div class="instance-resource-card__head">
      <span class="instance-resource-card__title">{{ title }}</span>
    </div>

    <div class="instance-resource-card__chart">
      <ArtLineChart
        :data="chartData"
        :x-axis-data="xAxisData"
        height="100%"
        :line-width="1"
        :axis-font-size="10"
        y-axis-scale
        show-legend
        legend-position="top-right"
        show-area-color
        silent-update
      />
    </div>

    <div class="instance-resource-card__footer">
      <span
        v-for="pod in instancePods"
        :key="pod"
        class="instance-resource-card__legend-item"
        :class="{ 'is-off': !selectedInstances.has(pod) }"
        :title="pod"
        @click="toggleInstance(pod)"
      >
        <span class="instance-resource-card__legend-dot" :style="{ background: instanceColor(pod) }" />
        <span class="instance-resource-card__legend-name">{{ pod }}</span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import ArtLineChart from '@/components/core/charts/art-line-chart/index.vue'
  import { bytesToGib } from '@/api/kubernetes/metrics'
  import type { DashboardPanelResult } from '@/api/dashboard'

  const props = defineProps<{
    title: string
    unit: string
    result?: DashboardPanelResult
  }>()

  const DIMENSIONS = ['used', 'request', 'limit'] as const
  const INSTANCE_COLORS = ['#2878d4', '#2e9b62', '#d99a2b', '#8c62c7', '#d45f75', '#2c9ea0']

  /** 去重的 Pod 名列表 */
  const instancePods = computed(() => {
    const source = props.result?.series ?? []
    return [...new Set(source.map((s) => s.metric.pod?.trim()).filter(Boolean))] as string[]
  })

  function instanceColor(pod: string): string {
    const index = instancePods.value.indexOf(pod)
    return INSTANCE_COLORS[((index % INSTANCE_COLORS.length) + INSTANCE_COLORS.length) % INSTANCE_COLORS.length]
  }

  /** 已选中的实例（默认全部选中，点击切换；数据刷新时保留用户选择，仅并入新增实例） */
  const selectedInstances = ref<Set<string>>(new Set())
  watch(
    instancePods,
    (pods) => {
      const next = new Set(selectedInstances.value)
      for (const pod of pods) {
        if (!next.has(pod)) next.add(pod)
      }
      for (const pod of next) {
        if (!pods.includes(pod)) next.delete(pod)
      }
      selectedInstances.value = next
    },
    { immediate: true }
  )

  function toggleInstance(pod: string) {
    const next = new Set(selectedInstances.value)
    if (next.has(pod)) next.delete(pod)
    else next.add(pod)
    selectedInstances.value = next
  }

  /** used/request/limit 三条线：聚合选中实例后按时间点取值 */
  const chartData = computed(() => {
    const source = props.result?.series ?? []
    if (props.result?.status !== 'success') return []
    return DIMENSIONS.map((dim) => {
      const seriesList = source.filter(
        (s) =>
          (s.metric.quota ?? 'used') === dim &&
          selectedInstances.value.has(s.metric.pod?.trim() ?? '')
      )
      const length = seriesList[0]?.values?.length ?? 0
      const data = Array.from({ length }, (_, i) => {
        let sum = 0
        for (const s of seriesList) {
          const raw = Number(s.values[i]?.value ?? 0)
          sum += props.unit === 'bytes' ? bytesToGib(raw) : raw
        }
        return Number(sum.toFixed(props.unit === 'bytes' ? 2 : 3))
      })
      return { name: dim, data }
    })
  })

  const xAxisData = computed(() => {
    const first = props.result?.series?.[0]
    if (!first?.values?.length) return []
    return first.values.map((p) => {
      const d = new Date(p.timestamp * 1000)
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`
    })
  })
</script>

<style scoped lang="scss">
  /* 布局与请求延迟分位（DashboardPanel）一致：紧凑 header + 图表 + 底部实例图例 */
  .instance-resource-card {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-width: 0;
    overflow: hidden;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
  }

  .instance-resource-card__head {
    display: flex;
    flex: 0 0 46px;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    height: 46px;
    padding: 0 15px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .instance-resource-card__title {
    overflow: hidden;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.5;
    color: var(--el-text-color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .instance-resource-card__chart {
    flex: 1 1 0;
    min-height: 0;
    padding: 0 10px;
  }

  .instance-resource-card__footer {
    display: flex;
    flex: 0 0 auto;
    flex-wrap: wrap;
    gap: 4px 16px;
    align-items: center;
    min-height: 36px;
    padding: 6px 15px;
  }

  .instance-resource-card__legend-item {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    max-width: 260px;
    font-size: 11px;
    line-height: 1.4;
    color: var(--el-text-color-primary);
    cursor: pointer;
    user-select: none;
    transition: opacity 0.15s;
  }

  .instance-resource-card__legend-item.is-off {
    opacity: 0.45;
    color: var(--el-text-color-secondary);
    text-decoration: line-through;
  }

  .instance-resource-card__legend-dot {
    flex: 0 0 auto;
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }

  .instance-resource-card__legend-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>

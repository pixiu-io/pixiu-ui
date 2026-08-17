<!-- 用量仪表：纯 CSS conic-gradient 圆形进度环（参考 Prometheus 监控页 gauge） -->
<template>
  <div class="art-gauge-wrap" :style="{ height: props.height }" v-loading="props.loading">
    <!-- 空态占位 -->
    <span v-if="props.isEmpty" class="art-gauge__empty">暂无数据</span>

    <template v-else>
      <div class="art-gauge" :style="ringStyle">
        <div class="art-gauge__center">
          <strong>{{ displayValue }}%</strong>
          <span>当前值</span>
        </div>
      </div>
      <div class="art-gauge__scale">
        <span>0%</span>
        <span>{{ props.max }}%</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import type { CSSProperties } from 'vue'
  import type { GaugeChartProps } from '@/types/component/chart'

  defineOptions({ name: 'ArtGaugeChart' })

  const props = withDefaults(defineProps<GaugeChartProps>(), {
    height: '160px',
    loading: false,
    isEmpty: false,
    max: 100,
    decimals: 1
  })

  // 百分比（0 ~ 100），按 max 归一化
  const percent = computed(() => {
    const max = Number(props.max) || 100
    const ratio = max > 0 ? (Number(props.value) || 0) / max : 0
    return Math.max(0, Math.min(100, ratio * 100))
  })

  // 颜色分档（对齐 Prometheus gauge）：>=85 红 / >=70 橙 / 其余绿
  const ringColor = computed(() =>
    percent.value >= 85 ? '#e45757' : percent.value >= 70 ? '#d99a2b' : '#2e9b62'
  )

  // conic-gradient 圆环：已用部分用分档色，剩余用填充底色
  const ringStyle = computed<CSSProperties>(() => ({
    background: `conic-gradient(${ringColor.value} ${percent.value * 3.6}deg, var(--el-fill-color-dark) 0deg)`
  }))

  // 中心大数字（保留 decimals 位小数）
  const displayValue = computed(() => (Number(props.value) || 0).toFixed(props.decimals))
</script>

<style scoped lang="scss">
  .art-gauge-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .art-gauge {
    display: grid;
    place-items: center;
    width: 120px;
    height: 120px;
    border-radius: 50%;
  }

  .art-gauge__center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 88px;
    height: 88px;
    background: var(--el-bg-color);
    border-radius: 50%;

    strong {
      font-size: 24px;
      font-weight: 600;
      line-height: 1.1;
      color: var(--el-text-color-primary);
    }

    span {
      margin-top: 2px;
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }
  }

  .art-gauge__scale {
    display: flex;
    justify-content: space-between;
    width: 120px;
    font-size: 10px;
    color: var(--el-text-color-placeholder);
  }

  .art-gauge__empty {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
</style>

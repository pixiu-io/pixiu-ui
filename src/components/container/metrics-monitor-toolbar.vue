<!-- 监控工具栏：时间区间、时间粒度、自动刷新 -->
<template>
  <div class="metrics-monitor-toolbar">
    <div class="metrics-monitor-toolbar__bar">
      <MetricsTimeRangePicker v-model="timeRangeModel" class="metrics-monitor-toolbar__time" />

      <span class="metrics-monitor-toolbar__divider" aria-hidden="true" />

      <div class="metrics-monitor-toolbar__group">
        <span class="metrics-monitor-toolbar__group-label">
          <ElIcon class="metrics-monitor-toolbar__group-icon"><Clock /></ElIcon>
          时间粒度
        </span>
        <ElSelect
          v-model="granularityKey"
          class="metrics-monitor-toolbar__select"
          size="small"
          @change="onGranularityChange"
        >
          <ElOption
            v-for="opt in METRICS_GRANULARITY_OPTIONS"
            :key="opt.key"
            :label="opt.label"
            :value="opt.key"
          />
        </ElSelect>
      </div>

      <span class="metrics-monitor-toolbar__divider" aria-hidden="true" />

      <div class="metrics-monitor-toolbar__group">
        <span class="metrics-monitor-toolbar__group-label">
          <ElIcon class="metrics-monitor-toolbar__group-icon"><Refresh /></ElIcon>
          自动刷新
        </span>
        <ElSelect
          v-model="autoRefreshKey"
          class="metrics-monitor-toolbar__select metrics-monitor-toolbar__select--refresh"
          size="small"
          @change="onAutoRefreshChange"
        >
          <ElOption
            v-for="opt in METRICS_AUTO_REFRESH_OPTIONS"
            :key="opt.key"
            :label="opt.label"
            :value="opt.key"
          />
        </ElSelect>
      </div>

      <span class="metrics-monitor-toolbar__divider" aria-hidden="true" />

      <ElCheckbox v-model="showLegendModel" class="metrics-monitor-toolbar__legend">
        显示图例
      </ElCheckbox>

      <ElButton
        v-if="showMoreMenu"
        text
        class="metrics-monitor-toolbar__more-btn"
        title="更多操作"
        @click="emit('moreClick')"
      >
        <ElIcon><MoreFilled /></ElIcon>
      </ElButton>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Clock, MoreFilled, Refresh } from '@element-plus/icons-vue'
  import MetricsTimeRangePicker from '@/components/container/metrics-time-range-picker.vue'
  import {
    getDefaultMetricsAutoRefresh,
    METRICS_AUTO_REFRESH_OPTIONS,
    type MetricsAutoRefreshOption
  } from '@/utils/metrics/auto-refresh'
  import {
    getDefaultMetricsGranularity,
    METRICS_GRANULARITY_OPTIONS,
    type MetricsGranularityOption
  } from '@/utils/metrics/granularity'
  import { getDefaultMetricsTimeRange, type MetricsTimeRange } from '@/utils/metrics/time-range'

  const timeRangeModel = defineModel<MetricsTimeRange>('timeRange', {
    default: () => getDefaultMetricsTimeRange()
  })
  const granularityModel = defineModel<MetricsGranularityOption>('granularity', {
    default: () => getDefaultMetricsGranularity()
  })
  const autoRefreshModel = defineModel<MetricsAutoRefreshOption>('autoRefresh', {
    default: () => getDefaultMetricsAutoRefresh()
  })
  const showLegendModel = defineModel<boolean>('showLegend', {
    default: true
  })
  withDefaults(
    defineProps<{
      showMoreMenu?: boolean
    }>(),
    {
      showMoreMenu: false
    }
  )
  const emit = defineEmits<{
    (e: 'moreClick'): void
  }>()

  const granularityKey = ref(granularityModel.value.key)
  const autoRefreshKey = ref(autoRefreshModel.value.key)

  watch(granularityModel, (g) => {
    granularityKey.value = g.key
  })
  watch(autoRefreshModel, (a) => {
    autoRefreshKey.value = a.key
  })

  function onGranularityChange(key: string) {
    const opt = METRICS_GRANULARITY_OPTIONS.find((o) => o.key === key)
    if (opt) granularityModel.value = opt
  }

  function onAutoRefreshChange(key: string) {
    const opt = METRICS_AUTO_REFRESH_OPTIONS.find((o) => o.key === key)
    if (opt) autoRefreshModel.value = opt
  }
</script>

<style scoped lang="scss">
  .metrics-monitor-toolbar {
    margin-bottom: 18px;
  }

  .metrics-monitor-toolbar__bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 14px;
    padding: 12px 14px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    background: var(--el-fill-color-lighter);
  }

  .metrics-monitor-toolbar__time {
    flex: 1 1 200px;
    max-width: 280px;
  }

  .metrics-monitor-toolbar__divider {
    flex-shrink: 0;
    width: 1px;
    height: 20px;
    background: var(--el-border-color);
    opacity: 0.85;
  }

  .metrics-monitor-toolbar__group {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .metrics-monitor-toolbar__group-label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
    white-space: nowrap;
    user-select: none;
  }

  .metrics-monitor-toolbar__group-icon {
    font-size: 14px;
    color: var(--el-text-color-placeholder);
  }

  .metrics-monitor-toolbar__select {
    width: 96px;
  }

  .metrics-monitor-toolbar__select--refresh {
    width: 84px;
  }

  .metrics-monitor-toolbar__select :deep(.el-select__wrapper) {
    min-height: 32px;
    padding: 0 11px;
    border-radius: 6px;
    background: var(--el-bg-color);
    box-shadow: 0 0 0 1px var(--el-border-color) inset;
  }

  .metrics-monitor-toolbar__select :deep(.el-select__wrapper:hover) {
    box-shadow: 0 0 0 1px var(--el-color-primary-light-5) inset;
  }

  .metrics-monitor-toolbar__select :deep(.el-select__wrapper.is-focused) {
    box-shadow:
      0 0 0 1px var(--el-color-primary) inset,
      0 0 0 2px var(--el-color-primary-light-8);
  }

  .metrics-monitor-toolbar__select :deep(.el-select__selected-item) {
    font-size: 13px;
  }

  .metrics-monitor-toolbar__legend {
    margin-left: auto;
    font-size: 13px;
    color: var(--el-text-color-regular);
    user-select: none;
  }

  .metrics-monitor-toolbar__legend :deep(.el-checkbox__label) {
    font-size: 13px;
    padding-left: 6px;
  }

  .metrics-monitor-toolbar__more-btn {
    width: 32px;
    height: 32px;
    margin-left: -4px;
    padding: 0;
    color: var(--el-text-color-regular);
    border: 1px solid var(--el-border-color);
    border-radius: 2px;
    background: var(--el-bg-color);
  }

  .metrics-monitor-toolbar__more-btn:hover {
    color: var(--el-text-color-primary);
    border-color: var(--el-color-primary-light-5);
    background: var(--el-color-primary-light-9);
  }

  @media (max-width: 640px) {
    .metrics-monitor-toolbar__bar {
      align-items: flex-start;
    }

    .metrics-monitor-toolbar__divider {
      display: none;
    }

    .metrics-monitor-toolbar__group {
      flex: 1 1 140px;
    }

    .metrics-monitor-toolbar__select {
      flex: 1;
      min-width: 0;
    }

    .metrics-monitor-toolbar__legend {
      margin-left: 0;
    }

    .metrics-monitor-toolbar__more-btn {
      margin-left: 0;
    }
  }
</style>

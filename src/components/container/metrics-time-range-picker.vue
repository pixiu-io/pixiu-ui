<!-- 监控时间区间选择（快捷项 + 自定义 datetimerange） -->
<template>
  <div class="metrics-time-range-picker" :class="{ 'is-custom-range': isCustomRange }">
    <button
      type="button"
      class="metrics-time-range-picker__trigger"
      :class="{ 'is-active': panelVisible }"
      @click="openPicker"
    >
      <span class="metrics-time-range-picker__label">{{ displayLabel }}</span>
      <ElIcon class="metrics-time-range-picker__icon"><Calendar /></ElIcon>
    </button>
    <ElDatePicker
      ref="pickerRef"
      v-model="pickerDraft"
      type="datetimerange"
      class="metrics-time-range-picker__picker"
      placement="top-start"
      :shortcuts="shortcuts"
      :clearable="false"
      range-separator="至"
      start-placeholder="开始日期"
      end-placeholder="结束日期"
      format="YYYY-MM-DD HH:mm:ss"
      value-format="x"
      :default-time="defaultTimeRange"
      popper-class="metrics-time-range-picker__popper"
      teleported
      @visible-change="onPanelVisibleChange"
      @change="onPickerChange"
    />
  </div>
</template>

<script setup lang="ts">
  import { Calendar } from '@element-plus/icons-vue'
  import type { ElDatePicker } from 'element-plus'
  import {
    buildMetricsTimeShortcuts,
    fromDateTimePickerValue,
    getMetricsTimeRangeLabel,
    toDateTimePickerValue,
    type MetricsTimeRange
  } from '@/utils/metrics/time-range'

  const model = defineModel<MetricsTimeRange>({ required: true })

  const pickerRef = ref<InstanceType<typeof ElDatePicker> | null>(null)
  const panelVisible = ref(false)
  const shortcuts = buildMetricsTimeShortcuts()
  const defaultTimeRange: [Date, Date] = [
    new Date(2000, 0, 1, 0, 0, 0),
    new Date(2000, 0, 1, 23, 59, 59)
  ]

  const pickerDraft = ref<[number, number] | null>(null)
  const displayLabel = computed(() => getMetricsTimeRangeLabel(model.value))
  const isCustomRange = computed(() => model.value?.presetKey === 'custom')

  function syncDraftFromModel() {
    const [start, end] = toDateTimePickerValue(model.value)
    pickerDraft.value = [start.getTime(), end.getTime()]
  }

  watch(model, syncDraftFromModel, { immediate: true, deep: true })

  function openPicker() {
    syncDraftFromModel()
    pickerRef.value?.handleOpen?.()
  }

  function onPanelVisibleChange(visible: boolean) {
    panelVisible.value = visible
    if (visible) syncDraftFromModel()
  }

  function onPickerChange(value: [number, number] | null) {
    if (!value?.[0] || !value?.[1]) return
    const next = fromDateTimePickerValue([new Date(value[0]), new Date(value[1])])
    if (!next) return
    model.value = next
  }
</script>

<style scoped lang="scss">
  @use './metrics-toolbar-controls.scss' as toolbar;

  .metrics-time-range-picker {
    position: relative;
    display: inline-flex;
    min-width: 168px;
    max-width: 280px;
    flex: 1 1 200px;
  }

  .metrics-time-range-picker__trigger {
    @include toolbar.metrics-toolbar-control-base;
    @include toolbar.metrics-toolbar-control-interactive;
    width: 100%;

    &.is-active {
      border-color: var(--el-color-primary);
      box-shadow: 0 0 0 2px var(--el-color-primary-light-8);
    }
  }

  .metrics-time-range-picker__label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }

  .metrics-time-range-picker__icon {
    flex-shrink: 0;
    font-size: 15px;
    color: var(--el-text-color-secondary);
  }

  .metrics-time-range-picker__picker {
    position: absolute;
    left: 0;
    top: calc(100% + 4px);
    width: 0;
    height: 0;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
    z-index: -1;
  }
</style>

<style lang="scss">
  .metrics-time-range-picker__popper.el-picker__popper {
    margin-top: 6px !important;
  }

  .metrics-time-range-picker__popper .el-date-range-picker {
    width: 680px;
  }

  .metrics-time-range-picker__popper .el-picker-panel {
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--el-border-color-lighter);
  }

  .metrics-time-range-picker__popper .el-picker-panel__body-wrapper {
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }

  .metrics-time-range-picker__popper .el-picker-panel__sidebar {
    order: 0;
    position: static !important;
    inset: auto !important;
    width: 100%;
    height: auto !important;
    float: none !important;
    border-right: none;
    border-bottom: 1px solid var(--el-border-color);
    padding: 12px 16px 10px;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 8px 16px;
    justify-content: flex-start;
    background: var(--el-bg-color);
  }

  .metrics-time-range-picker__popper .el-picker-panel__sidebar + .el-picker-panel__body {
    order: 1;
    margin-left: 0 !important;
    width: 100%;
    padding-top: 6px;
  }

  .metrics-time-range-picker__popper .el-date-range-picker.has-sidebar {
    width: 680px;
  }

  .metrics-time-range-picker__popper .el-picker-panel__shortcut {
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    width: auto !important;
    max-width: none !important;
    flex: 0 0 auto;
    min-width: 52px;
    height: 30px;
    margin: 0;
    padding: 0 10px;
    border: 1px solid transparent;
    border-radius: 3px;
    font-size: 13px;
    font-weight: 500;
    line-height: 1;
    color: var(--el-text-color-regular);
    background: transparent;
    transition:
      color 0.15s,
      border-color 0.15s,
      background-color 0.15s;
  }

  .metrics-time-range-picker__popper .el-picker-panel__shortcut:hover {
    color: var(--el-color-primary);
    background: transparent;
  }

  .metrics-time-range-picker__popper .el-picker-panel__shortcut.active,
  .metrics-time-range-picker__popper .el-picker-panel__shortcut.is-active {
    color: var(--el-color-primary);
    border-color: var(--el-color-primary);
    background: var(--el-bg-color);
  }

  .metrics-time-range-picker__popper .el-date-range-picker__time-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--el-border-color-lighter);
    background: var(--el-fill-color-blank);
  }

  .metrics-time-range-picker__popper
    .el-date-range-picker__time-header
    .el-date-range-picker__editor {
    height: 32px;
  }

  .metrics-time-range-picker__popper .el-date-range-picker__time-header .el-input__wrapper {
    min-height: 32px;
    border-radius: 2px;
    box-shadow: 0 0 0 1px var(--el-border-color) inset;
  }

  .metrics-time-range-picker__popper .el-picker-panel__body {
    padding: 10px 8px 8px;
  }

  .metrics-time-range-picker__popper .el-date-range-picker__content {
    padding: 0 10px;
  }

  .metrics-time-range-picker__popper .el-date-range-picker__header {
    margin-bottom: 8px;
  }

  .metrics-time-range-picker__popper .el-date-table td div {
    height: 28px;
    padding: 0;
  }

  .metrics-time-range-picker__popper .el-date-table td span {
    width: 26px;
    height: 26px;
    line-height: 26px;
  }

  .metrics-time-range-picker__popper .el-picker-panel__footer {
    padding: 10px 16px 12px;
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .metrics-time-range-picker__popper .el-picker-panel__footer .el-button--primary {
    min-width: 88px;
    height: 32px;
    border-radius: 2px;
  }
</style>

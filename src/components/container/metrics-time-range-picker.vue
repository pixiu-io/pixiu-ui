<template>
  <div class="metrics-time-range-picker" :class="{ 'is-custom-range': isCustomRange }">
    <button
      ref="triggerRef"
      type="button"
      class="metrics-time-range-picker__trigger"
      :class="{ 'is-active': panelVisible }"
      aria-haspopup="dialog"
      :aria-expanded="panelVisible"
      @click="togglePanel"
    >
      <ElIcon class="metrics-time-range-picker__clock"><Clock /></ElIcon>
      <span class="metrics-time-range-picker__range">{{ displayRangeLabel }}</span>
      <ElIcon class="metrics-time-range-picker__caret">
        <ArrowUp v-if="panelVisible" />
        <ArrowDown v-else />
      </ElIcon>
    </button>

    <Teleport to="body">
      <Transition name="el-zoom-in-top">
        <div
          v-if="panelVisible"
          ref="panelRef"
          class="metrics-time-range-picker__popover"
          :style="panelStyle"
        >
          <div class="metrics-time-range-picker__panel">
            <section class="metrics-time-range-picker__absolute">
              <h3>绝对时间范围</h3>

              <label for="metrics-range-start">开始</label>
              <ElDatePicker
                id="metrics-range-start"
                v-model="absoluteStart"
                type="datetime"
                format="YYYY-MM-DD HH:mm:ss"
                placeholder="开始时间"
                :clearable="false"
                :show-now="true"
                :show-confirm="true"
                popper-class="metrics-time-range-picker__date-popper"
              />

              <label for="metrics-range-end">结束</label>
              <ElDatePicker
                id="metrics-range-end"
                v-model="absoluteEnd"
                type="datetime"
                format="YYYY-MM-DD HH:mm:ss"
                placeholder="结束时间"
                :clearable="false"
                :show-now="true"
                :show-confirm="true"
                popper-class="metrics-time-range-picker__date-popper"
              />

              <div class="metrics-time-range-picker__actions">
                <ElButton
                  type="primary"
                  size="small"
                  :disabled="!canApplyAbsolute"
                  @click="applyAbsoluteRange"
                >
                  应用时间范围
                </ElButton>
              </div>

              <div v-if="recentRanges.length" class="metrics-time-range-picker__recent">
                <h3>最近使用的绝对范围</h3>
                <button
                  v-for="range in recentRanges"
                  :key="`${range.start.getTime()}-${range.end.getTime()}`"
                  type="button"
                  @click="applyRecentRange(range)"
                >
                  {{ formatRange(range) }}
                </button>
              </div>
            </section>

            <section class="metrics-time-range-picker__quick">
              <ElInput v-model="quickSearch" clearable placeholder="搜索快速范围">
                <template #prefix>
                  <ElIcon><Search /></ElIcon>
                </template>
              </ElInput>

              <div class="metrics-time-range-picker__quick-list">
                <button
                  v-for="preset in filteredPresets"
                  :key="preset.key"
                  type="button"
                  :class="{ 'is-active': model.presetKey === preset.key }"
                  @click="applyPreset(preset)"
                >
                  {{ preset.label }}
                </button>
              </div>
            </section>

            <footer class="metrics-time-range-picker__footer">
              <span>浏览器时间</span>
              <strong>{{ browserTimeZone }}</strong>
              <span>{{ utcOffset }}</span>
            </footer>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { ArrowDown, ArrowUp, Clock, Search } from '@element-plus/icons-vue'
  import {
    formatDateTime,
    fromDateTimePickerValue,
    METRICS_TIME_PRESETS,
    getMetricsTimeRangeLabel,
    type MetricsTimePreset,
    type MetricsTimeRange
  } from '@/utils/metrics/time-range'

  const model = defineModel<MetricsTimeRange>({ required: true })

  const triggerRef = ref<HTMLElement>()
  const panelRef = ref<HTMLElement>()
  const panelStyle = ref<Record<string, string>>({})
  const panelVisible = ref(false)
  const absoluteStart = ref<Date>()
  const absoluteEnd = ref<Date>()
  const quickSearch = ref('')
  const recentRanges = ref<MetricsTimeRange[]>([])

  const displayRangeLabel = computed(() => getMetricsTimeRangeLabel(model.value))
  const isCustomRange = computed(
    () => !METRICS_TIME_PRESETS.some((p) => p.key === model.value.presetKey)
  )
  const canApplyAbsolute = computed(() => {
    const start = absoluteStart.value
    const end = absoluteEnd.value
    // 防御：datetime picker 可能返回非 Date 值（如字符串），避免 getTime 崩溃
    if (!(start instanceof Date) || !(end instanceof Date)) return false
    return start.getTime() < end.getTime()
  })
  const filteredPresets = computed(() => {
    const keyword = quickSearch.value.trim().toLowerCase()
    if (!keyword) return METRICS_TIME_PRESETS
    return METRICS_TIME_PRESETS.filter((preset) =>
      `${preset.label} ${preset.key}`.toLowerCase().includes(keyword)
    )
  })
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local'
  const utcOffset = computed(() => {
    const offsetMinutes = -new Date().getTimezoneOffset()
    const sign = offsetMinutes >= 0 ? '+' : '-'
    const absolute = Math.abs(offsetMinutes)
    const hours = String(Math.floor(absolute / 60)).padStart(2, '0')
    const minutes = String(absolute % 60).padStart(2, '0')
    return `UTC${sign}${hours}:${minutes}`
  })

  watch(model, syncDraftFromModel, { immediate: true, deep: true })

  useEventListener(window, 'resize', () => {
    if (panelVisible.value) void updatePanelPosition()
  })
  useEventListener(
    window,
    'scroll',
    () => {
      if (panelVisible.value) void updatePanelPosition()
    },
    true
  )
  useEventListener(window, 'pointerdown', handleGlobalPointerDown)

  async function updatePanelPosition() {
    const trigger = triggerRef.value
    if (!trigger || !panelVisible.value) return
    const rect = trigger.getBoundingClientRect()
    const viewportWidth = document.documentElement.clientWidth
    const viewportHeight = document.documentElement.clientHeight
    const panelWidth = Math.min(548, viewportWidth - 24)
    let left = Math.max(12, Math.min(rect.right - panelWidth, viewportWidth - panelWidth - 12))
    let top = rect.bottom + 4
    await nextTick()
    const panelHeight = panelRef.value?.offsetHeight ?? 0
    if (top + panelHeight > viewportHeight - 12) {
      top = Math.max(12, viewportHeight - panelHeight - 12)
    }
    panelStyle.value = {
      // position/z-index 由 CSS 保证，这里只更新定位
      top: `${top}px`,
      left: `${left}px`,
      width: `${panelWidth}px`
    }
  }

  function togglePanel() {
    if (panelVisible.value) {
      panelVisible.value = false
      return
    }
    syncDraftFromModel()
    panelVisible.value = true
    void updatePanelPosition()
  }

  function handleGlobalPointerDown(event: PointerEvent) {
    if (!panelVisible.value) return
    const target = event.target as Node
    if (triggerRef.value?.contains(target)) return
    if (panelRef.value?.contains(target)) return
    const path = event.composedPath?.() ?? []
    const isDatePopper = path.some(
      (el) => el instanceof Element && el.matches('.metrics-time-range-picker__date-popper')
    )
    if (isDatePopper) return
    panelVisible.value = false
  }

  function formatRange(range: MetricsTimeRange): string {
    return `${formatDateTime(range.start)} ~ ${formatDateTime(range.end)}`
  }

  function syncDraftFromModel() {
    absoluteStart.value = new Date(model.value.start)
    absoluteEnd.value = new Date(model.value.end)
  }

  function applyAbsoluteRange() {
    if (!absoluteStart.value || !absoluteEnd.value) return
    const next = fromDateTimePickerValue([absoluteStart.value, absoluteEnd.value])
    if (!next) return
    model.value = next
    rememberRange(next)
    panelVisible.value = false
  }

  function applyPreset(preset: MetricsTimePreset) {
    model.value = preset.getRange(new Date())
    panelVisible.value = false
  }

  function applyRecentRange(range: MetricsTimeRange) {
    model.value = {
      start: new Date(range.start),
      end: new Date(range.end),
      presetKey: 'custom'
    }
    panelVisible.value = false
  }

  function rememberRange(range: MetricsTimeRange) {
    const key = `${range.start.getTime()}-${range.end.getTime()}`
    recentRanges.value = [
      {
        start: new Date(range.start),
        end: new Date(range.end),
        presetKey: 'custom'
      },
      ...recentRanges.value.filter(
        (item) => `${item.start.getTime()}-${item.end.getTime()}` !== key
      )
    ].slice(0, 3)
  }
</script>

<style scoped lang="scss">
  @use './metrics-toolbar-controls.scss' as toolbar;

  .metrics-time-range-picker {
    flex: 1 1 500px;
    width: 100%;
    min-width: 440px;
    max-width: 620px;
  }

  .metrics-time-range-picker__trigger {
    @include toolbar.metrics-toolbar-control-base;
    @include toolbar.metrics-toolbar-control-interactive;

    display: flex;
    gap: 8px;
    align-items: center;
    width: 100%;
    padding: 0 10px;

    &.is-active {
      border-color: var(--el-color-primary);
      box-shadow: 0 0 0 1px var(--el-color-primary) inset;
    }
  }

  .metrics-time-range-picker__clock,
  .metrics-time-range-picker__caret {
    flex: 0 0 auto;
    font-size: 15px;
    color: var(--el-text-color-secondary);
  }

  .metrics-time-range-picker__range {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-size: 12px;
    color: var(--el-text-color-regular);
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (width <= 640px) {
    .metrics-time-range-picker {
      min-width: 0;
      max-width: none;
    }

    .metrics-time-range-picker__trigger {
      min-width: 0;
      max-width: none;
    }

    .metrics-time-range-picker__range {
      font-size: 11px;
    }
  }
</style>

<style lang="scss">
  /* ElDatePicker 日历 popper 需高于时间面板(4000)，避免选择日期时被面板遮挡 */
  .metrics-time-range-picker__date-popper {
    z-index: 4100 !important;
  }

  .metrics-time-range-picker__popover {
    /* fixed + 高 z-index 由 CSS 保证，不依赖 JS panelStyle（避免 JS 未及时设置时被 ElDrawer 遮罩盖住） */
    position: fixed;
    z-index: 4000;
    padding: 0;
    overflow: hidden;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color);
    border-radius: 3px;
    box-shadow: var(--el-box-shadow-dark);
  }

  .metrics-time-range-picker__panel {
    display: grid;
    grid-template-rows: minmax(0, 1fr) 40px;
    grid-template-columns: minmax(0, 4.6fr) minmax(190px, 5fr);
    max-height: calc(100vh - 110px);
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .metrics-time-range-picker__panel .el-input__inner,
  .metrics-time-range-picker__panel .el-input__inner::placeholder,
  .metrics-time-range-picker__panel .el-button {
    font-size: 12px;
  }

  .metrics-time-range-picker__absolute,
  .metrics-time-range-picker__quick {
    min-height: 0;
    padding: 12px;
  }

  .metrics-time-range-picker__absolute {
    overflow-y: auto;
    border-right: 1px solid var(--el-border-color);
  }

  .metrics-time-range-picker__absolute h3 {
    margin: 0 0 10px;
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
  }

  .metrics-time-range-picker__absolute label {
    display: block;
    margin: 9px 0 5px;
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
  }

  .metrics-time-range-picker__absolute .el-date-editor.el-input {
    width: 100%;
  }

  .metrics-time-range-picker__absolute .el-input__wrapper,
  .metrics-time-range-picker__quick .el-input__wrapper {
    min-height: 34px;
    border-radius: 2px;
  }

  .metrics-time-range-picker__actions {
    display: flex;
    margin-top: 12px;
  }

  .metrics-time-range-picker__actions .el-button {
    --el-button-size: 28px;

    border-radius: 2px;
  }

  .metrics-time-range-picker__recent {
    margin-top: 18px;
  }

  .metrics-time-range-picker__recent button {
    display: block;
    width: 100%;
    padding: 5px 0;
    overflow: hidden;
    font-size: 12px;
    line-height: 16px;
    color: var(--el-text-color-secondary);
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
    background: transparent;
    border: 0;
  }

  .metrics-time-range-picker__recent button:hover {
    color: var(--el-color-primary);
  }

  .metrics-time-range-picker__quick {
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow: hidden;
  }

  .metrics-time-range-picker__quick-list {
    min-height: 0;
    overflow-y: auto;
  }

  .metrics-time-range-picker__quick-list button {
    display: block;
    width: 100%;
    height: 31px;
    padding: 0 5px;
    font-size: 12px;
    color: var(--el-text-color-regular);
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 0;
  }

  .metrics-time-range-picker__quick-list button:hover,
  .metrics-time-range-picker__quick-list button.is-active {
    color: var(--el-color-primary);
    background: var(--el-fill-color-light);
  }

  .metrics-time-range-picker__footer {
    display: flex;
    grid-column: 1 / -1;
    gap: 8px;
    align-items: center;
    padding: 0 12px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    border-top: 1px solid var(--el-border-color);
  }

  .metrics-time-range-picker__footer strong {
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .metrics-time-range-picker__footer span:last-child {
    margin-left: auto;
  }

  @media (width <= 640px) {
    .metrics-time-range-picker__panel {
      grid-template-rows: auto auto 40px;
      grid-template-columns: 1fr;
      overflow-y: auto;
    }

    .metrics-time-range-picker__absolute {
      border-right: 0;
      border-bottom: 1px solid var(--el-border-color);
    }

    .metrics-time-range-picker__quick-list {
      max-height: 190px;
    }

    .metrics-time-range-picker__footer {
      grid-column: 1;
    }
  }
</style>

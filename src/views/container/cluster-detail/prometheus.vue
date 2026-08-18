<template>
  <div class="prometheus-dashboard" :style="{ '--prom-nav-color': menuTheme.textColor }">
    <template v-if="datasources.length > 0">
      <div class="prometheus-dashboard__source-bar">
        <label>Prometheus 实例:</label>
        <span class="prometheus-dashboard__source-value">{{
          selectedDatasource?.name || '—'
        }}</span>
        <div class="prometheus-dashboard__summary">
          <span class="prometheus-dashboard__health-dot" :class="pageHealth" />
          <span>{{ pageHealthLabel }}</span>
          <span class="prometheus-dashboard__updated">更新于 {{ lastUpdatedLabel }}</span>
        </div>
      </div>
    </template>

    <ElAlert
      v-if="pageError"
      class="prometheus-dashboard__alert"
      type="error"
      :title="pageError"
      show-icon
      closable
      @close="pageError = ''"
    />

    <PrometheusOnboarding v-if="!datasources.length" @associate="associateVisible = true" />

    <div v-else-if="!selectedDatasourceId" class="prometheus-dashboard__empty">
      <ElEmpty description="请选择 Prometheus 数据源" :image-size="96" />
    </div>

    <div v-else class="prometheus-dashboard__monitor-card">
      <div class="prometheus-dashboard__monitor-tabs">
        <div class="prometheus-dashboard__monitor-tab is-active">监控详情</div>
      </div>

      <div class="prometheus-dashboard__workspace">
        <aside class="prometheus-dashboard__nav" aria-label="仪表盘分组">
          <div
            v-for="section in definition.sections"
            :key="section.id"
            class="prometheus-dashboard__nav-group"
          >
            <button
              type="button"
              class="prometheus-dashboard__nav-heading"
              :aria-expanded="isNavGroupExpanded(section.id)"
              @click="toggleNavGroup(section.id)"
            >
              <ElIcon
                class="prometheus-dashboard__nav-chevron"
                :class="{ 'is-expanded': isNavGroupExpanded(section.id) }"
              >
                <CaretRight />
              </ElIcon>
              <span>{{ section.title }}</span>
            </button>
            <div v-show="isNavGroupExpanded(section.id)" class="prometheus-dashboard__nav-items">
              <button
                v-if="!section.children?.length"
                type="button"
                class="prometheus-dashboard__nav-item"
                :class="{ 'is-active': activeSection === section.id }"
                @click="selectSection(section.id)"
              >
                {{ section.title }}
              </button>
              <button
                v-for="child in section.children"
                v-else
                :key="child"
                type="button"
                class="prometheus-dashboard__nav-item"
                :class="{ 'is-active': activeSection === child }"
                @click="selectSection(child)"
              >
                {{ sectionNames[child] || child }}
              </button>
            </div>
          </div>
        </aside>

        <main class="prometheus-dashboard__content">
          <MetricsMonitorToolbar
            v-model:timeRange="timeRange"
            v-model:granularity="granularity"
            v-model:autoRefresh="autoRefresh"
            :show-granularity="false"
            :show-legend="false"
            class="prometheus-dashboard__toolbar"
          />

          <div class="prometheus-dashboard__panel-grid">
            <DashboardPanel
              v-for="panel in currentPanels"
              :key="`${panel.id}:${resultMap[panel.id]?.status ?? 'pending'}`"
              :panel="panel"
              :result="resultMap[panel.id]"
              :loading="queryLoading"
              :show-legend="showLegend"
              @time-range-select="handleChartTimeRangeSelect"
            />
          </div>
        </main>
      </div>
    </div>

    <AssociatePrometheusDialog
      v-model="associateVisible"
      :cluster-name="clusterName"
      @associated="handleAssociated"
    />
  </div>
</template>

<script setup lang="ts">
  import { CaretRight } from '@element-plus/icons-vue'
  import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { useSettingStore } from '@/store/modules/setting'
  import MetricsMonitorToolbar from '@/components/container/metrics-monitor-toolbar.vue'
  import PrometheusOnboarding from '@/components/monitor/prometheus-onboarding.vue'
  import {
    fetchDashboardDefinition,
    fetchDashboardQuery,
    type DashboardDefinition,
    type DashboardFilters,
    type DashboardPanelResult
  } from '@/api/dashboard'
  import { fetchDatasourceList, type DatasourceItem } from '@/api/datasource'
  import {
    fromDateTimePickerValue,
    getDefaultMetricsTimeRange,
    METRICS_TIME_PRESETS,
    type MetricsTimeRange
  } from '@/utils/metrics/time-range'
  import {
    getDefaultMetricsAutoRefresh,
    type MetricsAutoRefreshOption
  } from '@/utils/metrics/auto-refresh'
  import {
    getDefaultMetricsGranularity,
    type MetricsGranularityOption
  } from '@/utils/metrics/granularity'
  import DashboardPanel from '@/views/safeguard/dashboard/modules/DashboardPanel.vue'
  import AssociatePrometheusDialog from './associate-prometheus-dialog.vue'

  defineOptions({ name: 'ClusterDetailPrometheus' })

  const route = useRoute()
  const settingStore = useSettingStore()
  const menuTheme = computed(() => settingStore.getMenuTheme)

  const clusterName = computed(() => String(route.query.cluster ?? ''))

  const definition = ref<DashboardDefinition>({ sections: [], panels: [] })
  const datasources = ref<DatasourceItem[]>([])
  const selectedDatasourceId = ref<number>()
  const filters = reactive<DashboardFilters>({})
  const activeSection = ref('cluster')
  const expandedNavGroups = ref<string[]>([])
  const resultMap = reactive<Record<string, DashboardPanelResult>>({})
  const datasourceLoading = ref(false)
  const queryLoading = ref(false)
  const pageError = ref('')
  const associateVisible = ref(false)
  const lastUpdated = ref<Date>()
  const timeRange = ref<MetricsTimeRange>(getDefaultMetricsTimeRange())
  const granularity = ref<MetricsGranularityOption>(getDefaultMetricsGranularity())
  const autoRefresh = ref<MetricsAutoRefreshOption>(getDefaultMetricsAutoRefresh())
  const showLegend = ref(true)
  let refreshTimer: number | undefined
  let querySequence = 0

  const sectionNames: Record<string, string> = {
    cluster: '集群监控概览',
    namespace: 'Namespace 大盘',
    kubelet: 'Kubelet',
    'control-plane': '控制面组件',
    'node-resource': '集群节点监控详情',
    'node-pod': '节点 Pod 监控',
    workload: '工作负载监控概览',
    pod: '集群 Pod 监控'
  }

  const selectedDatasource = computed(() =>
    datasources.value.find((item) => item.id === selectedDatasourceId.value)
  )
  const currentPanels = computed(() =>
    definition.value.panels.filter((panel) => panel.section === activeSection.value)
  )
  const resultValues = computed(() =>
    currentPanels.value.map((panel) => resultMap[panel.id]).filter(Boolean)
  )
  const pageHealth = computed(() => {
    if (!selectedDatasourceId.value) return 'idle'
    if (queryLoading.value) return 'loading'
    if (resultValues.value.some((item) => item.status === 'error')) return 'warning'
    return 'healthy'
  })
  const pageHealthLabel = computed(() => {
    if (pageHealth.value === 'idle') return '未选择数据源'
    if (pageHealth.value === 'loading') return '查询中'
    if (pageHealth.value === 'warning') return '部分面板异常'
    return '数据源正常'
  })
  const lastUpdatedLabel = computed(() =>
    lastUpdated.value
      ? lastUpdated.value.toLocaleTimeString('zh-CN', { hour12: false })
      : '--:--:--'
  )

  async function loadInitialData() {
    datasourceLoading.value = true
    pageError.value = ''
    try {
      const [dashboardDefinition, datasourceResult] = await Promise.all([
        fetchDashboardDefinition(),
        fetchDatasourceList({ page: 1, limit: 200, type: 1, subType: 'prometheus' })
      ])
      definition.value = dashboardDefinition
      expandedNavGroups.value = dashboardDefinition.sections.map((section) => section.id)
      datasources.value = datasourceResult.items.filter(
        (item) =>
          item.type === 1 && item.subType === 'prometheus' && item.clusterName === clusterName.value
      )
      const preferred = datasources.value.find((item) => item.isDefault) ?? datasources.value[0]
      selectedDatasourceId.value = preferred?.id
      if (preferred) {
        await queryCurrentSection()
      }
    } catch (error) {
      pageError.value = error instanceof Error ? error.message : '监控面板加载失败'
    } finally {
      datasourceLoading.value = false
    }
  }

  function normalizedTimeRange(): MetricsTimeRange {
    const preset = METRICS_TIME_PRESETS.find((item) => item.key === timeRange.value.presetKey)
    if (
      !preset ||
      timeRange.value.presetKey === 'custom' ||
      timeRange.value.presetKey === 'yesterday'
    ) {
      return timeRange.value
    }
    return preset.getRange(new Date())
  }

  function handleChartTimeRangeSelect(range: { start: number; end: number }) {
    const next = fromDateTimePickerValue([new Date(range.start), new Date(range.end)])
    if (!next) return
    timeRange.value = next
  }

  async function queryCurrentSection() {
    const datasource = selectedDatasource.value
    if (!datasource || !currentPanels.value.length) return
    const sequence = ++querySequence
    queryLoading.value = true
    pageError.value = ''
    try {
      const range = normalizedTimeRange()
      const durationSeconds = Math.max(
        1,
        Math.floor((range.end.getTime() - range.start.getTime()) / 1000)
      )
      const step = Math.max(
        Math.ceil(granularity.value.stepMs / 1000),
        Math.ceil(durationSeconds / 600)
      )
      const response = await fetchDashboardQuery(datasource, {
        panelIds: currentPanels.value.map((panel) => panel.id),
        start: Math.floor(range.start.getTime() / 1000),
        end: Math.floor(range.end.getTime() / 1000),
        step,
        filters
      })
      if (sequence !== querySequence) return
      for (const result of response.results) resultMap[result.id] = result
      lastUpdated.value = new Date()
    } catch (error) {
      if (sequence !== querySequence) return
      pageError.value = error instanceof Error ? error.message : '面板查询失败'
    } finally {
      if (sequence === querySequence) queryLoading.value = false
    }
  }

  function selectSection(section: string) {
    if (section === activeSection.value) return
    activeSection.value = section
    queryCurrentSection()
  }

  function isNavGroupExpanded(sectionId: string) {
    return expandedNavGroups.value.includes(sectionId)
  }

  function toggleNavGroup(sectionId: string) {
    expandedNavGroups.value = isNavGroupExpanded(sectionId)
      ? expandedNavGroups.value.filter((item) => item !== sectionId)
      : [...expandedNavGroups.value, sectionId]
  }

  async function handleAssociated() {
    await loadInitialData()
  }

  watch(
    () =>
      [
        timeRange.value.start.getTime(),
        timeRange.value.end.getTime(),
        granularity.value.key
      ] as const,
    () => {
      queryCurrentSection()
    }
  )
  watch(
    () => autoRefresh.value.intervalMs,
    (intervalMs) => {
      if (refreshTimer) window.clearInterval(refreshTimer)
      refreshTimer = undefined
      if (intervalMs && intervalMs > 0) {
        refreshTimer = window.setInterval(() => queryCurrentSection(), intervalMs)
      }
    },
    { immediate: true }
  )
  onMounted(async () => {
    await loadInitialData()
  })
  onBeforeUnmount(() => {
    if (refreshTimer) window.clearInterval(refreshTimer)
  })
</script>

<style scoped lang="scss">
  .prometheus-dashboard {
    display: flex;
    flex-direction: column;
    min-width: 0;
    height: 100%;
    color: var(--el-text-color-primary);
  }

  .prometheus-dashboard__source-bar {
    display: flex;
    flex: 0 0 auto;
    gap: 10px;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .prometheus-dashboard__source-bar label {
    flex: 0 0 auto;
    font-size: 13px;
    line-height: 20px;
    color: var(--el-text-color-regular);
  }

  .prometheus-dashboard__source-value {
    flex: 0 0 auto;
    font-size: 13px;
    line-height: 20px;
    color: var(--el-text-color-regular);
  }

  .prometheus-dashboard__source-bar .prometheus-dashboard__summary {
    flex: 0 0 auto;
    margin-left: auto;
    line-height: 20px;
  }

  .prometheus-dashboard__summary {
    display: flex;
    flex: 0 0 auto;
    gap: 8px;
    align-items: center;
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .prometheus-dashboard__health-dot {
    width: 8px;
    height: 8px;
    background: var(--el-text-color-placeholder);
    border-radius: 50%;
  }

  .prometheus-dashboard__health-dot.healthy {
    background: #2e9b62;
  }

  .prometheus-dashboard__health-dot.warning {
    background: #d99a2b;
  }

  .prometheus-dashboard__health-dot.loading {
    background: #2878d4;
  }

  .prometheus-dashboard__updated {
    margin-left: 4px;
    color: var(--el-text-color-regular);
  }

  .prometheus-dashboard__toolbar {
    margin-bottom: 12px;
  }

  /* 工具栏视觉压缩：贴近集群监控抽屉样式 */
  .prometheus-dashboard__toolbar :deep(.metrics-monitor-toolbar) {
    margin-bottom: 0;
  }

  .prometheus-dashboard__toolbar :deep(.metrics-monitor-toolbar__bar) {
    gap: 8px;
    justify-content: flex-end;
    padding: 0 10px 0 0;
    background: transparent;
    border: none;
    border-radius: 0;
  }

  .prometheus-dashboard__toolbar :deep(.metrics-monitor-toolbar__time) {
    flex: 0 0 auto;
  }

  .prometheus-dashboard__toolbar :deep(.metrics-monitor-toolbar__divider) {
    height: 24px;
    margin: 0 2px;
    background: var(--el-border-color-light);
    opacity: 1;
  }

  .prometheus-dashboard__toolbar :deep(.metrics-time-range-picker) {
    width: 240px;
    min-width: 240px;
    max-width: 240px;
    transition: width 0.2s ease;
  }

  .prometheus-dashboard__toolbar :deep(.metrics-time-range-picker.is-custom-range) {
    width: 340px;
    min-width: 340px;
    max-width: 340px;
  }

  .prometheus-dashboard__toolbar :deep(.metrics-time-range-picker__trigger) {
    min-height: 32px;
    padding: 0 8px;
    font-size: 12px;
    background: var(--el-bg-color);
    border-color: var(--el-border-color);
    border-radius: 2px;
  }

  /* 隐藏内部 DatePicker 输入框，只保留自定义触发按钮 */
  .prometheus-dashboard__toolbar :deep(.metrics-time-range-picker__picker) {
    display: none !important;
  }

  .prometheus-dashboard__toolbar :deep(.metrics-monitor-toolbar__select .el-select__wrapper) {
    min-height: 32px;
    padding: 0 10px;
    background: var(--el-bg-color);
    border-radius: 2px;
    box-shadow: 0 0 0 1px var(--el-border-color) inset;
  }

  .prometheus-dashboard__toolbar :deep(.metrics-monitor-toolbar__group) {
    gap: 6px;
    align-items: center;
  }

  .prometheus-dashboard__toolbar :deep(.metrics-monitor-toolbar__group-label) {
    display: inline-flex;
    gap: 0;
    align-items: center;
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .prometheus-dashboard__toolbar :deep(.metrics-monitor-toolbar__group-icon) {
    display: none;
  }

  .prometheus-dashboard__toolbar :deep(.metrics-monitor-toolbar__select) {
    width: 92px;
  }

  .prometheus-dashboard__toolbar :deep(.metrics-monitor-toolbar__select--refresh) {
    width: 86px;
  }

  .prometheus-dashboard__toolbar :deep(.metrics-monitor-toolbar__legend) {
    display: inline-flex;
    align-items: center;
    height: 32px;
    margin-left: 6px;
    font-size: 12px;
  }

  .prometheus-dashboard__toolbar :deep(.metrics-monitor-toolbar__legend .el-checkbox__inner) {
    width: 14px;
    height: 14px;
    border-color: var(--el-border-color);
    border-radius: 2px;
  }

  .prometheus-dashboard__toolbar :deep(.metrics-monitor-toolbar__legend .el-checkbox__label) {
    padding-left: 5px;
    font-size: 12px;
    color: var(--el-text-color-primary);
  }

  .prometheus-dashboard__alert {
    margin-top: 12px;
  }

  .prometheus-dashboard__empty {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    min-height: 0;
    padding: 24px 16px;
  }

  .prometheus-dashboard__monitor-card {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    margin-top: 10px;
    overflow: hidden;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
  }

  .prometheus-dashboard__monitor-tabs {
    display: flex;
    flex: 0 0 auto;
    align-items: flex-start;
    height: 40px;
    padding: 10px 12px 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .prometheus-dashboard__monitor-tab {
    position: relative;
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-regular);
  }

  .prometheus-dashboard__monitor-tab.is-active {
    color: var(--theme-color);

    &::after {
      position: absolute;
      right: 0;
      bottom: -11px;
      left: 0;
      height: 2px;
      content: '';
      background: var(--theme-color);
    }
  }

  .prometheus-dashboard__workspace {
    display: grid;
    flex: 1;
    grid-template-columns: 200px minmax(0, 1fr);
    min-height: 0;
    padding-top: 12px;
  }

  .prometheus-dashboard__nav {
    min-height: 0;
    padding: 8px 6px 16px 10px;
    overflow-y: auto;
    border-right: 1px solid var(--el-border-color-lighter);
    scrollbar-width: thin;
    scrollbar-color: transparent transparent;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: transparent;
      border-radius: 3px;
    }

    &:hover {
      scrollbar-color: rgb(0 0 0 / 25%) transparent;

      &::-webkit-scrollbar-thumb {
        background: rgb(0 0 0 / 25%);
      }
    }
  }

  .prometheus-dashboard__nav-group + .prometheus-dashboard__nav-group {
    margin-top: 4px;
  }

  .prometheus-dashboard__nav-heading {
    display: flex;
    gap: 6px;
    align-items: center;
    width: 100%;
    height: 32px;
    padding: 0 10px;
    font-size: 12px;
    font-weight: 400;
    color: var(--prom-nav-color, var(--art-gray-800));
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 0;
  }

  .prometheus-dashboard__nav-heading:hover {
    color: var(--theme-color);
    background: var(--el-fill-color-light);
  }

  .prometheus-dashboard__nav-chevron {
    flex: 0 0 auto;
    font-size: 11px;
    transition: transform 0.16s ease;
  }

  .prometheus-dashboard__nav-chevron.is-expanded {
    transform: rotate(90deg);
  }

  .prometheus-dashboard__nav-items {
    display: block;
  }

  .prometheus-dashboard__nav-item {
    position: relative;
    display: block;
    width: 100%;
    height: 34px;
    padding: 0 10px 0 30px;
    overflow: hidden;
    font-size: 12px;
    color: var(--prom-nav-color, var(--art-gray-800));
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
    background: transparent;
    border: 0;
  }

  .prometheus-dashboard__nav-item:hover {
    color: var(--theme-color);
    background: var(--el-fill-color-light);
  }

  .prometheus-dashboard__nav-item.is-active {
    font-weight: 600;
    color: var(--theme-color);
    background: var(--el-color-primary-light-9);
  }

  .prometheus-dashboard__content {
    min-width: 0;
    padding: 0 0 4px;
    overflow: auto;
  }

  .prometheus-dashboard__panel-grid {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 12px;
  }

  @media (width <= 768px) {
    .prometheus-dashboard__workspace {
      display: block;
    }

    .prometheus-dashboard__nav {
      display: flex;
      padding: 8px 0;
      overflow-x: auto;
      border-right: 0;
      border-bottom: 1px solid var(--el-border-color-lighter);
    }

    .prometheus-dashboard__nav-group {
      display: flex;
      flex: 0 0 auto;
      align-items: center;
    }

    .prometheus-dashboard__nav-group + .prometheus-dashboard__nav-group {
      margin: 0 0 0 8px;
    }

    .prometheus-dashboard__nav-heading {
      width: auto;
      min-width: max-content;
      padding: 0 8px;
    }

    .prometheus-dashboard__nav-items {
      display: flex;
    }

    .prometheus-dashboard__nav-item {
      width: auto;
      min-width: max-content;
      height: 32px;
      padding: 0 10px;
      border-radius: 3px;
    }

    .prometheus-dashboard__nav-item.is-active::before {
      display: none;
    }

    .prometheus-dashboard__content {
      padding: 12px 0 4px;
    }
  }

  @media (width <= 520px) {
    .prometheus-dashboard__header {
      align-items: flex-start;
    }

    .prometheus-dashboard__summary {
      flex-direction: column;
      gap: 3px;
      align-items: flex-end;
    }

    .prometheus-dashboard__health-dot {
      display: none;
    }

    .prometheus-dashboard__updated {
      margin-left: 0;
    }
  }
</style>

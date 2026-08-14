<template>
  <div class="monitor-dashboard art-full-height">
    <header class="monitor-dashboard__topbar">
      <div class="monitor-dashboard__identity">
        <div class="monitor-dashboard__mark"><ArtSvgIcon icon="ri:pulse-line" /></div>
        <div>
          <h1>Prometheus 监控</h1>
          <p>{{ selectedDatasource?.clusterName || 'Kubernetes 集群' }}</p>
        </div>
      </div>
      <div class="monitor-dashboard__summary">
        <span class="monitor-dashboard__health-dot" :class="pageHealth" />
        <span>{{ pageHealthLabel }}</span>
        <span class="monitor-dashboard__updated">更新于 {{ lastUpdatedLabel }}</span>
      </div>
    </header>

    <section class="monitor-dashboard__filters">
      <div class="monitor-dashboard__filter-group is-source">
        <label>数据源</label>
        <ElSelect
          v-model="selectedDatasourceId"
          placeholder="选择 Prometheus"
          filterable
          :loading="datasourceLoading"
          @change="handleDatasourceChange"
        >
          <ElOption v-for="item in datasources" :key="item.id" :label="item.name" :value="item.id">
            <div class="monitor-dashboard__datasource-option">
              <ArtSvgIcon icon="simple-icons:prometheus" />
              <span>{{ item.name }}</span>
              <small>{{ item.clusterName || (item.external ? '外部' : '内部') }}</small>
            </div>
          </ElOption>
        </ElSelect>
      </div>

      <div class="monitor-dashboard__filter-group">
        <label>Namespace</label>
        <ElSelect
          v-model="filters.namespace"
          clearable
          filterable
          placeholder="全部"
          :loading="variablesLoading"
          @change="handleNamespaceChange"
        >
          <ElOption v-for="item in variables.namespaces" :key="item" :label="item" :value="item" />
        </ElSelect>
      </div>

      <div class="monitor-dashboard__filter-group">
        <label>Node</label>
        <ElSelect
          v-model="filters.node"
          clearable
          filterable
          placeholder="全部"
          :loading="variablesLoading"
          @change="handleNodeChange"
        >
          <ElOption v-for="item in variables.nodes" :key="item" :label="item" :value="item" />
        </ElSelect>
      </div>

      <div class="monitor-dashboard__filter-group">
        <label>工作负载</label>
        <ElSelect
          v-model="selectedWorkload"
          clearable
          filterable
          placeholder="全部"
          :loading="variablesLoading"
          @change="handleWorkloadChange"
        >
          <ElOption
            v-for="item in variables.workloads"
            :key="`${item.kind}/${item.name}`"
            :label="`${item.kind} / ${item.name}`"
            :value="`${item.kind}/${item.name}`"
          />
        </ElSelect>
      </div>

      <div class="monitor-dashboard__filter-group">
        <label>Pod</label>
        <ElSelect
          v-model="filters.pod"
          clearable
          filterable
          placeholder="全部"
          :loading="variablesLoading"
          @change="queryCurrentSection"
        >
          <ElOption v-for="item in variables.pods" :key="item" :label="item" :value="item" />
        </ElSelect>
      </div>

      <div class="monitor-dashboard__time-controls">
        <MetricsTimeRangePicker v-model="timeRange" />
        <div class="monitor-dashboard__refresh-control">
          <ElButton
            class="monitor-dashboard__refresh-action"
            :icon="Refresh"
            :loading="queryLoading"
            title="刷新"
            @click="refreshDashboard"
          >
            刷新
          </ElButton>
          <ElDropdown
            trigger="click"
            popper-class="monitor-dashboard__refresh-menu"
            @command="handleAutoRefreshCommand"
          >
            <button type="button" class="monitor-dashboard__refresh-interval">
              <span>{{ autoRefreshLabel }}</span>
              <ElIcon><ArrowDown /></ElIcon>
            </button>
            <template #dropdown>
              <ElDropdownMenu>
                <ElDropdownItem
                  v-for="item in METRICS_AUTO_REFRESH_OPTIONS"
                  :key="item.key"
                  :command="item.key"
                  :class="{ 'is-active': autoRefreshKey === item.key }"
                >
                  {{ item.label }}
                </ElDropdownItem>
              </ElDropdownMenu>
            </template>
          </ElDropdown>
        </div>
      </div>
    </section>

    <ElAlert
      v-if="pageError"
      class="monitor-dashboard__alert"
      type="error"
      :title="pageError"
      show-icon
      closable
      @close="pageError = ''"
    />

    <div class="monitor-dashboard__workspace">
      <aside class="monitor-dashboard__nav" aria-label="仪表盘分组">
        <div
          v-for="section in definition.sections"
          :key="section.id"
          class="monitor-dashboard__nav-group"
        >
          <button
            type="button"
            class="monitor-dashboard__nav-heading"
            :aria-expanded="isNavGroupExpanded(section.id)"
            @click="toggleNavGroup(section.id)"
          >
            <ElIcon
              class="monitor-dashboard__nav-chevron"
              :class="{ 'is-expanded': isNavGroupExpanded(section.id) }"
            >
              <CaretRight />
            </ElIcon>
            <ArtSvgIcon :icon="section.icon" />
            <span>{{ section.title }}</span>
          </button>
          <div v-show="isNavGroupExpanded(section.id)" class="monitor-dashboard__nav-items">
            <button
              v-if="!section.children?.length"
              type="button"
              class="monitor-dashboard__nav-item"
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
              class="monitor-dashboard__nav-item"
              :class="{ 'is-active': activeSection === child }"
              @click="selectSection(child)"
            >
              {{ sectionNames[child] || child }}
            </button>
          </div>
        </div>
      </aside>

      <main class="monitor-dashboard__content">
        <div class="monitor-dashboard__section-title">
          <div>
            <span>监控详情</span>
            <h2>{{ currentSectionTitle }}</h2>
          </div>
          <div class="monitor-dashboard__legend">
            <span><i class="healthy" />正常</span>
            <span><i class="missing" />指标未采集</span>
            <span><i class="failed" />查询失败</span>
          </div>
        </div>

        <ElEmpty
          v-if="!selectedDatasourceId && !datasourceLoading"
          description="请先添加或选择 Prometheus 数据源"
          :image-size="72"
        />
        <div v-else class="monitor-dashboard__panel-grid">
          <DashboardPanel
            v-for="panel in currentPanels"
            :key="`${panel.id}:${resultMap[panel.id]?.status ?? 'pending'}`"
            :panel="panel"
            :result="resultMap[panel.id]"
            :loading="queryLoading"
            @time-range-select="handleChartTimeRangeSelect"
          />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ArrowDown, CaretRight, Refresh } from '@element-plus/icons-vue'
  import { ElMessage } from 'element-plus'
  import MetricsTimeRangePicker from '@/components/container/metrics-time-range-picker.vue'
  import {
    fetchDashboardDefinition,
    fetchDashboardQuery,
    fetchDashboardVariables,
    type DashboardDefinition,
    type DashboardFilters,
    type DashboardPanelResult,
    type DashboardVariables
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
    METRICS_AUTO_REFRESH_OPTIONS
  } from '@/utils/metrics/auto-refresh'
  import DashboardPanel from './modules/DashboardPanel.vue'

  defineOptions({ name: 'MonitorDashboard' })

  const emptyVariables = (): DashboardVariables => ({
    namespaces: [],
    nodes: [],
    workloads: [],
    pods: []
  })

  const definition = ref<DashboardDefinition>({ sections: [], panels: [] })
  const datasources = ref<DatasourceItem[]>([])
  const selectedDatasourceId = ref<number>()
  const variables = ref<DashboardVariables>(emptyVariables())
  const filters = reactive<DashboardFilters>({})
  const selectedWorkload = ref('')
  const activeSection = ref('cluster')
  const expandedNavGroups = ref<string[]>([])
  const resultMap = reactive<Record<string, DashboardPanelResult>>({})
  const datasourceLoading = ref(false)
  const variablesLoading = ref(false)
  const queryLoading = ref(false)
  const pageError = ref('')
  const lastUpdated = ref<Date>()
  const timeRange = ref<MetricsTimeRange>(getDefaultMetricsTimeRange())
  const autoRefreshKey = ref(getDefaultMetricsAutoRefresh().key)
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
  const currentSectionTitle = computed(() => {
    if (sectionNames[activeSection.value]) return sectionNames[activeSection.value]
    return (
      definition.value.sections.find((item) => item.id === activeSection.value)?.title || '监控概览'
    )
  })
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
  const autoRefreshLabel = computed(
    () =>
      METRICS_AUTO_REFRESH_OPTIONS.find((item) => item.key === autoRefreshKey.value)?.label || '1m'
  )
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
      const initialNavGroup = dashboardDefinition.sections.find(
        (section) =>
          section.id === activeSection.value || section.children?.includes(activeSection.value)
      )
      expandedNavGroups.value = initialNavGroup ? [initialNavGroup.id] : []
      datasources.value = datasourceResult.items.filter(
        (item) => item.type === 1 && item.subType === 'prometheus'
      )
      const preferred = datasources.value.find((item) => item.isDefault) ?? datasources.value[0]
      selectedDatasourceId.value = preferred?.id
      if (preferred) {
        await Promise.all([loadVariables(), queryCurrentSection()])
      }
    } catch (error) {
      pageError.value = error instanceof Error ? error.message : '仪表盘加载失败'
    } finally {
      datasourceLoading.value = false
    }
  }

  async function loadVariables() {
    if (!selectedDatasourceId.value) {
      variables.value = emptyVariables()
      return
    }
    variablesLoading.value = true
    try {
      variables.value = await fetchDashboardVariables(selectedDatasourceId.value, filters)
    } catch (error) {
      pageError.value = error instanceof Error ? error.message : '筛选项加载失败'
    } finally {
      variablesLoading.value = false
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
    if (!selectedDatasourceId.value || !currentPanels.value.length) return
    const sequence = ++querySequence
    queryLoading.value = true
    pageError.value = ''
    try {
      const range = normalizedTimeRange()
      const durationSeconds = Math.max(
        1,
        Math.floor((range.end.getTime() - range.start.getTime()) / 1000)
      )
      const step = Math.max(15, Math.ceil(durationSeconds / 600))
      const response = await fetchDashboardQuery({
        datasourceId: selectedDatasourceId.value,
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

  async function handleDatasourceChange() {
    Object.keys(resultMap).forEach((key) => delete resultMap[key])
    Object.assign(filters, {
      namespace: undefined,
      node: undefined,
      workload_kind: undefined,
      workload_name: undefined,
      pod: undefined
    })
    selectedWorkload.value = ''
    await Promise.all([loadVariables(), queryCurrentSection()])
  }

  async function handleNamespaceChange() {
    filters.workload_kind = undefined
    filters.workload_name = undefined
    filters.pod = undefined
    selectedWorkload.value = ''
    await Promise.all([loadVariables(), queryCurrentSection()])
  }

  async function handleNodeChange() {
    filters.pod = undefined
    await Promise.all([loadVariables(), queryCurrentSection()])
  }

  async function handleWorkloadChange(value: string) {
    const separator = value.indexOf('/')
    filters.workload_kind = separator > 0 ? value.slice(0, separator) : undefined
    filters.workload_name = separator > 0 ? value.slice(separator + 1) : undefined
    filters.pod = undefined
    await Promise.all([loadVariables(), queryCurrentSection()])
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

  function refreshDashboard() {
    Promise.all([loadVariables(), queryCurrentSection()]).then(() => {
      if (!pageError.value) ElMessage.success('仪表盘已刷新')
    })
  }

  function handleAutoRefreshCommand(command: string | number | boolean | undefined) {
    if (typeof command !== 'string') return
    autoRefreshKey.value = command
    configureAutoRefresh()
  }

  function getAutoRefreshIntervalMs() {
    const durationMs = timeRange.value.end.getTime() - timeRange.value.start.getTime()
    if (durationMs <= 60 * 60 * 1000) return 30_000
    if (durationMs <= 6 * 60 * 60 * 1000) return 60_000
    if (durationMs <= 24 * 60 * 60 * 1000) return 3 * 60_000
    if (durationMs <= 7 * 24 * 60 * 60 * 1000) return 5 * 60_000
    return 15 * 60_000
  }

  function configureAutoRefresh() {
    if (refreshTimer) window.clearInterval(refreshTimer)
    const option = METRICS_AUTO_REFRESH_OPTIONS.find((item) => item.key === autoRefreshKey.value)
    const intervalMs = option?.key === 'auto' ? getAutoRefreshIntervalMs() : option?.intervalMs
    if (intervalMs) {
      refreshTimer = window.setInterval(() => queryCurrentSection(), intervalMs)
    } else {
      refreshTimer = undefined
    }
  }

  watch(
    timeRange,
    () => {
      queryCurrentSection()
      if (autoRefreshKey.value === 'auto') configureAutoRefresh()
    },
    { deep: true }
  )
  onMounted(async () => {
    await loadInitialData()
    configureAutoRefresh()
  })
  onBeforeUnmount(() => {
    if (refreshTimer) window.clearInterval(refreshTimer)
  })
</script>

<style scoped lang="scss">
  .monitor-dashboard {
    min-width: 0;
    color: var(--el-text-color-primary);
    background: var(--el-bg-color-page);
  }

  .monitor-dashboard__topbar {
    display: flex;
    gap: 20px;
    align-items: center;
    justify-content: space-between;
    min-height: 72px;
    padding: 14px 20px;
    background: var(--el-bg-color);
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .monitor-dashboard__identity {
    display: flex;
    gap: 12px;
    align-items: center;
    min-width: 0;
  }

  .monitor-dashboard__mark {
    display: grid;
    flex: 0 0 38px;
    place-items: center;
    width: 38px;
    height: 38px;
    font-size: 21px;
    color: #fff;
    background: #2878d4;
    border-radius: 6px;
  }

  .monitor-dashboard__identity h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 650;
    line-height: 24px;
  }

  .monitor-dashboard__identity p {
    margin: 1px 0 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .monitor-dashboard__summary {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .monitor-dashboard__health-dot {
    width: 8px;
    height: 8px;
    background: var(--el-text-color-placeholder);
    border-radius: 50%;
  }

  .monitor-dashboard__health-dot.healthy {
    background: #2e9b62;
  }

  .monitor-dashboard__health-dot.warning {
    background: #d99a2b;
  }

  .monitor-dashboard__health-dot.loading {
    background: #2878d4;
  }

  .monitor-dashboard__updated {
    margin-left: 8px;
    color: var(--el-text-color-secondary);
  }

  .monitor-dashboard__filters {
    display: grid;
    grid-template-columns: minmax(176px, 1.25fr) repeat(4, minmax(122px, 1fr));
    gap: 10px;
    align-items: flex-end;
    padding: 12px 20px 14px;
    background: var(--el-bg-color);
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .monitor-dashboard__filter-group {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }

  .monitor-dashboard__filter-group.is-source {
    min-width: 0;
  }

  .monitor-dashboard__filter-group label {
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }

  .monitor-dashboard__filter-group :deep(.el-select__wrapper),
  .monitor-dashboard__time-controls :deep(.el-select__wrapper) {
    min-height: 34px;
    border-radius: 4px;
  }

  .monitor-dashboard__datasource-option {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
  }

  .monitor-dashboard__datasource-option small {
    color: var(--el-text-color-placeholder);
  }

  .monitor-dashboard__time-controls {
    display: flex;
    grid-column: 1 / -1;
    gap: 8px;
    align-items: center;
    justify-content: flex-end;
    min-width: 0;
    padding-top: 2px;
    margin-left: auto;
  }

  .monitor-dashboard__time-controls :deep(.metrics-time-range-picker) {
    flex: 0 1 620px;
    min-width: 440px;
  }

  .monitor-dashboard__refresh-control {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: stretch;
  }

  .monitor-dashboard__refresh-action,
  .monitor-dashboard__refresh-interval {
    box-sizing: border-box;
    height: var(--el-component-custom-height, 36px);
    min-height: var(--el-component-custom-height, 36px);
    color: var(--el-text-color-primary);
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color);
    border-radius: 0;
  }

  .monitor-dashboard__refresh-action {
    margin-right: -1px;
    border-radius: 4px 0 0 4px;
  }

  .monitor-dashboard__refresh-action:hover,
  .monitor-dashboard__refresh-action:focus-visible,
  .monitor-dashboard__refresh-interval:hover,
  .monitor-dashboard__refresh-interval:focus-visible {
    position: relative;
    z-index: 1;
    color: var(--el-color-primary);
    border-color: var(--el-color-primary);
  }

  .monitor-dashboard__refresh-interval {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    min-width: 70px;
    padding: 0 9px;
    font-size: 13px;
    line-height: 1;
    cursor: pointer;
    border-radius: 0 4px 4px 0;
  }

  .monitor-dashboard__refresh-interval :deep(.el-icon) {
    font-size: 12px;
  }

  .monitor-dashboard__alert {
    margin: 12px 20px 0;
  }

  .monitor-dashboard__workspace {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    min-height: calc(100vh - 230px);
  }

  .monitor-dashboard__nav {
    padding: 14px 0 24px;
    background: var(--el-bg-color);
    border-right: 1px solid var(--el-border-color-lighter);
  }

  .monitor-dashboard__nav-group + .monitor-dashboard__nav-group {
    margin-top: 8px;
  }

  .monitor-dashboard__nav-heading {
    display: flex;
    gap: 7px;
    align-items: center;
    width: 100%;
    height: 34px;
    padding: 0 14px;
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 0;
  }

  .monitor-dashboard__nav-heading:hover {
    color: var(--el-text-color-primary);
    background: var(--el-fill-color-light);
  }

  .monitor-dashboard__nav-chevron {
    flex: 0 0 auto;
    font-size: 11px;
    transition: transform 0.16s ease;
  }

  .monitor-dashboard__nav-chevron.is-expanded {
    transform: rotate(90deg);
  }

  .monitor-dashboard__nav-heading > :deep(svg) {
    font-size: 16px;
  }

  .monitor-dashboard__nav-items {
    display: block;
  }

  .monitor-dashboard__nav-item {
    position: relative;
    display: block;
    width: 100%;
    height: 36px;
    padding: 0 18px 0 42px;
    overflow: hidden;
    font-size: 13px;
    color: var(--el-text-color-regular);
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
    background: transparent;
    border: 0;
  }

  .monitor-dashboard__nav-item:hover {
    color: var(--el-color-primary);
    background: var(--el-fill-color-light);
  }

  .monitor-dashboard__nav-item.is-active {
    font-weight: 600;
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }

  .monitor-dashboard__nav-item.is-active::before {
    position: absolute;
    inset: 0 auto 0 0;
    width: 3px;
    content: '';
    background: var(--el-color-primary);
  }

  .monitor-dashboard__content {
    min-width: 0;
    padding: 18px 20px 30px;
  }

  .monitor-dashboard__section-title {
    display: flex;
    gap: 20px;
    align-items: flex-start;
    justify-content: space-between;
    min-height: 50px;
    margin-bottom: 12px;
  }

  .monitor-dashboard__section-title span {
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }

  .monitor-dashboard__section-title h2 {
    margin: 3px 0 0;
    font-size: 17px;
    font-weight: 650;
  }

  .monitor-dashboard__legend {
    display: flex;
    gap: 14px;
    align-items: center;
    padding-top: 12px;
  }

  .monitor-dashboard__legend span {
    display: inline-flex;
    gap: 5px;
    align-items: center;
  }

  .monitor-dashboard__legend i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  .monitor-dashboard__legend i.healthy {
    background: #2e9b62;
  }

  .monitor-dashboard__legend i.missing {
    background: #d99a2b;
  }

  .monitor-dashboard__legend i.failed {
    background: #e45757;
  }

  .monitor-dashboard__panel-grid {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 12px;
  }

  @media (width <= 960px) {
    .monitor-dashboard__filters {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .monitor-dashboard__filter-group.is-source {
      grid-column: 1 / -1;
    }

    .monitor-dashboard__workspace {
      display: block;
    }

    .monitor-dashboard__nav {
      display: flex;
      padding: 8px;
      overflow-x: auto;
      border-right: 0;
      border-bottom: 1px solid var(--el-border-color-lighter);
    }

    .monitor-dashboard__nav-group {
      display: flex;
      flex: 0 0 auto;
      align-items: center;
    }

    .monitor-dashboard__nav-group + .monitor-dashboard__nav-group {
      margin: 0 0 0 8px;
    }

    .monitor-dashboard__nav-heading {
      width: auto;
      min-width: max-content;
      padding: 0 10px;
    }

    .monitor-dashboard__nav-items {
      display: flex;
    }

    .monitor-dashboard__nav-item {
      width: auto;
      min-width: max-content;
      height: 34px;
      padding: 0 12px;
      border-radius: 3px;
    }

    .monitor-dashboard__nav-item.is-active::before {
      display: none;
    }
  }

  @media (width <= 640px) {
    .monitor-dashboard__topbar {
      align-items: flex-start;
      padding: 12px;
    }

    .monitor-dashboard__summary {
      flex-direction: column;
      gap: 3px;
      align-items: flex-end;
    }

    .monitor-dashboard__health-dot {
      display: none;
    }

    .monitor-dashboard__updated {
      margin-left: 0;
    }

    .monitor-dashboard__filters {
      padding: 12px;
    }

    .monitor-dashboard__filter-group {
      min-width: 0;
    }

    .monitor-dashboard__filter-group.is-source {
      min-width: 0;
    }

    .monitor-dashboard__time-controls {
      flex-wrap: wrap;
      width: 100%;
      min-width: 0;
    }

    .monitor-dashboard__time-controls :deep(.metrics-time-range-picker) {
      flex: 1 1 100%;
      width: 100%;
      min-width: 0;
      max-width: none;
    }

    .monitor-dashboard__refresh-control {
      margin-left: auto;
    }

    .monitor-dashboard__content {
      padding: 14px 12px 24px;
    }

    .monitor-dashboard__section-title {
      flex-direction: column;
      gap: 4px;
      align-items: flex-start;
    }

    .monitor-dashboard__legend {
      flex-wrap: wrap;
      padding-top: 4px;
    }
  }
</style>

<style lang="scss">
  .monitor-dashboard__refresh-menu.el-popper {
    min-width: 104px;
    padding: 5px 0;
  }

  .monitor-dashboard__refresh-menu .el-dropdown-menu__item {
    justify-content: space-between;
    padding: 0 14px;
  }

  .monitor-dashboard__refresh-menu .el-dropdown-menu__item.is-active {
    color: var(--el-color-primary);
    background: var(--el-fill-color-light);
  }
</style>

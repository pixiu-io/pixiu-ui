<template>
  <div
    class="prometheus-dashboard art-full-height"
    :style="{ '--prom-nav-color': menuTheme.textColor }"
  >
    <PrometheusOnboarding
      v-if="!datasources.length && !datasourceLoading"
      action-text="创建 Prometheus 实例"
      @associate="goAddDatasource"
    />

    <template v-else-if="datasources.length > 0">
      <ElAlert
        v-if="alertVisible"
        type="info"
        closable
        show-icon
        class="quota-alert"
        description="查看 Prometheus 监控大盘，支持内部与外部数据源；请先选择数据源，再按预设分组浏览集群、节点与工作负载等监控面板。"
        @close="alertVisible = false"
      />

      <section class="md-top-card">
        <div class="md-rule-bar">
          <div class="md-rule-main">
            <div class="md-rule-left">
              <span class="md-rule-label">Prometheus 实例</span>
              <span class="md-datasource-wrap">
                <ElSelect
                  v-model="selectedDatasourceId"
                  class="md-rule-select md-ds-select"
                  placeholder="请选择 Prometheus 实例"
                  :loading="datasourceLoading"
                  clearable
                  filterable
                  @change="handleDatasourceChange"
                >
                  <template #label="{ value }">
                    <span v-if="value && getDatasourceById(Number(value))" class="md-ds-option">
                      <span class="md-ds-logo is-prometheus">
                        <ArtSvgIcon icon="simple-icons:prometheus" class="md-ds-logo-icon" />
                      </span>
                      <span class="md-ds-option-name">
                        {{ getDatasourceById(Number(value))?.name }}
                      </span>
                    </span>
                  </template>
                  <ElOption v-for="ds in datasources" :key="ds.id" :label="ds.name" :value="ds.id">
                    <span class="md-ds-option">
                      <span class="md-ds-logo is-prometheus">
                        <ArtSvgIcon icon="simple-icons:prometheus" class="md-ds-logo-icon" />
                      </span>
                      <span class="md-ds-option-name">{{ ds.name }}</span>
                    </span>
                  </ElOption>
                </ElSelect>
                <ElTag
                  v-if="selectedDatasource && !selectedDatasource.external"
                  class="md-ds-cluster-tag"
                  size="small"
                  effect="light"
                >
                  {{ selectedDatasource.clusterName || '-' }}
                </ElTag>
              </span>
              <span class="prometheus-dashboard__sep" aria-hidden="true" />
              <span class="prometheus-dashboard__summary">
                <span>状态:</span>
                <span class="prometheus-dashboard__health-dot" :class="pageHealth" />
                <span>{{ pageHealthLabel }}</span>
              </span>
              <span class="prometheus-dashboard__sep" aria-hidden="true" />
              <span class="prometheus-dashboard__updated">更新时间: {{ lastUpdatedLabel }}</span>
            </div>
            <div class="md-rule-right">
              <MetricsMonitorToolbar
                v-model:timeRange="timeRange"
                v-model:granularity="granularity"
                v-model:autoRefresh="autoRefresh"
                :show-granularity="false"
                :show-legend="false"
                class="prometheus-dashboard__toolbar"
              />
            </div>
          </div>
        </div>
      </section>

      <ElAlert
        v-if="pageError"
        class="prometheus-dashboard__alert"
        type="error"
        :title="pageError"
        show-icon
        closable
        @close="pageError = ''"
      />

      <div v-if="!selectedDatasourceId" class="prometheus-dashboard__empty">
        <ElEmpty description="请选择 Prometheus 实例" :image-size="96" />
      </div>

      <div v-else class="prometheus-dashboard__monitor-card">
        <div class="prometheus-dashboard__monitor-tabs">
          <button type="button" class="prometheus-dashboard__monitor-tab is-active"
            >监控详情</button
          >
        </div>

        <div class="prometheus-dashboard__workspace">
          <aside class="prometheus-dashboard__nav" aria-label="监控大盘分组">
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
            <PrometheusDashboardBody
              :definition="definition"
              :result-map="resultMap"
              :active-section="activeSection"
              :query-loading="queryLoading"
              :query-refreshing="queryRefreshing"
              :show-legend="showLegend"
              :cluster-name="linkedClusterName"
              :datasource="selectedDatasource ?? null"
              :show-events-link="Boolean(linkedClusterName)"
              :pod-filters="filters"
              :pod-filter-options="podFilterOptions"
              :pod-filter-options-loading="podFilterOptionsLoading"
              v-model:time-range="timeRange"
              v-model:granularity="granularity"
              v-model:auto-refresh="autoRefresh"
              @time-range-select="handleChartTimeRangeSelect"
              @item-click="handlePanelItemClick"
              @events-click="goClusterEvents"
              @pod-filters-change="handlePodFiltersChange"
            />
          </main>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { CaretRight } from '@element-plus/icons-vue'
  import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { useSettingStore } from '@/store/modules/setting'
  import MetricsMonitorToolbar from '@/components/container/metrics-monitor-toolbar.vue'
  import PrometheusOnboarding from '@/components/monitor/prometheus-onboarding.vue'
  import {
    fetchDashboardDefinition,
    fetchDashboardQuery,
    fetchDashboardVariables,
    type DashboardDefinition,
    type DashboardFilters,
    type DashboardPanelResult,
    type DashboardWorkloadOption
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
  import {
    COREDNS_EMBED_PANEL_IDS,
    DASHBOARD_SECTION_CHILD_NAMES,
    resolveClusterDetailPanelIds
  } from '@/utils/metrics/dashboard-catalog'
  import PrometheusDashboardBody from '@/views/container/cluster-detail/prometheus/PrometheusDashboardBody.vue'

  defineOptions({ name: 'MonitorDashboard' })

  const router = useRouter()
  const settingStore = useSettingStore()
  const menuTheme = computed(() => settingStore.getMenuTheme)
  const alertVisible = ref(true)

  const definition = ref<DashboardDefinition>({ sections: [], panels: [] })
  const datasources = ref<DatasourceItem[]>([])
  const selectedDatasourceId = ref<number>()
  const filters = reactive<DashboardFilters>({})
  const activeSection = ref('cluster')
  const expandedNavGroups = ref<string[]>([])
  const resultMap = reactive<Record<string, DashboardPanelResult>>({})
  const datasourceLoading = ref(false)
  const queryLoading = ref(false)
  const queryRefreshing = ref(false)
  const pageError = ref('')
  const lastUpdated = ref<Date>()
  const timeRange = ref<MetricsTimeRange>(getDefaultMetricsTimeRange())
  const granularity = ref<MetricsGranularityOption>(getDefaultMetricsGranularity())
  const autoRefresh = ref<MetricsAutoRefreshOption>(getDefaultMetricsAutoRefresh())
  const showLegend = ref(true)
  const podFilterOptions = reactive<{
    namespaces: string[]
    nodes: string[]
    workloads: DashboardWorkloadOption[]
    pods: string[]
  }>({
    namespaces: [],
    nodes: [],
    workloads: [],
    pods: []
  })
  const podFilterOptionsLoading = ref(false)
  let refreshTimer: number | undefined
  let querySequence = 0

  const sectionNames = DASHBOARD_SECTION_CHILD_NAMES

  const selectedDatasource = computed(() =>
    datasources.value.find((item) => item.id === selectedDatasourceId.value)
  )
  /** 内部数据源关联的集群名，用于事件跳转与概览探测 */
  const linkedClusterName = computed(
    () => selectedDatasource.value?.clusterName?.trim() || ''
  )

  function getDatasourceById(id: number): DatasourceItem | undefined {
    return datasources.value.find((item) => item.id === id)
  }

  function goAddDatasource() {
    router.push({ name: 'MonitorDatasource' })
  }

  function goClusterEvents() {
    if (!linkedClusterName.value) return
    router.push({ path: '/container/events', query: { cluster: linkedClusterName.value } })
  }

  const NAMESPACE_PANEL_IDS = new Set([
    'namespace.pods',
    'namespace.cpu',
    'namespace.memory',
    'namespace.restarts'
  ])

  const POD_TOP_PANEL_IDS = new Set([
    'node.embed.pod_cpu',
    'node.embed.pod_memory',
    'pod.embed.restarts',
    'node.embed.pod_net_tx',
    'node.embed.pod_net_rx'
  ])

  function parseNamespacePod(name: string): { namespace: string; pod: string } | null {
    const trimmed = name.trim()
    const slash = trimmed.indexOf('/')
    if (slash <= 0 || slash >= trimmed.length - 1) return null
    return {
      namespace: trimmed.slice(0, slash),
      pod: trimmed.slice(slash + 1)
    }
  }

  function handlePanelItemClick(payload: { panelId: string; name: string }) {
    if (!linkedClusterName.value) return

    if (POD_TOP_PANEL_IDS.has(payload.panelId)) {
      const parsed = parseNamespacePod(payload.name ?? '')
      if (!parsed) return
      router.push({
        path: '/container/pod-detail',
        query: {
          cluster: linkedClusterName.value,
          namespace: parsed.namespace,
          pod: parsed.pod
        }
      })
      return
    }

    if (!NAMESPACE_PANEL_IDS.has(payload.panelId)) return
    const namespace = payload.name.includes('/')
      ? payload.name.split('/')[0]
      : payload.name
    if (!namespace) return
    router.push({
      path: '/container/namespace',
      query: { cluster: linkedClusterName.value, namespace }
    })
  }

  async function loadPodFilterOptions() {
    const datasource = selectedDatasource.value
    if (!datasource) return
    podFilterOptionsLoading.value = true
    try {
      const variables = await fetchDashboardVariables(datasource, {
        namespace: filters.namespace,
        node: filters.node,
        workload_kind: filters.workload_kind,
        workload_name: filters.workload_name
      })
      podFilterOptions.namespaces = variables.namespaces
      podFilterOptions.nodes = variables.nodes
      podFilterOptions.workloads = variables.workloads
      podFilterOptions.pods = variables.pods
    } catch {
      // ignore
    } finally {
      podFilterOptionsLoading.value = false
    }
  }

  function clearPodFilters() {
    filters.namespace = undefined
    filters.node = undefined
    filters.workload_kind = undefined
    filters.workload_name = undefined
    filters.pod = undefined
  }

  function handlePodFiltersChange(next: DashboardFilters) {
    const changed =
      (filters.namespace ?? '') !== (next.namespace ?? '') ||
      (filters.node ?? '') !== (next.node ?? '') ||
      (filters.workload_kind ?? '') !== (next.workload_kind ?? '') ||
      (filters.workload_name ?? '') !== (next.workload_name ?? '') ||
      (filters.pod ?? '') !== (next.pod ?? '')
    if (!changed) return

    filters.namespace = next.namespace
    filters.node = next.node
    filters.workload_kind = next.workload_kind
    filters.workload_name = next.workload_name
    filters.pod = next.pod

    // Grafana 式：保留旧图，按新筛选静默重查
    void loadPodFilterOptions()
    void queryCurrentSection({ silent: hasActiveSectionData.value })
  }

  const currentPanels = computed(() =>
    definition.value.panels.filter((panel) => panel.section === activeSection.value)
  )
  const activePanelIds = computed(() =>
    resolveClusterDetailPanelIds(
      activeSection.value,
      currentPanels.value.map((panel) => panel.id),
      COREDNS_EMBED_PANEL_IDS
    )
  )
  const resultValues = computed(() =>
    activePanelIds.value.map((id) => resultMap[id]).filter(Boolean)
  )
  const hasActiveSectionData = computed(() =>
    activePanelIds.value.some((id) => Boolean(resultMap[id]))
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
    return '正常'
  })
  const lastUpdatedLabel = computed(() =>
    lastUpdated.value
      ? lastUpdated.value.toLocaleTimeString('zh-CN', { hour12: false })
      : '--:--:--'
  )

  function preferDatasourceId(list: DatasourceItem[]) {
    return list.find((item) => item.isDefault)?.id ?? list[0]?.id
  }

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
        (item) => item.type === 1 && item.subType === 'prometheus'
      )
      selectedDatasourceId.value = preferDatasourceId(datasources.value)
      if (selectedDatasourceId.value) {
        await queryCurrentSection()
      }
    } catch (error) {
      pageError.value = error instanceof Error ? error.message : '监控大盘加载失败'
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

  async function queryCurrentSection(options?: { silent?: boolean }) {
    const datasource = selectedDatasource.value
    if (!datasource || !activePanelIds.value.length) return
    // 集群概览由 ClusterMonitorOverview 自行拉数，避免重复查询
    if (activeSection.value === 'cluster') {
      queryLoading.value = false
      queryRefreshing.value = false
      lastUpdated.value = new Date()
      return
    }
    const silent = Boolean(options?.silent)
    const sequence = ++querySequence
    if (silent) queryRefreshing.value = true
    else queryLoading.value = true
    if (!silent) pageError.value = ''
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
        panelIds: activePanelIds.value,
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
      if (!silent) pageError.value = error instanceof Error ? error.message : '面板查询失败'
    } finally {
      if (sequence === querySequence) {
        queryLoading.value = false
        queryRefreshing.value = false
      }
    }
  }

  async function handleDatasourceChange() {
    Object.keys(resultMap).forEach((key) => delete resultMap[key])
    clearPodFilters()
    podFilterOptions.namespaces = []
    podFilterOptions.nodes = []
    podFilterOptions.workloads = []
    podFilterOptions.pods = []
    if (!selectedDatasourceId.value) return
    if (activeSection.value === 'node-pod') void loadPodFilterOptions()
    await queryCurrentSection()
  }

  function selectSection(section: string) {
    const resolved = section === 'pod' ? 'node-pod' : section
    if (resolved === activeSection.value) return
    if (activeSection.value === 'node-pod' && resolved !== 'node-pod') {
      clearPodFilters()
    }
    activeSection.value = resolved
    if (resolved === 'node-pod') void loadPodFilterOptions()
    const hasCache = resolveClusterDetailPanelIds(
      resolved,
      definition.value.panels.filter((panel) => panel.section === resolved).map((panel) => panel.id),
      COREDNS_EMBED_PANEL_IDS
    ).some((id) => Boolean(resultMap[id]))
    void queryCurrentSection({ silent: hasCache })
  }

  function isNavGroupExpanded(sectionId: string) {
    return expandedNavGroups.value.includes(sectionId)
  }

  function toggleNavGroup(sectionId: string) {
    expandedNavGroups.value = isNavGroupExpanded(sectionId)
      ? expandedNavGroups.value.filter((item) => item !== sectionId)
      : [...expandedNavGroups.value, sectionId]
  }

  watch(
    () =>
      [
        timeRange.value.start.getTime(),
        timeRange.value.end.getTime(),
        granularity.value.key
      ] as const,
    () => {
      void queryCurrentSection({ silent: hasActiveSectionData.value })
    }
  )
  watch(
    () => autoRefresh.value.intervalMs,
    (intervalMs) => {
      if (refreshTimer) window.clearInterval(refreshTimer)
      refreshTimer = undefined
      if (intervalMs && intervalMs > 0) {
        refreshTimer = window.setInterval(
          () => void queryCurrentSection({ silent: true }),
          intervalMs
        )
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
    gap: 12px;
    min-width: 0;
    height: 100%;
    color: var(--el-text-color-primary);
  }

  .quota-alert {
    flex-shrink: 0;
    margin: 5px 0 8px;
  }

  .md-top-card {
    flex-shrink: 0;
    padding: 12px 16px;
    background: var(--el-fill-color-blank);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .md-rule-bar {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .md-rule-main {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    align-items: center;
    justify-content: space-between;
  }

  .md-rule-left {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }

  .md-rule-right {
    display: flex;
    flex-shrink: 0;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: flex-end;
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .md-rule-label {
    flex-shrink: 0;
    font-size: 13px;
    color: var(--el-text-color-regular);
    white-space: nowrap;
  }

  .md-rule-select {
    min-width: 120px;
  }

  .md-ds-select {
    width: 220px;
    max-width: 100%;
  }

  .md-datasource-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .md-ds-option {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    min-width: 0;
  }

  .md-ds-option-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .md-ds-logo {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-light);
    border-radius: 4px;
  }

  .md-ds-logo.is-prometheus {
    color: #f97316;
    background: #fff7ed;
  }

  .md-ds-logo-icon {
    width: 14px;
    height: 14px;
  }

  .md-ds-cluster-tag {
    position: absolute;
    top: -8px;
    right: 28px;
    z-index: 1;
  }

  .md-rule-updated {
    color: var(--el-text-color-regular);
  }

  .prometheus-dashboard__sep {
    flex-shrink: 0;
    width: 1px;
    height: 12px;
    background: var(--el-border-color);
    opacity: 0.8;
  }

  .prometheus-dashboard__summary {
    display: flex;
    flex: 0 0 auto;
    gap: 6px;
    align-items: center;
    font-size: 12px;
    line-height: 1;
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
    flex: 0 0 auto;
    font-size: 12px;
    line-height: 1;
    color: var(--el-text-color-regular);
  }

  .prometheus-dashboard__toolbar {
    margin: 0;
  }

  .prometheus-dashboard__toolbar :deep(.metrics-monitor-toolbar) {
    margin-bottom: 0;
  }

  .prometheus-dashboard__toolbar :deep(.metrics-monitor-toolbar__bar) {
    gap: 8px;
    justify-content: flex-end;
    min-height: 32px;
    padding: 0;
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
    margin-top: 0;
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
    overflow: hidden;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
  }

  .prometheus-dashboard__monitor-tabs {
    display: flex;
    flex-shrink: 0;
    gap: 20px;
    align-items: flex-end;
    padding: 12px 16px 0 12px;
    background: var(--el-fill-color-blank);
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .prometheus-dashboard__monitor-tab {
    position: relative;
    padding: 0 0 10px;
    font-size: 13px;
    color: var(--el-text-color-regular);
    cursor: pointer;
    background: transparent;
    border: none;
  }

  .prometheus-dashboard__monitor-tab.is-active {
    font-weight: 500;
    color: var(--el-color-primary);

    &::after {
      position: absolute;
      right: 0;
      bottom: -1px;
      left: 0;
      height: 2px;
      content: '';
      background: var(--el-color-primary);
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

    .prometheus-dashboard__content {
      padding: 12px 0 4px;
    }
  }
</style>

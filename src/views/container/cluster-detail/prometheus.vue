<template>
  <div class="prometheus-dashboard" :style="{ '--prom-nav-color': menuTheme.textColor }">
    <template v-if="datasources.length > 0">
      <div class="prometheus-dashboard__source-bar">
        <div class="prometheus-dashboard__source-status">
          <label>Prometheus 实例:</label>
          <span class="prometheus-dashboard__source-value">{{
            selectedDatasource?.name || '—'
          }}</span>
          <span class="prometheus-dashboard__sep" aria-hidden="true" />
          <span class="prometheus-dashboard__summary">
            <span>状态:</span>
            <span class="prometheus-dashboard__health-dot" :class="pageHealth" />
            <span>{{ pageHealthLabel }}</span>
          </span>
          <span class="prometheus-dashboard__sep" aria-hidden="true" />
          <span class="prometheus-dashboard__updated">更新时间: {{ lastUpdatedLabel }}</span>
        </div>
        <MetricsMonitorToolbar
          v-model:timeRange="timeRange"
          v-model:granularity="granularity"
          v-model:autoRefresh="autoRefresh"
          :show-granularity="false"
          :show-legend="false"
          class="prometheus-dashboard__toolbar"
        />
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
            v-for="section in navSections"
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
            :cluster-name="clusterName"
            :datasource="selectedDatasource ?? null"
            :pod-filters="filters"
            :pod-filter-options="podFilterOptions"
            :pod-filter-options-loading="podFilterOptionsLoading"
            v-model:time-range="timeRange"
            v-model:granularity="granularity"
            v-model:auto-refresh="autoRefresh"
            @time-range-select="handleChartTimeRangeSelect"
            @item-click="handlePanelItemClick"
            @events-click="goNamespacePage('events')"
            @pod-filters-change="handlePodFiltersChange"
          />
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
  import { computed, inject, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
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
  import AssociatePrometheusDialog from './associate-prometheus-dialog.vue'
  import { clusterDetailNamespaceKey } from './context'
  import { buildClusterRouteQuery } from '@/utils/navigation/cluster-query'

  defineOptions({ name: 'ClusterDetailPrometheus' })

  const route = useRoute()
  const router = useRouter()
  const settingStore = useSettingStore()
  const menuTheme = computed(() => settingStore.getMenuTheme)
  const namespaceContext = inject(clusterDetailNamespaceKey)

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
  /** 静默刷新中（Grafana 式：保留旧图，仅角标提示） */
  const queryRefreshing = ref(false)
  const pageError = ref('')
  const associateVisible = ref(false)
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
  const currentPanels = computed(() =>
    definition.value.panels.filter((panel) => panel.section === activeSection.value)
  )
  const navSections = computed(() => definition.value.sections)
  const activePanelIds = computed(() =>
    resolveClusterDetailPanelIds(
      activeSection.value,
      currentPanels.value.map((panel) => panel.id),
      COREDNS_EMBED_PANEL_IDS
    )
  )
  const resultValues = computed(() =>
    currentPanels.value.map((panel) => resultMap[panel.id]).filter(Boolean)
  )
  const hasActiveSectionData = computed(() =>
    activePanelIds.value.some((id) => Boolean(resultMap[id]))
  )
  const pageHealth = computed(() => {
    if (!selectedDatasourceId.value) return 'idle'
    // 静默刷新不切换顶栏「查询中」，避免整页像被刷新
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

  /** Namespace 大盘的 4 张 bar 面板：点击某根 bar 跳转到对应 Namespace 的 Pod 列表 */
  const NAMESPACE_PANEL_IDS = new Set([
    'namespace.pods',
    'namespace.cpu',
    'namespace.memory',
    'namespace.restarts'
  ])

  /** Pod 监控 Top 条：点击跳转 Pod 详情 */
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
    if (POD_TOP_PANEL_IDS.has(payload.panelId)) {
      const parsed = parseNamespacePod(payload.name ?? '')
      if (!parsed) return
      if (namespaceContext) namespaceContext.namespace.value = parsed.namespace
      router.push({
        path: '/container/pod-detail',
        query: buildClusterRouteQuery(route, {
          namespace: parsed.namespace,
          pod: parsed.pod
        })
      })
      return
    }

    if (!NAMESPACE_PANEL_IDS.has(payload.panelId)) return
    const namespace = payload.name?.trim()
    if (!namespace) return
    // 同步集群详情顶栏当前命名空间（注入的 ref 与 layout 共享），再跳转到 Pod 列表
    if (namespaceContext) namespaceContext.namespace.value = namespace
    router.push({
      path: '/container/pods',
      query: buildClusterRouteQuery(route, { namespace })
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
      // 筛选下拉失败不阻断主查询
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

    for (const id of activePanelIds.value) delete resultMap[id]
    void loadPodFilterOptions()
    void queryCurrentSection()
  }

  /** namespace 大盘右上角入口：跳转到集群详情对应页面（保留当前集群） */
  function goNamespacePage(page: string) {
    router.push({ path: `/container/${page}`, query: buildClusterRouteQuery(route, {}) })
  }

  async function queryCurrentSection(options?: { silent?: boolean }) {
    const datasource = selectedDatasource.value
    if (!datasource || !activePanelIds.value.length) return
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

  function selectSection(section: string) {
    const resolved = section === 'pod' ? 'node-pod' : section
    if (resolved === activeSection.value) return
    if (activeSection.value === 'node-pod' && resolved !== 'node-pod') {
      clearPodFilters()
    }
    activeSection.value = resolved
    if (resolved === 'node-pod') void loadPodFilterOptions()
    // 若该分区已有缓存结果则静默刷新，避免切页闪白
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
    min-width: 0;
    height: 100%;
    margin-top: -2px;
    color: var(--el-text-color-primary);
  }

  .prometheus-dashboard__source-bar {
    display: flex;
    flex-wrap: nowrap;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    height: 40px;
    padding: 0;
    margin: 0;
    overflow: visible;
  }

  .prometheus-dashboard__source-bar label {
    flex: 0 0 auto;
    margin: 0;
    font-size: 12px;
    line-height: 1;
    color: var(--el-text-color-regular);
  }

  .prometheus-dashboard__source-value {
    flex: 0 0 auto;
    font-size: 12px;
    line-height: 1;
    color: var(--el-text-color-regular);
  }

  .prometheus-dashboard__source-status {
    display: flex;
    flex: 1 1 auto;
    gap: 10px;
    align-items: center;
    height: 32px;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }

  .prometheus-dashboard__sep {
    flex-shrink: 0;
    width: 1px;
    height: 12px;
    background: var(--el-border-color);
    opacity: 0.8;
  }

  .prometheus-dashboard__source-bar .prometheus-dashboard__summary {
    flex: 0 0 auto;
    line-height: 1;
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

  .prometheus-dashboard__refresh {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    padding: 0;
    margin-left: 4px;
    border-radius: 2px;
  }

  /* class 直接挂在 MetricsMonitorToolbar 根节点上，需覆盖其默认 margin-bottom: 18px */
  .prometheus-dashboard__toolbar {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    align-self: center;
    height: 32px;
    min-width: 0;
    margin: 0 !important;
    overflow: visible;
  }

  .prometheus-dashboard__toolbar :deep(.metrics-monitor-toolbar__bar) {
    display: flex;
    flex-wrap: nowrap;
    gap: 8px;
    align-items: center;
    justify-content: flex-end;
    height: 32px;
    padding: 0;
    margin: 0;
    overflow: visible;
    background: transparent;
    border: none;
    border-radius: 0;
  }

  .prometheus-dashboard__toolbar :deep(.metrics-monitor-toolbar__time) {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    height: 32px;
  }

  .prometheus-dashboard__toolbar :deep(.metrics-monitor-toolbar__divider) {
    align-self: center;
    height: 16px;
    margin: 0 2px;
    background: var(--el-border-color-light);
    opacity: 1;
  }

  .prometheus-dashboard__toolbar :deep(.metrics-time-range-picker) {
    display: flex;
    align-items: center;
    width: 240px;
    min-width: 240px;
    max-width: 240px;
    height: 32px;
    transition: width 0.2s ease;
  }

  .prometheus-dashboard__toolbar :deep(.metrics-time-range-picker.is-custom-range) {
    width: 340px;
    min-width: 340px;
    max-width: 340px;
  }

  .prometheus-dashboard__toolbar :deep(.metrics-time-range-picker__trigger) {
    box-sizing: border-box;
    height: 32px;
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
    box-sizing: border-box;
    height: 32px;
    min-height: 32px;
    padding: 0 10px;
    background: var(--el-bg-color);
    border-radius: 2px;
    box-shadow: 0 0 0 1px var(--el-border-color) inset;
  }

  .prometheus-dashboard__toolbar :deep(.metrics-monitor-toolbar__group) {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    height: 32px;
  }

  .prometheus-dashboard__toolbar :deep(.metrics-monitor-toolbar__group-label) {
    display: inline-flex;
    gap: 0;
    align-items: center;
    height: 32px;
    font-size: 12px;
    line-height: 1;
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
    margin-top: 8px;
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
    font-size: 13px;
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
    font-size: 13px;
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

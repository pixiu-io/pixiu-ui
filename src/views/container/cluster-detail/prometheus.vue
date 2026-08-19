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
          <ClusterMonitorOverview
            v-if="activeSection === 'cluster'"
            :cluster-name="clusterName"
            :toolbar="false"
            :external-time-range="timeRange"
            :external-granularity="granularity"
            :external-auto-refresh="autoRefresh"
            @update:external-time-range="timeRange = $event"
            @update:external-granularity="granularity = $event"
            @update:external-auto-refresh="autoRefresh = $event"
          />
          <template v-else>
            <template v-if="activeSection === 'namespace'">
              <div class="prometheus-dashboard__overview-actions">
                <ElLink
                  type="primary"
                  :underline="false"
                  class="prometheus-dashboard__overview-actions__link"
                  @click="goNamespacePage('events')"
                >
                  <ElIcon :size="14"><Bell /></ElIcon>
                  <span>事件与告警</span>
                </ElLink>
              </div>

              <div class="prometheus-dashboard__summary-grid">
                <div
                  v-for="card in namespaceSummaryCards"
                  :key="card.key"
                  class="prometheus-dashboard__summary-card"
                >
                  <div class="prometheus-dashboard__summary-card__head">
                    <span class="prometheus-dashboard__summary-card__title">{{ card.title }}</span>
                    <span
                      class="prometheus-dashboard__summary-card__icon"
                      :style="{ color: card.iconColor, background: card.iconBg }"
                    >
                      <ElIcon :size="16"><component :is="card.icon" /></ElIcon>
                    </span>
                  </div>
                  <div class="prometheus-dashboard__summary-card__value">
                    {{ card.value }}
                    <span v-if="card.unit" class="prometheus-dashboard__summary-card__unit">{{
                      card.unit
                    }}</span>
                  </div>
                  <div class="prometheus-dashboard__summary-card__sub">{{ card.sub }}</div>
                </div>
              </div>

              <div class="prometheus-dashboard__section-title prometheus-dashboard__section-title--spaced">
                变化趋势
              </div>

              <!-- 趋势图：CPU / 内存变化趋势（趋势在上，Top10 在下） -->
              <div class="prometheus-dashboard__panel-grid prometheus-dashboard__panel-grid--trend">
                <DashboardPanel
                  v-for="panel in namespaceTrendPanels"
                  :key="panel.id"
                  :panel="panel"
                  :result="resultMap[panel.id]"
                  :loading="queryLoading"
                  :show-legend="showLegend"
                  @time-range-select="handleChartTimeRangeSelect"
                  @item-click="handlePanelItemClick"
                />
              </div>

              <div class="prometheus-dashboard__section-title prometheus-dashboard__section-title--spaced">
                Top10 排序
              </div>

              <div class="prometheus-dashboard__panel-grid prometheus-dashboard__panel-grid--top">
                <DashboardPanel
                  v-for="panel in namespaceTopPanels"
                  :key="panel.id"
                  :panel="panel"
                  :result="resultMap[panel.id]"
                  :loading="queryLoading"
                  :show-legend="showLegend"
                  @time-range-select="handleChartTimeRangeSelect"
                  @item-click="handlePanelItemClick"
                />
              </div>

              <div class="prometheus-dashboard__section-title prometheus-dashboard__section-title--spaced">
                重点风险
              </div>

              <div class="prometheus-dashboard__risk-block">
                <div class="prometheus-dashboard__risk-card">
                  <div class="prometheus-dashboard__risk-card__head">
                    <div>
                      <div class="prometheus-dashboard__risk-card__sub">按资源与重启综合排序</div>
                    </div>
                    <ElTag size="small" type="warning" effect="plain">需关注</ElTag>
                  </div>

                  <div class="prometheus-dashboard__risk-kpis">
                    <div class="prometheus-dashboard__risk-kpi">
                      <span class="prometheus-dashboard__risk-kpi-label">高风险 Namespace</span>
                      <strong>{{ namespaceRiskRows.length }}</strong>
                    </div>
                    <div class="prometheus-dashboard__risk-kpi">
                      <span class="prometheus-dashboard__risk-kpi-label">重启异常</span>
                      <strong>{{ restartRiskCount }}</strong>
                    </div>
                  </div>

                  <div class="prometheus-dashboard__risk-actions">
                    <div
                      v-for="hint in namespaceActionHints"
                      :key="hint"
                      class="prometheus-dashboard__risk-action"
                    >
                      {{ hint }}
                    </div>
                  </div>

                  <div
                    v-for="row in namespaceRiskRows"
                    :key="row.name"
                    class="prometheus-dashboard__risk-row"
                  >
                    <div class="prometheus-dashboard__risk-row__main">
                      <span class="prometheus-dashboard__risk-row__name">{{ row.name }}</span>
                      <span class="prometheus-dashboard__risk-row__reason">{{ row.reason }}</span>
                    </div>
                    <div class="prometheus-dashboard__risk-row__meta">
                      <span class="prometheus-dashboard__risk-row__score">{{ row.score }}</span>
                      <ElTag
                        size="small"
                        :type="row.tone"
                        effect="light"
                        class="prometheus-dashboard__risk-row__tag"
                      >
                        {{ row.tag }}
                      </ElTag>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <div v-else class="prometheus-dashboard__panel-grid">
              <DashboardPanel
                v-for="panel in currentPanels"
                :key="panel.id"
                :panel="panel"
                :result="resultMap[panel.id]"
                :loading="queryLoading"
                :show-legend="showLegend"
                @time-range-select="handleChartTimeRangeSelect"
                @item-click="handlePanelItemClick"
              />
            </div>
          </template>
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
  import { Bell, CaretRight, Coin, Cpu, Folder } from '@element-plus/icons-vue'
  import type { Component } from 'vue'
  import { computed, inject, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useSettingStore } from '@/store/modules/setting'
  import MetricsMonitorToolbar from '@/components/container/metrics-monitor-toolbar.vue'
  import PrometheusOnboarding from '@/components/monitor/prometheus-onboarding.vue'
  import {
    fetchDashboardDefinition,
    fetchDashboardQuery,
    type DashboardDefinition,
    type DashboardFilters,
    type DashboardPanelDefinition,
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
  import ClusterMonitorOverview from '@/views/container/cluster/modules/cluster-monitor-overview.vue'
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
    coredns: 'CoreDNS',
    apiserver: 'API Server',
    'controller-manager': 'Controller Manager',
    scheduler: 'Scheduler',
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
    return '正常'
  })
  const lastUpdatedLabel = computed(() =>
    lastUpdated.value
      ? lastUpdated.value.toLocaleTimeString('zh-CN', { hour12: false })
      : '--:--:--'
  )

  // ---- Namespace 大盘顶部摘要卡（从现有 resultMap 推导，不新增后端查询） ----
  type NamespaceSummaryCard = {
    key: string
    title: string
    icon: Component
    iconColor: string
    iconBg: string
    value: string
    unit?: string
    sub: string
  }

  type NamespaceRiskRow = {
    name: string
    score: string
    tone: 'danger' | 'warning' | 'success' | 'info'
    tag: string
    reason: string
  }

  const namespaceSummaryCards = computed<NamespaceSummaryCard[]>(() => {
    const podsResult = resultMap['namespace.pods']
    const cpuResult = resultMap['namespace.cpu']
    const memoryResult = resultMap['namespace.memory']
    const restartResult = resultMap['namespace.restarts']
    const cpuRequestRatioResult = resultMap['namespace.cpu_request_ratio']
    const memoryRequestRatioResult = resultMap['namespace.memory_request_ratio']

    const namespaceCount = podsResult?.status === 'success' ? podsResult.series.length : null
    const cpuRequestRatio = Number(cpuRequestRatioResult?.series?.[0]?.values?.at(-1)?.value)
    const memoryRequestRatio = Number(memoryRequestRatioResult?.series?.[0]?.values?.at(-1)?.value)
    const activeNamespaceCount =
      podsResult?.status === 'success'
        ? podsResult.series.filter((item) => Number(item.values.at(-1)?.value ?? 0) > 0).length
        : null
    const abnormalNamespaces = new Set<string>()
    for (const result of [cpuResult, memoryResult, restartResult]) {
      if (result?.status !== 'success') continue
      for (const series of result.series) {
        const name = series.metric.namespace?.trim()
        const value = Number(series.values.at(-1)?.value ?? 0)
        if (name && value > 0) abnormalNamespaces.add(name)
      }
    }

    const format = (value: number | null, digits: number): string =>
      value === null ? '-' : value.toFixed(digits)
    const statValue = (result: DashboardPanelResult | undefined, digits: number): string => {
      const value = Number(result?.series?.[0]?.values?.at(-1)?.value)
      return Number.isFinite(value) ? value.toFixed(digits) : '-'
    }

    return [
      {
        key: 'namespaces',
        title: 'Namespace 总数',
        icon: Folder,
        iconColor: '#7c6af0',
        iconBg: 'rgba(124, 106, 240, 0.12)',
        value: format(namespaceCount, 0),
        unit: '个',
        sub: namespaceCount === null ? '暂无数据' : '已发现命名空间'
      },
      {
        key: 'active-namespaces',
        title: '活跃 Namespace',
        icon: Folder,
        iconColor: '#409eff',
        iconBg: 'rgba(64, 158, 255, 0.12)',
        value: format(activeNamespaceCount, 0),
        unit: '个',
        sub: activeNamespaceCount === null ? '暂无数据' : '当前承载工作负载'
      },
      {
        key: 'cpu-request-ratio',
        title: 'CPU 使用 / Request',
        icon: Cpu,
        iconColor: '#e6a23c',
        iconBg: 'rgba(230, 162, 60, 0.12)',
        value: statValue(cpuRequestRatioResult, 1),
        unit: '%',
        sub:
          cpuRequestRatioResult?.status === 'success'
            ? cpuRequestRatio >= 85
              ? '资源偏紧'
              : cpuRequestRatio >= 70
                ? '接近观察线'
                : '健康阈值内'
            : '暂无数据'
      },
      {
        key: 'memory-request-ratio',
        title: '内存使用 / Request',
        icon: Coin,
        iconColor: '#67c23a',
        iconBg: 'rgba(103, 194, 58, 0.12)',
        value: statValue(memoryRequestRatioResult, 1),
        unit: '%',
        sub:
          memoryRequestRatioResult?.status === 'success'
            ? memoryRequestRatio >= 85
              ? '资源偏紧'
              : memoryRequestRatio >= 70
                ? '接近观察线'
                : '健康阈值内'
            : '暂无数据'
      },
      {
        key: 'abnormal',
        title: '异常 Namespace',
        icon: Cpu,
        iconColor: '#f56c6c',
        iconBg: 'rgba(245, 108, 108, 0.12)',
        value: format(abnormalNamespaces.size, 0),
        unit: '个',
        sub: abnormalNamespaces.size ? '存在重启或资源热点' : '暂无明显异常'
      }
    ]
  })

  function namespaceSeriesValueMap(
    result: DashboardPanelResult | undefined
  ): Map<string, number> {
    const map = new Map<string, number>()
    if (!result || result.status !== 'success') return map
    for (const series of result.series) {
      const name = series.metric.namespace?.trim()
      const value = Number(series.values.at(-1)?.value ?? 0)
      if (name && Number.isFinite(value)) map.set(name, value)
    }
    return map
  }

  const namespaceTopPanels = computed(() =>
    ['namespace.cpu', 'namespace.memory', 'namespace.pods']
      .map((id) => currentPanels.value.find((panel) => panel.id === id))
      .filter((panel): panel is DashboardPanelDefinition => panel !== undefined)
  )

  const namespaceTrendPanels = computed(() =>
    ['namespace.cpu_trend', 'namespace.memory_trend']
      .map((id) => currentPanels.value.find((panel) => panel.id === id))
      .filter((panel): panel is DashboardPanelDefinition => panel !== undefined)
  )

  const namespaceRiskRows = computed<NamespaceRiskRow[]>(() => {
    const cpuMap = namespaceSeriesValueMap(resultMap['namespace.cpu'])
    const memoryMap = namespaceSeriesValueMap(resultMap['namespace.memory'])
    const restartMap = namespaceSeriesValueMap(resultMap['namespace.restarts'])
    const podMap = namespaceSeriesValueMap(resultMap['namespace.pods'])
    const names = new Set([
      ...cpuMap.keys(),
      ...memoryMap.keys(),
      ...restartMap.keys(),
      ...podMap.keys()
    ])
    const max = (map: Map<string, number>) => Math.max(...map.values(), 0)
    const cpuMax = max(cpuMap)
    const memoryMax = max(memoryMap)
    const restartMax = max(restartMap)
    const podMax = max(podMap)

    return [...names]
      .map((name) => {
        const cpu = cpuMap.get(name) ?? 0
        const memory = memoryMap.get(name) ?? 0
        const restarts = restartMap.get(name) ?? 0
        const pods = podMap.get(name) ?? 0
        const score =
          (cpuMax ? cpu / cpuMax : 0) * 0.35 +
          (memoryMax ? memory / memoryMax : 0) * 0.35 +
          (restartMax ? restarts / restartMax : 0) * 0.2 +
          (podMax ? pods / podMax : 0) * 0.1

        const reasons: string[] = []
        if (restarts > 0) reasons.push(`重启 ${restarts.toFixed(Number.isInteger(restarts) ? 0 : 1)} 次`)
        if (cpuMax && cpu / cpuMax >= 0.75) reasons.push('CPU 热点')
        if (memoryMax && memory / memoryMax >= 0.75) reasons.push('内存热点')
        if (!reasons.length && podMax && pods / podMax >= 0.75) reasons.push('Pod 密度较高')

        let tone: NamespaceRiskRow['tone'] = 'success'
        let tag = '观察'
        if (restarts > 0 || score >= 0.85) {
          tone = 'danger'
          tag = '优先处理'
        } else if (score >= 0.6) {
          tone = 'warning'
          tag = '重点关注'
        } else {
          tone = 'info'
          tag = '持续观察'
        }

        return {
          name,
          score: `${Math.round(score * 100)}分`,
          tone,
          tag,
          reason: reasons.join(' / ') || '资源平稳'
        }
      })
      .filter((item) => item.reason !== '资源平稳' || item.score !== '0分')
      .sort((a, b) => Number(b.score.replace('分', '')) - Number(a.score.replace('分', '')))
      .slice(0, 4)
  })

  const restartRiskCount = computed(
    () => namespaceRiskRows.value.filter((item) => item.reason.includes('重启')).length
  )

  const namespaceActionHints = computed(() => {
    const rows = namespaceRiskRows.value
    const hints: string[] = []
    if (rows.some((item) => item.reason.includes('重启'))) {
      hints.push('先看重启异常')
    }
    if (rows.some((item) => item.reason.includes('CPU 热点'))) {
      hints.push('再看 CPU 热点')
    }
    if (rows.some((item) => item.reason.includes('内存热点'))) {
      hints.push('关注内存热点')
    }
    if (!hints.length) hints.push('当前无明显异常')
    return hints.slice(0, 2)
  })

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

  function handlePanelItemClick(payload: { panelId: string; name: string }) {
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

  /** namespace 大盘右上角入口：跳转到集群详情对应页面（保留当前集群） */
  function goNamespacePage(page: string) {
    router.push({ path: `/container/${page}`, query: buildClusterRouteQuery(route, {}) })
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

  .prometheus-dashboard__summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
    margin-bottom: 20px;
  }

  .prometheus-dashboard__summary-card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    padding: 12px 14px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
  }

  .prometheus-dashboard__summary-card__head {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
  }

  .prometheus-dashboard__summary-card__title {
    overflow: hidden;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .prometheus-dashboard__summary-card__icon {
    display: flex;
    flex: 0 0 28px;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
  }

  .prometheus-dashboard__summary-card__value {
    display: flex;
    gap: 4px;
    align-items: baseline;
    font-size: 20px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
    color: var(--el-text-color-primary);
  }

  .prometheus-dashboard__summary-card__unit {
    font-size: 12px;
    font-weight: 400;
    color: var(--el-text-color-secondary);
  }

  .prometheus-dashboard__summary-card__sub {
    overflow: hidden;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .prometheus-dashboard__panel-grid {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 12px;
  }

  .prometheus-dashboard__risk-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 260px;
    padding: 14px 16px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-light);
    border-radius: 10px;
    box-sizing: border-box;
  }

  .prometheus-dashboard__risk-card__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .prometheus-dashboard__risk-card__sub {
    margin-top: 4px;
    font-size: 11px;
    line-height: 1.4;
    color: var(--el-text-color-secondary);
  }

  .prometheus-dashboard__risk-kpis {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .prometheus-dashboard__risk-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .prometheus-dashboard__risk-action {
    padding: 5px 10px;
    font-size: 11px;
    line-height: 1.2;
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-lighter);
    border-radius: 999px;
  }

  .prometheus-dashboard__risk-kpi {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 12px;
    background: var(--el-fill-color-lighter);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;

    strong {
      font-size: 20px;
      font-weight: 600;
      line-height: 1.1;
      color: var(--el-text-color-primary);
    }
  }

  .prometheus-dashboard__risk-kpi-label {
    font-size: 11px;
    color: var(--el-text-color-tertiary);
  }

  .prometheus-dashboard__risk-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .prometheus-dashboard__risk-row__main {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .prometheus-dashboard__risk-row__name {
    overflow: hidden;
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .prometheus-dashboard__risk-row__reason {
    overflow: hidden;
    font-size: 11px;
    line-height: 1.3;
    color: var(--el-text-color-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .prometheus-dashboard__risk-row__meta {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 8px;
  }

  .prometheus-dashboard__risk-row__score {
    font-size: 11px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .prometheus-dashboard__risk-row__tag {
    margin-right: 0;
    font-size: 11px;
  }

  /* namespace 大盘：所有模块卡片统一左右间距（与集群监控概览 16px 对齐），避免贴边 */
  .prometheus-dashboard__summary-grid,
  .prometheus-dashboard__panel-grid--top,
  .prometheus-dashboard__panel-grid--trend,
  .prometheus-dashboard__risk-block {
    margin-left: 16px;
    margin-right: 16px;
  }

  .prometheus-dashboard__panel-grid--trend,
  .prometheus-dashboard__panel-grid--top {
    margin-bottom: 20px;
  }

  /* namespace 大盘小标题：样式与集群监控概览 section-title 一致 */
  .prometheus-dashboard__section-title {
    margin: 0 16px 12px;
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .prometheus-dashboard__section-title--spaced {
    margin-top: 20px;
  }

  /* namespace 大盘：图表卡片高度调矮（仅作用于 namespace 区域，不影响其它大盘 section） */
  .prometheus-dashboard__panel-grid--trend :deep(.dashboard-panel) {
    height: 260px;
  }

  .prometheus-dashboard__panel-grid--top :deep(.dashboard-panel) {
    height: 180px;
  }

  /* namespace 大盘右上角「事件与告警」入口：间距与集群监控概览对齐（距顶 0） */
  .prometheus-dashboard__overview-actions {
    display: flex;
    justify-content: flex-end;
    margin: 0 16px 12px;
  }

  .prometheus-dashboard__overview-actions__link {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    font-size: 12px;
  }

  @media (width <= 768px) {
    .prometheus-dashboard__summary-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

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
    .prometheus-dashboard__summary-grid {
      grid-template-columns: 1fr;
    }

    .prometheus-dashboard__risk-kpis {
      grid-template-columns: 1fr;
    }

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

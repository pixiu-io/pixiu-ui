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
            v-for="section in etcdInjected"
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
                  underline="never"
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
                  overview-line
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
                  overview-line
                  compact-bar
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

            <template v-else-if="activeSection === 'coredns'">
              <div class="prometheus-dashboard__overview-actions">
                <ElLink
                  type="primary"
                  underline="never"
                  class="prometheus-dashboard__overview-actions__link"
                  @click="goNamespacePage('events')"
                >
                  <ElIcon :size="14"><Bell /></ElIcon>
                  <span>事件与告警</span>
                </ElLink>
              </div>

              <div class="prometheus-dashboard__coredns-summary">
                <div class="prometheus-dashboard__summary-grid prometheus-dashboard__summary-grid--coredns">
                  <div
                    v-for="card in corednsSummaryCards"
                    :key="card.key"
                    class="prometheus-dashboard__summary-card"
                    :class="{ 'is-danger': card.danger, 'is-warning': card.warning }"
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
                    <div
                      class="prometheus-dashboard__summary-card__value"
                      :class="{ 'is-danger': card.danger, 'is-warning': card.warning }"
                    >
                      {{ card.value }}
                      <span v-if="card.unit" class="prometheus-dashboard__summary-card__unit">{{
                        card.unit
                      }}</span>
                    </div>
                    <div class="prometheus-dashboard__summary-card__sub">{{ card.sub }}</div>
                  </div>
                </div>
              </div>

              <div
                class="prometheus-dashboard__section-title prometheus-dashboard__section-title--spaced"
              >
                副本与资源
              </div>
              <div class="prometheus-dashboard__coredns-resource">
                <div class="prometheus-dashboard__coredns-pod-card">
                  <div class="prometheus-dashboard__coredns-pod-card__head">
                    <h4>Pod 请求分布</h4>
                    <span>各副本 QPS 与平均延迟</span>
                  </div>
                  <div
                    v-if="queryLoading && !corednsPodRows.length"
                    class="prometheus-dashboard__coredns-pod-card__body prometheus-dashboard__coredns-pod-card__empty"
                  >
                    加载中…
                  </div>
                  <div
                    v-else-if="!corednsPodRows.length"
                    class="prometheus-dashboard__coredns-pod-card__body prometheus-dashboard__coredns-pod-card__empty"
                  >
                    暂无 Pod 指标数据
                  </div>
                  <div v-else class="prometheus-dashboard__coredns-pod-card__body">
                    <table class="prometheus-dashboard__coredns-pod-table">
                    <thead>
                      <tr>
                        <th>Pod</th>
                        <th>QPS</th>
                        <th>平均延迟</th>
                        <th>负载</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="row in corednsPodRows"
                        :key="row.name"
                        :class="{ 'is-imbalanced': row.imbalanced }"
                      >
                        <td :title="row.name">{{ row.name }}</td>
                        <td>{{ row.qps }}</td>
                        <td>{{ row.latency }}</td>
                        <td>
                          <ElTag
                            size="small"
                            :type="row.imbalanced ? 'warning' : 'success'"
                            effect="plain"
                          >
                            {{ row.imbalanced ? '偏高' : '正常' }}
                          </ElTag>
                        </td>
                      </tr>
                    </tbody>
                    </table>
                  </div>
                </div>
                <DashboardPanel
                  v-if="corednsProcessPanel"
                  :panel="corednsProcessPanel"
                  :result="resultMap[corednsProcessPanel.id]"
                  :loading="queryLoading"
                  :show-legend="showLegend"
                  overview-line
                  @time-range-select="handleChartTimeRangeSelect"
                />
              </div>

              <div
                class="prometheus-dashboard__section-title prometheus-dashboard__section-title--spaced"
              >
                请求
              </div>
              <div
                class="prometheus-dashboard__panel-grid prometheus-dashboard__panel-grid--coredns"
              >
                <DashboardPanel
                  v-for="panel in corednsRequestPanels"
                  :key="panel.id"
                  :panel="panel"
                  :result="resultMap[panel.id]"
                  :loading="queryLoading"
                  :show-legend="showLegend"
                  overview-line
                  @time-range-select="handleChartTimeRangeSelect"
                />
              </div>

              <div
                class="prometheus-dashboard__section-title prometheus-dashboard__section-title--spaced"
              >
                响应与可用性
              </div>
              <div
                class="prometheus-dashboard__panel-grid prometheus-dashboard__panel-grid--coredns"
              >
                <DashboardPanel
                  v-for="panel in corednsResponsePanels"
                  :key="panel.id"
                  :panel="panel"
                  :result="resultMap[panel.id]"
                  :loading="queryLoading"
                  :show-legend="showLegend"
                  overview-line
                  @time-range-select="handleChartTimeRangeSelect"
                />
              </div>
              <div
                class="prometheus-dashboard__panel-grid prometheus-dashboard__panel-grid--coredns prometheus-dashboard__panel-grid--coredns-latency"
              >
                <DashboardPanel
                  v-if="corednsLatencyPanel"
                  :key="corednsLatencyPanel.id"
                  :panel="corednsLatencyPanel"
                  :result="resultMap[corednsLatencyPanel.id]"
                  :loading="queryLoading"
                  :show-legend="showLegend"
                  overview-line
                  @time-range-select="handleChartTimeRangeSelect"
                />
              </div>

              <div
                class="prometheus-dashboard__section-title prometheus-dashboard__section-title--spaced"
              >
                缓存
              </div>
              <div
                class="prometheus-dashboard__panel-grid prometheus-dashboard__panel-grid--coredns"
              >
                <DashboardPanel
                  v-for="panel in corednsCachePanels"
                  :key="panel.id"
                  :panel="panel"
                  :result="resultMap[panel.id]"
                  :loading="queryLoading"
                  :show-legend="showLegend"
                  overview-line
                  @time-range-select="handleChartTimeRangeSelect"
                />
              </div>
            </template>

            <template v-else-if="activeSection === 'etcd'">
              <div class="prometheus-dashboard__overview-actions">
                <ElLink
                  type="primary"
                  underline="never"
                  class="prometheus-dashboard__overview-actions__link"
                  @click="goNamespacePage('events')"
                >
                  <ElIcon :size="14"><Bell /></ElIcon>
                  <span>事件与告警</span>
                </ElLink>
              </div>

              <div class="prometheus-dashboard__coredns-summary">
                <div class="prometheus-dashboard__summary-grid">
                  <div
                    v-for="card in etcdSummaryCards"
                    :key="card.key"
                    class="prometheus-dashboard__summary-card"
                    :class="{ 'is-danger': card.danger, 'is-warning': card.warning }"
                  >
                    <div class="prometheus-dashboard__summary-card__head">
                      <span class="prometheus-dashboard__summary-card__title">{{
                        card.title
                      }}</span>
                      <span
                        class="prometheus-dashboard__summary-card__icon"
                        :style="{ color: card.iconColor, background: card.iconBg }"
                      >
                        <ElIcon :size="16"><component :is="card.icon" /></ElIcon>
                      </span>
                    </div>
                    <div
                      class="prometheus-dashboard__summary-card__value"
                      :class="{ 'is-danger': card.danger, 'is-warning': card.warning }"
                    >
                      {{ card.value }}
                      <span v-if="card.unit" class="prometheus-dashboard__summary-card__unit">{{
                        card.unit
                      }}</span>
                    </div>
                    <div class="prometheus-dashboard__summary-card__sub">{{ card.sub }}</div>
                  </div>
                </div>
              </div>

              <div
                class="prometheus-dashboard__section-title prometheus-dashboard__section-title--spaced"
              >
                成员与资源
              </div>
              <div class="prometheus-dashboard__coredns-resource">
                <div class="prometheus-dashboard__coredns-pod-card">
                  <div class="prometheus-dashboard__coredns-pod-card__head">
                    <h4>成员明细</h4>
                    <span>各 etcd 成员 Leader 状态、存储与请求负载</span>
                  </div>
                  <div
                    v-if="queryLoading && !etcdMemberRows.length"
                    class="prometheus-dashboard__coredns-pod-card__body prometheus-dashboard__coredns-pod-card__empty"
                  >
                    加载中…
                  </div>
                  <div
                    v-else-if="!etcdMemberRows.length"
                    class="prometheus-dashboard__coredns-pod-card__body prometheus-dashboard__coredns-pod-card__empty"
                  >
                    暂无成员指标数据
                  </div>
                  <div v-else class="prometheus-dashboard__coredns-pod-card__body">
                    <table class="prometheus-dashboard__coredns-pod-table">
                      <thead>
                        <tr>
                          <th>成员</th>
                          <th>角色</th>
                          <th>DB 大小</th>
                          <th>内存</th>
                          <th>请求 QPS</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="row in etcdMemberRows" :key="row.name">
                          <td :title="row.name">{{ row.name }}</td>
                          <td>
                            <ElTag
                              size="small"
                              :type="row.leader ? 'danger' : 'info'"
                              effect="plain"
                            >
                              {{ row.leader ? 'Leader' : 'Follower' }}
                            </ElTag>
                          </td>
                          <td>{{ row.dbSize }}</td>
                          <td>{{ row.memory }}</td>
                          <td>{{ row.qps }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <DashboardPanel
                  v-if="etcdResourcePanels[1]"
                  :panel="etcdResourcePanels[1]"
                  :result="resultMap[etcdResourcePanels[1].id]"
                  :loading="queryLoading"
                  :show-legend="showLegend"
                  overview-line
                  @time-range-select="handleChartTimeRangeSelect"
                />
              </div>

              <div
                class="prometheus-dashboard__section-title prometheus-dashboard__section-title--spaced"
              >
                集群与共识
              </div>
              <div
                class="prometheus-dashboard__panel-grid prometheus-dashboard__panel-grid--coredns"
              >
                <DashboardPanel
                  v-for="panel in etcdRaftPanels"
                  :key="panel.id"
                  :panel="panel"
                  :result="resultMap[panel.id]"
                  :loading="queryLoading"
                  :show-legend="showLegend"
                  overview-line
                  @time-range-select="handleChartTimeRangeSelect"
                />
              </div>

              <div
                class="prometheus-dashboard__section-title prometheus-dashboard__section-title--spaced"
              >
                请求与吞吐
              </div>
              <div
                class="prometheus-dashboard__panel-grid prometheus-dashboard__panel-grid--coredns"
              >
                <DashboardPanel
                  v-for="panel in etcdRequestPanels"
                  :key="panel.id"
                  :panel="panel"
                  :result="resultMap[panel.id]"
                  :loading="queryLoading"
                  :show-legend="showLegend"
                  overview-line
                  @time-range-select="handleChartTimeRangeSelect"
                />
              </div>

              <div
                class="prometheus-dashboard__section-title prometheus-dashboard__section-title--spaced"
              >
                请求延迟
              </div>
              <div
                class="prometheus-dashboard__panel-grid prometheus-dashboard__panel-grid--coredns prometheus-dashboard__panel-grid--coredns-latency"
              >
                <DashboardPanel
                  v-if="etcdLatencyPanel"
                  :panel="etcdLatencyPanel"
                  :result="resultMap[etcdLatencyPanel.id]"
                  :loading="queryLoading"
                  :show-legend="showLegend"
                  overview-line
                  @time-range-select="handleChartTimeRangeSelect"
                />
              </div>

              <div
                class="prometheus-dashboard__section-title prometheus-dashboard__section-title--spaced"
              >
                磁盘与存储
              </div>
              <div
                class="prometheus-dashboard__panel-grid prometheus-dashboard__panel-grid--coredns"
              >
                <DashboardPanel
                  v-for="panel in etcdStoragePanels"
                  :key="panel.id"
                  :panel="panel"
                  :result="resultMap[panel.id]"
                  :loading="queryLoading"
                  :show-legend="showLegend"
                  overview-line
                  @time-range-select="handleChartTimeRangeSelect"
                />
              </div>

              <div
                class="prometheus-dashboard__section-title prometheus-dashboard__section-title--spaced"
              >
                资源使用
              </div>
              <div
                class="prometheus-dashboard__panel-grid prometheus-dashboard__panel-grid--coredns"
              >
                <DashboardPanel
                  v-for="panel in etcdResourcePanels"
                  :key="panel.id"
                  :panel="panel"
                  :result="resultMap[panel.id]"
                  :loading="queryLoading"
                  :show-legend="showLegend"
                  overview-line
                  @time-range-select="handleChartTimeRangeSelect"
                />
              </div>
            </template>

            <PrometheusEmbedLayout
              v-else-if="embedPageView"
              :view="embedPageView"
              :definition="definition"
              :result-map="resultMap"
              :loading="queryLoading"
              :show-legend="showLegend"
              @events-click="goNamespacePage('events')"
              @time-range-select="handleChartTimeRangeSelect"
              @item-click="handlePanelItemClick"
            />

            <div v-else class="prometheus-dashboard__panel-grid">
              <DashboardPanel
                v-for="panel in currentPanels"
                :key="panel.id"
                :panel="panel"
                :result="resultMap[panel.id]"
                :loading="queryLoading"
                :show-legend="showLegend"
                overview-line
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
  import {
    Bell,
    CaretRight,
    CircleCheckFilled,
    Coin,
    Connection,
    Cpu,
    Folder,
    Monitor,
    Odometer,
    Timer,
    WarningFilled
  } from '@element-plus/icons-vue'
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
  import { COREDNS_EMBED_PANEL_IDS, resolveClusterDetailPanelIds } from '@/utils/metrics/dashboard-catalog'
  import PrometheusEmbedLayout from '@/views/container/cluster-detail/prometheus/embed/PrometheusEmbedLayout.vue'
  import { buildEmbedPageView } from '@/views/container/cluster-detail/prometheus/embed/embed-views'
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
    etcd: 'Etcd',
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
  // 本地克隆 sections 导航用于注入 etcd，避免污染 dashboard-catalog 的共享 sections（/monitor 大盘共用）
  const navSections = computed(() =>
    definition.value.sections.map((group) => ({
      ...group,
      children: group.children ? [...group.children] : undefined
    }))
  )
  const etcdInjected = computed(() => {
    const sections = navSections.value
    const core = sections.find((group) => group.id === 'core')
    if (core?.children && !core.children.includes('etcd')) core.children.push('etcd')
    return sections
  })
  const EMBED_LAYOUT_SECTIONS = new Set([
    'apiserver',
    'kubelet',
    'controller-manager',
    'scheduler',
    'node-resource',
    'node-pod',
    'workload',
    'pod'
  ])

  const activePanelIds = computed(() =>
    resolveClusterDetailPanelIds(
      activeSection.value,
      currentPanels.value.map((panel) => panel.id),
      COREDNS_EMBED_PANEL_IDS
    )
  )
  const embedPageView = computed(() => {
    if (!EMBED_LAYOUT_SECTIONS.has(activeSection.value)) return null
    return buildEmbedPageView(activeSection.value, resultMap)
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

  function resolveEmbedPanels(ids: string[]) {
    return ids
      .map((id) => definition.value.panels.find((panel) => panel.id === id))
      .filter((panel): panel is DashboardPanelDefinition => panel !== undefined)
  }

  const corednsRequestPanels = computed(() =>
    resolveEmbedPanels(['coredns.embed.requests_total', 'coredns.embed.requests_by_type'])
  )
  const corednsResponsePanels = computed(() =>
    resolveEmbedPanels(['coredns.embed.success_rate', 'coredns.embed.rcodes'])
  )
  const corednsLatencyPanel = computed(
    () => definition.value.panels.find((panel) => panel.id === 'coredns.embed.latency')
  )
  const corednsCachePanels = computed(() =>
    resolveEmbedPanels(['coredns.embed.cache_hitrate', 'coredns.embed.cache_hits_misses'])
  )
  const corednsProcessPanel = computed(
    () => definition.value.panels.find((panel) => panel.id === 'coredns.embed.process')
  )

  type CorednsPodRow = {
    name: string
    qps: string
    latency: string
    imbalanced: boolean
  }

  function corednsPodName(metric: Record<string, string>): string {
    return metric.pod?.trim() || metric.instance?.replace(/:\d+$/, '') || '未知 Pod'
  }

  function formatCorednsQps(value: number): string {
    if (!Number.isFinite(value)) return '-'
    return `${value.toFixed(value >= 10 ? 1 : 2)}/s`
  }

  function formatCorednsLatency(value: number): string {
    if (!Number.isFinite(value)) return '-'
    return `${value.toFixed(value >= 10 ? 1 : 2)} ms`
  }

  const corednsPodRows = computed<CorednsPodRow[]>(() => {
    const qpsResult = resultMap['coredns.embed.pod_qps']
    const latencyResult = resultMap['coredns.embed.pod_latency']
    const qpsMap = new Map<string, number>()
    const latencyMap = new Map<string, number>()

    if (qpsResult?.status === 'success') {
      for (const series of qpsResult.series) {
        const name = corednsPodName(series.metric)
        const value = Number(series.values.at(-1)?.value ?? 0)
        if (Number.isFinite(value)) qpsMap.set(name, value)
      }
    }
    if (latencyResult?.status === 'success') {
      for (const series of latencyResult.series) {
        const name = corednsPodName(series.metric)
        const value = Number(series.values.at(-1)?.value ?? 0)
        if (Number.isFinite(value)) latencyMap.set(name, value)
      }
    }

    const names = new Set([...qpsMap.keys(), ...latencyMap.keys()])
    const rows = [...names].map((name) => ({
      name,
      qpsValue: qpsMap.get(name) ?? 0,
      latencyValue: latencyMap.get(name) ?? 0
    }))
    if (!rows.length) return []

    const avgQps = rows.reduce((sum, row) => sum + row.qpsValue, 0) / rows.length
    return rows
      .map((row) => ({
        name: row.name,
        qps: formatCorednsQps(row.qpsValue),
        latency: formatCorednsLatency(row.latencyValue),
        imbalanced: avgQps > 0 && row.qpsValue > avgQps * 1.5
      }))
      .sort((a, b) => {
        const aq = qpsMap.get(a.name) ?? 0
        const bq = qpsMap.get(b.name) ?? 0
        return bq - aq
      })
  })

  type CorednsHealthStatus = 'healthy' | 'warning' | 'danger' | 'unknown'

  type CorednsSummaryCard = {
    key: string
    title: string
    icon: Component
    iconColor: string
    iconBg: string
    value: string
    unit?: string
    sub: string
    danger?: boolean
    warning?: boolean
  }

  function corednsEmbedStat(panelId: string): number | null {
    const result = resultMap[panelId]
    if (result?.status !== 'success') return null
    const value = Number(result.series?.[0]?.values?.at(-1)?.value)
    return Number.isFinite(value) ? value : null
  }

  function corednsEmbedQuantile(panelId: string, quantile: number): number | null {
    const result = resultMap[panelId]
    if (result?.status !== 'success') return null
    const series = result.series.find((item) => Number(item.metric.quantile) === quantile)
    if (!series) return null
    const value = Number(series.values.at(-1)?.value)
    return Number.isFinite(value) ? value : null
  }

  const COREDNS_MIN_DNS_QPS = 0.001

  const corednsMetrics = computed(() => {
    const successRate = corednsEmbedStat('coredns.embed.success_rate')
    const cacheHitRate = corednsEmbedStat('coredns.embed.cache_hitrate')
    const qps = corednsEmbedStat('coredns.embed.requests_total')
    const p99Latency = corednsEmbedQuantile('coredns.embed.latency', 0.99)
    const panicResult = resultMap['coredns.embed.panics']
    const panics =
      panicResult?.status === 'success'
        ? Number(panicResult.series?.[0]?.values?.at(-1)?.value ?? 0)
        : null
    const replicaCount = corednsPodRows.value.length
    const imbalancedCount = corednsPodRows.value.filter((row) => row.imbalanced).length
    const hasDnsTraffic = qps !== null && qps > COREDNS_MIN_DNS_QPS
    const isDnsIdle =
      !hasDnsTraffic &&
      (successRate === null || successRate === 0) &&
      (qps === null || qps <= COREDNS_MIN_DNS_QPS)
    const hasMetrics =
      successRate !== null ||
      cacheHitRate !== null ||
      qps !== null ||
      p99Latency !== null ||
      replicaCount > 0

    return {
      successRate,
      cacheHitRate,
      qps,
      p99Latency,
      panics: Number.isFinite(panics ?? NaN) ? (panics as number) : null,
      replicaCount,
      imbalancedCount,
      hasDnsTraffic,
      isDnsIdle,
      hasMetrics
    }
  })

  const corednsHealth = computed(() => {
    const {
      successRate,
      cacheHitRate,
      qps,
      p99Latency,
      panics,
      replicaCount,
      imbalancedCount,
      hasDnsTraffic,
      isDnsIdle,
      hasMetrics
    } = corednsMetrics.value

    if (queryLoading.value && !hasMetrics) {
      return {
        status: 'unknown' as CorednsHealthStatus,
        title: 'CoreDNS 状态评估中',
        description: '正在拉取 DNS 解析与缓存指标…',
        issues: [] as string[]
      }
    }

    if (!hasMetrics) {
      return {
        status: 'unknown' as CorednsHealthStatus,
        title: 'CoreDNS 暂无监控数据',
        description: '未采集到 CoreDNS 指标，请确认 Prometheus 已抓取 coredns 指标。',
        issues: [] as string[]
      }
    }

    if (isDnsIdle && (panics === null || panics <= 0)) {
      return {
        status: 'unknown' as CorednsHealthStatus,
        title: 'CoreDNS 待观察',
        description:
          replicaCount > 0
            ? '当前暂无 DNS 请求流量，新集群或空闲状态下指标待积累，暂不做异常判定。'
            : '当前暂无 DNS 请求流量，待业务访问后再评估运行状态。',
        issues: [] as string[]
      }
    }

    const issues: string[] = []
    let status: CorednsHealthStatus = 'healthy'

    const markWarning = () => {
      if (status === 'healthy') status = 'warning'
    }
    const markDanger = () => {
      status = 'danger'
    }

    if (panics !== null && panics > 0) {
      markDanger()
      issues.push(`过去 5 分钟发生 ${panics.toFixed(0)} 次 Panic`)
    }
    if (hasDnsTraffic && successRate !== null && successRate < 95) {
      markDanger()
      issues.push(`解析成功率 ${successRate.toFixed(1)}%，低于 95%`)
    } else if (hasDnsTraffic && successRate !== null && successRate < 99) {
      markWarning()
      issues.push(`解析成功率 ${successRate.toFixed(1)}%，建议关注 SERVFAIL`)
    }
    if (hasDnsTraffic && p99Latency !== null && p99Latency > 500) {
      markDanger()
      issues.push(`P99 解析延迟 ${p99Latency.toFixed(0)} ms，响应偏慢`)
    } else if (hasDnsTraffic && p99Latency !== null && p99Latency > 100) {
      markWarning()
      issues.push(`P99 解析延迟 ${p99Latency.toFixed(0)} ms，略高于正常水平`)
    }
    if (hasDnsTraffic && cacheHitRate !== null && cacheHitRate < 30) {
      markDanger()
      issues.push(`缓存命中率 ${cacheHitRate.toFixed(1)}%，缓存效率偏低`)
    } else if (hasDnsTraffic && cacheHitRate !== null && cacheHitRate < 60) {
      markWarning()
      issues.push(`缓存命中率 ${cacheHitRate.toFixed(1)}%，可检查 TTL 与缓存配置`)
    }
    if (hasDnsTraffic && imbalancedCount > 0) {
      markWarning()
      issues.push(`${imbalancedCount} 个副本请求负载偏高，建议检查副本均衡`)
    }

    const title =
      status === 'healthy'
        ? 'CoreDNS 运行正常'
        : status === 'warning'
          ? 'CoreDNS 需关注'
          : 'CoreDNS 运行异常'

    const description =
      status === 'healthy'
        ? '解析成功率、延迟与缓存指标均在健康范围内，副本负载正常。'
        : status === 'warning'
          ? '部分 DNS 指标偏离正常范围，建议结合下方趋势图进一步排查。'
          : '检测到 CoreDNS 可用性或性能问题，请优先处理下列异常项。'

    return { status, title, description, issues }
  })

  const corednsSummaryCards = computed<CorednsSummaryCard[]>(() => {
    const {
      successRate,
      cacheHitRate,
      qps,
      p99Latency,
      replicaCount,
      imbalancedCount,
      hasDnsTraffic,
      isDnsIdle
    } = corednsMetrics.value
    const health = corednsHealth.value

    const healthIcon =
      health.status === 'healthy'
        ? CircleCheckFilled
        : health.status === 'warning'
          ? WarningFilled
          : health.status === 'danger'
            ? WarningFilled
            : Monitor
    const healthColor =
      health.status === 'healthy'
        ? '#67c23a'
        : health.status === 'warning'
          ? '#e6a23c'
          : health.status === 'danger'
            ? '#f56c6c'
            : '#909399'
    const healthBg =
      health.status === 'healthy'
        ? 'rgba(103, 194, 58, 0.12)'
        : health.status === 'warning'
          ? 'rgba(230, 162, 60, 0.12)'
          : health.status === 'danger'
            ? 'rgba(245, 108, 108, 0.12)'
            : 'rgba(144, 147, 153, 0.12)'

    return [
      {
        key: 'health',
        title: '运行状态',
        icon: healthIcon,
        iconColor: healthColor,
        iconBg: healthBg,
        value:
          health.status === 'healthy'
            ? '正常'
            : health.status === 'warning'
              ? '需关注'
              : health.status === 'danger'
                ? '异常'
                : health.title === 'CoreDNS 待观察'
                  ? '待观察'
                  : '-',
        sub: health.description,
        danger: health.status === 'danger',
        warning: health.status === 'warning'
      },
      {
        key: 'success-rate',
        title: '解析成功率',
        icon: CircleCheckFilled,
        iconColor: '#409eff',
        iconBg: 'rgba(64, 158, 255, 0.12)',
        value: successRate === null ? '-' : successRate.toFixed(1),
        unit: '%',
        sub:
          successRate === null
            ? '暂无数据'
            : isDnsIdle
              ? '暂无 DNS 流量'
              : successRate >= 99
                ? 'NOERROR / NXDOMAIN 占比正常'
                : '存在解析失败响应',
        danger: hasDnsTraffic && successRate !== null && successRate < 95,
        warning: hasDnsTraffic && successRate !== null && successRate >= 95 && successRate < 99
      },
      {
        key: 'latency',
        title: 'P99 解析延迟',
        icon: Timer,
        iconColor: '#e6a23c',
        iconBg: 'rgba(230, 162, 60, 0.12)',
        value: p99Latency === null ? '-' : p99Latency.toFixed(p99Latency >= 10 ? 1 : 2),
        unit: 'ms',
        sub:
          p99Latency === null
            ? '暂无数据'
            : p99Latency <= 100
              ? '尾延迟处于正常范围'
              : '解析响应偏慢',
        danger: p99Latency !== null && p99Latency > 500,
        warning: p99Latency !== null && p99Latency > 100 && p99Latency <= 500
      },
      {
        key: 'cache',
        title: '缓存命中率',
        icon: Odometer,
        iconColor: '#67c23a',
        iconBg: 'rgba(103, 194, 58, 0.12)',
        value: cacheHitRate === null ? '-' : cacheHitRate.toFixed(1),
        unit: '%',
        sub:
          cacheHitRate === null
            ? '暂无数据'
            : isDnsIdle
              ? '暂无 DNS 流量'
              : cacheHitRate >= 60
                ? '缓存效率良好'
                : '缓存命中偏低',
        danger: hasDnsTraffic && cacheHitRate !== null && cacheHitRate < 30,
        warning: hasDnsTraffic && cacheHitRate !== null && cacheHitRate >= 30 && cacheHitRate < 60
      },
      {
        key: 'qps',
        title: 'DNS 请求 QPS',
        icon: Connection,
        iconColor: '#7c6af0',
        iconBg: 'rgba(124, 106, 240, 0.12)',
        value: qps === null ? '-' : qps.toFixed(qps >= 10 ? 1 : 2),
        unit: '/s',
        sub:
          replicaCount > 0
            ? isDnsIdle
              ? `${replicaCount} 个副本，暂无请求流量`
              : `${replicaCount} 个副本${imbalancedCount ? `，${imbalancedCount} 个负载偏高` : ''}`
            : '暂无副本数据',
        danger: false,
        warning: hasDnsTraffic && imbalancedCount > 0
      }
    ]
  })

  // ---- Etcd 摘要卡与成员明细（对齐 coredns 模式） ----
  type EtcdHealthStatus = 'healthy' | 'warning' | 'danger' | 'unknown'

  type EtcdSummaryCard = {
    key: string
    title: string
    icon: Component
    iconColor: string
    iconBg: string
    value: string
    unit?: string
    sub: string
    danger?: boolean
    warning?: boolean
  }

  type EtcdMemberRow = {
    name: string
    leader: boolean
    dbSize: string
    memory: string
    qps: string
  }

  const etcdRaftPanels = computed(() =>
    resolveEmbedPanels([
      'etcd.embed.leader_changes',
      'etcd.embed.proposals',
      'etcd.embed.has_leader'
    ])
  )
  const etcdRequestPanels = computed(() =>
    resolveEmbedPanels([
      'etcd.embed.requests_total',
      'etcd.embed.requests_by_method',
      'etcd.embed.error_rate'
    ])
  )
  const etcdLatencyPanel = computed(() =>
    definition.value.panels.find((panel) => panel.id === 'etcd.embed.latency')
  )
  const etcdStoragePanels = computed(() =>
    resolveEmbedPanels([
      'etcd.embed.wal_fsync',
      'etcd.embed.backend_commit',
      'etcd.embed.db_size',
      'etcd.embed.kv_count',
      'etcd.embed.quota_usage'
    ])
  )
  const etcdResourcePanels = computed(() =>
    resolveEmbedPanels(['etcd.embed.memory', 'etcd.embed.cpu'])
  )

  function etcdEmbedStat(panelId: string): number | null {
    const result = resultMap[panelId]
    if (result?.status !== 'success') return null
    const value = Number(result.series?.[0]?.values?.at(-1)?.value)
    return Number.isFinite(value) ? value : null
  }

  function etcdEmbedQuantile(panelId: string, quantile: number): number | null {
    const result = resultMap[panelId]
    if (result?.status !== 'success') return null
    const series = result.series.find((item) => Number(item.metric.quantile) === quantile)
    if (!series) return null
    const value = Number(series.values.at(-1)?.value)
    return Number.isFinite(value) ? value : null
  }

  function formatEtcdBytes(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return '-'
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
    let current = Math.abs(value)
    let index = 0
    while (current >= 1024 && index < units.length - 1) {
      current /= 1024
      index += 1
    }
    return `${current.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
  }

  function formatEtcdQps(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return '-'
    return `${value.toFixed(value >= 10 ? 1 : 2)}/s`
  }

  const etcdMemberRows = computed<EtcdMemberRow[]>(() => {
    const leaderResult = resultMap['etcd.embed.member_leader']
    const dbResult = resultMap['etcd.embed.member_db_size']
    const memResult = resultMap['etcd.embed.member_memory']
    const qpsResult = resultMap['etcd.embed.member_qps']
    const maps = [
      { result: leaderResult, extract: (v: number) => v > 0 },
      { result: dbResult, extract: formatEtcdBytes },
      { result: memResult, extract: formatEtcdBytes },
      { result: qpsResult, extract: formatEtcdQps }
    ]
    const names = new Set<string>()
    for (const m of maps) {
      if (m.result?.status !== 'success') continue
      for (const series of m.result.series) {
        const name =
          series.metric.instance?.replace(/:\d+$/, '') || series.metric.pod?.trim() || '未知成员'
        names.add(name)
      }
    }
    const rows: EtcdMemberRow[] = [...names]
      .map((name) => {
        const byInstance = (res: (typeof maps)[0]['result']) => {
          if (res?.status !== 'success') return null
          const s = res.series.find(
            (item) =>
              (item.metric.instance?.replace(/:\d+$/, '') || item.metric.pod?.trim()) === name
          )
          return s ? Number(s.values.at(-1)?.value) : null
        }
        return {
          name,
          leader: (byInstance(maps[0].result) ?? 0) > 0,
          dbSize: formatEtcdBytes(byInstance(maps[1].result)),
          memory: formatEtcdBytes(byInstance(maps[2].result)),
          qps: formatEtcdQps(byInstance(maps[3].result))
        }
      })
      .sort((a, b) => (a.leader === b.leader ? 0 : a.leader ? -1 : 1))
    return rows
  })

  const etcdMetrics = computed(() => {
    const leaderCount = etcdEmbedStat('etcd.embed.leader_count')
    const memberCount = etcdEmbedStat('etcd.embed.member_count')
    const qps = etcdEmbedStat('etcd.embed.requests_total')
    const p99Latency = etcdEmbedQuantile('etcd.embed.latency', 0.99)
    const errorRate = etcdEmbedStat('etcd.embed.error_rate')
    const quotaUsage = etcdEmbedStat('etcd.embed.quota_usage')
    const dbSize = etcdEmbedStat('etcd.embed.db_size')
    const walFsyncP99 = etcdEmbedQuantile('etcd.embed.wal_fsync', 0.99)
    const leaderChangesResult = resultMap['etcd.embed.leader_changes']
    const leaderChanges =
      leaderChangesResult?.status === 'success'
        ? leaderChangesResult.series.reduce(
            (sum, s) => sum + Number(s.values.at(-1)?.value ?? 0),
            0
          )
        : null
    const hasMetrics =
      leaderCount !== null ||
      memberCount !== null ||
      qps !== null ||
      p99Latency !== null ||
      errorRate !== null ||
      quotaUsage !== null ||
      dbSize !== null
    return {
      leaderCount,
      memberCount,
      qps,
      p99Latency,
      errorRate,
      quotaUsage,
      dbSize,
      walFsyncP99,
      leaderChanges,
      hasMetrics
    }
  })

  const etcdHealth = computed(() => {
    const {
      leaderCount,
      memberCount,
      qps,
      p99Latency,
      errorRate,
      quotaUsage,
      walFsyncP99,
      leaderChanges,
      hasMetrics
    } = etcdMetrics.value
    if (queryLoading.value && !hasMetrics) {
      return {
        status: 'unknown' as EtcdHealthStatus,
        title: 'Etcd 状态评估中',
        description: '正在拉取 etcd 集群指标…',
        issues: [] as string[]
      }
    }
    if (!hasMetrics) {
      return {
        status: 'unknown' as EtcdHealthStatus,
        title: 'Etcd 暂无监控数据',
        description: '未采集到 etcd 指标，请确认 Prometheus 已抓取 etcd 暴露的指标。',
        issues: [] as string[]
      }
    }
    const issues: string[] = []
    let status: EtcdHealthStatus = 'healthy'
    const markWarning = () => {
      if (status === 'healthy') status = 'warning'
    }
    const markDanger = () => {
      status = 'danger'
    }

    if (leaderCount !== null && memberCount !== null && leaderCount === 0) {
      markDanger()
      issues.push(`集群无 Leader（${leaderCount}/${memberCount}）`)
    } else if (leaderCount !== null && memberCount !== null && leaderCount < memberCount) {
      markWarning()
      issues.push(`部分成员缺少 Leader（${leaderCount}/${memberCount}）`)
    }
    if (leaderChanges !== null && leaderChanges > 0.05) {
      markWarning()
      issues.push('Leader 切换较频繁，建议检查网络与磁盘延迟')
    }
    if (errorRate !== null && qps !== null && errorRate > 5) {
      markDanger()
      issues.push(`gRPC 请求错误率 ${errorRate.toFixed(2)}%，高于 5%`)
    } else if (errorRate !== null && qps !== null && errorRate > 1) {
      markWarning()
      issues.push(`gRPC 请求错误率 ${errorRate.toFixed(2)}%，建议关注`)
    }
    if (p99Latency !== null && p99Latency > 500) {
      markDanger()
      issues.push(`P99 请求延迟 ${p99Latency.toFixed(0)} ms，响应偏慢`)
    } else if (p99Latency !== null && p99Latency > 100) {
      markWarning()
      issues.push(`P99 请求延迟 ${p99Latency.toFixed(0)} ms，略高于正常水平`)
    }
    if (quotaUsage !== null && quotaUsage >= 90) {
      markDanger()
      issues.push(`DB 配额使用率 ${quotaUsage.toFixed(1)}%，接近上限`)
    } else if (quotaUsage !== null && quotaUsage >= 80) {
      markWarning()
      issues.push(`DB 配额使用率 ${quotaUsage.toFixed(1)}%，建议扩容或压缩`)
    }
    if (walFsyncP99 !== null && walFsyncP99 > 200) {
      markDanger()
      issues.push(`WAL fsync P99 ${walFsyncP99.toFixed(0)} ms，磁盘写入慢`)
    } else if (walFsyncP99 !== null && walFsyncP99 > 100) {
      markWarning()
      issues.push(`WAL fsync P99 ${walFsyncP99.toFixed(0)} ms，磁盘延迟偏高`)
    }

    const title =
      status === 'healthy'
        ? 'Etcd 运行正常'
        : status === 'warning'
          ? 'Etcd 需关注'
          : 'Etcd 运行异常'
    const description =
      status === 'healthy'
        ? 'Leader、请求成功率、延迟与存储指标均在健康范围内。'
        : status === 'warning'
          ? '部分 etcd 指标偏离正常范围，建议结合下方趋势图进一步排查。'
          : '检测到 Etcd 可用性或性能问题，请优先处理下列异常项。'
    return { status, title, description, issues }
  })

  const etcdSummaryCards = computed<EtcdSummaryCard[]>(() => {
    const { leaderCount, memberCount, qps, p99Latency, quotaUsage, dbSize, leaderChanges } =
      etcdMetrics.value
    const health = etcdHealth.value
    const healthIcon =
      health.status === 'healthy'
        ? CircleCheckFilled
        : health.status === 'warning'
          ? WarningFilled
          : health.status === 'danger'
            ? WarningFilled
            : Monitor
    const healthColor =
      health.status === 'healthy'
        ? '#67c23a'
        : health.status === 'warning'
          ? '#e6a23c'
          : health.status === 'danger'
            ? '#f56c6c'
            : '#909399'
    const healthBg =
      health.status === 'healthy'
        ? 'rgba(103, 194, 58, 0.12)'
        : health.status === 'warning'
          ? 'rgba(230, 162, 60, 0.12)'
          : health.status === 'danger'
            ? 'rgba(245, 108, 108, 0.12)'
            : 'rgba(144, 147, 153, 0.12)'
    return [
      {
        key: 'health',
        title: '运行状态',
        icon: healthIcon,
        iconColor: healthColor,
        iconBg: healthBg,
        value:
          health.status === 'healthy'
            ? '正常'
            : health.status === 'warning'
              ? '需关注'
              : health.status === 'danger'
                ? '异常'
                : '-',
        sub: health.description,
        danger: health.status === 'danger',
        warning: health.status === 'warning'
      },
      {
        key: 'leader',
        title: '集群 / Leader',
        icon: CircleCheckFilled,
        iconColor: '#409eff',
        iconBg: 'rgba(64, 158, 255, 0.12)',
        value:
          leaderCount === null || memberCount === null ? '-' : `${leaderCount} / ${memberCount}`,
        sub:
          leaderCount === null
            ? '暂无数据'
            : leaderCount === 0
              ? '集群无 Leader'
              : leaderChanges !== null && leaderChanges > 0.05
                ? 'Leader 切换较频繁'
                : 'Leader 状态正常',
        danger: leaderCount === 0,
        warning:
          leaderCount !== null &&
          memberCount !== null &&
          leaderCount > 0 &&
          leaderCount < memberCount
      },
      {
        key: 'qps',
        title: '请求 QPS',
        icon: Connection,
        iconColor: '#7c6af0',
        iconBg: 'rgba(124, 106, 240, 0.12)',
        value: qps === null ? '-' : qps.toFixed(qps >= 10 ? 1 : 2),
        unit: '/s',
        sub: qps === null ? '暂无数据' : `${memberCount ?? 0} 个成员`,
        danger: false,
        warning: false
      },
      {
        key: 'latency',
        title: 'P99 请求延迟',
        icon: Timer,
        iconColor: '#e6a23c',
        iconBg: 'rgba(230, 162, 60, 0.12)',
        value: p99Latency === null ? '-' : p99Latency.toFixed(p99Latency >= 10 ? 1 : 2),
        unit: 'ms',
        sub:
          p99Latency === null
            ? '暂无数据'
            : p99Latency <= 100
              ? '尾延迟处于正常范围'
              : '请求响应偏慢',
        danger: p99Latency !== null && p99Latency > 500,
        warning: p99Latency !== null && p99Latency > 100 && p99Latency <= 500
      },
      {
        key: 'storage',
        title: '存储占用',
        icon: Coin,
        iconColor: '#67c23a',
        iconBg: 'rgba(103, 194, 58, 0.12)',
        value: formatEtcdBytes(dbSize),
        sub: quotaUsage === null ? '暂无数据' : `配额使用率 ${quotaUsage.toFixed(1)}%`,
        danger: quotaUsage !== null && quotaUsage >= 90,
        warning: quotaUsage !== null && quotaUsage >= 80 && quotaUsage < 90
      }
    ]
  })

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
    if (!datasource || !activePanelIds.value.length) return
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

  .prometheus-dashboard__coredns-summary {
    margin-bottom: 20px;
  }

  .prometheus-dashboard__summary-grid--coredns {
    margin: 0 16px;
  }

  .prometheus-dashboard__summary-card.is-warning {
    border-color: rgb(230 162 60 / 45%);
  }

  .prometheus-dashboard__summary-card.is-danger {
    border-color: rgb(245 108 108 / 45%);
  }

  .prometheus-dashboard__summary-card__value.is-warning {
    color: #e6a23c;
  }

  .prometheus-dashboard__summary-card__value.is-danger {
    color: #f56c6c;
  }

  .prometheus-dashboard__panel-grid--coredns {
    margin-left: 16px;
    margin-right: 16px;
    margin-bottom: 12px;
  }

  .prometheus-dashboard__panel-grid--coredns-latency {
    margin-bottom: 20px;
  }

  .prometheus-dashboard__panel-grid--full {
    grid-template-columns: 1fr;
  }

  .prometheus-dashboard__panel-grid--workload {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  @media (max-width: 1200px) {
    .prometheus-dashboard__panel-grid--workload {
      grid-template-columns: 1fr;
    }
  }

  .prometheus-dashboard__panel-grid--coredns :deep(.dashboard-panel.is-line) {
    height: 260px;
  }

  .prometheus-dashboard__coredns-resource {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin: 0 16px 20px;
  }

  .prometheus-dashboard__coredns-pod-card {
    display: flex;
    flex-direction: column;
    height: 180px;
    overflow: hidden;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
  }

  .prometheus-dashboard__coredns-pod-card__head {
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;
    gap: 2px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--el-border-color-lighter);

    h4 {
      margin: 0;
      font-size: 12px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }

    span {
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }
  }

  .prometheus-dashboard__coredns-pod-card__body {
    flex: 1;
    min-height: 0;
    overflow: hidden auto;
    scrollbar-width: thin;
    scrollbar-color: var(--el-border-color) transparent;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--el-border-color);
      border-radius: 3px;
    }
  }

  .prometheus-dashboard__coredns-pod-card__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .prometheus-dashboard__coredns-pod-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;

    th,
    td {
      padding: 6px 12px;
      text-align: left;
      border-bottom: 1px solid var(--el-border-color-extra-light);
    }

    th {
      position: sticky;
      top: 0;
      z-index: 1;
      font-weight: 600;
      color: var(--el-text-color-secondary);
      background: var(--el-bg-color);
    }

    td:first-child {
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    tr.is-imbalanced td:first-child {
      color: var(--el-color-warning-dark-2);
    }

    tbody tr:last-child td {
      border-bottom: none;
    }
  }

  .prometheus-dashboard__coredns-resource :deep(.dashboard-panel.is-line) {
    height: 220px;
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

    .prometheus-dashboard__coredns-resource {
      grid-template-columns: minmax(0, 1fr);
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

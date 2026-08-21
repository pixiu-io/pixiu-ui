<template>
        <ClusterMonitorOverview
          v-if="activeSection === 'cluster'"
          :cluster-name="clusterName"
          :datasource="datasource"
          :toolbar="false"
          :external-time-range="timeRange"
          :external-granularity="granularity"
          :external-auto-refresh="autoRefresh"
          @update:external-time-range="emit('update:timeRange', $event)"
          @update:external-granularity="emit('update:granularity', $event)"
          @update:external-auto-refresh="emit('update:autoRefresh', $event)"
        />
        <template v-else>
          <template v-if="activeSection === 'namespace'">
            <div v-if="effectiveShowEventsLink" class="prometheus-dashboard__overview-actions">
              <ElLink
                type="primary"
                underline="never"
                class="prometheus-dashboard__overview-actions__link"
                @click="emit('events-click')"
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
                @time-range-select="emit('time-range-select', $event)"
                @item-click="emit('item-click', $event)"
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
                @time-range-select="emit('time-range-select', $event)"
                @item-click="emit('item-click', $event)"
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
            <div v-if="effectiveShowEventsLink" class="prometheus-dashboard__overview-actions">
              <ElLink
                type="primary"
                underline="never"
                class="prometheus-dashboard__overview-actions__link"
                @click="emit('events-click')"
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
              实例在线状态
            </div>
            <div class="prometheus-dashboard__panel-grid prometheus-dashboard__panel-grid--coredns">
              <DashboardPanel
                v-if="corednsStatusPanel"
                :panel="corednsStatusPanel"
                :result="resultMap['coredns.embed.instance_status']"
                :loading="queryLoading"
                :show-legend="showLegend"
              />
            </div>

            <div
              class="prometheus-dashboard__section-title prometheus-dashboard__section-title--spaced"
            >
              实例资源
            </div>
            <div class="prometheus-dashboard__panel-grid prometheus-dashboard__panel-grid--coredns">
              <ApiserverMetricCard
                title="实例 CPU"
                unit="cores"
                metric-label="quota"
                :result="resultMap['coredns.embed.instance_cpu']"
              />
              <ApiserverMetricCard
                title="实例内存"
                unit="bytes"
                metric-label="quota"
                :result="resultMap['coredns.embed.instance_memory']"
              />
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
                @time-range-select="emit('time-range-select', $event)"
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
                @time-range-select="emit('time-range-select', $event)"
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
                @time-range-select="emit('time-range-select', $event)"
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
                @time-range-select="emit('time-range-select', $event)"
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
                @time-range-select="emit('time-range-select', $event)"
              />
            </div>
          </template>

          <template v-else-if="activeSection === 'etcd'">
            <div v-if="effectiveShowEventsLink" class="prometheus-dashboard__overview-actions">
              <ElLink
                type="primary"
                underline="never"
                class="prometheus-dashboard__overview-actions__link"
                @click="emit('events-click')"
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
                @time-range-select="emit('time-range-select', $event)"
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
                @time-range-select="emit('time-range-select', $event)"
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
                @time-range-select="emit('time-range-select', $event)"
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
                @time-range-select="emit('time-range-select', $event)"
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
                @time-range-select="emit('time-range-select', $event)"
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
                @time-range-select="emit('time-range-select', $event)"
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
            :show-events-link="effectiveShowEventsLink"
            @events-click="emit('events-click')"
            @time-range-select="emit('time-range-select', $event)"
            @item-click="emit('item-click', $event)"
            @node-select="openNodeDetail"
          />

          <div
            v-else
            class="prometheus-dashboard__panel-grid"
            :class="{
              'prometheus-dashboard__panel-grid--inset':
                activeSection === 'network' || activeSection === 'storage'
            }"
          >
            <DashboardPanel
              v-for="panel in currentPanels"
              :key="panel.id"
              :panel="panel"
              :result="resultMap[panel.id]"
              :loading="queryLoading"
              :show-legend="showLegend"
              overview-line
              @time-range-select="emit('time-range-select', $event)"
              @item-click="emit('item-click', $event)"
            />
          </div>
        </template>

        <NodeDetailDrawer
          v-model="nodeDetailVisible"
          :row="selectedNodeRow"
          :definition="definition"
          :datasource="datasource"
          :time-range="timeRange"
          :granularity="granularity"
        />
</template>

<script setup lang="ts">
  import {
    Bell,
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
  import { computed, ref } from 'vue'
  import type { DashboardDefinition, DashboardPanelResult } from '@/api/dashboard'
  import type { DatasourceItem } from '@/api/datasource'
  import type { MetricsTimeRange } from '@/utils/metrics/time-range'
  import type { MetricsAutoRefreshOption } from '@/utils/metrics/auto-refresh'
  import type { MetricsGranularityOption } from '@/utils/metrics/granularity'
  import PrometheusEmbedLayout from '@/views/container/cluster-detail/prometheus/embed/PrometheusEmbedLayout.vue'
  import NodeDetailDrawer from '@/views/container/cluster-detail/prometheus/embed/NodeDetailDrawer.vue'
  import type { NodeOverviewRow } from '@/views/container/cluster-detail/prometheus/embed/NodeOverviewTable.vue'
  import { buildEmbedPageView } from '@/views/container/cluster-detail/prometheus/embed/embed-views'
  import {
    evaluateLatencyLevel,
    isLatencyReliable,
    resolveEmbedPanels
  } from '@/views/container/cluster-detail/prometheus/embed/utils'
  import DashboardPanel from '@/views/safeguard/dashboard/modules/DashboardPanel.vue'
  import ApiserverMetricCard from '@/views/container/cluster-detail/prometheus/embed/apiserver-metric-card.vue'
  import ClusterMonitorOverview from '@/views/container/cluster/modules/cluster-monitor-overview.vue'

  defineOptions({ name: 'PrometheusDashboardBody' })

  const props = withDefaults(
    defineProps<{
      definition: DashboardDefinition
      resultMap: Record<string, DashboardPanelResult>
      activeSection: string
      queryLoading: boolean
      showLegend: boolean
      timeRange: MetricsTimeRange
      granularity: MetricsGranularityOption
      autoRefresh: MetricsAutoRefreshOption
      clusterName?: string
      /** 外部监控大盘传入已选数据源，供集群概览直连查询 */
      datasource?: DatasourceItem | null
      showEventsLink?: boolean
    }>(),
    {
      clusterName: '',
      datasource: null,
      queryLoading: false,
      showLegend: true
    }
  )

  const emit = defineEmits<{
    'update:timeRange': [value: MetricsTimeRange]
    'update:granularity': [value: MetricsGranularityOption]
    'update:autoRefresh': [value: MetricsAutoRefreshOption]
    'time-range-select': [range: { start: number; end: number }]
    'item-click': [payload: { panelId: string; name: string }]
    'events-click': []
  }>()

  const effectiveShowEventsLink = computed(() =>
    props.showEventsLink === undefined ? Boolean(props.clusterName) : props.showEventsLink
  )

  const nodeDetailVisible = ref(false)
  const selectedNodeRow = ref<NodeOverviewRow | null>(null)

  function openNodeDetail(row: NodeOverviewRow) {
    selectedNodeRow.value = row
    nodeDetailVisible.value = true
  }

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

  const currentPanels = computed(() =>
    props.definition.panels.filter((panel) => panel.section === props.activeSection)
  )

  const embedPageView = computed(() => {
    if (!EMBED_LAYOUT_SECTIONS.has(props.activeSection)) return null
    return buildEmbedPageView(props.activeSection, props.resultMap)
  })

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
    const podsResult = props.resultMap['namespace.pods']
    const cpuResult = props.resultMap['namespace.cpu']
    const memoryResult = props.resultMap['namespace.memory']
    const restartResult = props.resultMap['namespace.restarts']
    const cpuRequestRatioResult = props.resultMap['namespace.cpu_request_ratio']
    const memoryRequestRatioResult = props.resultMap['namespace.memory_request_ratio']

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

  function resolvePanels(ids: string[]) {
    return resolveEmbedPanels(props.definition, ids)
  }

  const namespaceTopPanels = computed(() =>
    resolvePanels(['namespace.cpu', 'namespace.memory', 'namespace.pods'])
  )

  const namespaceTrendPanels = computed(() =>
    resolvePanels(['namespace.cpu_trend', 'namespace.memory_trend'])
  )

  const corednsRequestPanels = computed(() =>
    resolvePanels(['coredns.embed.requests_total', 'coredns.embed.requests_by_type'])
  )
  const corednsResponsePanels = computed(() =>
    resolvePanels(['coredns.embed.success_rate', 'coredns.embed.rcodes'])
  )
  const corednsLatencyPanel = computed(
    () => props.definition.panels.find((panel) => panel.id === 'coredns.embed.latency')
  )
  const corednsCachePanels = computed(() =>
    resolvePanels(['coredns.embed.cache_hitrate', 'coredns.embed.cache_hits_misses'])
  )
  const corednsProcessPanel = computed(
    () => props.definition.panels.find((panel) => panel.id === 'coredns.embed.process')
  )
  const corednsStatusPanel = computed(
    () => props.definition.panels.find((panel) => panel.id === 'coredns.embed.instance_status')
  )
  const corednsInstanceCpuPanel = computed(
    () => props.definition.panels.find((panel) => panel.id === 'coredns.embed.instance_cpu')
  )
  const corednsInstanceMemoryPanel = computed(
    () => props.definition.panels.find((panel) => panel.id === 'coredns.embed.instance_memory')
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
    const qpsResult = props.resultMap['coredns.embed.pod_qps']
    const latencyResult = props.resultMap['coredns.embed.pod_latency']
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
    const result = props.resultMap[panelId]
    if (result?.status !== 'success') return null
    const value = Number(result.series?.[0]?.values?.at(-1)?.value)
    return Number.isFinite(value) ? value : null
  }

  function corednsEmbedQuantile(panelId: string, quantile: number): number | null {
    const result = props.resultMap[panelId]
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
    const panicResult = props.resultMap['coredns.embed.panics']
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

    if (props.queryLoading && !hasMetrics) {
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
        status: 'healthy' as CorednsHealthStatus,
        title: 'CoreDNS 运行正常',
        description:
          replicaCount > 0
            ? '当前负载较低，未发现解析失败或 Panic。'
            : '当前负载较低，未发现可用性异常。',
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

    const latencyLevel = evaluateLatencyLevel(p99Latency)
    if (hasDnsTraffic && latencyLevel === 'danger') {
      markDanger()
      issues.push(`P99 解析延迟 ${p99Latency!.toFixed(0)} ms，响应偏慢`)
    } else if (hasDnsTraffic && latencyLevel === 'warning') {
      markWarning()
      issues.push(`P99 解析延迟 ${p99Latency!.toFixed(0)} ms，略高于正常水平`)
    } else if (hasDnsTraffic && latencyLevel === 'unreliable') {
      // 顶桶干扰：不计入异常，避免新集群误报
    }

    // 新集群冷缓存常见：低命中只告警，不直接判异常
    if (hasDnsTraffic && cacheHitRate !== null && cacheHitRate < 30) {
      markWarning()
      issues.push(`缓存命中率 ${cacheHitRate.toFixed(1)}%，新集群冷缓存或 TTL 偏低`)
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
            : !isLatencyReliable(p99Latency)
              ? '延迟口径受顶桶干扰，仅供参考'
              : p99Latency <= 1000
                ? '尾延迟处于正常范围'
                : '解析响应偏慢',
        danger: hasDnsTraffic && evaluateLatencyLevel(p99Latency) === 'danger',
        warning: hasDnsTraffic && evaluateLatencyLevel(p99Latency) === 'warning'
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
                : '缓存命中偏低（新集群常见）',
        danger: false,
        warning: hasDnsTraffic && cacheHitRate !== null && cacheHitRate < 60
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
    resolvePanels([
      'etcd.embed.leader_changes',
      'etcd.embed.proposals',
      'etcd.embed.has_leader'
    ])
  )
  const etcdRequestPanels = computed(() =>
    resolvePanels([
      'etcd.embed.requests_total',
      'etcd.embed.requests_by_method',
      'etcd.embed.error_rate'
    ])
  )
  const etcdLatencyPanel = computed(() =>
    props.definition.panels.find((panel) => panel.id === 'etcd.embed.latency')
  )
  const etcdStoragePanels = computed(() =>
    resolvePanels([
      'etcd.embed.wal_fsync',
      'etcd.embed.backend_commit',
      'etcd.embed.db_size',
      'etcd.embed.kv_count',
      'etcd.embed.quota_usage'
    ])
  )
  const etcdResourcePanels = computed(() =>
    resolvePanels(['etcd.embed.memory', 'etcd.embed.cpu'])
  )

  function etcdEmbedStat(panelId: string): number | null {
    const result = props.resultMap[panelId]
    if (result?.status !== 'success') return null
    const value = Number(result.series?.[0]?.values?.at(-1)?.value)
    return Number.isFinite(value) ? value : null
  }

  function etcdEmbedQuantile(panelId: string, quantile: number): number | null {
    const result = props.resultMap[panelId]
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
    const leaderResult = props.resultMap['etcd.embed.member_leader']
    const dbResult = props.resultMap['etcd.embed.member_db_size']
    const memResult = props.resultMap['etcd.embed.member_memory']
    const qpsResult = props.resultMap['etcd.embed.member_qps']
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
    const leaderChangesResult = props.resultMap['etcd.embed.leader_changes']
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
    if (props.queryLoading && !hasMetrics) {
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
    const cpuMap = namespaceSeriesValueMap(props.resultMap['namespace.cpu'])
    const memoryMap = namespaceSeriesValueMap(props.resultMap['namespace.memory'])
    const restartMap = namespaceSeriesValueMap(props.resultMap['namespace.restarts'])
    const podMap = namespaceSeriesValueMap(props.resultMap['namespace.pods'])
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

</script>

<style scoped lang="scss">
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

  /* 与 apiserver embed 卡片左右留白、折线高度一致 */
  .prometheus-dashboard__panel-grid--inset {
    margin: 0 16px 12px;

    :deep(.dashboard-panel.is-line) {
      height: 260px;
    }

    :deep(.dashboard-panel.is-bar),
    :deep(.dashboard-panel.is-status) {
      height: 260px;
    }
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

  .prometheus-dashboard__panel-grid--coredns .apiserver-metric-card {
    grid-column: span 6;
    height: 260px;
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
  }

</style>

<template>
  <div class="prometheus-embed-page">
    <div v-if="showEventsLink" class="prometheus-dashboard__overview-actions">
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

    <div v-if="view.showPodFilters" class="prometheus-embed-page__filters">
      <span class="prometheus-embed-page__filters-label">Namespace</span>
      <ElSelect
        :model-value="podFilters.namespace || undefined"
        class="prometheus-embed-page__filters-select"
        clearable
        filterable
        placeholder="全部 Namespace"
        :loading="podFilterOptionsLoading"
        @update:model-value="onFilterChange('namespace', $event)"
      >
        <ElOption
          v-for="item in podFilterOptions.namespaces"
          :key="item"
          :label="item"
          :value="item"
        />
      </ElSelect>

      <span class="prometheus-embed-page__filters-label">Node</span>
      <ElSelect
        :model-value="podFilters.node || undefined"
        class="prometheus-embed-page__filters-select"
        clearable
        filterable
        placeholder="全部 Node"
        :loading="podFilterOptionsLoading"
        @update:model-value="onFilterChange('node', $event)"
      >
        <ElOption
          v-for="item in podFilterOptions.nodes"
          :key="item"
          :label="item"
          :value="item"
        />
      </ElSelect>

      <span class="prometheus-embed-page__filters-label">工作负载</span>
      <ElSelect
        :model-value="workloadSelectValue || undefined"
        class="prometheus-embed-page__filters-select prometheus-embed-page__filters-select--wide"
        clearable
        filterable
        placeholder="全部工作负载"
        :loading="podFilterOptionsLoading"
        @update:model-value="onWorkloadChange"
      >
        <ElOption
          v-for="item in podFilterOptions.workloads"
          :key="`${item.kind}/${item.name}`"
          :label="`${item.kind}/${item.name}`"
          :value="`${item.kind}::${item.name}`"
        />
      </ElSelect>

      <span class="prometheus-embed-page__filters-label">Pod</span>
      <ElSelect
        :model-value="podFilters.pod || undefined"
        class="prometheus-embed-page__filters-select prometheus-embed-page__filters-select--wide"
        clearable
        filterable
        placeholder="全部 Pod"
        :loading="podFilterOptionsLoading"
        @update:model-value="onFilterChange('pod', $event)"
      >
        <ElOption
          v-for="item in podFilterOptions.pods"
          :key="item"
          :label="item"
          :value="item"
        />
      </ElSelect>
    </div>

    <div class="prometheus-dashboard__coredns-summary">
      <div class="prometheus-dashboard__summary-grid prometheus-dashboard__summary-grid--coredns">
        <div
          v-for="card in view.summaryCards"
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

    <template v-for="section in view.sections" :key="section.title">
      <div
        class="prometheus-dashboard__section-title prometheus-dashboard__section-title--spaced"
      >
        {{ section.title }}
      </div>
      <NodeOverviewTable
        v-if="section.custom === 'node-overview-table'"
        :result-map="resultMap"
        :loading="loading"
        @node-select="emit('node-select', $event)"
      />
      <NodeNetworkBoard
        v-else-if="section.custom === 'node-network-board'"
        :definition="definition"
        :result-map="resultMap"
        :loading="loading"
      />
      <div
        v-else
        class="prometheus-dashboard__panel-grid prometheus-dashboard__panel-grid--coredns"
        :class="section.gridClass"
      >
        <template v-for="panel in resolvePanels(section.panelIds)" :key="panel.id">
          <ApiserverMetricCard
            v-if="isApiserverMetricPanel(panel.id)"
            :title="panel.title"
            :unit="panel.unit ?? ''"
            :metric-label="apiserverMetricLabel(panel.id)"
            :result="resultMap[panel.id]"
          />
          <DashboardPanel
            v-else
            :panel="panel"
            :result="resultMap[panel.id]"
            :loading="loading"
            :show-legend="showLegend"
            :compact-bar="section.compactBar"
            overview-line
            @time-range-select="emit('time-range-select', $event)"
            @item-click="emit('item-click', $event)"
          />
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { Bell } from '@element-plus/icons-vue'
  import type {
    DashboardDefinition,
    DashboardPanelResult,
    DashboardWorkloadOption
  } from '@/api/dashboard'
  import DashboardPanel from '@/views/safeguard/dashboard/modules/DashboardPanel.vue'
  import type { EmbedPageView } from './types'
  import { resolveEmbedPanels } from './utils'
  import ApiserverMetricCard from './apiserver-metric-card.vue'
  import NodeOverviewTable from './NodeOverviewTable.vue'
  import NodeNetworkBoard from './NodeNetworkBoard.vue'
  import type { NodeOverviewRow } from './NodeOverviewTable.vue'

  export type PodMonitorFilters = {
    namespace?: string
    node?: string
    workload_kind?: string
    workload_name?: string
    pod?: string
  }

  export type PodFilterOptions = {
    namespaces: string[]
    nodes: string[]
    workloads: DashboardWorkloadOption[]
    pods: string[]
  }

  /** API Server 各图表面板的顶部指标图例标签（quota/verb/code）；进程内存为单指标（undefined） */
  const APISERVER_METRIC_LABEL: Record<string, string | undefined> = {
    'apiserver.embed.instance_cpu': 'quota',
    'apiserver.embed.instance_memory': 'quota',
    'apiserver.embed.requests': 'verb',
    'apiserver.embed.requests_by_code': 'code',
    'apiserver.embed.requests_3xx': 'code',
    'apiserver.embed.requests_4xx': 'code',
    'apiserver.embed.errors': 'code',
    'apiserver.embed.latency': 'quantile',
    'apiserver.embed.process': undefined,
    'controller.embed.instance_cpu': 'quota',
    'controller.embed.instance_memory': 'quota',
    'scheduler.embed.instance_cpu': 'quota',
    'scheduler.embed.instance_memory': 'quota',
    'kubelet.embed.instance_cpu': 'quota',
    'kubelet.embed.instance_memory': 'quota',
    'controller.embed.requests': 'method',
    'controller.embed.requests_by_code': 'code',
    'controller.embed.requests_3xx': 'code',
    'controller.embed.requests_4xx': 'code',
    'controller.embed.requests_5xx': 'code',
    'scheduler.embed.attempts_trend': undefined,
    'scheduler.embed.scheduled_rate': undefined,
    'scheduler.embed.latency_trend': 'quantile',
    'scheduler.embed.pending_pods': undefined,
    'scheduler.embed.incoming_pods': undefined
  }

  function isApiserverMetricPanel(id: string): boolean {
    return id in APISERVER_METRIC_LABEL
  }

  function apiserverMetricLabel(id: string): string | undefined {
    return APISERVER_METRIC_LABEL[id]
  }

  const props = withDefaults(
    defineProps<{
      view: EmbedPageView
      definition: DashboardDefinition
      resultMap: Record<string, DashboardPanelResult>
      loading?: boolean
      showLegend?: boolean
      showEventsLink?: boolean
      podFilters?: PodMonitorFilters
      podFilterOptions?: PodFilterOptions
      podFilterOptionsLoading?: boolean
    }>(),
    {
      loading: false,
      showLegend: true,
      showEventsLink: true,
      podFilters: () => ({}),
      podFilterOptions: () => ({
        namespaces: [],
        nodes: [],
        workloads: [],
        pods: []
      }),
      podFilterOptionsLoading: false
    }
  )

  const emit = defineEmits<{
    'events-click': []
    'time-range-select': [range: { start: number; end: number }]
    'item-click': [payload: { panelId: string; name: string }]
    'node-select': [row: NodeOverviewRow]
    'pod-filters-change': [value: PodMonitorFilters]
  }>()

  const workloadSelectValue = computed(() => {
    const kind = props.podFilters.workload_kind?.trim()
    const name = props.podFilters.workload_name?.trim()
    if (!kind || !name) return ''
    return `${kind}::${name}`
  })

  function onFilterChange(key: 'namespace' | 'node' | 'pod', raw: string | null | undefined) {
    const value = (raw || '').trim()
    const next: PodMonitorFilters = { ...props.podFilters }

    if (key === 'namespace') {
      next.namespace = value || undefined
      next.workload_kind = undefined
      next.workload_name = undefined
      next.pod = undefined
    } else if (key === 'node') {
      next.node = value || undefined
      next.pod = undefined
    } else {
      next.pod = value || undefined
    }

    emit('pod-filters-change', next)
  }

  function onWorkloadChange(raw: string | null | undefined) {
    const value = (raw || '').trim()
    const next: PodMonitorFilters = { ...props.podFilters }
    if (!value) {
      next.workload_kind = undefined
      next.workload_name = undefined
    } else {
      const sep = value.indexOf('::')
      if (sep > 0) {
        next.workload_kind = value.slice(0, sep)
        next.workload_name = value.slice(sep + 2)
      }
    }
    next.pod = undefined
    emit('pod-filters-change', next)
  }

  function resolvePanels(panelIds: string[]) {
    return resolveEmbedPanels(props.definition, panelIds)
  }
</script>

<style lang="scss" scoped>
  @use './embed-layout.scss';
</style>

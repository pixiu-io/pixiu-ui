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
      <div
        v-if="isInstanceResourceSection(section)"
        class="prometheus-dashboard__panel-grid prometheus-dashboard__panel-grid--instance-resource"
      >
        <InstanceResourceCard
          title="实例 CPU"
          unit="cores"
          :result="resultMap['apiserver.embed.instance_cpu']"
        />
        <InstanceResourceCard
          title="实例内存"
          unit="bytes"
          :result="resultMap['apiserver.embed.instance_memory']"
        />
      </div>
      <div
        v-else
        class="prometheus-dashboard__panel-grid prometheus-dashboard__panel-grid--coredns"
        :class="section.gridClass"
      >
        <DashboardPanel
          v-for="panel in resolvePanels(section.panelIds)"
          :key="panel.id"
          :panel="panel"
          :result="resultMap[panel.id]"
          :loading="loading"
          :show-legend="showLegend"
          :compact-bar="section.compactBar"
          overview-line
          @time-range-select="emit('time-range-select', $event)"
          @item-click="emit('item-click', $event)"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { Bell } from '@element-plus/icons-vue'
  import type { DashboardDefinition, DashboardPanelResult } from '@/api/dashboard'
  import DashboardPanel from '@/views/safeguard/dashboard/modules/DashboardPanel.vue'
  import type { EmbedChartSection, EmbedPageView } from './types'
  import { resolveEmbedPanels } from './utils'
  import InstanceResourceCard from './instance-resource-card.vue'

  const props = withDefaults(
    defineProps<{
      view: EmbedPageView
      definition: DashboardDefinition
      resultMap: Record<string, DashboardPanelResult>
      loading?: boolean
      showLegend?: boolean
      showEventsLink?: boolean
    }>(),
    {
      loading: false,
      showLegend: true,
      showEventsLink: true
    }
  )

  const emit = defineEmits<{
    'events-click': []
    'time-range-select': [range: { start: number; end: number }]
    'item-click': [payload: { panelId: string; name: string }]
  }>()

  function resolvePanels(panelIds: string[]) {
    return resolveEmbedPanels(props.definition, panelIds)
  }

  /** 实例资源 section：使用自定义资源卡（维度切换 + 实例标识）渲染 */
  function isInstanceResourceSection(section: EmbedChartSection): boolean {
    return section.panelIds.includes('apiserver.embed.instance_cpu')
  }
</script>

<style lang="scss" scoped>
  @use './embed-layout.scss';
</style>

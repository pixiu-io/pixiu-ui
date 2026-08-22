<template>
  <div class="workbench">
    <!-- 顶部主栏 + 右侧快捷操作 -->
    <div class="workbench__page-grid">
      <div class="workbench__banner art-card">
        <div class="workbench__banner-text">
          <p class="workbench__banner-greeting">{{ greetingText }} 👋</p>
          <p class="workbench__banner-desc">{{ welcomeDesc }}</p>
        </div>
        <img class="workbench__banner-img" :src="bannerCover" alt="" loading="lazy" />
      </div>

      <div class="workbench__quick art-card">
        <div class="workbench__quick-title">快捷操作</div>
        <div class="workbench__quick-grid">
          <button
            v-for="item in quickActions"
            :key="item.key"
            type="button"
            class="workbench__quick-item"
            @click="goQuickAction(item)"
          >
            <span class="workbench__quick-icon">
              <ArtSvgIcon :icon="item.icon" />
            </span>
            <span class="workbench__quick-label">{{ item.label }}</span>
          </button>
        </div>
      </div>

      <div class="workbench__metrics-row">
        <div
          v-for="card in heroCards"
          :key="card.key"
          class="workbench__metric-card art-card"
          :class="{
            'is-compact': card.compact,
            'is-warning': card.warning,
            'is-danger': card.danger
          }"
        >
          <span class="workbench__metric-label">{{ card.title }}</span>
          <ArtCountTo
            class="workbench__metric-value"
            :class="{ 'is-warning': card.warning, 'is-danger': card.danger }"
            :target="card.numTarget"
            :duration="900"
          />
          <div class="workbench__metric-trend">
            较昨日 <span :class="card.trendClass">{{ card.sub }}</span>
          </div>
          <div class="workbench__metric-icon" :style="{ color: card.iconColor, background: card.iconBg }">
            <ElIcon :size="card.compact ? 16 : 20"><component :is="card.icon" /></ElIcon>
          </div>
        </div>
      </div>

      <div class="workbench__insight-grid">
        <div class="workbench__panel workbench__panel--chart workbench__panel--insight">
          <div class="workbench__panel-head workbench__panel-head--split">
            <div>
              <div class="workbench__panel-title">资源趋势</div>
              <div class="workbench__panel-sub">近 {{ trendRangeDays }} 天 · 平台 CPU / 内存均值</div>
            </div>
            <ElRadioGroup
              :model-value="trendRangeDays"
              class="sc-radio-group sc-radio-group--fit workbench__trend-range"
              @update:model-value="onTrendRangeChange"
            >
              <ElRadioButton :value="7">近7天</ElRadioButton>
              <ElRadioButton :value="30">近30天</ElRadioButton>
            </ElRadioGroup>
          </div>
          <div class="workbench__chart-body" v-loading="trendLoading">
            <MetricChartPanel
              title="资源趋势"
              :data="trendChartData"
              :x-axis-data="cpuTrendLabels"
              :is-empty="!cpuTrendValues.length && !memoryTrendValues.length"
              height="160px"
              :axis-font-size="10"
              :show-legend="false"
              hide-maximize
              plain
            />
          </div>
        </div>

        <WorkbenchResourcePanel
          class="workbench__panel workbench__panel--resource workbench__panel--insight"
          :trend-loading="trendLoading"
          :summary="resourceSummary"
          :last-updated-at="lastUpdatedAt"
          :cpu-trend-values="cpuTrendValues"
          :memory-trend-values="memoryTrendValues"
          :disk-trend-values="diskTrendValues"
          :network-trend-labels="networkTrendLabels"
          :network-trend-values="networkTrendValues"
          :network-tx-trend-values="networkTxTrendValues"
          :network-rx-trend-values="networkRxTrendValues"
          @view-detail="goViewAllResources"
        />
      </div>

      <div class="workbench__panel workbench__panel--timeline">
        <div class="workbench__panel-head workbench__panel-head--split workbench__panel-head--split-single">
          <div class="workbench__panel-title">最近动态</div>
          <button type="button" class="workbench__view-all" @click="goViewAllActivities">
            查看全部
            <ElIcon :size="12"><ArrowRight /></ElIcon>
          </button>
        </div>
        <div v-if="timelineItems.length" class="workbench__timeline">
          <div v-for="item in timelineItems" :key="item.key" class="workbench__timeline-item">
            <span class="workbench__timeline-dot" :class="`is-${item.level}`" />
            <div class="workbench__timeline-body">
              <p class="workbench__timeline-text">{{ item.text }}</p>
            </div>
          </div>
        </div>
        <div v-else class="workbench__empty">暂无动态</div>
      </div>
    </div>

    <!-- 底部：集群列表 + 健康分布 -->
    <div class="workbench__bottom-grid">
      <div class="workbench__panel workbench__panel--table">
        <div class="workbench__panel-head workbench__panel-head--split workbench__panel-head--split-single">
          <div class="workbench__panel-title">集群列表</div>
          <button type="button" class="workbench__view-all" @click="goViewAllClusters">
            查看全部
            <ElIcon :size="12"><ArrowRight /></ElIcon>
          </button>
        </div>
        <WorkbenchClusterTable
          :rows="clusterRows"
          :loading="loading"
          @cluster-enter="goClusterOverview"
          @cluster-monitor="goClusterMonitor"
        />
      </div>

      <div class="workbench__panel workbench__panel--category">
        <div class="workbench__panel-head workbench__panel-head--split workbench__panel-head--split-single">
          <div class="workbench__panel-title">集群类别</div>
          <button type="button" class="workbench__view-all" @click="goViewAllClusters">
            查看全部
            <ElIcon :size="12"><ArrowRight /></ElIcon>
          </button>
        </div>
        <div class="workbench__category-body">
          <div class="workbench__category-chart">
            <ArtRingChart
              height="100px"
              :data="categoryRingData"
              :colors="categoryRingColors"
              :radius="['55%', '85%']"
              :border-radius="7"
              :center-text="categoryCenterText"
              :center-text-font-size="16"
              :show-label="false"
            />
          </div>
          <ul class="workbench__category-stats">
            <li v-for="item in categoryStats" :key="item.label">
              <span class="workbench__category-dot" :style="{ background: item.color }" />
              <span>{{ item.label }}</span>
              <strong>
                {{ item.value }}
                <span class="workbench__category-pct">（{{ item.percent }}%）</span>
              </strong>
            </li>
          </ul>
        </div>
      </div>

      <div class="workbench__panel workbench__panel--category workbench__panel--datasource">
        <div class="workbench__panel-head workbench__panel-head--split workbench__panel-head--split-single">
          <div class="workbench__panel-title">数据源</div>
          <button type="button" class="workbench__view-all" @click="goViewAllDatasources">
            查看全部
            <ElIcon :size="12"><ArrowRight /></ElIcon>
          </button>
        </div>
        <div class="workbench__category-body" v-loading="datasourceLoading">
          <template v-if="datasourceRingData.length">
            <div class="workbench__category-chart">
              <ArtRingChart
                height="100px"
                :data="datasourceRingData"
                :colors="datasourceRingColors"
                :radius="['55%', '85%']"
                :border-radius="7"
                :center-text="datasourceCenterText"
                :center-text-font-size="16"
                :show-label="false"
              />
            </div>
            <ul class="workbench__category-stats">
              <li v-for="item in datasourceStats" :key="item.label">
                <span class="workbench__category-dot" :style="{ background: item.color }" />
                <span>{{ item.label }}</span>
                <strong>
                  {{ item.value }}
                  <span class="workbench__category-pct">（{{ item.percent }}%）</span>
                </strong>
              </li>
            </ul>
          </template>
          <div v-else-if="!datasourceLoading" class="workbench__empty workbench__empty--center">
            暂无数据源
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ArrowRight, Box, CircleCheck, Grid, Warning } from '@element-plus/icons-vue'
  import { computed, type Component } from 'vue'
  import { useRouter } from 'vue-router'
  import ArtCountTo from '@/components/core/text-effect/art-count-to/index.vue'
  import ArtRingChart from '@/components/core/charts/art-ring-chart/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import MetricChartPanel from '@/components/container/metric-chart-panel.vue'
  import WorkbenchClusterTable from './WorkbenchClusterTable.vue'
  import WorkbenchResourcePanel from './WorkbenchResourcePanel.vue'
  import bannerCover from '@imgs/login/lf_icon2.webp'
  import { fetchGetCluster, PixiuApiError } from '@/api/container'
  import { useUserStore } from '@/store/modules/user'
  import { setClusterAliasCache } from '@/utils/navigation/cluster-query'
  import { notifyError } from '@/utils/sys/notify'
  import { getCssVar } from '@/utils/ui'
  import {
    dayOverDayTrendClass,
    formatDayOverDayDelta,
    type WorkbenchActivityItem,
    type WorkbenchClusterRow,
    type WorkbenchResourceSummary,
    type WorkbenchRiskRow,
    type WorkbenchSummaryDeltas
  } from '../useWorkbenchPage'

  type QuickAction = {
    key: string
    label: string
    icon: string
    path: string
  }

  type HeroCard = {
    key: string
    title: string
    icon: Component
    iconColor: string
    iconBg: string
    numTarget: number
    sub: string
    trendClass?: string
    warning?: boolean
    danger?: boolean
    compact?: boolean
  }

  type SummarySnapshot = {
    totalClusters: number
    healthyClusters: number
    abnormalClusters: number
    nodeReady: number
    nodeNotReady: number
    nodeTotal: number
    runningPods: number
    cpuAvg: number | null
    memAvg: number | null
    diskAvg: number | null
    activeAlerts: number
    highAlerts: number
    warnAlerts: number
    deltas: WorkbenchSummaryDeltas
  }

  const props = defineProps<{
    loading: boolean
    datasourceLoading: boolean
    datasourceRingData: Array<{ name: string; value: number }>
    trendLoading: boolean
    trendRangeDays: 7 | 30
    summary: SummarySnapshot
    resourceSummary: WorkbenchResourceSummary
    lastUpdatedAt: number | null
    clusterRows: WorkbenchClusterRow[]
    riskRows: WorkbenchRiskRow[]
    alertFeed: WorkbenchActivityItem[]
    eventFeed: WorkbenchActivityItem[]
    cpuTrendLabels: string[]
    cpuTrendValues: number[]
    memoryTrendLabels: string[]
    memoryTrendValues: number[]
    networkTrendLabels: string[]
    networkTrendValues: number[]
    networkTxTrendValues: number[]
    networkRxTrendValues: number[]
    diskTrendValues: number[]
  }>()

  const emit = defineEmits<{
    'update:trendRangeDays': [days: 7 | 30]
  }>()

  function onTrendRangeChange(value: string | number | boolean | undefined) {
    const days = Number(value)
    if (days === 7 || days === 30) emit('update:trendRangeDays', days)
  }

  const router = useRouter()
  const userStore = useUserStore()

  const greetingText = computed(() => {
    const name = userStore.getUserInfo.userName || '管理员'
    return `你好，${name}`
  })

  const welcomeDesc = computed(() => '欢迎回来！今天又是高效管理集群的一天！')

  const quickActions: QuickAction[] = [
    { key: 'cluster', label: '集群管理', icon: 'ri:cloudy-2-line', path: '/container/cluster' },
    { key: 'monitor', label: '监控大盘', icon: 'ri:bar-chart-grouped-line', path: '/monitor/dashboard' },
    { key: 'alert', label: '告警配置', icon: 'ri:alarm-line', path: '/monitor/alert-config' },
    { key: 'logs', label: '执行日志', icon: 'ri:file-text-line', path: '/monitor/logs' },
    { key: 'middleware', label: '中间件', icon: 'ri:stack-line', path: '/middleware/elasticsearch' }
  ]

  function goQuickAction(item: QuickAction) {
    router.push(item.path)
  }

  function goViewAllActivities() {
    router.push('/container/cluster')
  }

  function goViewAllClusters() {
    router.push('/container/cluster')
  }

  function goViewAllDatasources() {
    router.push('/monitor/datasource')
  }

  function goViewAllResources() {
    router.push('/monitor/dashboard')
  }

  const heroCards = computed<HeroCard[]>(() => {
    const s = props.summary
    const d = s.deltas
    return [
      {
        key: 'clusters',
        title: '集群总数',
        icon: Grid,
        iconColor: '#7c6af0',
        iconBg: 'rgba(124, 106, 240, 0.12)',
        numTarget: s.totalClusters,
        sub: formatDayOverDayDelta(d.totalClusters),
        trendClass: dayOverDayTrendClass(d.totalClusters),
        compact: true
      },
      {
        key: 'nodes',
        title: '节点总数',
        icon: Box,
        iconColor: '#409eff',
        iconBg: 'rgba(64, 158, 255, 0.12)',
        numTarget: s.nodeTotal,
        sub: formatDayOverDayDelta(d.nodeTotal),
        trendClass: dayOverDayTrendClass(d.nodeTotal),
        warning: s.nodeNotReady > 0,
        compact: true
      },
      {
        key: 'pods',
        title: '运行 Pod',
        icon: CircleCheck,
        iconColor: '#67c23a',
        iconBg: 'rgba(103, 194, 58, 0.12)',
        numTarget: s.runningPods,
        sub: formatDayOverDayDelta(d.runningPods),
        trendClass: dayOverDayTrendClass(d.runningPods),
        compact: true
      },
      {
        key: 'alerts',
        title: '活跃告警',
        icon: Warning,
        iconColor: '#f56c6c',
        iconBg: 'rgba(245, 108, 108, 0.12)',
        numTarget: s.activeAlerts,
        sub: formatDayOverDayDelta(d.activeAlerts),
        trendClass: dayOverDayTrendClass(d.activeAlerts),
        compact: true
      }
    ]
  })

  const trendChartData = computed(() => [
    { name: 'CPU 使用率', data: props.cpuTrendValues },
    { name: '内存使用率', data: props.memoryTrendValues.length ? props.memoryTrendValues : props.cpuTrendValues.map(() => 0) }
  ])

  const categoryRingData = computed(() => {
    const standard = props.clusterRows.filter((row) => Number(row.clusterType) !== 1).length
    const selfBuilt = props.clusterRows.filter((row) => Number(row.clusterType) === 1).length
    return [
      { name: '标准', value: standard },
      { name: '自建', value: selfBuilt }
    ]
  })

  const categoryCenterText = computed(() =>
    String(categoryRingData.value.reduce((sum, item) => sum + (Number(item.value) || 0), 0))
  )

  const categoryRingColors = computed(() => [
    getCssVar('--el-color-primary-light-1'),
    '#4ABEFF'
  ])

  const DATASOURCE_RING_PALETTE = [
    '--el-color-primary-light-1',
    '#4ABEFF',
    '#14DEBA',
    '#FFAF20',
    '#FA8A6C'
  ] as const

  const datasourceRingColors = computed(() =>
    props.datasourceRingData.map((_, index) => {
      const token = DATASOURCE_RING_PALETTE[index % DATASOURCE_RING_PALETTE.length]
      return token.startsWith('#') ? token : getCssVar(token)
    })
  )

  const datasourceCenterText = computed(() =>
    String(props.datasourceRingData.reduce((sum, item) => sum + (Number(item.value) || 0), 0))
  )

  function buildRingStats(
    data: { name: string; value: number }[],
    colors: string[]
  ): Array<{ label: string; value: number; percent: number; color: string }> {
    const total = data.reduce((sum, item) => sum + item.value, 0) || 1
    return data.map((item, index) => ({
      label: item.name,
      value: item.value,
      percent: Math.round((item.value / total) * 100),
      color: colors[index] ?? getCssVar('--el-color-primary')
    }))
  }

  const categoryStats = computed(() => buildRingStats(categoryRingData.value, categoryRingColors.value))

  const datasourceStats = computed(() =>
    buildRingStats(props.datasourceRingData, datasourceRingColors.value)
  )

  const timelineItems = computed(() => {
    const merged = [...props.alertFeed, ...props.eventFeed]
    const seen = new Set<string>()
    return merged.filter((item) => {
      if (seen.has(item.key)) return false
      seen.add(item.key)
      return true
    }).slice(0, 8)
  })

  function clusterQuery(row: WorkbenchClusterRow) {
    const aliasName = row.aliasName || row.name
    setClusterAliasCache(row.name, aliasName)
    return { cluster: row.name, aliasName }
  }

  async function ensureClusterThen(row: WorkbenchClusterRow, navigate: () => void) {
    try {
      await fetchGetCluster(row.id)
      navigate()
    } catch (e: unknown) {
      if (e instanceof PixiuApiError && e.notified) return
      notifyError(e, '获取集群详情失败')
    }
  }

  function goClusterOverview(row: WorkbenchClusterRow) {
    if (row.status !== 0) return
    void ensureClusterThen(row, () => {
      router.push({ path: '/container/overview', query: clusterQuery(row) })
    })
  }

  function goClusterMonitor(row: WorkbenchClusterRow) {
    if (row.status !== 0) return
    void ensureClusterThen(row, () => {
      router.push({ path: '/container/prometheus', query: clusterQuery(row) })
    })
  }
</script>

<style scoped lang="scss">
  .workbench {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding-top: 4px;
  }

  .workbench__section-title {
    margin: 0 0 12px;
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .workbench__section-title--spaced {
    margin-top: 8px;
  }

  .workbench__page-grid {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(260px, 1fr);
    grid-template-rows: auto auto auto;
    gap: 12px;
    align-items: stretch;
    margin-bottom: 20px;
  }

  .workbench__banner {
    grid-column: 1;
    grid-row: 1;
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    max-width: 100%;
    justify-self: stretch;
    min-height: 132px;
    overflow: hidden;
    background: linear-gradient(135deg, #eef2ff 0%, #ede9fe 48%, #f5f3ff 100%);
  }

  .workbench__quick {
    grid-column: 2;
    grid-row: 1;
    width: 100%;
    max-width: 100%;
    justify-self: stretch;
    min-width: 0;
    box-sizing: border-box;
  }

  .workbench__metrics-row {
    grid-column: 1;
    grid-row: 2;
    width: 100%;
    max-width: 100%;
    justify-self: stretch;
  }

  .workbench__insight-grid {
    grid-column: 1;
    grid-row: 3;
    width: 100%;
    max-width: 100%;
    justify-self: stretch;
  }

  .workbench__panel--timeline {
    grid-column: 2;
    grid-row: 2 / 4;
    align-self: stretch;
    width: 100%;
    max-width: 100%;
    justify-self: stretch;
    min-width: 0;
    box-sizing: border-box;
  }

  .workbench__banner-text {
    position: relative;
    z-index: 1;
    flex: 1;
    min-width: 0;
    padding: 22px 24px;
  }

  .workbench__banner-greeting {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.3;
    color: var(--el-text-color-primary);
  }

  .workbench__banner-desc {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--el-text-color-secondary);
  }

  .workbench__banner-img {
    position: absolute;
    right: 12px;
    bottom: -8px;
    z-index: 0;
    width: 148px;
    height: auto;
    pointer-events: none;
    user-select: none;
  }

  .workbench__quick {
    display: flex;
    flex-shrink: 0;
    flex-direction: column;
    min-height: 132px;
    padding: 16px 14px 14px;
  }

  .workbench__quick-title {
    margin-bottom: 14px;
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .workbench__quick-grid {
    display: flex;
    flex: 1;
    gap: 8px;
    align-items: flex-start;
    justify-content: space-between;
    width: 100%;
  }

  .workbench__quick-label {
    font-size: 12px;
    line-height: 1.2;
    color: var(--el-text-color-regular);
    text-align: center;
    word-break: keep-all;
  }

  .workbench__quick-item {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    min-width: 0;
    padding: 0;
    cursor: pointer;
    background: transparent;
    border: none;
    transition: transform 0.2s ease;

    &:hover {
      transform: translateY(-1px);
    }
  }

  .workbench__quick-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    font-size: 18px;
    color: var(--el-color-primary);
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 10px;
  }

  .workbench__metrics-row {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  .workbench__metric-card {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 68px;
    padding: 14px 16px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 12px;
  }

  .workbench__metric-label {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .workbench__metric-card.is-compact {
    min-height: 60px;
    padding: 12px 14px;
  }

  .workbench__metric-card.is-compact .workbench__metric-value {
    margin-top: 4px;
    font-size: 20px;
  }

  .workbench__metric-card.is-compact .workbench__metric-trend {
    margin-top: 4px;
  }

  .workbench__metric-card.is-compact .workbench__metric-icon {
    right: 12px;
    width: 32px;
    height: 32px;
    border-radius: 10px;
  }

  .workbench__metric-value {
    margin-top: 6px;
    font-size: 26px;
    font-weight: 600;
    line-height: 1.1;
    color: var(--el-text-color-primary);
  }

  .workbench__metric-value.is-warning {
    color: #e6a23c;
  }

  .workbench__metric-value.is-danger {
    color: #f56c6c;
  }

  .workbench__metric-trend {
    margin-top: 6px;
    font-size: 12px;
    color: var(--el-text-color-secondary);

    .is-success {
      color: #67c23a;
    }

    .is-danger {
      color: #f56c6c;
    }

    .is-warning {
      color: #e6a23c;
    }
  }

  .workbench__metric-icon {
    position: absolute;
    top: 50%;
    right: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 12px;
    transform: translateY(-50%);
  }

  .workbench__insight-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
    gap: 12px;
    align-items: start;

    .workbench__panel {
      display: flex;
      flex-direction: column;
      height: auto;
      padding: 12px 14px;
    }

    .workbench__panel-head {
      flex-shrink: 0;
      margin-bottom: 8px;
    }

    .workbench__panel-sub {
      margin-top: 2px;
    }

    .workbench__chart-body {
      flex-shrink: 0;
      height: 160px;

      :deep(.metric-chart-panel) {
        height: 100%;
      }

      :deep(.metric-chart-panel > .relative) {
        height: 100% !important;
      }
    }

    .workbench__panel--resource {
      align-self: start;
      padding: 12px 14px 8px;
    }
  }

  .workbench__bottom-grid {
    display: grid;
    gap: 12px;
    margin-bottom: 20px;
    grid-template-columns: minmax(0, 1fr) 300px 300px;
  }

  .workbench__panel {
    padding: 16px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 12px;
  }

  .workbench__panel--chart {
    position: relative;
  }

  .workbench__panel--chart .workbench__panel-head--split {
    align-items: center;
    gap: 8px;

    > div:first-child {
      flex: 1;
      min-width: 0;
    }
  }

  .workbench__trend-range {
    margin-left: auto;
    width: fit-content !important;
    min-width: 0 !important;
    max-width: none;

    :deep(.el-radio-button--default .el-radio-button__inner) {
      min-width: 48px;
      min-height: 24px !important;
      height: 24px !important;
      padding: 0 8px !important;
      font-size: 10px;
      line-height: 22px !important;
    }
  }

  .workbench__panel--timeline {
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 12px 14px;
  }

  .workbench__panel--timeline .workbench__panel-head {
    flex-shrink: 0;
  }

  .workbench__panel--timeline .workbench__timeline,
  .workbench__panel--timeline .workbench__empty {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    align-content: flex-start;
  }

  .workbench__panel-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .workbench__panel-head--split {
    align-items: flex-start;
    margin-bottom: 10px;
  }

  .workbench__panel-head--split .workbench__view-all {
    margin-top: 1px;
  }

  .workbench__panel-head--split-single {
    align-items: center;
  }

  .workbench__panel-head--split-single .workbench__view-all {
    margin-top: 0;
  }

  .workbench__view-all {
    display: inline-flex;
    flex-shrink: 0;
    gap: 2px;
    align-items: center;
    padding: 0;
    font-size: 12px;
    line-height: 1;
    color: var(--el-color-primary);
    cursor: pointer;
    background: transparent;
    border: none;
    transition: opacity 0.2s ease;

    &:hover {
      opacity: 0.8;
    }
  }

  .workbench__panel-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .workbench__panel-sub {
    margin-top: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .workbench__category-body {
    display: flex;
    flex: 1;
    gap: 12px;
    align-items: center;
    min-height: 100px;
  }

  .workbench__category-chart {
    flex: 0 0 100px;
    width: 100px;
    margin-left: 8px;
  }

  .workbench__category-stats {
    flex: 1;
    min-width: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 12px;
    color: var(--el-text-color-regular);

    li {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 4px;
    }

    li:last-child {
      margin-bottom: 0;
    }

    strong {
      margin-left: auto;
      font-weight: 400;
      color: var(--el-text-color-regular);
      white-space: nowrap;
    }
  }

  .workbench__category-dot {
    flex-shrink: 0;
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .workbench__category-pct {
    margin-left: 2px;
    font-weight: 400;
    color: var(--el-text-color-secondary);
  }

  .workbench__panel--category {
    display: flex;
    flex-direction: column;
    width: 300px;
    min-width: 300px;
    max-width: 300px;
    box-sizing: border-box;
  }

  .workbench__panel--datasource {
    width: 300px;
    min-width: 300px;
    max-width: 300px;
    box-sizing: border-box;
  }

  .workbench__empty--center {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100px;
  }

  .workbench__panel--table {
    min-width: 0;
    overflow: hidden;

    :deep(.overview-table) {
      margin: 0 -4px;
    }
  }

  .workbench__timeline {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .workbench__timeline-item {
    display: flex;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 1px solid var(--el-border-color-lighter);

    &:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
  }

  .workbench__timeline-dot {
    flex-shrink: 0;
    width: 8px;
    height: 8px;
    margin-top: 6px;
    border-radius: 50%;
    background: var(--el-color-info);
  }

  .workbench__timeline-dot.is-danger {
    background: var(--el-color-danger);
  }

  .workbench__timeline-dot.is-warning {
    background: var(--el-color-warning);
  }

  .workbench__timeline-dot.is-info {
    background: var(--el-color-info);
  }

  .workbench__timeline-text {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--el-text-color-regular);
  }

  .workbench__empty {
    padding: 8px 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  @media (max-width: 1200px) {
    .workbench__page-grid,
    .workbench__bottom-grid {
      grid-template-columns: 1fr;
      grid-template-rows: auto;
    }

    .workbench__banner,
    .workbench__quick,
    .workbench__metrics-row,
    .workbench__insight-grid,
    .workbench__panel--timeline,
    .workbench__panel--table,
    .workbench__panel--category,
    .workbench__panel--datasource {
      grid-column: 1;
      grid-row: auto;
      width: 100%;
      min-width: 0;
      max-width: 100%;
      margin-left: 0;
      justify-self: stretch;
    }

    .workbench__metrics-row {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .workbench__insight-grid {
      grid-template-columns: 1fr;
      min-height: 0;
    }

    .workbench__panel--timeline {
      min-height: 200px;
    }

    .workbench__panel--timeline .workbench__timeline,
    .workbench__panel--timeline .workbench__empty {
      flex: none;
      overflow: visible;
    }

    .workbench__quick-grid {
      flex-wrap: wrap;
      justify-content: flex-start;
    }

    .workbench__quick-item {
      flex: 0 0 calc(20% - 8px);
      min-width: 72px;
    }
  }

  @media (max-width: 768px) {
    .workbench__metrics-row {
      grid-template-columns: 1fr;
    }

    .workbench__banner-img {
      display: none;
    }

    .workbench__quick-item {
      flex: 0 0 calc(33.33% - 8px);
    }
  }
</style>

<template>
  <div class="realtime-query-page art-full-height">
    <ElAlert
      v-if="alertVisible"
      type="info"
      closable
      show-icon
      class="quota-alert"
      description="支持查询内部/外部 Prometheus 数据源；外部源会自动透传认证与自定义请求头。请先选择数据源，再输入 PromQL 与时间范围进行查询。"
      @close="alertVisible = false"
    />
    <section class="rq-top-card">
      <div class="rq-rule-bar">
        <div class="rq-rule-main">
          <div class="rq-rule-left">
            <span class="rq-rule-label">指标来源</span>
            <ElSelect v-model="sourceFilter" class="rq-rule-select rq-source-select">
              <ElOption
                v-for="opt in sourceOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </ElSelect>
            <span class="rq-rule-label">数据源</span>
            <span class="rq-datasource-wrap">
              <ElSelect
                v-model="selectedDsId"
                class="rq-rule-select rq-ds-select"
                placeholder="请选择 Prometheus 数据源"
                :loading="dsLoading"
                clearable
                @change="onDsChange"
              >
                <template #label="{ value }">
                  <span v-if="value && getDatasourceById(Number(value))" class="rq-ds-option">
                    <span
                      class="rq-ds-logo"
                      :class="`is-${getDatasourceById(Number(value))?.subType}`"
                    >
                      <ArtSvgIcon
                        :icon="subTypeMeta[getDatasourceById(Number(value))!.subType].icon"
                        class="rq-ds-logo-icon"
                      />
                    </span>
                    <span class="rq-ds-option-name">
                      {{ getDatasourceById(Number(value))?.name }}
                    </span>
                  </span>
                </template>
                <ElOption
                  v-for="ds in filteredDsList"
                  :key="ds.id"
                  :label="ds.name"
                  :value="ds.id"
                >
                  <span class="rq-ds-option">
                    <span class="rq-ds-logo" :class="`is-${ds.subType}`">
                      <ArtSvgIcon :icon="subTypeMeta[ds.subType].icon" class="rq-ds-logo-icon" />
                    </span>
                    <span class="rq-ds-option-name">{{ ds.name }}</span>
                  </span>
                </ElOption>
              </ElSelect>
              <ElTag
                v-if="sourceFilter === 'internal' && selectedDatasource"
                class="rq-ds-cluster-tag"
                size="small"
                effect="light"
              >
                {{ selectedDatasource.clusterName || '-' }}
              </ElTag>
            </span>
            <ElCheckbox v-model="autocompleteEnabled" class="rq-autocomplete-toggle">
              Enable autocomplete
            </ElCheckbox>
          </div>
        </div>
      </div>

      <div class="rq-query-body">
        <div class="rq-query-toolbar">
          <div class="rq-query-toolbar-left">
            <span :class="['rq-query-tab', { 'is-active': activeQueryTab === 'promql' }]" @click="activeQueryTab = 'promql'">
              PromQL语句
            </span>
            <span :class="['rq-query-tab', { 'is-active': activeQueryTab === 'favorite' }]" @click="activeQueryTab = 'favorite'">
              收藏夹
            </span>
            <span
              :class="['rq-query-tab', { 'is-active': activeQueryTab === 'history' }]"
              @click.stop="activeQueryTab = 'history'"
            >
              历史记录
            </span>
            <span :class="['rq-query-tab', { 'is-active': activeQueryTab === 'template' }]" @click="activeQueryTab = 'template'">
              语句模板
            </span>
          </div>
          <div class="rq-query-toolbar-right">
            <ElButton text size="small" disabled>推荐仪表盘</ElButton>
            <span class="rq-hot-tag">HOT</span>
            <ElButton text size="small" disabled>告警</ElButton>
            <ElButton text size="small" disabled>采集配置</ElButton>
            <ElButton text size="small" disabled>索引配置</ElButton>
            <ElButton text size="small" disabled>更多</ElButton>
          </div>
        </div>
        <div class="rq-query-input-wrap">
          <div class="rq-query-input-stack">
            <div class="rq-query-input">
              <ElAutocomplete
                ref="promqlAutocompleteRef"
                v-model="promql"
                value-key="fullQuery"
                placeholder="请输入 PromQL 查询语句，如 up、rate(http_requests_total[5m])"
                :disabled="!selectedDatasource"
                clearable
                highlight-first-item
                :input-style="promqlInputStyle"
                :fetch-suggestions="queryMetricSuggestions"
                :trigger-on-focus="false"
                popper-class="rq-promql-suggestions"
                @focus="prefetchMetricNames"
                @select="onPromqlSuggestionSelect"
                @keydown="onPromqlKeydown"
                @keydown.enter="onPromqlEnter"
              >
                <template #default="{ item }">
                  <div class="rq-suggestion-item">
                    <span
                      class="rq-suggestion-kind"
                      :class="`is-${item.kind}`"
                      aria-hidden="true"
                    >
                      <ArtSvgIcon
                        :icon="getSuggestionIcon(item.kind)"
                        class="rq-suggestion-kind-icon"
                      />
                    </span>
                    <span class="rq-suggestion-text">
                      <template v-for="(part, idx) in getSuggestionParts(item.value)" :key="idx">
                        <span v-if="part.highlight" class="rq-suggestion-text-match">{{ part.text }}</span>
                        <span v-else>{{ part.text }}</span>
                      </template>
                    </span>
                  </div>
                </template>
              </ElAutocomplete>
            </div>
            <transition name="el-zoom-in-top">
              <div v-if="showHistory" ref="historyRef" class="rq-history-wrapper">
                <QueryHistoryDropdown
                  :history="history"
                  @select="onRestoreRecord"
                  @delete="removeRecord"
                  @clear="clearAll"
                />
              </div>
            </transition>
          </div>
          <ElSelect v-model="timeRangeMinutes" class="rq-time-range">
            <ElOption :value="15" label="近15分钟" />
            <ElOption :value="60" label="近1小时" />
            <ElOption :value="360" label="近6小时" />
            <ElOption :value="1440" label="近24小时" />
          </ElSelect>
          <ElSelect
            v-model="autoRefresh"
            class="rq-refresh-select"
            placeholder="自动刷新"
            @change="onAutoRefreshChange"
          >
            <ElOption label="关闭" :value="0" />
            <ElOption label="10秒" :value="10" />
            <ElOption label="30秒" :value="30" />
            <ElOption label="60秒" :value="60" />
          </ElSelect>
          <ElButton
            type="primary"
            class="rq-search-btn"
            :icon="Search"
            :loading="querying"
            :disabled="!selectedDatasource"
            @click="executeQuery"
          >
            搜索
          </ElButton>
        </div>
      </div>
    </section>

    <section class="rq-result-card">
      <div class="rq-result-header">
        <div class="rq-result-tabs">
          <span
            :class="['rq-result-tab', { 'is-active': resultMode === 'table' }]"
            @click="resultMode = 'table'"
          >
            表格
          </span>
          <span
            :class="['rq-result-tab', { 'is-active': resultMode === 'graph' }]"
            @click="resultMode = 'graph'"
          >
            图表
          </span>
        </div>
        <div v-if="queryResult" class="rq-result-summary">
          <span>查询耗时: {{ queryDuration }}ms</span>
          <span>{{ resultMode === 'graph' ? '序列数' : '结果数' }}: {{ totalResultCount }}</span>
        </div>
      </div>

      <div class="rq-result-body">
        <div v-if="queryError" class="rq-error-hint">
          <ElAlert type="error" :title="queryError" show-icon :closable="false" />
        </div>

        <div v-else-if="resultMode === 'table'" class="rq-table-wrap">
          <div v-if="queryResult && totalResultCount >= 1000" class="rq-result-warning">
            Warning: Fetched {{ totalResultCount }} metrics, only displaying first 1000
          </div>
          <div class="rq-table-toolbar">
            <div class="rq-table-toolbar-item">Time</div>
            <div class="rq-table-toolbar-item is-wide">SI short</div>
            <div class="rq-table-toolbar-item">值</div>
          </div>
          <div class="rq-table-scroll">
            <ElTable
              :data="tableData"
              class="rq-result-table"
              style="width: 100%"
              :show-header="false"
              size="small"
              empty-text="暂无数据"
            >
            <ElTableColumn prop="time" label="Time" width="176" />
            <ElTableColumn label="指标">
              <template #default="{ row }">
                <div class="rq-metric-cell">
                  <span class="rq-metric-name">{{ row.metricName }}</span>
                  <template v-if="row.labels.length">
                    <span class="rq-metric-brace">{</span>
                    <template v-for="(label, i) in row.labels" :key="`${label.key}-${i}`">
                      <span v-if="i > 0" class="rq-metric-sep">, </span>
                      <span class="rq-metric-label-key">{{ label.key }}</span>
                      <span class="rq-metric-sep">=</span>
                      <span class="rq-metric-label-val">"{{ label.value }}"</span>
                    </template>
                    <span class="rq-metric-brace">}</span>
                  </template>
                </div>
              </template>
            </ElTableColumn>
            <ElTableColumn prop="value" label="值" width="110" />
            </ElTable>
          </div>
        </div>

        <div v-else-if="resultMode === 'graph'" class="rq-graph-wrap">
          <div class="rq-graph-toolbar">
            <div class="rq-graph-toolbar-left">
              <ElInput
                v-model="graphStepInput"
                class="rq-graph-step"
                size="small"
                placeholder="Res. (s)"
                clearable
                @change="onGraphStepChange"
              />
            </div>
            <div class="rq-graph-toolbar-right">
              <span class="rq-graph-unit-label">Unit</span>
              <ElSelect v-model="graphUnit" class="rq-graph-unit-select">
                <ElOption label="SI short" value="si" />
                <ElOption label="none" value="none" />
              </ElSelect>
              <ElCheckbox v-model="showSeriesLegend" class="rq-graph-legend-toggle">
                Show Legend
              </ElCheckbox>
              <ElCheckbox v-model="multiTooltipDesc" class="rq-graph-legend-toggle">
                Multi Tooltip, order value desc
              </ElCheckbox>
            </div>
          </div>

          <div ref="graphBodyRef" class="rq-graph-body" :class="{ 'is-empty': chartEmpty }">
            <div ref="graphMainRef" class="rq-graph-main">
              <div ref="chartRef" class="rq-chart" />
            </div>

            <div v-if="chartEmpty || showSeriesLegend" class="rq-series-panel">
              <div class="rq-series-head">
                <span class="rq-series-title">Series ({{ seriesList.length }})</span>
                <span class="rq-series-last">
                  Last
                  <ArtSvgIcon icon="ri:arrow-up-down-line" class="rq-series-sort-icon" />
                </span>
              </div>
              <div v-if="seriesList.length" class="rq-series-list">
                <div
                  v-for="(item, idx) in seriesList"
                  :key="`${item.name}-${idx}`"
                  :class="[
                    'rq-series-row',
                    {
                      'is-highlighted': hoveredSeriesIndex === idx,
                      'is-selected': selectedSeriesIndex === idx
                    }
                  ]"
                  @click="toggleSeriesSelection(idx)"
                  @mouseenter="hoveredSeriesIndex = idx"
                  @mouseleave="hoveredSeriesIndex = null"
                >
                  <span class="rq-series-dot" :style="{ backgroundColor: item.color }" />
                  <span class="rq-series-name">{{ item.name }}</span>
                  <span class="rq-series-value">
                    {{ item.lastValue !== null ? formatGraphAxisValue(item.lastValue) : '-' }}
                  </span>
                </div>
              </div>
              <div v-else class="rq-series-empty">
                <span class="rq-graph-empty-text">{{ querying ? '查询中...' : '暂无数据' }}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, onMounted, nextTick, type CSSProperties } from 'vue'
import { useQueryHistory, type QueryHistoryRecord } from './useQueryHistory'
import QueryHistoryDropdown from './modules/QueryHistoryDropdown.vue'

const promqlInputStyle: CSSProperties = {
  fontSize: '12px',
  lineHeight: '1.5',
  color: 'var(--el-text-color-primary)',
}
import { Search } from '@element-plus/icons-vue'
import {
  ElAlert,
  ElAutocomplete,
  ElButton,
  ElCheckbox,
  ElInput,
  ElOption,
  ElSelect,
  ElTable,
  ElTableColumn
} from 'element-plus'
import { useChart } from '@/hooks/core/useChart'
import { echarts, type EChartsOption } from '@/plugins/echarts'
import {
  fetchDatasourceList,
  resolveDatasourceUrl,
  type DatasourceHeader,
  type DatasourceItem,
  type DatasourceSubType
} from '@/api/datasource'
import {
  fetchPrometheusInstantQuery,
  fetchPrometheusRangeQuery,
  type PrometheusInstantResult
} from '@/api/kubernetes/prometheus'
import { usePromqlAutocomplete } from './usePromqlAutocomplete'

defineOptions({ name: 'MonitorRealtimeQuery' })
const alertVisible = ref(true)

// ---- 指标来源/数据源（与日志页保持同构）----
const dsLoading = ref(false)
const datasourceOptions = ref<DatasourceItem[]>([])
const allDatasourceItems = ref<DatasourceItem[]>([])
const selectedDsId = ref<number>()
const sourceFilter = ref<'internal' | 'external'>('external')
const subTypeMeta: Record<DatasourceSubType, { label: string; icon: string }> = {
  loki: { label: 'Loki', icon: 'simple-icons:grafana' },
  es: { label: 'Elasticsearch', icon: 'simple-icons:elasticsearch' },
  prometheus: { label: 'Prometheus', icon: 'simple-icons:prometheus' }
}

const sourceOptions = computed(() => {
  const hasInternal = allDatasourceItems.value.some((item) => !item.external)
  const hasExternal = allDatasourceItems.value.some((item) => item.external)
  const options: { label: string; value: 'internal' | 'external' }[] = []
  if (hasInternal) options.push({ label: '内部数据源', value: 'internal' })
  if (hasExternal) options.push({ label: '外部数据源', value: 'external' })
  return options
})

const filteredDsList = computed(() => {
  if (sourceFilter.value === 'internal') {
    return datasourceOptions.value.filter((item) => !item.external)
  }
  return datasourceOptions.value.filter((item) => item.external)
})

const selectedDatasource = computed<DatasourceItem | null>(() => {
  const id = selectedDsId.value
  if (!id) return null
  return (
    datasourceOptions.value.find((item) => item.id === id) ??
    filteredDsList.value.find((item) => item.id === id) ??
    null
  )
})

function getDatasourceById(id: number): DatasourceItem | null {
  return (
    datasourceOptions.value.find((item) => item.id === id) ??
    filteredDsList.value.find((item) => item.id === id) ??
    null
  )
}

async function loadPrometheusDatasources() {
  dsLoading.value = true
  try {
    const { items } = await fetchDatasourceList({
      page: 1,
      limit: 200,
      type: 1
    })
    allDatasourceItems.value = items.filter((item) => item.subType === 'prometheus')
    datasourceOptions.value = allDatasourceItems.value
    if (sourceOptions.value.length > 0) {
      const prefer = sourceOptions.value.find((opt) => opt.value === 'internal')
      if (prefer && sourceFilter.value !== 'internal') {
        sourceFilter.value = 'internal'
      } else if (!prefer && sourceFilter.value !== sourceOptions.value[0].value) {
        sourceFilter.value = sourceOptions.value[0].value
      }
    }
    if (filteredDsList.value.length > 0) {
      selectedDsId.value =
        filteredDsList.value.find((item) => item.isDefault)?.id ?? filteredDsList.value[0].id
    } else {
      selectedDsId.value = undefined
      queryResult.value = null
      queryError.value = ''
    }
  } catch {
    allDatasourceItems.value = []
    datasourceOptions.value = []
    selectedDsId.value = undefined
  } finally {
    dsLoading.value = false
  }
}

function onDsChange() {
  clearAutocompleteCache()
  queryResult.value = null
  queryError.value = ''
}

watch(sourceFilter, () => {
  clearAutocompleteCache()
  selectedDsId.value =
    filteredDsList.value.find((item) => item.isDefault)?.id ?? filteredDsList.value[0]?.id
  queryResult.value = null
  queryError.value = ''
})

function buildExternalAuthHeader(datasource: DatasourceItem | null): string {
  const username =
    datasource?.config.log?.userName?.trim() || datasource?.config.alert?.userName?.trim() || ''
  const password = datasource?.config.log?.password ?? datasource?.config.alert?.password ?? ''
  if (!username && !password) return ''
  return `Basic ${btoa(`${username}:${password}`)}`
}

function applyExternalDatasourceHeaders(
  target: Record<string, string>,
  headers: DatasourceHeader[] | undefined
) {
  for (const header of headers ?? []) {
    const key = header.key.trim()
    if (!key) continue
    target[key] = header.value
  }
}

function getExternalProxyHeaders(datasource: DatasourceItem | null): Record<string, string> {
  if (!datasource) return {}
  const headers: Record<string, string> = {}
  const authHeader = buildExternalAuthHeader(datasource)
  if (authHeader) {
    headers['X-Pixiu-Proxy-Authorization'] = authHeader
  }
  applyExternalDatasourceHeaders(headers, datasource.config.headers)
  return headers
}

// ---- 时间范围 ----
const timeRangeMinutes = ref(60)

function resolveTimeRange(): { start: number; end: number } {
  const end = Math.floor(Date.now() / 1000)
  const start = end - timeRangeMinutes.value * 60
  return { start, end }
}

// ---- 查询 ----
const {
  history,
  showHistory,
  addRecord,
  removeRecord,
  clearAll,
  closeHistory
} = useQueryHistory()

const activeQueryTab = ref<'promql' | 'favorite' | 'history' | 'template'>('promql')
const promql = ref('')
const autocompleteEnabled = ref(true)
const querying = ref(false)
const queryResult = ref<PrometheusInstantResult | null>(null)
const queryError = ref('')
const queryDuration = ref(0)

const {
  promqlAutocompleteRef,
  clearAutocompleteCache,
  prefetchMetricNames,
  queryMetricSuggestions,
  getSuggestionParts,
  getSuggestionIcon,
  onPromqlSuggestionSelect,
  onPromqlKeydown,
  hasActiveSuggestions
} = usePromqlAutocomplete({
  promql,
  autocompleteEnabled,
  selectedDatasource,
  resolveTimeRange,
  getExternalProxyHeaders
})

watch(activeQueryTab, (tab) => {
  showHistory.value = tab === 'history'
})

function handleGlobalHistoryClick() {
  if (activeQueryTab.value !== 'history') return
  activeQueryTab.value = 'promql'
  closeHistory()
}

function onPromqlEnter() {
  if (hasActiveSuggestions()) return
  void executeQuery()
}

async function executeQuery() {
  const ds = selectedDatasource.value
  if (!ds || !promql.value.trim()) return

  queryError.value = ''
  queryResult.value = null
  querying.value = true

  const dsUrl = resolveDatasourceUrl(ds)
  const proxyHeaders = getExternalProxyHeaders(ds)
  const t0 = performance.now()

  try {
    const query = promql.value.trim()
    const res =
      resultMode.value === 'graph'
        ? await (() => {
            const { start, end } = resolveTimeRange()
            const step = resolveGraphStep(start, end)
            return fetchPrometheusRangeQuery(dsUrl, query, start, end, step, {
              headers: proxyHeaders
            })
          })()
        : await fetchPrometheusInstantQuery(dsUrl, query, Math.floor(Date.now() / 1000), {
            headers: proxyHeaders
          })

    queryDuration.value = Math.round(performance.now() - t0)

    if (res.status === 'success') {
      queryResult.value = res.data
      addRecord({
        promql: promql.value.trim(),
        selectedDsId: selectedDsId.value,
        sourceFilter: sourceFilter.value,
        timeRangeMinutes: timeRangeMinutes.value,
        resultMode: resultMode.value,
        datasourceName: selectedDatasource.value?.name ?? ''
      })
    } else {
      queryError.value = res.error || '查询失败'
    }
  } catch (e: any) {
    queryDuration.value = Math.round(performance.now() - t0)
    const msg = e?.response?.data?.message || e?.message || '请求异常'
    queryError.value = typeof msg === 'string' ? msg : JSON.stringify(msg)
  } finally {
    querying.value = false
  }
}

function calcStep(start: number, end: number): string {
  const rangeSeconds = end - start
  const step = Math.max(15, Math.ceil(rangeSeconds / 1100))
  return step + 's'
}

function resolveGraphStep(start: number, end: number): string {
  const custom = Number(graphStepInput.value)
  if (Number.isFinite(custom) && custom > 0) {
    return `${Math.floor(custom)}s`
  }
  return calcStep(start, end)
}

const totalResultCount = computed(() => {
  return queryResult.value?.result?.length ?? 0
})

// ---- 结果展示 ----
const resultMode = ref<'table' | 'graph'>('table')
const tableDisplayLimit = 1000

const tableData = computed(() => {
  if (!queryResult.value) return []
  return queryResult.value.result.slice(0, tableDisplayLimit).map((item, idx) => {
    const { metricName, labels } = parseMetricLabels(item.metric ?? {})
    const point = item.value ?? item.values?.[item.values.length - 1]
    return {
      _idx: idx,
      time: point ? formatTimestamp(point[0]) : '-',
      value: point ? formatPointValue(point[1]) : '-',
      metricName,
      labels
    }
  })
})

const CHART_COLORS = [
  '#e03131',
  '#2f9e44',
  '#1971c2',
  '#f08c00',
  '#9c36b5',
  '#0ca678',
  '#e67700',
  '#495057',
  '#c92a2a',
  '#1864ab',
  '#862e9c'
]

function getChartSeriesColor(index: number): string {
  if (index < CHART_COLORS.length) return CHART_COLORS[index]
  const hue = (index * 47) % 360
  return `hsl(${hue}, 72%, 42%)`
}

interface GraphSeriesItem {
  name: string
  color: string
  data: Array<[number, number]>
  lastValue: number | null
}

const seriesList = computed<GraphSeriesItem[]>(() => {
  if (!queryResult.value?.result?.length) return []
  return queryResult.value.result.map((item, idx) => {
    const points =
      item.values?.map(([ts, val]) => [ts * 1000, Number(val)] as [number, number]) ??
      (item.value ? [[item.value[0] * 1000, Number(item.value[1])] as [number, number]] : [])
    const data = points.filter((point) => Number.isFinite(point[1]))
    const lastPoint = data.length ? data[data.length - 1] : null
    return {
      name: formatMetricSeriesText(item.metric ?? {}),
      color: getChartSeriesColor(idx),
      data,
      lastValue: lastPoint ? lastPoint[1] : null
    }
  })
})

function formatMetricSeriesText(metric: Record<string, string>): string {
  const { metricName, labels } = parseMetricLabels(metric)
  if (!labels.length) return metricName
  const labelText = labels.map((l) => `${l.key}="${escapeLabelValue(l.value)}"`).join(', ')
  return `${metricName}{${labelText}}`
}

function parseMetricLabels(metric: Record<string, string>): {
  metricName: string
  labels: Array<{ key: string; value: string }>
} {
  const metricName = metric.__name__ || 'metric'
  const labels = Object.entries(metric)
    .filter(([key]) => key !== '__name__')
    .map(([key, value]) => ({ key, value: String(value ?? '') }))
  return { metricName, labels }
}

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

watch(resultMode, async (mode, prevMode) => {
  if (mode === prevMode) return
  if (prevMode === 'graph') {
    disposeGraphChart()
    teardownGraphLayoutObserver()
  }
  if (mode === 'graph') {
    await nextTick()
    setupGraphLayoutObserver()
  }
  if (!selectedDatasource.value || !promql.value.trim() || querying.value) {
    if (mode === 'graph') {
      await renderGraphChart()
    }
    return
  }
  await executeQuery()
})

function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString('zh-CN')
}

function formatPointValue(value: string): string {
  const num = Number(value)
  if (!Number.isFinite(num)) return value
  if (Math.abs(num) >= 1000 || (Math.abs(num) > 0 && Math.abs(num) < 0.01)) {
    return num.toExponential(2)
  }
  return Number(num.toFixed(6)).toString()
}

// ---- 图表 ----
const chartRef = ref<HTMLElement>()
const graphBodyRef = ref<HTMLElement>()
const graphMainRef = ref<HTMLElement>()
const {
  getAxisLineStyle,
  getSplitLineStyle,
  getAxisLabelStyle,
  getTooltipStyle
} = useChart()

let graphChart: echarts.ECharts | null = null
let graphLayoutObserver: ResizeObserver | null = null
let graphRenderer: 'svg' | 'canvas' | null = null

const graphStepInput = ref('')
const graphUnit = ref<'si' | 'none'>('si')
const showSeriesLegend = ref(true)
const multiTooltipDesc = ref(false)
const hoveredSeriesIndex = ref<number | null>(null)
const selectedSeriesIndex = ref<number | null>(null)
const tooltipSeriesName = ref('')

const chartEmpty = computed(() => {
  if (!queryResult.value) return true
  return seriesList.value.length === 0 || seriesList.value.every((item) => item.data.length === 0)
})

function formatSiShort(value: number): string {
  if (!Number.isFinite(value)) return String(value)
  const units = ['', 'K', 'M', 'G', 'T', 'P', 'E']
  let current = Math.abs(value)
  let unitIndex = 0
  while (current >= 1000 && unitIndex < units.length - 1) {
    current /= 1000
    unitIndex += 1
  }
  const digits = current >= 100 ? 1 : current >= 10 ? 2 : 3
  const formatted = Number(current.toFixed(digits)).toString()
  return `${value < 0 ? '-' : ''}${formatted}${units[unitIndex]}`
}

function formatGraphAxisValue(value: number): string {
  if (graphUnit.value === 'si') return formatSiShort(value)
  if (!Number.isFinite(value)) return String(value)
  if (Math.abs(value) >= 1000 || (Math.abs(value) > 0 && Math.abs(value) < 0.01)) {
    return value.toExponential(2)
  }
  return Number(value.toFixed(4)).toString()
}

function formatChartAxisTime(value: number): string {
  const date = new Date(value)
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function formatTooltipTime(value: number): string {
  const date = new Date(value)
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}

function resolveGraphLineWidth(_seriesCount: number): number {
  return 0.5
}

function resolveGraphLineOpacity(seriesCount: number): number {
  return 0.96
}

const GRAPH_GRID = {
  left: 8,
  right: 12,
  top: 12,
  bottom: 20,
  containLabel: true
}

function buildGraphXAxis(extra: Record<string, unknown> = {}) {
  return {
    type: 'time' as const,
    boundaryGap: false,
    axisLine: getAxisLineStyle(),
    splitLine: getSplitLineStyle(false),
    axisTick: { show: false },
    axisLabel: {
      ...getAxisLabelStyle(),
      fontSize: 12,
      margin: 4,
      hideOverlap: true,
      formatter: (value: number) => formatChartAxisTime(value)
    },
    ...extra
  }
}

function buildEmptyGraphChartOption(): EChartsOption {
  const { start, end } = resolveTimeRange()
  const startMs = start * 1000
  const endMs = end * 1000

  return {
    animation: false,
    grid: GRAPH_GRID,
    xAxis: buildGraphXAxis({ min: startMs, max: endMs }),
    yAxis: {
      type: 'value',
      show: false,
      splitLine: { show: false }
    },
    series: []
  }
}

function buildGraphChartOption(): EChartsOption {
  const visibleSeries =
    selectedSeriesIndex.value !== null
      ? seriesList.value.filter((_, idx) => idx === selectedSeriesIndex.value)
      : seriesList.value
  const singleSeriesSelected = selectedSeriesIndex.value !== null && visibleSeries.length === 1
  const lineWidth = resolveGraphLineWidth(visibleSeries.length)
  const lineOpacity = resolveGraphLineOpacity(visibleSeries.length)

  const series = visibleSeries.map((item) => {
    return {
      name: item.name,
      type: 'line',
      showSymbol: false,
      symbolSize: 0,
      smooth: true,
      lineStyle: {
        width: lineWidth,
        color: item.color,
        opacity: lineOpacity,
        cap: 'butt',
        join: 'miter'
      },
      itemStyle: { color: item.color, opacity: lineOpacity },
      emphasis: {
        scale: false,
        lineStyle: {
          width: lineWidth,
          opacity: lineOpacity
        },
        itemStyle: { opacity: lineOpacity }
      },
      data: item.data
    }
  })

  return {
    animation: false,
    grid: GRAPH_GRID,
    tooltip: getTooltipStyle('axis', {
      axisPointer: { type: 'line', lineStyle: { width: 0.5, type: 'dashed' } },
      confine: true,
      enterable: true,
      extraCssText:
        'max-width: 420px; max-height: 320px; overflow-y: auto; white-space: normal; word-break: break-all;',
      formatter: (params: unknown) => {
        const items = Array.isArray(params) ? params : [params]
        if (!items.length) return ''
        const timeValue = items[0].data?.[0] ?? items[0].axisValue
        const timeLabel = timeValue !== undefined ? formatTooltipTime(Number(timeValue)) : ''
        const rows = items
          .map((item: { color?: string; seriesName?: string; data?: [number, number] }) => {
            const val = formatGraphAxisValue(item.data?.[1] ?? 0)
            return `<div style="margin:2px 0;line-height:1.4"><span style="color:${item.color}">●</span> <span>${item.seriesName}</span>: <b>${val}</b></div>`
          })
          .join('')
        return `<div style="font-size:12px">${
          timeLabel ? `<div style="margin-bottom:4px;font-weight:600">${timeLabel}</div>` : ''
        }${rows}</div>`
      }
    }),
    xAxis: buildGraphXAxis(),
    yAxis: {
      type: 'value',
      scale: true,
      axisLine: getAxisLineStyle(false),
      splitLine: singleSeriesSelected ? { show: false } : getSplitLineStyle(true),
      axisTick: { show: false },
      axisLabel: {
        ...getAxisLabelStyle(),
        fontSize: 11,
        formatter: (value: number) => formatGraphAxisValue(value)
      }
    },
    series
  }
}

async function renderGraphChart() {
  await nextTick()
  if (resultMode.value !== 'graph' || !chartRef.value) return

  const nextRenderer: 'svg' | 'canvas' = 'svg'

  if (graphChart && graphRenderer !== nextRenderer) {
    graphChart.dispose()
    graphChart = null
  }

  if (!graphChart) {
    graphChart = echarts.init(chartRef.value, undefined, {
      renderer: nextRenderer,
      devicePixelRatio: window.devicePixelRatio || 1
    })
    graphRenderer = nextRenderer
  } else {
    graphChart.resize()
  }

  const options = chartEmpty.value ? buildEmptyGraphChartOption() : buildGraphChartOption()
  graphChart.setOption(options, true)
  graphChart.off('mouseover')
  graphChart.on('mouseover', (params: { componentType?: string; seriesName?: string }) => {
    if (params.componentType === 'series' && params.seriesName) {
      tooltipSeriesName.value = params.seriesName
    }
  })
  graphChart.off('globalout')
  graphChart.on('globalout', () => {
    tooltipSeriesName.value = ''
  })
  graphChart.off('click')
  graphChart.on('click', (params: { componentType?: string; seriesName?: string }) => {
    if (params.componentType !== 'series' || !params.seriesName) return
    const targetIndex = seriesList.value.findIndex((item) => item.name === params.seriesName)
    if (targetIndex === -1) return
    selectedSeriesIndex.value = selectedSeriesIndex.value === targetIndex ? null : targetIndex
    tooltipSeriesName.value = params.seriesName
  })
  await nextTick()
  graphChart.resize()
}

function disposeGraphChart() {
  if (!graphChart) return
  graphChart.dispose()
  graphChart = null
  graphRenderer = null
}

function onRestoreRecord(record: QueryHistoryRecord) {
  closeHistory()
  activeQueryTab.value = 'promql'
  sourceFilter.value = record.sourceFilter
  selectedDsId.value = record.selectedDsId
  timeRangeMinutes.value = record.timeRangeMinutes
  promql.value = record.promql
  if (record.resultMode !== resultMode.value) {
    resultMode.value = record.resultMode
  } else {
    executeQuery()
  }
}

function toggleSeriesSelection(index: number) {
  selectedSeriesIndex.value = selectedSeriesIndex.value === index ? null : index
}

watch(queryResult, () => {
  selectedSeriesIndex.value = null
})

watch(seriesList, (list) => {
  if (selectedSeriesIndex.value !== null && selectedSeriesIndex.value >= list.length) {
    selectedSeriesIndex.value = null
  }
})

function onGraphStepChange() {
  if (resultMode.value !== 'graph') return
  if (!selectedDatasource.value || !promql.value.trim() || querying.value) return
  executeQuery()
}

watch(
  [queryResult, seriesList, graphUnit, multiTooltipDesc, resultMode, timeRangeMinutes, chartEmpty, selectedSeriesIndex],
  () => {
    if (resultMode.value === 'graph') {
      renderGraphChart()
    }
  },
  { deep: true }
)

watch(timeRangeMinutes, async () => {
  if (resultMode.value !== 'graph') return
  if (!selectedDatasource.value || !promql.value.trim() || querying.value) return
  await executeQuery()
})

// ---- 自动刷新 ----
const autoRefresh = ref(0)
let autoRefreshTimer: ReturnType<typeof setInterval> | null = null

function onAutoRefreshChange(seconds: number) {
  stopAutoRefresh()
  if (seconds > 0) {
    autoRefreshTimer = setInterval(() => {
      if (promql.value.trim() && selectedDatasource.value) {
        executeQuery()
      }
    }, seconds * 1000)
  }
}

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
}

function handleGraphResize() {
  if (resultMode.value === 'graph') {
    graphChart?.resize()
  }
}

function setupGraphLayoutObserver() {
  graphLayoutObserver?.disconnect()
  graphLayoutObserver = null
  const target = graphMainRef.value ?? graphBodyRef.value
  if (!target) return

  graphLayoutObserver = new ResizeObserver(() => {
    handleGraphResize()
  })
  graphLayoutObserver.observe(target)
}

function teardownGraphLayoutObserver() {
  graphLayoutObserver?.disconnect()
  graphLayoutObserver = null
}

watch(alertVisible, async () => {
  await nextTick()
  handleGraphResize()
  window.setTimeout(handleGraphResize, 120)
})

onBeforeUnmount(() => {
  stopAutoRefresh()
  disposeGraphChart()
  teardownGraphLayoutObserver()
  window.removeEventListener('resize', handleGraphResize)
  document.removeEventListener('click', handleGlobalHistoryClick)
})

onMounted(() => {
  loadPrometheusDatasources()
  window.addEventListener('resize', handleGraphResize)
  document.addEventListener('click', handleGlobalHistoryClick)
  nextTick(() => {
    if (resultMode.value === 'graph') {
      setupGraphLayoutObserver()
    }
  })
})
</script>

<style scoped>
.realtime-query-page {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 0;
  padding: 0;
  overflow: hidden;
}

.quota-alert {
  flex-shrink: 0;
  margin: 0 0 12px;
}

/* ---- 顶部卡片 ---- */
.rq-top-card {
  flex-shrink: 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
  padding: 12px 16px;
}

.rq-rule-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rq-rule-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 12px;
}

.rq-rule-left {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.rq-rule-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.rq-rule-label {
  font-size: 13px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
  flex-shrink: 0;
}

.rq-rule-select {
  min-width: 120px;
}

.rq-source-select {
  width: 130px;
}

.rq-datasource-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.rq-ds-select {
  width: 320px;
}

.rq-ds-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.rq-ds-option-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rq-ds-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  flex: none;
}

.rq-ds-logo.is-loki {
  color: #f59e0b;
  background: #fff7ed;
}

.rq-ds-logo.is-es {
  color: #2563eb;
  background: #eff6ff;
}

.rq-ds-logo.is-prometheus {
  color: #f97316;
  background: #fff7ed;
}

.rq-ds-logo-icon {
  width: 14px;
  height: 14px;
}

.rq-ds-cluster-tag {
  position: absolute;
  top: -8px;
  right: 28px;
  z-index: 1;
}

.rq-autocomplete-toggle {
  margin-left: 8px;
  white-space: nowrap;
}

.rq-autocomplete-toggle :deep(.el-checkbox__label) {
  font-size: 13px;
  color: var(--el-text-color-regular);
  padding-left: 6px;
}

.rq-autocomplete-toggle :deep(.el-checkbox__input.is-checked + .el-checkbox__label) {
  color: var(--el-text-color-regular);
}

.rq-refresh-select {
  width: 110px;
  flex: none;
}

/* ---- 查询输入 ---- */
.rq-query-body {
  position: relative;
  display: flex;
  flex-direction: column;
  margin-top: 20px;
}

.rq-query-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.rq-query-toolbar-left,
.rq-query-toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  min-height: 20px;
}

.rq-query-toolbar-right {
  justify-content: flex-end;
}

.rq-query-tab {
  display: inline-flex;
  align-items: center;
  padding: 0;
  font-size: 12px;
  line-height: 1.2;
  color: var(--el-text-color-secondary);
  font-weight: 400;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.15s ease;
}

.rq-query-tab:hover,
.rq-query-tab.is-active {
  color: var(--el-text-color-primary);
}

.rq-query-tab.is-active {
  font-weight: 500;
}

.rq-query-toolbar-right :deep(.el-button) {
  height: auto !important;
  padding: 0 !important;
  font-size: 12px !important;
  line-height: 1.2 !important;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.rq-query-toolbar-left :deep(.el-button.is-disabled),
.rq-query-toolbar-right :deep(.el-button.is-disabled) {
  opacity: 1;
  color: var(--el-text-color-secondary);
}

.rq-hot-tag {
  display: inline-flex;
  align-items: center;
  height: 16px;
  padding: 0 5px;
  border-radius: 2px;
  background: #f56c6c;
  color: #fff;
  font-size: 10px;
  line-height: 1;
  font-weight: 600;
  transform: translateY(-1px);
}

.rq-query-input-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: nowrap;
}

.rq-query-input-stack {
  position: relative;
  flex: 1;
  min-width: 0;
  max-width: calc(100% - 360px);
}

.rq-query-input {
  width: 100%;
}

.rq-query-input :deep(.el-autocomplete) {
  display: block;
  width: 100%;
}

.rq-query-input :deep(.el-input__wrapper),
.rq-query-input :deep(.el-input__inner),
.rq-query-input :deep(.el-input__wrapper input) {
  font-size: 12px !important;
  line-height: 1.5 !important;
  color: var(--el-text-color-primary) !important;
}

.rq-query-input :deep(.el-input__inner::placeholder),
.rq-query-input :deep(.el-input__wrapper input::placeholder),
.rq-query-input :deep(.el-input__placeholder) {
  font-size: 12px !important;
  color: var(--el-text-color-placeholder);
}

:global(.realtime-query-page .rq-query-input .el-input__inner),
:global(.realtime-query-page .rq-query-input .el-input__wrapper input) {
  font-size: 12px !important;
  line-height: 1.5 !important;
  color: var(--el-text-color-primary) !important;
}

.rq-search-btn {
  min-width: 90px;
  flex: none;
}

.rq-time-range {
  width: 130px;
  flex: none;
}

.rq-time-range :deep(.el-select__wrapper) {
  min-height: 32px;
}

.rq-query-meta {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  margin-top: 6px;
}

/* ---- 结果卡片 ---- */
.rq-result-card {
  margin-top: 12px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
}

.rq-result-header {
  padding: 8px 12px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.rq-result-tabs {
  display: flex;
  gap: 0;
}

.rq-result-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition: color 0.2s;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

.rq-result-summary {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.rq-result-tab:hover {
  color: var(--el-color-primary);
}

.rq-result-tab.is-active {
  color: var(--el-color-primary);
  border-bottom-color: var(--el-color-primary);
  font-weight: 500;
}

.rq-result-tab.is-disabled {
  color: var(--el-text-color-placeholder);
  cursor: not-allowed;
}

.rq-result-tab.is-disabled:hover {
  color: var(--el-text-color-placeholder);
}

.rq-result-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
}

.rq-error-hint {
  flex: 1;
  min-height: 0;
  display: flex;
  padding: 16px;
  align-items: flex-start;
  overflow: auto;
}

.rq-table-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0 12px;
  overflow: hidden;
}

.rq-table-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.rq-table-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: transparent;
}

.rq-table-toolbar-item {
  height: 28px;
  display: inline-flex;
  align-items: center;
  padding: 0 10px;
  border: 1px solid var(--el-border-color);
  border-radius: 2px;
  background: var(--el-fill-color-blank);
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.rq-table-toolbar-item.is-wide {
  min-width: 120px;
}

.rq-result-warning {
  flex-shrink: 0;
  height: 28px;
  line-height: 28px;
  margin: 0 -12px;
  padding: 0 12px;
  font-size: 12px;
  color: var(--el-color-warning-dark-2);
  background: var(--el-color-warning-light-9);
  border-bottom: 1px solid var(--el-color-warning-light-5);
}

.rq-result-table {
  --el-table-bg-color: var(--el-fill-color-blank);
  --el-table-tr-bg-color: var(--el-fill-color-blank);
  --el-table-header-bg-color: var(--el-fill-color-light);
  --el-table-row-hover-bg-color: var(--el-fill-color-light);
  --el-table-text-color: var(--el-text-color-primary);
  --el-table-header-text-color: var(--el-text-color-regular);
  --el-table-border-color: var(--el-border-color-lighter);
}

.rq-result-table :deep(.el-table__header th) {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  font-size: 12px;
  font-weight: 500;
}

.rq-result-table :deep(.el-table__empty-text) {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.rq-result-table :deep(.el-table__cell) {
  padding: 10px 0;
  font-size: 12px;
  color: var(--el-text-color-primary);
  vertical-align: top;
}

.rq-result-table :deep(.cell) {
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-primary);
}

.rq-metric-cell {
  font-size: 12px;
  color: inherit;
  line-height: 1.5;
  word-break: break-all;
}

.rq-metric-name {
  color: #0f766e;
}

.rq-metric-brace,
.rq-metric-sep {
  color: inherit;
}

.rq-metric-label-key {
  display: inline-block;
  padding: 0 4px;
  margin: 0 1px;
  border-radius: 4px;
  font-weight: 700;
  font-size: 12px;
  line-height: 18px;
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-dark);
}

.rq-metric-label-val {
  color: inherit;
}

.rq-graph-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  gap: 8px;
  padding: 8px 12px 10px;
  overflow: hidden;
}

.rq-graph-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  overflow: hidden;
  background: var(--el-fill-color-blank);
}

.rq-graph-main {
  height: 55%;
  flex: none;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.rq-series-panel {
  height: 45%;
  flex: none;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--el-border-color-lighter);
}

.rq-chart {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.rq-graph-body.is-empty .rq-series-empty {
  flex: 1;
  min-height: 0;
}

.rq-graph-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.rq-graph-toolbar-left,
.rq-graph-toolbar-right {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.rq-graph-step {
  width: 120px;
}

.rq-graph-step :deep(.el-input__wrapper) {
  height: 28px;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 2px;
  background: var(--el-fill-color-blank);
  box-shadow: 0 0 0 1px var(--el-border-color) inset;
}

.rq-graph-step :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--el-border-color) inset;
}

.rq-graph-step :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--el-border-color) inset;
}

.rq-graph-step :deep(.el-input__inner) {
  height: 26px;
  line-height: 26px;
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.rq-graph-step :deep(.el-input__inner::placeholder) {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.rq-graph-unit-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.rq-graph-unit-select {
  width: 120px;
  flex: none;
}

.rq-graph-unit-select :deep(.el-select__wrapper) {
  min-height: 28px !important;
  height: 28px !important;
  padding: 0 10px;
  border-radius: 2px;
  background: var(--el-fill-color-blank);
  box-shadow: 0 0 0 1px var(--el-border-color) inset !important;
}

.rq-graph-unit-select :deep(.el-select__wrapper:hover),
.rq-graph-unit-select :deep(.el-select__wrapper.is-focused) {
  box-shadow: 0 0 0 1px var(--el-border-color) inset !important;
}

.rq-graph-unit-select :deep(.el-select__selection) {
  height: 26px;
  line-height: 26px;
}

.rq-graph-unit-select :deep(.el-select__selected-item),
.rq-graph-unit-select :deep(.el-select__placeholder) {
  font-size: 12px;
  line-height: 26px;
}

.rq-graph-toolbar-right {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.rq-graph-tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  user-select: none;
}

.rq-graph-tool.is-active {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
}

.rq-graph-legend-toggle {
  margin-right: 0;
}

.rq-graph-legend-toggle :deep(.el-checkbox__label) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.rq-series-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 28px;
  padding: 0 12px;
  background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.rq-series-last {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--el-text-color-secondary);
}

.rq-series-sort-icon {
  width: 14px;
  height: 14px;
  font-size: 14px;
}

.rq-series-list {
  flex: 1;
  min-height: 0;
  overflow-x: scroll;
  overflow-y: auto;
  padding: 4px 10px 6px;
  background: var(--el-fill-color-blank);
  scrollbar-gutter: stable both-edges;
  scrollbar-width: thin;
  scrollbar-color: var(--el-border-color-darker) var(--el-fill-color-light);
}

.rq-series-list::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.rq-series-list::-webkit-scrollbar-track {
  background: var(--el-fill-color-light);
  border-radius: 4px;
}

.rq-series-list::-webkit-scrollbar-thumb {
  background: var(--el-border-color-darker);
  border-radius: 4px;
}

.rq-series-list::-webkit-scrollbar-thumb:hover {
  background: var(--el-text-color-placeholder);
}

.rq-series-title {
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.rq-series-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 72px;
  padding: 0 12px;
  background: var(--el-fill-color-blank);
}

.rq-graph-empty-text {
  width: 100%;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 60px;
}

.rq-series-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: max-content;
  min-width: 100%;
  padding: 4px 2px;
  font-size: 12px;
  line-height: 20px;
  font-weight: 400;
  color: var(--el-text-color-primary);
  box-sizing: border-box;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.15s ease;
}

.rq-series-row:hover {
  background: var(--el-fill-color-light);
}

.rq-series-row.is-highlighted {
  color: var(--el-text-color-primary);
  font-weight: 400;
}

.rq-series-row.is-selected {
  color: var(--el-text-color-primary);
  font-weight: 400;
  background: var(--el-color-primary-light-9);
}

.rq-series-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}

.rq-series-name {
  flex: none;
  white-space: nowrap;
  color: var(--el-text-color-primary);
}

.rq-series-value {
  flex: none;
  margin-left: 16px;
  white-space: nowrap;
  font-size: 12px;
  line-height: 20px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-primary);
}


:global(.rq-promql-suggestions) {
  border-radius: 6px;
  overflow: hidden;
}

:global(.rq-promql-suggestions .el-autocomplete-suggestion__wrap) {
  max-height: 360px;
}

:global(.rq-promql-suggestions .el-autocomplete-suggestion__list) {
  padding: 6px 0;
}

:global(.rq-promql-suggestions li) {
  padding: 0;
  line-height: 1;
}

:global(.rq-promql-suggestions li:hover),
:global(.rq-promql-suggestions li.highlighted) {
  background: var(--el-color-primary-light-9);
}

.rq-suggestion-item {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 0 2px 0 10px;
  min-height: 28px;
}

.rq-suggestion-kind {
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  color: var(--el-color-primary);
  opacity: 0.95;
}

.rq-suggestion-kind.is-label,
.rq-suggestion-kind.is-operator {
  color: var(--el-color-primary);
}

.rq-suggestion-kind.is-value {
  color: #f59e0b;
}

.rq-suggestion-kind.is-metric {
  color: var(--el-color-primary);
}

.rq-suggestion-kind-icon {
  width: 14px;
  height: 14px;
  font-size: 14px;
}

.rq-suggestion-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-primary);
}

.rq-suggestion-text-match {
  color: var(--el-color-primary);
  font-weight: 600;
}

:global(html.dark) .rq-metric-name {
  color: #2dd4bf;
}

/* ---- 查询历史记录下拉 ---- */
.rq-history-wrapper {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: 100%;
  z-index: 2000;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  box-shadow: var(--el-box-shadow-light);
  overflow: hidden;
}
</style>

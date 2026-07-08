<template>
  <div class="realtime-query-page art-full-height">
    <ElAlert
      v-if="alertVisible"
      type="info"
      closable
      show-icon
      class="quota-alert"
      style="margin: 5px 0 20px 0"
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
            <span class="rq-query-mode">PromQL语句</span>
            <ElButton text size="small" disabled>收藏夹</ElButton>
            <ElButton text size="small" disabled>历史记录</ElButton>
            <ElButton text size="small" disabled>语句模板</ElButton>
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
          <div class="rq-query-input">
            <ElAutocomplete
              v-model="promql"
              placeholder="请输入 PromQL 查询语句，如 up、rate(http_requests_total[5m])"
              :disabled="!selectedDatasource"
              clearable
              :input-style="promqlInputStyle"
              :fetch-suggestions="queryMetricSuggestions"
              :trigger-on-focus="false"
              popper-class="rq-promql-suggestions"
              @focus="prefetchMetricNames"
              @select="onPromqlSuggestionSelect"
              @keyup.enter="executeQuery"
            >
              <template #default="{ item }">
                <div class="rq-suggestion-item">
                  <span class="rq-suggestion-kind" aria-hidden="true">
                    <ArtSvgIcon icon="ri:line-chart-line" class="rq-suggestion-kind-icon" />
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
            :class="['rq-result-tab', 'is-disabled', { 'is-active': resultMode === 'graph' }]"
          >
            图表
          </span>
        </div>
        <div v-if="queryResult" class="rq-result-summary">
          <span>查询耗时: {{ queryDuration }}ms</span>
          <span>结果数: {{ totalResultCount }}</span>
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
          <ElTable
            :data="tableData"
            class="rq-result-table"
            style="width: 100%"
            :max-height="430"
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
                      <span class="rq-metric-sep">: </span>
                      <span class="rq-metric-label-val">{{ label.value }}</span>
                    </template>
                    <span class="rq-metric-brace">}</span>
                  </template>
                </div>
              </template>
            </ElTableColumn>
            <ElTableColumn prop="value" label="值" width="110" />
          </ElTable>
          <div v-if="queryResult && totalResultCount > tablePageSize" class="rq-table-pagination">
            <ElPagination
              v-model:current-page="tablePage"
              :page-size="tablePageSize"
              :total="totalResultCount"
              layout="prev, pager, next"
              small
            />
          </div>
        </div>

        <div v-else-if="queryResult && resultMode === 'graph'" class="rq-graph-wrap">
          <div class="rq-graph-toolbar">
            <ElSelect v-model="timeRangeMinutes" class="rq-graph-range" size="small">
              <ElOption :value="15" label="最近 15 分钟" />
              <ElOption :value="60" label="最近 1 小时" />
              <ElOption :value="360" label="最近 6 小时" />
              <ElOption :value="1440" label="最近 24 小时" />
            </ElSelect>
            <div class="rq-graph-toolbar-right">
              <span class="rq-graph-tool is-active">线</span>
              <span class="rq-graph-tool">点</span>
              <span class="rq-graph-tool">Show Legend</span>
            </div>
          </div>
          <div ref="chartRef" class="rq-chart" />
          <div v-if="chartEmpty" class="rq-chart-empty-overlay">
            <ElEmpty description="图表渲染开发中" :image-size="90" />
          </div>
          <div class="rq-series-list">
            <div class="rq-series-title">Series ({{ totalResultCount }})</div>
            <div v-for="(item, idx) in seriesPreview" :key="idx" class="rq-series-row">
              {{ item }}
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, onMounted, type CSSProperties } from 'vue'

const promqlInputStyle: CSSProperties = {
  fontFamily: 'Consolas, Monaco, sans-serif',
  fontSize: '12px',
  lineHeight: '16.8px',
  color: 'var(--el-text-color-primary)',
}
import { Search } from '@element-plus/icons-vue'
import {
  ElAlert,
  ElAutocomplete,
  ElButton,
  ElCheckbox,
  ElEmpty,
  ElOption,
  ElPagination,
  ElSelect,
  ElTable,
  ElTableColumn
} from 'element-plus'
import {
  fetchDatasourceList,
  resolveDatasourceUrl,
  type DatasourceHeader,
  type DatasourceItem,
  type DatasourceSubType
} from '@/api/datasource'
import {
  fetchPrometheusInstantQuery,
  fetchPrometheusLabelValues,
  fetchPrometheusRangeQuery,
  type PrometheusInstantResult
} from '@/api/kubernetes/prometheus'

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
  metricNameOptions.value = []
  metricNamesLoadedForDatasourceId.value = undefined
  queryResult.value = null
  queryError.value = ''
}

watch(sourceFilter, () => {
  metricNameOptions.value = []
  metricNamesLoadedForDatasourceId.value = undefined
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
const promql = ref('')
const autocompleteEnabled = ref(true)
const metricNameOptions = ref<string[]>([])
const metricNamesLoading = ref(false)
const metricNamesLoadedForDatasourceId = ref<number>()
const querying = ref(false)
const queryResult = ref<PrometheusInstantResult | null>(null)
const queryError = ref('')
const queryDuration = ref(0)

async function prefetchMetricNames() {
  const ds = selectedDatasource.value
  if (!ds || !autocompleteEnabled.value) return
  if (metricNamesLoading.value) return
  if (metricNamesLoadedForDatasourceId.value === ds.id && metricNameOptions.value.length > 0) return

  metricNamesLoading.value = true
  try {
    const dsUrl = resolveDatasourceUrl(ds)
    const { end, start } = resolveTimeRange()
    const res = await fetchPrometheusLabelValues(dsUrl, '__name__', {
      headers: getExternalProxyHeaders(ds),
      start,
      end
    })
    metricNameOptions.value = res.status === 'success' ? (res.data ?? []) : []
    metricNamesLoadedForDatasourceId.value = ds.id
  } catch {
    metricNameOptions.value = []
  } finally {
    metricNamesLoading.value = false
  }
}

function extractAutocompleteToken(query: string): string {
  const trimmed = query.slice(0)
  const match = trimmed.match(/([a-zA-Z_:][a-zA-Z0-9_:]*)$/)
  return match?.[1] ?? ''
}

function queryMetricSuggestions(
  queryString: string,
  cb: (items: Array<{ value: string }>) => void
) {
  if (!autocompleteEnabled.value) {
    cb([])
    return
  }
  const token = extractAutocompleteToken(queryString)
  if (!token) {
    cb([])
    return
  }
  const keyword = token.toLowerCase()
  const items = metricNameOptions.value
    .filter((item) => item.toLowerCase().includes(keyword))
    .slice(0, 50)
    .map((item) => ({ value: item }))
  cb(items)
}

function getSuggestionParts(value: string): Array<{ text: string; highlight: boolean }> {
  const token = extractAutocompleteToken(promql.value)
  if (!token) return [{ text: value, highlight: false }]

  const lowerValue = value.toLowerCase()
  const lowerToken = token.toLowerCase()
  const start = lowerValue.indexOf(lowerToken)
  if (start < 0) return [{ text: value, highlight: false }]

  const end = start + token.length
  const parts: Array<{ text: string; highlight: boolean }> = []
  if (start > 0) parts.push({ text: value.slice(0, start), highlight: false })
  parts.push({ text: value.slice(start, end), highlight: true })
  if (end < value.length) parts.push({ text: value.slice(end), highlight: false })
  return parts
}

function onPromqlSuggestionSelect(item: { value: string }) {
  const token = extractAutocompleteToken(promql.value)
  if (!token) {
    promql.value = item.value
    return
  }
  promql.value = promql.value.slice(0, promql.value.length - token.length) + item.value
}

async function executeQuery() {
  const ds = selectedDatasource.value
  if (!ds || !promql.value.trim()) return

  queryError.value = ''
  queryResult.value = null
  querying.value = true
  tablePage.value = 1

  const dsUrl = resolveDatasourceUrl(ds)
  const proxyHeaders = getExternalProxyHeaders(ds)
  const t0 = performance.now()

  try {
    const query = promql.value.trim()
    const res =
      resultMode.value === 'graph'
        ? await (() => {
            const { start, end } = resolveTimeRange()
            const step = calcStep(start, end)
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

const totalResultCount = computed(() => {
  return queryResult.value?.result?.length ?? 0
})

// ---- 结果展示 ----
const resultMode = ref<'table' | 'graph'>('table')
const tablePage = ref(1)
const tablePageSize = 15

const tableData = computed(() => {
  if (!queryResult.value) return []
  const all = queryResult.value.result
  const start = (tablePage.value - 1) * tablePageSize
  const end = start + tablePageSize

  return all.slice(start, end).map((item, idx) => {
    const metric = item.metric ?? {}
    const metricName = metric.__name__ || 'metric'
    const labels = Object.entries(metric)
      .filter(([key]) => key !== '__name__')
      .map(([key, value]) => ({ key, value: String(value ?? '') }))
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

const seriesPreview = computed(() => {
  if (!queryResult.value) return []
  return queryResult.value.result.slice(0, 8).map((item) => {
    const labels = Object.entries(item.metric ?? {})
      .map(([k, v]) => `${k}="${v}"`)
      .join(', ')
    return labels || '{}'
  })
})

watch(resultMode, async (mode, prevMode) => {
  if (mode === prevMode) return
  if (!selectedDatasource.value || !promql.value.trim() || querying.value) return
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

// ---- 图表 (预留) ----
const chartRef = ref<HTMLDivElement | null>(null)
const chartEmpty = ref(true)

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

onBeforeUnmount(() => {
  stopAutoRefresh()
})

onMounted(() => {
  loadPrometheusDatasources()
})
</script>

<style scoped>
.realtime-query-page {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 0;
  padding: 0;
}

.quota-alert {
  flex-shrink: 0;
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

.rq-query-mode {
  margin-right: 2px;
  font-size: 12px;
  color: var(--el-text-color-primary);
  font-weight: 500;
  white-space: nowrap;
}

.rq-query-toolbar-left :deep(.el-button),
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

.rq-query-input {
  flex: 1;
  min-width: 0;
  max-width: calc(100% - 360px);
}

.rq-query-input :deep(.el-autocomplete) {
  display: block;
  width: 100%;
}

.rq-query-input :deep(.el-input__wrapper),
.rq-query-input :deep(.el-input__inner),
.rq-query-input :deep(.el-input__wrapper input) {
  font-family: Consolas, Monaco, sans-serif !important;
  font-size: 12px !important;
  line-height: 16.8px !important;
  color: var(--el-text-color-primary) !important;
}

.rq-query-input :deep(.el-input__inner::placeholder),
.rq-query-input :deep(.el-input__wrapper input::placeholder),
.rq-query-input :deep(.el-input__placeholder) {
  font-family: Consolas, Monaco, sans-serif !important;
  font-size: 12px !important;
}

:global(.realtime-query-page .rq-query-input .el-input__inner),
:global(.realtime-query-page .rq-query-input .el-input__wrapper input) {
  font-family: Consolas, Monaco, sans-serif !important;
  font-size: 12px !important;
  line-height: 16.8px !important;
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
  padding: 0;
}

.rq-error-hint,
.rq-graph-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px 12px;
}

.rq-error-hint {
  padding: 16px;
  align-items: flex-start;
}

.rq-chart {
  width: 100%;
  height: 340px;
  position: relative;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  background: var(--el-fill-color-lighter);
}

.rq-chart-empty-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-bg-color);
  opacity: 0.85;
}

.rq-table-wrap {
  padding: 0 12px 12px;
}

.rq-table-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
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
  --el-table-text-color: var(--el-text-color-regular);
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
}

.rq-result-table :deep(.el-table__cell) {
  padding: 10px 0;
  font-size: 12px;
  vertical-align: top;
}

.rq-result-table :deep(.cell) {
  line-height: 1.5;
}

.rq-metric-cell {
  font-size: 12px;
  color: var(--el-text-color-regular);
  line-height: 1.7;
  word-break: break-all;
  font-family: Consolas, Monaco, sans-serif;
}

.rq-metric-name {
  color: #0f766e;
}

.rq-metric-brace,
.rq-metric-sep {
  color: var(--el-text-color-regular);
}

.rq-metric-label-key {
  color: var(--el-text-color-regular);
}

.rq-metric-label-val {
  color: var(--el-text-color-regular);
}

.rq-graph-wrap {
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  gap: 10px;
}

.rq-graph-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.rq-graph-range {
  width: 130px;
}

.rq-graph-toolbar-right {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.rq-graph-tool {
  cursor: default;
}

.rq-graph-tool.is-active {
  color: var(--el-color-primary);
}

.rq-series-list {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  background: var(--el-fill-color-blank);
  padding: 6px 10px;
  max-height: 140px;
  overflow: auto;
}

.rq-series-title {
  font-size: 12px;
  color: var(--el-text-color-regular);
  margin-bottom: 6px;
}

.rq-series-row {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rq-table-pagination {
  display: flex;
  justify-content: center;
  padding: 12px 0 0;
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
  font-family: Consolas, Monaco, sans-serif;
  font-size: 12px;
  line-height: 16.8px;
  color: var(--el-text-color-primary);
}

.rq-suggestion-text-match {
  color: var(--el-color-primary);
  font-weight: 600;
}

:global(html.dark) .rq-metric-name {
  color: #2dd4bf;
}
</style>

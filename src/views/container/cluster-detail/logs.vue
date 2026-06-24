<template>
  <ElCard shadow="never" class="art-table-card logs-page">
    <template #header>
      <div class="page-hd-row">
        <div class="page-hd-main">
          <div class="page-hd">日志采集</div>
          <div class="page-hd-desc">通过 Loki Service Proxy 查询，页面只保留数据源与标签过滤。</div>
        </div>

        <div class="page-hd-actions">
          <div class="page-hd-actions__stack">
            <div v-if="datasourceOptions.length" class="logs-toolbar-datasource">
              <span class="logs-toolbar-datasource__label">数据源</span>
              <ElSelect
                v-model="selectedDatasourceId"
                placeholder="请选择数据源"
                class="logs-toolbar-datasource__select"
                :loading="datasourceLoading"
              >
                <ElOption
                  v-for="item in datasourceOptions"
                  :key="item.id"
                  :label="item.name"
                  :value="item.id"
                />
              </ElSelect>

              <template v-if="selectedDatasource">
                <span class="logs-datasource-type-tag">
                  {{ selectedDatasource.subType.toUpperCase() }}
                </span>
                <span v-if="selectedDatasource.isDefault" class="logs-datasource-badge">默认</span>
                <span class="logs-toolbar-datasource__url">{{ datasourceUrlText }}</span>
              </template>
            </div>

            <div class="page-hd-actions__right">
              <ElSelect v-model="timeRangeMinutes" class="logs-time-range">
                <ElOption :value="15" label="最近 15 分钟" />
                <ElOption :value="60" label="最近 1 小时" />
                <ElOption :value="360" label="最近 6 小时" />
                <ElOption :value="1440" label="最近 24 小时" />
              </ElSelect>
              <ElInputNumber
                v-model="lineLimit"
                :min="10"
                :max="5000"
                :step="50"
                controls-position="right"
                class="logs-limit-input"
              />
              <ElButton :loading="resolving" plain @click="refreshContext">刷新</ElButton>
              <ElButton type="primary" :loading="loading" :disabled="!canQuery" @click="loadLogs">
                查询
              </ElButton>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-if="!detectResolved" class="logs-loading-state">
      <div
        class="logs-loading-card"
        v-loading="true"
        element-loading-text="正在加载日志数据源..."
      ></div>
    </div>

    <div v-else-if="!logAccessReady" class="logs-unavailable-state">
      <div class="logs-unavailable-card">
        <div class="logs-unavailable-icon">!</div>
        <div class="logs-unavailable-title">{{ logUnavailableTitle }}</div>
        <div class="logs-unavailable-desc">{{ logUnavailableDescription }}</div>

        <div class="logs-unavailable-guide">
          <div>当前页不再维护数据源，请先到“数据源”页面完成配置。</div>
          <div>
            日志数据源需为 <code>Loki</code>，并在 <code>config.log.url</code> 中填写集群内地址。
          </div>
          <div>示例：<code>http://loki-distributed-gateway.loki:3100</code></div>
        </div>
      </div>
    </div>

    <template v-else>
      <div class="logs-builder">
        <div class="logs-builder__header">
          <div class="logs-builder__title">标签过滤</div>
          <ElButton size="small" plain @click="addFilter">添加条件</ElButton>
        </div>

        <div v-if="filters.length" class="logs-filter-list">
          <div v-for="filter in filters" :key="filter.id" class="logs-filter-row">
            <ElSelect
              v-model="filter.key"
              placeholder="标签"
              class="logs-filter-key"
              filterable
              @change="onFilterKeyChange(filter)"
            >
              <ElOption v-for="item in labelKeys" :key="item" :label="item" :value="item" />
            </ElSelect>

            <ElSelect v-model="filter.operator" class="logs-filter-operator">
              <ElOption v-for="item in operatorOptions" :key="item" :label="item" :value="item" />
            </ElSelect>

            <ElSelect
              v-model="filter.value"
              placeholder="标签值"
              class="logs-filter-value"
              filterable
              allow-create
              default-first-option
              :loading="filter.loading"
              @visible-change="(visible) => visible && ensureFilterValues(filter)"
            >
              <ElOption
                v-for="item in filter.options"
                :key="`${filter.key}-${item}`"
                :label="item"
                :value="item"
              />
            </ElSelect>

            <ElButton text type="danger" @click="removeFilter(filter.id)">删除</ElButton>
          </div>
        </div>
        <div v-else class="logs-builder__empty">未设置标签条件，默认可查询全部日志流。</div>

        <div class="logs-builder__meta">
          <span class="logs-builder__meta-item">Service: {{ serviceText }}</span>
          <span class="logs-builder__meta-item">Proxy: {{ proxyTargetText }}</span>
        </div>

        <div class="logs-query-row">
          <ElInput
            v-model="keyword"
            placeholder="日志内容关键字（可选）"
            clearable
            class="logs-search"
            @keyup.enter="loadLogs"
            @clear="syncGeneratedQuery"
          />
          <div class="logs-query-editor-wrap">
            <ElInput
              v-model="queryDraft"
              placeholder='支持手写 LogQL，例如 {namespace="default"} |= "error"'
              class="logs-query-editor"
              @input="handleQueryDraftInput"
              @keyup.enter="loadLogs"
            />
            <ElButton
              v-if="queryDirty"
              text
              type="primary"
              class="logs-query-reset"
              @click="resetQueryDraft"
            >
              恢复生成
            </ElButton>
          </div>
        </div>
      </div>

      <ElTable
        v-loading="loading"
        :data="logs"
        :row-key="getLogRowKey"
        :expand-row-keys="expandedRowKeys"
        stripe
        size="small"
        class="logs-table"
        @expand-change="handleExpandChange"
      >
        <template #empty>
          <div class="logs-empty">{{ emptyText }}</div>
        </template>
        <ElTableColumn type="expand" width="44">
          <template #default="{ row }">
            <div class="logs-inline-detail">
              <div class="logs-inline-detail__section">
                <div class="logs-inline-detail__title">字段</div>
                <div class="logs-field-list">
                  <div
                    v-for="item in getLogFieldEntries(row as LogTableRow)"
                    :key="`${(row as LogTableRow).id}-${item.key}`"
                    class="logs-field-item"
                  >
                    <span class="logs-field-item__key">{{ item.key }}</span>
                    <span class="logs-field-item__value">{{ item.value }}</span>
                  </div>
                </div>
              </div>

              <div class="logs-inline-detail__section">
                <div class="logs-inline-detail__title">日志内容</div>
                <pre class="logs-detail-code">{{ (row as LogTableRow).raw }}</pre>
              </div>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="time" label="时间" width="190" />
        <ElTableColumn prop="ns" label="命名空间" width="140" />
        <ElTableColumn prop="pod" label="Pod" min-width="220" show-overflow-tooltip />
        <ElTableColumn prop="container" label="容器" width="180" show-overflow-tooltip />
        <ElTableColumn prop="msg" label="摘要" min-width="420" show-overflow-tooltip />
        <ElTableColumn label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" @click="toggleLogDetail(row as LogTableRow)">
              {{ isExpanded(row as LogTableRow) ? '收起' : '详情' }}
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </template>
  </ElCard>
</template>

<script setup lang="ts">
  import { computed, inject, ref, watch } from 'vue'
  import { ElMessage } from 'element-plus'
  import { fetchDatasourceList, resolveDatasourceUrl, type DatasourceItem } from '@/api/datasource'
  import { kubeProxyAxios } from '@/api/kubeProxy'
  import { fetchK8sService, fetchK8sServiceList, type K8sService } from '@/api/kubernetes/service'
  import { clusterDetailContextKey } from './context'

  defineOptions({ name: 'ClusterDetailLogs' })

  type ParsedDatasourceEndpoint = {
    serviceName: string
    namespace?: string
    host: string
    port: number
    protocol: 'http' | 'https'
  }

  type LokiLabelOperator = '=' | '!=' | '=~' | '!~'

  interface LokiQueryRangeResponse {
    status?: string
    data?: {
      result?: Array<{
        stream?: Record<string, string>
        values?: Array<[string, string]>
      }>
    }
    error?: string
  }

  interface LogTableRow {
    id: string
    time: string
    ns: string
    pod: string
    container: string
    msg: string
    raw: string
    labels: Record<string, string>
  }

  interface FilterRow {
    id: number
    key: string
    operator: LokiLabelOperator
    value: string
    options: string[]
    loading: boolean
  }

  const ctxRef = inject(clusterDetailContextKey)!

  const operatorOptions: LokiLabelOperator[] = ['=', '!=', '=~', '!~']

  const datasourceLoading = ref(false)
  const resolving = ref(false)
  const loading = ref(false)
  const detectResolved = ref(false)
  const errorMessage = ref('')

  const datasourceOptions = ref<DatasourceItem[]>([])
  const selectedDatasourceId = ref<number>()
  const timeRangeMinutes = ref(60)
  const lineLimit = ref(200)
  const keyword = ref('')
  const queryDraft = ref('{namespace=~".+"}')
  const queryDirty = ref(false)

  const resolvedService = ref<K8sService | null>(null)
  const resolvedServiceNamespace = ref('')
  const resolvedEndpoint = ref<ParsedDatasourceEndpoint | null>(null)

  const labelKeys = ref<string[]>([])
  const filters = ref<FilterRow[]>([])
  const filterSeed = ref(1)
  const labelValueCache = ref<Record<string, string[]>>({})

  const logs = ref<LogTableRow[]>([])
  const expandedRowKeys = ref<string[]>([])

  const currentCluster = computed(() => ctxRef.value.name)
  const selectedDatasource = computed(
    () => datasourceOptions.value.find((item) => item.id === selectedDatasourceId.value) ?? null
  )
  const datasourceUrlText = computed(() =>
    selectedDatasource.value ? resolveDatasourceUrl(selectedDatasource.value) : '-'
  )
  const serviceText = computed(() => {
    const name = resolvedService.value?.metadata?.name
    if (!name || !resolvedServiceNamespace.value) return '-'
    const port = resolvedEndpoint.value?.port
    return `${name}.${resolvedServiceNamespace.value}.svc${port ? `:${port}` : ''}`
  })
  const proxyTargetText = computed(() => {
    const name = resolvedService.value?.metadata?.name
    const port = resolvedEndpoint.value?.port
    if (!name || !port || !resolvedServiceNamespace.value) return '-'
    return `${name}:${port} /api/v1/namespaces/${resolvedServiceNamespace.value}/services/${name}:${port}/proxy/loki/api/v1/query_range`
  })

  const generatedQuery = computed(() => {
    const selectorParts = filters.value
      .map((item) => ({
        key: item.key.trim(),
        operator: item.operator,
        value: item.value.trim()
      }))
      .filter((item) => item.key && item.value)
      .map(
        (item) =>
          `${item.key}${item.operator}"${item.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
      )

    const selector = selectorParts.length ? `{${selectorParts.join(', ')}}` : '{namespace=~".+"}'
    const text = keyword.value.trim()
    return text ? `${selector} |= "${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : selector
  })

  const effectiveQuery = computed(() =>
    queryDirty.value ? queryDraft.value.trim() : generatedQuery.value
  )
  const canQuery = computed(
    () =>
      Boolean(selectedDatasource.value) &&
      Boolean(resolvedEndpoint.value) &&
      Boolean(effectiveQuery.value)
  )
  const logAccessReady = computed(
    () =>
      Boolean(selectedDatasource.value) && Boolean(resolvedEndpoint.value) && !errorMessage.value
  )
  const logUnavailableTitle = computed(() => {
    if (!datasourceOptions.value.length) return '未配置 Loki 数据源'
    if (!resolvedEndpoint.value) return '未找到可用 Loki Service'
    return '当前日志查询不可用'
  })
  const logUnavailableDescription = computed(
    () => errorMessage.value || '请先完成 Loki 查询前置条件'
  )
  const emptyText = computed(() => {
    if (!effectiveQuery.value) return '请输入 LogQL 查询语句'
    if (loading.value) return '加载日志中...'
    return '暂无日志'
  })

  function syncGeneratedQuery() {
    if (!queryDirty.value) queryDraft.value = generatedQuery.value
  }

  function handleQueryDraftInput() {
    queryDirty.value = queryDraft.value.trim() !== generatedQuery.value
  }

  function resetQueryDraft() {
    queryDraft.value = generatedQuery.value
    queryDirty.value = false
  }

  function addFilter() {
    filters.value.push({
      id: filterSeed.value++,
      key: '',
      operator: '=',
      value: '',
      options: [],
      loading: false
    })
  }

  function removeFilter(id: number) {
    filters.value = filters.value.filter((item) => item.id !== id)
  }

  function onFilterKeyChange(filter: FilterRow) {
    filter.value = ''
    filter.options = []
    void ensureFilterValues(filter)
  }

  function parseDatasourceEndpoint(rawUrl: string): ParsedDatasourceEndpoint | null {
    if (!rawUrl) return null
    try {
      const parsed = new URL(rawUrl)
      const protocol =
        parsed.protocol === 'https:' ? 'https' : parsed.protocol === 'http:' ? 'http' : null
      if (!protocol) return null
      const parts = parsed.hostname.split('.').filter(Boolean)
      if (!parts.length) return null
      const svcIndex = parts.indexOf('svc')
      const namespace =
        svcIndex >= 2 ? parts[1] : svcIndex === -1 && parts.length >= 2 ? parts[1] : ''
      const port =
        parsed.port && Number.parseInt(parsed.port, 10) > 0
          ? Number.parseInt(parsed.port, 10)
          : protocol === 'https'
            ? 443
            : 80
      return {
        serviceName: parts[0] ?? '',
        namespace,
        host: parsed.hostname,
        port,
        protocol
      }
    } catch {
      return null
    }
  }

  function serviceProxyBase(path: string): string {
    const endpoint = resolvedEndpoint.value
    const service = resolvedService.value?.metadata?.name
    const namespace = resolvedServiceNamespace.value
    if (!endpoint || !service || !namespace) return ''
    return (
      `/pixiu/proxy/${encodeURIComponent(currentCluster.value)}/api/v1/namespaces/${encodeURIComponent(namespace)}` +
      `/services/${encodeURIComponent(service)}:${endpoint.port}/proxy${path}`
    )
  }

  async function loadDatasources() {
    datasourceLoading.value = true
    try {
      const { items } = await fetchDatasourceList({ page: 1, limit: 200 })
      datasourceOptions.value = items.filter(
        (item) =>
          item.clusterName === currentCluster.value && item.type === 0 && item.subType === 'loki'
      )
      selectedDatasourceId.value =
        datasourceOptions.value.find((item) => item.isDefault)?.id ?? datasourceOptions.value[0]?.id
    } finally {
      datasourceLoading.value = false
    }
  }

  async function resolveServiceByEndpoint(endpoint: ParsedDatasourceEndpoint): Promise<{
    service: K8sService
    namespace: string
  }> {
    if (endpoint.namespace) {
      return {
        service: await fetchK8sService(
          currentCluster.value,
          endpoint.namespace,
          endpoint.serviceName
        ),
        namespace: endpoint.namespace
      }
    }

    const { items } = await fetchK8sServiceList(currentCluster.value, { page: 1, limit: 999999 })
    const matchedItems = items.filter((item) => item.metadata?.name === endpoint.serviceName)
    if (matchedItems.length > 1) {
      const names = matchedItems
        .map((item) => `${item.metadata?.name}.${item.metadata?.namespace ?? 'default'}`)
        .join(', ')
      throw new Error(`发现多个同名 Service，请在 URL 中带上命名空间。候选: ${names}`)
    }
    const matched = matchedItems[0]
    const namespace = matched?.metadata?.namespace ?? ''
    if (!matched || !namespace) {
      throw new Error(`未找到 Service ${endpoint.host}`)
    }
    return { service: matched, namespace }
  }

  async function loadLabelKeys() {
    const url = serviceProxyBase('/loki/api/v1/labels')
    if (!url) return
    const nowNs = Date.now() * 1_000_000
    const startNs = nowNs - timeRangeMinutes.value * 60 * 1_000_000_000
    const { data } = await kubeProxyAxios.get<{ status?: string; data?: string[]; error?: string }>(
      url,
      {
        params: {
          start: String(startNs),
          end: String(nowNs)
        }
      }
    )
    if (data?.status !== 'success') throw new Error(data?.error || '加载标签失败')
    labelKeys.value = (data.data ?? []).filter(Boolean).sort()
  }

  async function ensureFilterValues(filter: FilterRow) {
    const key = filter.key.trim()
    if (!key) return
    if (labelValueCache.value[key]) {
      filter.options = labelValueCache.value[key]
      return
    }

    const url = serviceProxyBase(`/loki/api/v1/label/${encodeURIComponent(key)}/values`)
    if (!url) return
    const nowNs = Date.now() * 1_000_000
    const startNs = nowNs - timeRangeMinutes.value * 60 * 1_000_000_000
    filter.loading = true
    try {
      const { data } = await kubeProxyAxios.get<{
        status?: string
        data?: string[]
        error?: string
      }>(url, {
        params: {
          start: String(startNs),
          end: String(nowNs)
        }
      })
      if (data?.status !== 'success') throw new Error(data?.error || '加载标签值失败')
      const values = (data.data ?? []).filter(Boolean).sort()
      labelValueCache.value[key] = values
      filter.options = values
    } finally {
      filter.loading = false
    }
  }

  async function resolveServiceContext() {
    const datasource = selectedDatasource.value
    const rawUrl = datasource ? resolveDatasourceUrl(datasource) : ''

    errorMessage.value = ''
    resolvedService.value = null
    resolvedServiceNamespace.value = ''
    resolvedEndpoint.value = null
    labelKeys.value = []
    labelValueCache.value = {}
    logs.value = []
    expandedRowKeys.value = []

    if (!datasource) return
    if (!rawUrl) {
      errorMessage.value = '当前数据源没有配置 config.log.url'
      return
    }

    const endpoint = parseDatasourceEndpoint(rawUrl)
    if (!endpoint?.serviceName) {
      errorMessage.value = '数据源 URL 不是合法的 Loki HTTP 地址'
      return
    }

    resolving.value = true
    try {
      const { service, namespace } = await resolveServiceByEndpoint(endpoint)
      resolvedService.value = service
      resolvedServiceNamespace.value = namespace
      resolvedEndpoint.value = endpoint
      await loadLabelKeys()
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '解析 Loki Service 失败'
    } finally {
      resolving.value = false
    }
  }

  async function refreshContext() {
    detectResolved.value = false
    await loadDatasources()
    if (selectedDatasource.value) {
      await resolveServiceContext()
    }
    detectResolved.value = true
  }

  function formatNsTimestamp(ns: string): string {
    const numeric = Number.parseInt(ns, 10)
    if (!Number.isFinite(numeric)) return ns
    const ms = Math.floor(numeric / 1_000_000)
    const date = new Date(ms)
    if (Number.isNaN(date.getTime())) return ns
    const pad = (value: number, size = 2) => String(value).padStart(size, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
  }

  function parseLokiError(error: unknown): string {
    if (typeof error === 'string') return error
    if (error && typeof error === 'object') {
      const axiosLike = error as { message?: string; response?: { data?: unknown } }
      const data = axiosLike.response?.data
      if (typeof data === 'string') return data || axiosLike.message || '请求 Loki 失败'
      if (data && typeof data === 'object') {
        const payload = data as { message?: string; error?: string }
        return payload.error || payload.message || axiosLike.message || '请求 Loki 失败'
      }
      if (axiosLike.message) return axiosLike.message
    }
    return '请求 Loki 失败'
  }

  async function loadLogs() {
    if (!canQuery.value) return
    const url = serviceProxyBase('/loki/api/v1/query_range')
    if (!url) return

    loading.value = true
    try {
      const nowNs = Date.now() * 1_000_000
      const startNs = nowNs - timeRangeMinutes.value * 60 * 1_000_000_000
      const { data } = await kubeProxyAxios.get<LokiQueryRangeResponse>(url, {
        params: {
          query: effectiveQuery.value,
          limit: lineLimit.value,
          start: String(startNs),
          end: String(nowNs),
          direction: 'BACKWARD'
        }
      })

      if (data?.status !== 'success') {
        throw new Error(data?.error || 'Loki 查询失败')
      }

      expandedRowKeys.value = []
      logs.value = (data.data?.result ?? [])
        .flatMap((stream, streamIndex) =>
          (stream.values ?? []).map(([timestamp, line], lineIndex) => ({
            id: `${timestamp}-${streamIndex}-${lineIndex}`,
            time: formatNsTimestamp(timestamp),
            ns: stream.stream?.namespace || '-',
            pod: stream.stream?.pod || '-',
            container: stream.stream?.container || '-',
            msg: line,
            raw: line,
            labels: stream.stream ?? {}
          }))
        )
        .sort((a, b) => (a.time < b.time ? 1 : -1))
    } catch (error) {
      logs.value = []
      ElMessage.error(parseLokiError(error))
    } finally {
      loading.value = false
    }
  }

  function getLogRowKey(row: LogTableRow) {
    return row.id
  }

  function handleExpandChange(row: LogTableRow, expanded: LogTableRow[] | boolean) {
    const isRowExpanded = Array.isArray(expanded)
      ? expanded.some((item) => item.id === row.id)
      : expanded
    expandedRowKeys.value = isRowExpanded ? [row.id] : []
  }

  function toggleLogDetail(row: LogTableRow) {
    const next = new Set(expandedRowKeys.value)
    if (next.has(row.id)) next.delete(row.id)
    else next.add(row.id)
    expandedRowKeys.value = Array.from(next)
  }

  function isExpanded(row: LogTableRow) {
    return expandedRowKeys.value.includes(row.id)
  }

  function getLogFieldEntries(row: LogTableRow) {
    return Object.entries(row.labels).map(([key, value]) => ({ key, value }))
  }

  watch(keyword, () => {
    if (!queryDirty.value) queryDraft.value = generatedQuery.value
  })

  watch(
    currentCluster,
    async () => {
      queryDirty.value = false
      queryDraft.value = generatedQuery.value
      filters.value = []
      await refreshContext()
    },
    { immediate: true }
  )

  watch(selectedDatasourceId, async () => {
    filters.value = []
    await resolveServiceContext()
  })
</script>

<style scoped>
  .logs-page {
    min-height: 100%;
  }

  .logs-unavailable-state {
    min-height: 420px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 0;
  }

  .logs-loading-state {
    min-height: 220px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 0;
  }

  .logs-loading-card {
    width: 100%;
    min-height: 160px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 16px;
    background: linear-gradient(180deg, #fffaf0 0%, #fffdf8 100%);
  }

  .logs-unavailable-card {
    width: min(820px, 100%);
    padding: 32px 28px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 16px;
    background: linear-gradient(180deg, #fffaf0 0%, #fffdf8 100%);
    box-shadow: 0 10px 30px rgb(0 0 0 / 4%);
    text-align: center;
  }

  .logs-unavailable-icon {
    width: 52px;
    height: 52px;
    margin: 0 auto 16px;
    border-radius: 999px;
    background: #fff1cc;
    color: #d97706;
    font-size: 28px;
    font-weight: 700;
    line-height: 52px;
  }

  .logs-unavailable-title {
    font-size: 22px;
    font-weight: 600;
    color: #b45309;
  }

  .logs-unavailable-desc {
    margin-top: 12px;
    font-size: 14px;
    line-height: 1.7;
    color: #92400e;
    word-break: break-word;
  }

  .logs-unavailable-guide {
    margin-top: 20px;
    padding: 18px 20px;
    border-radius: 12px;
    background: rgb(255 255 255 / 72%);
    color: #7c2d12;
    text-align: left;
    line-height: 1.8;
  }

  .logs-unavailable-guide code {
    padding: 2px 6px;
    border-radius: 6px;
    background: #fff3d6;
    color: #9a3412;
    font-family: Consolas, 'Courier New', monospace;
  }

  .page-hd {
    font-size: 15px;
    font-weight: 600;
  }

  .page-hd-desc {
    margin-top: 6px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .page-hd-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    flex-wrap: wrap;
  }

  .page-hd-main {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    flex: 0 0 auto;
  }

  .page-hd-actions {
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    flex: 1 1 720px;
    min-width: 0;
  }

  .page-hd-actions__stack {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    margin-left: auto;
    min-width: 0;
  }

  .page-hd-actions__right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: flex-end;
    margin-left: auto;
  }

  .logs-toolbar-datasource {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    min-width: 0;
    justify-content: flex-end;
  }

  .logs-toolbar-datasource__label {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    white-space: nowrap;
  }

  .logs-toolbar-datasource__select {
    width: 240px;
    max-width: 100%;
  }

  .logs-toolbar-datasource__url {
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    color: #92400e;
  }

  .logs-time-range {
    width: 180px;
  }

  .logs-limit-input {
    width: 148px;
  }

  .logs-datasource-type-tag {
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 12px;
    border: 1px solid #f3d5a2;
    background: #fff7e8;
    color: #92400e;
  }

  .logs-datasource-badge {
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 12px;
    background: #d97706;
    color: #fff;
  }

  .logs-builder {
    padding: 14px 14px 12px;
    margin-bottom: 12px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    background: color-mix(in srgb, var(--el-fill-color-light) 60%, transparent);
  }

  .logs-builder__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  .logs-builder__title {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .logs-builder__empty {
    padding: 8px 0 12px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .logs-filter-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .logs-filter-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .logs-filter-key {
    width: 180px;
  }

  .logs-filter-operator {
    width: 100px;
  }

  .logs-filter-value {
    width: 260px;
    max-width: 100%;
  }

  .logs-builder__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 14px;
    margin-top: 14px;
  }

  .logs-builder__meta-item {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    font-family: Consolas, 'Courier New', monospace;
  }

  .logs-query-row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 14px;
  }

  .logs-search {
    width: 320px;
    max-width: 100%;
  }

  .logs-query-editor-wrap {
    flex: 1;
    min-width: 280px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .logs-query-editor {
    flex: 1;
  }

  .logs-query-editor :deep(.el-input__wrapper) {
    padding: 8px 12px;
    min-height: 36px;
    font-family: Consolas, 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.5;
    color: var(--el-color-success);
    background: var(--el-fill-color-darker);
  }

  .logs-query-editor :deep(input) {
    color: var(--el-color-success);
  }

  .logs-query-reset {
    flex: none;
  }

  .logs-empty {
    padding: 18px 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }

  .logs-table :deep(.el-table__expanded-cell) {
    padding: 0;
    background: #131a22;
  }

  .logs-inline-detail {
    padding: 16px 18px;
    border-left: 3px solid #73bf69;
    background: linear-gradient(180deg, rgba(20, 26, 33, 0.98) 0%, rgba(15, 20, 26, 0.98) 100%);
  }

  .logs-inline-detail__section + .logs-inline-detail__section {
    margin-top: 16px;
  }

  .logs-inline-detail__title {
    margin-bottom: 10px;
    font-size: 13px;
    font-weight: 600;
    color: #c7d0d9;
  }

  .logs-field-list {
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.02);
  }

  .logs-field-item {
    display: grid;
    grid-template-columns: 180px minmax(0, 1fr);
    gap: 12px;
    padding: 8px 12px;
    font-size: 12px;
    line-height: 1.6;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .logs-field-item:first-child {
    border-top: none;
  }

  .logs-field-item__key {
    color: #8fa2b7;
    font-family: Consolas, 'Courier New', monospace;
  }

  .logs-field-item__value {
    color: #e6edf3;
    word-break: break-word;
  }

  .logs-detail-code {
    margin: 0;
    padding: 12px;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 12px;
    line-height: 1.6;
    color: #e6edf3;
    font-family: Consolas, 'Courier New', monospace;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.02);
  }

  @media (max-width: 768px) {
    .page-hd-actions__stack {
      width: 100%;
      align-items: stretch;
      margin-left: 0;
    }

    .page-hd-actions {
      width: 100%;
      flex: 1 1 100%;
    }

    .page-hd-actions__right {
      justify-content: flex-start;
      margin-left: 0;
    }

    .logs-toolbar-datasource {
      align-items: stretch;
      justify-content: flex-start;
    }

    .logs-toolbar-datasource__select,
    .logs-time-range {
      width: 100%;
    }

    .logs-toolbar-datasource__url {
      max-width: 100%;
    }
  }
</style>

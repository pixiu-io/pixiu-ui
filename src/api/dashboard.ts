import { resolveDatasourceUrl, type DatasourceItem } from '@/api/datasource'
import {
  buildPrometheusRequestOptions,
  fetchPrometheusInstantQuery,
  fetchPrometheusLabelValues,
  fetchPrometheusRangeQuery,
  type PrometheusInstantResult,
  type PrometheusQueryOptions,
  type PrometheusQueryResponse
} from '@/api/kubernetes/prometheus'
import {
  buildDashboardPodVariableQuery,
  buildDashboardVariableSelector,
  getDashboardDefinition,
  getDashboardPanelSpecs,
  type DashboardPanelSpec
} from '@/utils/metrics/dashboard-catalog'

export type DashboardPanelStatus = 'success' | 'no_data' | 'metric_missing' | 'error'
export type DashboardPanelKind = 'stat' | 'gauge' | 'bar' | 'line' | 'status' | 'empty'

export interface DashboardSection {
  id: string
  title: string
  icon: string
  children?: string[]
}

export interface DashboardPanelDefinition {
  id: string
  section: string
  title: string
  description?: string
  kind: DashboardPanelKind
  unit?: string
  span: number
  /** 全部存在时才查询 */
  required_metrics?: string[]
  /** 任一存在即可查询（与 required_metrics 二选一） */
  required_metrics_any?: string[]
}

export interface DashboardDefinition {
  sections: DashboardSection[]
  panels: DashboardPanelDefinition[]
}

export interface DashboardFilters {
  namespace?: string
  node?: string
  workload_kind?: string
  workload_name?: string
  pod?: string
}

export interface DashboardWorkloadOption {
  kind: string
  name: string
}

export interface DashboardVariables {
  namespaces: string[]
  nodes: string[]
  workloads: DashboardWorkloadOption[]
  pods: string[]
}

export interface DashboardPoint {
  timestamp: number
  value: string
}

export interface DashboardSeries {
  metric: Record<string, string>
  values: DashboardPoint[]
}

export interface DashboardPanelResult {
  id: string
  status: DashboardPanelStatus
  message?: string
  series: DashboardSeries[]
}

export interface DashboardQueryResult {
  datasource_id: number
  started_at: number
  ended_at: number
  results: DashboardPanelResult[]
}

interface PrometheusDatasourceContext {
  url: string
  options: PrometheusQueryOptions
}

interface MetricNameCacheEntry {
  expiresAt: number
  promise: Promise<Set<string>>
}

const QUERY_CONCURRENCY = 6
const METRIC_NAMES_CACHE_TTL = 5 * 60 * 1000
const metricNamesCache = new Map<string, MetricNameCacheEntry>()

function resolvePrometheusContext(datasource: DatasourceItem): PrometheusDatasourceContext {
  if (datasource.subType !== 'prometheus') {
    throw new Error('请选择 Prometheus 数据源')
  }
  const url = resolveDatasourceUrl(datasource)
  if (!url) throw new Error('当前数据源未配置接入地址')
  if (!datasource.external && !datasource.clusterName) {
    throw new Error('内部数据源缺少关联集群')
  }
  return {
    url,
    options: {
      ...buildPrometheusRequestOptions(datasource),
      skipErrorNotification: true
    }
  }
}

function ensurePrometheusSuccess(response: PrometheusQueryResponse): PrometheusInstantResult {
  if (response.status !== 'success') {
    throw new Error(response.error || 'Prometheus 查询失败')
  }
  return response.data
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error) {
    const candidate = error as {
      message?: string
      response?: { data?: { message?: string; error?: string } }
    }
    return (
      candidate.response?.data?.message ||
      candidate.response?.data?.error ||
      candidate.message ||
      '请求异常'
    )
  }
  return '请求异常'
}

function normalizeSeries(result: PrometheusInstantResult): DashboardSeries[] {
  const series: DashboardSeries[] = []
  for (const item of result.result ?? []) {
    const pairs = item.values ?? (item.value ? [item.value] : [])
    const values = pairs.flatMap(([timestamp, value]) => {
      const numericTimestamp = Number(timestamp)
      const numericValue = Number(value)
      if (!Number.isFinite(numericTimestamp) || !Number.isFinite(numericValue)) return []
      return [{ timestamp: numericTimestamp, value: String(value) }]
    })
    if (values.length) {
      series.push({
        metric: { ...(item.metric ?? {}) },
        values
      })
    }
  }
  return series
}

async function instantQuery(
  context: PrometheusDatasourceContext,
  expression: string,
  time = Math.floor(Date.now() / 1000)
): Promise<DashboardSeries[]> {
  const response = await fetchPrometheusInstantQuery(context.url, expression, time, context.options)
  return normalizeSeries(ensurePrometheusSuccess(response))
}

function uniqueLabels(series: DashboardSeries[], label: string): string[] {
  return [
    ...new Set(series.map((item) => item.metric[label]?.trim()).filter(Boolean) as string[])
  ].sort()
}

function collectWorkloads(
  results: Array<{ kind: string; label: string; series: DashboardSeries[] }>
): DashboardWorkloadOption[] {
  const workloads = new Map<string, DashboardWorkloadOption>()
  for (const result of results) {
    for (const name of uniqueLabels(result.series, result.label)) {
      workloads.set(`${result.kind}\u0000${name}`, { kind: result.kind, name })
    }
  }
  return [...workloads.values()].sort((left, right) =>
    left.kind === right.kind
      ? left.name.localeCompare(right.name)
      : left.kind.localeCompare(right.kind)
  )
}

async function loadMetricNames(
  datasource: DatasourceItem,
  context: PrometheusDatasourceContext,
  start: number,
  end: number
): Promise<Set<string> | null> {
  const cacheKey = `${datasource.id}:${datasource.resourceVersion}`
  const cached = metricNamesCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.promise
  }

  const promise = fetchPrometheusLabelValues(context.url, '__name__', {
    ...context.options,
    start,
    end
  }).then((response) => {
    if (response.status !== 'success') {
      throw new Error(response.error || 'Prometheus 指标列表加载失败')
    }
    return new Set(response.data ?? [])
  })
  metricNamesCache.set(cacheKey, {
    expiresAt: Date.now() + METRIC_NAMES_CACHE_TTL,
    promise
  })

  try {
    return await promise
  } catch {
    metricNamesCache.delete(cacheKey)
    return null
  }
}

function hasRequiredMetrics(spec: DashboardPanelSpec, metricNames: Set<string> | null): boolean {
  // 指标列表为空时仍尝试查询，避免因 label API 不完整导致整页误判「指标未采集」
  if (!metricNames || metricNames.size === 0) return true
  if (spec.required_metrics_any?.length) {
    return spec.required_metrics_any.some((name) => metricNames.has(name))
  }
  const required = spec.required_metrics ?? []
  if (!required.length) return true
  return required.every((name) => metricNames.has(name))
}

async function runPanelQuery(
  context: PrometheusDatasourceContext,
  spec: DashboardPanelSpec,
  expression: string,
  start: number,
  end: number,
  step: number
): Promise<DashboardSeries[]> {
  const response = spec.rangeQuery
    ? await fetchPrometheusRangeQuery(
        context.url,
        expression,
        start,
        end,
        String(Math.max(1, step)),
        context.options
      )
    : await fetchPrometheusInstantQuery(context.url, expression, end, context.options)
  return normalizeSeries(ensurePrometheusSuccess(response))
}

async function queryQuantileParallel(
  context: PrometheusDatasourceContext,
  spec: DashboardPanelSpec,
  start: number,
  end: number,
  step: number
): Promise<DashboardSeries[]> {
  const { metric, thresholds, unitFactor = 1, selector, fallbackMetrics = [] } = spec.quantileQueries!
  const metricsToTry = [metric, ...fallbackMetrics.filter((item) => item && item !== metric)]

  const parts = await Promise.all(
    thresholds.map(async (quantile) => {
      for (const candidate of metricsToTry) {
        try {
          const metricExpr = selector?.trim() ? `${candidate}{${selector.trim()}}` : candidate
          const bucketRate = `sum(rate(${metricExpr}[5m])) by (le)`
          const expression = `histogram_quantile(${quantile}, ${bucketRate}) * ${unitFactor}`
          const series = await runPanelQuery(context, spec, expression, start, end, step)
          if (!series.length) continue
          return series.map((item) => ({
            metric: { ...item.metric, quantile: String(quantile) },
            values: item.values
          }))
        } catch {
          // try next metric
        }
      }
      return [] as DashboardSeries[]
    })
  )

  return parts.flat()
}

function expressionMentionsMetric(expression: string, metric: string): boolean {
  return expression.includes(metric)
}

/** 若已知指标清单，把引用已有指标的候选排到前面，减少无效回退次数 */
function orderExpressionsByMetricAvailability(
  expressions: string[],
  metricNames: Set<string> | null
): string[] {
  if (!metricNames || metricNames.size === 0) return expressions
  const networkHints = [
    'container_network_transmit_bytes_total',
    'container_network_receive_bytes_total',
    'container_network_transmit_packets_total',
    'container_network_receive_packets_total',
    'node_network_transmit_bytes_total',
    'node_network_receive_bytes_total',
    'node_network_transmit_packets_total',
    'node_network_receive_packets_total'
  ]
  const scored = expressions.map((expression, index) => {
    const mentioned = networkHints.filter((name) => expressionMentionsMetric(expression, name))
    if (!mentioned.length) return { expression, index, score: 0 }
    const available = mentioned.filter((name) => metricNames.has(name)).length
    const missing = mentioned.length - available
    // 有已知存在的指标优先；引用了清单里明确不存在的指标往后排
    return { expression, index, score: available * 10 - missing * 5 }
  })
  return scored
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((item) => item.expression)
}

async function queryPanel(
  context: PrometheusDatasourceContext,
  spec: DashboardPanelSpec,
  filters: DashboardFilters,
  metricNames: Set<string> | null,
  start: number,
  end: number,
  step: number
): Promise<DashboardPanelResult> {
  const emptyResult = (): DashboardPanelResult => ({
    id: spec.id,
    status: 'metric_missing',
    message: '当前数据源未采集此面板所需指标',
    series: []
  })

  if (!spec.query && !spec.quantileQueries) return emptyResult()
  if (!hasRequiredMetrics(spec, metricNames)) return emptyResult()

  const fallbackFns = [
    ...(spec.fallbackQuery ? [spec.fallbackQuery] : []),
    ...(spec.fallbackQueries ?? [])
  ]

  async function tryExpression(expression: string) {
    return runPanelQuery(context, spec, expression, start, end, step)
  }

  try {
    if (spec.quantileQueries) {
      const series = await queryQuantileParallel(context, spec, start, end, step)
      if (!series.length) {
        return {
          id: spec.id,
          status: 'no_data',
          message: '当前筛选范围暂无数据',
          series: []
        }
      }
      return { id: spec.id, status: 'success', series }
    }

    const candidateExpressions = orderExpressionsByMetricAvailability(
      [spec.query!(filters), ...fallbackFns.map((fn) => fn(filters))],
      metricNames
    )

    let series: DashboardSeries[] = []
    let lastError: unknown = null
    let hadSuccessfulResponse = false
    for (const expression of candidateExpressions) {
      try {
        series = await tryExpression(expression)
        hadSuccessfulResponse = true
        if (series.length) break
      } catch (error) {
        lastError = error
      }
    }

    if (!series.length) {
      if (lastError && !hadSuccessfulResponse) {
        return {
          id: spec.id,
          status: 'error',
          message: errorMessage(lastError),
          series: []
        }
      }
      return {
        id: spec.id,
        status: 'no_data',
        message: '当前筛选范围暂无数据',
        series: []
      }
    }
    return { id: spec.id, status: 'success', series }
  } catch (error) {
    for (const fallback of fallbackFns) {
      try {
        const series = await tryExpression(fallback(filters))
        if (series.length) {
          return { id: spec.id, status: 'success', series }
        }
      } catch {
        /* try next fallback */
      }
    }
    return {
      id: spec.id,
      status: 'error',
      message: errorMessage(error),
      series: []
    }
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIndex = 0
  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index])
    }
  }
  const workerCount = Math.min(Math.max(1, concurrency), items.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

export async function fetchDashboardDefinition(): Promise<DashboardDefinition> {
  return getDashboardDefinition()
}

export async function fetchDashboardVariables(
  datasource: DatasourceItem,
  filters: DashboardFilters
): Promise<DashboardVariables> {
  const context = resolvePrometheusContext(datasource)
  const namespace = filters.namespace
  const queries = [
    instantQuery(context, 'kube_namespace_created'),
    instantQuery(context, 'kube_node_info'),
    instantQuery(
      context,
      buildDashboardVariableSelector('kube_deployment_status_replicas', 'namespace', namespace)
    ),
    instantQuery(
      context,
      buildDashboardVariableSelector('kube_statefulset_replicas', 'namespace', namespace)
    ),
    instantQuery(
      context,
      buildDashboardVariableSelector(
        'kube_daemonset_status_desired_number_scheduled',
        'namespace',
        namespace
      )
    ),
    instantQuery(
      context,
      buildDashboardVariableSelector('kube_job_status_active', 'namespace', namespace)
    ),
    instantQuery(context, buildDashboardPodVariableQuery(filters))
  ]
  const [namespaces, nodes, deployments, statefulsets, daemonsets, jobs, pods] =
    await Promise.all(queries)

  return {
    namespaces: uniqueLabels(namespaces, 'namespace'),
    nodes: uniqueLabels(nodes, 'node'),
    workloads: collectWorkloads([
      { kind: 'Deployment', label: 'deployment', series: deployments },
      { kind: 'StatefulSet', label: 'statefulset', series: statefulsets },
      { kind: 'DaemonSet', label: 'daemonset', series: daemonsets },
      { kind: 'Job', label: 'job_name', series: jobs }
    ]),
    pods: uniqueLabels(pods, 'pod')
  }
}

export async function fetchDashboardQuery(
  datasource: DatasourceItem,
  payload: {
    panelIds: string[]
    start: number
    end: number
    step: number
    filters: DashboardFilters
  }
): Promise<DashboardQueryResult> {
  if (payload.end <= payload.start) throw new Error('查询结束时间必须晚于开始时间')
  const context = resolvePrometheusContext(datasource)
  const specs = getDashboardPanelSpecs(payload.panelIds)
  const metricNames = await loadMetricNames(datasource, context, payload.start, payload.end)
  const results = await mapWithConcurrency(specs, QUERY_CONCURRENCY, (spec) =>
    queryPanel(
      context,
      spec,
      payload.filters,
      metricNames,
      payload.start,
      payload.end,
      payload.step
    )
  )
  return {
    datasource_id: datasource.id,
    started_at: payload.start,
    ended_at: payload.end,
    results
  }
}

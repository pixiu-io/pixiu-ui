import { pixiuAxios } from '@/api/container'
import { kubeProxyAxios } from '@/api/kubeProxy'
import { buildClusterServiceProxyPath } from '@/utils/datasource/clusterProxy'

/** Prometheus 即时查询响应 */
export interface PrometheusInstantResult {
  resultType: 'vector' | 'matrix' | 'scalar' | 'string'
  result: Array<{
    metric: Record<string, string>
    value?: [number, string]
    values?: Array<[number, string]>
  }>
}

export interface PrometheusQueryResponse {
  status: 'success' | 'error'
  data: PrometheusInstantResult
  error?: string
  errorType?: string
}

export interface PrometheusQueryOptions {
  /** 上游 Proxy 认证头，如 Basic xxx */
  proxyAuth?: string
  /** 透传到代理请求的请求头（外部数据源常用） */
  headers?: Record<string, string>
  /**
   * 内部数据源：关联集群名。
   * 传入后走 /pixiu/proxy/{cluster}/.../services/.../proxy，而不是 /pixiu/external。
   */
  clusterName?: string
}

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

function buildRequestHeaders(opts?: PrometheusQueryOptions): Record<string, string> {
  const headers: Record<string, string> = { ...(opts?.headers ?? {}) }
  if (opts?.proxyAuth) {
    headers['X-Pixiu-Proxy-Authorization'] =
      headers['X-Pixiu-Proxy-Authorization'] ?? opts.proxyAuth
  }
  return headers
}

function appendSearchParams(path: string, params: URLSearchParams): string {
  const query = params.toString()
  if (!query) return path
  return `${path}${path.includes('?') ? '&' : '?'}${query}`
}

async function getPrometheusJson<T>(
  path: string,
  opts?: PrometheusQueryOptions
): Promise<T> {
  const headers = buildRequestHeaders(opts)
  const useClusterProxy = Boolean(opts?.clusterName?.trim())
  if (useClusterProxy) {
    const res = await kubeProxyAxios.get<T>(path, { headers })
    return res.data
  }
  const res = await pixiuAxios.get<T>(path, { headers })
  return res.data
}

function resolveApiPath(
  datasourceUrl: string,
  prometheusApiPath: string,
  queryParams: URLSearchParams,
  opts?: PrometheusQueryOptions
): string {
  const clusterName = opts?.clusterName?.trim()
  if (clusterName) {
    const proxyPath = buildClusterServiceProxyPath(
      clusterName,
      trimTrailingSlash(datasourceUrl),
      prometheusApiPath
    )
    return appendSearchParams(proxyPath, queryParams)
  }

  queryParams.set('url', trimTrailingSlash(datasourceUrl))
  return appendSearchParams(`/pixiu/external${prometheusApiPath}`, queryParams)
}

/** 调用代理执行 Prometheus instant query */
export async function fetchPrometheusInstantQuery(
  datasourceUrl: string,
  promql: string,
  time?: number,
  opts?: PrometheusQueryOptions
): Promise<PrometheusQueryResponse> {
  const searchParams = new URLSearchParams()
  searchParams.set('query', promql)
  if (time !== undefined) {
    searchParams.set('time', String(time))
  }
  const path = resolveApiPath(datasourceUrl, '/api/v1/query', searchParams, opts)
  return getPrometheusJson<PrometheusQueryResponse>(path, opts)
}

/** 调用代理执行 Prometheus range query */
export async function fetchPrometheusRangeQuery(
  datasourceUrl: string,
  promql: string,
  start: number,
  end: number,
  step: string,
  opts?: PrometheusQueryOptions
): Promise<PrometheusQueryResponse> {
  const searchParams = new URLSearchParams()
  searchParams.set('query', promql)
  searchParams.set('start', String(start))
  searchParams.set('end', String(end))
  searchParams.set('step', step)
  const path = resolveApiPath(datasourceUrl, '/api/v1/query_range', searchParams, opts)
  return getPrometheusJson<PrometheusQueryResponse>(path, opts)
}

/** 获取 Prometheus 标签名列表 */
export async function fetchPrometheusLabels(
  datasourceUrl: string,
  opts?: PrometheusQueryOptions & {
    start?: number
    end?: number
    /** series selector，如 {__name__="up"} */
    match?: string[]
  }
): Promise<{ status: 'success' | 'error'; data: string[]; error?: string; errorType?: string }> {
  const searchParams = new URLSearchParams()
  if (opts?.start !== undefined) searchParams.set('start', String(opts.start))
  if (opts?.end !== undefined) searchParams.set('end', String(opts.end))
  for (const selector of opts?.match ?? []) {
    searchParams.append('match[]', selector)
  }
  const path = resolveApiPath(datasourceUrl, '/api/v1/labels', searchParams, opts)
  return getPrometheusJson(path, opts)
}

/** 获取 Prometheus 指标名或标签值列表 */
export async function fetchPrometheusLabelValues(
  datasourceUrl: string,
  labelName: string,
  opts?: PrometheusQueryOptions & {
    start?: number
    end?: number
    /** series selector，如 {__name__="up",job="prometheus"} */
    match?: string[]
  }
): Promise<{ status: 'success' | 'error'; data: string[]; error?: string; errorType?: string }> {
  const searchParams = new URLSearchParams()
  if (opts?.start !== undefined) searchParams.set('start', String(opts.start))
  if (opts?.end !== undefined) searchParams.set('end', String(opts.end))
  for (const selector of opts?.match ?? []) {
    searchParams.append('match[]', selector)
  }
  const path = resolveApiPath(
    datasourceUrl,
    `/api/v1/label/${encodeURIComponent(labelName)}/values`,
    searchParams,
    opts
  )
  return getPrometheusJson(path, opts)
}

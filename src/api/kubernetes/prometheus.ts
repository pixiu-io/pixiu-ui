import { pixiuAxios } from '@/api/container'

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
  /** 透传到 /pixiu/external 的请求头（与日志页实现对齐） */
  headers?: Record<string, string>
}

/** 调用 /pixiu/external 代理执行 Prometheus instant query */
export async function fetchPrometheusInstantQuery(
  datasourceUrl: string,
  promql: string,
  time?: number,
  opts?: PrometheusQueryOptions
): Promise<PrometheusQueryResponse> {
  const searchParams = new URLSearchParams()
  searchParams.set('url', trimTrailingSlash(datasourceUrl))
  searchParams.set('query', promql)
  if (time !== undefined) {
    searchParams.set('time', String(time))
  }

  const headers: Record<string, string> = { ...(opts?.headers ?? {}) }
  if (opts?.proxyAuth) {
    headers['X-Pixiu-Proxy-Authorization'] =
      headers['X-Pixiu-Proxy-Authorization'] ?? opts.proxyAuth
  }

  const res = await pixiuAxios.get<PrometheusQueryResponse>(
    `/pixiu/external/api/v1/query?${searchParams.toString()}`,
    { headers }
  )
  return res.data
}

/** 调用 /pixiu/external 代理执行 Prometheus range query */
export async function fetchPrometheusRangeQuery(
  datasourceUrl: string,
  promql: string,
  start: number,
  end: number,
  step: string,
  opts?: PrometheusQueryOptions
): Promise<PrometheusQueryResponse> {
  const searchParams = new URLSearchParams()
  searchParams.set('url', trimTrailingSlash(datasourceUrl))
  searchParams.set('query', promql)
  searchParams.set('start', String(start))
  searchParams.set('end', String(end))
  searchParams.set('step', step)

  const headers: Record<string, string> = { ...(opts?.headers ?? {}) }
  if (opts?.proxyAuth) {
    headers['X-Pixiu-Proxy-Authorization'] =
      headers['X-Pixiu-Proxy-Authorization'] ?? opts.proxyAuth
  }

  const res = await pixiuAxios.get<PrometheusQueryResponse>(
    `/pixiu/external/api/v1/query_range?${searchParams.toString()}`,
    { headers }
  )
  return res.data
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
  searchParams.set('url', trimTrailingSlash(datasourceUrl))
  if (opts?.start !== undefined) searchParams.set('start', String(opts.start))
  if (opts?.end !== undefined) searchParams.set('end', String(opts.end))
  for (const selector of opts?.match ?? []) {
    searchParams.append('match[]', selector)
  }

  const headers: Record<string, string> = { ...(opts?.headers ?? {}) }
  if (opts?.proxyAuth) {
    headers['X-Pixiu-Proxy-Authorization'] =
      headers['X-Pixiu-Proxy-Authorization'] ?? opts.proxyAuth
  }

  const res = await pixiuAxios.get<{
    status: 'success' | 'error'
    data: string[]
    error?: string
    errorType?: string
  }>(`/pixiu/external/api/v1/labels?${searchParams.toString()}`, {
    headers
  })
  return res.data
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
  searchParams.set('url', trimTrailingSlash(datasourceUrl))
  if (opts?.start !== undefined) searchParams.set('start', String(opts.start))
  if (opts?.end !== undefined) searchParams.set('end', String(opts.end))
  for (const selector of opts?.match ?? []) {
    searchParams.append('match[]', selector)
  }

  const headers: Record<string, string> = { ...(opts?.headers ?? {}) }
  if (opts?.proxyAuth) {
    headers['X-Pixiu-Proxy-Authorization'] =
      headers['X-Pixiu-Proxy-Authorization'] ?? opts.proxyAuth
  }

  const res = await pixiuAxios.get<{
    status: 'success' | 'error'
    data: string[]
    error?: string
    errorType?: string
  }>(`/pixiu/external/api/v1/label/${encodeURIComponent(labelName)}/values?${searchParams.toString()}`, {
    headers
  })
  return res.data
}

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

import axios from 'axios'
import { PixiuApiError } from '@/api/container'
import { kubeProxyAxios } from '@/api/kubeProxy'

export type LokiLabelOperator = '=' | '!=' | '=~' | '!~'

export interface LokiLabelFilter {
  key: string
  operator: LokiLabelOperator
  value: string
}

export interface LokiQueryRangeParams {
  filters?: LokiLabelFilter[]
  query?: string
  rawQuery?: string
  limit?: number
  since?: string
  start?: string
  end?: string
  direction?: 'forward' | 'backward'
}

export interface LokiStreamResult {
  stream?: Record<string, string>
  values?: [string, string][]
}

interface LokiQueryRangeResponse {
  status?: string
  data?: {
    resultType?: string
    result?: LokiStreamResult[]
  }
}

interface LokiLabelListResponse {
  status?: string
  data?: string[]
}

interface LokiSilentErrorPayload {
  code?: number
  message?: string
  error?: string
}

export interface LokiLogLine {
  timestamp: string
  namespace: string
  pod: string
  container: string
  message: string
  raw: string
  labels: Record<string, string>
}

export interface LokiAvailabilityResult {
  available: boolean
  labels: string[]
  reason?: string
}

const TOKEN_STORAGE_KEY = 'pixiu-access-token'
const LOKI_NAMESPACE = 'loki'
const LOKI_GATEWAY_SERVICE = 'http:loki-distributed-gateway:80'

function getLokiBasePath(cluster: string): string {
  return `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(LOKI_NAMESPACE)}/services/${encodeURIComponent(LOKI_GATEWAY_SERVICE)}/proxy/loki/api/v1`
}

function resolveAccessToken(): string {
  return localStorage.getItem(TOKEN_STORAGE_KEY) || ''
}

function isLokiNotInstalledMessage(message: string): boolean {
  return (
    message.includes('failed to find loki gateway service') ||
    message.includes('failed to find loki namespace')
  )
}

function looksLikeDuplicatedLokiPath(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('/loki/loki/') || lower.includes('/loki/api/v1/query_range')
}

function extractLokiErrorMessage(error: unknown): string {
  const axiosError = error as {
    message?: string
    response?: {
      status?: number
      data?: LokiSilentErrorPayload | string | Record<string, unknown>
    }
  }

  const data = axiosError.response?.data
  let message = ''

  if (typeof data === 'string') {
    message = data
  } else if (data && typeof data === 'object') {
    const payload = data as Record<string, unknown>
    message = String(payload.message ?? payload.error ?? '')
  }

  if (!message) {
    message = axiosError.message || 'Loki 请求失败'
  }

  if (axiosError.response?.status === 500) {
    const hint = '请检查数据源地址是否只填写基础地址，不要包含 /loki 或 /loki/api/v1。'
    if (looksLikeDuplicatedLokiPath(message)) {
      return `Loki 代理请求失败，可能是数据源地址包含了重复的 /loki 路径。${hint}`
    }
    if (message === 'Request failed with status code 500') {
      return `Loki 代理请求失败（500）。${hint}`
    }
  }

  return message
}

function createSilentKubeProxyClient() {
  const client = axios.create({
    baseURL: '/',
    timeout: 15000
  })

  client.interceptors.request.use((config) => {
    const token = resolveAccessToken()
    if (token) config.headers.set('Authorization', `Bearer ${token}`)
    return config
  })

  return client
}

const silentKubeProxyAxios = createSilentKubeProxyClient()

function escapeLogQlString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function buildSelector(filters: LokiLabelFilter[] = []): string {
  const normalized = filters
    .map((item) => ({
      key: item.key.trim(),
      operator: item.operator,
      value: item.value.trim()
    }))
    .filter((item) => item.key && item.value)

  if (!normalized.length) return ''

  const parts = normalized.map(
    (item) => `${item.key}${item.operator}"${escapeLogQlString(item.value)}"`
  )
  return `{${parts.join(', ')}}`
}

function buildQuery(filters: LokiLabelFilter[] = [], query?: string): string {
  const selector = buildSelector(filters)
  const keyword = (query ?? '').trim()
  if (!selector) return ''
  return keyword ? `${selector} |= "${escapeLogQlString(keyword)}"` : selector
}

function normalizeLabel(labels: Record<string, string>, candidates: string[]): string {
  for (const key of candidates) {
    const value = labels[key]
    if (value) return value
  }
  return ''
}

function normalizeMessage(raw: string): string {
  const text = raw.trim()
  if (!text) return '-'
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    for (const field of ['log', 'message', 'msg', 'content']) {
      const value = parsed[field]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
  } catch {
    // Keep raw text when the log line is not JSON.
  }
  return text.replace(/^\d{4}-\d{2}-\d{2}T[^\s]+\s+(?:stdout|stderr)\s+[A-Z]\s+/, '')
}

function nsToIso(nanoseconds: string): string {
  const ts = Number(nanoseconds)
  if (!Number.isFinite(ts)) return nanoseconds
  return new Date(ts / 1e6).toISOString()
}

function normalizeTimeParams(params: {
  since?: string
  start?: string
  end?: string
}): Record<string, string | undefined> {
  if (params.start && params.end) {
    return {
      start: params.start,
      end: params.end,
      since: undefined
    }
  }
  return {
    since: params.since ?? '1h',
    start: undefined,
    end: undefined
  }
}

export async function fetchLokiLabels(
  cluster: string,
  params: { since?: string; start?: string; end?: string } = {}
): Promise<string[]> {
  const timeParams = normalizeTimeParams(params)
  const { data } = await kubeProxyAxios.get<LokiLabelListResponse>(
    `${getLokiBasePath(cluster)}/labels`,
    { params: timeParams }
  )
  return (data?.data ?? []).filter(Boolean).sort((a, b) => a.localeCompare(b))
}

export async function fetchLokiLabelValues(
  cluster: string,
  labelName: string,
  params: { filters?: LokiLabelFilter[]; since?: string; start?: string; end?: string } = {}
): Promise<string[]> {
  const timeParams = normalizeTimeParams(params)
  const selectorFilters = (params.filters ?? []).filter((item) => item.key !== labelName)
  const { data } = await kubeProxyAxios.get<LokiLabelListResponse>(
    `${getLokiBasePath(cluster)}/label/${encodeURIComponent(labelName)}/values`,
    {
      params: {
        ...timeParams,
        query: buildSelector(selectorFilters)
      }
    }
  )
  return (data?.data ?? []).filter(Boolean).sort((a, b) => a.localeCompare(b))
}

export async function fetchLokiQueryRange(
  cluster: string,
  params: LokiQueryRangeParams = {}
): Promise<LokiLogLine[]> {
  try {
    const timeParams = normalizeTimeParams(params)
    const rawQuery = params.rawQuery?.trim()
    const { data } = await kubeProxyAxios.get<LokiQueryRangeResponse>(
      `${getLokiBasePath(cluster)}/query_range`,
      {
        params: {
          query: rawQuery || buildQuery(params.filters, params.query),
          limit: params.limit ?? 1000,
          direction: params.direction ?? 'backward',
          ...timeParams
        }
      }
    )

    const streams = data?.data?.result ?? []
    const rows: LokiLogLine[] = []

    for (const item of streams) {
      const labels = item.stream ?? {}
      const namespace = normalizeLabel(labels, [
        'namespace',
        'kubernetes_namespace_name',
        'exported_namespace'
      ])
      const pod = normalizeLabel(labels, ['pod', 'pod_name', 'kubernetes_pod_name', 'exported_pod'])
      const container = normalizeLabel(labels, [
        'container',
        'container_name',
        'kubernetes_container_name'
      ])

      for (const pair of item.values ?? []) {
        const [timestamp, raw] = pair
        rows.push({
          timestamp: nsToIso(timestamp),
          namespace: namespace || '-',
          pod: pod || '-',
          container: container || '-',
          message: normalizeMessage(raw),
          raw,
          labels
        })
      }
    }

    rows.sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0))
    return rows
  } catch (error: unknown) {
    throw new PixiuApiError(extractLokiErrorMessage(error))
  }
}

export async function detectLokiAvailability(
  cluster: string,
  params: { since?: string; start?: string; end?: string } = {}
): Promise<LokiAvailabilityResult> {
  try {
    const timeParams = normalizeTimeParams(params)
    const { data } = await silentKubeProxyAxios.get<LokiLabelListResponse | LokiSilentErrorPayload>(
      `${getLokiBasePath(cluster)}/labels`,
      { params: timeParams }
    )

    const payload = data as LokiSilentErrorPayload
    if (typeof payload?.code === 'number' && payload.code !== 200) {
      return {
        available: false,
        labels: [],
        reason: payload.message || payload.error || 'Loki 未安装或不可用'
      }
    }

    const labels = ((data as LokiLabelListResponse)?.data ?? [])
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))

    return { available: true, labels }
  } catch (error: unknown) {
    const axiosError = error as {
      response?: { data?: LokiSilentErrorPayload }
      message?: string
    }
    const message =
      axiosError.response?.data?.message ||
      axiosError.response?.data?.error ||
      axiosError.message ||
      'Loki 未安装或不可用'
    if (isLokiNotInstalledMessage(message)) {
      return { available: false, labels: [], reason: message }
    }
    throw error
  }
}

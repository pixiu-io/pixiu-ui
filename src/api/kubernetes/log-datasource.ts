import axios from 'axios'
import { pixiuAxios } from '@/api/container'
import { useUserStore } from '@/store/modules/user'

const TOKEN_STORAGE_KEY = 'pixiu-access-token'

export type LogDatasourceType = 'loki' | 'elasticsearch'

export interface LogDatasourceTypeOption {
  value: LogDatasourceType
  label: string
  enabled: boolean
}

export const LOG_DATASOURCE_TYPE_OPTIONS: LogDatasourceTypeOption[] = [
  { value: 'loki', label: 'Loki', enabled: true },
  { value: 'elasticsearch', label: 'Elasticsearch', enabled: false }
]

export const DEFAULT_LOG_DATASOURCE_TYPE: LogDatasourceType = 'loki'

export interface LogDatasourceHeader {
  key: string
  value: string
}

export interface LogDatasourceItem {
  id: number
  resourceVersion: number
  clusterName: string
  name: string
  type: LogDatasourceType
  url: string
  username: string
  headers: LogDatasourceHeader[]
  hasPassword: boolean
  isDefault: boolean
  description: string
  createTime?: string
  updateTime?: string
}

export interface CreateLogDatasourcePayload {
  name: string
  type: LogDatasourceType
  url: string
  username?: string
  password?: string
  headers?: LogDatasourceHeader[]
  is_default?: boolean
  description?: string
}

export interface UpdateLogDatasourcePayload extends CreateLogDatasourcePayload {
  resource_version: number
}

export interface LogDatasourceAvailabilityResult {
  available: boolean
  datasource: LogDatasourceItem | null
  datasourceList: LogDatasourceItem[]
  reason?: string
}

export interface TestLogDatasourcePayload {
  clusterId: number | string
  clusterName: string
  type: LogDatasourceType
  url: string
  username?: string
  password?: string
  headers?: LogDatasourceHeader[]
}

export interface TestLogDatasourceResult {
  available: boolean
  reason?: string
}

export function pickPreferredLogDatasource(
  datasourceList: LogDatasourceItem[],
  preferredId?: number | null
): LogDatasourceItem | null {
  if (!datasourceList.length) return null

  if (preferredId != null) {
    const matched = datasourceList.find((item) => item.id === preferredId)
    if (matched) return matched
  }

  return datasourceList.find((item) => item.isDefault) ?? datasourceList[0] ?? null
}

export function pickPreferredLokiDatasource(
  datasourceList: LogDatasourceItem[],
  preferredId?: number | null
): LogDatasourceItem | null {
  if (!datasourceList.length) return null

  if (preferredId != null) {
    const matched = datasourceList.find((item) => item.id === preferredId && item.type === 'loki')
    if (matched) return matched
  }

  return (
    datasourceList.find((item) => item.isDefault && item.type === 'loki') ??
    datasourceList.find((item) => item.type === 'loki') ??
    null
  )
}

export function normalizeLogDatasourceUrl(type: LogDatasourceType, rawUrl: string): string {
  const trimmed = rawUrl.trim()
  if (!trimmed) return ''

  if (type !== 'loki') return trimmed.replace(/\/+$/, '')

  try {
    const parsed = new URL(trimmed)
    const normalizedPath = parsed.pathname
      .replace(/\/+$/, '')
      .replace(/\/loki\/api\/v1$/i, '')
      .replace(/\/loki$/i, '')

    parsed.pathname = normalizedPath || '/'
    return parsed.toString().replace(/\/$/, parsed.pathname === '/' ? '' : '/')
  } catch {
    return trimmed
      .replace(/\/+$/, '')
      .replace(/\/loki\/api\/v1$/i, '')
      .replace(/\/loki$/i, '')
  }
}

interface PixiuEnvelope<T> {
  code?: number
  message?: string
  result?: T
}

function resolveAccessToken(): string {
  const userStore = useUserStore()
  const token = userStore.accessToken || localStorage.getItem(TOKEN_STORAGE_KEY) || ''
  if (token && !userStore.accessToken) {
    userStore.setToken(token)
    userStore.setLoginStatus(true)
  }
  return token
}

function createSilentPixiuClient() {
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

const silentPixiuAxios = createSilentPixiuClient()

function buildDatasourceHeaders(payload: TestLogDatasourcePayload): Record<string, string> {
  const headers: Record<string, string> = {}

  for (const item of payload.headers ?? []) {
    const key = item.key.trim()
    const value = item.value.trim()
    if (!key) continue
    headers[key] = value
  }

  if (payload.username?.trim()) {
    const auth = btoa(`${payload.username.trim()}:${payload.password ?? ''}`)
    headers.Authorization = `Basic ${auth}`
  }

  return headers
}

function getLogDatasourceBasePath(clusterName: string): string {
  return `/pixiu/log-datasources/${encodeURIComponent(clusterName)}`
}

function normalizeDatasourceType(value: unknown): LogDatasourceType {
  return value === 'elasticsearch' ? 'elasticsearch' : 'loki'
}

function normalizeHeaders(value: unknown): LogDatasourceHeader[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const header = item as Record<string, unknown>
      return {
        key: String(header.key ?? ''),
        value: String(header.value ?? '')
      }
    })
    .filter((item): item is LogDatasourceHeader => item != null && Boolean(item.key))
}

function toDatasourceItem(payload: unknown): LogDatasourceItem | null {
  if (!payload || typeof payload !== 'object') return null
  const item = payload as Record<string, unknown>
  const id = Number(item.id)
  if (!Number.isFinite(id)) return null

  return {
    id,
    resourceVersion: Number(item.resource_version ?? item.resourceVersion ?? 0),
    clusterName: String(item.cluster_name ?? item.clusterName ?? ''),
    name: String(item.name ?? ''),
    type: normalizeDatasourceType(item.type),
    url: String(item.url ?? ''),
    username: String(item.username ?? ''),
    headers: normalizeHeaders(item.headers),
    hasPassword: Boolean(item.has_password ?? item.hasPassword),
    isDefault: Boolean(item.is_default ?? item.isDefault),
    description: String(item.description ?? ''),
    createTime: typeof item.gmt_create === 'string' ? item.gmt_create : undefined,
    updateTime: typeof item.gmt_modified === 'string' ? item.gmt_modified : undefined
  }
}

export function getDatasourceTypeLabel(type: LogDatasourceType): string {
  const matched = LOG_DATASOURCE_TYPE_OPTIONS.find((item) => item.value === type)
  return matched?.label || type
}

export async function listLogDatasources(clusterName: string): Promise<LogDatasourceItem[]> {
  const { data } = await silentPixiuAxios.get<PixiuEnvelope<unknown[]>>(
    getLogDatasourceBasePath(clusterName)
  )
  const result = Array.isArray(data?.result) ? data.result : []
  return result.map(toDatasourceItem).filter((item): item is LogDatasourceItem => Boolean(item))
}

export async function createLogDatasource(
  clusterName: string,
  payload: CreateLogDatasourcePayload
): Promise<void> {
  await pixiuAxios.post(getLogDatasourceBasePath(clusterName), payload)
}

export async function updateLogDatasource(
  clusterName: string,
  datasourceId: number | string,
  payload: UpdateLogDatasourcePayload
): Promise<void> {
  await pixiuAxios.put(
    `${getLogDatasourceBasePath(clusterName)}/${encodeURIComponent(String(datasourceId))}`,
    payload
  )
}

export async function deleteLogDatasource(
  clusterName: string,
  datasourceId: number | string
): Promise<void> {
  await pixiuAxios.delete(
    `${getLogDatasourceBasePath(clusterName)}/${encodeURIComponent(String(datasourceId))}`
  )
}

export async function testLogDatasourceConnection(
  payload: TestLogDatasourcePayload
): Promise<TestLogDatasourceResult> {
  if (!payload.clusterName.trim()) {
    return { available: false, reason: '缺少集群信息，无法测试数据源' }
  }
  const normalizedUrl = normalizeLogDatasourceUrl(payload.type, payload.url)
  if (!normalizedUrl) {
    return { available: false, reason: '请输入数据源地址' }
  }

  if (payload.type !== 'loki') {
    return { available: false, reason: '当前仅支持测试 Loki 类型数据源' }
  }

  try {
    const { data } = await silentPixiuAxios.post<PixiuEnvelope<TestLogDatasourceResult>>(
      `${getLogDatasourceBasePath(payload.clusterName)}/test`,
      {
        type: payload.type,
        url: normalizedUrl,
        username: payload.username?.trim() || undefined,
        password: payload.password || undefined,
        headers: (payload.headers ?? [])
          .map((item) => ({ key: item.key.trim(), value: item.value.trim() }))
          .filter((item) => item.key)
      }
    )

    const result = data?.result
    if (result && typeof result === 'object') {
      return {
        available: Boolean(result.available),
        reason: result.reason
      }
    }

    return { available: true }
  } catch (error: unknown) {
    const axiosError = error as {
      message?: string
      response?: { data?: unknown; status?: number }
    }

    if (axiosError.response?.status === 404) {
      return {
        available: false,
        reason: '当前后端未提供通过 kubeconfig 代理测试日志数据源的接口'
      }
    }

    if (typeof axiosError.response?.data === 'string' && axiosError.response.data.trim()) {
      return { available: false, reason: axiosError.response.data.trim() }
    }

    if (axiosError.response?.data && typeof axiosError.response.data === 'object') {
      const responseData = axiosError.response.data as Record<string, unknown>
      const reason = String(responseData.error ?? responseData.message ?? '').trim()
      if (reason) return { available: false, reason }
    }

    return {
      available: false,
      reason: axiosError.message || '数据源不可用，请检查地址、认证信息或集群代理连通性'
    }
  }

  const requestUrl = `${normalizedUrl}/loki/api/v1/labels`

  try {
    const { data } = await axios.get<Record<string, unknown> | string>(requestUrl, {
      timeout: 10000,
      headers: buildDatasourceHeaders(payload),
      params: { since: '1h' }
    })

    if (typeof data === 'object' && data != null) {
      const payloadData = data as Record<string, unknown>
      const status = String(payloadData.status ?? '')
      if (status && status !== 'success') {
        return {
          available: false,
          reason: String(payloadData.error ?? payloadData.message ?? '数据源测试失败')
        }
      }
    }

    return { available: true }
  } catch (error: unknown) {
    const axiosError = error as {
      message?: string
      response?: { data?: unknown; status?: number }
    }
    const responseData = axiosError.response?.data

    if (typeof responseData === 'string') {
      const message = String(responseData).trim()
      if (message) {
        return { available: false, reason: message }
      }
    }

    if (responseData && typeof responseData === 'object') {
      const normalizedResponseData = responseData as Record<string, unknown>
      const reason = String(
        normalizedResponseData.error ?? normalizedResponseData.message ?? ''
      ).trim()
      if (reason) return { available: false, reason }
    }

    return {
      available: false,
      reason: axiosError.message || '数据源不可用，请检查地址、认证信息或网络连通性'
    }
  }
}

export async function setDefaultLogDatasource(
  clusterName: string,
  datasourceId: number | string
): Promise<void> {
  await pixiuAxios.post(
    `${getLogDatasourceBasePath(clusterName)}/${encodeURIComponent(String(datasourceId))}/default`
  )
}

export async function detectDefaultLogDatasource(
  clusterName: string
): Promise<LogDatasourceAvailabilityResult> {
  const datasourceList = await listLogDatasources(clusterName)
  const datasource = datasourceList.find((item) => item.isDefault) ?? null

  if (datasource) {
    return { available: true, datasource, datasourceList }
  }

  if (datasourceList.length > 0) {
    return {
      available: false,
      datasource: null,
      datasourceList,
      reason:
        '当前集群已经添加了日志数据源，但还没有设置默认数据源，请先设置默认数据源后再访问日志。'
    }
  }

  return {
    available: false,
    datasource: null,
    datasourceList,
    reason: '当前集群还没有日志数据源，请先添加数据源并设置为默认后再访问日志。'
  }
}

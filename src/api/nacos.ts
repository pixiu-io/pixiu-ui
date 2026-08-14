/**
 * Nacos Open API (v1) 客户端。
 *
 * 完全沿用 ES 数据源的双通道模式，后端零代理逻辑：
 * - 外部数据源：经 /pixiu/external/<upstreamPath>?url=<baseURL> 通用反向代理转发；
 * - 集群内数据源：经 kube-apiserver service proxy（buildClusterServiceProxyPath）转发。
 *
 * 与 ES 的差异：Nacos 鉴权是「登录换 accessToken」，由本模块自行管理：
 * - 用户名/密码取数据源 config.log.userName/password（添加数据源时填在「鉴权」里）；
 * - accessToken 按数据源 id 缓存，按 tokenTtl 提前 60s 过期；
 * - 登录接口 404 视为服务端未开启鉴权（auth.enabled=false），后续请求不带 token；
 * - 业务请求 401/403 时清除缓存重新登录一次。
 */
import axios from 'axios'
import { pixiuAxios } from '@/api/container'
import { kubeProxyAxios } from '@/api/kubeProxy'
import { buildClusterServiceProxyPath } from '@/utils/datasource/clusterProxy'
import { resolveDatasourceUrl, type DatasourceItem } from '@/api/datasource'

export type NacosMethod = 'get' | 'post' | 'put' | 'delete'

export interface NacosRequestOptions {
  /** query 参数（不含 accessToken，会自动附加） */
  params?: Record<string, any>
  /** 请求体；传字符串时请同时指定 contentType */
  data?: any
  /** 请求体 Content-Type，默认 application/json */
  contentType?: string
  /** 跳过自动登录（用于登录请求本身） */
  skipToken?: boolean
  /** 超时（毫秒） */
  timeout?: number
  /** 401/403 不自动重试登录 */
  skipAuthRetry?: boolean
}

interface TokenCacheEntry {
  /** '' 表示服务端未开启鉴权 */
  token: string
  expiresAt: number
}

const tokenCache = new Map<number, TokenCacheEntry>()
const loginPromises = new Map<number, Promise<string>>()

/** 鉴权模式：'none'=未配置账号 'disabled'=服务端未开启鉴权 'token'=已登录 */
export type NacosAuthState = 'none' | 'disabled' | 'token'

export function getNacosCredential(ds: DatasourceItem): { username: string; password: string } {
  const username = ds.config.log?.userName?.trim() || ''
  const password = ds.config.log?.password ?? ''
  return { username, password }
}

export function getNacosAuthState(ds: DatasourceItem): NacosAuthState {
  const { username } = getNacosCredential(ds)
  if (!username) return 'none'
  const cached = tokenCache.get(ds.id)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token ? 'token' : 'disabled'
  }
  return 'none'
}

export function invalidateNacosToken(dsId: number) {
  tokenCache.delete(dsId)
}

function customHeaders(ds: DatasourceItem): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const item of ds.config.headers ?? []) {
    const key = item.key?.trim()
    if (key) headers[key] = item.value
  }
  return headers
}

function baseUrlOf(ds: DatasourceItem): string {
  return resolveDatasourceUrl(ds).replace(/\/+$/, '')
}

async function rawRequest(
  ds: DatasourceItem,
  method: NacosMethod,
  upstreamPath: string,
  opts: NacosRequestOptions
) {
  const baseUrl = baseUrlOf(ds)
  const config: Record<string, any> = {
    method,
    params: opts.params,
    data: opts.data,
    timeout: opts.timeout ?? 30000
  }
  if (opts.contentType) {
    config.headers = { 'Content-Type': opts.contentType }
  }
  if (ds.external) {
    return pixiuAxios.request({
      ...config,
      url: `/pixiu/external${upstreamPath}`,
      params: { ...(opts.params ?? {}), url: baseUrl },
      headers: { ...customHeaders(ds), ...(config.headers ?? {}) }
    })
  }
  return kubeProxyAxios.request({
    ...config,
    url: buildClusterServiceProxyPath(ds.clusterName, baseUrl, upstreamPath)
  })
}

function unwrap(res: any): any {
  return res?.data?.result ?? res?.data
}

async function login(ds: DatasourceItem): Promise<string> {
  const { username, password } = getNacosCredential(ds)
  if (!username) return ''
  const body = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
  try {
    const res = await rawRequest(ds, 'post', '/nacos/v1/auth/login', {
      data: body,
      contentType: 'application/x-www-form-urlencoded;charset=UTF-8'
    })
    const data = unwrap(res)
    const token = data?.accessToken ?? ''
    const ttl = Number(data?.tokenTtl) || 18000
    tokenCache.set(ds.id, { token, expiresAt: Date.now() + Math.max(ttl - 60, 60) * 1000 })
    return token
  } catch (error: any) {
    // 服务端未开启鉴权时登录接口不存在
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      tokenCache.set(ds.id, { token: '', expiresAt: Date.now() + 10 * 60 * 1000 })
      return ''
    }
    throw error
  }
}

async function ensureToken(ds: DatasourceItem): Promise<string> {
  const { username } = getNacosCredential(ds)
  if (!username) return ''
  const cached = tokenCache.get(ds.id)
  if (cached && cached.expiresAt > Date.now()) return cached.token
  const pending = loginPromises.get(ds.id)
  if (pending) return pending
  const promise = login(ds).finally(() => loginPromises.delete(ds.id))
  loginPromises.set(ds.id, promise)
  return promise
}

/**
 * 发送 Nacos v1 Open API 请求，返回响应体（已解包）。
 * accessToken 自动附加到 query；401/403 自动重新登录并重试一次。
 */
export async function nacosRequest<T = any>(
  ds: DatasourceItem,
  method: NacosMethod,
  path: string,
  opts: NacosRequestOptions = {}
): Promise<T> {
  const token = opts.skipToken ? '' : await ensureToken(ds)
  const params = { ...(opts.params ?? {}) }
  if (token) params.accessToken = token
  try {
    const res = await rawRequest(ds, method, path, { ...opts, params })
    return unwrap(res) as T
  } catch (error: any) {
    const status = error?.response?.status
    if ((status === 401 || status === 403) && !opts.skipToken && !opts.skipAuthRetry && token) {
      invalidateNacosToken(ds.id)
      return nacosRequest<T>(ds, method, path, { ...opts, skipAuthRetry: true })
    }
    throw error
  }
}

/** 提取 Nacos 错误信息（v1 接口错误多为纯文本或 {message}） */
export function nacosErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) return String(error)
  const data = error.response?.data
  if (typeof data === 'string' && data.trim()) return data.trim()
  if (data?.message) return String(data.message)
  return error.message || '请求失败'
}

// ---------------- 业务封装 ----------------

export interface NacosServerState {
  standalone_mode?: string
  function_mode?: string
  version?: string
  [key: string]: any
}

export interface NacosNamespace {
  namespace: string
  namespaceShowName: string
  namespaceDesc?: string
  quota?: number
  configCount?: number
  type?: number
}

export interface NacosConfigItem {
  dataId: string
  group: string
  tenant?: string
  appName?: string
  type?: string
  length?: number
  md5?: string
  updateTime?: string | number
}

export interface NacosServiceItem {
  name: string
  groupName?: string
  clusterCount?: number
  ipCount?: number
  healthyInstanceCount?: number
  triggerProtectThreshold?: boolean
}

export interface NacosInstance {
  ip: string
  port: number
  weight?: number
  enabled: boolean
  healthy?: boolean
  ephemeral?: boolean
  clusterName?: string
  serviceName?: string
  metadata?: Record<string, string>
}

export function fetchNacosServerState(ds: DatasourceItem) {
  return nacosRequest<NacosServerState>(ds, 'get', '/nacos/v1/console/server/state')
}

export function fetchNacosNamespaces(ds: DatasourceItem) {
  return nacosRequest<{ code?: number; data?: NacosNamespace[] }>(
    ds,
    'get',
    '/nacos/v1/console/namespaces'
  )
}

export function createNacosNamespace(
  ds: DatasourceItem,
  payload: { namespaceShowName: string; namespace?: string; namespaceDesc?: string }
) {
  const body = new URLSearchParams()
  body.set('namespaceShowName', payload.namespaceShowName)
  if (payload.namespace?.trim()) body.set('namespace', payload.namespace.trim())
  if (payload.namespaceDesc?.trim()) body.set('namespaceDesc', payload.namespaceDesc.trim())
  return nacosRequest(ds, 'post', '/nacos/v1/console/namespaces', {
    data: body.toString(),
    contentType: 'application/x-www-form-urlencoded;charset=UTF-8'
  })
}

export function deleteNacosNamespace(ds: DatasourceItem, namespaceId: string) {
  return nacosRequest(ds, 'delete', '/nacos/v1/console/namespaces', {
    params: { namespaceId }
  })
}

export function fetchNacosConfigs(
  ds: DatasourceItem,
  payload: {
    tenant?: string
    dataId?: string
    group?: string
    pageNo?: number
    pageSize?: number
    search?: 'blur' | 'accurate' | 'blur_merge'
  }
) {
  return nacosRequest<{
    totalCount?: number
    pageNumber?: number
    pagesAvailable?: number
    pageItems?: NacosConfigItem[]
  }>(ds, 'get', '/nacos/v1/cs/configs', {
    params: {
      search: payload.search ?? 'blur',
      dataId: payload.dataId ?? '',
      group: payload.group ?? '',
      tenant: payload.tenant ?? '',
      pageNo: payload.pageNo ?? 1,
      pageSize: payload.pageSize ?? 10
    }
  })
}

export function fetchNacosConfigDetail(
  ds: DatasourceItem,
  payload: { dataId: string; group: string; tenant?: string }
) {
  return nacosRequest<{
    content?: string
    dataId?: string
    group?: string
    type?: string
    appName?: string
    /** v1 详情返回的修改/创建时间（epoch 毫秒） */
    modifyTime?: number
    createTime?: number
    lastModifiedTime?: string
    gmtModified?: string
  }>(ds, 'get', '/nacos/v1/cs/configs', {
    params: {
      show: 'all',
      dataId: payload.dataId,
      group: payload.group,
      tenant: payload.tenant ?? ''
    }
  })
}

export function publishNacosConfig(
  ds: DatasourceItem,
  payload: { dataId: string; group: string; tenant?: string; content: string; type?: string }
) {
  const body = new URLSearchParams()
  body.set('dataId', payload.dataId)
  body.set('group', payload.group)
  body.set('tenant', payload.tenant ?? '')
  body.set('content', payload.content)
  if (payload.type) body.set('type', payload.type)
  return nacosRequest(ds, 'post', '/nacos/v1/cs/configs', {
    data: body.toString(),
    contentType: 'application/x-www-form-urlencoded;charset=UTF-8',
    timeout: 60000
  })
}

export function deleteNacosConfig(
  ds: DatasourceItem,
  payload: { dataId: string; group: string; tenant?: string }
) {
  return nacosRequest(ds, 'delete', '/nacos/v1/cs/configs', {
    params: { dataId: payload.dataId, group: payload.group, tenant: payload.tenant ?? '' }
  })
}

export function fetchNacosServices(
  ds: DatasourceItem,
  payload: {
    namespaceId?: string
    groupName?: string
    selector?: string
    pageNo?: number
    pageSize?: number
  }
) {
  return nacosRequest<{ count?: number; doms?: string[] }>(ds, 'get', '/nacos/v1/ns/service/list', {
    params: {
      namespaceId: payload.namespaceId ?? '',
      groupName: payload.groupName ?? 'DEFAULT_GROUP',
      selector: payload.selector ?? '',
      pageNo: payload.pageNo ?? 1,
      pageSize: payload.pageSize ?? 10
    }
  })
}

export function fetchNacosServiceDetail(
  ds: DatasourceItem,
  payload: { serviceName: string; namespaceId?: string; groupName?: string }
) {
  return nacosRequest<Record<string, any>>(ds, 'get', '/nacos/v1/ns/service', {
    params: {
      serviceName: payload.serviceName,
      namespaceId: payload.namespaceId ?? '',
      groupName: payload.groupName ?? 'DEFAULT_GROUP'
    }
  })
}

export function fetchNacosInstances(
  ds: DatasourceItem,
  payload: { serviceName: string; namespaceId?: string; groupName?: string; clusterName?: string }
) {
  return nacosRequest<{ hosts?: NacosInstance[]; name?: string }>(
    ds,
    'get',
    '/nacos/v1/ns/instance/list',
    {
      params: {
        serviceName: payload.serviceName,
        namespaceId: payload.namespaceId ?? '',
        groupName: payload.groupName ?? 'DEFAULT_GROUP',
        clusterName: payload.clusterName ?? '',
        healthyOnly: false
      }
    }
  )
}

export function updateNacosInstance(
  ds: DatasourceItem,
  payload: {
    serviceName: string
    ip: string
    port: number
    enabled: boolean
    namespaceId?: string
    groupName?: string
    clusterName?: string
    weight?: number
  }
) {
  const body = new URLSearchParams()
  body.set('serviceName', payload.serviceName)
  body.set('namespaceId', payload.namespaceId ?? '')
  body.set('groupName', payload.groupName ?? 'DEFAULT_GROUP')
  body.set('ip', payload.ip)
  body.set('port', String(payload.port))
  body.set('enabled', payload.enabled ? 'true' : 'false')
  body.set('clusterName', payload.clusterName ?? 'DEFAULT')
  body.set('weight', String(payload.weight ?? 1))
  body.set('ephemeral', 'true')
  return nacosRequest(ds, 'put', '/nacos/v1/ns/instance', {
    data: body.toString(),
    contentType: 'application/x-www-form-urlencoded;charset=UTF-8'
  })
}

export interface NacosClusterNode {
  address?: string
  ip?: string
  port?: number
  /** UP / SUSPICIOUS / DOWN */
  state?: string
  [key: string]: any
}

/** 集群节点列表（/v1/core/cluster/nodes），用于展示节点在线情况 */
export function fetchNacosClusterNodes(ds: DatasourceItem) {
  return nacosRequest<{ code?: number; data?: NacosClusterNode[] } | NacosClusterNode[]>(
    ds,
    'get',
    '/nacos/v1/core/cluster/nodes'
  )
}

/** 服务发现模块运行指标（/v1/ns/operator/metrics）：服务数 / 实例数 / 订阅数等；onlyStatus=false 才返回计数 */
export function fetchNacosOperatorMetrics(ds: DatasourceItem) {
  return nacosRequest<Record<string, any>>(ds, 'get', '/nacos/v1/ns/operator/metrics', {
    params: { onlyStatus: 'false' }
  })
}

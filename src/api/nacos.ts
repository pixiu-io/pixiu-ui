/**
 * Nacos Open API 客户端（兼容 v2.0+ / v3.0+）。
 *
 * 完全沿用 ES 数据源的双通道模式，后端零代理逻辑：
 * - 外部数据源：经 /pixiu/external/<upstreamPath>?url=<baseURL> 通用反向代理转发；
 * - 集群内数据源：经 kube-apiserver service proxy（buildClusterServiceProxyPath）转发。
 *
 * 版本选择策略（resolveApi）：
 * - 数据源 config.nacos.version 显式配置为 v2/v3 时，直接使用对应 API；
 * - 未配置（存量数据）时自动探测 /v3/console/server/state，命中走 v3，否则回退 v1（Nacos 2.x）。
 *
 * Nacos 3.x 部署形态：主服务端口（如 8848）仅提供客户端 OpenAPI，
 * Console API（/v3/console/**、/v3/auth/user/login）默认独立运行在 8080 端口、路径 /。
 * 因此 v3 探测依次尝试：同端口 '' 前缀 → 同端口 '/nacos' 前缀 → 同主机 8080 Console 地址；
 * 命中 Console 地址时缓存为 base 覆盖，后续 v3 请求均发往该地址（仅外部数据源）。
 *
 * 版本差异收敛在三处：
 * - 端点注册表（V1_ENDPOINTS / v3Endpoints）：路径差异；
 * - nsParam/groupParam：配置类接口参数名差异（tenant→namespaceId、group→groupName）；
 * - 各业务封装内的响应形状归一化：对外保持 v1 返回形状，页面零改动。
 *
 * 鉴权：Nacos 是「登录换 accessToken」，由本模块自行管理：
 * - 用户名/密码取数据源 config.log.userName/password（添加数据源时填在「鉴权」里）；
 * - accessToken 按数据源 id 缓存，按 tokenTtl 提前 60s 过期；
 * - 登录接口 404 视为服务端未开启鉴权（auth.enabled=false），后续请求不带 token；
 * - 业务请求 401/403 时清除缓存重新登录一次。
 */
import axios from 'axios'
import { pixiuAxios } from '@/api/container'
import { kubeProxyAxios } from '@/api/kubeProxy'
import { buildClusterServiceProxyPath } from '@/utils/datasource/clusterProxy'
import { resolveDatasourceUrl, type DatasourceItem, type NacosApiVersion } from '@/api/datasource'

export type NacosMethod = 'get' | 'post' | 'put' | 'delete'

export interface NacosRequestOptions {
  /** query 参数（不含 accessToken，会自动附加） */
  params?: Record<string, any>
  /** 请求体；传字符串时请同时指定 contentType */
  data?: any
  /** 请求体 Content-Type，默认 application/json */
  contentType?: string
  /** 跳过自动登录（用于登录请求本身与版本探测） */
  skipToken?: boolean
  /** 超时（毫秒） */
  timeout?: number
  /** 401/403 不自动重试登录 */
  skipAuthRetry?: boolean
  /** 外部通道 base 覆盖（如 v3 Admin API 所在的主服务端口） */
  base?: string
  /** 探测/聚合类请求：失败不弹全局错误提示 */
  silent?: boolean
}

interface TokenCacheEntry {
  /** '' 表示服务端未开启鉴权 */
  token: string
  expiresAt: number
}

const tokenCache = new Map<number, TokenCacheEntry>()
const loginPromises = new Map<number, Promise<string>>()
/** 最近一次 serverState 缓存（推导主服务端口等用途） */
const stateCache = new Map<number, NacosServerState>()

/** 鉴权模式：'none'=未配置账号 'disabled'=服务端未开启鉴权 'token'=已登录 */
export type NacosAuthState = 'none' | 'disabled' | 'token'

const FORM_URLENCODED = 'application/x-www-form-urlencoded;charset=UTF-8'

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
  apiFlavorCache.delete(dsId)
  stateCache.delete(dsId)
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
  opts: NacosRequestOptions,
  baseOverride?: string
) {
  // 外部通道允许 base 覆盖（Nacos 3.x Console 独立端口）；内部通道绑定 Service 代理，不可切换
  const baseUrl =
    baseOverride ?? (ds.external ? apiFlavorCache.get(ds.id)?.base : undefined) ?? baseUrlOf(ds)
  const config: Record<string, any> = {
    method,
    params: opts.params,
    data: opts.data,
    timeout: opts.timeout ?? 30000
  }
  if (opts.contentType) {
    config.headers = { 'Content-Type': opts.contentType }
  }
  if (opts.silent) {
    config.skipErrorNotification = true
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

// ---------------- 版本探测与端点注册表 ----------------

/** 逻辑端点；V1_ENDPOINTS / v3Endpoints 分别给出两版本实际路径 */
interface NacosEndpoints {
  login: string
  serverState: string
  namespace: string
  namespaceList: string
  config: string
  configList: string
  serviceList: string
  service: string
  serviceSubscribers: string
  instanceList: string
  instance: string
  clusterNodes: string
  /** v3 Console API 未提供运行指标端点 */
  metrics: string | null
}

const V1_ENDPOINTS: NacosEndpoints = {
  login: '/nacos/v1/auth/login',
  serverState: '/nacos/v1/console/server/state',
  namespace: '/nacos/v1/console/namespaces',
  namespaceList: '/nacos/v1/console/namespaces',
  config: '/nacos/v1/cs/configs',
  configList: '/nacos/v1/cs/configs',
  serviceList: '/nacos/v1/ns/service/list',
  service: '/nacos/v1/ns/service',
  serviceSubscribers: '/nacos/v1/ns/service/subscribers',
  instanceList: '/nacos/v1/ns/instance/list',
  instance: '/nacos/v1/ns/instance',
  clusterNodes: '/nacos/v1/core/cluster/nodes',
  metrics: '/nacos/v1/ns/operator/metrics'
}

function v3Endpoints(prefix: string): NacosEndpoints {
  const console = (path: string) => `${prefix}/v3/console${path}`
  return {
    login: `${prefix}/v3/auth/user/login`,
    serverState: console('/server/state'),
    namespace: console('/core/namespace'),
    namespaceList: console('/core/namespace/list'),
    config: console('/cs/config'),
    configList: console('/cs/config/list'),
    serviceList: console('/ns/service/list'),
    service: console('/ns/service'),
    serviceSubscribers: console('/ns/service/subscribers'),
    instanceList: console('/ns/instance/list'),
    instance: console('/ns/instance'),
    clusterNodes: console('/core/cluster/nodes'),
    metrics: null
  }
}

interface ResolvedApi extends NacosEndpoints {
  version: NacosApiVersion
}

interface ApiFlavor {
  version: NacosApiVersion
  /** v3 console 前缀：同端口部署时 Nacos 3.x 默认空 contextPath，部分保留 /nacos */
  prefix: string
  /** v3 Console 独立部署时的 base 地址覆盖（如 http://host:8080） */
  base?: string
}

const apiFlavorCache = new Map<number, ApiFlavor>()

function configuredVersion(ds: DatasourceItem): NacosApiVersion | undefined {
  const version = ds.config?.nacos?.version
  return version === 'v2' || version === 'v3' ? version : undefined
}

function looksLikeNacosState(data: any): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false
  const body = 'code' in data && data.data && typeof data.data === 'object' ? data.data : data
  return !!(
    body.version !== undefined ||
    body.auth_enabled !== undefined ||
    body.startup_mode !== undefined ||
    body.standalone_mode !== undefined
  )
}

/**
 * 推导 Nacos 3.x 独立 Console 地址：同主机、默认 8080 端口、根路径。
 * 接入地址本身已是 8080 或解析失败时返回 null（无需推导）。
 */
export function deriveNacosConsoleBase(baseUrl: string): string | null {
  try {
    const u = new URL(baseUrl)
    if (u.port === '8080') return null
    u.port = '8080'
    u.pathname = ''
    u.search = ''
    u.hash = ''
    return u.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

export interface NacosTestCandidate {
  /** 外部通道 base 覆盖；缺省用接入地址 */
  base?: string
  path: string
  family: NacosApiVersion
}

/** 连接测试候选：优先按所选版本探测，另一版本族兜底；v3 含独立 Console 地址候选 */
export function buildNacosTestCandidates(
  version: NacosApiVersion,
  baseUrl: string,
  external: boolean
): NacosTestCandidate[] {
  const consoleBase = external ? deriveNacosConsoleBase(baseUrl) : null
  const v3: NacosTestCandidate[] = [
    { path: '/v3/console/server/state', family: 'v3' },
    { path: '/nacos/v3/console/server/state', family: 'v3' }
  ]
  if (consoleBase) v3.push({ base: consoleBase, path: '/v3/console/server/state', family: 'v3' })
  const v2: NacosTestCandidate[] = [{ path: '/nacos/v1/console/server/state', family: 'v2' }]
  return version === 'v3' ? [...v3, ...v2] : [...v2, ...v3]
}

/** 探测 v3 console 位置（前缀/独立端口）；均不命中返回 null（网络层故障直接抛出） */
async function probeV3Flavor(
  ds: DatasourceItem
): Promise<{ prefix: string; base?: string } | null> {
  const candidates: { prefix: string; base?: string }[] = [{ prefix: '' }, { prefix: '/nacos' }]
  if (ds.external) {
    const consoleBase = deriveNacosConsoleBase(baseUrlOf(ds))
    if (consoleBase) candidates.push({ prefix: '', base: consoleBase })
  }
  for (const candidate of candidates) {
    try {
      const res = await rawRequest(
        ds,
        'get',
        `${candidate.prefix}/v3/console/server/state`,
        { skipToken: true, timeout: 10000, silent: true },
        candidate.base
      )
      if (looksLikeNacosState(res?.data)) return candidate
    } catch (error: any) {
      // 404/410/401/403 说明该候选不适用，尝试下一个；无响应（网络故障）直接抛出
      if (!error?.response?.status) throw error
    }
  }
  return null
}

async function resolveApi(ds: DatasourceItem): Promise<ResolvedApi> {
  const explicit = configuredVersion(ds)
  let flavor = apiFlavorCache.get(ds.id)
  if (!flavor) {
    if (explicit === 'v2') {
      flavor = { version: 'v2', prefix: '' }
    } else {
      const probed = await probeV3Flavor(ds)
      if (probed !== null) {
        flavor = { version: 'v3', prefix: probed.prefix, base: probed.base }
      } else if (explicit === 'v3') {
        // 显式 v3 但探测未命中（如鉴权拦截），仍按 v3 默认前缀发请求，让真实错误暴露
        flavor = { version: 'v3', prefix: '' }
      } else {
        flavor = { version: 'v2', prefix: '' }
      }
    }
    apiFlavorCache.set(ds.id, flavor)
  }
  const endpoints = flavor.version === 'v3' ? v3Endpoints(flavor.prefix) : V1_ENDPOINTS
  return { ...endpoints, version: flavor.version }
}

/** 配置类接口命名空间参数名：v1 tenant / v3 namespaceId */
function nsParam(api: ResolvedApi): 'tenant' | 'namespaceId' {
  return api.version === 'v3' ? 'namespaceId' : 'tenant'
}

/** 配置类接口分组参数名：v1 group / v3 groupName */
function groupParam(api: ResolvedApi): 'group' | 'groupName' {
  return api.version === 'v3' ? 'groupName' : 'group'
}

/** v3 统一响应包 {code,message,data} 解包；v1 裸响应原样返回 */
function unwrap(res: any): any {
  const data = res?.data
  if (
    data &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    'code' in data &&
    'data' in data
  ) {
    const code = Number(data.code)
    if (code !== 0 && code !== 200) {
      throw new Error(String(data.message ?? 'Nacos 请求失败'))
    }
    return data.data
  }
  return data?.result ?? data
}

async function login(ds: DatasourceItem): Promise<string> {
  const api = await resolveApi(ds)
  const { username, password } = getNacosCredential(ds)
  if (!username) return ''
  const body = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
  try {
    const res = await rawRequest(ds, 'post', api.login, {
      data: body,
      contentType: FORM_URLENCODED
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
 * 发送 Nacos 请求，返回响应体（已解包）。
 * accessToken 自动附加到 query；401/403 自动重新登录并重试一次。
 * 路径请取自 resolveApi 暴露的业务封装，勿硬编码版本路径。
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
    const res = await rawRequest(ds, method, path, { ...opts, params }, opts.base)
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
  if (axios.isAxiosError(error)) {
    const data = error.response?.data
    if (typeof data === 'string' && data.trim()) return data.trim()
    if (data?.message) return String(data.message)
    return error.message || '请求失败'
  }
  return error instanceof Error ? error.message : String(error)
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

export async function fetchNacosServerState(ds: DatasourceItem) {
  const api = await resolveApi(ds)
  const state = await nacosRequest<NacosServerState>(ds, 'get', api.serverState)
  if (state && typeof state === 'object') stateCache.set(ds.id, state)
  return state
}

/** 命名空间列表：两版本统一返回 {code, data: NacosNamespace[]}（页面读 res.data） */
export async function fetchNacosNamespaces(ds: DatasourceItem) {
  const api = await resolveApi(ds)
  const data = await nacosRequest(ds, 'get', api.namespaceList)
  const list: NacosNamespace[] = (Array.isArray(data) ? data : (data?.data ?? [])).map(
    (item: any) => ({
      ...item,
      namespaceShowName: item.namespaceShowName ?? item.name ?? item.namespace
    })
  )
  return { code: 0, data: list }
}

export async function createNacosNamespace(
  ds: DatasourceItem,
  payload: { namespaceShowName: string; namespace?: string; namespaceDesc?: string }
) {
  const api = await resolveApi(ds)
  const body = new URLSearchParams()
  if (api.version === 'v3') {
    body.set('namespaceName', payload.namespaceShowName)
    if (payload.namespace?.trim()) body.set('customNamespaceId', payload.namespace.trim())
  } else {
    body.set('namespaceShowName', payload.namespaceShowName)
    if (payload.namespace?.trim()) body.set('namespace', payload.namespace.trim())
  }
  if (payload.namespaceDesc?.trim()) body.set('namespaceDesc', payload.namespaceDesc.trim())
  return nacosRequest(ds, 'post', api.namespace, {
    data: body.toString(),
    contentType: FORM_URLENCODED
  })
}

export async function deleteNacosNamespace(ds: DatasourceItem, namespaceId: string) {
  const api = await resolveApi(ds)
  return nacosRequest(ds, 'delete', api.namespace, {
    params: { namespaceId }
  })
}

export async function fetchNacosConfigs(
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
  const api = await resolveApi(ds)
  const params: Record<string, any> = {
    search: payload.search ?? 'blur',
    dataId: payload.dataId ?? '',
    pageNo: payload.pageNo ?? 1,
    pageSize: payload.pageSize ?? 10
  }
  params[groupParam(api)] = payload.group ?? ''
  params[nsParam(api)] = payload.tenant ?? ''
  const data = await nacosRequest<{
    totalCount?: number
    pageNumber?: number
    pagesAvailable?: number
    pageItems?: NacosConfigItem[]
  }>(ds, 'get', api.configList, { params })
  if (api.version === 'v3') {
    // 归一化：v3 pageItems 用 groupName，页面统一读 group
    return {
      ...data,
      pageItems: (data?.pageItems ?? []).map((item) => ({
        ...item,
        group: (item as any).group ?? (item as any).groupName
      }))
    }
  }
  return data
}

export async function fetchNacosConfigDetail(
  ds: DatasourceItem,
  payload: { dataId: string; group: string; tenant?: string }
) {
  const api = await resolveApi(ds)
  const params: Record<string, any> = { dataId: payload.dataId }
  params[groupParam(api)] = payload.group
  params[nsParam(api)] = payload.tenant ?? ''
  if (api.version === 'v2') params.show = 'all'
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
  }>(ds, 'get', api.config, { params })
}

export async function publishNacosConfig(
  ds: DatasourceItem,
  payload: { dataId: string; group: string; tenant?: string; content: string; type?: string }
) {
  const api = await resolveApi(ds)
  const body = new URLSearchParams()
  body.set('dataId', payload.dataId)
  body.set(groupParam(api), payload.group)
  body.set(nsParam(api), payload.tenant ?? '')
  body.set('content', payload.content)
  if (payload.type) body.set('type', payload.type)
  return nacosRequest(ds, 'post', api.config, {
    data: body.toString(),
    contentType: FORM_URLENCODED,
    timeout: 60000
  })
}

export async function deleteNacosConfig(
  ds: DatasourceItem,
  payload: { dataId: string; group: string; tenant?: string }
) {
  const api = await resolveApi(ds)
  const params: Record<string, any> = { dataId: payload.dataId }
  params[groupParam(api)] = payload.group
  params[nsParam(api)] = payload.tenant ?? ''
  return nacosRequest(ds, 'delete', api.config, { params })
}

export async function fetchNacosServices(
  ds: DatasourceItem,
  payload: {
    namespaceId?: string
    groupName?: string
    selector?: string
    pageNo?: number
    pageSize?: number
  }
) {
  const api = await resolveApi(ds)
  const params: Record<string, any> = {
    namespaceId: payload.namespaceId ?? '',
    pageNo: payload.pageNo ?? 1,
    pageSize: payload.pageSize ?? 10
  }
  if (api.version === 'v3') {
    // v3 console 服务列表的过滤参数名与 v1 不同
    params.serviceNameParam = ''
    params.groupNameParam = payload.groupName ?? 'DEFAULT_GROUP'
  } else {
    params.groupName = payload.groupName ?? 'DEFAULT_GROUP'
    params.selector = payload.selector ?? ''
  }
  const data = await nacosRequest(ds, 'get', api.serviceList, { params })
  if (api.version === 'v3') {
    // 归一化：v3 分页 {totalCount, pageItems:[{name}]} → v1 {count, doms}
    const items: any[] = data?.pageItems ?? []
    return {
      count: data?.totalCount ?? items.length,
      doms: items.map((item) => item.name)
    } as { count?: number; doms?: string[] }
  }
  return data as { count?: number; doms?: string[] }
}

export async function fetchNacosServiceDetail(
  ds: DatasourceItem,
  payload: { serviceName: string; namespaceId?: string; groupName?: string }
) {
  const api = await resolveApi(ds)
  return nacosRequest<Record<string, any>>(ds, 'get', api.service, {
    params: {
      serviceName: payload.serviceName,
      namespaceId: payload.namespaceId ?? '',
      groupName: payload.groupName ?? 'DEFAULT_GROUP'
    }
  })
}

export async function fetchNacosInstances(
  ds: DatasourceItem,
  payload: { serviceName: string; namespaceId?: string; groupName?: string; clusterName?: string }
) {
  const api = await resolveApi(ds)
  const params: Record<string, any> = {
    serviceName: payload.serviceName,
    namespaceId: payload.namespaceId ?? '',
    groupName: payload.groupName ?? 'DEFAULT_GROUP',
    clusterName: payload.clusterName ?? ''
  }
  if (api.version === 'v3') {
    // v3 实例列表强制分页，一次性拉足以对齐 v1 全量语义
    params.pageNo = 1
    params.pageSize = 1000
  } else {
    params.healthyOnly = false
  }
  const data = await nacosRequest(ds, 'get', api.instanceList, { params })
  if (api.version === 'v3') {
    // 归一化：v3 {pageItems} → v1 {hosts, name}
    return {
      hosts: data?.pageItems ?? [],
      name: payload.serviceName
    } as { hosts?: NacosInstance[]; name?: string }
  }
  return data as { hosts?: NacosInstance[]; name?: string }
}

export async function updateNacosInstance(
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
  const api = await resolveApi(ds)
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
  return nacosRequest(ds, 'put', api.instance, {
    data: body.toString(),
    contentType: FORM_URLENCODED
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

/** 集群节点列表，用于展示节点在线情况 */
export function fetchNacosClusterNodes(ds: DatasourceItem) {
  return resolveApi(ds).then((api) =>
    nacosRequest<{ code?: number; data?: NacosClusterNode[] } | NacosClusterNode[]>(
      ds,
      'get',
      api.clusterNodes
    )
  )
}

/** 服务发现模块运行指标：服务数 / 实例数 / 订阅数等；取数失败返回 null（页面隐藏对应项） */
export async function fetchNacosOperatorMetrics(
  ds: DatasourceItem
): Promise<Record<string, any> | null> {
  const api = await resolveApi(ds)
  if (api.version === 'v2') {
    return nacosRequest<Record<string, any>>(ds, 'get', api.metrics as string, {
      params: { onlyStatus: 'false' }
    })
  }
  // v3：指标在 Admin API（主服务端口 /nacos/v3/admin/ns/ops/metrics），Console 端口不提供；
  // Admin 不可达时退化为 Console 列表聚合（服务/实例/订阅，连接数不可得）
  const direct = await fetchV3AdminMetrics(ds)
  if (direct) return direct
  return aggregateV3NamingMetrics(ds, api)
}

/** v3 Admin API 主服务端口候选：用户手填地址（与 Console base 不同时）+ state.server_port 推导 */
function adminBaseCandidates(ds: DatasourceItem): (string | undefined)[] {
  if (!ds.external) return [undefined]
  const consoleBase = apiFlavorCache.get(ds.id)?.base ?? baseUrlOf(ds)
  const entered = baseUrlOf(ds)
  const candidates: string[] = []
  if (entered !== consoleBase) candidates.push(entered)
  const port = stateCache.get(ds.id)?.server_port
  if (port) {
    try {
      const u = new URL(consoleBase)
      const current = u.port || (u.protocol === 'https:' ? '443' : '80')
      if (current !== String(port)) {
        u.port = String(port)
        u.pathname = ''
        u.search = ''
        u.hash = ''
        candidates.push(u.toString().replace(/\/+$/, ''))
      }
    } catch {
      // 忽略解析失败
    }
  }
  return candidates.length ? candidates : [undefined]
}

async function fetchV3AdminMetrics(ds: DatasourceItem): Promise<Record<string, any> | null> {
  const paths = ['/nacos/v3/admin/ns/ops/metrics', '/v3/admin/ns/ops/metrics']
  // 实例不可达时主端口可能挂起请求，故并行探测 + 短超时，最坏仅等一个超时周期
  const results = await Promise.all(
    adminBaseCandidates(ds).flatMap((base) =>
      paths.map(async (path) => {
        try {
          const data = await nacosRequest<Record<string, any>>(ds, 'get', path, {
            params: { onlyStatus: 'false' },
            timeout: 5000,
            base,
            skipAuthRetry: true,
            silent: true
          })
          return data && typeof data === 'object' && 'serviceCount' in data ? data : null
        } catch {
          return null
        }
      })
    )
  )
  return results.find((item) => item !== null) ?? null
}

/** Admin 不可达时按命名空间聚合服务/实例/订阅数（连接数 Console API 无法提供） */
async function aggregateV3NamingMetrics(
  ds: DatasourceItem,
  api: ResolvedApi
): Promise<Record<string, any> | null> {
  try {
    const nsRes = await fetchNacosNamespaces(ds)
    const namespaces = [
      '',
      ...((nsRes?.data ?? []) as NacosNamespace[]).map((item) => item.namespace).filter(Boolean)
    ]
    let serviceCount = 0
    let instanceCount = 0
    let subscribeCount = 0
    const serviceRefs: { ns: string; name: string; group: string }[] = []
    for (const nsId of namespaces) {
      const data = await nacosRequest<{ totalCount?: number; pageItems?: any[] }>(
        ds,
        'get',
        api.serviceList,
        {
          params: {
            namespaceId: nsId,
            pageNo: 1,
            pageSize: 500,
            serviceNameParam: '',
            groupNameParam: ''
          },
          timeout: 10000,
          silent: true
        }
      )
      const items = data?.pageItems ?? []
      serviceCount += data?.totalCount ?? items.length
      for (const item of items) {
        instanceCount += Number(item?.ipCount ?? 0)
        serviceRefs.push({ ns: nsId, name: item.name, group: item.groupName ?? 'DEFAULT_GROUP' })
      }
    }
    await Promise.all(
      serviceRefs.slice(0, 100).map(async (svc) => {
        try {
          const sub = await nacosRequest<{ totalCount?: number }>(
            ds,
            'get',
            api.serviceSubscribers,
            {
              params: {
                serviceName: svc.name,
                groupName: svc.group,
                namespaceId: svc.ns,
                pageNo: 1,
                pageSize: 1
              },
              timeout: 8000,
              silent: true
            }
          )
          subscribeCount += sub?.totalCount ?? 0
        } catch {
          // 单服务订阅数失败不影响整体
        }
      })
    )
    return { serviceCount, instanceCount, subscribeCount }
  } catch {
    return null
  }
}

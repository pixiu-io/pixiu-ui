import axios, { type InternalAxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/store/modules/user'
import { router } from '@/router'
import { RoutesAlias } from '@/router/routesAlias'
import { shortenError } from '@/utils/http/error'

declare module 'axios' {
  interface AxiosRequestConfig {
    /** 为 true 时，业务码 401（如密码错误）不触发登出跳转 */
    skipUnauthorizedRedirect?: boolean
  }
}

const TOKEN_STORAGE_KEY = 'pixiu-access-token'
const LOGIN_PATH = RoutesAlias.Login
const DEFAULT_UNAUTHORIZED_MSG = '未登陆或者密码被修改，请重新登陆'
const UNAUTHORIZED_DEBOUNCE_MS = 3000

/** 登录失效处理防抖，避免并发请求重复弹窗 */
let isPixiuUnauthorizedHandling = false
let pixiuUnauthorizedTimer: ReturnType<typeof setTimeout> | null = null

function resolveAccessToken(): string {
  const userStore = useUserStore()
  const token = userStore.accessToken || localStorage.getItem(TOKEN_STORAGE_KEY) || ''
  if (token && !userStore.accessToken) {
    userStore.setToken(token)
    userStore.setLoginStatus(true)
  }
  return token
}

/** 后端集群状态枚举 */
export type ClusterStatus = 0 | 1 | 2 | 3 | 4

/** 后端返回的集群结构 */
interface BackendCluster {
  id: number
  resource_version: number
  name: string
  alias_name: string
  status: ClusterStatus
  cluster_type: number
  plan_id: number
  kubernetes_version: string
  nodes: { ready: string[]; not_ready: string[] }
  protected: boolean
  permission_id: number
  description: string
  kube_config?: string
  gmt_create: string
  gmt_modified: string
}

/** 前端展示用的集群结构 */
export interface ClusterItem {
  id: number
  resourceVersion: number
  name: string
  aliasName: string
  clusterName: string
  version: string
  status: ClusterStatus
  /** 0 导入集群，1 部署集群（与后端 cluster_type 一致） */
  clusterType: number
  /** 自建集群关联的部署计划 ID */
  planId: number
  nodeReady: number
  nodeNotReady: number
  nodeCount: number
  isProtected: boolean
  permissionId: number
  createTime: string
}

/** pixiu 接口错误（notified 为 true 表示拦截器已弹出提示，业务层无需重复提示） */
export class PixiuApiError extends Error {
  readonly notified: boolean

  constructor(message: string, notified = false) {
    super(message)
    this.name = 'PixiuApiError'
    this.notified = notified
  }
}

/** 业务码 401 但属于接口业务错误（非登录态失效），例如修改密码时当前密码错误 */
function isBusinessUnauthorized(message?: string): boolean {
  if (!message) return false
  return message.includes('密码错误')
}

/** 是否应按登录失效处理：清空登录态并跳转登录页 */
function shouldRedirectUnauthorized(
  code: number | undefined,
  message: string | undefined,
  config?: InternalAxiosRequestConfig
): boolean {
  if (code !== 401) return false
  if (config?.skipUnauthorizedRedirect) return false
  if (isBusinessUnauthorized(message)) return false
  return true
}

/** 统一处理 Pixiu 登录失效：仅首次弹窗并跳转，并发 401 不再重复提示 */
export function handlePixiuSessionExpired(message?: string): Promise<never> {
  const msg = message || DEFAULT_UNAUTHORIZED_MSG
  const userStore = useUserStore()
  userStore.setLoginStatus(false)
  userStore.setToken('')

  if (!isPixiuUnauthorizedHandling) {
    isPixiuUnauthorizedHandling = true
    ElMessage.error(msg)
    const currentPath = router.currentRoute.value.path
    if (currentPath !== LOGIN_PATH && currentPath !== '/login') {
      router.push({ name: 'Login' }).catch(() => undefined)
    }
    if (pixiuUnauthorizedTimer) clearTimeout(pixiuUnauthorizedTimer)
    pixiuUnauthorizedTimer = setTimeout(() => {
      isPixiuUnauthorizedHandling = false
      pixiuUnauthorizedTimer = null
    }, UNAUTHORIZED_DEBOUNCE_MS)
  }

  return Promise.reject(new PixiuApiError(msg, true))
}

function rejectPixiuBusinessError(message?: string, code?: number, skipNotify = false) {
  const msg = shortenError(message || '请求失败', code)
  if (!skipNotify) {
    ElMessage.error(msg)
  }
  return Promise.reject(new PixiuApiError(msg, !skipNotify))
}

/** 是否为 Pixiu `{ code, message, result? }` 业务包（区别于 K8s 原生 JSON） */
export function isPixiuApiEnvelope(body: unknown): body is { code: number; message?: string } {
  if (!body || typeof body !== 'object') return false
  const o = body as Record<string, unknown>
  if (typeof o.code !== 'number') return false
  if (o.kind === 'Status') return false
  if (Array.isArray(o.items)) return false
  if (typeof o.apiVersion === 'string' && typeof o.kind === 'string') return false
  return true
}

/**
 * HTTP 200 且响应体为 Pixiu 业务包时：业务码非 200 则弹错并 reject。
 * 集群详情页 kubeProxy 与 pixiu 接口共用此逻辑。
 */
export function rejectIfPixiuBusinessError(
  body: unknown,
  config?: InternalAxiosRequestConfig
): Promise<never> | null {
  if (!isPixiuApiEnvelope(body)) return null
  const { code, message } = body
  if (code === 200) return null
  if (shouldRedirectUnauthorized(code, message, config)) {
    return handlePixiuSessionExpired(message)
  }
  const skipNotify = !!(config as Record<string, unknown> | undefined)?.skipErrorNotification
  return rejectPixiuBusinessError(message, code, skipNotify)
}

/** 专用于 pixiu 后端的 axios 实例（响应格式为 { code, result, message }） */
export const pixiuAxios = axios.create({
  baseURL: '/',
  timeout: 15000
})

pixiuAxios.interceptors.request.use((config) => {
  const token = resolveAccessToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

pixiuAxios.interceptors.response.use(
  (response) => {
    const rejected = rejectIfPixiuBusinessError(response.data, response.config)
    if (rejected) return rejected
    return response
  },
  (error) => {
    const data = error.response?.data
    const rejected = rejectIfPixiuBusinessError(data, error.config)
    if (rejected) return rejected
    const message =
      (data && typeof data === 'object' ? (data as { message?: string }).message : undefined) ||
      error.message
    const skipNotify = !!(error.config as Record<string, unknown> | undefined)?.skipErrorNotification
    return rejectPixiuBusinessError(message, error.response?.status, skipNotify)
  }
)

async function pixiuGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await pixiuAxios.get(url, { params })
  const { code, result, message } = res.data
  if (code !== 200) throw new Error(message || '请求失败')
  return result as T
}

/** 格式化 ISO 日期为 yyyy-MM-dd HH:mm:ss */
function formatDate(iso: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function toClusterItem(c: BackendCluster): ClusterItem {
  const nodeReady = c.nodes?.ready?.length ?? 0
  const nodeNotReady = c.nodes?.not_ready?.length ?? 0
  return {
    id: c.id,
    resourceVersion: c.resource_version,
    name: c.name,
    aliasName: c.alias_name,
    clusterName: c.alias_name || c.name,
    version: c.kubernetes_version || '-',
    status: c.status,
    clusterType: c.cluster_type ?? 0,
    planId: c.plan_id ?? 0,
    nodeReady,
    nodeNotReady,
    nodeCount: nodeReady + nodeNotReady,
    isProtected: c.protected,
    permissionId: c.permission_id ?? 0,
    createTime: formatDate(c.gmt_create)
  }
}

/** 获取集群列表（分页） */
export async function fetchClusterList(params: {
  page: number
  limit: number
  nameSelector?: string
  status?: string
}): Promise<{ total: number; items: ClusterItem[] }> {
  const query: Record<string, unknown> = { page: params.page, limit: params.limit }
  if (params.nameSelector) query.nameSelector = params.nameSelector
  if (params.status !== undefined && params.status !== '') query.status = Number(params.status)
  const userStore = useUserStore()
  const userId = userStore.getUserInfo?.userId
  if (userId) query.user_id = Number(userId)
  const res = await pixiuGet<{ total: number; items: BackendCluster[] }>(
    '/pixiu/clusters',
    query
  )
  return {
    total: res.total,
    items: (res.items ?? []).map(toClusterItem)
  }
}

/** 按后端 internal name 查找集群（列表无 name 精确筛选，分页拉取直至匹配） */
export async function fetchClusterByName(name: string): Promise<ClusterItem | null> {
  if (!name) return null
  const limit = 500
  let page = 1
  let total = Infinity
  while ((page - 1) * limit < total) {
    const res = await fetchClusterList({ page, limit })
    total = res.total
    const found = res.items.find((c) => c.name === name)
    if (found) return found
    if (res.items.length === 0) break
    page++
  }
  return null
}

/** 更新集群别名 */
export async function fetchUpdateClusterAlias(id: number, resourceVersion: number, aliasName: string): Promise<void> {
  const res = await pixiuAxios.put(`/pixiu/clusters/${id}`, {
    alias_name: aliasName,
    resource_version: resourceVersion
  })
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '更新失败')
}

/** 获取单个集群详情（含 kubeconfig） */
export async function fetchGetCluster(id: number): Promise<BackendCluster> {
  return pixiuGet<BackendCluster>(`/pixiu/clusters/${id}`)
}

/** 设置集群保护状态 */
export async function fetchProtectCluster(id: number, resourceVersion: number, isProtected: boolean): Promise<void> {
  const res = await pixiuAxios.post(`/pixiu/clusters/protect/${id}`, {
    resource_version: resourceVersion,
    protected: isProtected
  })
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '操作失败')
}

/** Kubeconfig 明文转 Base64（与 Pixiu 后端 ParseKubeConfigBytes 一致） */
export function encodeKubeConfigBase64(yamlText: string): string {
  const bytes = new TextEncoder().encode(yamlText)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

/** Base64 解码为 Kubeconfig 明文（支持 UTF-8） */
export function decodeKubeConfigBase64(encoded: string): string {
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

/** GET /pixiu/clusters/:clusterId/kubeconfig */
export interface KubeconfigResponse {
  cluster_name: string
  content: string
}

export async function fetchGetClusterKubeconfig(clusterId: number): Promise<KubeconfigResponse> {
  const res = await pixiuAxios.get(`/pixiu/clusters/${clusterId}/kubeconfig`)
  const { code, result, message } = res.data
  if (code !== 200) throw new Error(message || '获取 Kubeconfig 失败')
  return result as KubeconfigResponse
}

/** 导入集群（标准集群，cluster_type = 0） */
export async function fetchCreateCluster(params: {
  alias_name: string
  kube_config: string
  description?: string
  protected?: boolean
  cluster_type?: number
}): Promise<void> {
  const userStore = useUserStore()
  const userId = userStore.getUserInfo?.userId
  const res = await pixiuAxios.post('/pixiu/clusters', {
    alias_name: params.alias_name,
    kube_config: params.kube_config,
    description: params.description ?? '',
    protected: params.protected ?? true,
    cluster_type: params.cluster_type ?? 0,
    user_id: userId ?? 0
  })
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '创建失败')
}

/** 测试 Kubeconfig 与 Kubernetes API 连通性 */
export async function fetchPingCluster(kube_config: string): Promise<void> {
  const res = await pixiuAxios.post('/pixiu/clusters/ping', { kube_config })
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '连接失败')
}

/** 删除集群 */
export async function fetchDeleteCluster(id: number): Promise<void> {
  const token = resolveAccessToken()
  const res = await pixiuAxios.delete(`/pixiu/clusters/${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '删除失败')
}

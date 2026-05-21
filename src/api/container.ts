import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/store/modules/user'
import { router } from '@/router'

const TOKEN_STORAGE_KEY = 'pixiu-access-token'

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
  createTime: string
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
    const { code, message } = response.data
    if (code === 200) return response
    if (code === 401) {
      const userStore = useUserStore()
      userStore.setLoginStatus(false)
      userStore.setToken('')
      ElMessage.error(message || '未登陆或者密码被修改，请重新登陆')
      router.push('/login').catch(() => undefined)
      return Promise.reject(new Error(message || '未登陆或者密码被修改，请重新登陆'))
    }
    return Promise.reject(new Error(message || '请求失败'))
  },
  (error) => Promise.reject(error)
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
    aliasName: c.alias_name || c.name,
    clusterName: c.alias_name || c.name,
    version: c.kubernetes_version || '-',
    status: c.status,
    clusterType: c.cluster_type ?? 0,
    planId: c.plan_id ?? 0,
    nodeReady,
    nodeNotReady,
    nodeCount: nodeReady + nodeNotReady,
    isProtected: c.protected,
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

/** 导入集群（标准集群，cluster_type = 0） */
export async function fetchCreateCluster(params: {
  alias_name: string
  kube_config: string
  description?: string
  protected?: boolean
  cluster_type?: number
}): Promise<void> {
  const res = await pixiuAxios.post('/pixiu/clusters', {
    alias_name: params.alias_name,
    kube_config: params.kube_config,
    description: params.description ?? '',
    protected: params.protected ?? true,
    cluster_type: params.cluster_type ?? 0
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

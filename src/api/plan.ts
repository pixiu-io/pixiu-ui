import { pixiuAxios } from './container'
import { useUserStore } from '@/store/modules/user'

/** 节点认证信息 */
export interface PlanNodeAuth {
  type: 'password' | 'key'
  password?: { user: string; password: string }
  key?: { data: string }
}

/** 单节点配置（对应后端 CreatePlanNodeRequest） */
export interface PlanNodeParams {
  name: string
  role: string[]
  cri: string
  ip: string
  auth: PlanNodeAuth
}

/** 创建部署计划的完整参数（对应后端 CreatePlanRequest） */
export interface CreatePlanParams {
  name: string
  description?: string
  config: {
    os_image: string
    description?: string
    kubernetes: {
      kubernetes_version: string
      high_availability?: boolean
      enable_ha?: boolean
      enable_public_ip?: boolean
      api_server?: string
      api_port?: string
      image_repository?: string
      set_hostname?: boolean
      protect?: boolean
      change_selinux?: boolean
    }
    network: {
      network_interface: string
      cni: string
      pod_network: string
      service_network: string
      api_server_address?: string
      api_server_port?: number
      self_load_balance?: boolean
      kube_proxy_mode?: 'iptables' | 'ipvs'
    }
    runtime: {
      runtime: 'docker' | 'containerd'
      data_dir?: string
    }
    component: {
      prometheus?: { enabled: boolean }
      logging?: { enabled: boolean }
    }
  }
  nodes: PlanNodeParams[]
}

/** 后端 Plan 列表项结构 */
export interface PlanItem {
  id: number
  resource_version: number
  name: string
  description: string
  step: string
  kubernetes_version: string
  node_count: number
  gmt_create: string
  gmt_modified: string
}

/** 后端 Task 结构 */
export interface PlanTask {
  id: number
  plan_id: number
  name: string
  status: string
  message: string
  gmt_create: string
  gmt_modified: string
}

function parseMessageFromPayload(payload: unknown): string {
  if (!payload) return ''
  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload) as { message?: string }
      return parsed?.message || payload
    } catch {
      return payload
    }
  }
  if (typeof payload === 'object' && payload !== null) {
    const obj = payload as { message?: unknown; error?: unknown }
    if (typeof obj.message === 'string' && obj.message.trim()) return obj.message
    if (typeof obj.error === 'string' && obj.error.trim()) return obj.error
  }
  return ''
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  if (!error || typeof error !== 'object') return fallback
  const maybe = error as { message?: unknown; response?: { data?: unknown } }
  if (typeof maybe.message === 'string' && maybe.message.trim()) return maybe.message
  const parsed = parseMessageFromPayload(maybe.response?.data)
  return parsed || fallback
}

/** 格式化 ISO 日期 */
function formatDate(iso: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export interface PlanItemFormatted {
  id: number
  resourceVersion: number
  name: string
  description: string
  step: string
  kubernetesVersion: string
  nodeCount: number
  createTime: string
}

export interface PlanNodeDetail {
  id: number
  name: string
  role: string[]
  cri: string
  ip: string
  auth?: {
    type?: 'password' | 'key' | 'none' | string
    password?: { user?: string; password?: string }
    key?: { data?: string }
  }
}

/** GET /pixiu/plans/:planId/nodes 列表项（与后端 types.PlanNode JSON 对齐） */
export interface PlanNodeListItem {
  id: number
  resource_version?: number
  plan_id: number
  name: string
  role: string[]
  cri: string
  ip: string
  auth?: PlanNodeDetail['auth']
}

/** POST /pixiu/plans/:planId/nodes 请求体（与后端 CreatePlanNodeRequest 对齐） */
export interface CreatePlanNodeBody {
  name: string
  role: string[]
  cri: 'docker' | 'containerd'
  ip: string
  auth:
    | { type: 'password'; password: { user: string; password: string } }
    | { type: 'key'; key: { data: string } }
}

export interface PlanResourcesDetail {
  id: number
  resource_version?: number
  name: string
  description: string
  config?: {
    os_image?: string
    description?: string
    image_repository?: string
    set_hostname?: boolean
    protect?: boolean
    change_selinux?: boolean
    kubernetes?: {
      kubernetes_version?: string
      image_repository?: string
      set_hostname?: boolean
      protect?: boolean
      change_selinux?: boolean
    }
    network?: {
      network_interface?: string
      cni?: string
      pod_network?: string
      service_network?: string
    }
    runtime?: { runtime?: 'docker' | 'containerd'; data_dir?: string }
    component?: {
      prometheus?: { enabled?: boolean }
      logging?: { enabled?: boolean }
    }
  }
  nodes?: PlanNodeDetail[]
}

function toPlanItem(p: PlanItem): PlanItemFormatted {
  return {
    id: p.id,
    resourceVersion: p.resource_version,
    name: p.name,
    description: p.description ?? '',
    step: p.step === '部署失败' ? '已失败' : (p.step ?? '未开始'),
    kubernetesVersion: p.kubernetes_version ?? '',
    nodeCount: p.node_count ?? 0,
    createTime: formatDate(p.gmt_create)
  }
}

/**
 * GET /pixiu/plans/distributions
 * 获取支持的操作系统分发版列表
 */
export async function fetchPlanDistributions(): Promise<Record<string, string[]>> {
  const res = await pixiuAxios.get('/pixiu/plans/distributions')
  const { code, result, message } = res.data
  if (code !== 200) throw new Error(message || '获取操作系统列表失败')
  return result as Record<string, string[]>
}

/** 后端分页响应结构 */
export interface PlanPageResponse {
  page: number
  limit: number
  total: number
  items: PlanItem[]
}

/**
 * GET /pixiu/plans
 * 获取部署计划列表（支持分页与过滤）
 */
export async function fetchPlanList(params?: {
  page?: number
  limit?: number
  nameSelector?: string
  step?: string
  user_id?: number
}): Promise<{ list: PlanItemFormatted[]; total: number }> {
  const userStore = useUserStore()
  const query: Record<string, unknown> = { ...params }
  if (!query.user_id) {
    const uid = userStore.getUserInfo?.userId
    if (uid) query.user_id = Number(uid)
  }
  const res = await pixiuAxios.get('/pixiu/plans', { params: query })
  const { code, result, message } = res.data
  if (code !== 200) throw new Error(message || '获取部署计划列表失败')
  const pageResult = result as PlanPageResponse
  const list = (pageResult?.items ?? []).map(toPlanItem)
  return { list, total: pageResult?.total ?? 0 }
}

/**
 * GET /pixiu/plans/:id
 * 获取单个部署计划基础信息（含 resource_version）
 */
export async function fetchPlan(id: number): Promise<PlanItemFormatted> {
  const res = await pixiuAxios.get(`/pixiu/plans/${id}`)
  const { code, result, message } = res.data
  if (code !== 200) throw new Error(message || '获取部署计划详情失败')
  return toPlanItem(result as PlanItem)
}

/**
 * DELETE /pixiu/plans/:id
 * 删除部署计划
 */
export async function fetchDeletePlan(id: number): Promise<void> {
  const res = await pixiuAxios.delete(`/pixiu/plans/${id}`)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '删除失败')
}

/**
 * POST /pixiu/plans/:id/start
 * 启动部署任务
 */
export async function fetchStartPlan(id: number): Promise<void> {
  try {
    const res = await pixiuAxios.post(`/pixiu/plans/${id}/start`)
    const code = Number(res?.data?.code)
    if (code !== 200) {
      const msg = parseMessageFromPayload(res?.data) || '启动失败'
      throw new Error(msg)
    }
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, '启动失败'))
  }
}

/**
 * POST /pixiu/plans/:id/destroy
 * 销毁部署任务
 */
export async function fetchDestroyPlan(id: number, restart: boolean = false): Promise<void> {
  const res = await pixiuAxios.post(`/pixiu/plans/${id}/destroy`, { restart })
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '销毁失败')
}

/**
 * GET /pixiu/plans/:id/tasks
 * 查询部署任务列表
 */
export async function fetchPlanTasks(id: number): Promise<PlanTask[]> {
  const res = await pixiuAxios.get(`/pixiu/plans/${id}/tasks`)
  const { code, result, message } = res.data
  if (code !== 200) throw new Error(message || '获取任务列表失败')
  return (result ?? []) as PlanTask[]
}

/**
 * POST /pixiu/plans/:planId/nodes
 * 向部署计划新增主机（节点）
 */
export async function fetchCreatePlanNode(planId: number, body: CreatePlanNodeBody): Promise<void> {
  const res = await pixiuAxios.post(`/pixiu/plans/${planId}/nodes`, body)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '新增节点失败')
}

/**
 * GET /pixiu/plans/:planId/nodes
 * 获取部署计划下的主机（节点）列表
 */
export async function fetchPlanNodes(planId: number): Promise<PlanNodeListItem[]> {
  const res = await pixiuAxios.get(`/pixiu/plans/${planId}/nodes`)
  const { code, result, message } = res.data
  if (code !== 200) throw new Error(message || '获取主机列表失败')
  return (result ?? []) as PlanNodeListItem[]
}

/**
 * GET /pixiu/plans/:id/resources
 * 获取部署计划详情（含 config + nodes）
 */
export async function fetchPlanWithResources(id: number): Promise<PlanResourcesDetail> {
  const res = await pixiuAxios.get(`/pixiu/plans/${id}/resources`)
  const { code, result, message } = res.data
  if (code !== 200) throw new Error(message || '获取部署计划详情失败')
  return (result ?? {}) as PlanResourcesDetail
}

/**
 * POST /pixiu/plans
 * 一次性创建完整部署计划（含 config + nodes）
 */
export async function fetchCreatePlan(params: CreatePlanParams): Promise<void> {
  const userStore = useUserStore()
  const res = await pixiuAxios.post('/pixiu/plans', {
    ...params,
    user_id: userStore.getUserInfo?.userId ?? 0
  })
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '创建部署计划失败')
}

export interface UpdatePlanParams extends CreatePlanParams {
  resource_version: number
}

/**
 * PUT /pixiu/plans/:id
 * 更新部署计划（含 config + nodes）
 */
export async function fetchUpdatePlan(id: number, params: UpdatePlanParams): Promise<void> {
  const res = await pixiuAxios.put(`/pixiu/plans/${id}`, params)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '更新部署计划失败')
}

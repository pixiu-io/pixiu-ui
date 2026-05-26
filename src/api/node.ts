import { pixiuAxios } from './container'
import type { PlanNodeAuth } from './plan'

/** GET /pixiu/nodes 列表项（与后端 PixiuNode JSON 对齐） */
export interface PixiuNodeItem {
  id: number
  resource_version: number
  gmt_create: string
  gmt_modified: string
  name: string
  ip: string
  auth: string
  /** 历史数据或计划内节点可能仍有以下字段 */
  plan_id?: number
  role?: string
  cri?: string
}

export interface PixiuNodeListParams {
  page?: number
  limit?: number
  plan_id?: number
  nameSelector?: string
}

/** POST /pixiu/nodes（与后端 CreateNodeRequest 对齐，不依赖部署计划） */
export interface CreatePixiuNodeBody {
  name: string
  ip: string
  auth: PlanNodeAuth
}

/** PUT /pixiu/nodes/:nodeId（与后端 UpdateNodeRequest 对齐） */
export interface UpdatePixiuNodeBody {
  resource_version: number
  name?: string
  ip?: string
  auth?: PlanNodeAuth
}

/**
 * GET /pixiu/nodes
 */
export async function fetchPixiuNodeList(params: PixiuNodeListParams): Promise<{
  list: PixiuNodeItem[]
  total: number
  page: number
  limit: number
}> {
  const res = await pixiuAxios.get('/pixiu/nodes', { params })
  const { code, result, message } = res.data
  if (code !== 200) throw new Error(message || '获取主机列表失败')
  const pageResult = result as {
    page?: number
    limit?: number
    total?: number
    items?: PixiuNodeItem[]
  }
  return {
    list: pageResult?.items ?? [],
    total: pageResult?.total ?? 0,
    page: pageResult?.page ?? params.page ?? 1,
    limit: pageResult?.limit ?? params.limit ?? 20
  }
}

/**
 * POST /pixiu/nodes
 */
export async function fetchCreatePixiuNode(body: CreatePixiuNodeBody): Promise<PixiuNodeItem | undefined> {
  const res = await pixiuAxios.post('/pixiu/nodes', body)
  const { code, result, message } = res.data
  if (code !== 200) throw new Error(message || '新增节点失败')
  return result as PixiuNodeItem | undefined
}

/**
 * PUT /pixiu/nodes/:nodeId
 */
export async function fetchUpdatePixiuNode(nodeId: number, body: UpdatePixiuNodeBody): Promise<void> {
  const res = await pixiuAxios.put(`/pixiu/nodes/${nodeId}`, body)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '更新节点失败')
}

/**
 * DELETE /pixiu/nodes/:nodeId
 */
export async function fetchDeletePixiuNode(nodeId: number): Promise<void> {
  const res = await pixiuAxios.delete(`/pixiu/nodes/${nodeId}`)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '删除节点失败')
}

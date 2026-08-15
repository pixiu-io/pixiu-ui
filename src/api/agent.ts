import { pixiuAxios } from '@/api/container'

export interface AgentItem {
  id: number
  resourceVersion: number
  name: string
  type: number
  userId: number
  status: number
  hostname: string
  version: string
  lastHeartbeat: string
  description: string
  gmtCreate: string
  gmtModified: string
  token: string
}

interface BackendAgent {
  id: number
  resource_version: number
  name: string
  /** backend types.Agent uses json:"type" */
  type?: number
  agent_type?: number
  user_id: number
  status: number
  hostname: string
  version: string
  last_heartbeat: string
  description: string
  gmt_create: string
  gmt_modified: string
  token?: string
}

interface BackendAgentListResponse {
  page?: number
  limit?: number
  total?: number
  items?: BackendAgent[] | null
}

function toAgentItem(item: BackendAgent): AgentItem {
  return {
    id: item.id,
    resourceVersion: item.resource_version,
    name: item.name,
    type: item.type ?? item.agent_type ?? 0,
    userId: item.user_id ?? 0,
    status: item.status,
    hostname: item.hostname ?? '',
    version: item.version ?? '',
    lastHeartbeat: item.last_heartbeat ?? '',
    description: item.description ?? '',
    gmtCreate: item.gmt_create ?? '',
    gmtModified: item.gmt_modified ?? '',
    token: item.token ?? ''
  }
}

export interface AgentListParams {
  page?: number
  limit?: number
  nameSelector?: string
  status?: number
}

export async function fetchAgentList(
  params: AgentListParams = {}
): Promise<{ total: number; items: AgentItem[] }> {
  const page = params.page ?? 1
  const limit = params.limit ?? 10
  const res = await pixiuAxios.get('/pixiu/agents', {
    params: { page, limit, nameSelector: params.nameSelector, status: params.status }
  })
  const { code, result, message } = res.data
  if (code !== 200) throw new Error(message || '获取代理列表失败')
  const data = result as BackendAgentListResponse
  return { total: data?.total ?? 0, items: (data?.items ?? []).map(toAgentItem) }
}

export async function fetchAgentDetail(id: number): Promise<AgentItem> {
  const res = await pixiuAxios.get(`/pixiu/agents/${id}`)
  const { code, result, message } = res.data
  if (code !== 200) throw new Error(message || '获取代理详情失败')
  return toAgentItem(result as BackendAgent)
}

export async function fetchCreateAgent(
  name: string,
  type: number,
  description: string
): Promise<void> {
  const res = await pixiuAxios.post('/pixiu/agents', { name, type, description })
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '创建代理失败')
}

export async function fetchUpdateAgent(
  id: number,
  resourceVersion: number,
  updates: Record<string, unknown>
): Promise<void> {
  const res = await pixiuAxios.put(`/pixiu/agents/${id}`, {
    ...updates,
    resource_version: resourceVersion
  })
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '更新代理失败')
}

export async function fetchDeleteAgent(id: number): Promise<void> {
  const res = await pixiuAxios.delete(`/pixiu/agents/${id}`)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '删除代理失败')
}

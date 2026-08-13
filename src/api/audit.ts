import { pixiuAxios } from '@/api/container'

export interface AuditItem {
  id: number
  resourceVersion: number
  requestId: string
  ip: string
  action: string
  status: number // 0=失败 1=成功 2=未知
  operator: string
  path: string
  objectType: string // resource_type
  duration: number // ms
  responseCode: number
  cluster: string
  resourceName: string
  resourceNamespace: string
  gmtCreate: string
  gmtModified: string
}

interface BackendAuditItem {
  id: number
  resource_version: number
  request_id: string
  ip: string
  action: string
  status: number
  operator: string
  path: string
  resource_type: string
  duration: number
  response_code: number
  cluster: string
  resource_name: string
  resource_namespace: string
  gmt_create: string
  gmt_modified: string
}

interface AuditListResponse {
  page: number
  limit: number
  total: number
  items: BackendAuditItem[] | null
}

export interface AuditListParams {
  page: number
  limit: number
  operator?: string
  action?: string
  object_type?: string
  cluster?: string
  status?: number
  start_time?: string
  end_time?: string
}

function toAuditItem(b: BackendAuditItem): AuditItem {
  return {
    id: b.id,
    resourceVersion: b.resource_version,
    requestId: b.request_id || '',
    ip: b.ip || '',
    action: b.action || '',
    status: b.status ?? 2,
    operator: b.operator || '',
    path: b.path || '',
    objectType: b.resource_type || '*',
    duration: b.duration ?? 0,
    responseCode: b.response_code ?? 0,
    cluster: b.cluster || '',
    resourceName: b.resource_name || '',
    resourceNamespace: b.resource_namespace || '',
    gmtCreate: b.gmt_create || '',
    gmtModified: b.gmt_modified || ''
  }
}

export async function fetchAuditList(
  params: AuditListParams
): Promise<{ total: number; items: AuditItem[] }> {
  const query: Record<string, unknown> = {
    page: params.page,
    limit: params.limit
  }
  if (params.operator) query.operator = params.operator
  if (params.action) query.action = params.action
  if (params.object_type) query.object_type = params.object_type
  if (params.cluster) query.cluster = params.cluster
  if (params.status !== undefined) query.status = params.status
  if (params.start_time) query.start_time = params.start_time
  if (params.end_time) query.end_time = params.end_time

  const res = await pixiuAxios.get('/pixiu/audits', { params: query })
  const { code, result, message } = res.data
  if (code !== 200) throw new Error(message || '获取审计列表失败')
  const data = result as AuditListResponse
  return {
    total: data.total ?? 0,
    items: (data.items ?? []).map(toAuditItem)
  }
}

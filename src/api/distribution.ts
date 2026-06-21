import { pixiuAxios } from './container'

export interface DistributionItem {
  id: number
  resourceVersion: number
  family: string
  name: string
  runner: string
  gmtCreate?: string
  gmtModified?: string
}

interface PixiuDistributionItem {
  id: number
  resource_version: number
  family: string
  name: string
  runner: string
  gmt_create?: string
  gmt_modified?: string
}

interface PixiuListDistributionResponse {
  total: number
  page?: number
  limit?: number
  items?: PixiuDistributionItem[]
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function mapPixiuDistributionItem(item: PixiuDistributionItem): DistributionItem {
  return {
    id: item.id,
    resourceVersion: item.resource_version ?? 0,
    family: item.family,
    name: item.name,
    runner: item.runner,
    gmtCreate: formatDateTime(item.gmt_create),
    gmtModified: formatDateTime(item.gmt_modified)
  }
}

export interface DistributionListParams {
  current: number
  size: number
  family?: string
  nameSelector?: string
}

export interface DistributionList {
  records: DistributionItem[]
  total: number
  current: number
  size: number
}

// 获取 Distribution 列表
export async function fetchGetDistributionList(params: DistributionListParams): Promise<DistributionList> {
  const query: Record<string, unknown> = {
    page: params.current || 1,
    limit: params.size || 20
  }
  if (params.family) query.family = params.family
  if (params.nameSelector) query.nameSelector = params.nameSelector

  const res = await pixiuAxios.get('/pixiu/distributions', { params: query })
  const { code, result, message } = res.data
  if (code !== 200) {
    throw new Error(message || '获取操作系统列表失败')
  }

  const payload = (result || {}) as PixiuListDistributionResponse
  const records = (payload.items || []).map(mapPixiuDistributionItem)

  return {
    records,
    total: payload.total || 0,
    current: params.current || 1,
    size: params.size || 20
  }
}

// 获取单个 Distribution 详情
export async function fetchGetDistribution(id: number): Promise<DistributionItem> {
  const res = await pixiuAxios.get(`/pixiu/distributions/${id}`)
  const { code, result, message } = res.data
  if (code !== 200) {
    throw new Error(message || '获取操作系统详情失败')
  }
  return mapPixiuDistributionItem((result || {}) as PixiuDistributionItem)
}

export interface CreateDistributionParams {
  family: string
  name: string
  runner: string
}

// 创建 Distribution
export async function fetchCreateDistribution(params: CreateDistributionParams): Promise<void> {
  const res = await pixiuAxios.post('/pixiu/distributions', params)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '创建操作系统失败')
}

export interface UpdateDistributionParams {
  id: number
  resourceVersion: number
  family?: string
  name?: string
  runner?: string
}

// 更新 Distribution
export async function fetchUpdateDistribution(params: UpdateDistributionParams): Promise<void> {
  const data: Record<string, unknown> = {
    resource_version: params.resourceVersion
  }
  if (params.family !== undefined) data.family = params.family
  if (params.name !== undefined) data.name = params.name
  if (params.runner !== undefined) data.runner = params.runner

  const res = await pixiuAxios.put(`/pixiu/distributions/${params.id}`, data)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '更新操作系统失败')
}

// 删除 Distribution
export async function fetchDeleteDistribution(id: number): Promise<void> {
  const res = await pixiuAxios.delete(`/pixiu/distributions/${id}`)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '删除操作系统失败')
}

// 批量删除 Distribution
export async function fetchBatchDeleteDistributions(ids: number[]): Promise<void> {
  for (const id of ids) {
    const res = await pixiuAxios.delete(`/pixiu/distributions/${id}`)
    const { code, message } = res.data
    if (code !== 200) throw new Error(message || `删除操作系统 ${id} 失败`)
  }
}

// 获取所有 Distribution 列表（不带分页，用于选择器）
export async function fetchAllDistributions(): Promise<DistributionItem[]> {
  const res = await pixiuAxios.get('/pixiu/distributions', { params: { limit: 90 } })
  const { code, result, message } = res.data
  if (code !== 200) {
    throw new Error(message || '获取操作系统列表失败')
  }

  const payload = (result || {}) as PixiuListDistributionResponse
  return (payload.items || []).map(mapPixiuDistributionItem)
}

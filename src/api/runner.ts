import { pixiuAxios } from './container'

export interface RunnerItem {
  id: number
  resourceVersion: number
  name: string
  engineImage: string
  status: number
  description?: string
  gmtCreate?: string
  gmtModified?: string
}

// 状态映射
export const RunnerStatusMap = {
  0: { label: '未安装', type: 'info' },
  1: { label: '安装中', type: 'success' },
  2: { label: '已安装', type: 'primary' }
} as Record<number, { label: string; type: string }>

interface PixiuRunnerItem {
  id: number
  resource_version: number
  name: string
  engine_image: string
  status: number
  description?: string
  gmt_create?: string
  gmt_modified?: string
}

interface PixiuListRunnerResponse {
  total: number
  page?: number
  limit?: number
  items?: PixiuRunnerItem[]
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function mapPixiuRunnerItem(item: PixiuRunnerItem): RunnerItem {
  return {
    id: item.id,
    resourceVersion: item.resource_version ?? 0,
    name: item.name,
    engineImage: item.engine_image,
    status: item.status,
    description: item.description,
    gmtCreate: formatDateTime(item.gmt_create),
    gmtModified: formatDateTime(item.gmt_modified)
  }
}

export interface RunnerListParams {
  current: number
  size: number
  nameSelector?: string
}

export interface RunnerList {
  records: RunnerItem[]
  total: number
  current: number
  size: number
}

// 获取 Runner 列表
export async function fetchGetRunnerList(params: RunnerListParams): Promise<RunnerList> {
  const query: Record<string, unknown> = {
    page: params.current || 1,
    limit: params.size || 20
  }
  if (params.nameSelector) query.nameSelector = params.nameSelector

  const res = await pixiuAxios.get('/pixiu/runners', { params: query })
  const { code, result, message } = res.data
  if (code !== 200) {
    throw new Error(message || '获取 Runner 列表失败')
  }

  const payload = (result || {}) as PixiuListRunnerResponse
  const records = (payload.items || []).map(mapPixiuRunnerItem)

  return {
    records,
    total: payload.total || 0,
    current: params.current || 1,
    size: params.size || 20
  }
}

// 获取所有 Runner 列表（不带分页，用于下拉选择器）
export async function fetchAllRunners(): Promise<RunnerItem[]> {
  const res = await pixiuAxios.get('/pixiu/runners', { params: { limit: 999 } })
  const { code, result, message } = res.data
  if (code !== 200) {
    throw new Error(message || '获取 Runner 列表失败')
  }

  const payload = (result || {}) as PixiuListRunnerResponse
  return (payload.items || []).map(mapPixiuRunnerItem)
}

// 获取单个 Runner 详情
export async function fetchGetRunner(id: number): Promise<RunnerItem> {
  const res = await pixiuAxios.get(`/pixiu/runners/${id}`)
  const { code, result, message } = res.data
  console.log('fetchGetRunner - 完整响应:', res.data)
  console.log('fetchGetRunner - result:', result)
  if (code !== 200) {
    throw new Error(message || '获取 Runner 详情失败')
  }
  const item = mapPixiuRunnerItem((result || {}) as PixiuRunnerItem)
  console.log('fetchGetRunner - 转换后的数据:', item)
  return item
}

export interface CreateRunnerParams {
  name: string
  engineImage: string
  status?: number
  description?: string
}

// 创建 Runner
export async function fetchCreateRunner(params: CreateRunnerParams): Promise<void> {
  const data: Record<string, unknown> = {
    name: params.name,
    engine_image: params.engineImage
  }
  if (params.status !== undefined) data.status = params.status
  if (params.description !== undefined) data.description = params.description

  const res = await pixiuAxios.post('/pixiu/runners', data)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '创建 Runner 失败')
}

export interface UpdateRunnerParams {
  id: number
  resourceVersion: number
  name?: string
  engineImage?: string
  status?: number
  description?: string
}

// 更新 Runner
export async function fetchUpdateRunner(id: number, params: UpdateRunnerParams): Promise<void> {
  console.log('fetchUpdateRunner 被调用, params:', params)
  const data: Record<string, unknown> = {
    resource_version: params.resourceVersion
  }
  if (params.name !== undefined) data.name = params.name
  if (params.engineImage !== undefined) data.engine_image = params.engineImage
  if (params.status !== undefined) data.status = params.status
  if (params.description !== undefined) data.description = params.description

  console.log('fetchUpdateRunner 准备发送的数据:', data)
  const res = await pixiuAxios.put(`/pixiu/runners/${id}`, data)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '更新 Runner 失败')
}

// 删除 Runner
export async function fetchDeleteRunner(id: number): Promise<void> {
  const res = await pixiuAxios.delete(`/pixiu/runners/${id}`)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '删除 Runner 失败')
}

// 批量删除 Runner
export async function fetchBatchDeleteRunners(ids: number[]): Promise<void> {
  for (const id of ids) {
    const res = await pixiuAxios.delete(`/pixiu/runners/${id}`)
    const { code, message } = res.data
    if (code !== 200) throw new Error(message || `删除 Runner ${id} 失败`)
  }
}

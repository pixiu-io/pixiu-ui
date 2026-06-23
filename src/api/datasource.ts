import { pixiuAxios } from './container'

// 数据源类型枚举
export const DatasourceTypeMap = {
  0: { label: '日志', type: 'info' },
  1: { label: '告警', type: 'warning' }
} as Record<number, { label: string; type: string }>

// 数据源子类型枚举
export const DatasourceSubTypeMap: Record<string, string> = {
  loki: 'Loki',
  es: 'Elasticsearch',
  prometheus: 'Prometheus'
}

export interface DatasourceItem {
  id: number
  resourceVersion: number
  clusterName: string
  name: string
  type: number
  subType: string
  url: string
  config?: DatasourceConfig
  isDefault: boolean
  description?: string
  gmtCreate?: string
  gmtModified?: string
}

export interface DatasourceConfig {
  log?: {
    url?: string
    user_name?: string
    password?: string
  }
  alert?: {
    url?: string
  }
}

interface PixiuDatasourceItem {
  id: number
  resource_version: number
  cluster_name: string
  name: string
  type: number
  sub_type: string
  url: string
  config?: DatasourceConfig
  is_default: boolean
  description?: string
  gmt_create?: string
  gmt_modified?: string
}

interface PixiuListDatasourceResponse {
  total: number
  page?: number
  limit?: number
  items?: PixiuDatasourceItem[]
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function mapPixiuDatasourceItem(item: PixiuDatasourceItem): DatasourceItem {
  return {
    id: item.id,
    resourceVersion: item.resource_version ?? 0,
    clusterName: item.cluster_name,
    name: item.name,
    type: item.type,
    subType: item.sub_type,
    url: item.url,
    config: item.config,
    isDefault: item.is_default,
    description: item.description,
    gmtCreate: formatDateTime(item.gmt_create),
    gmtModified: formatDateTime(item.gmt_modified)
  }
}

export interface DatasourceListParams {
  current: number
  size: number
  nameSelector?: string
}

export interface DatasourceList {
  records: DatasourceItem[]
  total: number
  current: number
  size: number
}

// 获取数据源列表
export async function fetchGetDatasourceList(params: DatasourceListParams): Promise<DatasourceList> {
  const query: Record<string, unknown> = {
    page: params.current || 1,
    limit: params.size || 20
  }
  if (params.nameSelector) query.nameSelector = params.nameSelector

  const res = await pixiuAxios.get('/pixiu/datasources', { params: query })
  const { code, result, message } = res.data
  if (code !== 200) {
    throw new Error(message || '获取数据源列表失败')
  }

  const payload = (result || {}) as PixiuListDatasourceResponse
  const records = (payload.items || []).map(mapPixiuDatasourceItem)

  return {
    records,
    total: payload.total || 0,
    current: params.current || 1,
    size: params.size || 20
  }
}

// 获取单个数据源详情
export async function fetchGetDatasource(id: number): Promise<DatasourceItem> {
  const res = await pixiuAxios.get(`/pixiu/datasources/${id}`)
  const { code, result, message } = res.data
  if (code !== 200) {
    throw new Error(message || '获取数据源详情失败')
  }
  return mapPixiuDatasourceItem((result || {}) as PixiuDatasourceItem)
}

export interface CreateDatasourceParams {
  name: string
  type: number
  sub_type: string
  config?: DatasourceConfig
  is_default?: boolean
  description?: string
  cluster_name?: string
}

// 创建数据源
export async function fetchCreateDatasource(params: CreateDatasourceParams): Promise<void> {
  const data: Record<string, unknown> = {
    name: params.name,
    type: params.type,
    sub_type: params.sub_type
  }
  if (params.config !== undefined) data.config = params.config
  if (params.is_default !== undefined) data.is_default = params.is_default
  if (params.description !== undefined) data.description = params.description
  if (params.cluster_name !== undefined) data.cluster_name = params.cluster_name

  const res = await pixiuAxios.post('/pixiu/datasources', data)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '创建数据源失败')
}

export interface UpdateDatasourceParams {
  id: number
  resourceVersion: number
  name?: string
  sub_type?: string
  config?: DatasourceConfig
  is_default?: boolean
  description?: string
}

// 更新数据源
export async function fetchUpdateDatasource(params: UpdateDatasourceParams): Promise<void> {
  const data: Record<string, unknown> = {
    resource_version: params.resourceVersion
  }
  if (params.name !== undefined) data.name = params.name
  if (params.sub_type !== undefined) data.sub_type = params.sub_type
  if (params.config !== undefined) data.config = params.config
  if (params.is_default !== undefined) data.is_default = params.is_default
  if (params.description !== undefined) data.description = params.description

  const res = await pixiuAxios.put(`/pixiu/datasources/${params.id}`, data)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '更新数据源失败')
}

// 删除数据源
export async function fetchDeleteDatasource(id: number): Promise<void> {
  const res = await pixiuAxios.delete(`/pixiu/datasources/${id}`)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '删除数据源失败')
}

// 批量删除数据源
export async function fetchBatchDeleteDatasources(ids: number[]): Promise<void> {
  for (const id of ids) {
    const res = await pixiuAxios.delete(`/pixiu/datasources/${id}`)
    const { code, message } = res.data
    if (code !== 200) throw new Error(message || `删除数据源 ${id} 失败`)
  }
}

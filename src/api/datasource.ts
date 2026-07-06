import { pixiuAxios } from '@/api/container'

export type DatasourceType = 0 | 1
export type DatasourceSubType = 'loki' | 'es' | 'prometheus'

export const DatasourceTypeMap = {
  0: { label: '日志', type: 'info' },
  1: { label: '告警', type: 'warning' }
} as const satisfies Record<number, { label: string; type: string }>

export const DatasourceSubTypeMap: Record<DatasourceSubType, string> = {
  loki: 'Loki',
  es: 'Elasticsearch',
  prometheus: 'Prometheus'
}

export interface DatasourceHeader {
  key: string
  value: string
}

export interface DatasourceLogConfig {
  url?: string
  userName?: string
  password?: string
}

export interface DatasourceAlertConfig {
  url?: string
  userName?: string
  password?: string
}

export interface DatasourceConfig {
  headers: DatasourceHeader[]
  log?: DatasourceLogConfig
  alert?: DatasourceAlertConfig
}

export interface DatasourceItem {
  id: number
  resourceVersion: number
  clusterName: string
  name: string
  type: DatasourceType
  subType: DatasourceSubType
  url?: string
  config: DatasourceConfig
  isDefault: boolean
  external: boolean
  description: string
  gmtCreate: string
  gmtModified: string
}

export function resolveDatasourceUrl(
  item: Pick<DatasourceItem, 'config'> & Partial<Pick<DatasourceItem, 'url'>>
): string {
  return item.config.log?.url?.trim() || item.config.alert?.url?.trim() || item.url?.trim() || ''
}

interface BackendDatasourceHeader {
  key?: string
  value?: string
}

interface BackendDatasourceLogConfig {
  url?: string
  user_name?: string
  password?: string
}

interface BackendDatasourceAlertConfig {
  url?: string
  user_name?: string
  password?: string
}

interface BackendDatasourceConfig {
  headers?: BackendDatasourceHeader[] | null
  log?: BackendDatasourceLogConfig | null
  alert?: BackendDatasourceAlertConfig | null
}

interface BackendDatasourceItem {
  id: number
  resource_version?: number
  cluster_name?: string
  name?: string
  type?: DatasourceType
  sub_type?: DatasourceSubType
  url?: string
  config?: BackendDatasourceConfig | null
  is_default?: boolean
  external?: boolean
  description?: string
  gmt_create?: string
  gmt_modified?: string
}

interface BackendDatasourceListResponse {
  page?: number
  limit?: number
  total?: number
  items?: BackendDatasourceItem[] | null
}

export interface DatasourceListParams {
  page?: number
  limit?: number
  nameSelector?: string
  current?: number
  size?: number
  clusterName?: string
  type?: DatasourceType
  subType?: DatasourceSubType
}

export interface DatasourceList {
  records: DatasourceItem[]
  total: number
  current: number
  size: number
}

export interface CreateDatasourcePayload {
  clusterName: string
  name: string
  type: DatasourceType
  subType: DatasourceSubType
  url: string
  external?: boolean
  config?: {
    headers?: DatasourceHeader[]
    log?: {
      url?: string
      userName?: string
      password?: string
    }
    alert?: {
      url?: string
      userName?: string
      password?: string
    }
  }
  isDefault?: boolean
  description?: string
}

export interface UpdateDatasourcePayload {
  id: number
  resourceVersion: number
  clusterName?: string
  name?: string
  type?: DatasourceType
  subType?: DatasourceSubType
  url?: string
  external?: boolean
  config?: {
    headers?: DatasourceHeader[]
    log?: {
      url?: string
      userName?: string
      password?: string
    }
    alert?: {
      url?: string
      userName?: string
      password?: string
    }
  }
  isDefault?: boolean
  description?: string
}

function normalizeConfig(
  config?: BackendDatasourceConfig | null,
  fallbackUrl?: string
): DatasourceConfig {
  const headers = (config?.headers ?? [])
    .map((item) => ({
      key: item?.key ?? '',
      value: item?.value ?? ''
    }))
    .filter((item) => item.key || item.value)

  const log =
    config?.log || fallbackUrl
      ? {
          url: config?.log?.url ?? fallbackUrl ?? '',
          userName: config?.log?.user_name ?? '',
          password: config?.log?.password ?? ''
        }
      : undefined

  const alert =
    config?.alert?.url || fallbackUrl
      ? {
          url: config?.alert?.url ?? fallbackUrl ?? '',
          userName: config?.alert?.user_name ?? '',
          password: config?.alert?.password ?? ''
        }
      : undefined

  return {
    headers,
    log,
    alert
  }
}

function toBackendConfig(
  config: CreateDatasourcePayload['config'] | UpdateDatasourcePayload['config'] | undefined,
  fallbackUrl?: string
): BackendDatasourceConfig {
  return {
    headers: config?.headers ?? [],
    log:
      config?.log || fallbackUrl
        ? {
            url: config?.log?.url ?? fallbackUrl ?? '',
            user_name: config?.log?.userName ?? '',
            password: config?.log?.password ?? ''
          }
        : undefined,
    alert:
      config?.alert || fallbackUrl
        ? {
            url: config?.alert?.url ?? fallbackUrl ?? '',
            user_name: config?.alert?.userName ?? '',
            password: config?.alert?.password ?? ''
          }
        : undefined
  }
}

function toDatasourceItem(item: BackendDatasourceItem): DatasourceItem {
  return {
    id: item.id,
    resourceVersion: item.resource_version ?? 0,
    clusterName: item.cluster_name ?? '',
    name: item.name ?? '',
    type: item.type ?? 0,
    subType: item.sub_type ?? 'loki',
    url: item.url ?? '',
    config: normalizeConfig(item.config, item.url),
    isDefault: Boolean(item.is_default),
    external: Boolean(item.external),
    description: item.description ?? '',
    gmtCreate: item.gmt_create ?? '',
    gmtModified: item.gmt_modified ?? ''
  }
}

export async function fetchDatasourceList(
  params: DatasourceListParams = {}
): Promise<{ total: number; items: DatasourceItem[] }> {
  const page = params.page ?? params.current ?? 1
  const limit = params.limit ?? params.size ?? 100

  const res = await pixiuAxios.get('/pixiu/datasources', {
    params: {
      page,
      limit,
      nameSelector: params.nameSelector ?? undefined,
      cluster_name: params.clusterName ?? undefined,
      datasource_type: params.type ?? undefined,
      sub_type: params.subType ?? undefined
    }
  })

  const { code, result, message } = res.data
  if (code !== 200) throw new Error(message || '获取数据源列表失败')

  const data = result as BackendDatasourceListResponse
  return {
    total: data?.total ?? 0,
    items: (data?.items ?? []).map(toDatasourceItem)
  }
}

export async function fetchGetDatasourceList(
  params: DatasourceListParams = {}
): Promise<DatasourceList> {
  const current = params.current ?? params.page ?? 1
  const size = params.size ?? params.limit ?? 20
  const { total, items } = await fetchDatasourceList({
    current,
    size,
    nameSelector: params.nameSelector
  })

  return {
    records: items,
    total,
    current,
    size
  }
}

export async function fetchDatasourceDetail(id: number): Promise<DatasourceItem> {
  const res = await pixiuAxios.get(`/pixiu/datasources/${id}`)
  const { code, result, message } = res.data
  if (code !== 200) throw new Error(message || '获取数据源详情失败')
  return toDatasourceItem(result as BackendDatasourceItem)
}

export const fetchGetDatasource = fetchDatasourceDetail

export async function fetchCreateDatasource(payload: CreateDatasourcePayload): Promise<void> {
  const res = await pixiuAxios.post('/pixiu/datasources', {
    cluster_name: payload.clusterName,
    name: payload.name,
    type: payload.type,
    sub_type: payload.subType,
    url: payload.url,
    config: toBackendConfig(payload.config, payload.url),
    is_default: payload.isDefault ?? false,
    external: payload.external ?? false,
    description: payload.description ?? ''
  })

  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '创建数据源失败')
}

export async function fetchUpdateDatasource(payload: UpdateDatasourcePayload): Promise<void> {
  const data: Record<string, unknown> = {
    resource_version: payload.resourceVersion
  }

  if (payload.clusterName !== undefined) data.cluster_name = payload.clusterName
  if (payload.name !== undefined) data.name = payload.name
  if (payload.type !== undefined) data.type = payload.type
  if (payload.subType !== undefined) data.sub_type = payload.subType
  if (payload.url !== undefined) data.url = payload.url
  if (payload.config !== undefined) data.config = toBackendConfig(payload.config, payload.url)
  if (payload.isDefault !== undefined) data.is_default = payload.isDefault
  if (payload.external !== undefined) data.external = payload.external
  if (payload.description !== undefined) data.description = payload.description

  const res = await pixiuAxios.put(`/pixiu/datasources/${payload.id}`, data)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '更新数据源失败')
}

export async function fetchDeleteDatasource(id: number): Promise<void> {
  const res = await pixiuAxios.delete(`/pixiu/datasources/${id}`)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '删除数据源失败')
}

export async function fetchBatchDeleteDatasources(ids: number[]): Promise<void> {
  for (const id of ids) {
    await fetchDeleteDatasource(id)
  }
}

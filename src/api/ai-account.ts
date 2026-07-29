import { pixiuAxios } from './container'

interface PixiuAIProviderItem {
  id: number
  resource_version: number
  name: string
  base_url: string
  protocol: string
  description?: string
  max_tokens: number
  builtin: boolean
  gmt_create?: string
  gmt_modified?: string
}

interface PixiuAIAccountItem {
  id: number
  resource_version: number
  name: string
  api_key: string
  model: string
  provider_id: number
  user_id: number
  provider?: PixiuAIProviderItem
  gmt_create?: string
  gmt_modified?: string
}

interface PixiuPage<T> {
  total: number
  page?: number
  limit?: number
  items?: T[]
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function mapProvider(item: PixiuAIProviderItem): Api.SystemManage.AIProviderListItem {
  return {
    id: item.id,
    resourceVersion: item.resource_version ?? 0,
    name: item.name || '',
    baseUrl: item.base_url || '',
    protocol: item.protocol || '',
    description: item.description || '',
    maxTokens: item.max_tokens || 4096,
    builtin: Boolean(item.builtin)
  }
}

function mapAccount(item: PixiuAIAccountItem): Api.SystemManage.AIAccountListItem {
  return {
    id: item.id,
    resourceVersion: item.resource_version ?? 0,
    name: item.name || '',
    apiKey: item.api_key || '',
    model: item.model || '',
    providerId: item.provider_id || 0,
    provider: item.provider ? mapProvider(item.provider) : undefined,
    createTime: formatDateTime(item.gmt_create),
    updateTime: formatDateTime(item.gmt_modified)
  }
}

export async function fetchGetAIProviderList(): Promise<Api.SystemManage.AIProviderListItem[]> {
  const res = await pixiuAxios.get('/pixiu/assistant/providers', {
    params: { page: 1, limit: 100 }
  })
  const { code, result, message } = res.data
  if (code !== 200) throw new Error(message || '获取 AI Provider 列表失败')
  const payload = (result || {}) as PixiuPage<PixiuAIProviderItem>
  return (payload.items || []).map(mapProvider)
}

export async function fetchCreateAIProvider(params: {
  name: string
  baseUrl: string
  protocol: string
  description: string
  maxTokens: number
}): Promise<void> {
  const res = await pixiuAxios.post('/pixiu/assistant/providers', {
    name: params.name,
    base_url: params.baseUrl,
    protocol: params.protocol,
    description: params.description,
    max_tokens: params.maxTokens
  })
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '创建 Provider 失败')
}

export async function fetchUpdateAIProvider(params: {
  id: number
  resourceVersion: number
  name: string
  baseUrl: string
  protocol: string
  description: string
  maxTokens: number
}): Promise<void> {
  const res = await pixiuAxios.put(`/pixiu/assistant/providers/${params.id}`, {
    name: params.name,
    base_url: params.baseUrl,
    protocol: params.protocol,
    description: params.description,
    max_tokens: params.maxTokens,
    resource_version: params.resourceVersion
  })
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '更新 Provider 失败')
}

export async function fetchDeleteAIProvider(id: number): Promise<void> {
  const res = await pixiuAxios.delete(`/pixiu/assistant/providers/${id}`)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '删除 Provider 失败')
}

export async function fetchGetAIAccountList(
  params: Api.SystemManage.AIAccountSearchParams
): Promise<Api.SystemManage.AIAccountList> {
  const query: Record<string, unknown> = {
    page: params.current || 1,
    limit: params.size || 10
  }
  if (params.name) query.nameSelector = params.name
  if (params.providerId) query.provider_id = params.providerId

  const res = await pixiuAxios.get('/pixiu/assistant/accounts', { params: query })
  const { code, result, message } = res.data
  if (code !== 200) throw new Error(message || '获取 AI 账号列表失败')
  const payload = (result || {}) as PixiuPage<PixiuAIAccountItem>
  return {
    records: (payload.items || []).map(mapAccount),
    total: payload.total || 0,
    current: params.current || 1,
    size: params.size || 10
  }
}

export async function fetchCreateAIAccount(params: {
  name: string
  apiKey: string
  model: string
  providerId: number
}): Promise<void> {
  const res = await pixiuAxios.post('/pixiu/assistant/accounts', {
    name: params.name,
    api_key: params.apiKey,
    model: params.model,
    provider_id: params.providerId
  })
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '创建 AI 账号失败')
}

export async function fetchUpdateAIAccount(params: {
  id: number
  resourceVersion: number
  name: string
  apiKey?: string
  model: string
  providerId: number
}): Promise<void> {
  const res = await pixiuAxios.put(`/pixiu/assistant/accounts/${params.id}`, {
    name: params.name,
    api_key: params.apiKey || '',
    model: params.model,
    provider_id: params.providerId,
    resource_version: params.resourceVersion
  })
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '更新 AI 账号失败')
}

export async function fetchDeleteAIAccount(id: number): Promise<void> {
  const res = await pixiuAxios.delete(`/pixiu/assistant/accounts/${id}`)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '删除 AI 账号失败')
}

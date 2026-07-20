import { pixiuAxios } from './container'

export const AI_ACCOUNT_STORAGE_KEY = 'pixiu-selected-ai-account-id'

interface PixiuListResponse<T> {
  total: number
  page?: number
  limit?: number
  items?: T[]
}

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
  user_id: number
  provider_id: number
  name: string
  api_key: string
  model: string
  provider?: PixiuAIProviderItem
  gmt_create?: string
  gmt_modified?: string
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return dateStr
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function unwrap<T>(
  response: { data: { code: number; result?: T; message?: string } },
  message: string
): T {
  const { code, result, message: responseMessage } = response.data
  if (code !== 200) throw new Error(responseMessage || message)
  return result as T
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
    builtin: Boolean(item.builtin),
    createTime: formatDateTime(item.gmt_create),
    updateTime: formatDateTime(item.gmt_modified)
  }
}

function mapAccount(item: PixiuAIAccountItem): Api.SystemManage.AIAccountListItem {
  return {
    id: item.id,
    resourceVersion: item.resource_version ?? 0,
    userId: item.user_id || 0,
    providerId: item.provider_id || 0,
    name: item.name || '',
    apiKey: item.api_key || '',
    model: item.model || '',
    provider: item.provider ? mapProvider(item.provider) : undefined,
    createTime: formatDateTime(item.gmt_create),
    updateTime: formatDateTime(item.gmt_modified)
  }
}

export async function fetchGetAIProviderList(
  params: Api.SystemManage.AIProviderSearchParams
): Promise<Api.SystemManage.AIProviderList> {
  const response = await pixiuAxios.get('/pixiu/assistant/providers', {
    params: {
      page: params.current || 1,
      limit: params.size || 10,
      nameSelector: params.name || undefined
    }
  })
  const payload =
    unwrap<PixiuListResponse<PixiuAIProviderItem>>(response, '获取供应商列表失败') || {}
  return {
    records: (payload.items || []).map(mapProvider),
    total: payload.total || 0,
    current: params.current || 1,
    size: params.size || 10
  }
}

export async function fetchCreateAIProvider(params: {
  name: string
  baseUrl: string
  protocol: string
  description: string
  maxTokens: number
}): Promise<void> {
  unwrap(
    await pixiuAxios.post('/pixiu/assistant/providers', {
      name: params.name,
      base_url: params.baseUrl,
      protocol: params.protocol,
      description: params.description,
      max_tokens: params.maxTokens
    }),
    '创建供应商失败'
  )
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
  unwrap(
    await pixiuAxios.put(`/pixiu/assistant/providers/${params.id}`, {
      name: params.name,
      base_url: params.baseUrl,
      protocol: params.protocol,
      description: params.description,
      max_tokens: params.maxTokens,
      resource_version: params.resourceVersion
    }),
    '更新供应商失败'
  )
}

export async function fetchDeleteAIProvider(id: number): Promise<void> {
  unwrap(await pixiuAxios.delete(`/pixiu/assistant/providers/${id}`), '删除供应商失败')
}

export async function fetchGetAIAccountList(
  params: Api.SystemManage.AIAccountSearchParams
): Promise<Api.SystemManage.AIAccountList> {
  const response = await pixiuAxios.get('/pixiu/assistant/accounts', {
    params: {
      page: params.current || 1,
      limit: params.size || 10,
      provider_id: params.providerId || undefined,
      nameSelector: params.name || undefined
    }
  })
  const payload =
    unwrap<PixiuListResponse<PixiuAIAccountItem>>(response, '获取 AI 账号列表失败') || {}
  return {
    records: (payload.items || []).map(mapAccount),
    total: payload.total || 0,
    current: params.current || 1,
    size: params.size || 10
  }
}

export async function fetchGetAIAccount(id: number): Promise<Api.SystemManage.AIAccountListItem> {
  const response = await pixiuAxios.get(`/pixiu/assistant/accounts/${id}`)
  return mapAccount(unwrap<PixiuAIAccountItem>(response, '获取 AI 账号详情失败'))
}

export async function fetchCreateAIAccount(params: {
  providerId: number
  name: string
  apiKey: string
  model: string
}): Promise<void> {
  unwrap(
    await pixiuAxios.post('/pixiu/assistant/accounts', {
      provider_id: params.providerId,
      name: params.name,
      api_key: params.apiKey,
      model: params.model
    }),
    '创建 AI 账号失败'
  )
}

export async function fetchUpdateAIAccount(params: {
  id: number
  resourceVersion: number
  providerId: number
  name: string
  apiKey?: string
  model: string
}): Promise<void> {
  unwrap(
    await pixiuAxios.put(`/pixiu/assistant/accounts/${params.id}`, {
      provider_id: params.providerId,
      name: params.name,
      api_key: params.apiKey || undefined,
      model: params.model,
      resource_version: params.resourceVersion
    }),
    '更新 AI 账号失败'
  )
}

export async function fetchDeleteAIAccount(id: number): Promise<void> {
  unwrap(await pixiuAxios.delete(`/pixiu/assistant/accounts/${id}`), '删除 AI 账号失败')
}

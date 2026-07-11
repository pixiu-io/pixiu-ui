import { pixiuAxios } from './container'

interface PixiuAIAccountItem {
  id: number
  resource_version: number
  provider: string
  api_key: string
  base_url?: string
  model?: string
  description?: string
  enabled: boolean
  gmt_create?: string
  gmt_modified?: string
}

interface PixiuListAIAccountResponse {
  total: number
  page?: number
  limit?: number
  items?: PixiuAIAccountItem[]
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function mapPixiuAIAccountItem(item: PixiuAIAccountItem): Api.SystemManage.AIAccountListItem {
  return {
    id: item.id,
    resourceVersion: item.resource_version ?? 0,
    provider: item.provider || '',
    apiKey: item.api_key || '',
    baseUrl: item.base_url || '',
    model: item.model || '',
    description: item.description || '',
    enabled: Boolean(item.enabled),
    createTime: formatDateTime(item.gmt_create),
    updateTime: formatDateTime(item.gmt_modified)
  }
}

export async function fetchGetAIAccountList(
  params: Api.SystemManage.AIAccountSearchParams
): Promise<Api.SystemManage.AIAccountList> {
  const query: Record<string, unknown> = {
    page: params.current || 1,
    limit: params.size || 10
  }
  if (params.provider) query.provider = params.provider
  if (params.enabled !== undefined) query.enabled = params.enabled

  const providerBaseURL = '/pixiu/assistant/providers'

  const res = await pixiuAxios.get(providerBaseURL, { params: query })
  const { code, result, message } = res.data
  if (code !== 200) {
    throw new Error(message || '获取 AI 配置列表失败')
  }

  const payload = (result || {}) as PixiuListAIAccountResponse
  const records = (payload.items || []).map((item) => mapPixiuAIAccountItem(item))

  return {
    records,
    total: payload.total || 0,
    current: params.current || 1,
    size: params.size || 10
  }
}

export async function fetchCreateAIAccount(params: {
  provider: string
  apiKey: string
  baseUrl?: string
  model?: string
  description?: string
  enabled: boolean
}): Promise<void> {
  const res = await pixiuAxios.post('/pixiu/assistant/providers', {
    provider: params.provider,
    api_key: params.apiKey,
    base_url: params.baseUrl || '',
    model: params.model || '',
    description: params.description || '',
    enabled: params.enabled
  })
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '创建 AI 配置失败')
}

export async function fetchUpdateAIAccount(params: {
  id: number
  resourceVersion: number
  provider: string
  apiKey: string
  baseUrl?: string
  model?: string
  description?: string
  enabled: boolean
}): Promise<void> {
  const res = await pixiuAxios.put(`/pixiu/assistant/providers/${params.id}`, {
    provider: params.provider,
    api_key: params.apiKey,
    base_url: params.baseUrl || '',
    model: params.model || '',
    description: params.description || '',
    enabled: params.enabled,
    resource_version: params.resourceVersion
  })
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '更新 AI 配置失败')
}

export async function fetchDeleteAIAccount(id: number): Promise<void> {
  const res = await pixiuAxios.delete(`/pixiu/assistant/providers/${id}`)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '删除 AI 配置失败')
}

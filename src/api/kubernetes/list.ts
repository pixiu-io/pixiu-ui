import { kubeProxyAxios } from '@/api/kubeProxy'

type KubeListResponse<T> = {
  items?: T[]
  metadata?: { continue?: string; remainingItemCount?: number }
}

type FetchKubeListBaseParams = {
  path: string
  fieldSelector?: string
  labelSelector?: string
  extraQuery?: Record<string, unknown>
}

type FetchKubeListPageParams = FetchKubeListBaseParams & {
  page: number
  limit: number
  chunkLimit?: number
}

export type FetchKubeListCountParams = FetchKubeListBaseParams

/**
 * 仅统计资源数量：单次 list（limit=1）+ metadata.remainingItemCount，不拉全量 items。
 * 兼容未返回 remainingItemCount 的旧版 apiserver（按需继续分页计数）。
 */
export async function fetchKubeListCount(params: FetchKubeListCountParams): Promise<number> {
  const query: Record<string, unknown> = { limit: 1 }
  if (params.fieldSelector) query.fieldSelector = params.fieldSelector
  if (params.labelSelector) query.labelSelector = params.labelSelector
  if (params.extraQuery) Object.assign(query, params.extraQuery)

  const { data } = await kubeProxyAxios.get<KubeListResponse<unknown>>(params.path, {
    params: query
  })
  const pageSize = (data.items ?? []).length
  const remaining = data.metadata?.remainingItemCount

  if (typeof remaining === 'number' && remaining >= 0) {
    return pageSize + remaining
  }

  if (!data.metadata?.continue) {
    return pageSize
  }

  let total = pageSize
  let continueToken: string | undefined = data.metadata.continue
  const pageLimit = 500

  while (continueToken) {
    // @ts-ignore
    const { data: page } = await kubeProxyAxios.get<KubeListResponse<any>>(params.path, {
      params: { ...query, limit: pageLimit, continue: continueToken }
    })
    total += (page.items ?? []).length
    continueToken = page.metadata?.continue || undefined
    const pageRemaining = page.metadata?.remainingItemCount
    if (typeof pageRemaining === 'number' && pageRemaining >= 0) {
      return total + pageRemaining
    }
  }

  return total
}

export async function fetchKubeListPage<T>(
  params: FetchKubeListPageParams
): Promise<{ items: T[]; total: number }> {
  const page = Math.max(1, params.page || 1)
  const limit = Math.max(1, params.limit || 10)
  const chunkLimit = Math.max(1, params.chunkLimit || 500)

  const allItems: T[] = []
  let continueToken: string | undefined

  do {
    const query: Record<string, unknown> = { limit: chunkLimit }
    if (params.fieldSelector) query.fieldSelector = params.fieldSelector
    if (params.extraQuery) Object.assign(query, params.extraQuery)
    if (continueToken) query.continue = continueToken

    const { data } = await kubeProxyAxios.get<KubeListResponse<T>>(params.path, { params: query })
    allItems.push(...(data.items ?? []))
    continueToken = data.metadata?.continue || undefined
  } while (continueToken)

  const start = (page - 1) * limit
  const end = start + limit
  return {
    items: allItems.slice(start, end),
    total: allItems.length
  }
}

/** 拉取列表全部条目（用于统计等场景，避免 page/limit 截断） */
export async function fetchKubeListAll<T>(
  params: Omit<FetchKubeListPageParams, 'page' | 'limit'>
): Promise<T[]> {
  const chunkLimit = Math.max(1, params.chunkLimit || 500)
  const allItems: T[] = []
  let continueToken: string | undefined

  do {
    const query: Record<string, unknown> = { limit: chunkLimit }
    if (params.fieldSelector) query.fieldSelector = params.fieldSelector
    if (params.extraQuery) Object.assign(query, params.extraQuery)
    if (continueToken) query.continue = continueToken

    const { data } = await kubeProxyAxios.get<KubeListResponse<T>>(params.path, { params: query })
    allItems.push(...(data.items ?? []))
    continueToken = data.metadata?.continue || undefined
  } while (continueToken)

  return allItems
}

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
  silence403?: boolean
}

type FetchKubeListPageParams = FetchKubeListBaseParams & {
  page: number
  limit: number
  chunkLimit?: number
  skipErrorNotification?: boolean
}

export type FetchKubeListCountParams = FetchKubeListBaseParams

const countPromiseMap = new Map<string, Promise<number>>()

/**
 * 仅统计资源数量：单次 list（limit=1）+ metadata.remainingItemCount，不拉全量 items。
 * 兼容未返回 remainingItemCount 的旧版 apiserver（按需继续分页计数）。
 * 增加 3s 缓存去重，避免并行重复统计。
 */
export async function fetchKubeListCount(params: FetchKubeListCountParams): Promise<number> {
  const query: Record<string, unknown> = { limit: 1 }
  if (params.fieldSelector) query.fieldSelector = params.fieldSelector
  if (params.labelSelector) query.labelSelector = params.labelSelector
  if (params.extraQuery) Object.assign(query, params.extraQuery)

  const cacheKey = `${params.path}:${JSON.stringify(query)}`
  if (countPromiseMap.has(cacheKey)) return countPromiseMap.get(cacheKey)!

  const promise = (async () => {
    try {
      const { data } = await kubeProxyAxios.get<KubeListResponse<unknown>>(params.path, {
        params: query,
        silence403: params.silence403,
        skipErrorNotification: params.silence403
      } as any)
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
          params: { ...query, limit: pageLimit, continue: continueToken },
          silence403: params.silence403,
          skipErrorNotification: params.silence403
        } as any)
        total += (page.items ?? []).length
        continueToken = page.metadata?.continue || undefined
        const pageRemaining = page.metadata?.remainingItemCount
        if (typeof pageRemaining === 'number' && pageRemaining >= 0) {
          return total + pageRemaining
        }
      }

      return total
    } finally {
      setTimeout(() => {
        if (countPromiseMap.get(cacheKey) === promise) {
          countPromiseMap.delete(cacheKey)
        }
      }, 3000)
    }
  })()

  countPromiseMap.set(cacheKey, promise)
  return promise
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

    const { data } = await kubeProxyAxios.get<KubeListResponse<T>>(params.path, {
      params: query,
      skipErrorNotification: params.skipErrorNotification
    })
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

const listAllPromiseMap = new Map<string, Promise<any>>()

type FetchKubeListAllOptions = {
  labelSelector?: string
  /** 无 list 权限时不弹错误（如授权用户访问概览页） */
  silence403?: boolean
}

/** 统一获取 K8s 资源列表（带 5s 缓存去重） */
export async function fetchKubeListAll<T = any>(
  cluster: string,
  path: string,
  options?: FetchKubeListAllOptions
): Promise<{ items: T[] }> {
  const labelSelector = options?.labelSelector
  const silence403 = options?.silence403 ?? false
  const cacheKey = `${cluster}:${path}:${labelSelector || ''}:${silence403}`
  if (listAllPromiseMap.has(cacheKey)) return listAllPromiseMap.get(cacheKey)!

  const promise = (async () => {
    try {
      const { data } = await kubeProxyAxios.get<{ items: T[] }>(path, {
        params: { limit: 500, labelSelector },
        silence403,
        skipErrorNotification: silence403
      } as any)
      return data
    } finally {
      setTimeout(() => {
        if (listAllPromiseMap.get(cacheKey) === promise) {
          listAllPromiseMap.delete(cacheKey)
        }
      }, 5000)
    }
  })()

  listAllPromiseMap.set(cacheKey, promise)
  return promise
}

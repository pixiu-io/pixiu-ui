import { kubeProxyAxios } from '@/api/kubeProxy'

export type ApiGroupVersion = string // e.g. networking.k8s.io/v1

interface APIGroup {
  name?: string
  preferredVersion?: { groupVersion?: string; version?: string }
  versions?: Array<{ groupVersion?: string; version?: string }>
}

interface APIResourceList {
  groupVersion?: string
  resources?: Array<{ name?: string; singularName?: string; kind?: string }>
}

type CacheEntry = {
  groupVersion: ApiGroupVersion
  expireAt: number
}

const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<ApiGroupVersion | null>>()

function cacheKey(cluster: string, group: string, resource: string) {
  return `${cluster}::${group}::${resource}`
}

/** 清除指定集群的 Discovery 缓存（可选 resource） */
export function invalidateApiDiscoveryCache(cluster: string, group?: string, resource?: string) {
  if (!group) {
    for (const key of cache.keys()) {
      if (key.startsWith(`${cluster}::`)) cache.delete(key)
    }
    return
  }
  if (!resource) {
    for (const key of cache.keys()) {
      if (key.startsWith(`${cluster}::${group}::`)) cache.delete(key)
    }
    return
  }
  cache.delete(cacheKey(cluster, group, resource))
}

async function fetchApiGroup(cluster: string, group: string): Promise<APIGroup | null> {
  try {
    const { data } = await kubeProxyAxios.get<APIGroup>(
      `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/${encodeURIComponent(group)}`,
      { skipErrorNotification: true } as any
    )
    return data
  } catch {
    return null
  }
}

async function resourceExistsInVersion(
  cluster: string,
  groupVersion: ApiGroupVersion,
  resource: string
): Promise<boolean> {
  try {
    const { data } = await kubeProxyAxios.get<APIResourceList>(
      `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/${groupVersion}`,
      { skipErrorNotification: true } as any
    )
    return (data.resources ?? []).some((r) => r.name === resource)
  } catch {
    return false
  }
}

/**
 * 解析集群上某 group/resource 的可用 GroupVersion。
 * 优先 preferredVersion，再尝试同 group 其它 version；都失败返回 null。
 */
export async function discoverPreferredApi(
  cluster: string,
  group: string,
  resource: string
): Promise<ApiGroupVersion | null> {
  const key = cacheKey(cluster, group, resource)
  const hit = cache.get(key)
  if (hit && hit.expireAt > Date.now()) return hit.groupVersion

  const pending = inflight.get(key)
  if (pending) return pending

  const task = (async () => {
    const apiGroup = await fetchApiGroup(cluster, group)
    if (!apiGroup) return null

    const candidates: ApiGroupVersion[] = []
    const preferred = apiGroup.preferredVersion?.groupVersion
    if (preferred) candidates.push(preferred)
    for (const v of apiGroup.versions ?? []) {
      const gv = v.groupVersion
      if (gv && !candidates.includes(gv)) candidates.push(gv)
    }

    for (const gv of candidates) {
      if (await resourceExistsInVersion(cluster, gv, resource)) {
        cache.set(key, { groupVersion: gv, expireAt: Date.now() + CACHE_TTL_MS })
        return gv
      }
    }
    return null
  })()

  inflight.set(key, task)
  try {
    return await task
  } finally {
    inflight.delete(key)
  }
}

/**
 * 按候选 GroupVersion 列表探测（用于跨 group，如 networking → extensions）。
 */
export async function discoverFromCandidates(
  cluster: string,
  resource: string,
  candidates: ApiGroupVersion[],
  cacheGroup = candidates[0]?.split('/')[0] || resource
): Promise<ApiGroupVersion | null> {
  const key = cacheKey(cluster, cacheGroup, resource)
  const hit = cache.get(key)
  if (hit && hit.expireAt > Date.now()) return hit.groupVersion

  for (const gv of candidates) {
    if (await resourceExistsInVersion(cluster, gv, resource)) {
      cache.set(key, { groupVersion: gv, expireAt: Date.now() + CACHE_TTL_MS })
      return gv
    }
  }
  return null
}

import type { RouteLocationNormalizedLoaded } from 'vue-router'

/** 集群内部名 → 展示别名（详情页离开 layout 后仍可用于面包屑与返回链接） */
const clusterAliasCache = new Map<string, string>()

export function setClusterAliasCache(name: string, aliasName: string): void {
  if (!name) return
  clusterAliasCache.set(name, aliasName || name)
}

export function getClusterAliasCache(name: string): string | undefined {
  return clusterAliasCache.get(name)
}

/** 面包屑等展示：优先 URL，其次内存缓存，最后回退内部名 */
export function resolveClusterAlias(
  route: Pick<RouteLocationNormalizedLoaded, 'query'>,
  clusterName?: string
): string {
  const name = clusterName ?? String(route.query.cluster ?? '')
  if (!name) return ''
  return String(route.query.aliasName ?? getClusterAliasCache(name) ?? name)
}

const PRESERVED_ROUTE_QUERY_KEYS = ['tab', 'overviewTab'] as const

/** 构建带 cluster、aliasName 的路由 query（进入/离开详情页时保持别名） */
export function buildClusterRouteQuery(
  route: Pick<RouteLocationNormalizedLoaded, 'query'>,
  extra?: Record<string, string | undefined>
): Record<string, string> {
  const cluster = String(extra?.cluster ?? route.query.cluster ?? '')
  if (!cluster) {
    const q: Record<string, string> = {}
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        if (v != null && v !== '') q[k] = v
      }
    }
    return q
  }

  const aliasName =
    extra?.aliasName ??
    (String(route.query.aliasName ?? '') || getClusterAliasCache(cluster) || '')

  const q: Record<string, string> = { cluster }
  if (aliasName) q.aliasName = aliasName

  for (const key of PRESERVED_ROUTE_QUERY_KEYS) {
    const v = extra?.[key] ?? route.query[key]
    if (typeof v === 'string' && v !== '') q[key] = v
  }

  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (k === 'cluster' || k === 'aliasName') continue
      if ((PRESERVED_ROUTE_QUERY_KEYS as readonly string[]).includes(k)) continue
      if (v != null && v !== '') q[k] = v
    }
  }

  return q
}

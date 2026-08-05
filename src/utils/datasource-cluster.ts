import { fetchClusterByName } from '@/api/container'
import { getClusterAliasCache, setClusterAliasCache } from '@/utils/navigation/cluster-query'

/** 数据源标签展示：优先别名，回退集群 ID */
export function resolveDatasourceClusterLabel(ds?: {
  clusterName?: string
  clusterAliasName?: string
} | null): string {
  if (!ds?.clusterName) return '-'
  const fromApi = ds.clusterAliasName?.trim()
  if (fromApi) return fromApi
  const cached = getClusterAliasCache(ds.clusterName)?.trim()
  if (cached) return cached
  return ds.clusterName
}

/** 按集群 ID 拉取并缓存别名（后端未返回 cluster_alias_name 时的兜底） */
export async function ensureClusterAlias(clusterName: string): Promise<string> {
  if (!clusterName) return ''
  const cached = getClusterAliasCache(clusterName)
  if (cached && cached !== clusterName) return cached
  try {
    const cluster = await fetchClusterByName(clusterName)
    const alias = cluster?.aliasName?.trim() || clusterName
    setClusterAliasCache(clusterName, alias)
    return alias
  } catch {
    return clusterName
  }
}

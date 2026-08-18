import { fetchDatasourceList, type DatasourceItem } from '@/api/datasource'

/** 数据源列表缓存 TTL：5 分钟内复用同一份数据源列表，避免多处重复请求 */
const DATASOURCE_CACHE_TTL = 5 * 60 * 1000
/** 数据源列表缓存，key 为 clusterName（item 可为 undefined，避免数据源缺失时每次重试探测） */
const datasourceCache = new Map<string, { item: DatasourceItem | undefined; expiresAt: number }>()

/**
 * 获取集群 Prometheus 数据源：命中未过期缓存直接返回，否则拉取并写入缓存（含 undefined）。
 * 多个 hook（监控抽屉 / 用量趋势 / 资源概览）共享同一份缓存，避免同一集群重复请求数据源列表。
 */
export async function loadPrometheusDatasource(
  clusterName: string
): Promise<DatasourceItem | undefined> {
  const cached = datasourceCache.get(clusterName)
  if (cached && cached.expiresAt > Date.now()) return cached.item
  const result = await fetchDatasourceList({ clusterName, subType: 'prometheus' })
  const item = result.items?.find((i) => i.isDefault) ?? result.items?.[0]
  datasourceCache.set(clusterName, { item, expiresAt: Date.now() + DATASOURCE_CACHE_TTL })
  return item
}

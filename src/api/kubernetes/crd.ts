import { kubeProxyAxios } from '@/api/kubeProxy'
import { fetchKubeListPage } from './list'

/** apiextensions.k8s.io/v1 CustomResourceDefinition（列表/详情所需字段） */
export interface K8sCustomResourceDefinition {
  metadata?: {
    name?: string
    uid?: string
    creationTimestamp?: string
  }
  spec?: {
    group?: string
    scope?: string
    names?: {
      kind?: string
      plural?: string
      shortNames?: string[]
    }
    versions?: Array<{ name?: string; served?: boolean; storage?: boolean }>
  }
}

function crdCollectionPath(cluster: string) {
  return `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/apiextensions.k8s.io/v1/customresourcedefinitions`
}

/**
 * 分页列出集群内 CRD（通过代理拉全量后在内存分页，与 dashboard CRD 列表行为一致）
 */
export async function fetchK8sCustomResourceDefinitionList(
  cluster: string,
  params: { page: number; limit: number; name?: string }
): Promise<{ items: K8sCustomResourceDefinition[]; total: number }> {
  const base = crdCollectionPath(cluster)
  const { items: allCrds } = await fetchKubeListPage<K8sCustomResourceDefinition>({
    path: base,
    page: 1,
    limit: 500_000,
    chunkLimit: 500
  })
  const q = (params.name ?? '').trim().toLowerCase()
  const filtered = q
    ? allCrds.filter((c) => (c.metadata?.name ?? '').toLowerCase().includes(q))
    : allCrds
  const totalFiltered = filtered.length
  const start = (params.page - 1) * params.limit
  const items = filtered.slice(start, start + params.limit)
  return { items, total: totalFiltered }
}

export async function fetchK8sCustomResourceDefinition(
  cluster: string,
  name: string
): Promise<K8sCustomResourceDefinition> {
  const { data } = await kubeProxyAxios.get<K8sCustomResourceDefinition>(
    `${crdCollectionPath(cluster)}/${encodeURIComponent(name)}`
  )
  return data
}

import { kubeProxyAxios } from '@/api/kubeProxy'
import { fetchKubeListPage } from './list'

export interface K8sAPIService {
  metadata?: {
    name?: string
    uid?: string
    creationTimestamp?: string
    labels?: Record<string, string>
  }
  spec?: {
    group?: string
    version?: string
    service?: {
      namespace?: string
      name?: string
      port?: number
    }
    groupPriorityMinimum?: number
    versionPriority?: number
    insecureSkipTLSVerify?: boolean
    caBundle?: string
  }
  status?: {
    conditions?: Array<{
      type?: string
      status?: string
      reason?: string
      message?: string
      lastTransitionTime?: string
    }>
  }
}

export async function fetchK8sAPIServiceList(
  cluster: string,
  params: { page: number; limit: number; name?: string }
): Promise<{ items: K8sAPIService[]; total: number }> {
  const c = encodeURIComponent(cluster)
  const path = `/pixiu/proxy/${c}/apis/apiregistration.k8s.io/v1/apiservices`
  const { items: allItems } = await fetchKubeListPage<K8sAPIService>({
    path,
    page: 1,
    limit: 500_000,
    chunkLimit: 500
  })
  const q = (params.name ?? '').trim().toLowerCase()
  const filtered = q
    ? allItems.filter((item) => (item.metadata?.name ?? '').toLowerCase().includes(q))
    : allItems
  const totalFiltered = filtered.length
  const start = (params.page - 1) * params.limit
  const items = filtered.slice(start, start + params.limit)
  return { items, total: totalFiltered }
}

export async function fetchK8sAPIService(
  cluster: string,
  name: string
): Promise<K8sAPIService> {
  const c = encodeURIComponent(cluster)
  const { data } = await kubeProxyAxios.get<K8sAPIService>(
    `/pixiu/proxy/${c}/apis/apiregistration.k8s.io/v1/apiservices/${encodeURIComponent(name)}`
  )
  return data
}

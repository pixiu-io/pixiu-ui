import { kubeProxyAxios } from '@/api/kubeProxy'
import { fetchKubeListPage } from './list'

export interface K8sConfigMap {
  metadata?: {
    name?: string
    namespace?: string
    uid?: string
    creationTimestamp?: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  data?: Record<string, string>
  binaryData?: Record<string, string>
}

function cmBase(cluster: string, namespace: string) {
  return `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(namespace)}/configmaps`
}

export async function fetchK8sConfigMapList(
  cluster: string,
  params: { page: number; limit: number; namespace?: string }
): Promise<{ items: K8sConfigMap[]; total: number }> {
  const base = params.namespace
    ? `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(params.namespace)}/configmaps`
    : `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/configmaps`
  return fetchKubeListPage<K8sConfigMap>({
    path: base,
    page: params.page,
    limit: params.limit
  })
}

export async function fetchK8sConfigMap(cluster: string, namespace: string, name: string): Promise<K8sConfigMap> {
  const { data } = await kubeProxyAxios.get<K8sConfigMap>(`${cmBase(cluster, namespace)}/${encodeURIComponent(name)}`)
  return data
}

export async function deleteK8sConfigMap(cluster: string, namespace: string, name: string): Promise<void> {
  await kubeProxyAxios.delete(`${cmBase(cluster, namespace)}/${encodeURIComponent(name)}`)
}

export async function createK8sConfigMap(cluster: string, namespace: string, body: object): Promise<K8sConfigMap> {
  const { data } = await kubeProxyAxios.post<K8sConfigMap>(cmBase(cluster, namespace), body)
  return data
}

export async function patchK8sConfigMap(cluster: string, namespace: string, name: string, patch: object): Promise<K8sConfigMap> {
  const { data } = await kubeProxyAxios.patch<K8sConfigMap>(
    `${cmBase(cluster, namespace)}/${encodeURIComponent(name)}`,
    patch,
    { headers: { 'Content-Type': 'application/merge-patch+json' } }
  )
  return data
}

import { kubeProxyAxios } from '@/api/kubeProxy'
import { fetchKubeListPage } from './list'

export interface K8sSecret {
  metadata?: {
    name?: string
    namespace?: string
    uid?: string
    creationTimestamp?: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  type?: string
  data?: Record<string, string>
  stringData?: Record<string, string>
}

function secretBase(cluster: string, namespace: string) {
  return `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(namespace)}/secrets`
}

export async function fetchK8sSecretList(
  cluster: string,
  params: { page: number; limit: number; namespace?: string }
): Promise<{ items: K8sSecret[]; total: number }> {
  const base = params.namespace
    ? `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(params.namespace)}/secrets`
    : `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/secrets`
  return fetchKubeListPage<K8sSecret>({
    path: base,
    page: params.page,
    limit: params.limit
  })
}

export async function fetchK8sSecret(cluster: string, namespace: string, name: string): Promise<K8sSecret> {
  const { data } = await kubeProxyAxios.get<K8sSecret>(`${secretBase(cluster, namespace)}/${encodeURIComponent(name)}`)
  return data
}

export async function deleteK8sSecret(cluster: string, namespace: string, name: string): Promise<void> {
  await kubeProxyAxios.delete(`${secretBase(cluster, namespace)}/${encodeURIComponent(name)}`)
}

export async function createK8sSecret(cluster: string, namespace: string, body: object): Promise<K8sSecret> {
  const { data } = await kubeProxyAxios.post<K8sSecret>(secretBase(cluster, namespace), body)
  return data
}

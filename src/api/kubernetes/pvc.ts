import { kubeProxyAxios } from '@/api/kubeProxy'
import { fetchKubeListPage } from './list'

export interface K8sPVC {
  metadata?: {
    name?: string
    namespace?: string
    uid?: string
    creationTimestamp?: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  spec?: {
    accessModes?: string[]
    storageClassName?: string
    volumeName?: string
    resources?: {
      requests?: { storage?: string }
    }
    volumeMode?: string
  }
  status?: {
    phase?: string
    accessModes?: string[]
    capacity?: { storage?: string }
  }
}

function pvcBase(cluster: string, namespace: string) {
  return `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(namespace)}/persistentvolumeclaims`
}

export async function fetchK8sPVCList(
  cluster: string,
  params: { page: number; limit: number; namespace?: string; name?: string }
): Promise<{ items: K8sPVC[]; total: number }> {
  const base = params.namespace
    ? `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(params.namespace)}/persistentvolumeclaims`
    : `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/persistentvolumeclaims`
  return fetchKubeListPage<K8sPVC>({
    path: base,
    page: params.page,
    limit: params.limit,
    fieldSelector: params.name ? `metadata.name=${params.name}` : undefined
  })
}

export async function fetchK8sPVC(cluster: string, namespace: string, name: string): Promise<K8sPVC> {
  const { data } = await kubeProxyAxios.get<K8sPVC>(`${pvcBase(cluster, namespace)}/${encodeURIComponent(name)}`)
  return data
}

export async function createK8sPVC(cluster: string, namespace: string, body: object): Promise<K8sPVC> {
  const { data } = await kubeProxyAxios.post<K8sPVC>(pvcBase(cluster, namespace), body)
  return data
}

export async function deleteK8sPVC(cluster: string, namespace: string, name: string): Promise<void> {
  await kubeProxyAxios.delete(`${pvcBase(cluster, namespace)}/${encodeURIComponent(name)}`)
}

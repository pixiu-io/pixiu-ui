import { kubeProxyAxios } from '@/api/kubeProxy'
import { fetchKubeListPage } from './list'

export interface K8sStorageClass {
  metadata?: {
    name?: string
    uid?: string
    creationTimestamp?: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  provisioner?: string
  reclaimPolicy?: string
  volumeBindingMode?: string
  allowVolumeExpansion?: boolean
  parameters?: Record<string, string>
}

const scBase = (cluster: string) =>
  `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/storage.k8s.io/v1/storageclasses`

export async function fetchK8sStorageClassList(
  cluster: string,
  params: { page: number; limit: number }
): Promise<{ items: K8sStorageClass[]; total: number }> {
  return fetchKubeListPage<K8sStorageClass>({
    path: scBase(cluster),
    page: params.page,
    limit: params.limit
  })
}

export async function fetchK8sStorageClass(cluster: string, name: string): Promise<K8sStorageClass> {
  const { data } = await kubeProxyAxios.get<K8sStorageClass>(`${scBase(cluster)}/${encodeURIComponent(name)}`)
  return data
}

export async function deleteK8sStorageClass(cluster: string, name: string): Promise<void> {
  await kubeProxyAxios.delete(`${scBase(cluster)}/${encodeURIComponent(name)}`)
}

export async function createK8sStorageClass(cluster: string, body: object): Promise<K8sStorageClass> {
  const { data } = await kubeProxyAxios.post<K8sStorageClass>(scBase(cluster), body)
  return data
}

export async function putK8sStorageClass(cluster: string, name: string, body: object): Promise<K8sStorageClass> {
  const { data } = await kubeProxyAxios.put<K8sStorageClass>(`${scBase(cluster)}/${encodeURIComponent(name)}`, body)
  return data
}

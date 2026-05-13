import { kubeProxyAxios } from '@/api/kubeProxy'
import { fetchKubeListPage } from './list'

export interface K8sPV {
  metadata?: {
    name?: string
    uid?: string
    creationTimestamp?: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  spec?: {
    capacity?: { storage?: string }
    accessModes?: string[]
    persistentVolumeReclaimPolicy?: string
    storageClassName?: string
    volumeMode?: string
    claimRef?: {
      name?: string
      namespace?: string
    }
    csi?: { driver?: string; volumeHandle?: string }
    nfs?: { server?: string; path?: string }
    hostPath?: { path?: string }
  }
  status?: {
    phase?: string
    reason?: string
  }
}

const pvBase = (cluster: string) =>
  `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/persistentvolumes`

export async function fetchK8sPVList(
  cluster: string,
  params: { page: number; limit: number; name?: string }
): Promise<{ items: K8sPV[]; total: number }> {
  return fetchKubeListPage<K8sPV>({
    path: pvBase(cluster),
    page: params.page,
    limit: params.limit,
    fieldSelector: params.name ? `metadata.name=${params.name}` : undefined
  })
}

export async function fetchK8sPV(cluster: string, name: string): Promise<K8sPV> {
  const { data } = await kubeProxyAxios.get<K8sPV>(`${pvBase(cluster)}/${encodeURIComponent(name)}`)
  return data
}

export async function createK8sPV(cluster: string, body: object): Promise<K8sPV> {
  const { data } = await kubeProxyAxios.post<K8sPV>(pvBase(cluster), body)
  return data
}

export async function deleteK8sPV(cluster: string, name: string): Promise<void> {
  await kubeProxyAxios.delete(`${pvBase(cluster)}/${encodeURIComponent(name)}`)
}

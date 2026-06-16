import { kubeProxyAxios } from '@/api/kubeProxy'
import { fetchKubeListPage } from './list'

export interface K8sContainerState {
  waiting?: { reason?: string; message?: string }
  running?: { startedAt?: string }
  terminated?: { reason?: string; exitCode?: number }
}

export interface K8sContainerStatus {
  name?: string
  restartCount?: number
  ready?: boolean
  state?: K8sContainerState
}

export interface K8sPod {
  metadata: {
    name: string
    namespace?: string
    uid?: string
    creationTimestamp?: string
    deletionTimestamp?: string
  }
  spec?: {
    nodeName?: string
    initContainers?: Array<{ name?: string }>
    containers?: Array<{ name?: string }>
  }
  status?: {
    phase?: string
    reason?: string
    podIP?: string
    hostIP?: string
    initContainerStatuses?: K8sContainerStatus[]
    containerStatuses?: K8sContainerStatus[]
  }
}

export async function fetchK8sPodList(
  cluster: string,
  params: { page: number; limit: number; namespace?: string }
): Promise<{ items: K8sPod[]; total: number }> {
  const base = params.namespace
    ? `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(params.namespace)}/pods`
    : `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/pods`
  return fetchKubeListPage<K8sPod>({
    path: base,
    page: params.page,
    limit: params.limit
  })
}

export async function fetchK8sPod(cluster: string, namespace: string, name: string): Promise<K8sPod> {
  const { data } = await kubeProxyAxios.get<K8sPod>(
    `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(namespace)}/pods/${encodeURIComponent(name)}`
  )
  return data
}

export async function deleteK8sPod(cluster: string, namespace: string, name: string): Promise<void> {
  await kubeProxyAxios.delete(
    `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(namespace)}/pods/${encodeURIComponent(name)}`
  )
}

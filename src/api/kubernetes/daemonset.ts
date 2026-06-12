import { kubeProxyAxios } from '@/api/kubeProxy'
import { fetchKubeListPage } from './list'

export interface K8sDaemonSetContainer {
  name?: string
  image?: string
  resources?: {
    requests?: { cpu?: string; memory?: string }
    limits?: { cpu?: string; memory?: string }
  }
}

export interface K8sDaemonSet {
  metadata?: {
    name?: string
    namespace?: string
    uid?: string
    creationTimestamp?: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  spec?: {
    selector?: { matchLabels?: Record<string, string> }
    template?: { spec?: { containers?: K8sDaemonSetContainer[] } }
  }
  status?: {
    desiredNumberScheduled?: number
    currentNumberScheduled?: number
    numberReady?: number
    numberAvailable?: number
    numberUnavailable?: number
    updatedNumberScheduled?: number
  }
}

function dsBase(cluster: string, namespace: string) {
  return `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/daemonsets`
}

export async function fetchK8sDaemonSetList(
  cluster: string,
  params: { page: number; limit: number; namespace?: string }
): Promise<{ items: K8sDaemonSet[]; total: number }> {
  const base = params.namespace
    ? `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/apps/v1/namespaces/${encodeURIComponent(params.namespace)}/daemonsets`
    : `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/apps/v1/daemonsets`
  return fetchKubeListPage<K8sDaemonSet>({
    path: base,
    page: params.page,
    limit: params.limit
  })
}

export async function fetchK8sDaemonSet(cluster: string, namespace: string, name: string): Promise<K8sDaemonSet> {
  const { data } = await kubeProxyAxios.get<K8sDaemonSet>(
    `${dsBase(cluster, namespace)}/${encodeURIComponent(name)}`
  )
  return data
}

export async function deleteK8sDaemonSet(cluster: string, namespace: string, name: string): Promise<void> {
  await kubeProxyAxios.delete(`${dsBase(cluster, namespace)}/${encodeURIComponent(name)}`, { skipErrorNotification: true } as any)
}

export async function createK8sDaemonSet(cluster: string, namespace: string, body: object): Promise<K8sDaemonSet> {
  const { data } = await kubeProxyAxios.post<K8sDaemonSet>(dsBase(cluster, namespace), body, { skipErrorNotification: true } as any)
  return data
}

export async function patchK8sDaemonSet(cluster: string, namespace: string, name: string, patch: object): Promise<K8sDaemonSet> {
  const { data } = await kubeProxyAxios.patch<K8sDaemonSet>(
    `${dsBase(cluster, namespace)}/${encodeURIComponent(name)}`,
    patch,
    { headers: { 'Content-Type': 'application/merge-patch+json' }, skipErrorNotification: true } as any
  )
  return data
}

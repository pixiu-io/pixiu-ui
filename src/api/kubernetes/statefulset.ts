import { kubeProxyAxios } from '@/api/kubeProxy'
import { fetchKubeListPage } from './list'

export interface K8sStatefulSetContainer {
  name?: string
  image?: string
  resources?: {
    requests?: { cpu?: string; memory?: string }
    limits?: { cpu?: string; memory?: string }
  }
}

export interface K8sStatefulSet {
  metadata?: {
    name?: string
    namespace?: string
    uid?: string
    creationTimestamp?: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  spec?: {
    replicas?: number
    selector?: { matchLabels?: Record<string, string> }
    template?: { spec?: { containers?: K8sStatefulSetContainer[] } }
  }
  status?: {
    replicas?: number
    readyReplicas?: number
    availableReplicas?: number
    updatedReplicas?: number
  }
}

function stsBase(cluster: string, namespace: string) {
  return `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/statefulsets`
}

export async function fetchK8sStatefulSetList(
  cluster: string,
  params: { page: number; limit: number; namespace?: string }
): Promise<{ items: K8sStatefulSet[]; total: number }> {
  const base = params.namespace
    ? `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/apps/v1/namespaces/${encodeURIComponent(params.namespace)}/statefulsets`
    : `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/apps/v1/statefulsets`
  return fetchKubeListPage<K8sStatefulSet>({
    path: base,
    page: params.page,
    limit: params.limit
  })
}

export async function fetchK8sStatefulSet(cluster: string, namespace: string, name: string): Promise<K8sStatefulSet> {
  const { data } = await kubeProxyAxios.get<K8sStatefulSet>(
    `${stsBase(cluster, namespace)}/${encodeURIComponent(name)}`
  )
  return data
}

export async function deleteK8sStatefulSet(cluster: string, namespace: string, name: string): Promise<void> {
  await kubeProxyAxios.delete(`${stsBase(cluster, namespace)}/${encodeURIComponent(name)}`, { skipErrorNotification: true } as any)
}

export async function patchK8sStatefulSet(cluster: string, namespace: string, name: string, patch: object): Promise<K8sStatefulSet> {
  const { data } = await kubeProxyAxios.patch<K8sStatefulSet>(
    `${stsBase(cluster, namespace)}/${encodeURIComponent(name)}`,
    patch,
    { headers: { 'Content-Type': 'application/merge-patch+json' }, skipErrorNotification: true } as any
  )
  return data
}

export async function createK8sStatefulSet(cluster: string, namespace: string, body: object): Promise<K8sStatefulSet> {
  const { data } = await kubeProxyAxios.post<K8sStatefulSet>(stsBase(cluster, namespace), body, { skipErrorNotification: true } as any)
  return data
}

import { kubeProxyAxios } from '@/api/kubeProxy'
import { fetchKubeListPage } from './list'

export interface K8sDeploymentContainer {
  name?: string
  image?: string
  resources?: {
    requests?: { cpu?: string; memory?: string }
    limits?: { cpu?: string; memory?: string }
  }
}

export interface K8sDeployment {
  metadata?: {
    name?: string
    namespace?: string
    uid?: string
    creationTimestamp?: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
    resourceVersion?: string
  }
  spec?: {
    replicas?: number
    selector?: { matchLabels?: Record<string, string> }
    strategy?: {
      type?: string
      rollingUpdate?: { maxUnavailable?: string | number; maxSurge?: string | number }
    }
    minReadySeconds?: number
    template?: {
      metadata?: { labels?: Record<string, string>; annotations?: Record<string, string> }
      spec?: { containers?: K8sDeploymentContainer[] }
    }
  }
  status?: {
    replicas?: number
    readyReplicas?: number
    availableReplicas?: number
    updatedReplicas?: number
  }
}

function deployBase(cluster: string, namespace: string) {
  return `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments`
}

export async function fetchK8sDeploymentList(
  cluster: string,
  params: { page: number; limit: number; namespace?: string }
): Promise<{ items: K8sDeployment[]; total: number }> {
  const base = params.namespace
    ? `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/apps/v1/namespaces/${encodeURIComponent(params.namespace)}/deployments`
    : `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/apps/v1/deployments`
  return fetchKubeListPage<K8sDeployment>({
    path: base,
    page: params.page,
    limit: params.limit
  })
}

export async function fetchK8sDeployment(
  cluster: string,
  namespace: string,
  name: string
): Promise<K8sDeployment> {
  const { data } = await kubeProxyAxios.get<K8sDeployment>(
    `${deployBase(cluster, namespace)}/${encodeURIComponent(name)}`
  )
  return data
}

export async function createK8sDeployment(
  cluster: string,
  namespace: string,
  body: object
): Promise<K8sDeployment> {
  const { data } = await kubeProxyAxios.post<K8sDeployment>(
    deployBase(cluster, namespace),
    body,
    { skipErrorNotification: true } as any
  )
  return data
}

export async function deleteK8sDeployment(
  cluster: string,
  namespace: string,
  name: string
): Promise<void> {
  await kubeProxyAxios.delete(
    `${deployBase(cluster, namespace)}/${encodeURIComponent(name)}`,
    { skipErrorNotification: true } as any
  )
}

export async function patchK8sDeployment(
  cluster: string,
  namespace: string,
  name: string,
  patch: object
): Promise<K8sDeployment> {
  const { data } = await kubeProxyAxios.patch<K8sDeployment>(
    `${deployBase(cluster, namespace)}/${encodeURIComponent(name)}`,
    patch,
    { headers: { 'Content-Type': 'application/merge-patch+json' }, skipErrorNotification: true } as any
  )
  return data
}

import { kubeProxyAxios } from '@/api/kubeProxy'
import { fetchKubeListPage } from './list'

export interface K8sServicePort {
  name?: string
  protocol?: string
  port?: number
  targetPort?: number | string
  nodePort?: number
}

export interface K8sService {
  metadata?: {
    name?: string
    namespace?: string
    uid?: string
    creationTimestamp?: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  spec?: {
    type?: string
    clusterIP?: string
    clusterIPs?: string[]
    ports?: K8sServicePort[]
    selector?: Record<string, string>
    externalIPs?: string[]
    sessionAffinity?: string
  }
  status?: {
    loadBalancer?: {
      ingress?: Array<{ ip?: string; hostname?: string }>
    }
  }
}

function svcBase(cluster: string, namespace: string) {
  return `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(namespace)}/services`
}

export async function fetchK8sServiceList(
  cluster: string,
  params: { page: number; limit: number; namespace?: string; skipErrorNotification?: boolean }
): Promise<{ items: K8sService[]; total: number }> {
  const base = params.namespace
    ? `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(params.namespace)}/services`
    : `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/services`
  return fetchKubeListPage<K8sService>({
    path: base,
    page: params.page,
    limit: params.limit,
    skipErrorNotification: params.skipErrorNotification
  })
}

export async function fetchK8sService(cluster: string, namespace: string, name: string, skipErrorNotification = false): Promise<K8sService> {
  const { data } = await kubeProxyAxios.get<K8sService>(`${svcBase(cluster, namespace)}/${encodeURIComponent(name)}`, {
    skipErrorNotification
  })
  return data
}

export async function deleteK8sService(cluster: string, namespace: string, name: string): Promise<void> {
  await kubeProxyAxios.delete(`${svcBase(cluster, namespace)}/${encodeURIComponent(name)}`)
}

export async function createK8sService(cluster: string, namespace: string, body: object): Promise<K8sService> {
  const { data } = await kubeProxyAxios.post<K8sService>(svcBase(cluster, namespace), body)
  return data
}

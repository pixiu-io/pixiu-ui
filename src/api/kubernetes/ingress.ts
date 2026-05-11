import { kubeProxyAxios } from '@/api/kubeProxy'
import { fetchKubeListPage } from './list'

export interface K8sIngressRule {
  host?: string
  http?: {
    paths?: Array<{
      path?: string
      pathType?: string
      backend?: {
        service?: { name?: string; port?: { number?: number; name?: string } }
      }
    }>
  }
}

export interface K8sIngress {
  metadata?: {
    name?: string
    namespace?: string
    uid?: string
    creationTimestamp?: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  spec?: {
    ingressClassName?: string
    rules?: K8sIngressRule[]
    tls?: Array<{ hosts?: string[]; secretName?: string }>
  }
  status?: {
    loadBalancer?: {
      ingress?: Array<{ ip?: string; hostname?: string }>
    }
  }
}

function ingressBase(cluster: string, namespace: string) {
  return `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/networking.k8s.io/v1/namespaces/${encodeURIComponent(namespace)}/ingresses`
}

export async function fetchK8sIngressList(
  cluster: string,
  params: { page: number; limit: number; namespace?: string; name?: string }
): Promise<{ items: K8sIngress[]; total: number }> {
  const base = params.namespace
    ? `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/networking.k8s.io/v1/namespaces/${encodeURIComponent(params.namespace)}/ingresses`
    : `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/networking.k8s.io/v1/ingresses`
  return fetchKubeListPage<K8sIngress>({
    path: base,
    page: params.page,
    limit: params.limit,
    fieldSelector: params.name ? `metadata.name=${params.name}` : undefined
  })
}

export async function fetchK8sIngress(cluster: string, namespace: string, name: string): Promise<K8sIngress> {
  const { data } = await kubeProxyAxios.get<K8sIngress>(`${ingressBase(cluster, namespace)}/${encodeURIComponent(name)}`)
  return data
}

export async function deleteK8sIngress(cluster: string, namespace: string, name: string): Promise<void> {
  await kubeProxyAxios.delete(`${ingressBase(cluster, namespace)}/${encodeURIComponent(name)}`)
}

export async function createK8sIngress(cluster: string, namespace: string, body: K8sIngress): Promise<K8sIngress> {
  const { data } = await kubeProxyAxios.post<K8sIngress>(ingressBase(cluster, namespace), body)
  return data
}

export async function patchK8sIngress(cluster: string, namespace: string, name: string, patch: object): Promise<K8sIngress> {
  const { data } = await kubeProxyAxios.patch<K8sIngress>(
    `${ingressBase(cluster, namespace)}/${encodeURIComponent(name)}`,
    patch,
    { headers: { 'Content-Type': 'application/merge-patch+json' } }
  )
  return data
}

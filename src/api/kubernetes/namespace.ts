import { kubeProxyAxios } from '@/api/kubeProxy'
import { fetchKubeListPage } from './list'

export interface K8sNamespace {
  metadata: {
    name: string
    creationTimestamp?: string
    annotations?: Record<string, string>
    resourceVersion?: string
  }
  status?: {
    phase?: string
  }
}

export interface K8sResourceQuota {
  metadata?: {
    name?: string
    namespace?: string
  }
  spec?: {
    hard?: Record<string, string>
  }
}

export async function fetchK8sNamespaceList(
  cluster: string,
  params: { page: number; limit: number }
): Promise<{ items: K8sNamespace[]; total: number }> {
  return fetchKubeListPage<K8sNamespace>({
    path: `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces`,
    page: params.page,
    limit: params.limit
  })
}

export async function fetchK8sNamespace(cluster: string, name: string): Promise<K8sNamespace> {
  const { data } = await kubeProxyAxios.get<K8sNamespace>(
    `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(name)}`
  )
  return data
}

export async function createK8sNamespace(cluster: string, name: string): Promise<void> {
  await kubeProxyAxios.post(
    `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces`,
    {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: { name }
    }
  )
}

export async function deleteK8sNamespace(cluster: string, name: string): Promise<void> {
  await kubeProxyAxios.delete(
    `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(name)}`
  )
}

export async function fetchK8sNamespaceQuotaList(
  cluster: string,
  namespace: string
): Promise<{ items: K8sResourceQuota[] }> {
  const { data } = await kubeProxyAxios.get<{ items?: K8sResourceQuota[] }>(
    `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(namespace)}/resourcequotas`,
    { params: { limit: 1 } }
  )
  return { items: data.items ?? [] }
}

export async function createK8sNamespaceQuota(
  cluster: string,
  namespace: string,
  body: unknown
): Promise<void> {
  await kubeProxyAxios.post(
    `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(namespace)}/resourcequotas`,
    body
  )
}

export async function deleteK8sNamespaceQuota(
  cluster: string,
  namespace: string,
  name: string
): Promise<void> {
  await kubeProxyAxios.delete(
    `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(namespace)}/resourcequotas/${encodeURIComponent(name)}`
  )
}

export async function patchK8sNamespaceQuota(
  cluster: string,
  namespace: string,
  name: string,
  body: unknown
): Promise<void> {
  await kubeProxyAxios.patch(
    `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(namespace)}/resourcequotas/${encodeURIComponent(name)}`,
    body,
    {
      headers: { 'Content-Type': 'application/merge-patch+json' }
    }
  )
}

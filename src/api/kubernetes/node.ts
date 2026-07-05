import { kubeProxyAxios } from '@/api/kubeProxy'
import { fetchKubeListPage } from './list'

/** 与 dashboard nodeService 对齐的最小 Node 结构 */
export interface K8sNode {
  metadata: {
    name: string
    uid?: string
    creationTimestamp?: string
    /** node-role.kubernetes.io/*、kubernetes.io/role 等 */
    labels?: Record<string, string>
    annotations?: Record<string, string>
    resourceVersion?: string
  }
  spec?: { unschedulable?: boolean; podCIDR?: string; podCIDRs?: string[] }
  status?: {
    capacity?: { cpu?: string; memory?: string }
    conditions?: { type: string; status: string; reason?: string }[]
    addresses?: { type: string; address: string }[]
    nodeInfo?: {
      kubeletVersion?: string
      containerRuntimeVersion?: string
      osImage?: string
      operatingSystem?: string
      kernelVersion?: string
    }
    allocatable?: { cpu?: string; memory?: string }
  }
}

export async function fetchK8sNodeList(
  cluster: string,
  params: { page: number; limit: number }
): Promise<{ items: K8sNode[]; total: number }> {
  return fetchKubeListPage<K8sNode>({
    path: `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/nodes`,
    page: params.page,
    limit: params.limit
  })
}

export async function fetchK8sNode(cluster: string, name: string): Promise<K8sNode> {
  const { data } = await kubeProxyAxios.get<K8sNode>(
    `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/nodes/${encodeURIComponent(name)}`,
    { skipErrorNotification: true } as any
  )
  return data
}

/** strategic-merge-patch+json，与 dashboard patchNode 一致 */
export async function patchK8sNode(cluster: string, name: string, body: unknown): Promise<void> {
  await kubeProxyAxios.patch(
    `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/nodes/${encodeURIComponent(name)}`,
    body,
    {
      headers: { 'Content-Type': 'application/strategic-merge-patch+json' },
      skipErrorNotification: true
    } as any
  )
}

/** dashboard drainNode 实现为 GET node，此处保持一致 */
export async function drainK8sNodeFetch(cluster: string, name: string): Promise<K8sNode> {
  return fetchK8sNode(cluster, name)
}

export async function deleteK8sNode(cluster: string, name: string): Promise<void> {
  await kubeProxyAxios.delete(
    `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/nodes/${encodeURIComponent(name)}`,
    { skipErrorNotification: true } as any
  )
}

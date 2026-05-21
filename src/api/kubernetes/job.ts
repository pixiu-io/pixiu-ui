import { pixiuAxios } from '@/api/container'
import { kubeProxyAxios } from '@/api/kubeProxy'
import { fetchKubeListPage } from './list'

export interface K8sJob {
  metadata?: {
    name?: string
    namespace?: string
    uid?: string
    resourceVersion?: string
    creationTimestamp?: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  spec?: {
    completions?: number
    parallelism?: number
    suspend?: boolean
    template?: { spec?: { containers?: Array<{ name?: string; image?: string; resources?: { requests?: { cpu?: string; memory?: string }; limits?: { cpu?: string; memory?: string } } }> } }
  }
  status?: {
    active?: number
    succeeded?: number
    failed?: number
    completionTime?: string
    startTime?: string
    conditions?: Array<{ type: string; status: string }>
  }
}

function jobBase(cluster: string, namespace: string) {
  return `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/batch/v1/namespaces/${encodeURIComponent(namespace)}/jobs`
}

export async function fetchK8sJobList(
  cluster: string,
  params: { page: number; limit: number; namespace?: string; name?: string }
): Promise<{ items: K8sJob[]; total: number }> {
  const base = params.namespace
    ? `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/batch/v1/namespaces/${encodeURIComponent(params.namespace)}/jobs`
    : `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/batch/v1/jobs`
  return fetchKubeListPage<K8sJob>({
    path: base,
    page: params.page,
    limit: params.limit,
    fieldSelector: params.name ? `metadata.name=${params.name}` : undefined
  })
}

export async function fetchK8sJob(cluster: string, namespace: string, name: string): Promise<K8sJob> {
  const { data } = await kubeProxyAxios.get<K8sJob>(
    `${jobBase(cluster, namespace)}/${encodeURIComponent(name)}`
  )
  return data
}

export async function deleteK8sJob(cluster: string, namespace: string, name: string): Promise<void> {
  await kubeProxyAxios.delete(`${jobBase(cluster, namespace)}/${encodeURIComponent(name)}`)
}

export async function createK8sJob(cluster: string, namespace: string, body: object): Promise<K8sJob> {
  const { data } = await kubeProxyAxios.post<K8sJob>(jobBase(cluster, namespace), body)
  return data
}

/** 重新执行 Job（Pixiu kubeproxy：action=rerun） */
export async function rerunK8sJob(
  cluster: string,
  namespace: string,
  name: string,
  resourceVersion: string
): Promise<void> {
  const res = await pixiuAxios.post(
    `/pixiu/kubeproxy/clusters/${encodeURIComponent(cluster)}/namespaces/${encodeURIComponent(namespace)}/jobs/${encodeURIComponent(name)}`,
    undefined,
    { params: { action: 'rerun', resourceVersion } }
  )
  const { code, message } = res.data as { code: number; message?: string }
  if (code !== 200) throw new Error(message || '操作失败')
}

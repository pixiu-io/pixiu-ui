import { kubeProxyAxios } from '@/api/kubeProxy'
import { fetchKubeListPage } from './list'

export interface K8sCronJob {
  metadata?: {
    name?: string
    namespace?: string
    uid?: string
    creationTimestamp?: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  spec?: {
    schedule?: string
    suspend?: boolean
    jobTemplate?: { spec?: { template?: { spec?: { containers?: Array<{ name?: string; image?: string; resources?: { requests?: { cpu?: string; memory?: string }; limits?: { cpu?: string; memory?: string } } }> } } } }
    successfulJobsHistoryLimit?: number
    failedJobsHistoryLimit?: number
  }
  status?: {
    lastScheduleTime?: string
    lastSuccessfulTime?: string
    active?: Array<{ name?: string; namespace?: string }>
  }
}

function cjBase(cluster: string, namespace: string) {
  return `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/batch/v1/namespaces/${encodeURIComponent(namespace)}/cronjobs`
}

export async function fetchK8sCronJobList(
  cluster: string,
  params: { page: number; limit: number; namespace?: string; name?: string }
): Promise<{ items: K8sCronJob[]; total: number }> {
  const base = params.namespace
    ? `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/batch/v1/namespaces/${encodeURIComponent(params.namespace)}/cronjobs`
    : `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/batch/v1/cronjobs`
  return fetchKubeListPage<K8sCronJob>({
    path: base,
    page: params.page,
    limit: params.limit,
    fieldSelector: params.name ? `metadata.name=${params.name}` : undefined
  })
}

export async function fetchK8sCronJob(cluster: string, namespace: string, name: string): Promise<K8sCronJob> {
  const { data } = await kubeProxyAxios.get<K8sCronJob>(
    `${cjBase(cluster, namespace)}/${encodeURIComponent(name)}`
  )
  return data
}

export async function deleteK8sCronJob(cluster: string, namespace: string, name: string): Promise<void> {
  await kubeProxyAxios.delete(`${cjBase(cluster, namespace)}/${encodeURIComponent(name)}`)
}

export async function patchK8sCronJob(cluster: string, namespace: string, name: string, patch: object): Promise<K8sCronJob> {
  const { data } = await kubeProxyAxios.patch<K8sCronJob>(
    `${cjBase(cluster, namespace)}/${encodeURIComponent(name)}`,
    patch,
    { headers: { 'Content-Type': 'application/merge-patch+json' } }
  )
  return data
}

export async function createK8sCronJob(cluster: string, namespace: string, body: object): Promise<K8sCronJob> {
  const { data } = await kubeProxyAxios.post<K8sCronJob>(cjBase(cluster, namespace), body)
  return data
}

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

function cjBase(cluster: string, namespace: string, apiVersion: string) {
  return `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/${apiVersion}/namespaces/${encodeURIComponent(namespace)}/cronjobs`
}

function resolveApiVersion(v?: string): string {
  const apiVersion = v || ''
  if (!apiVersion) throw new Error('集群版本未知，无法操作 CronJob')
  return apiVersion
}

export async function fetchK8sCronJobList(
  cluster: string,
  params: { page: number; limit: number; namespace?: string; name?: string; cronJobApiVersion?: string }
): Promise<{ items: K8sCronJob[]; total: number }> {
  const apiVersion = params.cronJobApiVersion || ''
  // 版本未知时跳过请求，避免 batch/v1 在旧集群 404
  if (!apiVersion) return { items: [], total: 0 }
  const base = params.namespace
    ? `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/${apiVersion}/namespaces/${encodeURIComponent(params.namespace)}/cronjobs`
    : `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/${apiVersion}/cronjobs`
  return fetchKubeListPage<K8sCronJob>({
    path: base,
    page: params.page,
    limit: params.limit,
    fieldSelector: params.name ? `metadata.name=${params.name}` : undefined
  })
}

export async function fetchK8sCronJob(
  cluster: string,
  namespace: string,
  name: string,
  cronJobApiVersion?: string
): Promise<K8sCronJob> {
  const apiVersion = resolveApiVersion(cronJobApiVersion)
  const { data } = await kubeProxyAxios.get<K8sCronJob>(
    `${cjBase(cluster, namespace, apiVersion)}/${encodeURIComponent(name)}`
  )
  return data
}

export async function deleteK8sCronJob(
  cluster: string,
  namespace: string,
  name: string,
  cronJobApiVersion?: string
): Promise<void> {
  const apiVersion = resolveApiVersion(cronJobApiVersion)
  await kubeProxyAxios.delete(`${cjBase(cluster, namespace, apiVersion)}/${encodeURIComponent(name)}`)
}

export async function patchK8sCronJob(
  cluster: string,
  namespace: string,
  name: string,
  patch: object,
  cronJobApiVersion?: string
): Promise<K8sCronJob> {
  const apiVersion = resolveApiVersion(cronJobApiVersion)
  const { data } = await kubeProxyAxios.patch<K8sCronJob>(
    `${cjBase(cluster, namespace, apiVersion)}/${encodeURIComponent(name)}`,
    patch,
    { headers: { 'Content-Type': 'application/merge-patch+json' } }
  )
  return data
}

export async function createK8sCronJob(
  cluster: string,
  namespace: string,
  body: object,
  cronJobApiVersion?: string
): Promise<K8sCronJob> {
  const apiVersion = resolveApiVersion(cronJobApiVersion)
  const { data } = await kubeProxyAxios.post<K8sCronJob>(cjBase(cluster, namespace, apiVersion), body)
  return data
}

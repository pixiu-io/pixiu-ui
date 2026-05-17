import { pixiuAxios } from '@/api/container'
import { kubeProxyAxios } from '@/api/kubeProxy'
import { fetchKubeListPage } from './list'

interface K8sEventList {
  items?: unknown[]
}

/** 支持后端 aggregateEvents 的 K8s Kind → API path kind */
const AGGREGATED_EVENT_KIND_MAP: Record<string, string> = {
  Deployment: 'deployment',
  StatefulSet: 'statefulset',
  DaemonSet: 'daemonset',
  Job: 'job'
}

/** 是否可通过 aggregateEvents 聚合子资源事件 */
export function getAggregatedEventKind(k8sKind: string): string | undefined {
  return AGGREGATED_EVENT_KIND_MAP[k8sKind]
}

/** 聚合工作负载及其子资源（如 Deployment → RS → Pod）的 events */
export async function fetchAggregatedEventList(
  cluster: string,
  namespace: string,
  name: string,
  kind: string
): Promise<{ items: unknown[]; total: number }> {
  const url =
    `/pixiu/kubeproxy/clusters/${encodeURIComponent(cluster)}` +
    `/namespaces/${encodeURIComponent(namespace)}` +
    `/name/${encodeURIComponent(name)}` +
    `/kind/${encodeURIComponent(kind.toLowerCase())}/events`
  const res = await pixiuAxios.get(url)
  const { code, result, message } = res.data as {
    code: number
    result?: K8sEventList
    message?: string
  }
  if (code !== 200) throw new Error(message || '请求失败')
  const items = result?.items ?? []
  return { items, total: items.length }
}

/** 通过 `/pixiu/proxy/...` 直连 Kubernetes events API */
export async function fetchKubeRawEventList(
  cluster: string,
  params: {
    uid?: string
    namespace?: string
    name?: string
    kind?: string
    namespaced?: boolean
    page?: number
    limit?: number
  }
): Promise<{ items: unknown[]; total: number }> {
  const namespace = params.namespace?.trim()
  const path =
    params.namespaced && namespace
      ? `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(namespace)}/events`
      : `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/events`

  const selectorParts: string[] = []
  if (params.uid) selectorParts.push(`involvedObject.uid=${params.uid}`)
  if (params.name) selectorParts.push(`involvedObject.name=${params.name}`)
  if (namespace) selectorParts.push(`involvedObject.namespace=${namespace}`)
  if (params.kind) selectorParts.push(`involvedObject.kind=${params.kind}`)

  return fetchKubeListPage<unknown>({
    path,
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    fieldSelector: selectorParts.length > 0 ? selectorParts.join(',') : undefined
  })
}

export async function deleteK8sEvent(cluster: string, namespace: string, name: string): Promise<void> {
  await kubeProxyAxios.delete(
    `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(namespace)}/events/${encodeURIComponent(name)}`
  )
}

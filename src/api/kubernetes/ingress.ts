import { kubeProxyAxios } from '@/api/kubeProxy'
import {
  discoverFromCandidates,
  discoverPreferredApi,
  invalidateApiDiscoveryCache
} from './apiDiscovery'
import { fetchKubeListPage } from './list'
import {
  INGRESS_API_CANDIDATES,
  INGRESS_API_V1,
  denormalizeIngressFromV1,
  denormalizeIngressPatchFromV1,
  getIngressApiVersionFallback,
  normalizeIngressToV1
} from '@/utils/kubernetes/ingress'

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
  apiVersion?: string
  kind?: string
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
    defaultBackend?: {
      service?: { name?: string; port?: { number?: number; name?: string } }
    }
  }
  status?: {
    loadBalancer?: {
      ingress?: Array<{ ip?: string; hostname?: string }>
    }
  }
}

export type ResolveIngressApiOptions = {
  /** Discovery 失败时的兜底依据 */
  k8sVersion?: string
  /** 强制刷新 Discovery 缓存 */
  forceRefresh?: boolean
}

/**
 * 解析集群 Ingress 可用的 GroupVersion。
 * 优先 Discovery（networking.k8s.io → extensions），失败再按集群版本兜底。
 */
export async function resolveIngressGroupVersion(
  cluster: string,
  options?: ResolveIngressApiOptions
): Promise<string> {
  if (options?.forceRefresh) {
    invalidateApiDiscoveryCache(cluster, 'networking.k8s.io', 'ingresses')
    invalidateApiDiscoveryCache(cluster, 'ingress', 'ingresses')
  }

  // 1) networking.k8s.io preferred / versions
  const networking = await discoverPreferredApi(cluster, 'networking.k8s.io', 'ingresses')
  if (networking) return networking

  // 2) 显式探测候选（含 extensions/v1beta1）
  const fromCandidates = await discoverFromCandidates(
    cluster,
    'ingresses',
    [...INGRESS_API_CANDIDATES],
    'ingress'
  )
  if (fromCandidates) return fromCandidates

  // 3) 版本表兜底
  return getIngressApiVersionFallback(options?.k8sVersion)
}

function ingressCollectionPath(cluster: string, groupVersion: string, namespace?: string) {
  const base = `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/${groupVersion}`
  if (namespace) {
    return `${base}/namespaces/${encodeURIComponent(namespace)}/ingresses`
  }
  return `${base}/ingresses`
}

function ingressItemPath(cluster: string, groupVersion: string, namespace: string, name: string) {
  return `${ingressCollectionPath(cluster, groupVersion, namespace)}/${encodeURIComponent(name)}`
}

function normalizeListItems(items: unknown[]): K8sIngress[] {
  return (items ?? []).map((it) => normalizeIngressToV1(it as Record<string, any>) as K8sIngress)
}

export async function fetchK8sIngressList(
  cluster: string,
  params: { page: number; limit: number; namespace?: string; k8sVersion?: string }
): Promise<{ items: K8sIngress[]; total: number }> {
  const gv = await resolveIngressGroupVersion(cluster, { k8sVersion: params.k8sVersion })
  const base = ingressCollectionPath(cluster, gv, params.namespace)
  const page = await fetchKubeListPage<K8sIngress>({
    path: base,
    page: params.page,
    limit: params.limit
  })
  return { items: normalizeListItems(page.items), total: page.total }
}

export async function fetchK8sIngress(
  cluster: string,
  namespace: string,
  name: string,
  options?: ResolveIngressApiOptions
): Promise<K8sIngress> {
  const gv = await resolveIngressGroupVersion(cluster, options)
  const { data } = await kubeProxyAxios.get<K8sIngress>(
    ingressItemPath(cluster, gv, namespace, name)
  )
  return normalizeIngressToV1(data as Record<string, any>) as K8sIngress
}

export async function deleteK8sIngress(
  cluster: string,
  namespace: string,
  name: string,
  options?: ResolveIngressApiOptions
): Promise<void> {
  const gv = await resolveIngressGroupVersion(cluster, options)
  await kubeProxyAxios.delete(ingressItemPath(cluster, gv, namespace, name))
}

export async function createK8sIngress(
  cluster: string,
  namespace: string,
  body: K8sIngress,
  options?: ResolveIngressApiOptions
): Promise<K8sIngress> {
  const gv = await resolveIngressGroupVersion(cluster, options)
  const payload = denormalizeIngressFromV1(
    { ...(body as Record<string, any>), apiVersion: INGRESS_API_V1, kind: 'Ingress' },
    gv
  )
  // 确保 namespace 与路径一致
  payload.metadata = {
    ...(payload.metadata || {}),
    namespace: payload.metadata?.namespace || namespace
  }
  const { data } = await kubeProxyAxios.post<K8sIngress>(
    ingressCollectionPath(cluster, gv, namespace),
    payload
  )
  return normalizeIngressToV1(data as Record<string, any>) as K8sIngress
}

export async function patchK8sIngress(
  cluster: string,
  namespace: string,
  name: string,
  patch: object,
  options?: ResolveIngressApiOptions
): Promise<K8sIngress> {
  const gv = await resolveIngressGroupVersion(cluster, options)
  const payload = denormalizeIngressPatchFromV1(patch as Record<string, any>, gv)
  const { data } = await kubeProxyAxios.patch<K8sIngress>(
    ingressItemPath(cluster, gv, namespace, name),
    payload,
    { headers: { 'Content-Type': 'application/merge-patch+json' } }
  )
  return normalizeIngressToV1(data as Record<string, any>) as K8sIngress
}

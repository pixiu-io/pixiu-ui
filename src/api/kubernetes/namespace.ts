import { kubeProxyAxios } from '@/api/kubeProxy'
import { fetchGetPermission, type PermissionListItem } from '@/api/system-manage'
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
    `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(name)}`,
    { skipErrorNotification: true } as any
  )
  return data
}

export interface ResolvedClusterNamespaces {
  items: K8sNamespace[]
  names: string[]
  permissionDetail: PermissionListItem | null
  /** 是否按 target_namespaces 限定范围（自定义授权或指定命名空间的管理员/只读） */
  scoped: boolean
}

/**
 * 按集群授权信息解析命名空间列表：
 * - 无 permissionId：全量 list
 * - p_type=1 或存在 target_namespaces：按名称逐个 GET
 * - 管理员/只读且 target_namespaces 为空：全量 list
 */
export async function resolveClusterNamespaces(
  cluster: string,
  permissionId = 0
): Promise<ResolvedClusterNamespaces> {
  const empty: ResolvedClusterNamespaces = {
    items: [],
    names: [],
    permissionDetail: null,
    scoped: false
  }
  if (!cluster) return empty

  const pid = Number(permissionId) || 0
  if (pid > 0) {
    const detail = await fetchGetPermission(pid)
    const targetNames = [...new Set((detail.targetNamespaces ?? []).map((n) => n.trim()).filter(Boolean))]
    const pType = Number(detail.pType)

    if (pType === 1 || targetNames.length > 0) {
      if (!targetNames.length) {
        return { items: [], names: [], permissionDetail: detail, scoped: true }
      }
      const items = await fetchK8sNamespacesByNames(cluster, targetNames)
      const names = items.map((n) => n.metadata.name).filter(Boolean)
      return { items, names, permissionDetail: detail, scoped: true }
    }

    const { items } = await fetchK8sNamespaceList(cluster, { page: 1, limit: 500 })
    const names = items.map((n) => n.metadata.name).sort()
    return { items, names, permissionDetail: detail, scoped: false }
  }

  const { items } = await fetchK8sNamespaceList(cluster, { page: 1, limit: 500 })
  const names = items.map((n) => n.metadata.name).sort()
  return { items, names, permissionDetail: null, scoped: false }
}

/** 按名称逐个 GET Namespace，仅返回有权限且存在的命名空间（用于自定义授权 target_namespaces） */
export async function fetchK8sNamespacesByNames(
  cluster: string,
  names: string[]
): Promise<K8sNamespace[]> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))]
  if (!unique.length) return []

  const results = await Promise.all(
    unique.map(async (name) => {
      try {
        return await fetchK8sNamespace(cluster, name)
      } catch {
        return null
      }
    })
  )

  return results
    .filter((item): item is K8sNamespace => item != null && Boolean(item.metadata?.name))
    .sort((a, b) => a.metadata.name.localeCompare(b.metadata.name))
}

export async function createK8sNamespace(cluster: string, name: string): Promise<void> {
  await kubeProxyAxios.post(
    `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces`,
    {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: { name }
    },
    { skipErrorNotification: true } as any
  )
}

export async function deleteK8sNamespace(cluster: string, name: string): Promise<void> {
  await kubeProxyAxios.delete(
    `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(name)}`,
    { skipErrorNotification: true } as any
  )
}

export async function fetchK8sNamespaceQuotaList(
  cluster: string,
  namespace: string
): Promise<{ items: K8sResourceQuota[] }> {
  const { data } = await kubeProxyAxios.get<{ items?: K8sResourceQuota[] }>(
    `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(namespace)}/resourcequotas`,
    { params: { limit: 1 }, skipErrorNotification: true } as any
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
    body,
    { skipErrorNotification: true } as any
  )
}

export async function deleteK8sNamespaceQuota(
  cluster: string,
  namespace: string,
  name: string
): Promise<void> {
  await kubeProxyAxios.delete(
    `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(namespace)}/resourcequotas/${encodeURIComponent(name)}`,
    { skipErrorNotification: true } as any
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
      headers: { 'Content-Type': 'application/merge-patch+json' },
      skipErrorNotification: true
    } as any
  )
}

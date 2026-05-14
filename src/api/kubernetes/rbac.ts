import { kubeProxyAxios } from '@/api/kubeProxy'

/** RBAC / ServiceAccount 列表展示用（metadata 为主） */
export interface K8sRbacObject {
  metadata?: {
    name?: string
    namespace?: string
    uid?: string
    creationTimestamp?: string
    labels?: Record<string, string>
  }
}

type ListResp<T> = { items?: T[]; metadata?: { continue?: string } }

const NS_BATCH = 8

async function listAllPaged<T>(path: string): Promise<T[]> {
  const all: T[] = []
  let continueToken: string | undefined
  do {
    const params: Record<string, string> = { limit: '500' }
    if (continueToken) params.continue = continueToken
    const { data } = await kubeProxyAxios.get<ListResp<T>>(path, { params })
    all.push(...(data.items ?? []))
    continueToken = data.metadata?.continue || undefined
  } while (continueToken)
  return all
}

async function listNamespaceNames(cluster: string): Promise<string[]> {
  const base = `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces`
  const items = await listAllPaged<{ metadata?: { name?: string } }>(base)
  return items.map((i) => i.metadata?.name).filter(Boolean) as string[]
}

async function listAcrossNamespaces(
  cluster: string,
  segment: 'roles' | 'rolebindings' | 'serviceaccounts'
): Promise<K8sRbacObject[]> {
  const c = encodeURIComponent(cluster)
  const nss = await listNamespaceNames(cluster)
  const out: K8sRbacObject[] = []
  for (let i = 0; i < nss.length; i += NS_BATCH) {
    const batch = nss.slice(i, i + NS_BATCH)
    const paths = batch.map((ns) => {
      if (segment === 'serviceaccounts') {
        return `/pixiu/proxy/${c}/api/v1/namespaces/${encodeURIComponent(ns)}/serviceaccounts`
      }
      return `/pixiu/proxy/${c}/apis/rbac.authorization.k8s.io/v1/namespaces/${encodeURIComponent(ns)}/${segment}`
    })
    const parts = await Promise.all(paths.map((p) => listAllPaged<K8sRbacObject>(p)))
    for (const arr of parts) out.push(...arr)
  }
  return out
}

function filterRbacItems<T extends K8sRbacObject>(items: T[], nameQuery?: string): T[] {
  const q = (nameQuery ?? '').trim()
  if (!q) return items
  if (q.includes('=')) {
    const eq = q.indexOf('=')
    const k = q.slice(0, eq).trim()
    const v = q.slice(eq + 1).trim()
    if (!k) return items
    return items.filter((i) => (i.metadata?.labels?.[k] ?? '') === v)
  }
  const low = q.toLowerCase()
  return items.filter((i) => (i.metadata?.name ?? '').toLowerCase().includes(low))
}

function pageSlice<T>(items: T[], page: number, limit: number): { items: T[]; total: number } {
  const p = Math.max(1, page)
  const l = Math.max(1, limit)
  const total = items.length
  const start = (p - 1) * l
  return { items: items.slice(start, start + l), total }
}

export async function fetchK8sClusterRoleList(
  cluster: string,
  params: { page: number; limit: number; name?: string }
): Promise<{ items: K8sRbacObject[]; total: number }> {
  const path = `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/rbac.authorization.k8s.io/v1/clusterroles`
  const all = await listAllPaged<K8sRbacObject>(path)
  const filtered = filterRbacItems(all, params.name)
  return pageSlice(filtered, params.page, params.limit)
}

export async function fetchK8sClusterRoleBindingList(
  cluster: string,
  params: { page: number; limit: number; name?: string }
): Promise<{ items: K8sRbacObject[]; total: number }> {
  const path = `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/rbac.authorization.k8s.io/v1/clusterrolebindings`
  const all = await listAllPaged<K8sRbacObject>(path)
  const filtered = filterRbacItems(all, params.name)
  return pageSlice(filtered, params.page, params.limit)
}

export async function fetchK8sRoleList(
  cluster: string,
  params: { page: number; limit: number; namespace?: string; name?: string }
): Promise<{ items: K8sRbacObject[]; total: number }> {
  const c = encodeURIComponent(cluster)
  let all: K8sRbacObject[]
  if (params.namespace) {
    const path = `/pixiu/proxy/${c}/apis/rbac.authorization.k8s.io/v1/namespaces/${encodeURIComponent(params.namespace)}/roles`
    all = await listAllPaged(path)
  } else {
    all = await listAcrossNamespaces(cluster, 'roles')
  }
  const filtered = filterRbacItems(all, params.name)
  return pageSlice(filtered, params.page, params.limit)
}

export async function fetchK8sRoleBindingList(
  cluster: string,
  params: { page: number; limit: number; namespace?: string; name?: string }
): Promise<{ items: K8sRbacObject[]; total: number }> {
  const c = encodeURIComponent(cluster)
  let all: K8sRbacObject[]
  if (params.namespace) {
    const path = `/pixiu/proxy/${c}/apis/rbac.authorization.k8s.io/v1/namespaces/${encodeURIComponent(params.namespace)}/rolebindings`
    all = await listAllPaged(path)
  } else {
    all = await listAcrossNamespaces(cluster, 'rolebindings')
  }
  const filtered = filterRbacItems(all, params.name)
  return pageSlice(filtered, params.page, params.limit)
}

export async function fetchK8sServiceAccountList(
  cluster: string,
  params: { page: number; limit: number; namespace?: string; name?: string }
): Promise<{ items: K8sRbacObject[]; total: number }> {
  const c = encodeURIComponent(cluster)
  let all: K8sRbacObject[]
  if (params.namespace) {
    const path = `/pixiu/proxy/${c}/api/v1/namespaces/${encodeURIComponent(params.namespace)}/serviceaccounts`
    all = await listAllPaged(path)
  } else {
    all = await listAcrossNamespaces(cluster, 'serviceaccounts')
  }
  const filtered = filterRbacItems(all, params.name)
  return pageSlice(filtered, params.page, params.limit)
}

export async function fetchK8sClusterRole(cluster: string, name: string): Promise<unknown> {
  const { data } = await kubeProxyAxios.get(
    `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/rbac.authorization.k8s.io/v1/clusterroles/${encodeURIComponent(name)}`
  )
  return data
}

export async function deleteK8sClusterRole(cluster: string, name: string): Promise<void> {
  await kubeProxyAxios.delete(
    `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/rbac.authorization.k8s.io/v1/clusterroles/${encodeURIComponent(name)}`
  )
}

export async function fetchK8sClusterRoleBinding(cluster: string, name: string): Promise<unknown> {
  const { data } = await kubeProxyAxios.get(
    `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/rbac.authorization.k8s.io/v1/clusterrolebindings/${encodeURIComponent(name)}`
  )
  return data
}

export async function deleteK8sClusterRoleBinding(cluster: string, name: string): Promise<void> {
  await kubeProxyAxios.delete(
    `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/rbac.authorization.k8s.io/v1/clusterrolebindings/${encodeURIComponent(name)}`
  )
}

export async function fetchK8sRole(cluster: string, namespace: string, name: string): Promise<unknown> {
  const { data } = await kubeProxyAxios.get(
    `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/rbac.authorization.k8s.io/v1/namespaces/${encodeURIComponent(namespace)}/roles/${encodeURIComponent(name)}`
  )
  return data
}

export async function deleteK8sRole(cluster: string, namespace: string, name: string): Promise<void> {
  await kubeProxyAxios.delete(
    `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/rbac.authorization.k8s.io/v1/namespaces/${encodeURIComponent(namespace)}/roles/${encodeURIComponent(name)}`
  )
}

export async function fetchK8sRoleBinding(cluster: string, namespace: string, name: string): Promise<unknown> {
  const { data } = await kubeProxyAxios.get(
    `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/rbac.authorization.k8s.io/v1/namespaces/${encodeURIComponent(namespace)}/rolebindings/${encodeURIComponent(name)}`
  )
  return data
}

export async function deleteK8sRoleBinding(cluster: string, namespace: string, name: string): Promise<void> {
  await kubeProxyAxios.delete(
    `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/rbac.authorization.k8s.io/v1/namespaces/${encodeURIComponent(namespace)}/rolebindings/${encodeURIComponent(name)}`
  )
}

export async function fetchK8sServiceAccount(cluster: string, namespace: string, name: string): Promise<unknown> {
  const { data } = await kubeProxyAxios.get(
    `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(namespace)}/serviceaccounts/${encodeURIComponent(name)}`
  )
  return data
}

export async function deleteK8sServiceAccount(cluster: string, namespace: string, name: string): Promise<void> {
  await kubeProxyAxios.delete(
    `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(namespace)}/serviceaccounts/${encodeURIComponent(name)}`
  )
}

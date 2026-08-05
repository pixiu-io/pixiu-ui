/**
 * 从 kube proxy path 解析 cluster / namespace，供作用域过滤使用。
 * 例：/pixiu/proxy/demo/apis/apps/v1/namespaces/default/deployments
 */
export function parseKubeProxyPath(path: string): {
  cluster: string
  namespace: string
} {
  const parts = path.split('/').filter(Boolean)
  // pixiu / proxy / {cluster} / ...
  const proxyIdx = parts.indexOf('proxy')
  const cluster = proxyIdx >= 0 && parts[proxyIdx + 1] ? parts[proxyIdx + 1] : ''
  const nsIdx = parts.indexOf('namespaces')
  const namespace = nsIdx >= 0 && parts[nsIdx + 1] ? parts[nsIdx + 1] : ''
  return { cluster: decodeURIComponent(cluster), namespace: decodeURIComponent(namespace) }
}

type NamedKubeItem = {
  metadata?: { name?: string; namespace?: string }
}

/** 按当前用户 role API scopes 过滤 K8s list items；无 scopes / 超管不限制 */
export async function filterKubeItemsByScope<T extends NamedKubeItem>(
  path: string,
  items: T[]
): Promise<T[]> {
  if (!items.length) return items
  try {
    const { usePermissionStore } = await import('@/store/modules/permission')
    const store = usePermissionStore()
    if (store.isRoot || !store.scopes.length) return items

    const { cluster: pathCluster, namespace: pathNs } = parseKubeProxyPath(path)
    return items.filter((item) => {
      const cluster = pathCluster
      const namespace = item.metadata?.namespace || pathNs || ''
      const resourceName = item.metadata?.name || '*'
      return store.canAccessScope({ cluster, namespace, resourceName })
    })
  } catch {
    return items
  }
}

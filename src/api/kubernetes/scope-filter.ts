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

/**
 * 按角色 scope 过滤 K8s list items 的历史逻辑已移除。
 * k8s 集群内授权由后端 Permission 机制负责，scope 不再控制 k8s 资源，此处直接透传。
 */
export async function filterKubeItemsByScope<T>(
  _path: string,
  items: T[]
): Promise<T[]> {
  return items
}

/*
 * 内部数据源：经集群 Service 代理访问（/pixiu/proxy/...）
 * 外部数据源：经直连外部代理（/pixiu/external/...）
 */

export type ParsedInClusterEndpoint = {
  serviceName: string
  namespace: string
  port: number
  protocol: 'http' | 'https'
  basePath: string
}

function isIPAddress(hostname: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true
  if (hostname.includes(':') && !hostname.includes('.')) return true
  return false
}

function normalizeBasePath(pathname: string): string {
  const normalized = pathname.trim().replace(/\/+$/, '')
  if (!normalized || normalized === '/') return ''
  return normalized.startsWith('/') ? normalized : `/${normalized}`
}

/** 解析集群内数据源 URL，如 http://prometheus-server.pixiu-system */
export function parseInClusterDatasourceEndpoint(rawUrl: string): ParsedInClusterEndpoint | null {
  if (!rawUrl) return null
  try {
    const parsed = new URL(rawUrl)
    if (isIPAddress(parsed.hostname)) return null
    const protocol =
      parsed.protocol === 'https:' ? 'https' : parsed.protocol === 'http:' ? 'http' : null
    if (!protocol) return null
    const parts = parsed.hostname.split('.').filter(Boolean)
    if (!parts.length) return null
    const svcIndex = parts.indexOf('svc')
    const namespace =
      svcIndex >= 2 ? parts[1] : svcIndex === -1 && parts.length >= 2 ? parts[1] : ''
    if (!namespace) return null
    const port =
      parsed.port && Number.parseInt(parsed.port, 10) > 0
        ? Number.parseInt(parsed.port, 10)
        : protocol === 'https'
          ? 443
          : 80
    return {
      serviceName: parts[0] ?? '',
      namespace,
      port,
      protocol,
      basePath: normalizeBasePath(parsed.pathname)
    }
  } catch {
    return null
  }
}

/** 构造内部数据源的集群 Service 代理路径（不含 query） */
export function buildClusterServiceProxyPath(
  clusterName: string,
  rawDatasourceUrl: string,
  apiPath: string
): string {
  const endpoint = parseInClusterDatasourceEndpoint(rawDatasourceUrl)
  if (!endpoint?.serviceName || !endpoint.namespace) {
    throw new Error('内部数据源 URL 不是合法的集群内 HTTP 地址')
  }
  if (!clusterName.trim()) {
    throw new Error('内部数据源缺少关联集群')
  }
  const requestPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`
  return (
    `/pixiu/proxy/${encodeURIComponent(clusterName)}/api/v1/namespaces/${encodeURIComponent(endpoint.namespace)}` +
    `/services/${encodeURIComponent(endpoint.serviceName)}:${endpoint.port}/proxy${endpoint.basePath}${requestPath}`
  )
}

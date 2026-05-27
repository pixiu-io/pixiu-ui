import { RoutesAlias } from '@/router/routesAlias'

const BLOCKED_PREFIXES = ['/auth/', '/exception/']
const BLOCKED_EXACT = new Set(['/', RoutesAlias.Login, '/login'])

/**
 * 解析登录成功后的跳转地址，过滤无效或不应回访的路径。
 */
export function resolveLoginRedirect(redirect?: string | string[]): string {
  const raw = Array.isArray(redirect) ? redirect[0] : redirect
  if (!raw || typeof raw !== 'string') {
    return '/'
  }

  let target = raw.trim()
  if (!target) return '/'

  if (target.startsWith('http://') || target.startsWith('https://')) {
    return '/'
  }

  try {
    target = decodeURIComponent(target)
  } catch {
    return '/'
  }

  const pathOnly = target.split('?')[0]?.split('#')[0] ?? target
  if (!pathOnly.startsWith('/')) {
    target = `/${pathOnly}${target.slice(pathOnly.length)}`
  } else {
    target = pathOnly + target.slice(pathOnly.length)
  }

  if (BLOCKED_EXACT.has(pathOnly)) {
    return '/'
  }

  if (BLOCKED_PREFIXES.some((prefix) => pathOnly.startsWith(prefix))) {
    return '/'
  }

  return target
}

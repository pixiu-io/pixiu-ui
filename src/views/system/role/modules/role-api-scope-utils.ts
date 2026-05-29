export interface RoleAPIScopeItem {
  api_id: number
  cluster: string
  namespace: string
  resource_name: string
}

const DEFAULT_RESOURCE_NAME = '*'

export function normalizeResourceName(name?: string): string {
  const value = name?.trim()
  return value || DEFAULT_RESOURCE_NAME
}

export function makeScopeKey(
  apiId: number,
  cluster: string,
  namespace: string,
  resourceName = DEFAULT_RESOURCE_NAME
): string {
  return `${apiId}|${cluster}|${namespace}|${normalizeResourceName(resourceName)}`
}

export function scopeItemToKey(item: RoleAPIScopeItem): string {
  return makeScopeKey(item.api_id, item.cluster, item.namespace, item.resource_name)
}

export function keyToScopeItem(key: string): RoleAPIScopeItem | null {
  const parts = key.split('|')
  if (parts.length !== 4) return null
  const apiId = Number(parts[0])
  if (!Number.isFinite(apiId)) return null
  return {
    api_id: apiId,
    cluster: parts[1],
    namespace: parts[2],
    resource_name: normalizeResourceName(parts[3])
  }
}

export function scopeKeysFromItems(items: RoleAPIScopeItem[]): string[] {
  return items.map(scopeItemToKey)
}

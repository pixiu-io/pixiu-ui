/**
 * 角色 API scope 工具：scope 维度为 pixiu 自有资源 (api_id, resource_type, resource_id)。
 * 资源类型常量：plan / cluster / node / agent / account / datasource / distribution / runner
 */
export interface RoleAPIScopeItem {
  api_id: number
  resource_type: string
  resource_id: number
}

export function scopeItemToKey(item: RoleAPIScopeItem): string {
  return `${item.api_id}|${item.resource_type}|${item.resource_id}`
}

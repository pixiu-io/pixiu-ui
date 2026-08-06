import { pixiuAxios } from './container'

export interface RoleAPIScopeRecord {
  api_id: number
  resource_type: string
  resource_id: number
}

export interface MyPermissionAPI {
  id: number
  method: string
  path: string
  group?: string
  description?: string
}

export interface MyPermissionsResult {
  role: number
  is_root: boolean
  apis: MyPermissionAPI[]
  scopes: RoleAPIScopeRecord[]
  buttons: string[]
  menus: string[]
}

export async function fetchMyPermissions(): Promise<MyPermissionsResult> {
  const res = await pixiuAxios.get('/pixiu/users/permissions')
  const { code, result, message } = res.data
  if (code !== 200) {
    throw new Error(message || '获取当前用户权限失败')
  }
  const payload = (result || {}) as MyPermissionsResult
  return {
    role: Number(payload.role) || 0,
    is_root: !!payload.is_root,
    apis: payload.apis || [],
    scopes: payload.scopes || [],
    buttons: payload.buttons || [],
    menus: payload.menus || []
  }
}

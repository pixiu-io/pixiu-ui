import request from '@/utils/http'
import { AppRouteRecord } from '@/types/router'
import { pixiuAxios } from './container'

interface PixiuListUserResponse {
  total: number
  page?: number
  limit?: number
  items?: Array<{
    id: number
    resource_version: number
    name: string
    email: string
    phone: string
    status: number
    role: number
    gmt_create: string
    gmt_modified: string
  }>
}

interface CreatePixiuUserParams {
  name: string
  password: string
  email?: string
  phone?: string
  status?: number
  role?: number
}

interface UpdatePixiuUserParams {
  id: number
  resourceVersion: number
  email?: string
  phone?: string
  status?: number
  role?: number
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// 获取用户列表
export async function fetchGetUserList(
  params: Api.SystemManage.UserSearchParams
): Promise<Api.SystemManage.UserList> {
  const query: Record<string, unknown> = {
    page: params.current || 1,
    limit: params.size || 20
  }
  if (params.userName) query.userName = params.userName
  if (params.userPhone) query.userPhone = params.userPhone
  if (params.userEmail) query.userEmail = params.userEmail
  if (params.status !== undefined && params.status !== '') query.status = Number(params.status)

  const res = await pixiuAxios.get('/pixiu/users', { params: query })
  const { code, result, message } = res.data
  if (code !== 200) {
    throw new Error(message || '获取用户列表失败')
  }

  const payload = (result || {}) as PixiuListUserResponse
  const records: Api.SystemManage.UserListItem[] = (payload.items || []).map((item) => ({
    id: item.id,
    resourceVersion: item.resource_version ?? 0,
    avatar: '',
    status: String(item.status ?? ''),
    userName: item.name || '',
    role: item.role ?? 0,
    nickName: item.name || '',
    userPhone: item.phone || '',
    userEmail: item.email || '',
    userRoles: [],
    createBy: '',
    createTime: formatDateTime(item.gmt_create),
    updateBy: '',
    updateTime: formatDateTime(item.gmt_modified)
  }))

  return {
    records,
    total: payload.total || 0,
    current: params.current || 1,
    size: params.size || 20
  }
}

export async function fetchCreateUser(params: CreatePixiuUserParams): Promise<void> {
  const res = await pixiuAxios.post('/pixiu/users', {
    name: params.name,
    password: params.password,
    email: params.email || '',
    phone: params.phone || '',
    status: params.status ?? 0,
    role: params.role ?? 0
  })
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '新增用户失败')
}

export async function fetchUpdateUser(params: UpdatePixiuUserParams): Promise<void> {
  const res = await pixiuAxios.put(`/pixiu/users/${params.id}`, {
    resource_version: params.resourceVersion,
    email: params.email || '',
    phone: params.phone || '',
    status: params.status ?? 0,
    role: params.role ?? 0
  })
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '更新用户失败')
}

export async function fetchBatchDeleteUsers(userIds: number[]): Promise<void> {
  for (const userId of userIds) {
    const res = await pixiuAxios.delete(`/pixiu/users/${userId}`)
    const { code, message } = res.data
    if (code !== 200) throw new Error(message || `删除用户 ${userId} 失败`)
  }
}

interface ChangePasswordParams {
  userId: number
  old: string
  new: string
}

export async function fetchChangePassword(params: ChangePasswordParams): Promise<void> {
  const res = await pixiuAxios.put(`/pixiu/users/${params.userId}/password`, {
    old: params.old,
    new: params.new
  })
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '修改密码失败')
}

export async function fetchResetUserPassword(userId: number, resourceVersion: number, password: string): Promise<void> {
  const res = await pixiuAxios.put(`/pixiu/users/${userId}/password`, {
    old: '',
    new: password,
    resource_version: resourceVersion,
    reset: true
  })
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '重置密码失败')
}

// 获取角色列表
export function fetchGetRoleList(params: Api.SystemManage.RoleSearchParams) {
  return request.get<Api.SystemManage.RoleList>({
    url: '/api/role/list',
    params
  })
}

// 获取菜单列表
export function fetchGetMenuList() {
  return request.get<AppRouteRecord[]>({
    url: '/api/v3/system/menus'
  })
}

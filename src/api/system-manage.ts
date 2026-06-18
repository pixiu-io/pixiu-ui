import type { AxiosRequestConfig } from 'axios'
import request from '@/utils/http'
import { AppRouteRecord } from '@/types/router'
import { pixiuAxios } from './container'

type PixiuRequestOptions = Pick<AxiosRequestConfig, 'skipErrorNotification' | 'skipUnauthorizedRedirect'>

interface PixiuUserItem {
  id: number
  resource_version: number
  name: string
  email: string
  phone: string
  status: number
  role: number
  description?: string
  gmt_create?: string
  gmt_modified?: string
}

interface PixiuListUserResponse {
  total: number
  page?: number
  limit?: number
  items?: PixiuUserItem[]
}

export interface PixiuUserProfile {
  id: number
  resourceVersion: number
  userName: string
  userPhone: string
  userEmail: string
  description: string
  status: number
  role: number
}

function mapPixiuUserItem(item: PixiuUserItem): PixiuUserProfile {
  return {
    id: item.id,
    resourceVersion: item.resource_version ?? 0,
    userName: item.name || '',
    userPhone: item.phone || '',
    userEmail: item.email || '',
    description: item.description || '',
    status: item.status ?? 0,
    role: item.role ?? 0
  }
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

// 根据 ID 获取用户详情
export async function fetchGetUserById(userId: number): Promise<PixiuUserProfile> {
  const res = await pixiuAxios.get(`/pixiu/users/${userId}`)
  const { code, result, message } = res.data
  if (code !== 200) {
    throw new Error(message || '获取用户信息失败')
  }
  return mapPixiuUserItem((result || {}) as PixiuUserItem)
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
  const records: Api.SystemManage.UserListItem[] = (payload.items || []).map((item) => {
    const profile = mapPixiuUserItem(item)
    return {
      id: profile.id,
      resourceVersion: profile.resourceVersion,
      avatar: '',
      status: String(profile.status),
      userName: profile.userName,
      role: profile.role,
      nickName: profile.userName,
      userPhone: profile.userPhone,
      userEmail: profile.userEmail,
      userRoles: [],
      createBy: '',
      createTime: formatDateTime(item.gmt_create),
      updateBy: '',
      updateTime: formatDateTime(item.gmt_modified)
    }
  })

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
  /** 当前密码（对应接口 old） */
  currentPassword: string
  /** 新密码（对应接口 new） */
  newPassword: string
  resourceVersion: number
}

export async function fetchChangePassword(params: ChangePasswordParams): Promise<void> {
  await pixiuAxios.put(
    `/pixiu/users/${params.userId}/password`,
    {
      old: params.currentPassword,
      new: params.newPassword,
      resource_version: params.resourceVersion
    },
    { skipUnauthorizedRedirect: true }
  )
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

interface PixiuRoleItem {
  id: number
  resource_version: number
  tenant_id: number
  name: string
  description?: string
  gmt_create?: string
  gmt_modified?: string
}

interface PixiuListRoleResponse {
  total: number
  page?: number
  limit?: number
  items?: PixiuRoleItem[]
}

function mapPixiuRoleItem(item: PixiuRoleItem): Api.SystemManage.RoleListItem {
  return {
    id: item.id,
    resourceVersion: item.resource_version ?? 0,
    roleName: item.name || '',
    tenantId: item.tenant_id ?? 0,
    description: item.description || '',
    createTime: formatDateTime(item.gmt_create),
    updateTime: formatDateTime(item.gmt_modified)
  }
}

// 获取角色列表
export async function fetchGetRoleList(
  params: Api.SystemManage.RoleSearchParams,
  options?: PixiuRequestOptions
): Promise<Api.SystemManage.RoleList> {
  const query: Record<string, unknown> = {
    page: params.current || 1,
    limit: params.size || 10
  }
  if (params.roleName) query.nameSelector = params.roleName
  if (params.tenantId !== undefined && params.tenantId !== null) {
    query.tenant_id = params.tenantId
  }

  const res = await pixiuAxios.get('/pixiu/roles', { params: query, ...options })
  const { code, result, message } = res.data
  if (code !== 200) {
    throw new Error(message || '获取角色列表失败')
  }

  const payload = (result || {}) as PixiuListRoleResponse
  const records = (payload.items || []).map((item) => mapPixiuRoleItem(item))

  return {
    records,
    total: payload.total || 0,
    current: params.current || 1,
    size: params.size || 10
  }
}

export async function fetchCreateRole(params: {
  name: string
  tenantId?: number
  description?: string
}): Promise<void> {
  const body: Record<string, unknown> = { name: params.name }
  if (params.tenantId !== undefined && params.tenantId > 0) {
    body.tenant_id = params.tenantId
  }
  if (params.description) body.description = params.description
  const res = await pixiuAxios.post('/pixiu/roles', body)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '创建角色失败')
}

export async function fetchUpdateRole(params: {
  id: number
  resourceVersion: number
  name?: string
  description?: string
}): Promise<void> {
  const body: Record<string, unknown> = {
    resource_version: params.resourceVersion
  }
  if (params.name) body.name = params.name
  if (params.description !== undefined) body.description = params.description
  const res = await pixiuAxios.put(`/pixiu/roles/${params.id}`, body)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '更新角色失败')
}

export async function fetchDeleteRole(roleId: number): Promise<void> {
  const res = await pixiuAxios.delete(`/pixiu/roles/${roleId}`)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '删除角色失败')
}

interface PixiuAPIResource {
  id: number
  resource_version?: number
  method: string
  path: string
  group?: string
  sub_group?: string
  description?: string
  gmt_create?: string
  gmt_modified?: string
}

export interface RoleAPIsResult {
  associated: PixiuAPIResource[]
  unassociated: PixiuAPIResource[]
}

export async function fetchGetRoleAPIs(roleId: number): Promise<RoleAPIsResult> {
  const res = await pixiuAxios.get(`/pixiu/roles/${roleId}/apis`)
  const { code, result, message } = res.data
  if (code !== 200) throw new Error(message || '获取角色 API 权限失败')

  const payload = (result || {}) as RoleAPIsResult
  return {
    associated: payload.associated || [],
    unassociated: payload.unassociated || []
  }
}

export async function fetchUpdateRoleAPIs(roleId: number, apiIds: number[]): Promise<void> {
  const res = await pixiuAxios.put(`/pixiu/roles/${roleId}/apis`, { api_ids: apiIds })
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '更新角色 API 权限失败')
}

export interface RoleAPIScopeRecord {
  api_id: number
  cluster: string
  namespace: string
  resource_name: string
}

export interface RoleAPIScopesResult {
  scopes: RoleAPIScopeRecord[]
  apis: PixiuAPIResource[]
}

export interface UpdateRoleAPIScopesPayload {
  scopes?: RoleAPIScopeRecord[]
  add_scopes?: RoleAPIScopeRecord[]
  remove_scopes?: RoleAPIScopeRecord[]
}

export async function fetchGetRoleAPIScopes(roleId: number): Promise<RoleAPIScopesResult> {
  const res = await pixiuAxios.get(`/pixiu/roles/${roleId}/api-scopes`)
  const { code, result, message } = res.data
  if (code !== 200) throw new Error(message || '获取角色 Kubernetes 权限失败')

  const payload = (result || {}) as RoleAPIScopesResult
  return {
    scopes: payload.scopes || [],
    apis: payload.apis || []
  }
}

export async function fetchUpdateRoleAPIScopes(
  roleId: number,
  payload: UpdateRoleAPIScopesPayload
): Promise<void> {
  const res = await pixiuAxios.put(`/pixiu/roles/${roleId}/api-scopes`, payload)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '更新角色 Kubernetes 权限失败')
}

interface PixiuTenantItem {
  id: number
  resource_version: number
  name: string
  description?: string
  gmt_create?: string
  gmt_modified?: string
}

interface PixiuListTenantResponse {
  total: number
  page?: number
  limit?: number
  items?: PixiuTenantItem[]
}

function mapPixiuTenantItem(item: PixiuTenantItem): Api.SystemManage.TenantListItem {
  return {
    id: item.id,
    resourceVersion: item.resource_version ?? 0,
    tenantName: item.name || '',
    description: item.description || '',
    createTime: formatDateTime(item.gmt_create),
    updateTime: formatDateTime(item.gmt_modified)
  }
}

export async function fetchGetTenantList(
  params: Api.SystemManage.TenantSearchParams,
  options?: PixiuRequestOptions
): Promise<Api.SystemManage.TenantList> {
  const query: Record<string, unknown> = {
    page: params.current || 1,
    limit: params.size || 10
  }
  if (params.tenantName) query.nameSelector = params.tenantName

  const res = await pixiuAxios.get('/pixiu/tenants', { params: query, ...options })
  const { code, result, message } = res.data
  if (code !== 200) {
    throw new Error(message || '获取租户列表失败')
  }

  const payload = (result || {}) as PixiuListTenantResponse
  const records = (payload.items || []).map((item) => mapPixiuTenantItem(item))

  return {
    records,
    total: payload.total || 0,
    current: params.current || 1,
    size: params.size || 10
  }
}

export async function fetchCreateTenant(params: {
  name: string
  description?: string
}): Promise<void> {
  const body: Record<string, unknown> = { name: params.name }
  if (params.description) body.description = params.description
  const res = await pixiuAxios.post('/pixiu/tenants', body)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '创建租户失败')
}

export async function fetchUpdateTenant(params: {
  id: number
  resourceVersion: number
  name?: string
  description?: string
}): Promise<void> {
  const body: Record<string, unknown> = {
    resource_version: params.resourceVersion
  }
  if (params.name) body.name = params.name
  if (params.description !== undefined) body.description = params.description
  const res = await pixiuAxios.put(`/pixiu/tenants/${params.id}`, body)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '更新租户失败')
}

export async function fetchDeleteTenant(tenantId: number): Promise<void> {
  const res = await pixiuAxios.delete(`/pixiu/tenants/${tenantId}`)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '删除租户失败')
}

interface PixiuAPIItem {
  id: number
  resource_version: number
  method: string
  path: string
  group?: string
  sub_group?: string
  description?: string
  gmt_create?: string
  gmt_modified?: string
}

interface PixiuListAPIResponse {
  total: number
  page?: number
  limit?: number
  items?: PixiuAPIItem[]
}

function mapPixiuAPIItem(item: PixiuAPIItem): Api.SystemManage.APIListItem {
  return {
    id: item.id,
    resourceVersion: item.resource_version ?? 0,
    method: item.method || '',
    path: item.path || '',
    group: item.group || '',
    subGroup: item.sub_group || '',
    description: item.description || '',
    createTime: formatDateTime(item.gmt_create),
    updateTime: formatDateTime(item.gmt_modified)
  }
}

export async function fetchGetAPIList(
  params: Api.SystemManage.APISearchParams
): Promise<Api.SystemManage.APIList> {
  const query: Record<string, unknown> = {
    page: params.current || 1,
    limit: params.size || 10
  }
  if (params.path) query.pathSelector = params.path
  if (params.method) query.method = params.method

  const res = await pixiuAxios.get('/pixiu/apis', { params: query })
  const { code, result, message } = res.data
  if (code !== 200) {
    throw new Error(message || '获取 API 列表失败')
  }

  const payload = (result || {}) as PixiuListAPIResponse
  const records = (payload.items || []).map((item) => mapPixiuAPIItem(item))

  return {
    records,
    total: payload.total || 0,
    current: params.current || 1,
    size: params.size || 10
  }
}

export async function fetchCreateAPI(params: {
  method: string
  path: string
  group?: string
  subGroup?: string
  description?: string
}): Promise<void> {
  const body: Record<string, unknown> = {
    method: params.method,
    path: params.path
  }
  if (params.group) body.group = params.group
  if (params.subGroup) body.sub_group = params.subGroup
  if (params.description) body.description = params.description
  const res = await pixiuAxios.post('/pixiu/apis', body)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '创建 API 失败')
}

export async function fetchUpdateAPI(params: {
  id: number
  resourceVersion: number
  method?: string
  path?: string
  group?: string
  subGroup?: string
  description?: string
}): Promise<void> {
  const body: Record<string, unknown> = {
    resource_version: params.resourceVersion
  }
  if (params.method) body.method = params.method
  if (params.path) body.path = params.path
  if (params.group !== undefined) body.group = params.group
  if (params.subGroup !== undefined) body.sub_group = params.subGroup
  if (params.description !== undefined) body.description = params.description
  const res = await pixiuAxios.put(`/pixiu/apis/${params.id}`, body)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '更新 API 失败')
}

export async function fetchDeleteAPI(apiId: number): Promise<void> {
  const res = await pixiuAxios.delete(`/pixiu/apis/${apiId}`)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '删除 API 失败')
}

interface BackendPermission {
  id: number
  resource_version: number
  user_id: number
  user_name: string
  cluster_name: string
  cluster_id: number
  cluster_alias_name: string
  name: string
  sa_name: string
  sa_namespace: string
  kube_config?: string
  content?: string
  gmt_create?: string
  gmt_modified?: string
  p_type: number
  namespace: string
  target_namespaces?: string[]
  expiration_seconds: number
  rules?: Array<{
    apiGroups?: string[]
    resources?: string[]
    verbs?: string[]
  }>
}

export interface PermissionListItem {
  id: number
  resourceVersion: number
  userId: number
  userName: string
  name: string
  cluster: string
  clusterName: string
  clusterId: number
  clusterAliasName: string
  saName: string
  saNamespace: string
  content: string
  createTime: string
  pType: number
  namespace: string
  targetNamespaces?: string[]
  expirationSeconds: number
  updateTime: string
  rules?: Array<{ apiGroups?: string[]; resources?: string[]; verbs?: string[] }>
}

function mapPermissionItem(item: BackendPermission): PermissionListItem {
  return {
    id: item.id,
    resourceVersion: item.resource_version ?? 0,
    userId: item.user_id ?? 0,
    userName: item.user_name || item.name || '',
    name: item.name || '',
    cluster: item.cluster_name || '',
    clusterName: item.cluster_name || '',
    clusterId: item.cluster_id ?? 0,
    clusterAliasName: item.cluster_alias_name || item.cluster_name || '',
    saName: item.sa_name || '',
    saNamespace: item.sa_namespace || '',
    content: item.content || item.kube_config || '',
    createTime: formatDateTime(item.gmt_create),
    updateTime: formatDateTime(item.gmt_modified),
    pType: item.p_type ?? 0,
    namespace: item.namespace || '',
    targetNamespaces: item.target_namespaces || [],
    expirationSeconds: item.expiration_seconds ?? 0,
    rules: item.rules || []
  }
}

/** 权限列表（分页） */
export async function fetchPermissionList(params: {
  page: number
  limit: number
  clusterName?: string
}): Promise<{ total: number; items: PermissionListItem[] }> {
  const query: Record<string, unknown> = { page: params.page, limit: params.limit }
  if (params.clusterName) query.clusterName = params.clusterName
  const res = await pixiuAxios.get('/pixiu/clusters/permissions', { params: query })
  const { code, result, message } = res.data
  if (code !== 200) throw new Error(message || '获取权限列表失败')
  const data = result as { total: number; items?: BackendPermission[] }
  return {
    total: data.total ?? 0,
    items: (data.items ?? []).map(mapPermissionItem)
  }
}

/** 权限详情 */
export async function fetchGetPermission(permissionId: number): Promise<PermissionListItem> {
  const res = await pixiuAxios.get(`/pixiu/clusters/permissions/${permissionId}`)
  const { code, result, message } = res.data
  if (code !== 200) throw new Error(message || '获取权限详情失败')
  return mapPermissionItem(result as BackendPermission)
}

/** 删除权限 */
export async function fetchDeletePermission(permissionId: number): Promise<void> {
  const res = await pixiuAxios.delete(`/pixiu/clusters/permissions/${permissionId}`)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '删除权限失败')
}

/** 批量删除权限 */
export async function fetchBatchDeletePermissions(permissionIds: number[]): Promise<void> {
  for (const id of permissionIds) {
    const res = await pixiuAxios.delete(`/pixiu/clusters/permissions/${id}`)
    const { code, message } = res.data
    if (code !== 200) throw new Error(message || `删除权限 ${id} 失败`)
  }
}

export { fetchGetClusterKubeconfig, type KubeconfigResponse } from '@/api/container'

// 获取菜单列表
export function fetchGetMenuList() {
  return request.get<AppRouteRecord[]>({
    url: '/api/v3/system/menus'
  })
}

/**
 * API 接口类型定义模块
 *
 * 提供所有后端接口的类型定义
 *
 * ## 主要功能
 *
 * - 通用类型（分页参数、响应结构等）
 * - 认证类型（登录、用户信息等）
 * - 系统管理类型（用户、角色等）
 * - 全局命名空间声明
 *
 * ## 使用场景
 *
 * - API 请求参数类型约束
 * - API 响应数据类型定义
 * - 接口文档类型同步
 *
 * ## 注意事项
 *
 * - 在 .vue 文件使用需要在 eslint.config.mjs 中配置 globals: { Api: 'readonly' }
 * - 使用全局命名空间，无需导入即可使用
 *
 * ## 使用方式
 *
 * ```typescript
 * const params: Api.Auth.LoginParams = { userName: 'admin', password: '123456' }
 * const response: Api.Auth.UserInfo = await fetchUserInfo()
 * ```
 *
 * @module types/api/api
 * @author Pixiu Cloud Team
 */

declare namespace Api {
  /** 通用类型 */
  namespace Common {
    /** 分页参数 */
    interface PaginationParams {
      /** 当前页码 */
      current: number
      /** 每页条数 */
      size: number
      /** 总条数 */
      total: number
    }

    /** 通用搜索参数 */
    type CommonSearchParams = Pick<PaginationParams, 'current' | 'size'>

    /** 分页响应基础结构 */
    interface PaginatedResponse<T = any> {
      records: T[]
      current: number
      size: number
      total: number
    }

    /** 启用状态 */
    type EnableStatus = '1' | '2'
  }

  /** 认证类型 */
  namespace Auth {
    /** 登录参数 */
    interface LoginParams {
      name: string
      password: string
    }

    /** 登录响应 */
    interface LoginResponse {
      token: string
      user_id: number
      user_name: string
      role: number
    }

    /** 用户信息 */
    interface UserInfo {
      buttons: string[]
      roles: string[]
      userId: number
      userName: string
      email: string
      avatar?: string
    }
  }

  /** 系统管理类型 */
  namespace SystemManage {
    /** 用户列表 */
    type UserList = Api.Common.PaginatedResponse<UserListItem>

    /** 用户列表项 */
    interface UserListItem {
      id: number
      resourceVersion: number
      avatar: string
      status: string
      userName: string
      role: number
      nickName: string
      userPhone: string
      userEmail: string
      userRoles: string[]
      createBy: string
      createTime: string
      updateBy: string
      updateTime: string
    }

    /** 用户搜索参数 */
    type UserSearchParams = Partial<
      Pick<UserListItem, 'id' | 'userName' | 'userPhone' | 'userEmail' | 'status'> &
        Api.Common.CommonSearchParams
    >

    /** 角色列表 */
    type RoleList = Api.Common.PaginatedResponse<RoleListItem>

    /** 角色列表项（Pixiu RBAC 角色） */
    interface RoleListItem {
      id: number
      resourceVersion: number
      roleName: string
      tenantId: number
      description: string
      createTime: string
      updateTime: string
    }

    /** 角色搜索参数 */
    type RoleSearchParams = Partial<
      Pick<RoleListItem, 'roleName' | 'tenantId'> & Api.Common.CommonSearchParams
    >

    /** 租户列表 */
    type TenantList = Api.Common.PaginatedResponse<TenantListItem>

    /** 租户列表项 */
    interface TenantListItem {
      id: number
      resourceVersion: number
      tenantName: string
      description: string
      createTime: string
      updateTime: string
    }

    /** 租户搜索参数 */
    type TenantSearchParams = Partial<
      Pick<TenantListItem, 'tenantName'> & Api.Common.CommonSearchParams
    >

    /** API 列表 */
    type APIList = Api.Common.PaginatedResponse<APIListItem>

    /** API 列表项 */
    interface APIListItem {
      id: number
      resourceVersion: number
      method: string
      path: string
      group: string
      subGroup: string
      description: string
      createTime: string
      updateTime: string
    }

    /** API 搜索参数 */
    type APISearchParams = Partial<
      Pick<APIListItem, 'method' | 'path' | 'group' | 'subGroup'> & Api.Common.CommonSearchParams
    >
  }
}

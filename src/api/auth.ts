import request from '@/utils/http'

/**
 * 登录
 * @param params 登录参数
 * @returns 登录响应
 */
export function fetchLogin(params: Api.Auth.LoginParams) {
  return request.post<Api.Auth.LoginResponse>({
    url: '/pixiu/users/login',
    params,
    showErrorMessage: false
  })
}

/**
 * 获取用户信息
 * @param userId 用户ID
 * @returns 用户信息
 */
export function fetchGetUserInfo(userId: number) {
  return request.get<any>({
    url: `/pixiu/users/${userId}`
  })
}

/**
 * 退出登录
 * @param userId 用户ID
 */
export function fetchLogout(userId: number) {
  return request.post<void>({
    url: `/pixiu/users/${userId}/logout`,
    showErrorMessage: false
  })
}

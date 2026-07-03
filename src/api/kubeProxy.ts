import axios from 'axios'
import { ElMessage } from 'element-plus'
import { PixiuApiError, rejectIfPixiuBusinessError } from './container'
import { useUserStore } from '@/store/modules/user'
import { shortenError } from '@/utils/http/error'

const TOKEN_STORAGE_KEY = 'pixiu-access-token'

function resolveAccessToken(): string {
  const userStore = useUserStore()
  const token = userStore.accessToken || localStorage.getItem(TOKEN_STORAGE_KEY) || ''
  if (token && !userStore.accessToken) {
    userStore.setToken(token)
    userStore.setLoginStatus(true)
  }
  return token
}

/** Pixiu JWT 使用 Authorization: Bearer；上游服务（如 ES）Basic 认证走该自定义头，由代理转发 */
export const PIXIU_UPSTREAM_AUTHORIZATION_HEADER = 'X-Pixiu-Upstream-Authorization'

export function buildUpstreamBasicAuthorizationHeader(
  username: string,
  password = ''
): Record<string, string> {
  const token = window.btoa(`${username}:${password}`)
  return {
    [PIXIU_UPSTREAM_AUTHORIZATION_HEADER]: `Basic ${token}`
  }
}

/** 直连 `/pixiu/proxy/...` 的 K8s API；代理失败时后端仍可能返回 HTTP 200 + Pixiu 业务包 */
export const kubeProxyAxios = axios.create({
  baseURL: '/',
  timeout: 120000
})

kubeProxyAxios.interceptors.request.use((config) => {
  const token = resolveAccessToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

kubeProxyAxios.interceptors.response.use(
  (response) => {
    const rejected = rejectIfPixiuBusinessError(response.data, response.config)
    if (rejected) return rejected
    return response
  },
  (error) => {
    const data = error.response?.data
    const rejected = rejectIfPixiuBusinessError(data, error.config)
    if (rejected) return rejected

    const config = (error.config as Record<string, unknown> | undefined)
    // 403 无权限且页面指定静默时，不弹错误提示（如集群详情基础信息页）
    const silence403 = config?.silence403
    if (error.response?.status === 403 && silence403) {
      const message = (data as { message?: string } | undefined)?.message || 'Forbidden'
      return Promise.reject(new PixiuApiError(message, true))
    }

    if (data && typeof data === 'object' && (data as { kind?: string }).kind === 'Status') {
      const message = (data as { message?: string }).message
      if (message) {
        const finalMsg = shortenError(message, error.response?.status)
        const skipNotify = (error.config as Record<string, unknown> | undefined)?.skipErrorNotification
        if (!skipNotify) {
          ElMessage.error(finalMsg)
        }
        return Promise.reject(new PixiuApiError(finalMsg, !skipNotify))
      }
    }

    return Promise.reject(error)
  }
)

import axios from 'axios'
import { handlePixiuSessionExpired } from './container'
import { useUserStore } from '@/store/modules/user'

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

/** 直连 `/pixiu/proxy/...` 的 K8s API，响应体为原生 JSON（非 { code, result }） */
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
    const body = response.data
    // pixiu 后端可能以 200 状态码返回业务 401
    if (body && typeof body === 'object' && (body as { code?: number }).code === 401) {
      const message = (body as { message?: string }).message
      return handlePixiuSessionExpired(message)
    }
    return response
  },
  (error) => Promise.reject(error)
)

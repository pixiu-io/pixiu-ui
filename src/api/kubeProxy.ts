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

    if (data && typeof data === 'object' && (data as { kind?: string }).kind === 'Status') {
      const message = (data as { message?: string }).message
      if (message) {
        const finalMsg = shortenError(message, error.response?.status)
        ElMessage.error(finalMsg)
        return Promise.reject(new PixiuApiError(finalMsg, true))
      }
    }

    return Promise.reject(error)
  }
)

import { getApiUrl, getWatchUrl, initAppConfig } from '@/utils/app-config'
import { setPixiuBaseUrl } from '@/api/container'
import { setKubeProxyBaseUrl } from '@/api/kubeProxy'
import { setHttpBaseUrl } from '@/utils/http'

/** 将运行时配置应用到各 HTTP / WebSocket 客户端 */
export function applyRuntimeConfig(): void {
  const apiUrl = getApiUrl()
  setHttpBaseUrl(apiUrl)
  setPixiuBaseUrl(apiUrl)
  setKubeProxyBaseUrl(apiUrl)
}

export { initAppConfig, getApiUrl, getWatchUrl }

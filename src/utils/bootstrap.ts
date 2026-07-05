import { getApiUrl, getWatchUrl, initAppConfig } from '@/utils/app-config'
// @ts-expect-error -- functions not yet exported, reserved for future runtime config injection
import { setPixiuBaseUrl } from '@/api/container'
// @ts-expect-error -- functions not yet exported, reserved for future runtime config injection
import { setKubeProxyBaseUrl } from '@/api/kubeProxy'
// @ts-expect-error -- functions not yet exported, reserved for future runtime config injection
import { setHttpBaseUrl } from '@/utils/http'

/** 将运行时配置应用到各 HTTP / WebSocket 客户端 */
export function applyRuntimeConfig(): void {
  const apiUrl = getApiUrl()
  setHttpBaseUrl(apiUrl)
  setPixiuBaseUrl(apiUrl)
  setKubeProxyBaseUrl(apiUrl)
}

export { initAppConfig, getApiUrl, getWatchUrl }

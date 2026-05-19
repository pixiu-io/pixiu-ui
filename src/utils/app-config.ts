/**
 * 运行时配置：启动时优先读取同域下的 config.json（与 dashboard 一致），
 * 配置文件不存在或读取失败时回退到 VITE_API_URL 等环境变量默认值。
 */

export interface AppRuntimeConfig {
  /** 前端请求后端 API 的基础地址 */
  url?: string
  /** WebSocket / Watch 请求地址，缺省时与 url 相同 */
  watchUrl?: string
}

const DEFAULT_API_URL = String(import.meta.env.VITE_API_URL ?? '/').trim() || '/'

let runtimeApiUrl = ''
let runtimeWatchUrl = ''
let initialized = false

/** 当前生效的 API 基础地址 */
export function getApiUrl(): string {
  return runtimeApiUrl || DEFAULT_API_URL
}

/** 当前生效的 Watch / WebSocket 基础地址 */
export function getWatchUrl(): string {
  return runtimeWatchUrl || getApiUrl()
}

function resolveConfigJsonUrl(): string {
  return new URL('config.json', `${window.location.origin}${import.meta.env.BASE_URL}`).href
}

/** 启动时加载 config.json，失败则静默回退环境变量 */
export async function initAppConfig(): Promise<void> {
  if (initialized) return

  try {
    const response = await fetch(resolveConfigJsonUrl(), { cache: 'no-store' })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const config = (await response.json()) as AppRuntimeConfig
    const url = config.url?.trim()
    const watchUrl = config.watchUrl?.trim()
    if (url) runtimeApiUrl = url
    if (watchUrl) runtimeWatchUrl = watchUrl
  } catch {
    // 配置文件不存在或解析失败，使用环境变量默认值
  }

  initialized = true
}

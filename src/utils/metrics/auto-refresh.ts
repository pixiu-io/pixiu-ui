/** 监控自动刷新间隔 */
export type MetricsAutoRefreshOption = {
  key: string
  label: string
  intervalMs: number
}

export const METRICS_AUTO_REFRESH_OPTIONS: MetricsAutoRefreshOption[] = [
  { key: 'off', label: '关闭', intervalMs: 0 },
  { key: '30s', label: '30秒', intervalMs: 30_000 },
  { key: '1m', label: '1分钟', intervalMs: 60_000 },
  { key: '5m', label: '5分钟', intervalMs: 300_000 }
]

export const DEFAULT_METRICS_AUTO_REFRESH_KEY = '1m'

export function getDefaultMetricsAutoRefresh(): MetricsAutoRefreshOption {
  return (
    METRICS_AUTO_REFRESH_OPTIONS.find((o) => o.key === DEFAULT_METRICS_AUTO_REFRESH_KEY) ??
    METRICS_AUTO_REFRESH_OPTIONS[2]
  )
}

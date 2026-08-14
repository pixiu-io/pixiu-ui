/** 监控自动刷新间隔 */
export type MetricsAutoRefreshOption = {
  key: string
  label: string
  intervalMs: number
}

export const METRICS_AUTO_REFRESH_OPTIONS: MetricsAutoRefreshOption[] = [
  { key: 'off', label: '关', intervalMs: 0 },
  { key: 'auto', label: 'Auto', intervalMs: 0 },
  { key: '30s', label: '30s', intervalMs: 30_000 },
  { key: '1m', label: '1m', intervalMs: 60_000 },
  { key: '3m', label: '3m', intervalMs: 180_000 },
  { key: '5m', label: '5m', intervalMs: 300_000 },
  { key: '15m', label: '15m', intervalMs: 900_000 },
  { key: '30m', label: '30m', intervalMs: 1_800_000 }
]

export const DEFAULT_METRICS_AUTO_REFRESH_KEY = '1m'

export function getDefaultMetricsAutoRefresh(): MetricsAutoRefreshOption {
  return (
    METRICS_AUTO_REFRESH_OPTIONS.find((o) => o.key === DEFAULT_METRICS_AUTO_REFRESH_KEY) ??
    METRICS_AUTO_REFRESH_OPTIONS[2]
  )
}

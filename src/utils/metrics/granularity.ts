/** 监控图表时间粒度（客户端降采样步长） */
export type MetricsGranularityOption = {
  key: string
  label: string
  stepMs: number
}

export const METRICS_GRANULARITY_OPTIONS: MetricsGranularityOption[] = [
  { key: '1m', label: '1分钟', stepMs: 60_000 },
  { key: '5m', label: '5分钟', stepMs: 300_000 },
  { key: '15m', label: '15分钟', stepMs: 900_000 },
  { key: '1h', label: '1小时', stepMs: 3_600_000 }
]

export const DEFAULT_METRICS_GRANULARITY_KEY = '1m'

export function getDefaultMetricsGranularity(): MetricsGranularityOption {
  return (
    METRICS_GRANULARITY_OPTIONS.find((o) => o.key === DEFAULT_METRICS_GRANULARITY_KEY) ??
    METRICS_GRANULARITY_OPTIONS[0]
  )
}

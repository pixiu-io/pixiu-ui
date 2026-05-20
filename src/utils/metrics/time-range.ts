/** 监控指标时间区间（与云厂商控制台快捷选项对齐） */
export type MetricsTimeRange = {
  start: Date
  end: Date
  /** 快捷项 key；自定义区间时为 custom */
  presetKey?: string
}

export type MetricsTimePreset = {
  key: string
  label: string
  getRange: (now?: Date) => MetricsTimeRange
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

function relativeRange(
  key: string,
  label: string,
  durationMs: number,
  now = new Date()
): MetricsTimeRange {
  return {
    start: new Date(now.getTime() - durationMs),
    end: now,
    presetKey: key
  }
}

export const METRICS_TIME_PRESETS: MetricsTimePreset[] = [
  {
    key: '5m',
    label: '5分钟',
    getRange: (now) => relativeRange('5m', '5分钟', 5 * 60 * 1000, now)
  },
  {
    key: '30m',
    label: '30分钟',
    getRange: (now) => relativeRange('30m', '30分钟', 30 * 60 * 1000, now)
  },
  {
    key: '1h',
    label: '1小时',
    getRange: (now) => relativeRange('1h', '1小时', 60 * 60 * 1000, now)
  },
  {
    key: '12h',
    label: '12小时',
    getRange: (now) => relativeRange('12h', '12小时', 12 * 60 * 60 * 1000, now)
  },
  {
    key: '24h',
    label: '24小时',
    getRange: (now) => relativeRange('24h', '24小时', 24 * 60 * 60 * 1000, now)
  },
  {
    key: '7d',
    label: '7天',
    getRange: (now) => relativeRange('7d', '7天', 7 * 24 * 60 * 60 * 1000, now)
  },
  {
    key: '30d',
    label: '30天',
    getRange: (now) => relativeRange('30d', '30天', 30 * 24 * 60 * 60 * 1000, now)
  },
  {
    key: 'today',
    label: '今天',
    getRange: (now = new Date()) => ({
      start: startOfDay(now),
      end: now,
      presetKey: 'today'
    })
  },
  {
    key: 'yesterday',
    label: '昨天',
    getRange: (now = new Date()) => {
      const y = new Date(now)
      y.setDate(y.getDate() - 1)
      return {
        start: startOfDay(y),
        end: endOfDay(y),
        presetKey: 'yesterday'
      }
    }
  }
]

export const DEFAULT_METRICS_TIME_PRESET_KEY = '1h'

export function getDefaultMetricsTimeRange(now = new Date()): MetricsTimeRange {
  const preset =
    METRICS_TIME_PRESETS.find((p) => p.key === DEFAULT_METRICS_TIME_PRESET_KEY) ??
    METRICS_TIME_PRESETS[2]
  return preset.getRange(now)
}

export function getMetricsTimeRangeLabel(range: MetricsTimeRange | null | undefined): string {
  if (!range) return '1小时'
  const preset = METRICS_TIME_PRESETS.find((p) => p.key === range.presetKey)
  if (preset) return preset.label
  return `${formatDateTime(range.start)} 至 ${formatDateTime(range.end)}`
}

export function formatDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function toDateTimePickerValue(range: MetricsTimeRange): [Date, Date] {
  return [new Date(range.start), new Date(range.end)]
}

export function fromDateTimePickerValue(value: [Date, Date] | null | undefined): MetricsTimeRange | null {
  if (!value?.[0] || !value?.[1]) return null
  const start = value[0]
  const end = value[1]
  if (start.getTime() > end.getTime()) return null
  const matched = METRICS_TIME_PRESETS.find((p) => {
    const r = p.getRange(end)
    return (
      p.key !== 'today' &&
      p.key !== 'yesterday' &&
      Math.abs(r.start.getTime() - start.getTime()) < 2000 &&
      Math.abs(r.end.getTime() - end.getTime()) < 2000
    )
  })
  return {
    start,
    end,
    presetKey: matched?.key ?? 'custom'
  }
}

export type MetricsTimeShortcut = {
  text: string
  value: () => [Date, Date]
}

/**
 * 生成 Element Plus DatePicker shortcuts。
 * 每次点击快捷项时按“当前时间”重新计算区间，避免使用陈旧时间。
 */
export function buildMetricsTimeShortcuts(nowFactory: () => Date = () => new Date()): MetricsTimeShortcut[] {
  return METRICS_TIME_PRESETS.map((preset) => ({
    text: preset.label,
    value: () => {
      const range = preset.getRange(nowFactory())
      return [new Date(range.start), new Date(range.end)]
    }
  }))
}

export const DISK_LOW_BYTES = 20 * 1024 ** 3
export const RETRANS_HIGH = 1

export function clampPercent(value: number | null): number {
  if (value === null || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

export function relativeBar(value: number | null, max: number): number {
  if (value === null || !Number.isFinite(value) || max <= 0) return 0
  return Math.max(2, Math.min(100, (value / max) * 100))
}

export function levelClass(value: number | null): string {
  if (value === null) return ''
  if (value > 85) return 'is-danger'
  if (value > 70) return 'is-warning'
  return 'is-ok'
}

export function formatPercent(value: number | null): string {
  if (value === null) return '-'
  return `${value.toFixed(1)}%`
}

export function formatCores(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '-'
  const digits = Number.isInteger(value) || Math.abs(value) >= 10 ? 0 : 1
  return `${value.toFixed(digits)} 核`
}

export function formatBytes(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '-'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  let current = Math.abs(value)
  let index = 0
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024
    index += 1
  }
  return `${current.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

export function formatRate(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '-'
  const units = ['B/s', 'KiB/s', 'MiB/s', 'GiB/s']
  let current = Math.abs(value)
  let index = 0
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024
    index += 1
  }
  const digits = current >= 100 || index === 0 ? 0 : 1
  return `${current.toFixed(digits)} ${units[index]}`
}

export function formatLoad(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '-'
  return value.toFixed(2)
}

export function formatConn(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '-'
  return String(Math.round(value))
}

export function formatRetrans(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '-'
  return `${value.toFixed(1)}%`
}

export function formatUptime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '-'
  const sec = Math.floor(seconds)
  const weeks = Math.floor(sec / (7 * 24 * 3600))
  if (weeks >= 1) return `${weeks} weeks`
  const days = Math.floor(sec / (24 * 3600))
  if (days >= 1) return `${days} days`
  const hours = Math.floor(sec / 3600)
  if (hours >= 1) return `${hours} hours`
  const minutes = Math.floor(sec / 60)
  if (minutes >= 1) return `${minutes} min`
  return `${sec}s`
}

export function formatPod(value: number | null): string {
  if (value === null) return '-'
  return String(Math.round(value))
}

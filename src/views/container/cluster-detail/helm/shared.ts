import type { HelmReleaseChartMeta, HelmReleaseItem } from '@/api/helm'
import { formatNodeCreationTime } from '@/utils/kubernetes/nodeDisplay'

export type HelmPageView = 'releases' | 'repos'
export type HelmReleaseLayout = 'grid' | 'table'

export function formatChartLabel(chart?: HelmReleaseChartMeta): string {
  const name = chart?.metadata?.name ?? ''
  const ver = chart?.metadata?.version ?? ''
  if (!name && !ver) return '-'
  return ver ? `${name}-${ver}` : name
}

export function formatHelmTime(ts?: string): string {
  if (!ts) return '-'
  return formatNodeCreationTime(ts)
}

export function releaseStatusMeta(status?: string) {
  const normalized = (status ?? '').toLowerCase()
  if (normalized === 'deployed') {
    return { label: status || 'deployed', type: 'success' as const, dot: 'is-success' }
  }
  if (normalized === 'failed') {
    return { label: status || 'failed', type: 'danger' as const, dot: 'is-danger' }
  }
  if (normalized === 'pending-install' || normalized === 'pending-upgrade' || normalized === 'pending-rollback') {
    return { label: status || 'pending', type: 'warning' as const, dot: 'is-warning' }
  }
  if (normalized === 'uninstalled' || normalized === 'superseded') {
    return { label: status || normalized, type: 'info' as const, dot: 'is-muted' }
  }
  return { label: status || '-', type: 'info' as const, dot: 'is-muted' }
}

export function filterByName<T extends { name?: string }>(list: T[], keyword: string): T[] {
  const kw = keyword.trim().toLowerCase()
  if (!kw) return list
  return list.filter((item) => String(item.name ?? '').toLowerCase().includes(kw))
}

export function summarizeReleases(releases: HelmReleaseItem[]) {
  const total = releases.length
  const deployed = releases.filter((item) => item.info?.status === 'deployed').length
  const failed = releases.filter((item) => item.info?.status === 'failed').length
  const pending = releases.filter((item) => {
    const status = (item.info?.status ?? '').toLowerCase()
    return status.startsWith('pending')
  }).length
  return { total, deployed, failed, pending }
}

import type { DashboardDefinition, DashboardPanelDefinition, DashboardPanelResult } from '@/api/dashboard'

export function embedStat(
  resultMap: Record<string, DashboardPanelResult>,
  panelId: string
): number | null {
  const result = resultMap[panelId]
  if (result?.status !== 'success') return null
  const value = Number(result.series?.[0]?.values?.at(-1)?.value)
  return Number.isFinite(value) ? value : null
}

export function embedQuantile(
  resultMap: Record<string, DashboardPanelResult>,
  panelId: string,
  quantile: number
): number | null {
  const result = resultMap[panelId]
  if (result?.status !== 'success') return null
  const series = result.series.find((item) => Number(item.metric.quantile) === quantile)
  if (!series) return null
  const value = Number(series.values.at(-1)?.value)
  return Number.isFinite(value) ? value : null
}

export function resolveEmbedPanels(
  definition: DashboardDefinition,
  ids: string[]
): DashboardPanelDefinition[] {
  return ids
    .map((id) => definition.panels.find((panel) => panel.id === id))
    .filter((panel): panel is DashboardPanelDefinition => panel !== undefined)
}

export function countNodeReady(resultMap: Record<string, DashboardPanelResult>): {
  ready: number
  notReady: number
  total: number
} {
  const result = resultMap['node.embed.ready']
  if (result?.status !== 'success') return { ready: 0, notReady: 0, total: 0 }
  let ready = 0
  let notReady = 0
  for (const series of result.series) {
    const name = series.metric.node?.trim()
    if (!name) continue
    const value = Number(series.values.at(-1)?.value ?? 0)
    if (value > 0) ready += 1
    else notReady += 1
  }
  return { ready, notReady, total: ready + notReady }
}

export function countPodPhases(resultMap: Record<string, DashboardPanelResult>): Record<string, number> {
  const result = resultMap['pod.embed.phase']
  const counts: Record<string, number> = {}
  if (result?.status !== 'success') return counts
  for (const series of result.series) {
    const phase = series.metric.phase?.trim()
    if (!phase) continue
    const value = Number(series.values.at(-1)?.value ?? 0)
    if (value > 0) counts[phase] = (counts[phase] ?? 0) + value
  }
  return counts
}

export function avgBarPercent(resultMap: Record<string, DashboardPanelResult>, panelId: string): number | null {
  const result = resultMap[panelId]
  if (result?.status !== 'success' || !result.series.length) return null
  const values = result.series
    .map((item) => Number(item.values.at(-1)?.value ?? 0))
    .filter((value) => Number.isFinite(value))
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function minBarPercent(resultMap: Record<string, DashboardPanelResult>, panelId: string): number | null {
  const result = resultMap[panelId]
  if (result?.status !== 'success' || !result.series.length) return null
  const values = result.series
    .map((item) => Number(item.values.at(-1)?.value ?? 0))
    .filter((value) => Number.isFinite(value))
  if (!values.length) return null
  return Math.min(...values)
}

const MIN_TRAFFIC_QPS = 0.001

export function hasComponentTraffic(qps: number | null): boolean {
  return qps !== null && qps > MIN_TRAFFIC_QPS
}

export function isComponentIdle(qps: number | null, primaryRate: number | null): boolean {
  return !hasComponentTraffic(qps) && (primaryRate === null || primaryRate === 0)
}

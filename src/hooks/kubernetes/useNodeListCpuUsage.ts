import { type ComputedRef, type Ref, reactive, unref } from 'vue'
import { fetchDashboardQuery, type DashboardPanelResult } from '@/api/dashboard'
import { loadPrometheusDatasource } from '@/utils/datasource/prometheus-datasource'

const CPU_PANEL_ID = 'node.embed.overview_cpu'
const MEMORY_PANEL_ID = 'node.embed.overview_memory'

/**
 * 节点管理列表：按节点拉取 CPU / 内存使用率（%）。
 * 与 Node 监控概览 `node.embed.overview_cpu` / `overview_memory` 同源；静默轮询时保留旧值。
 */
export function useNodeListCpuUsage(clusterName: Ref<string> | ComputedRef<string>) {
  /** nodeName → CPU 使用率百分比 */
  const cpuUsageByNode = reactive<Record<string, number>>({})
  /** nodeName → 内存使用率百分比 */
  const memoryUsageByNode = reactive<Record<string, number>>({})

  let refreshTimer: ReturnType<typeof setInterval> | null = null
  let querySequence = 0

  function clearMap(map: Record<string, number>) {
    for (const key of Object.keys(map)) delete map[key]
  }

  function clearAll() {
    clearMap(cpuUsageByNode)
    clearMap(memoryUsageByNode)
  }

  function seriesToMap(result: DashboardPanelResult | undefined): Record<string, number> {
    const next: Record<string, number> = {}
    if (result?.status !== 'success') return next
    for (const series of result.series) {
      const value = Number(series.values.at(-1)?.value)
      if (!Number.isFinite(value)) continue
      const node = series.metric.node?.trim() || series.metric.nodename?.trim()
      if (node) next[node] = value
      const instance = series.metric.instance?.trim()
      if (instance) {
        const host = instance.split(':')[0]?.trim()
        // 无 node 标签时用 instance 主机名/IP 作为兜底键（与 Node 概览表一致）
        if (host && next[host] === undefined) next[host] = value
      }
    }
    return next
  }

  function replaceMap(target: Record<string, number>, next: Record<string, number>) {
    for (const key of Object.keys(target)) {
      if (!(key in next)) delete target[key]
    }
    for (const [key, value] of Object.entries(next)) {
      target[key] = value
    }
  }

  async function load(silent = false) {
    const name = String(unref(clusterName) || '').trim()
    if (!name) {
      if (!silent) clearAll()
      return
    }

    const sequence = ++querySequence
    try {
      const datasource = await loadPrometheusDatasource(name)
      if (!datasource) {
        if (!silent) clearAll()
        return
      }

      const end = Math.floor(Date.now() / 1000)
      const start = end - 300
      const response = await fetchDashboardQuery(datasource, {
        panelIds: [CPU_PANEL_ID, MEMORY_PANEL_ID],
        start,
        end,
        step: 60,
        filters: {}
      })
      if (sequence !== querySequence) return
      const byId = Object.fromEntries(response.results.map((item) => [item.id, item]))
      replaceMap(cpuUsageByNode, seriesToMap(byId[CPU_PANEL_ID]))
      replaceMap(memoryUsageByNode, seriesToMap(byId[MEMORY_PANEL_ID]))
    } catch {
      if (!silent) clearAll()
    }
  }

  function stopRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
  }

  function startRefresh(intervalMs = 60_000) {
    stopRefresh()
    void load(false)
    if (intervalMs > 0) {
      refreshTimer = setInterval(() => void load(true), intervalMs)
    }
  }

  /** 手动刷新：静默拉数，保留旧值 */
  function refresh() {
    return load(true)
  }

  return {
    cpuUsageByNode,
    memoryUsageByNode,
    load,
    refresh,
    startRefresh,
    stopRefresh
  }
}

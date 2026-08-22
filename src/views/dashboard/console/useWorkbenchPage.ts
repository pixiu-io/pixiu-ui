import { computed, ref, watch } from 'vue'
import { fetchDashboardQuery, type DashboardPanelResult } from '@/api/dashboard'
import { fetchClusterList, type ClusterItem, type ClusterStatus } from '@/api/container'
import {
  DatasourceSubTypeMap,
  fetchDatasourceList,
  type DatasourceItem,
  type DatasourceSubType
} from '@/api/datasource'
import { kubeProxyAxios } from '@/api/kubeProxy'
import { loadPrometheusDatasource } from '@/utils/datasource/prometheus-datasource'
import { notifyError } from '@/utils/sys/notify'
import {
  DISK_LOW_BYTES,
  RETRANS_HIGH
} from '@/views/container/cluster-detail/prometheus/embed/overview-table-format'

export const CLUSTER_STATUS_CONFIG: Record<
  number,
  { type: 'success' | 'primary' | 'info' | 'danger' | 'warning'; text: string }
> = {
  0: { type: 'success', text: '运行中' },
  1: { type: 'primary', text: '部署中' },
  2: { type: 'info', text: '等待部署' },
  3: { type: 'danger', text: '部署失败' },
  4: { type: 'warning', text: '集群失联' },
  5: { type: 'info', text: '等待接入' }
}

export type WorkbenchClusterRow = {
  id: number
  name: string
  aliasName: string
  displayName: string
  /** 0 标准集群，1 自建集群 */
  clusterType: number
  status: ClusterStatus
  statusText: string
  statusType: 'success' | 'primary' | 'info' | 'danger' | 'warning'
  nodeReady: number
  nodeNotReady: number
  nodeCount: number
  podCount: number | null
  cpuPercent: number | null
  memoryPercent: number | null
  diskPercent: number | null
  cpuTotal: number | null
  memoryTotal: number | null
  diskAvail: number | null
  netTx: number | null
  netRx: number | null
  connections: number | null
  retrans: number | null
  load5: number | null
  uptime: number | null
  hot: boolean
  diskLow: boolean
  retransHigh: boolean
  danger: boolean
  alertCount: number
  pressureScore: number
  hasPrometheus: boolean
}

export type WorkbenchRiskRow = {
  key: string
  name: string
  reason: string
  action: string
  tone: 'danger' | 'warning' | 'info'
}

export type WorkbenchActivityItem = {
  key: string
  level: 'danger' | 'warning' | 'info'
  text: string
}

const METRIC_PANEL_IDS = [
  'cluster.running_pods',
  'cluster.cpu_usage',
  'cluster.memory_usage',
  'cluster.cpu_total_trend',
  'cluster.memory_total_trend',
  'cluster.disk_usage_trend',
  'cluster.cpu_usage_trend',
  'cluster.memory_usage_trend',
  'node.embed.overview_disk',
  'node.embed.overview_net_transmit',
  'node.embed.overview_net_receive',
  'node.embed.overview_connections',
  'node.embed.overview_retrans',
  'node.embed.overview_load5',
  'node.embed.overview_uptime'
] as const

const CPU_MEM_DISK_TREND_PANEL_IDS = [
  'cluster.cpu_usage_trend',
  'cluster.memory_usage_trend',
  'cluster.disk_usage_trend'
] as const

const NETWORK_TREND_PANEL_IDS = [
  'network.bandwidth_trend',
  'network.transmit_rate_mb_trend',
  'network.receive_rate_mb_trend'
] as const

type TrendMap = Record<string, Partial<Record<string, DashboardPanelResult>>>

/** enrich 阶段已拉取的近 7 天 CPU/内存/磁盘趋势，供 loadTrends 复用 */
const enrichTrendCache: TrendMap = {}

function clearEnrichTrendCache(): void {
  for (const key of Object.keys(enrichTrendCache)) {
    delete enrichTrendCache[key]
  }
}

function lastPanelValue(result: DashboardPanelResult | undefined): number | null {
  const value = Number(result?.series?.[0]?.values?.at(-1)?.value)
  return Number.isFinite(value) ? value : null
}

function sumSeriesLast(result: DashboardPanelResult | undefined): number | null {
  if (result?.status !== 'success') return null
  let sum = 0
  let has = false
  for (const series of result.series) {
    const value = Number(series.values.at(-1)?.value)
    if (!Number.isFinite(value)) continue
    sum += value
    has = true
  }
  return has ? sum : null
}

function avgSeriesLast(result: DashboardPanelResult | undefined): number | null {
  if (result?.status !== 'success') return null
  let sum = 0
  let count = 0
  for (const series of result.series) {
    const value = Number(series.values.at(-1)?.value)
    if (!Number.isFinite(value)) continue
    sum += value
    count += 1
  }
  return count > 0 ? sum / count : null
}

function minSeriesLast(result: DashboardPanelResult | undefined): number | null {
  if (result?.status !== 'success') return null
  let min: number | null = null
  for (const series of result.series) {
    const value = Number(series.values.at(-1)?.value)
    if (!Number.isFinite(value)) continue
    min = min === null ? value : Math.min(min, value)
  }
  return min
}

function applyOverviewMetrics(
  row: WorkbenchClusterRow,
  byId: Record<string, DashboardPanelResult>
): void {
  row.cpuTotal = lastPanelValue(byId['cluster.cpu_total_trend'])
  row.memoryTotal = lastPanelValue(byId['cluster.memory_total_trend'])
  row.diskAvail = sumSeriesLast(byId['node.embed.overview_disk'])
  row.netTx = sumSeriesLast(byId['node.embed.overview_net_transmit'])
  row.netRx = sumSeriesLast(byId['node.embed.overview_net_receive'])
  row.connections = sumSeriesLast(byId['node.embed.overview_connections'])
  row.retrans = avgSeriesLast(byId['node.embed.overview_retrans'])
  row.load5 = avgSeriesLast(byId['node.embed.overview_load5'])
  row.uptime = minSeriesLast(byId['node.embed.overview_uptime'])
  row.hot =
    row.status === 0 &&
    ((row.cpuPercent !== null && row.cpuPercent > 70) ||
      (row.memoryPercent !== null && row.memoryPercent > 70) ||
      row.nodeNotReady > 0)
  row.diskLow = row.diskAvail !== null && row.diskAvail < DISK_LOW_BYTES
  row.retransHigh = row.retrans !== null && row.retrans > RETRANS_HIGH
  row.danger =
    row.status === 3 || row.status === 4 || (row.status === 0 && row.nodeNotReady > 0)
}

function isRunningCluster(cluster: ClusterItem): boolean {
  return cluster.status === 0
}

/** 失联/失败集群不走 K8s API 回退，避免无意义 proxy 请求 */
function shouldTryPodFallback(cluster: ClusterItem): boolean {
  return cluster.status === 0
}

const podFallbackCache = new Map<string, number | null>()

async function fetchPodCountFallback(clusterName: string): Promise<number | null> {
  if (podFallbackCache.has(clusterName)) {
    return podFallbackCache.get(clusterName) ?? null
  }

  try {
    const { data } = await kubeProxyAxios.get<{
      items?: unknown[]
      metadata?: { remainingItemCount?: number }
    }>(`/pixiu/proxy/${encodeURIComponent(clusterName)}/api/v1/pods`, {
      params: { limit: 1 },
      skipErrorNotification: true,
      silence403: true
    } as any)
    const remaining = data.metadata?.remainingItemCount
    const count =
      typeof remaining === 'number' ? remaining + (data.items?.length ?? 0) : (data.items?.length ?? null)
    podFallbackCache.set(clusterName, count)
    return count
  } catch {
    podFallbackCache.set(clusterName, null)
    return null
  }
}

async function resolvePodCount(
  cluster: ClusterItem,
  byId?: Record<string, DashboardPanelResult>
): Promise<number | null> {
  const fromProm = byId ? lastPanelValue(byId['cluster.running_pods']) : null
  if (fromProm !== null) return fromProm
  if (!shouldTryPodFallback(cluster)) return null
  return fetchPodCountFallback(cluster.name)
}

function clusterAlertCount(
  row: Pick<WorkbenchClusterRow, 'status' | 'nodeNotReady' | 'cpuPercent' | 'memoryPercent' | 'hasPrometheus'>
): number {
  let count = 0
  if (row.status === 3 || row.status === 4) count += 1
  if (row.nodeNotReady > 0) count += 1
  if (row.cpuPercent !== null && row.cpuPercent >= 85) count += 1
  if (row.memoryPercent !== null && row.memoryPercent >= 85) count += 1
  if (row.status !== 0 && row.status !== 1) count += 1
  if (row.status === 0 && !row.hasPrometheus) count += 1
  return count
}

function pressureScore(
  row: Pick<WorkbenchClusterRow, 'status' | 'nodeNotReady' | 'nodeCount' | 'cpuPercent' | 'memoryPercent' | 'hasPrometheus'>
): number {
  if (row.status === 3 || row.status === 4) return 100
  if (row.status !== 0) return 85
  const cpu = row.cpuPercent ?? 0
  const mem = row.memoryPercent ?? 0
  const nodePressure =
    row.nodeCount > 0 ? (row.nodeNotReady / row.nodeCount) * 100 : row.nodeNotReady > 0 ? 100 : 0
  let score = cpu * 0.4 + mem * 0.4 + nodePressure * 0.2
  if (!row.hasPrometheus) score += 8
  return Math.max(0, Math.min(100, Math.round(score)))
}

function buildBaseClusterRow(cluster: ClusterItem): WorkbenchClusterRow {
  const statusCfg = CLUSTER_STATUS_CONFIG[cluster.status] ?? { type: 'info' as const, text: '未知' }
  const base: WorkbenchClusterRow = {
    id: cluster.id,
    name: cluster.name,
    aliasName: cluster.aliasName,
    displayName: cluster.aliasName || cluster.name,
    clusterType: cluster.clusterType ?? 0,
    status: cluster.status,
    statusText: statusCfg.text,
    statusType: statusCfg.type,
    nodeReady: cluster.nodeReady,
    nodeNotReady: cluster.nodeNotReady,
    nodeCount: cluster.nodeCount,
    podCount: null,
    cpuPercent: null,
    memoryPercent: null,
    diskPercent: null,
    cpuTotal: null,
    memoryTotal: null,
    diskAvail: null,
    netTx: null,
    netRx: null,
    connections: null,
    retrans: null,
    load5: null,
    uptime: null,
    hot: false,
    diskLow: false,
    retransHigh: false,
    danger: false,
    alertCount: 0,
    pressureScore: 0,
    hasPrometheus: false
  }
  if (!isRunningCluster(cluster)) {
    base.danger = base.status === 3 || base.status === 4
  }
  base.alertCount = clusterAlertCount(base)
  base.pressureScore = pressureScore(base)
  return base
}

async function enrichCluster(cluster: ClusterItem): Promise<WorkbenchClusterRow> {
  const base = buildBaseClusterRow(cluster)

  if (!isRunningCluster(cluster)) {
    return base
  }

  const datasource = await loadPrometheusDatasource(cluster.name)
  if (!datasource) {
    base.podCount = await resolvePodCount(cluster)
    base.alertCount = clusterAlertCount(base)
    base.pressureScore = pressureScore(base)
    return base
  }

  base.hasPrometheus = true
  let byId: Record<string, DashboardPanelResult> | undefined
  try {
    const end = Math.floor(Date.now() / 1000)
    const start = end - 7 * 24 * 3600
    const step = Math.max(3600, Math.ceil((end - start) / 168))
    const response = await fetchDashboardQuery(datasource, {
      panelIds: [...METRIC_PANEL_IDS],
      start,
      end,
      step,
      filters: {}
    })
    byId = Object.fromEntries(response.results.map((item) => [item.id, item]))
    base.cpuPercent = lastPanelValue(byId['cluster.cpu_usage'])
    base.memoryPercent = lastPanelValue(byId['cluster.memory_usage'])
    base.diskPercent = lastPanelValue(byId['cluster.disk_usage_trend'])
    applyOverviewMetrics(base, byId)
    const cached: Partial<Record<string, DashboardPanelResult>> = {}
    for (const id of CPU_MEM_DISK_TREND_PANEL_IDS) {
      if (byId[id]) cached[id] = byId[id]
    }
    if (Object.keys(cached).length) {
      enrichTrendCache[cluster.name] = cached
    }
  } catch {
    /* Prometheus 查询失败时仍尝试 Pod 回退 */
  }

  base.podCount = await resolvePodCount(cluster, byId)
  base.alertCount = clusterAlertCount(base)
  base.pressureScore = pressureScore(base)
  return base
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  if (!items.length) return []
  const results = new Array<R>(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await fn(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

function averagePercent(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => v !== null && Number.isFinite(v))
  if (!nums.length) return null
  return nums.reduce((sum, v) => sum + v, 0) / nums.length
}

function mergeTrendSeries(
  clusters: WorkbenchClusterRow[],
  panelId:
    | 'cluster.cpu_usage_trend'
    | 'cluster.memory_usage_trend'
    | 'cluster.disk_usage_trend',
  trendMap: TrendMap
): { labels: string[]; values: number[] } {
  const seriesList: Array<{ labels: string[]; values: number[] }> = []
  for (const cluster of clusters) {
    if (!cluster.hasPrometheus) continue
    const result = trendMap[cluster.name]?.[panelId]
    if (result?.status !== 'success') continue
    const values = result.series?.[0]?.values ?? []
    if (!values.length) continue
    seriesList.push({
      labels: values.map((point) => {
        const d = new Date(point.timestamp * 1000)
        const pad = (n: number) => String(n).padStart(2, '0')
        return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      }),
      values: values.map((point) => Number(point.value)).filter((v) => Number.isFinite(v))
    })
  }
  if (!seriesList.length) return { labels: [], values: [] }
  const labels = seriesList[0].labels
  const values = labels.map((_, index) => {
    const nums = seriesList.map((series) => series.values[index]).filter((v) => Number.isFinite(v))
    if (!nums.length) return 0
    return +(nums.reduce((sum, v) => sum + v, 0) / nums.length).toFixed(2)
  })
  return { labels, values }
}

function mergeTrendSeriesSum(
  clusters: WorkbenchClusterRow[],
  panelId:
    | 'network.bandwidth_trend'
    | 'network.transmit_rate_mb_trend'
    | 'network.receive_rate_mb_trend',
  trendMap: TrendMap
): { labels: string[]; values: number[] } {
  const seriesList: Array<{ labels: string[]; values: number[] }> = []
  for (const cluster of clusters) {
    if (!cluster.hasPrometheus) continue
    const result = trendMap[cluster.name]?.[panelId]
    if (result?.status !== 'success') continue
    const values = result.series?.[0]?.values ?? []
    if (!values.length) continue
    seriesList.push({
      labels: values.map((point) => {
        const d = new Date(point.timestamp * 1000)
        const pad = (n: number) => String(n).padStart(2, '0')
        return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      }),
      values: values.map((point) => Number(point.value)).filter((v) => Number.isFinite(v))
    })
  }
  if (!seriesList.length) return { labels: [], values: [] }
  const labels = seriesList[0].labels
  const values = labels.map((_, index) => {
    const nums = seriesList.map((series) => series.values[index]).filter((v) => Number.isFinite(v))
    if (!nums.length) return 0
    return +nums.reduce((sum, v) => sum + v, 0).toFixed(2)
  })
  return { labels, values }
}

function sumNullable(values: Array<number | null | undefined>): number | null {
  let sum = 0
  let has = false
  for (const value of values) {
    if (value === null || value === undefined || !Number.isFinite(value)) continue
    sum += value
    has = true
  }
  return has ? sum : null
}

export type WorkbenchResourceSummary = {
  cpuAvg: number | null
  cpuTotalCores: number | null
  memAvg: number | null
  memoryUsedGiB: number | null
  memoryTotalGiB: number | null
  diskAvg: number | null
  diskUsedGiB: number | null
  diskTotalGiB: number | null
  netTxMbps: number | null
  netRxMbps: number | null
}

function buildResourceSummary(rows: WorkbenchClusterRow[]): WorkbenchResourceSummary {
  const running = rows.filter((row) => row.status === 0)
  let memoryUsedGiB = 0
  let memoryTotalGiB = 0
  let memoryHas = false
  let diskUsedGiB = 0
  let diskTotalGiB = 0
  let diskHas = false

  for (const row of running) {
    if (row.memoryTotal !== null && row.memoryPercent !== null) {
      const totalGiB = row.memoryTotal / 1024 ** 3
      memoryUsedGiB += (totalGiB * row.memoryPercent) / 100
      memoryTotalGiB += totalGiB
      memoryHas = true
    }
    if (row.diskAvail !== null && row.diskPercent !== null && row.diskPercent < 100) {
      const totalBytes = row.diskAvail / (1 - row.diskPercent / 100)
      const usedBytes = totalBytes - row.diskAvail
      diskUsedGiB += usedBytes / 1024 ** 3
      diskTotalGiB += totalBytes / 1024 ** 3
      diskHas = true
    }
  }

  const netTx = sumNullable(running.map((row) => row.netTx))
  const netRx = sumNullable(running.map((row) => row.netRx))

  return {
    cpuAvg: averagePercent(running.map((row) => row.cpuPercent)),
    cpuTotalCores: sumNullable(running.map((row) => row.cpuTotal)),
    memAvg: averagePercent(running.map((row) => row.memoryPercent)),
    memoryUsedGiB: memoryHas ? memoryUsedGiB : null,
    memoryTotalGiB: memoryHas ? memoryTotalGiB : null,
    diskAvg: averagePercent(running.map((row) => row.diskPercent)),
    diskUsedGiB: diskHas ? diskUsedGiB : null,
    diskTotalGiB: diskHas ? diskTotalGiB : null,
    netTxMbps: netTx === null ? null : netTx / (1024 * 1024),
    netRxMbps: netRx === null ? null : netRx / (1024 * 1024)
  }
}

export type WorkbenchSummaryDeltas = {
  totalClusters: number
  nodeTotal: number
  runningPods: number
  activeAlerts: number
}

type WorkbenchMetricSnapshot = {
  totalClusters: number
  nodeTotal: number
  runningPods: number
  activeAlerts: number
}

const WORKBENCH_METRIC_SNAPSHOT_KEY = 'pixiu:workbench:metric-snapshots'
const SNAPSHOT_RETENTION_DAYS = 14

function workbenchDateKey(offsetDays = 0): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + offsetDays)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function loadWorkbenchMetricSnapshots(): Record<string, WorkbenchMetricSnapshot> {
  try {
    const raw = localStorage.getItem(WORKBENCH_METRIC_SNAPSHOT_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, WorkbenchMetricSnapshot>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveWorkbenchMetricSnapshot(snapshot: WorkbenchMetricSnapshot): void {
  const snapshots = loadWorkbenchMetricSnapshots()
  snapshots[workbenchDateKey()] = snapshot
  const keepFrom = workbenchDateKey(-SNAPSHOT_RETENTION_DAYS)
  for (const key of Object.keys(snapshots)) {
    if (key < keepFrom) delete snapshots[key]
  }
  localStorage.setItem(WORKBENCH_METRIC_SNAPSHOT_KEY, JSON.stringify(snapshots))
}

function buildSummaryDeltas(
  current: WorkbenchMetricSnapshot,
  previous?: WorkbenchMetricSnapshot
): WorkbenchSummaryDeltas {
  if (!previous) {
    return {
      totalClusters: 0,
      nodeTotal: 0,
      runningPods: 0,
      activeAlerts: 0
    }
  }
  return {
    totalClusters: current.totalClusters - previous.totalClusters,
    nodeTotal: current.nodeTotal - previous.nodeTotal,
    runningPods: current.runningPods - previous.runningPods,
    activeAlerts: current.activeAlerts - previous.activeAlerts
  }
}

export function formatDayOverDayDelta(delta: number): string {
  if (delta > 0) return `+${delta}`
  if (delta < 0) return String(delta)
  return '+0'
}

export function dayOverDayTrendClass(delta: number): 'is-success' | 'is-danger' {
  return delta < 0 ? 'is-danger' : 'is-success'
}

export function useWorkbenchPage() {
  const loading = ref(false)
  const enriching = ref(false)
  const trendLoading = ref(false)
  const trendRangeDays = ref<7 | 30>(7)
  const clusterRows = ref<WorkbenchClusterRow[]>([])
  const cpuTrendLabels = ref<string[]>([])
  const cpuTrendValues = ref<number[]>([])
  const memoryTrendLabels = ref<string[]>([])
  const memoryTrendValues = ref<number[]>([])
  const networkTrendLabels = ref<string[]>([])
  const networkTrendValues = ref<number[]>([])
  const networkTxTrendValues = ref<number[]>([])
  const networkRxTrendValues = ref<number[]>([])
  const diskTrendLabels = ref<string[]>([])
  const diskTrendValues = ref<number[]>([])
  const lastUpdatedAt = ref<number | null>(null)
  const datasourceItems = ref<DatasourceItem[]>([])
  const datasourceLoading = ref(false)
  const summaryDeltas = ref<WorkbenchSummaryDeltas>({
    totalClusters: 0,
    nodeTotal: 0,
    runningPods: 0,
    activeAlerts: 0
  })

  const datasourceRingData = computed(() => {
    const counts = new Map<string, number>()
    for (const item of datasourceItems.value) {
      const label = DatasourceSubTypeMap[item.subType as DatasourceSubType] ?? item.subType
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  })

  const resourceSummary = computed(() => buildResourceSummary(clusterRows.value))

  const summary = computed(() => {
    const rows = clusterRows.value
    const totalClusters = rows.length
    const healthyClusters = rows.filter((row) => row.status === 0 && row.nodeNotReady === 0).length
    const abnormalClusters = totalClusters - healthyClusters
    const nodeReady = rows.reduce((sum, row) => sum + row.nodeReady, 0)
    const nodeNotReady = rows.reduce((sum, row) => sum + row.nodeNotReady, 0)
    const runningPods = rows.reduce((sum, row) => sum + (row.podCount ?? 0), 0)
    const cpuAvg = averagePercent(rows.map((row) => row.cpuPercent))
    const memAvg = averagePercent(rows.map((row) => row.memoryPercent))
    const diskAvg = averagePercent(rows.map((row) => row.diskPercent))
    const activeAlerts = rows.reduce((sum, row) => sum + row.alertCount, 0)
    const highAlerts = rows.filter(
      (row) =>
        row.status === 3 ||
        row.status === 4 ||
        row.nodeNotReady > 0 ||
        (row.cpuPercent ?? 0) >= 85 ||
        (row.memoryPercent ?? 0) >= 85
    ).length
    const warnAlerts = Math.max(0, activeAlerts - highAlerts)
    return {
      totalClusters,
      healthyClusters,
      abnormalClusters,
      nodeReady,
      nodeNotReady,
      nodeTotal: nodeReady + nodeNotReady,
      runningPods,
      cpuAvg,
      memAvg,
      diskAvg,
      activeAlerts,
      highAlerts,
      warnAlerts,
      deltas: summaryDeltas.value
    }
  })

  function syncSummaryDeltas(rows: WorkbenchClusterRow[]) {
    const nodeReady = rows.reduce((sum, row) => sum + row.nodeReady, 0)
    const nodeNotReady = rows.reduce((sum, row) => sum + row.nodeNotReady, 0)
    const current: WorkbenchMetricSnapshot = {
      totalClusters: rows.length,
      nodeTotal: nodeReady + nodeNotReady,
      runningPods: rows.reduce((sum, row) => sum + (row.podCount ?? 0), 0),
      activeAlerts: rows.reduce((sum, row) => sum + row.alertCount, 0)
    }
    const snapshots = loadWorkbenchMetricSnapshots()
    summaryDeltas.value = buildSummaryDeltas(current, snapshots[workbenchDateKey(-1)])
    saveWorkbenchMetricSnapshot(current)
  }

  watch(clusterRows, (rows) => syncSummaryDeltas(rows), { deep: true })

  const riskRows = computed<WorkbenchRiskRow[]>(() => {
    const rows: WorkbenchRiskRow[] = []
    for (const cluster of clusterRows.value) {
      if (cluster.status === 3 || cluster.status === 4) {
        rows.push({
          key: `${cluster.name}-status`,
          name: cluster.displayName,
          reason: `集群${cluster.statusText}`,
          action: '检查 Agent / 部署状态',
          tone: 'danger'
        })
      } else if (cluster.nodeNotReady > 0) {
        rows.push({
          key: `${cluster.name}-node`,
          name: cluster.displayName,
          reason: `${cluster.nodeNotReady} 节点 NotReady`,
          action: '查看节点详情',
          tone: 'danger'
        })
      } else if ((cluster.cpuPercent ?? 0) >= 85 || (cluster.memoryPercent ?? 0) >= 85) {
        rows.push({
          key: `${cluster.name}-resource`,
          name: cluster.displayName,
          reason: `CPU ${cluster.cpuPercent?.toFixed(0) ?? '-'}% / 内存 ${cluster.memoryPercent?.toFixed(0) ?? '-'}%`,
          action: '查看 Namespace 热点',
          tone: 'warning'
        })
      } else if (cluster.status === 0 && !cluster.hasPrometheus) {
        rows.push({
          key: `${cluster.name}-prom`,
          name: cluster.displayName,
          reason: 'Prometheus 未关联',
          action: '补齐监控数据源',
          tone: 'info'
        })
      }
    }
    return rows.slice(0, 6)
  })

  const alertFeed = computed<WorkbenchActivityItem[]>(() =>
    riskRows.value
      .filter((row) => row.tone !== 'info')
      .slice(0, 5)
      .map((row) => ({
        key: row.key,
        level: row.tone,
        text: `[${row.tone === 'danger' ? '高危' : '警告'}] ${row.name} · ${row.reason}`
      }))
  )

  const eventFeed = computed<WorkbenchActivityItem[]>(() => {
    const items: WorkbenchActivityItem[] = []
    for (const cluster of clusterRows.value) {
      if (cluster.nodeNotReady > 0) {
        items.push({
          key: `${cluster.name}-event-node`,
          level: 'warning',
          text: `${cluster.displayName} · ${cluster.nodeNotReady} 个节点 NotReady`
        })
      }
      if (cluster.status !== 0) {
        items.push({
          key: `${cluster.name}-event-status`,
          level: cluster.status === 3 || cluster.status === 4 ? 'danger' : 'info',
          text: `${cluster.displayName} · 状态 ${cluster.statusText}`
        })
      }
    }
    return items.slice(0, 6)
  })

  function clearTrendData() {
    cpuTrendLabels.value = []
    cpuTrendValues.value = []
    memoryTrendLabels.value = []
    memoryTrendValues.value = []
    networkTrendLabels.value = []
    networkTrendValues.value = []
    networkTxTrendValues.value = []
    networkRxTrendValues.value = []
    diskTrendLabels.value = []
    diskTrendValues.value = []
  }

  async function loadTrends(runningRows: WorkbenchClusterRow[], days = trendRangeDays.value) {
    const targets = runningRows.filter((row) => row.hasPrometheus).slice(0, 6)
    if (!targets.length) {
      clearTrendData()
      return
    }

    trendLoading.value = true
    const trendMap: TrendMap = {}
    try {
      await mapPool(targets, 2, async (row) => {
        const datasource = await loadPrometheusDatasource(row.name)
        if (!datasource) return
        try {
          const end = Math.floor(Date.now() / 1000)
          const start = end - days * 24 * 3600
          const step = Math.max(3600, Math.ceil((end - start) / 168))
          const cachedCpuMemDisk = days === 7 ? enrichTrendCache[row.name] : undefined
          if (cachedCpuMemDisk) {
            trendMap[row.name] = { ...cachedCpuMemDisk }
          }

          const panelIds = cachedCpuMemDisk
            ? [...NETWORK_TREND_PANEL_IDS]
            : [...CPU_MEM_DISK_TREND_PANEL_IDS, ...NETWORK_TREND_PANEL_IDS]

          const response = await fetchDashboardQuery(datasource, {
            panelIds: [...panelIds],
            start,
            end,
            step,
            filters: {}
          })
          const fetched = Object.fromEntries(response.results.map((item) => [item.id, item]))
          trendMap[row.name] = { ...trendMap[row.name], ...fetched }
        } catch {
          /* 单集群趋势失败不影响整体 */
        }
      })

      const cpu = mergeTrendSeries(targets, 'cluster.cpu_usage_trend', trendMap)
      const mem = mergeTrendSeries(targets, 'cluster.memory_usage_trend', trendMap)
      const disk = mergeTrendSeries(targets, 'cluster.disk_usage_trend', trendMap)
      const net = mergeTrendSeriesSum(targets, 'network.bandwidth_trend', trendMap)
      const netTx = mergeTrendSeriesSum(targets, 'network.transmit_rate_mb_trend', trendMap)
      const netRx = mergeTrendSeriesSum(targets, 'network.receive_rate_mb_trend', trendMap)
      cpuTrendLabels.value = cpu.labels
      cpuTrendValues.value = cpu.values
      memoryTrendLabels.value = mem.labels
      memoryTrendValues.value = mem.values
      diskTrendLabels.value = disk.labels
      diskTrendValues.value = disk.values
      networkTrendLabels.value = net.labels
      networkTrendValues.value = net.values
      networkTxTrendValues.value = netTx.values
      networkRxTrendValues.value = netRx.values
    } finally {
      trendLoading.value = false
    }
  }

  async function setTrendRange(days: 7 | 30) {
    if (trendRangeDays.value === days) return
    trendRangeDays.value = days
    await loadTrends(clusterRows.value.filter((row) => row.status === 0))
  }

  async function loadDatasources() {
    datasourceLoading.value = true
    try {
      const { items } = await fetchDatasourceList({ page: 1, limit: 500 })
      datasourceItems.value = items
    } catch {
      datasourceItems.value = []
    } finally {
      datasourceLoading.value = false
    }
  }

  async function enrichClusterRowsInBackground(items: ClusterItem[]) {
    enriching.value = true
    try {
      await mapPool(items, 3, async (cluster) => {
        const enriched = await enrichCluster(cluster)
        const idx = clusterRows.value.findIndex((row) => row.id === cluster.id)
        if (idx >= 0) {
          clusterRows.value[idx] = enriched
        }
      })
      clusterRows.value = [...clusterRows.value].sort((a, b) => b.pressureScore - a.pressureScore)
      lastUpdatedAt.value = Date.now()
      void loadTrends(clusterRows.value.filter((row) => row.status === 0))
    } finally {
      enriching.value = false
    }
  }

  async function load() {
    loading.value = true
    podFallbackCache.clear()
    clearEnrichTrendCache()
    let items: ClusterItem[] = []
    try {
      const { items: list } = await fetchClusterList({ page: 1, limit: 500 })
      items = list
      clusterRows.value = list.map(buildBaseClusterRow).sort((a, b) => b.pressureScore - a.pressureScore)
    } catch (e: unknown) {
      notifyError(e, '加载工作台数据失败')
      clusterRows.value = []
      clearTrendData()
      lastUpdatedAt.value = null
      items = []
    } finally {
      loading.value = false
    }

    if (items.length) {
      void enrichClusterRowsInBackground(items)
    } else {
      clearTrendData()
    }

    void loadDatasources()
  }

  return {
    loading,
    enriching,
    trendLoading,
    datasourceLoading,
    datasourceRingData,
    trendRangeDays,
    clusterRows,
    resourceSummary,
    summary,
    riskRows,
    alertFeed,
    eventFeed,
    cpuTrendLabels,
    cpuTrendValues,
    memoryTrendLabels,
    memoryTrendValues,
    networkTrendLabels,
    networkTrendValues,
    networkTxTrendValues,
    networkRxTrendValues,
    diskTrendLabels,
    diskTrendValues,
    lastUpdatedAt,
    load,
    setTrendRange
  }
}

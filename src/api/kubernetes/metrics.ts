import { kubeProxyAxios } from '@/api/kubeProxy'

export type DashboardMetricPoint = { timestamp: string; value: number }

export type DashboardNodeMetricsResponse = {
  items?: Array<{ metricPoints?: DashboardMetricPoint[] }>
}

/** 与 dashboard getNodeUsageMetrics 路径一致 */
export async function fetchNodeUsageMetrics(
  cluster: string,
  nodeName: string,
  metricsName: 'cpu' | 'memory',
  subPath: 'usage' | 'usage_rate'
): Promise<DashboardNodeMetricsResponse> {
  return fetchNodesUsageMetrics(cluster, [nodeName], metricsName, subPath)
}

/** 多节点逗号拼接，与 dashboard-metrics-scraper 一致 */
export async function fetchNodesUsageMetrics(
  cluster: string,
  nodeNames: string[],
  metricsName: 'cpu' | 'memory',
  subPath: 'usage' | 'usage_rate'
): Promise<DashboardNodeMetricsResponse> {
  if (!nodeNames.length) return { items: [] }
  const names = nodeNames.map((n) => encodeURIComponent(n)).join(',')
  const { data } = await kubeProxyAxios.get<DashboardNodeMetricsResponse>(
    `/pixiu/proxy/${encodeURIComponent(cluster)}/apis/metrics.pixiu.io/v1beta1/api/v1/dashboard/nodes/${names}/metrics/${metricsName}/${subPath}`
  )
  return data
}

/** 节点 capacity/allocatable 内存转字节 */
export function parseNodeMemoryBytes(memStr: string | undefined): number {
  const s = String(memStr ?? '').trim()
  if (!s || s === '-') return 0
  const ki = s.match(/^(\d+(?:\.\d+)?)Ki$/i)
  if (ki) return Math.round(parseFloat(ki[1]) * 1024)
  const mi = s.match(/^(\d+(?:\.\d+)?)Mi$/i)
  if (mi) return Math.round(parseFloat(mi[1]) * 1024 ** 2)
  const gi = s.match(/^(\d+(?:\.\d+)?)Gi$/i)
  if (gi) return Math.round(parseFloat(gi[1]) * 1024 ** 3)
  const ti = s.match(/^(\d+(?:\.\d+)?)Ti$/i)
  if (ti) return Math.round(parseFloat(ti[1]) * 1024 ** 4)
  const n = parseInt(s.replace(/[^0-9]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

const BYTES_PER_GIB = 1024 ** 3

/** 字节转 GiB（保留 2 位小数） */
export function bytesToGib(bytes: number): number {
  return +(bytes / BYTES_PER_GIB).toFixed(2)
}

/** 节点 capacity/allocatable CPU 转毫核 */
export function parseNodeCpuMillicores(cpuStr: string | undefined): number {
  const s = String(cpuStr ?? '').trim()
  if (!s || s === '-') return 0
  if (s.endsWith('m')) return parseInt(s, 10) || 0
  const n = parseFloat(s)
  return Number.isFinite(n) ? Math.round(n * 1000) : 0
}

/** 按时间戳汇总多节点 metricPoints（value 同单位相加） */
export function aggregateDashboardMetricPoints(
  items: Array<{ metricPoints?: DashboardMetricPoint[] }> | undefined
): { labels: string[]; values: number[] } {
  const byTime = new Map<number, number>()
  for (const item of items ?? []) {
    for (const p of item.metricPoints ?? []) {
      const t = new Date(p.timestamp).getTime()
      if (!Number.isFinite(t)) continue
      byTime.set(t, (byTime.get(t) ?? 0) + Number(p.value))
    }
  }
  const sorted = [...byTime.entries()].sort((a, b) => a[0] - b[0])
  return {
    labels: sorted.map(([t]) => formatMetricTimeLabel(new Date(t))),
    values: sorted.map(([, v]) => v)
  }
}

function formatMetricTimeLabel(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

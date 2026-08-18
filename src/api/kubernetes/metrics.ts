/** 节点/Pod 资源规格解析纯函数（指标数据源已统一为 Prometheus） */

type PodContainerResources = {
  resources?: {
    requests?: { cpu?: string; memory?: string }
    limits?: { cpu?: string; memory?: string }
  }
}

export type MetricsPodSpec = {
  metadata?: { name?: string }
  spec?: { containers?: PodContainerResources[] }
}

/** Pod 容器 requests/limits 汇总 CPU 毫核（limits 优先，其次 requests） */
export function getPodCpuQuotaMillicores(pod: MetricsPodSpec): number {
  let total = 0
  for (const c of pod.spec?.containers ?? []) {
    const cpu = c.resources?.limits?.cpu ?? c.resources?.requests?.cpu
    if (cpu) total += parseNodeCpuMillicores(cpu)
  }
  return total
}

/** Pod 容器 requests 汇总 CPU 毫核（仅 requests，不含 limits/initContainers） */
export function getPodCpuRequestMillicores(pod: MetricsPodSpec): number {
  let total = 0
  for (const c of pod.spec?.containers ?? []) {
    const cpu = c.resources?.requests?.cpu
    if (cpu) total += parseNodeCpuMillicores(cpu)
  }
  return total
}

/** Pod 容器 requests/limits 汇总内存字节 */
export function getPodMemoryQuotaBytes(pod: MetricsPodSpec): number {
  let total = 0
  for (const c of pod.spec?.containers ?? []) {
    const mem = c.resources?.limits?.memory ?? c.resources?.requests?.memory
    if (mem) total += parseNodeMemoryBytes(mem)
  }
  return total
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

import type {
  DashboardDefinition,
  DashboardFilters,
  DashboardPanelDefinition
} from '@/api/dashboard'

export interface DashboardPanelSpec extends DashboardPanelDefinition {
  rangeQuery: boolean
  query?: (filters: DashboardFilters) => string
}

type FilterLabel = 'namespace' | 'node' | 'pod'

function panel(
  section: string,
  id: string,
  title: string,
  kind: DashboardPanelDefinition['kind'],
  unit: string,
  span: number,
  requiredMetrics: string[],
  rangeQuery: boolean,
  query?: (filters: DashboardFilters) => string,
  description?: string
): DashboardPanelSpec {
  return {
    id,
    section,
    title,
    kind,
    unit,
    span,
    required_metrics: requiredMetrics,
    rangeQuery,
    query,
    description
  }
}

function unavailablePanel(
  section: string,
  id: string,
  title: string,
  unit: string,
  span: number,
  ...requiredMetrics: string[]
): DashboardPanelSpec {
  return panel(section, id, title, 'empty', unit, span, requiredMetrics, false)
}

function fixed(expression: string): (filters: DashboardFilters) => string {
  return () => expression
}

function promqlQuote(value: string): string {
  return JSON.stringify(value.trim())
}

function matcher(filters: DashboardFilters, supported: FilterLabel[]): string {
  const values: Record<FilterLabel, string | undefined> = {
    namespace: filters.namespace,
    node: filters.node,
    pod: filters.pod
  }
  return (['namespace', 'node', 'pod'] as FilterLabel[])
    .filter((label) => supported.includes(label) && values[label]?.trim())
    .map((label) => `${label}=${promqlQuote(values[label] ?? '')}`)
    .join(',')
}

function selector(
  metric: string,
  filters: DashboardFilters,
  supported: FilterLabel[],
  ...extra: string[]
): string {
  const filtersPart = matcher(filters, supported)
  const parts = [...(filtersPart ? [filtersPart] : []), ...extra]
  return parts.length ? `${metric}{${parts.join(',')}}` : metric
}

function workloadJoin(expression: string, filters: DashboardFilters): string {
  const workloadName = filters.workload_name?.trim()
  if (!workloadName) return expression

  const workloadKind = filters.workload_kind?.trim() ?? ''
  if (workloadKind.toLowerCase() === 'deployment') {
    const replicaSetOwners =
      `max by(namespace,replicaset) (` +
      `kube_replicaset_owner{owner_kind="Deployment",owner_name=${promqlQuote(workloadName)}})`
    const podReplicaSets =
      'max by(namespace,pod,replicaset) (' +
      'label_replace(kube_pod_owner{owner_kind="ReplicaSet"}, "replicaset", "$1", "owner_name", "(.*)"))'
    return (
      `(${expression}) * on(namespace,pod) group_left(replicaset) (${podReplicaSets}) ` +
      `* on(namespace,replicaset) group_left() (${replicaSetOwners})`
    )
  }

  const owner = [`owner_name=${promqlQuote(workloadName)}`]
  if (workloadKind) owner.push(`owner_kind=${promqlQuote(workloadKind)}`)
  return (
    `(${expression}) * on(namespace,pod) group_left(owner_kind,owner_name) ` +
    `max by(namespace,pod,owner_kind,owner_name) (kube_pod_owner{${owner.join(',')}})`
  )
}

function containerExpr(metric: string, filters: DashboardFilters, useRate: boolean): string {
  let expression = selector(
    metric,
    filters,
    ['namespace', 'node', 'pod'],
    'container!=""',
    'image!=""'
  )
  if (useRate) expression = `rate(${expression}[5m])`
  return workloadJoin(expression, filters)
}

/** 转义 PromQL 正则 label matcher 值中的正则元字符 */
function escapePromQLRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * node_exporter 指标按节点匹配：node_* 的 instance 通常为 <node>:<port>，
 * 以 instance=~"<node>:.*" 前缀匹配（需转义节点名中的正则元字符）。
 */
function nodeInstanceSelector(
  metric: string,
  filters: DashboardFilters,
  ...extra: string[]
): string {
  const parts: string[] = []
  const node = filters.node?.trim()
  if (node) parts.push(`instance=~"${escapePromQLRegex(node)}:.*"`)
  parts.push(...extra)
  return parts.length ? `${metric}{${parts.join(',')}}` : metric
}

/** cAdvisor 容器指标按节点精确匹配（container_* 带 node label） */
function nodeContainerExpr(metric: string, filters: DashboardFilters, useRate: boolean): string {
  const parts: string[] = ['container!=""', 'image!=""']
  const node = filters.node?.trim()
  if (node) parts.unshift(`node=${promqlQuote(node)}`)
  let expression = `${metric}{${parts.join(',')}}`
  if (useRate) expression = `rate(${expression}[5m])`
  return expression
}

/** 逗号分隔 pod 名列表 → pod=~"a|b" 正则 matcher（对名称中的正则元字符做转义） */
function podFilterPattern(filters: DashboardFilters): string {
  const names = (filters.pod?.split(',') ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => escapePromQLRegex(name))
  return names.join('|')
}

/** 集群聚合的容器指标表达式，按 namespace + pod 正则过滤（供 workload 多 Pod 折线复用） */
function podAggregateExpr(metric: string, filters: DashboardFilters, useRate: boolean): string {
  const parts: string[] = ['container!=""', 'image!=""']
  const namespace = filters.namespace?.trim()
  if (namespace) parts.push(`namespace=${promqlQuote(namespace)}`)
  const pattern = podFilterPattern(filters)
  if (pattern) parts.push(`pod=~"${pattern}"`)
  let expression = `${metric}{${parts.join(',')}}`
  if (useRate) expression = `rate(${expression}[5m])`
  return expression
}

function clusterCPUUsage(filters: DashboardFilters): string {
  return (
    `100 * sum(${containerExpr('container_cpu_usage_seconds_total', filters, true)}) / ` +
    `sum(${selector('kube_node_status_allocatable', filters, ['node'], 'resource="cpu"')})`
  )
}

function clusterCPURequests(filters: DashboardFilters): string {
  return (
    `100 * sum(${selector('kube_pod_container_resource_requests', filters, ['namespace', 'node', 'pod'], 'resource="cpu"')}) / ` +
    `sum(${selector('kube_node_status_allocatable', filters, ['node'], 'resource="cpu"')})`
  )
}

function clusterMemoryUsage(filters: DashboardFilters): string {
  return (
    `100 * sum(${containerExpr('container_memory_working_set_bytes', filters, false)}) / ` +
    `sum(${selector('kube_node_status_allocatable', filters, ['node'], 'resource="memory"')})`
  )
}

function namespacePods(filters: DashboardFilters): string {
  return `sort_desc(sum by (namespace) (${selector('kube_pod_info', filters, ['namespace', 'node', 'pod'])}))`
}

function namespaceCPU(filters: DashboardFilters): string {
  return `topk(10, sum by (namespace) (${containerExpr('container_cpu_usage_seconds_total', filters, true)}))`
}

function namespaceMemory(filters: DashboardFilters): string {
  return `topk(10, sum by (namespace) (${containerExpr('container_memory_working_set_bytes', filters, false)}))`
}

function namespaceRestarts(filters: DashboardFilters): string {
  return `topk(10, sum by (namespace) (${selector('kube_pod_container_status_restarts_total', filters, ['namespace', 'pod'])}))`
}

function nodeReady(filters: DashboardFilters): string {
  return selector(
    'kube_node_status_condition',
    filters,
    ['node'],
    'condition="Ready"',
    'status="true"'
  )
}

function nodePods(filters: DashboardFilters): string {
  return `sort_desc(sum by (node) (${selector('kube_pod_info', filters, ['namespace', 'node', 'pod'])}))`
}

function nodeCPU(filters: DashboardFilters): string {
  return (
    `100 * sum by (node) (${containerExpr('container_cpu_usage_seconds_total', filters, true)}) / ` +
    `sum by (node) (${selector('kube_node_status_allocatable', filters, ['node'], 'resource="cpu"')})`
  )
}

function nodeMemory(filters: DashboardFilters): string {
  return (
    `100 * sum by (node) (${containerExpr('container_memory_working_set_bytes', filters, false)}) / ` +
    `sum by (node) (${selector('kube_node_status_allocatable', filters, ['node'], 'resource="memory"')})`
  )
}

function podCPU(filters: DashboardFilters): string {
  return `topk(10, sum by (namespace,pod) (${containerExpr('container_cpu_usage_seconds_total', filters, true)}))`
}

function podMemory(filters: DashboardFilters): string {
  return `topk(10, sum by (namespace,pod) (${containerExpr('container_memory_working_set_bytes', filters, false)}))`
}

function podResourceLimits(filters: DashboardFilters, resource: string, unit: string): string {
  const expression = selector(
    'kube_pod_container_resource_limits',
    filters,
    ['namespace', 'node', 'pod'],
    `resource=${promqlQuote(resource)}`,
    `unit=${promqlQuote(unit)}`
  )
  return workloadJoin(expression, filters)
}

function podCPUTrend(filters: DashboardFilters): string {
  const usage = `sum by (namespace,pod) (${containerExpr('container_cpu_usage_seconds_total', filters, true)})`
  const limits = `sum by (namespace,pod) (${podResourceLimits(filters, 'cpu', 'core')})`
  return `100 * ${usage} / clamp_min(${limits}, 0.001)`
}

function podMemoryTrend(filters: DashboardFilters): string {
  const usage = `sum by (namespace,pod) (${containerExpr('container_memory_working_set_bytes', filters, false)})`
  const limits = `sum by (namespace,pod) (${podResourceLimits(filters, 'memory', 'byte')})`
  return `100 * ${usage} / clamp_min(${limits}, 1)`
}

function podRestarts(filters: DashboardFilters): string {
  return `topk(10, sum by (namespace,pod) (${selector('kube_pod_container_status_restarts_total', filters, ['namespace', 'pod'])}))`
}

function podPhase(filters: DashboardFilters): string {
  return `${selector('kube_pod_status_phase', filters, ['namespace', 'pod'])} == 1`
}

function availability(
  availableMetric: string,
  desiredMetric: string,
  filters: DashboardFilters
): string {
  const filtersPart = matcher(filters, ['namespace'])
  return `100 * ${availableMetric}{${filtersPart}} / clamp_min(${desiredMetric}{${filtersPart}}, 1)`
}

function networkReceive(filters: DashboardFilters): string {
  return `topk(10, sum by (namespace,pod) (${containerExpr('container_network_receive_bytes_total', filters, true)}))`
}

function networkTransmit(filters: DashboardFilters): string {
  return `topk(10, sum by (namespace,pod) (${containerExpr('container_network_transmit_bytes_total', filters, true)}))`
}

function networkReceiveTrend(filters: DashboardFilters): string {
  return `sum by (namespace,pod) (${containerExpr('container_network_receive_bytes_total', filters, true)})`
}

function networkTransmitTrend(filters: DashboardFilters): string {
  return `sum by (namespace,pod) (${containerExpr('container_network_transmit_bytes_total', filters, true)})`
}

function pvcPhase(filters: DashboardFilters): string {
  return `${selector('kube_persistentvolumeclaim_status_phase', filters, ['namespace'])} == 1`
}

function containerFS(filters: DashboardFilters): string {
  return `topk(10, sum by (namespace,pod) (${containerExpr('container_fs_usage_bytes', filters, false)}))`
}

const sections: DashboardDefinition['sections'] = [
  {
    id: 'overview',
    title: '监控概览',
    icon: 'ri:dashboard-line',
    children: ['cluster', 'namespace']
  },
  {
    id: 'core',
    title: '核心组件监控',
    icon: 'ri:cpu-line',
    children: ['kubelet', 'control-plane']
  },
  {
    id: 'node',
    title: '节点监控',
    icon: 'ri:server-line',
    children: ['node-resource', 'node-pod']
  },
  {
    id: 'application',
    title: '应用监控',
    icon: 'ri:apps-line',
    children: ['workload', 'pod']
  },
  { id: 'network', title: '网络监控', icon: 'ri:global-line' },
  { id: 'storage', title: '存储监控', icon: 'ri:hard-drive-2-line' },
  { id: 'gpu', title: 'GPU 监控', icon: 'ri:dashboard-3-line' }
]

const panelSpecs: DashboardPanelSpec[] = [
  panel(
    'cluster',
    'cluster.nodes',
    '节点数',
    'stat',
    'short',
    3,
    ['kube_node_info'],
    false,
    fixed('count(kube_node_info)')
  ),
  panel(
    'cluster',
    'cluster.ready_nodes',
    'Ready 节点',
    'stat',
    'short',
    3,
    ['kube_node_status_condition'],
    false,
    fixed('count(kube_node_status_condition{condition="Ready",status="true"} == 1)')
  ),
  panel(
    'cluster',
    'cluster.running_pods',
    '运行中 Pod',
    'stat',
    'short',
    3,
    ['kube_pod_status_phase'],
    false,
    fixed('sum(kube_pod_status_phase{phase="Running"})')
  ),
  panel(
    'cluster',
    'cluster.namespaces',
    'Namespace',
    'stat',
    'short',
    3,
    ['kube_namespace_created'],
    false,
    fixed('count(kube_namespace_created)')
  ),
  panel(
    'cluster',
    'cluster.cpu_usage',
    'CPU 使用率',
    'gauge',
    'percent',
    4,
    ['container_cpu_usage_seconds_total', 'kube_node_status_allocatable'],
    false,
    clusterCPUUsage
  ),
  panel(
    'cluster',
    'cluster.cpu_requests',
    'CPU Request 承诺率',
    'gauge',
    'percent',
    4,
    ['kube_pod_container_resource_requests', 'kube_node_status_allocatable'],
    false,
    clusterCPURequests
  ),
  panel(
    'cluster',
    'cluster.memory_usage',
    '内存使用率',
    'gauge',
    'percent',
    4,
    ['container_memory_working_set_bytes', 'kube_node_status_allocatable'],
    false,
    clusterMemoryUsage
  ),
  // 集群概览用量趋势面板（近 24h，供 overview 复用；不进入 sections 导航）
  panel(
    'cluster',
    'cluster.cpu_total_trend',
    'CPU 总配置',
    'line',
    'cores',
    4,
    [],
    true,
    () => `sum(count by (instance)(node_cpu_seconds_total{mode="idle"}))`
  ),
  panel(
    'cluster',
    'cluster.cpu_usage_trend',
    'CPU 使用率',
    'line',
    'percent',
    4,
    [],
    true,
    (filters) =>
      `100 * sum(${containerExpr('container_cpu_usage_seconds_total', filters, true)}) / sum(count by (instance)(node_cpu_seconds_total{mode="idle"}))`
  ),
  panel(
    'cluster',
    'cluster.memory_total_trend',
    '内存总量',
    'line',
    'bytes',
    4,
    [],
    true,
    () => `sum(node_memory_MemTotal_bytes)`
  ),
  panel(
    'cluster',
    'cluster.memory_usage_trend',
    '内存使用率',
    'line',
    'percent',
    4,
    [],
    true,
    (filters) =>
      `100 * sum(${containerExpr('container_memory_working_set_bytes', filters, false)}) / sum(node_memory_MemTotal_bytes)`
  ),
  panel(
    'cluster',
    'cluster.cpu_usage_cores_trend',
    'CPU 使用量',
    'line',
    'cores',
    4,
    ['container_cpu_usage_seconds_total'],
    true,
    (filters) => `sum(${containerExpr('container_cpu_usage_seconds_total', filters, true)})`
  ),
  panel(
    'cluster',
    'cluster.memory_usage_bytes_trend',
    '内存使用量',
    'line',
    'bytes',
    4,
    ['container_memory_working_set_bytes'],
    true,
    (filters) => `sum(${containerExpr('container_memory_working_set_bytes', filters, false)})`
  ),
  panel(
    'cluster',
    'cluster.memory_usage_bytes_with_cache_trend',
    '内存使用量(含Cache)',
    'line',
    'bytes',
    4,
    ['container_memory_usage_bytes'],
    true,
    (filters) => `sum(${containerExpr('container_memory_usage_bytes', filters, false)})`
  ),

  panel(
    'namespace',
    'namespace.pods',
    'Namespace Pod 数',
    'bar',
    'short',
    6,
    ['kube_pod_info'],
    false,
    namespacePods
  ),
  panel(
    'namespace',
    'namespace.cpu',
    'Namespace CPU Top 10',
    'bar',
    'cores',
    6,
    ['container_cpu_usage_seconds_total'],
    false,
    namespaceCPU
  ),
  panel(
    'namespace',
    'namespace.memory',
    'Namespace 内存 Top 10',
    'bar',
    'bytes',
    6,
    ['container_memory_working_set_bytes'],
    false,
    namespaceMemory
  ),
  panel(
    'namespace',
    'namespace.restarts',
    '容器重启 Top 10',
    'bar',
    'short',
    6,
    ['kube_pod_container_status_restarts_total'],
    false,
    namespaceRestarts
  ),

  panel(
    'kubelet',
    'kubelet.running_pods',
    '运行中 Pod',
    'stat',
    'short',
    6,
    ['kubelet_running_pods'],
    false,
    fixed('sum(kubelet_running_pods)')
  ),
  panel(
    'kubelet',
    'kubelet.running_containers',
    '运行中容器',
    'stat',
    'short',
    6,
    ['kubelet_running_containers'],
    false,
    fixed('sum(kubelet_running_containers)')
  ),
  panel(
    'kubelet',
    'kubelet.operation_rate',
    'Runtime 操作速率',
    'line',
    'ops',
    6,
    ['kubelet_runtime_operations_total'],
    true,
    fixed('sum by (operation_type) (rate(kubelet_runtime_operations_total[5m]))')
  ),
  panel(
    'kubelet',
    'kubelet.error_rate',
    'Runtime 错误速率',
    'line',
    'ops',
    6,
    ['kubelet_runtime_operations_errors_total'],
    true,
    fixed('sum by (operation_type) (rate(kubelet_runtime_operations_errors_total[5m]))'),
    'Kubelet 调用容器运行时发生错误的每秒速率，按操作类型统计。'
  ),

  unavailablePanel(
    'control-plane',
    'control.scheduler',
    'Scheduler 调度状态',
    '',
    4,
    'scheduler_schedule_attempts_total'
  ),
  unavailablePanel('control-plane', 'control.controller', 'Controller Manager', '', 4),
  unavailablePanel(
    'control-plane',
    'control.apiserver',
    'API Server 请求',
    '',
    4,
    'apiserver_request_total'
  ),

  panel(
    'node-resource',
    'node.ready',
    '节点健康状态',
    'status',
    '',
    6,
    ['kube_node_status_condition'],
    false,
    nodeReady
  ),
  panel(
    'node-resource',
    'node.pods',
    '节点 Pod 数',
    'bar',
    'short',
    6,
    ['kube_pod_info'],
    false,
    nodePods
  ),
  panel(
    'node-resource',
    'node.cpu',
    '节点 CPU 使用率',
    'bar',
    'percent',
    6,
    ['container_cpu_usage_seconds_total', 'kube_node_status_allocatable'],
    false,
    nodeCPU
  ),
  panel(
    'node-resource',
    'node.memory',
    '节点内存使用率',
    'bar',
    'percent',
    6,
    ['container_memory_working_set_bytes', 'kube_node_status_allocatable'],
    false,
    nodeMemory
  ),
  panel(
    'node-pod',
    'node.pod_cpu',
    '节点 Pod CPU Top 10',
    'bar',
    'cores',
    6,
    ['container_cpu_usage_seconds_total'],
    false,
    podCPU
  ),
  panel(
    'node-pod',
    'node.pod_memory',
    '节点 Pod 内存 Top 10',
    'bar',
    'bytes',
    6,
    ['container_memory_working_set_bytes'],
    false,
    podMemory
  ),

  // 节点详情监控趋势面板（node_exporter + cAdvisor，不依赖 kube-state-metrics；
  // 供节点详情 hook 复用，不进入 sections 导航）
  panel(
    'node',
    'node.cpu_total_trend',
    '节点 CPU 总配置',
    'line',
    'cores',
    4,
    [],
    true,
    (filters) => `count(${nodeInstanceSelector('node_cpu_seconds_total', filters, 'mode="idle"')})`
  ),
  panel(
    'node',
    'node.cpu_util_trend',
    '节点 CPU 利用率',
    'line',
    'percent',
    4,
    [],
    true,
    (filters) =>
      `100 * sum(${nodeContainerExpr('container_cpu_usage_seconds_total', filters, true)}) / sum(count(${nodeInstanceSelector('node_cpu_seconds_total', filters, 'mode="idle"')}) by (instance))`
  ),
  panel(
    'node',
    'node.cpu_usage_trend',
    '节点 CPU 使用量',
    'line',
    'cores',
    4,
    [],
    true,
    (filters) => `sum(${nodeContainerExpr('container_cpu_usage_seconds_total', filters, true)})`
  ),
  panel(
    'node',
    'node.memory_total_trend',
    '节点内存总量',
    'line',
    'bytes',
    4,
    [],
    true,
    (filters) => `sum(${nodeInstanceSelector('node_memory_MemTotal_bytes', filters)})`
  ),
  panel(
    'node',
    'node.memory_util_trend',
    '节点内存使用率',
    'line',
    'percent',
    4,
    [],
    true,
    (filters) =>
      `100 * sum(${nodeContainerExpr('container_memory_working_set_bytes', filters, false)}) / sum(${nodeInstanceSelector('node_memory_MemTotal_bytes', filters)})`
  ),
  panel(
    'node',
    'node.memory_usage_trend',
    '节点内存使用量',
    'line',
    'bytes',
    4,
    [],
    true,
    (filters) => `sum(${nodeContainerExpr('container_memory_working_set_bytes', filters, false)})`
  ),

  panel(
    'workload',
    'workload.deployments',
    'Deployment 可用率',
    'bar',
    'percent',
    4,
    ['kube_deployment_status_replicas_available', 'kube_deployment_spec_replicas'],
    false,
    (filters) =>
      availability(
        'kube_deployment_status_replicas_available',
        'kube_deployment_spec_replicas',
        filters
      )
  ),
  panel(
    'workload',
    'workload.statefulsets',
    'StatefulSet Ready',
    'bar',
    'percent',
    4,
    ['kube_statefulset_status_replicas_ready', 'kube_statefulset_replicas'],
    false,
    (filters) =>
      availability('kube_statefulset_status_replicas_ready', 'kube_statefulset_replicas', filters)
  ),
  panel(
    'workload',
    'workload.daemonsets',
    'DaemonSet Ready',
    'bar',
    'percent',
    4,
    ['kube_daemonset_status_number_ready', 'kube_daemonset_status_desired_number_scheduled'],
    false,
    (filters) =>
      availability(
        'kube_daemonset_status_number_ready',
        'kube_daemonset_status_desired_number_scheduled',
        filters
      )
  ),

  panel(
    'pod',
    'pod.cpu_trend',
    'Pod CPU 使用率',
    'line',
    'percent',
    6,
    ['container_cpu_usage_seconds_total', 'kube_pod_container_resource_limits'],
    true,
    podCPUTrend,
    '当前 CPU 用量占 Pod 容器 CPU limits 的百分比；未配置 CPU limits 的 Pod 不显示。'
  ),
  panel(
    'pod',
    'pod.memory_trend',
    'Pod 内存使用率',
    'line',
    'percent',
    6,
    ['container_memory_working_set_bytes', 'kube_pod_container_resource_limits'],
    true,
    podMemoryTrend,
    '当前内存工作集占 Pod 容器内存 limits 的百分比；未配置内存 limits 的 Pod 不显示。'
  ),
  panel(
    'pod',
    'pod.restarts',
    'Pod 重启次数',
    'bar',
    'short',
    6,
    ['kube_pod_container_status_restarts_total'],
    false,
    podRestarts
  ),
  panel(
    'pod',
    'pod.phase',
    'Pod 状态',
    'status',
    '',
    6,
    ['kube_pod_status_phase'],
    false,
    podPhase
  ),

  // 集群聚合 Pod 用量趋势面板（供 workload 详情多 Pod 折线复用；不进入 sections 导航）
  panel(
    'pod',
    'pod.cpu_usage_trend',
    'Pod CPU 使用量',
    'line',
    'cores',
    6,
    [],
    true,
    (filters) =>
      `sum by (namespace,pod) (${podAggregateExpr('container_cpu_usage_seconds_total', filters, true)})`
  ),
  panel(
    'pod',
    'pod.memory_usage_trend',
    'Pod 内存使用量',
    'line',
    'bytes',
    6,
    [],
    true,
    (filters) =>
      `sum by (namespace,pod) (${podAggregateExpr('container_memory_working_set_bytes', filters, false)})`
  ),

  panel(
    'network',
    'network.receive',
    'Pod 网络流入 Top 10',
    'bar',
    'Bps',
    6,
    ['container_network_receive_bytes_total'],
    false,
    networkReceive
  ),
  panel(
    'network',
    'network.transmit',
    'Pod 网络流出 Top 10',
    'bar',
    'Bps',
    6,
    ['container_network_transmit_bytes_total'],
    false,
    networkTransmit
  ),
  panel(
    'network',
    'network.receive_trend',
    '网络流入趋势',
    'line',
    'Bps',
    6,
    ['container_network_receive_bytes_total'],
    true,
    networkReceiveTrend
  ),
  panel(
    'network',
    'network.transmit_trend',
    '网络流出趋势',
    'line',
    'Bps',
    6,
    ['container_network_transmit_bytes_total'],
    true,
    networkTransmitTrend
  ),
  panel(
    'network',
    'network.transmit_rate_mb_trend',
    '网络出流量',
    'line',
    'MBytes',
    4,
    [],
    true,
    () => `sum(rate(container_network_transmit_bytes_total[5m])) / 1024 / 1024`
  ),
  panel(
    'network',
    'network.receive_rate_mb_trend',
    '网络入流量',
    'line',
    'MBytes',
    4,
    [],
    true,
    () => `sum(rate(container_network_receive_bytes_total[5m])) / 1024 / 1024`
  ),
  panel(
    'network',
    'network.bandwidth_trend',
    '网络带宽',
    'line',
    'Mbps',
    4,
    [],
    true,
    () =>
      `(sum(rate(container_network_transmit_bytes_total[5m])) + sum(rate(container_network_receive_bytes_total[5m]))) * 8 / 1000 / 1000`
  ),
  panel(
    'network',
    'network.packet_rate_trend',
    '网络包容量',
    'line',
    'pps',
    4,
    [],
    true,
    () =>
      `sum(rate(container_network_transmit_packets_total[5m])) + sum(rate(container_network_receive_packets_total[5m]))`
  ),

  panel(
    'storage',
    'storage.pvc_phase',
    'PVC 状态',
    'status',
    '',
    6,
    ['kube_persistentvolumeclaim_status_phase'],
    false,
    pvcPhase
  ),
  panel(
    'storage',
    'storage.container_fs',
    '容器文件系统使用 Top 10',
    'bar',
    'bytes',
    6,
    ['container_fs_usage_bytes'],
    false,
    containerFS
  ),
  panel(
    'storage',
    'storage.disk_reads_trend',
    '块设备 读取次数',
    'line',
    'ops',
    4,
    ['node_disk_reads_completed_total'],
    true,
    fixed('sum(rate(node_disk_reads_completed_total[5m]))')
  ),
  panel(
    'storage',
    'storage.disk_write_bytes_trend',
    '块设备 写入大小',
    'line',
    'MBytes',
    4,
    ['node_disk_written_bytes_total'],
    true,
    fixed('sum(rate(node_disk_written_bytes_total[5m])) / 1024 / 1024')
  ),
  panel(
    'storage',
    'storage.disk_writes_trend',
    '块设备 写入次数',
    'line',
    'ops',
    4,
    ['node_disk_writes_completed_total'],
    true,
    fixed('sum(rate(node_disk_writes_completed_total[5m]))')
  ),
  panel(
    'storage',
    'storage.disk_read_bytes_trend',
    '块设备 读取大小',
    'line',
    'MBytes',
    4,
    ['node_disk_read_bytes_total'],
    true,
    fixed('sum(rate(node_disk_read_bytes_total[5m])) / 1024 / 1024')
  ),

  unavailablePanel('gpu', 'gpu.utilization', 'GPU 使用率', 'percent', 4, 'DCGM_FI_DEV_GPU_UTIL'),
  unavailablePanel('gpu', 'gpu.memory', 'GPU 显存使用', 'bytes', 4, 'DCGM_FI_DEV_FB_USED'),
  unavailablePanel('gpu', 'gpu.temperature', 'GPU 温度', 'celsius', 4, 'DCGM_FI_DEV_GPU_TEMP')
]

export function getDashboardDefinition(): DashboardDefinition {
  return {
    sections,
    panels: panelSpecs.map(
      ({ rangeQuery: _rangeQuery, query: _query, ...definition }) => definition
    )
  }
}

export function getDashboardPanelSpecs(ids: string[]): DashboardPanelSpec[] {
  if (!ids.length) return panelSpecs
  const byId = new Map(panelSpecs.map((spec) => [spec.id, spec]))
  const selected: DashboardPanelSpec[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) continue
    const spec = byId.get(id)
    if (!spec) throw new Error(`未知仪表盘面板：${id}`)
    seen.add(id)
    selected.push(spec)
  }
  return selected
}

export function buildDashboardPodVariableQuery(filters: DashboardFilters): string {
  const podInfo = selector('kube_pod_info', filters, ['namespace', 'node'])
  const workloadName = filters.workload_name?.trim()
  if (!workloadName) return podInfo

  const workloadKind = filters.workload_kind?.trim() ?? ''
  if (workloadKind.toLowerCase() === 'deployment') {
    const replicaSetOwners =
      `max by(namespace,replicaset) (` +
      `kube_replicaset_owner{owner_kind="Deployment",owner_name=${promqlQuote(workloadName)}})`
    const podReplicaSets =
      'max by(namespace,pod,replicaset) (' +
      'label_replace(kube_pod_owner{owner_kind="ReplicaSet"}, "replicaset", "$1", "owner_name", "(.*)"))'
    return (
      `${podInfo} * on(namespace,pod) group_left(replicaset) (${podReplicaSets}) ` +
      `* on(namespace,replicaset) group_left() (${replicaSetOwners})`
    )
  }

  const owner = [`owner_name=${promqlQuote(workloadName)}`]
  if (workloadKind) owner.push(`owner_kind=${promqlQuote(workloadKind)}`)
  return (
    `${podInfo} * on(namespace,pod) group_left(owner_kind,owner_name) ` +
    `kube_pod_owner{${owner.join(',')}}`
  )
}

export function buildDashboardVariableSelector(
  metric: string,
  label: string,
  value?: string
): string {
  return value?.trim() ? `${metric}{${label}=${promqlQuote(value)}}` : metric
}

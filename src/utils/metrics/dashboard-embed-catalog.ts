import type { DashboardFilters, DashboardPanelDefinition } from '@/api/dashboard'

interface EmbedPanelSpec extends DashboardPanelDefinition {
  rangeQuery: boolean
  query?: (filters: DashboardFilters) => string
  fallbackQuery?: (filters: DashboardFilters) => string
  fallbackQueries?: Array<(filters: DashboardFilters) => string>
  quantileQueries?: {
    metric: string
    thresholds: number[]
    unitFactor?: number
    selector?: string
    fallbackMetrics?: string[]
  }
}

/** 排除长连接/流式请求，避免全局 P99 被顶到直方图上限（常见 60s） */
const APISERVER_LATENCY_SELECTOR = 'verb!~"WATCH|WATCHLIST|CONNECT|PROXY"'

/** API Server 实例配额单线：按 instance+pod 关联 host_ip 后打 quota 标签（request|limit） */
function apiserverQuotaPart(metric: string, resource: string, quota: string): string {
  const matcher = `pod=~".*apiserver.*", resource="${resource}"`
  const part = `sum by (instance, pod) (label_replace(${metric}{${matcher}} * on(pod, namespace) group_left(host_ip) (kube_pod_info{pod=~".*apiserver.*"}), "instance", "$1:6443", "host_ip", "(.*)"))`
  return `label_replace(${part}, "quota", "${quota}", "__name__", ".*")`
}

/** API Server 实例使用量（used）：按 instance 关联 kube_pod_info 带出 pod 名，打 quota=used 标签 */
function apiserverUsagePart(expr: string, quota: string): string {
  return `label_replace(label_replace(${expr}, "host_ip", "$1", "instance", "([^:]+).*") * on(host_ip) group_left(pod) (kube_pod_info{pod=~".*apiserver.*"}), "quota", "${quota}", "__name__", ".*")`
}

/** 关联 kube_pod_info 带出 pod 名，并按 (pod, 指定 labels) 聚合（供请求/状态码等按实例+指标维度展示） */
function apiserverPodGroup(expr: string, labels: string): string {
  return `sum by (pod, ${labels}) (label_replace(${expr}, "host_ip", "$1", "instance", "([^:]+).*") * on(host_ip) group_left(pod) (kube_pod_info{pod=~".*apiserver.*"}))`
}

/** 请求延迟分位（P99/P90/P50）按实例关联 pod，合并为 (pod, quantile) 分组 */
function apiserverQuantilePodQuery(selector: string): string {
  return [0.99, 0.9, 0.5]
    .map((q, i) => {
      const expr = `histogram_quantile(${q}, sum by (instance, le) (rate(apiserver_request_duration_seconds_bucket{${selector}}[5m]))) * 1000`
      const withPod = `label_replace(label_replace(sum by (instance) (${expr}), "host_ip", "$1", "instance", "([^:]+).*") * on(host_ip) group_left(pod) (kube_pod_info{pod=~".*apiserver.*"}), "quantile", "${q}", "__name__", ".*")`
      return i === 0 ? withPod : `or ${withPod}`
    })
    .join(' ')
}

/** 核心组件实例资源（used/request/limit 三条线）：used 走 cAdvisor 按 pod，request/limit 按 pod 聚合 */
export function componentInstanceQuota(component: string, resource: string): string {
  const pat = `.*${component}.*`
  const usageExpr =
    resource === 'cpu'
      ? `sum by (pod) (rate(container_cpu_usage_seconds_total{pod=~"${pat}", container!=""}[5m]))`
      : `sum by (pod) (container_memory_working_set_bytes{pod=~"${pat}", container!=""})`
  const used = `label_replace(${usageExpr}, "quota", "used", "__name__", ".*")`
  const req = `label_replace(sum by (pod) (kube_pod_container_resource_requests{pod=~"${pat}", resource="${resource}"} * on(pod, namespace) group_left() (kube_pod_info{pod=~"${pat}"})), "quota", "request", "__name__", ".*")`
  const lim = `label_replace(sum by (pod) (kube_pod_container_resource_limits{pod=~"${pat}", resource="${resource}"} * on(pod, namespace) group_left() (kube_pod_info{pod=~"${pat}"})), "quota", "limit", "__name__", ".*")`
  return `${used} or ${req} or ${lim}`
}

/** 核心组件面板按 (pod, 指定 labels) 聚合：used/request/limit 中抽取某维度（供实例资源卡使用） */
function componentUsagePart(component: string, expr: string, quota: string): string {
  const pat = `.*${component}.*`
  return `label_replace(label_replace(${expr}, "host_ip", "$1", "instance", "([^:]+).*") * on(host_ip) group_left(pod) (kube_pod_info{pod=~"${pat}"}), "quota", "${quota}", "__name__", ".*")`
}

/** 核心组件实例在线状态：up 经 pod_ip 关联 kube_pod_info 带出 pod 名 */
export function componentStatusQuery(component: string): string {
  const pat = `.*${component}.*`
  return `label_replace(label_replace(up{job=~"${pat}"}, "pod_ip", "$1", "instance", "([^:]+).*") * on(pod_ip) group_left(pod) (kube_pod_info{pod=~"${pat}"}), "namespace", "", "namespace", ".*")`
}

/** 核心组件请求/错误指标按 (pod, 指定 labels) 聚合（rest_client_requests_total 等按实例关联 pod） */
function componentPodGroup(component: string, expr: string, labels: string): string {
  const pat = `.*${component}.*`
  const group = labels ? `pod, ${labels}` : 'pod'
  return `sum by (${group}) (label_replace(${expr}, "host_ip", "$1", "instance", "([^:]+).*") * on(host_ip) group_left(pod) (kube_pod_info{pod=~"${pat}"}))`
}

/** 核心组件延迟直方图 P99/P90/P50 按实例关联 pod（scheduler 等），合并为 (pod, quantile) 分组 */
function componentQuantilePodQuery(component: string, metric: string): string {
  const pat = `.*${component}.*`
  return [0.99, 0.9, 0.5]
    .map((q, i) => {
      const expr = `histogram_quantile(${q}, sum by (instance, le) (rate(${metric}[5m]))) * 1000`
      const withPod = `label_replace(label_replace(sum by (instance) (${expr}), "host_ip", "$1", "instance", "([^:]+).*") * on(host_ip) group_left(pod) (kube_pod_info{pod=~"${pat}"}), "quantile", "${q}", "__name__", ".*")`
      return i === 0 ? withPod : `or ${withPod}`
    })
    .join(' ')
}

/**
 * Controller Manager 工作队列选择器（多标签兼容）。
 * 避免用全局 workqueue_*（会混入其它 Operator）导致误报「需关注」。
 */
function controllerWorkqueueSeries(metric: string): string {
  return (
    `${metric}{job=~".*controller-manager.*"}` +
    ` or ${metric}{pod=~".*controller-manager.*"}` +
    ` or ${metric}{component="kube-controller-manager"}`
  )
}

function controllerWorkqueueRateSum(metric: string): string {
  return (
    `sum(rate(${metric}{job=~".*controller-manager.*"}[5m]))` +
    ` or sum(rate(${metric}{pod=~".*controller-manager.*"}[5m]))` +
    ` or sum(rate(${metric}{component="kube-controller-manager"}[5m]))`
  )
}

function controllerWorkqueueRateByName(metric: string): string {
  return (
    `sum by (name) (rate(${metric}{job=~".*controller-manager.*"}[5m]))` +
    ` or sum by (name) (rate(${metric}{pod=~".*controller-manager.*"}[5m]))` +
    ` or sum by (name) (rate(${metric}{component="kube-controller-manager"}[5m]))`
  )
}

/** 控制面进程内存：优先 process_*，标签兼容；回退 cAdvisor 容器内存 */
function controlPlaneProcessMemoryQuery(componentPattern: string): string {
  const process =
    `process_resident_memory_bytes{job=~".*${componentPattern}.*"}` +
    ` or process_resident_memory_bytes{pod=~".*${componentPattern}.*"}` +
    ` or process_resident_memory_bytes{container=~".*${componentPattern}.*"}` +
    ` or process_resident_memory_bytes{component=~".*${componentPattern}.*"}` +
    ` or process_resident_memory_bytes{app=~".*${componentPattern}.*"}`
  return process
}

function controlPlaneContainerMemoryFallback(componentPattern: string): string {
  return (
    `sum by (pod) (` +
    `container_memory_working_set_bytes{pod=~".*${componentPattern}.*",container!="",container!="POD"}` +
    `)`
  )
}

type PanelOptions = {
  requiredMetricsAny?: string[]
  fallbackQuery?: (filters: DashboardFilters) => string
  fallbackQueries?: Array<(filters: DashboardFilters) => string>
  quantileQueries?: {
    metric: string
    thresholds: number[]
    unitFactor?: number
    selector?: string
    fallbackMetrics?: string[]
  }
}

function embedPanel(
  embedSection: string,
  id: string,
  title: string,
  kind: EmbedPanelSpec['kind'],
  unit: string,
  span: number,
  requiredMetrics: string[],
  rangeQuery: boolean,
  query?: (filters: DashboardFilters) => string,
  description?: string,
  options?: PanelOptions
): EmbedPanelSpec {
  return {
    id,
    section: embedSection,
    title,
    kind,
    unit,
    span,
    required_metrics: requiredMetrics,
    required_metrics_any: options?.requiredMetricsAny,
    rangeQuery,
    query,
    fallbackQuery: options?.fallbackQuery,
    fallbackQueries: options?.fallbackQueries,
    quantileQueries: options?.quantileQueries,
    description
  }
}

function fixed(expression: string): (filters: DashboardFilters) => string {
  return () => expression
}

function apiserverLatencyFallbackQuery(): string {
  return (
    'label_replace(' +
    `sum(rate(apiserver_request_duration_seconds_sum{${APISERVER_LATENCY_SELECTOR}}[5m])) / ` +
    `clamp_min(sum(rate(apiserver_request_duration_seconds_count{${APISERVER_LATENCY_SELECTOR}}[5m])), 1e-9) * 1000, ` +
    '"latency_kind", "avg", "nonexistent", ".*")'
  )
}

function schedulerLatencyFallbackQuery(): string {
  return (
    'label_replace(' +
    '(' +
    'sum(rate(scheduler_scheduling_attempt_duration_seconds_sum[5m])) / ' +
    'clamp_min(sum(rate(scheduler_scheduling_attempt_duration_seconds_count[5m])), 1e-9) * 1000' +
    ' or ' +
    'sum(rate(scheduler_e2e_scheduling_duration_seconds_sum[5m])) / ' +
    'clamp_min(sum(rate(scheduler_e2e_scheduling_duration_seconds_count[5m])), 1e-9) * 1000' +
    ' or ' +
    'sum(rate(scheduler_pod_scheduling_sli_duration_seconds_sum[5m])) / ' +
    'clamp_min(sum(rate(scheduler_pod_scheduling_sli_duration_seconds_count[5m])), 1e-9) * 1000' +
    '), ' +
    '"latency_kind", "avg", "nonexistent", ".*")'
  )
}

function quantileSeries(metric: string, thresholds: number[], unitFactor = 1): string {
  const bucketRate = `sum(rate(${metric}[5m])) by (le)`
  const parts = thresholds.map(
    (q) =>
      `label_replace(histogram_quantile(${q}, ${bucketRate}) * ${unitFactor}, "quantile", "${q}", "nonexistent", ".*")`
  )
  return parts.length === 1 ? parts[0] : `(${parts.join(' or ')})`
}

/** 集群详情 embed 面板（不影响外部监控大盘 section） */
export const embedPanelSpecs: EmbedPanelSpec[] = [
  // ---- API Server embed ----
  embedPanel(
    'apiserver-embed',
    'apiserver.embed.qps',
    '请求 QPS',
    'stat',
    'ops',
    3,
    ['apiserver_request_total'],
    false,
    fixed('sum(rate(apiserver_request_total[5m]))')
  ),
  embedPanel(
    'apiserver-embed',
    'apiserver.embed.error_rate',
    '5xx 错误率',
    'stat',
    'percent',
    3,
    ['apiserver_request_total'],
    false,
    fixed(
      '100 * sum(rate(apiserver_request_total{code=~"5.."}[5m])) / clamp_min(sum(rate(apiserver_request_total[5m])), 1e-9)'
    )
  ),
  embedPanel(
    'apiserver-embed',
    'apiserver.embed.latency_p99',
    'P99 请求延迟',
    'stat',
    'ms',
    3,
    ['apiserver_request_duration_seconds_bucket'],
    false,
    fixed(
      `histogram_quantile(0.99, sum(rate(apiserver_request_duration_seconds_bucket{${APISERVER_LATENCY_SELECTOR}}[5m])) by (le)) * 1000`
    ),
    '排除 WATCH / CONNECT 等长连接请求，反映短请求尾延迟'
  ),
  embedPanel(
    'apiserver-embed',
    'apiserver.embed.replicas',
    '运行副本数',
    'stat',
    'short',
    3,
    ['apiserver_request_total'],
    false,
    fixed('count(count by (instance) (apiserver_request_total))')
  ),
  embedPanel(
    'apiserver-embed',
    'apiserver.embed.requests',
    '请求速率（按方法）',
    'line',
    'ops',
    6,
    ['apiserver_request_total', 'kube_pod_info'],
    true,
    fixed(apiserverPodGroup('rate(apiserver_request_total[5m])', 'verb'))
  ),
  embedPanel(
    'apiserver-embed',
    'apiserver.embed.latency',
    '请求延迟分位',
    'line',
    'ms',
    6,
    ['apiserver_request_duration_seconds_bucket', 'kube_pod_info'],
    true,
    fixed(apiserverQuantilePodQuery(APISERVER_LATENCY_SELECTOR)),
    '排除 WATCH / CONNECT 等长连接请求后的延迟分位'
  ),
  embedPanel(
    'apiserver-embed',
    'apiserver.embed.errors',
    '5xx 错误速率（按状态码）',
    'line',
    'ops',
    6,
    ['apiserver_request_total', 'kube_pod_info'],
    true,
    fixed(apiserverPodGroup('rate(apiserver_request_total{code=~"5.."}[5m])', 'code'))
  ),
  embedPanel(
    'apiserver-embed',
    'apiserver.embed.process',
    '进程内存',
    'line',
    'bytes',
    6,
    ['process_resident_memory_bytes', 'kube_pod_info'],
    true,
    fixed(
      'label_replace(process_resident_memory_bytes{job=~".*apiserver.*"}, "host_ip", "$1", "instance", "([^:]+).*") * on(host_ip) group_left(pod) (kube_pod_info{pod=~".*apiserver.*"})'
    )
  ),
  embedPanel(
    'apiserver-embed',
    'apiserver.embed.instance_status',
    '实例在线状态',
    'status',
    '',
    12,
    ['up', 'kube_pod_info'],
    false,
    fixed(
      'label_replace(label_replace(up{job=~".*apiserver.*"}, "host_ip", "$1", "instance", "([^:]+).*") * on(host_ip) group_left(pod) (kube_pod_info{pod=~".*apiserver.*"}), "namespace", "", "namespace", ".*")'
    )
  ),
  embedPanel(
    'apiserver-embed',
    'apiserver.embed.instance_cpu',
    '实例 CPU',
    'line',
    'cores',
    6,
    ['process_cpu_seconds_total', 'kube_pod_container_resource_requests', 'kube_pod_container_resource_limits', 'kube_pod_info'],
    true,
    fixed(
      apiserverUsagePart('sum by (instance) (rate(process_cpu_seconds_total{job=~".*apiserver.*"}[5m]))', 'used') +
        ` or ${apiserverQuotaPart('kube_pod_container_resource_requests', 'cpu', 'request')}` +
        ` or ${apiserverQuotaPart('kube_pod_container_resource_limits', 'cpu', 'limit')}`
    )
  ),
  embedPanel(
    'apiserver-embed',
    'apiserver.embed.instance_memory',
    '实例内存',
    'line',
    'bytes',
    6,
    ['process_resident_memory_bytes', 'kube_pod_container_resource_requests', 'kube_pod_container_resource_limits', 'kube_pod_info'],
    true,
    fixed(
      apiserverUsagePart('process_resident_memory_bytes{job=~".*apiserver.*"}', 'used') +
        ` or ${apiserverQuotaPart('kube_pod_container_resource_requests', 'memory', 'request')}` +
        ` or ${apiserverQuotaPart('kube_pod_container_resource_limits', 'memory', 'limit')}`
    )
  ),

  embedPanel(
    'apiserver-embed',
    'apiserver.embed.requests_3xx',
    '3xx 请求速率',
    'line',
    'ops',
    6,
    ['apiserver_request_total', 'kube_pod_info'],
    true,
    fixed(apiserverPodGroup('rate(apiserver_request_total{code=~"3.."}[5m])', 'code'))
  ),
  embedPanel(
    'apiserver-embed',
    'apiserver.embed.requests_4xx',
    '4xx 请求速率',
    'line',
    'ops',
    6,
    ['apiserver_request_total', 'kube_pod_info'],
    true,
    fixed(apiserverPodGroup('rate(apiserver_request_total{code=~"4.."}[5m])', 'code'))
  ),

  embedPanel(
    'apiserver-embed',
    'apiserver.embed.requests_by_code',
    '请求状态码',
    'line',
    'count',
    6,
    ['apiserver_request_total', 'kube_pod_info'],
    true,
    fixed(apiserverPodGroup('increase(apiserver_request_total[5m])', 'code'))
  ),

  // ---- Kubelet embed ----
  embedPanel(
    'kubelet-embed',
    'kubelet.embed.running_pods',
    '运行中 Pod',
    'stat',
    'short',
    3,
    ['kubelet_running_pods'],
    false,
    fixed('sum(kubelet_running_pods)')
  ),
  embedPanel(
    'kubelet-embed',
    'kubelet.embed.running_containers',
    '运行中容器',
    'stat',
    'short',
    3,
    ['kubelet_running_containers'],
    false,
    fixed('sum(kubelet_running_containers)')
  ),
  embedPanel(
    'kubelet-embed',
    'kubelet.embed.node_count',
    'Kubelet 节点数',
    'stat',
    'short',
    3,
    ['kubelet_running_pods'],
    false,
    fixed('count(kubelet_running_pods)')
  ),
  embedPanel(
    'kubelet-embed',
    'kubelet.embed.runtime_error_rate',
    'Runtime 错误率',
    'stat',
    'percent',
    3,
    ['kubelet_runtime_operations_errors_total', 'kubelet_runtime_operations_total'],
    false,
    fixed(
      '100 * sum(rate(kubelet_runtime_operations_errors_total[5m])) / clamp_min(sum(rate(kubelet_runtime_operations_total[5m])) + sum(rate(kubelet_runtime_operations_errors_total[5m])), 1e-9)'
    )
  ),
  embedPanel(
    'kubelet-embed',
    'kubelet.embed.operation_rate',
    'Runtime 操作速率',
    'line',
    'ops',
    6,
    ['kubelet_runtime_operations_total'],
    true,
    fixed('sum by (operation_type) (rate(kubelet_runtime_operations_total[5m]))')
  ),
  embedPanel(
    'kubelet-embed',
    'kubelet.embed.errors',
    'Runtime 错误速率',
    'line',
    'ops',
    6,
    ['kubelet_runtime_operations_errors_total'],
    true,
    fixed('sum by (operation_type) (rate(kubelet_runtime_operations_errors_total[5m]))'),
    'Kubelet 调用容器运行时发生错误的每秒速率，按操作类型统计。'
  ),
  embedPanel(
    'kubelet-embed',
    'kubelet.embed.instance_cpu',
    '实例 CPU',
    'line',
    'cores',
    6,
    ['container_cpu_usage_seconds_total', 'kube_pod_container_resource_requests', 'kube_pod_container_resource_limits', 'kube_pod_info'],
    true,
    fixed(componentInstanceQuota('kubelet', 'cpu'))
  ),
  embedPanel(
    'kubelet-embed',
    'kubelet.embed.instance_memory',
    '实例内存',
    'line',
    'bytes',
    6,
    ['container_memory_working_set_bytes', 'kube_pod_container_resource_requests', 'kube_pod_container_resource_limits', 'kube_pod_info'],
    true,
    fixed(componentInstanceQuota('kubelet', 'memory'))
  ),
  embedPanel(
    'kubelet-embed',
    'kubelet.embed.instance_status',
    '实例在线状态',
    'status',
    '',
    12,
    ['up'],
    false,
    fixed('up{job="kubelet"}'),
    'Kubelet 为宿主机进程，按节点实例展示探活状态'
  ),

  // ---- Controller Manager embed ----
  embedPanel(
    'controller-embed',
    'controller.embed.queue_depth',
    '工作队列最深深度',
    'stat',
    'short',
    3,
    ['workqueue_depth'],
    false,
    fixed(`max(${controllerWorkqueueSeries('workqueue_depth')})`),
    undefined,
    { fallbackQuery: fixed('max(workqueue_depth)') }
  ),
  embedPanel(
    'controller-embed',
    'controller.embed.adds_rate',
    '队列添加速率',
    'stat',
    'ops',
    3,
    ['workqueue_adds_total'],
    false,
    fixed(controllerWorkqueueRateSum('workqueue_adds_total')),
    undefined,
    { fallbackQuery: fixed('sum(rate(workqueue_adds_total[5m]))') }
  ),
  embedPanel(
    'controller-embed',
    'controller.embed.retries_rate',
    '处理重试速率',
    'stat',
    'ops',
    3,
    ['workqueue_retries_total'],
    false,
    fixed(controllerWorkqueueRateSum('workqueue_retries_total')),
    undefined,
    { fallbackQuery: fixed('sum(rate(workqueue_retries_total[5m]))') }
  ),
  embedPanel(
    'controller-embed',
    'controller.embed.replicas',
    '运行副本数',
    'stat',
    'short',
    3,
    ['workqueue_depth'],
    false,
    fixed(`count(count by (instance) (${controllerWorkqueueSeries('workqueue_depth')}))`),
    undefined,
    {
      fallbackQuery: fixed('count(count by (instance) (workqueue_depth))')
    }
  ),
  embedPanel(
    'controller-embed',
    'controller.embed.queue_top',
    '工作队列深度 Top',
    'line',
    'short',
    6,
    ['workqueue_depth'],
    true,
    fixed(`topk(8, ${controllerWorkqueueSeries('workqueue_depth')})`),
    undefined,
    { fallbackQuery: fixed('topk(8, workqueue_depth)') }
  ),
  embedPanel(
    'controller-embed',
    'controller.embed.adds',
    '队列添加速率（按控制器）',
    'line',
    'ops',
    6,
    ['workqueue_adds_total'],
    true,
    fixed(controllerWorkqueueRateByName('workqueue_adds_total')),
    undefined,
    { fallbackQuery: fixed('sum by (name) (rate(workqueue_adds_total[5m]))') }
  ),
  embedPanel(
    'controller-embed',
    'controller.embed.latency_p99',
    '工作处理延迟 P99',
    'line',
    'ms',
    6,
    ['workqueue_work_duration_seconds_bucket'],
    true,
    fixed(
      'histogram_quantile(0.99, sum by (le) (' +
        'rate(workqueue_work_duration_seconds_bucket{job=~".*controller-manager.*"}[5m])' +
        ' or rate(workqueue_work_duration_seconds_bucket{pod=~".*controller-manager.*"}[5m])' +
        ' or rate(workqueue_work_duration_seconds_bucket{component="kube-controller-manager"}[5m])' +
        ')) * 1000'
    ),
    undefined,
    {
      fallbackQuery: fixed(
        'histogram_quantile(0.99, sum(rate(workqueue_work_duration_seconds_bucket[5m])) by (le)) * 1000'
      )
    }
  ),
  embedPanel(
    'controller-embed',
    'controller.embed.process',
    '进程内存',
    'line',
    'bytes',
    6,
    ['process_resident_memory_bytes'],
    true,
    fixed(controlPlaneProcessMemoryQuery('controller-manager')),
    '优先 process_resident_memory_bytes；无控制面 scrape 时回退容器内存',
    {
      requiredMetricsAny: [
        'process_resident_memory_bytes',
        'container_memory_working_set_bytes'
      ],
      fallbackQuery: fixed(controlPlaneContainerMemoryFallback('controller-manager'))
    }
  ),
  embedPanel(
    'controller-embed',
    'controller.embed.instance_cpu',
    '实例 CPU',
    'line',
    'cores',
    6,
    ['process_cpu_seconds_total', 'kube_pod_container_resource_requests', 'kube_pod_container_resource_limits', 'kube_pod_info'],
    true,
    fixed(componentInstanceQuota('controller-manager', 'cpu'))
  ),
  embedPanel(
    'controller-embed',
    'controller.embed.instance_memory',
    '实例内存',
    'line',
    'bytes',
    6,
    ['process_resident_memory_bytes', 'kube_pod_container_resource_requests', 'kube_pod_container_resource_limits', 'kube_pod_info'],
    true,
    fixed(componentInstanceQuota('controller-manager', 'memory'))
  ),
  embedPanel(
    'controller-embed',
    'controller.embed.instance_status',
    '实例在线状态',
    'status',
    '',
    12,
    ['up', 'kube_pod_info'],
    false,
    fixed(componentStatusQuery('controller-manager'))
  ),
  embedPanel(
    'controller-embed',
    'controller.embed.requests',
    '请求速率（按方法）',
    'line',
    'ops',
    6,
    ['rest_client_requests_total', 'kube_pod_info'],
    true,
    fixed(componentPodGroup('controller-manager', 'rate(rest_client_requests_total[5m])', 'method'))
  ),
  embedPanel(
    'controller-embed',
    'controller.embed.requests_by_code',
    '请求状态码',
    'line',
    'count',
    6,
    ['rest_client_requests_total', 'kube_pod_info'],
    true,
    fixed(componentPodGroup('controller-manager', 'increase(rest_client_requests_total[5m])', 'code'))
  ),
  embedPanel(
    'controller-embed',
    'controller.embed.requests_3xx',
    '3xx 请求速率',
    'line',
    'ops',
    6,
    ['rest_client_requests_total', 'kube_pod_info'],
    true,
    fixed(componentPodGroup('controller-manager', 'rate(rest_client_requests_total{code=~"3.."}[5m])', 'code'))
  ),
  embedPanel(
    'controller-embed',
    'controller.embed.requests_4xx',
    '4xx 请求速率',
    'line',
    'ops',
    6,
    ['rest_client_requests_total', 'kube_pod_info'],
    true,
    fixed(componentPodGroup('controller-manager', 'rate(rest_client_requests_total{code=~"4.."}[5m])', 'code'))
  ),
  embedPanel(
    'controller-embed',
    'controller.embed.requests_5xx',
    '5xx 请求速率',
    'line',
    'ops',
    6,
    ['rest_client_requests_total', 'kube_pod_info'],
    true,
    fixed(componentPodGroup('controller-manager', 'rate(rest_client_requests_total{code=~"5.."}[5m])', 'code'))
  ),

  // ---- Scheduler embed ----
  embedPanel(
    'scheduler-embed',
    'scheduler.embed.attempts_rate',
    '调度尝试速率',
    'stat',
    'ops',
    3,
    ['scheduler_schedule_attempts_total'],
    false,
    fixed('sum(rate(scheduler_schedule_attempts_total[5m]))'),
    undefined,
    {
      requiredMetricsAny: [
        'scheduler_schedule_attempts_total',
        'scheduler_scheduling_attempt_duration_seconds_count'
      ],
      fallbackQuery: fixed(
        'sum(rate(scheduler_scheduling_attempt_duration_seconds_count[5m]))'
      )
    }
  ),
  embedPanel(
    'scheduler-embed',
    'scheduler.embed.success_rate',
    '调度成功率',
    'stat',
    'percent',
    3,
    ['scheduler_schedule_attempts_total'],
    false,
    fixed(
      '100 * sum(rate(scheduler_schedule_attempts_total{result="scheduled"}[5m])) / clamp_min(sum(rate(scheduler_schedule_attempts_total[5m])), 1e-9)'
    )
  ),
  embedPanel(
    'scheduler-embed',
    'scheduler.embed.latency_p99',
    'P99 调度延迟',
    'stat',
    'ms',
    3,
    ['scheduler_e2e_scheduling_duration_seconds_bucket'],
    false,
    fixed(
      'histogram_quantile(0.99, sum(rate(scheduler_e2e_scheduling_duration_seconds_bucket[5m])) by (le)) * 1000'
    ),
    undefined,
    {
      requiredMetricsAny: [
        'scheduler_e2e_scheduling_duration_seconds_bucket',
        'scheduler_scheduling_attempt_duration_seconds_bucket'
      ],
      fallbackQuery: fixed(
        'histogram_quantile(0.99, sum(rate(scheduler_scheduling_attempt_duration_seconds_bucket[5m])) by (le)) * 1000'
      )
    }
  ),
  embedPanel(
    'scheduler-embed',
    'scheduler.embed.replicas',
    '运行副本数',
    'stat',
    'short',
    3,
    ['scheduler_schedule_attempts_total'],
    false,
    fixed('count(count by (instance) (scheduler_schedule_attempts_total))'),
    undefined,
    {
      requiredMetricsAny: [
        'scheduler_schedule_attempts_total',
        'scheduler_scheduler_goroutines',
        'process_resident_memory_bytes'
      ],
      fallbackQuery: fixed(
        'count(count by (instance) (process_resident_memory_bytes{job=~".*scheduler.*"} or process_resident_memory_bytes{pod=~".*scheduler.*"}))'
      )
    }
  ),
  embedPanel(
    'scheduler-embed',
    'scheduler.embed.results',
    '调度结果分布',
    'line',
    'ops',
    6,
    [],
    true,
    fixed(
      'sum by (result) (rate(scheduler_schedule_attempts_total[5m]))' +
        ' or sum by (result) (increase(scheduler_schedule_attempts_total[1h]) / 3600)'
    ),
    '按 result 统计调度尝试；无 attempts 指标时回退为 pending pods 队列分布',
    {
      fallbackQuery: fixed(
        'sum by (queue) (scheduler_pending_pods)' +
          ' or sum by (queue) (scheduler_unschedulable_pods)' +
          ' or sum by (name) (workqueue_depth{job=~".*scheduler.*"} or workqueue_depth{pod=~".*scheduler.*"})'
      )
    }
  ),
  embedPanel(
    'scheduler-embed',
    'scheduler.embed.latency',
    '端到端调度延迟分位',
    'line',
    'ms',
    6,
    [],
    true,
    undefined,
    '兼容 e2e / attempt / pod scheduling SLI 等多种 scheduler 延迟直方图',
    {
      quantileQueries: {
        metric: 'scheduler_e2e_scheduling_duration_seconds_bucket',
        thresholds: [0.99, 0.9, 0.5],
        unitFactor: 1000,
        fallbackMetrics: [
          'scheduler_scheduling_attempt_duration_seconds_bucket',
          'scheduler_pod_scheduling_sli_duration_seconds_bucket'
        ]
      },
      fallbackQuery: fixed(schedulerLatencyFallbackQuery())
    }
  ),
  embedPanel(
    'scheduler-embed',
    'scheduler.embed.queue_depth',
    '调度队列深度',
    'line',
    'short',
    6,
    [],
    true,
    fixed('sum by (queue) (scheduler_pending_pods)'),
    '优先 scheduler_pending_pods；无该指标时回退 workqueue',
    {
      fallbackQuery: fixed(
        'sum by (queue) (scheduler_unschedulable_pods)' +
          ' or topk(8, workqueue_depth{job=~".*scheduler.*"} or workqueue_depth{pod=~".*scheduler.*"})' +
          ' or topk(8, workqueue_depth)'
      )
    }
  ),
  embedPanel(
    'scheduler-embed',
    'scheduler.embed.process',
    '进程内存',
    'line',
    'bytes',
    6,
    [],
    true,
    fixed(controlPlaneProcessMemoryQuery('scheduler')),
    '优先 process_resident_memory_bytes；无控制面 scrape 时回退容器内存',
    {
      fallbackQuery: fixed(controlPlaneContainerMemoryFallback('scheduler'))
    }
  ),
  embedPanel(
    'scheduler-embed',
    'scheduler.embed.instance_cpu',
    '实例 CPU',
    'line',
    'cores',
    6,
    ['container_cpu_usage_seconds_total', 'kube_pod_container_resource_requests', 'kube_pod_container_resource_limits', 'kube_pod_info'],
    true,
    fixed(componentInstanceQuota('scheduler', 'cpu'))
  ),
  embedPanel(
    'scheduler-embed',
    'scheduler.embed.instance_memory',
    '实例内存',
    'line',
    'bytes',
    6,
    ['container_memory_working_set_bytes', 'kube_pod_container_resource_requests', 'kube_pod_container_resource_limits', 'kube_pod_info'],
    true,
    fixed(componentInstanceQuota('scheduler', 'memory'))
  ),
  embedPanel(
    'scheduler-embed',
    'scheduler.embed.instance_status',
    '实例在线状态',
    'status',
    '',
    12,
    ['up', 'kube_pod_info'],
    false,
    fixed(componentStatusQuery('scheduler'))
  ),
  embedPanel(
    'scheduler-embed',
    'scheduler.embed.attempts_trend',
    '调度尝试速率',
    'line',
    'ops',
    6,
    ['scheduler_schedule_attempts_total', 'kube_pod_info'],
    true,
    fixed(componentPodGroup('scheduler', 'rate(scheduler_schedule_attempts_total[5m])', ''))
  ),
  embedPanel(
    'scheduler-embed',
    'scheduler.embed.scheduled_rate',
    '调度速率',
    'line',
    'ops',
    6,
    ['scheduler_schedule_attempts_total', 'kube_pod_info'],
    true,
    fixed(
      componentPodGroup('scheduler', 'rate(scheduler_schedule_attempts_total{result="scheduled"}[5m])', '')
    )
  ),
  embedPanel(
    'scheduler-embed',
    'scheduler.embed.latency_trend',
    '调度延时 P99',
    'line',
    'ms',
    6,
    ['scheduler_e2e_scheduling_duration_seconds_bucket', 'kube_pod_info'],
    true,
    fixed(componentQuantilePodQuery('scheduler', 'scheduler_e2e_scheduling_duration_seconds_bucket'))
  ),
  embedPanel(
    'scheduler-embed',
    'scheduler.embed.pending_pods',
    'Pending Pods',
    'line',
    'short',
    6,
    ['scheduler_pending_pods', 'kube_pod_info'],
    true,
    fixed(componentPodGroup('scheduler', 'scheduler_pending_pods', ''))
  ),
  embedPanel(
    'scheduler-embed',
    'scheduler.embed.incoming_pods',
    'Incoming Pods 速率',
    'line',
    'ops',
    6,
    ['scheduler_queue_incoming_pods_total', 'kube_pod_info'],
    true,
    fixed(componentPodGroup('scheduler', 'rate(scheduler_queue_incoming_pods_total[5m])', ''))
  ),

  // ---- Node resource embed ----
  embedPanel(
    'node-resource-embed',
    'node.embed.ready',
    '节点健康状态',
    'status',
    '',
    12,
    [],
    false,
    // 保留全部节点（含 NotReady）；值为 1=Ready、0=NotReady
    fixed('max by (node) (kube_node_status_condition{condition="Ready",status="true"})'),
    '各节点 Ready 条件；无 node 标签时勿用 condition 当名称'
  ),
  embedPanel(
    'node-resource-embed',
    'node.embed.overview_cpu',
    '节点 CPU（总览）',
    'bar',
    'percent',
    6,
    [],
    false,
    fixed(
      '100 * sum by (node) (rate(container_cpu_usage_seconds_total{container!=""}[5m])) / clamp_min(sum by (node) (kube_node_status_allocatable{resource="cpu"}), 0.001)'
    )
  ),
  embedPanel(
    'node-resource-embed',
    'node.embed.overview_cpu_total',
    '节点总 CPU',
    'bar',
    'cores',
    6,
    [],
    false,
    // 优先 machine_cpu_cores（与 cAdvisor 节点标签一致），再回退 KSM allocatable/capacity
    fixed(
      '(' +
        'sum by (node) (machine_cpu_cores)' +
        ' or sum by (node) (kube_node_status_allocatable{resource="cpu",unit="core"})' +
        ' or sum by (node) (kube_node_status_allocatable{resource="cpu"})' +
        ' or sum by (node) (kube_node_status_capacity{resource="cpu",unit="core"})' +
        ' or sum by (node) (kube_node_status_capacity{resource="cpu"})' +
        ')'
    ),
    undefined,
    {
      fallbackQueries: [
        fixed(
          'label_replace(count by (nodename) (node_cpu_seconds_total{mode="idle"} * on(instance) group_left(nodename) node_uname_info), "node", "$1", "nodename", "(.*)")'
        ),
        fixed(
          'label_replace(count by (instance) (node_cpu_seconds_total{mode="idle"}), "node", "$1", "instance", "^([^:]+):.*")'
        )
      ]
    }
  ),
  embedPanel(
    'node-resource-embed',
    'node.embed.overview_memory',
    '节点内存（总览）',
    'bar',
    'percent',
    6,
    [],
    false,
    fixed(
      '100 * sum by (node) (container_memory_working_set_bytes{container!=""}) / clamp_min(sum by (node) (kube_node_status_allocatable{resource="memory"}), 1)'
    )
  ),
  embedPanel(
    'node-resource-embed',
    'node.embed.overview_disk',
    '节点磁盘可用',
    'bar',
    'bytes',
    6,
    [],
    false,
    fixed(
      'label_replace(max by (nodename) (node_filesystem_avail_bytes{fstype!~"tmpfs|overlay|squashfs|nsfs",mountpoint="/"} * on(instance) group_left(nodename) node_uname_info), "node", "$1", "nodename", "(.*)")'
    ),
    '根分区可用字节；经 node_uname_info 关联节点名',
    {
      fallbackQueries: [
        fixed(
          'max by (node) (node_filesystem_avail_bytes{fstype!~"tmpfs|overlay|squashfs|nsfs",mountpoint="/"})'
        ),
        fixed(
          'label_replace(max by (instance) (node_filesystem_avail_bytes{fstype!~"tmpfs|overlay|squashfs|nsfs",mountpoint="/"}), "node", "$1", "instance", "^([^:]+):.*")'
        )
      ]
    }
  ),
  embedPanel(
    'node-resource-embed',
    'node.embed.overview_memory_total',
    '节点总内存',
    'bar',
    'bytes',
    6,
    [],
    false,
    fixed('sum by (node) (kube_node_status_allocatable{resource="memory"})'),
    undefined,
    {
      fallbackQueries: [
        fixed(
          'label_replace(sum by (nodename) (node_memory_MemTotal_bytes * on(instance) group_left(nodename) node_uname_info), "node", "$1", "nodename", "(.*)")'
        ),
        fixed(
          'label_replace(sum by (instance) (node_memory_MemTotal_bytes), "node", "$1", "instance", "^([^:]+):.*")'
        )
      ]
    }
  ),
  embedPanel(
    'node-resource-embed',
    'node.embed.overview_net_transmit',
    '节点网络发送',
    'bar',
    'Bps',
    6,
    [],
    false,
    fixed(
      'sort_desc(label_replace(sum by (nodename) (rate(node_network_transmit_bytes_total{device!="lo"}[5m]) * on(instance) group_left(nodename) node_uname_info), "node", "$1", "nodename", "(.*)"))'
    ),
    undefined,
    {
      fallbackQueries: [
        fixed('sort_desc(sum by (node) (rate(node_network_transmit_bytes_total{device!="lo"}[5m])))'),
        fixed('sort_desc(sum by (node) (rate(container_network_transmit_bytes_total[5m])))'),
        fixed(
          'sort_desc(label_replace(sum by (instance) (rate(node_network_transmit_bytes_total{device!="lo"}[5m])), "node", "$1", "instance", "^([^:]+):.*"))'
        )
      ]
    }
  ),
  embedPanel(
    'node-resource-embed',
    'node.embed.overview_net_receive',
    '节点网络接收',
    'bar',
    'Bps',
    6,
    [],
    false,
    fixed(
      'sort_desc(label_replace(sum by (nodename) (rate(node_network_receive_bytes_total{device!="lo"}[5m]) * on(instance) group_left(nodename) node_uname_info), "node", "$1", "nodename", "(.*)"))'
    ),
    undefined,
    {
      fallbackQueries: [
        fixed('sort_desc(sum by (node) (rate(node_network_receive_bytes_total{device!="lo"}[5m])))'),
        fixed('sort_desc(sum by (node) (rate(container_network_receive_bytes_total[5m])))'),
        fixed(
          'sort_desc(label_replace(sum by (instance) (rate(node_network_receive_bytes_total{device!="lo"}[5m])), "node", "$1", "instance", "^([^:]+):.*"))'
        )
      ]
    }
  ),
  embedPanel(
    'node-resource-embed',
    'node.embed.overview_load5',
    '节点 Load',
    'bar',
    'short',
    6,
    [],
    false,
    fixed(
      'sort_desc(label_replace(sum by (nodename) (node_load5 * on(instance) group_left(nodename) node_uname_info), "node", "$1", "nodename", "(.*)"))'
    ),
    undefined,
    {
      fallbackQueries: [
        fixed('sort_desc(sum by (node) (node_load5))'),
        fixed(
          'sort_desc(label_replace(sum by (instance) (node_load5), "node", "$1", "instance", "^([^:]+):.*"))'
        )
      ]
    }
  ),
  embedPanel(
    'node-resource-embed',
    'node.embed.overview_connections',
    '节点连接数',
    'bar',
    'short',
    6,
    [],
    false,
    fixed(
      'sort_desc(label_replace(sum by (nodename) (node_netstat_Tcp_CurrEstab * on(instance) group_left(nodename) node_uname_info), "node", "$1", "nodename", "(.*)"))'
    ),
    'TCP 已建立连接数（CurrEstab）',
    {
      fallbackQueries: [
        fixed('sort_desc(sum by (node) (node_netstat_Tcp_CurrEstab))'),
        fixed(
          'sort_desc(label_replace(sum by (nodename) (node_sockstat_TCP_inuse * on(instance) group_left(nodename) node_uname_info), "node", "$1", "nodename", "(.*)"))'
        ),
        fixed(
          'sort_desc(label_replace(sum by (instance) (node_netstat_Tcp_CurrEstab), "node", "$1", "instance", "^([^:]+):.*"))'
        )
      ]
    }
  ),
  embedPanel(
    'node-resource-embed',
    'node.embed.overview_retrans',
    '节点重传率',
    'bar',
    'percent',
    6,
    [],
    false,
    fixed(
      'label_replace(' +
        '100 * sum by (nodename) (rate(node_netstat_Tcp_RetransSegs[5m]) * on(instance) group_left(nodename) node_uname_info) ' +
        '/ clamp_min(sum by (nodename) (rate(node_netstat_Tcp_OutSegs[5m]) * on(instance) group_left(nodename) node_uname_info), 1)' +
        ', "node", "$1", "nodename", "(.*)")'
    ),
    'TCP 重传段 / 发出段',
    {
      fallbackQueries: [
        fixed(
          '100 * sum by (node) (rate(node_netstat_Tcp_RetransSegs[5m])) / clamp_min(sum by (node) (rate(node_netstat_Tcp_OutSegs[5m])), 1)'
        ),
        fixed(
          'label_replace(' +
            '100 * sum by (instance) (rate(node_netstat_Tcp_RetransSegs[5m])) / clamp_min(sum by (instance) (rate(node_netstat_Tcp_OutSegs[5m])), 1)' +
            ', "node", "$1", "instance", "^([^:]+):.*")'
        )
      ]
    }
  ),
  embedPanel(
    'node-resource-embed',
    'node.embed.overview_uptime',
    '节点在线时间',
    'bar',
    'seconds',
    6,
    [],
    false,
    fixed(
      'label_replace(max by (nodename) ((time() - node_boot_time_seconds) * on(instance) group_left(nodename) node_uname_info), "node", "$1", "nodename", "(.*)")'
    ),
    undefined,
    {
      fallbackQueries: [
        fixed('max by (node) (time() - node_boot_time_seconds)'),
        fixed(
          'label_replace(max by (instance) (time() - node_boot_time_seconds), "node", "$1", "instance", "^([^:]+):.*")'
        )
      ]
    }
  ),
  embedPanel(
    'node-resource-embed',
    'node.embed.pods',
    '节点 Pod 数',
    'bar',
    'count',
    6,
    [],
    false,
    fixed('sort_desc(count by (node) (kube_pod_info))')
  ),
  embedPanel(
    'node-resource-embed',
    'node.embed.cpu',
    '节点 CPU 使用率',
    'bar',
    'percent',
    6,
    [],
    false,
    fixed(
      'topk(10, 100 * sum by (node) (rate(container_cpu_usage_seconds_total{container!=""}[5m])) / clamp_min(sum by (node) (kube_node_status_allocatable{resource="cpu"}), 0.001))'
    )
  ),
  embedPanel(
    'node-resource-embed',
    'node.embed.memory',
    '节点内存使用率',
    'bar',
    'percent',
    6,
    [],
    false,
    fixed(
      'topk(10, 100 * sum by (node) (container_memory_working_set_bytes{container!=""}) / clamp_min(sum by (node) (kube_node_status_allocatable{resource="memory"}), 1))'
    )
  ),
  // 参考主机监控大盘：吞吐排名 / Load / 连接数
  embedPanel(
    'node-resource-embed',
    'node.embed.net_throughput',
    '网络吞吐 Top',
    'bar',
    'Bps',
    6,
    [],
    false,
    fixed(
      'topk(10, label_replace(sum by (nodename) (' +
        '(rate(node_network_transmit_bytes_total{device!="lo"}[5m]) + rate(node_network_receive_bytes_total{device!="lo"}[5m]))' +
        ' * on(instance) group_left(nodename) node_uname_info' +
        '), "node", "$1", "nodename", "(.*)"))'
    ),
    '发送+接收合计速率 Top 10',
    {
      fallbackQueries: [
        fixed(
          'topk(10, sum by (node) (rate(node_network_transmit_bytes_total{device!="lo"}[5m]) + rate(node_network_receive_bytes_total{device!="lo"}[5m])))'
        ),
        fixed(
          'topk(10, sum by (node) (rate(container_network_transmit_bytes_total[5m]) + rate(container_network_receive_bytes_total[5m])))'
        ),
        fixed(
          'topk(10, label_replace(sum by (instance) (rate(node_network_transmit_bytes_total{device!="lo"}[5m]) + rate(node_network_receive_bytes_total{device!="lo"}[5m])), "node", "$1", "instance", "^([^:]+):.*"))'
        )
      ]
    }
  ),
  embedPanel(
    'node-resource-embed',
    'node.embed.net_transmit_top',
    '网络发送 Top',
    'bar',
    'Bps',
    6,
    [],
    false,
    fixed(
      'topk(10, label_replace(sum by (nodename) (rate(node_network_transmit_bytes_total{device!="lo"}[5m]) * on(instance) group_left(nodename) node_uname_info), "node", "$1", "nodename", "(.*)"))'
    ),
    undefined,
    {
      fallbackQueries: [
        fixed('topk(10, sum by (node) (rate(node_network_transmit_bytes_total{device!="lo"}[5m])))'),
        fixed('topk(10, sum by (node) (rate(container_network_transmit_bytes_total[5m])))'),
        fixed(
          'topk(10, label_replace(sum by (instance) (rate(node_network_transmit_bytes_total{device!="lo"}[5m])), "node", "$1", "instance", "^([^:]+):.*"))'
        )
      ]
    }
  ),
  embedPanel(
    'node-resource-embed',
    'node.embed.net_receive_top',
    '网络接收 Top',
    'bar',
    'Bps',
    6,
    [],
    false,
    fixed(
      'topk(10, label_replace(sum by (nodename) (rate(node_network_receive_bytes_total{device!="lo"}[5m]) * on(instance) group_left(nodename) node_uname_info), "node", "$1", "nodename", "(.*)"))'
    ),
    undefined,
    {
      fallbackQueries: [
        fixed('topk(10, sum by (node) (rate(node_network_receive_bytes_total{device!="lo"}[5m])))'),
        fixed('topk(10, sum by (node) (rate(container_network_receive_bytes_total[5m])))'),
        fixed(
          'topk(10, label_replace(sum by (instance) (rate(node_network_receive_bytes_total{device!="lo"}[5m])), "node", "$1", "instance", "^([^:]+):.*"))'
        )
      ]
    }
  ),
  embedPanel(
    'node-resource-embed',
    'node.embed.load_top',
    'Load Top',
    'bar',
    'short',
    6,
    [],
    false,
    fixed(
      'topk(10, label_replace(sum by (nodename) (node_load5 * on(instance) group_left(nodename) node_uname_info), "node", "$1", "nodename", "(.*)"))'
    ),
    '5 分钟系统负载 Top 10',
    {
      fallbackQueries: [
        fixed('topk(10, sum by (node) (node_load5))'),
        fixed(
          'topk(10, label_replace(sum by (instance) (node_load5), "node", "$1", "instance", "^([^:]+):.*"))'
        )
      ]
    }
  ),
  embedPanel(
    'node-resource-embed',
    'node.embed.connections_top',
    '连接数 Top',
    'bar',
    'short',
    6,
    [],
    false,
    fixed(
      'topk(10, label_replace(sum by (nodename) (node_netstat_Tcp_CurrEstab * on(instance) group_left(nodename) node_uname_info), "node", "$1", "nodename", "(.*)"))'
    ),
    'TCP 已建立连接数 Top 10',
    {
      fallbackQueries: [
        fixed('topk(10, sum by (node) (node_netstat_Tcp_CurrEstab))'),
        fixed(
          'topk(10, label_replace(sum by (nodename) (node_sockstat_TCP_inuse * on(instance) group_left(nodename) node_uname_info), "node", "$1", "nodename", "(.*)"))'
        ),
        fixed(
          'topk(10, label_replace(sum by (instance) (node_netstat_Tcp_CurrEstab), "node", "$1", "instance", "^([^:]+):.*"))'
        )
      ]
    }
  ),

  // ---- Node pod embed ----
  embedPanel(
    'node-pod-embed',
    'node.embed.pod_cpu',
    '节点 Pod CPU Top 10',
    'bar',
    'cores',
    6,
    ['container_cpu_usage_seconds_total'],
    false,
    fixed(
      'topk(10, sum by (namespace,pod) (rate(container_cpu_usage_seconds_total{container!=""}[5m])))'
    )
  ),
  embedPanel(
    'node-pod-embed',
    'node.embed.pod_memory',
    '节点 Pod 内存 Top 10',
    'bar',
    'bytes',
    6,
    ['container_memory_working_set_bytes'],
    false,
    fixed(
      'topk(10, sum by (namespace,pod) (container_memory_working_set_bytes{container!=""}))'
    )
  ),

  // ---- Workload embed ----
  embedPanel(
    'workload-embed',
    'workload.embed.deployments',
    'Deployment 可用率',
    'bar',
    'percent',
    4,
    ['kube_deployment_status_replicas_available', 'kube_deployment_spec_replicas'],
    false,
    fixed(
      '100 * sum by (deployment) (kube_deployment_status_replicas_available) / clamp_min(sum by (deployment) (kube_deployment_spec_replicas), 1)'
    )
  ),
  embedPanel(
    'workload-embed',
    'workload.embed.statefulsets',
    'StatefulSet Ready',
    'bar',
    'percent',
    4,
    ['kube_statefulset_status_replicas_ready', 'kube_statefulset_replicas'],
    false,
    fixed(
      '100 * sum by (statefulset) (kube_statefulset_status_replicas_ready) / clamp_min(sum by (statefulset) (kube_statefulset_replicas), 1)'
    )
  ),
  embedPanel(
    'workload-embed',
    'workload.embed.daemonsets',
    'DaemonSet Ready',
    'bar',
    'percent',
    4,
    ['kube_daemonset_status_number_ready', 'kube_daemonset_status_desired_number_scheduled'],
    false,
    fixed(
      '100 * sum by (daemonset) (kube_daemonset_status_number_ready) / clamp_min(sum by (daemonset) (kube_daemonset_status_desired_number_scheduled), 1)'
    )
  ),

  // ---- Pod embed ----
  embedPanel(
    'pod-embed',
    'pod.embed.cpu_trend',
    'Pod CPU 使用率',
    'line',
    'percent',
    6,
    ['container_cpu_usage_seconds_total', 'kube_pod_container_resource_limits'],
    true,
    fixed(
      'topk(8, 100 * sum by (namespace,pod) (rate(container_cpu_usage_seconds_total{container!=""}[5m])) / clamp_min(sum by (namespace,pod) (kube_pod_container_resource_limits{resource="cpu"}), 0.001))'
    ),
    '当前 CPU 用量占 Pod 容器 CPU limits 的百分比；未配置 CPU limits 的 Pod 不显示。'
  ),
  embedPanel(
    'pod-embed',
    'pod.embed.memory_trend',
    'Pod 内存使用率',
    'line',
    'percent',
    6,
    ['container_memory_working_set_bytes', 'kube_pod_container_resource_limits'],
    true,
    fixed(
      'topk(8, 100 * sum by (namespace,pod) (container_memory_working_set_bytes{container!=""}) / clamp_min(sum by (namespace,pod) (kube_pod_container_resource_limits{resource="memory"}), 1))'
    ),
    '当前内存工作集占 Pod 容器内存 limits 的百分比；未配置内存 limits 的 Pod 不显示。'
  ),
  embedPanel(
    'pod-embed',
    'pod.embed.restarts',
    'Pod 重启次数',
    'bar',
    'count',
    6,
    // 不强制 required：__name__ 列表截断时会误判「指标未采集」
    [],
    false,
    fixed('topk(10, sum by (namespace,pod) (kube_pod_container_status_restarts_total))'),
    '按 Pod 汇总容器重启次数 Top10；兼容 container 标签过滤与 max 聚合',
    {
      fallbackQueries: [
        fixed(
          'topk(10, sum by (namespace,pod) (kube_pod_container_status_restarts_total{container!="",container!="POD"}))'
        ),
        fixed('topk(10, max by (namespace,pod) (kube_pod_container_status_restarts_total))'),
        fixed(
          'topk(10, sum by (namespace,pod) (increase(kube_pod_container_status_restarts_total[1h])))'
        )
      ]
    }
  ),
  embedPanel(
    'pod-embed',
    'pod.embed.phase',
    'Pod 状态',
    'status',
    '',
    6,
    ['kube_pod_status_phase'],
    false,
    fixed('kube_pod_status_phase == 1')
  ),

  // ---- Etcd embed（集群详情专属，不影响外部监控大盘 section） ----
  embedPanel(
    'etcd-embed',
    'etcd.embed.leader_count',
    '有 Leader 成员数',
    'stat',
    'count',
    3,
    ['etcd_server_has_leader'],
    false,
    fixed('sum(etcd_server_has_leader)')
  ),
  embedPanel(
    'etcd-embed',
    'etcd.embed.member_count',
    '成员总数',
    'stat',
    'count',
    3,
    ['etcd_server_has_leader'],
    false,
    fixed('count(etcd_server_has_leader)')
  ),
  embedPanel(
    'etcd-embed',
    'etcd.embed.leader_changes',
    'Leader 切换次数',
    'line',
    'count',
    6,
    ['etcd_server_leader_changes_seen_total'],
    true,
    fixed('sum(rate(etcd_server_leader_changes_seen_total[5m]))')
  ),
  embedPanel(
    'etcd-embed',
    'etcd.embed.proposals',
    'Proposals 提交 / 应用 / 失败',
    'line',
    'ops',
    6,
    ['etcd_server_proposals_committed_total'],
    true,
    fixed(
      'label_replace(sum(rate(etcd_server_proposals_committed_total[5m])), "kind", "已提交", "nonexistent", ".*") or label_replace(sum(rate(etcd_server_proposals_applied_total[5m])), "kind", "已应用", "nonexistent", ".*") or label_replace(sum(rate(etcd_server_proposals_failed_total[5m])), "kind", "已失败", "nonexistent", ".*")'
    ),
    undefined,
    {
      requiredMetricsAny: [
        'etcd_server_proposals_committed_total',
        'etcd_server_proposals_failed_total'
      ]
    }
  ),
  embedPanel(
    'etcd-embed',
    'etcd.embed.has_leader',
    '成员 HasLeader 状态',
    'line',
    'count',
    6,
    ['etcd_server_has_leader'],
    true,
    fixed('etcd_server_has_leader')
  ),
  embedPanel(
    'etcd-embed',
    'etcd.embed.requests_total',
    '请求速率',
    'line',
    'ops',
    6,
    ['grpc_server_started_total'],
    true,
    fixed('sum(rate(grpc_server_started_total{job=~".*etcd.*"}[5m]))'),
    undefined,
    {
      requiredMetricsAny: [
        'grpc_server_started_total',
        'grpc_server_handled_total',
        'etcd_http_received_total'
      ]
    }
  ),
  embedPanel(
    'etcd-embed',
    'etcd.embed.requests_by_method',
    '请求方法分布',
    'line',
    'ops',
    6,
    ['grpc_server_handled_total'],
    true,
    fixed('sum by (grpc_method) (rate(grpc_server_handled_total{job=~".*etcd.*"}[5m]))')
  ),
  embedPanel(
    'etcd-embed',
    'etcd.embed.error_rate',
    '请求错误率',
    'line',
    'percent',
    6,
    ['grpc_server_handled_total'],
    true,
    fixed(
      '100 * sum(rate(grpc_server_handled_total{job=~".*etcd.*",grpc_code!="OK"}[5m])) / clamp_min(sum(rate(grpc_server_handled_total{job=~".*etcd.*"}[5m])), 1e-9)'
    )
  ),
  embedPanel(
    'etcd-embed',
    'etcd.embed.latency',
    'gRPC 请求延迟分位',
    'line',
    'ms',
    12,
    ['grpc_server_handling_seconds_bucket'],
    true,
    undefined,
    undefined,
    {
      quantileQueries: {
        metric: 'grpc_server_handling_seconds_bucket',
        thresholds: [0.99, 0.95, 0.5],
        unitFactor: 1000
      },
      requiredMetricsAny: [
        'grpc_server_handling_seconds_bucket',
        'grpc_server_handling_seconds_sum',
        'grpc_server_handling_seconds_count'
      ],
      fallbackQuery: fixed(
        'label_replace(sum(rate(grpc_server_handling_seconds_sum[5m])) / clamp_min(sum(rate(grpc_server_handling_seconds_count[5m])), 1e-9) * 1000, "latency_kind", "avg", "nonexistent", ".*")'
      )
    }
  ),
  embedPanel(
    'etcd-embed',
    'etcd.embed.wal_fsync',
    'WAL fsync 延迟',
    'line',
    'ms',
    6,
    ['etcd_disk_wal_fsync_duration_seconds_bucket'],
    true,
    undefined,
    undefined,
    {
      quantileQueries: {
        metric: 'etcd_disk_wal_fsync_duration_seconds_bucket',
        thresholds: [0.99, 0.5],
        unitFactor: 1000
      },
      requiredMetricsAny: [
        'etcd_disk_wal_fsync_duration_seconds_bucket',
        'etcd_disk_wal_fsync_duration_seconds_sum'
      ]
    }
  ),
  embedPanel(
    'etcd-embed',
    'etcd.embed.backend_commit',
    'Backend commit 延迟',
    'line',
    'ms',
    6,
    ['etcd_disk_backend_commit_duration_seconds_bucket'],
    true,
    undefined,
    undefined,
    {
      quantileQueries: {
        metric: 'etcd_disk_backend_commit_duration_seconds_bucket',
        thresholds: [0.99, 0.5],
        unitFactor: 1000
      },
      requiredMetricsAny: [
        'etcd_disk_backend_commit_duration_seconds_bucket',
        'etcd_disk_backend_commit_duration_seconds_sum'
      ]
    }
  ),
  embedPanel(
    'etcd-embed',
    'etcd.embed.db_size',
    'DB 大小',
    'line',
    'bytes',
    4,
    ['etcd_mvcc_db_total_size_in_bytes'],
    true,
    fixed('etcd_mvcc_db_total_size_in_bytes')
  ),
  embedPanel(
    'etcd-embed',
    'etcd.embed.quota_usage',
    'DB 配额使用率',
    'line',
    'percent',
    4,
    ['etcd_mvcc_db_total_size_in_bytes', 'etcd_server_quota_backend_bytes'],
    true,
    fixed(
      '100 * etcd_mvcc_db_total_size_in_bytes / clamp_min(etcd_server_quota_backend_bytes, 1e-9)'
    )
  ),
  embedPanel(
    'etcd-embed',
    'etcd.embed.kv_count',
    'KV 对总数',
    'line',
    'short',
    4,
    ['etcd_debugging_mvcc_keys_total'],
    true,
    fixed('etcd_debugging_mvcc_keys_total or etcd_debugging_store_metrics_keys_total'),
    undefined,
    {
      requiredMetricsAny: [
        'etcd_debugging_mvcc_keys_total',
        'etcd_debugging_store_metrics_keys_total'
      ]
    }
  ),
  embedPanel(
    'etcd-embed',
    'etcd.embed.memory',
    '进程内存',
    'line',
    'bytes',
    6,
    ['process_resident_memory_bytes'],
    true,
    fixed('process_resident_memory_bytes{job=~".*etcd.*"}')
  ),
  embedPanel(
    'etcd-embed',
    'etcd.embed.cpu',
    'CPU 使用率',
    'line',
    'cores',
    6,
    ['process_cpu_seconds_total'],
    true,
    fixed('rate(process_cpu_seconds_total{job=~".*etcd.*"}[5m])')
  ),
  embedPanel(
    'etcd-embed',
    'etcd.embed.member_leader',
    '成员 Leader 标识',
    'stat',
    'count',
    3,
    ['etcd_server_is_leader'],
    false,
    fixed('etcd_server_is_leader')
  ),
  embedPanel(
    'etcd-embed',
    'etcd.embed.member_db_size',
    '成员 DB 大小',
    'stat',
    'bytes',
    3,
    ['etcd_mvcc_db_total_size_in_bytes'],
    false,
    fixed('etcd_mvcc_db_total_size_in_bytes')
  ),
  embedPanel(
    'etcd-embed',
    'etcd.embed.member_memory',
    '成员内存',
    'stat',
    'bytes',
    3,
    ['process_resident_memory_bytes'],
    false,
    fixed('process_resident_memory_bytes{job=~".*etcd.*"}')
  ),
  embedPanel(
    'etcd-embed',
    'etcd.embed.member_qps',
    '成员请求 QPS',
    'stat',
    'ops',
    3,
    ['grpc_server_started_total'],
    false,
    fixed('sum by (instance) (rate(grpc_server_started_total{job=~".*etcd.*"}[5m]))')
  )
]

export const APISERVER_EMBED_PANEL_IDS = [
  'apiserver.embed.qps',
  'apiserver.embed.error_rate',
  'apiserver.embed.latency_p99',
  'apiserver.embed.replicas',
  'apiserver.embed.requests',
  'apiserver.embed.requests_by_code',
  'apiserver.embed.latency',
  'apiserver.embed.errors',
  'apiserver.embed.requests_3xx',
  'apiserver.embed.requests_4xx',
  'apiserver.embed.process',
  'apiserver.embed.instance_status',
  'apiserver.embed.instance_cpu',
  'apiserver.embed.instance_memory'
] as const

export const KUBELET_EMBED_PANEL_IDS = [
  'kubelet.embed.running_pods',
  'kubelet.embed.running_containers',
  'kubelet.embed.node_count',
  'kubelet.embed.runtime_error_rate',
  'kubelet.embed.operation_rate',
  'kubelet.embed.errors',
  'kubelet.embed.instance_cpu',
  'kubelet.embed.instance_memory',
  'kubelet.embed.instance_status'
] as const

export const CONTROLLER_EMBED_PANEL_IDS = [
  'controller.embed.queue_depth',
  'controller.embed.adds_rate',
  'controller.embed.retries_rate',
  'controller.embed.replicas',
  'controller.embed.queue_top',
  'controller.embed.adds',
  'controller.embed.latency_p99',
  'controller.embed.process',
  'controller.embed.instance_cpu',
  'controller.embed.instance_memory',
  'controller.embed.instance_status',
  'controller.embed.requests',
  'controller.embed.requests_by_code',
  'controller.embed.requests_3xx',
  'controller.embed.requests_4xx',
  'controller.embed.requests_5xx'
] as const

export const SCHEDULER_EMBED_PANEL_IDS = [
  'scheduler.embed.attempts_rate',
  'scheduler.embed.success_rate',
  'scheduler.embed.latency_p99',
  'scheduler.embed.replicas',
  'scheduler.embed.results',
  'scheduler.embed.latency',
  'scheduler.embed.queue_depth',
  'scheduler.embed.process',
  'scheduler.embed.instance_cpu',
  'scheduler.embed.instance_memory',
  'scheduler.embed.instance_status',
  'scheduler.embed.attempts_trend',
  'scheduler.embed.scheduled_rate',
  'scheduler.embed.latency_trend',
  'scheduler.embed.pending_pods',
  'scheduler.embed.incoming_pods'
] as const

export const NODE_RESOURCE_EMBED_PANEL_IDS = [
  'node.embed.ready',
  'node.embed.overview_cpu',
  'node.embed.overview_cpu_total',
  'node.embed.overview_memory',
  'node.embed.overview_memory_total',
  'node.embed.overview_disk',
  'node.embed.overview_net_transmit',
  'node.embed.overview_net_receive',
  'node.embed.overview_load5',
  'node.embed.overview_connections',
  'node.embed.overview_retrans',
  'node.embed.overview_uptime',
  'node.embed.pods'
] as const

export const NODE_POD_EMBED_PANEL_IDS = ['node.embed.pod_cpu', 'node.embed.pod_memory'] as const

export const WORKLOAD_EMBED_PANEL_IDS = [
  'workload.embed.deployments',
  'workload.embed.statefulsets',
  'workload.embed.daemonsets'
] as const

export const POD_EMBED_PANEL_IDS = [
  'pod.embed.cpu_trend',
  'pod.embed.memory_trend',
  'pod.embed.restarts',
  'pod.embed.phase'
] as const

export const ETCD_EMBED_PANEL_IDS = [
  'etcd.embed.leader_count',
  'etcd.embed.member_count',
  'etcd.embed.leader_changes',
  'etcd.embed.proposals',
  'etcd.embed.has_leader',
  'etcd.embed.requests_total',
  'etcd.embed.requests_by_method',
  'etcd.embed.error_rate',
  'etcd.embed.latency',
  'etcd.embed.wal_fsync',
  'etcd.embed.backend_commit',
  'etcd.embed.db_size',
  'etcd.embed.kv_count',
  'etcd.embed.quota_usage',
  'etcd.embed.memory',
  'etcd.embed.cpu',
  'etcd.embed.member_leader',
  'etcd.embed.member_db_size',
  'etcd.embed.member_memory',
  'etcd.embed.member_qps'
] as const

/** 集群详情各 section 对应的 embed 面板 ID（coredns 由 dashboard-catalog 单独导出） */
export const CLUSTER_DETAIL_EMBED_PANEL_IDS: Record<string, readonly string[]> = {
  apiserver: APISERVER_EMBED_PANEL_IDS,
  kubelet: KUBELET_EMBED_PANEL_IDS,
  'controller-manager': CONTROLLER_EMBED_PANEL_IDS,
  scheduler: SCHEDULER_EMBED_PANEL_IDS,
  'node-resource': NODE_RESOURCE_EMBED_PANEL_IDS,
  'node-pod': NODE_POD_EMBED_PANEL_IDS,
  workload: WORKLOAD_EMBED_PANEL_IDS,
  pod: POD_EMBED_PANEL_IDS,
  etcd: ETCD_EMBED_PANEL_IDS
}

export function resolveClusterDetailPanelIds(
  section: string,
  fallbackPanelIds: string[],
  corednsEmbedIds: readonly string[]
): string[] {
  if (section === 'coredns') return [...corednsEmbedIds]
  const embedIds = CLUSTER_DETAIL_EMBED_PANEL_IDS[section]
  if (embedIds?.length) return [...embedIds]
  return fallbackPanelIds
}

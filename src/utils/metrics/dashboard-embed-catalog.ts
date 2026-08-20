import type { DashboardFilters, DashboardPanelDefinition } from '@/api/dashboard'

interface EmbedPanelSpec extends DashboardPanelDefinition {
  rangeQuery: boolean
  query?: (filters: DashboardFilters) => string
  fallbackQuery?: (filters: DashboardFilters) => string
  quantileQueries?: {
    metric: string
    thresholds: number[]
    unitFactor?: number
  }
}

type PanelOptions = {
  requiredMetricsAny?: string[]
  fallbackQuery?: (filters: DashboardFilters) => string
  quantileQueries?: {
    metric: string
    thresholds: number[]
    unitFactor?: number
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
    'sum(rate(apiserver_request_duration_seconds_sum[5m])) / ' +
    'clamp_min(sum(rate(apiserver_request_duration_seconds_count[5m])), 1e-9) * 1000, ' +
    '"latency_kind", "avg", "nonexistent", ".*")'
  )
}

function schedulerLatencyFallbackQuery(): string {
  return (
    'label_replace(' +
    'sum(rate(scheduler_e2e_scheduling_duration_seconds_sum[5m])) / ' +
    'clamp_min(sum(rate(scheduler_e2e_scheduling_duration_seconds_count[5m])), 1e-9) * 1000, ' +
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
      'histogram_quantile(0.99, sum(rate(apiserver_request_duration_seconds_bucket[5m])) by (le)) * 1000'
    )
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
    fixed('count(apiserver_request_total)')
  ),
  embedPanel(
    'apiserver-embed',
    'apiserver.embed.requests',
    '请求速率（按方法）',
    'line',
    'ops',
    6,
    ['apiserver_request_total'],
    true,
    fixed('sum by (verb) (rate(apiserver_request_total[5m]))')
  ),
  embedPanel(
    'apiserver-embed',
    'apiserver.embed.latency',
    '请求延迟分位',
    'line',
    'ms',
    6,
    ['apiserver_request_duration_seconds_bucket'],
    true,
    undefined,
    undefined,
    {
      quantileQueries: {
        metric: 'apiserver_request_duration_seconds_bucket',
        thresholds: [0.99, 0.9, 0.5],
        unitFactor: 1000
      },
      requiredMetricsAny: [
        'apiserver_request_duration_seconds_bucket',
        'apiserver_request_duration_seconds_sum',
        'apiserver_request_duration_seconds_count'
      ],
      fallbackQuery: fixed(apiserverLatencyFallbackQuery())
    }
  ),
  embedPanel(
    'apiserver-embed',
    'apiserver.embed.errors',
    '5xx 错误速率（按状态码）',
    'line',
    'ops',
    6,
    ['apiserver_request_total'],
    true,
    fixed('sum by (code) (rate(apiserver_request_total{code=~"5.."}[5m]))')
  ),
  embedPanel(
    'apiserver-embed',
    'apiserver.embed.process',
    '进程内存',
    'line',
    'bytes',
    6,
    ['process_resident_memory_bytes'],
    true,
    fixed('process_resident_memory_bytes{job="apiserver"}')
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
    fixed('max(workqueue_depth)')
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
    fixed('sum(rate(workqueue_adds_total[5m]))')
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
    fixed('sum(rate(workqueue_retries_total[5m]))')
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
    fixed('count(workqueue_depth)')
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
    fixed('topk(8, workqueue_depth)')
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
    fixed('sum by (name) (rate(workqueue_adds_total[5m]))')
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
      'histogram_quantile(0.99, sum(rate(workqueue_work_duration_seconds_bucket[5m])) by (le)) * 1000'
    )
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
    fixed('process_resident_memory_bytes{job="kube-controller-manager"}')
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
    fixed('sum(rate(scheduler_schedule_attempts_total[5m]))')
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
    )
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
    fixed('count(scheduler_schedule_attempts_total)')
  ),
  embedPanel(
    'scheduler-embed',
    'scheduler.embed.results',
    '调度结果分布',
    'line',
    'ops',
    6,
    ['scheduler_schedule_attempts_total'],
    true,
    fixed('sum by (result) (rate(scheduler_schedule_attempts_total[5m]))')
  ),
  embedPanel(
    'scheduler-embed',
    'scheduler.embed.latency',
    '端到端调度延迟分位',
    'line',
    'ms',
    6,
    ['scheduler_e2e_scheduling_duration_seconds_bucket'],
    true,
    undefined,
    undefined,
    {
      quantileQueries: {
        metric: 'scheduler_e2e_scheduling_duration_seconds_bucket',
        thresholds: [0.99, 0.9, 0.5],
        unitFactor: 1000
      },
      requiredMetricsAny: [
        'scheduler_e2e_scheduling_duration_seconds_bucket',
        'scheduler_e2e_scheduling_duration_seconds_sum',
        'scheduler_e2e_scheduling_duration_seconds_count'
      ],
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
    ['workqueue_depth'],
    true,
    fixed('workqueue_depth{job="kube-scheduler"}')
  ),
  embedPanel(
    'scheduler-embed',
    'scheduler.embed.process',
    '进程内存',
    'line',
    'bytes',
    6,
    ['process_resident_memory_bytes'],
    true,
    fixed('process_resident_memory_bytes{job="kube-scheduler"}')
  ),

  // ---- Node resource embed ----
  embedPanel(
    'node-resource-embed',
    'node.embed.ready',
    '节点健康状态',
    'status',
    '',
    6,
    ['kube_node_status_condition'],
    false,
    fixed('kube_node_status_condition{condition="Ready",status="true"} == 1')
  ),
  embedPanel(
    'node-resource-embed',
    'node.embed.pods',
    '节点 Pod 数',
    'bar',
    'short',
    6,
    ['kube_pod_info'],
    false,
    fixed('sort_desc(sum by (node) (kube_pod_info))')
  ),
  embedPanel(
    'node-resource-embed',
    'node.embed.cpu',
    '节点 CPU 使用率',
    'bar',
    'percent',
    6,
    ['container_cpu_usage_seconds_total', 'kube_node_status_allocatable'],
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
    ['container_memory_working_set_bytes', 'kube_node_status_allocatable'],
    false,
    fixed(
      'topk(10, 100 * sum by (node) (container_memory_working_set_bytes{container!=""}) / clamp_min(sum by (node) (kube_node_status_allocatable{resource="memory"}), 1))'
    )
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
    'short',
    6,
    ['kube_pod_container_status_restarts_total'],
    false,
    fixed(
      'topk(10, sum by (namespace,pod) (kube_pod_container_status_restarts_total))'
    )
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
  'apiserver.embed.latency',
  'apiserver.embed.errors',
  'apiserver.embed.process'
] as const

export const KUBELET_EMBED_PANEL_IDS = [
  'kubelet.embed.running_pods',
  'kubelet.embed.running_containers',
  'kubelet.embed.node_count',
  'kubelet.embed.runtime_error_rate',
  'kubelet.embed.operation_rate',
  'kubelet.embed.errors'
] as const

export const CONTROLLER_EMBED_PANEL_IDS = [
  'controller.embed.queue_depth',
  'controller.embed.adds_rate',
  'controller.embed.retries_rate',
  'controller.embed.replicas',
  'controller.embed.queue_top',
  'controller.embed.adds',
  'controller.embed.latency_p99',
  'controller.embed.process'
] as const

export const SCHEDULER_EMBED_PANEL_IDS = [
  'scheduler.embed.attempts_rate',
  'scheduler.embed.success_rate',
  'scheduler.embed.latency_p99',
  'scheduler.embed.replicas',
  'scheduler.embed.results',
  'scheduler.embed.latency',
  'scheduler.embed.queue_depth',
  'scheduler.embed.process'
] as const

export const NODE_RESOURCE_EMBED_PANEL_IDS = [
  'node.embed.ready',
  'node.embed.pods',
  'node.embed.cpu',
  'node.embed.memory'
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

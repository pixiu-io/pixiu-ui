import { resolveDatasourceUrl, type DatasourceItem } from '@/api/datasource'
import {
  buildPrometheusRequestOptions,
  fetchPrometheusInstantQuery,
  type PrometheusQueryOptions,
  type PrometheusQueryResponse
} from '@/api/kubernetes/prometheus'
import type { ClusterOverviewK8sStats } from '@/api/kubernetes/cluster-overview-stats'
import { loadPrometheusDatasource } from '@/utils/datasource/prometheus-datasource'

/**
 * 集群详情概览：节点 / 工作负载资源概览改用 Prometheus（kube-state-metrics）。
 *
 * 取代原先基于 k8s API 的 fetchClusterOverviewK8sStats。
 * 未关联 Prometheus 数据源或查询异常时返回全 0 结构，不阻塞页面。
 */

interface PrometheusContext {
  url: string
  options: PrometheusQueryOptions
}

const EMPTY_OVERVIEW: ClusterOverviewK8sStats = {
  nodes: { controlPlane: 0, worker: 0, total: 0 },
  workloads: { deployment: 0, statefulSet: 0, daemonSet: 0, cronJob: 0, job: 0 }
}

function emptyOverview(): ClusterOverviewK8sStats {
  return {
    nodes: { ...EMPTY_OVERVIEW.nodes },
    workloads: { ...EMPTY_OVERVIEW.workloads }
  }
}

function resolveContext(datasource: DatasourceItem): PrometheusContext {
  return {
    url: resolveDatasourceUrl(datasource),
    options: {
      ...buildPrometheusRequestOptions(datasource),
      skipErrorNotification: true
    }
  }
}

/** 即时查询取第一个 series 的 value 并取整；无数据 / 异常返回 0 */
function parseCount(response: PrometheusQueryResponse): number {
  if (response.status !== 'success') return 0
  const value = response.data?.result?.[0]?.value?.[1]
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.round(numeric)
}

async function safeQueryCount(context: PrometheusContext, expr: string): Promise<number> {
  try {
    const response = await fetchPrometheusInstantQuery(
      context.url,
      expr,
      undefined,
      context.options
    )
    return parseCount(response)
  } catch {
    return 0
  }
}

/**
 * 控制面节点数，带兼容回退（指标缺失 / 角色命名差异时尽力区分）：
 * 1. kube_node_role{role="control-plane"}
 * 2. kube_node_role{role="master"}（旧版本 kubeadm 角色）
 * 3. kube_node_labels 的 control-plane 标签
 * 4. kube_node_labels 的 master 标签
 * 全部无结果时返回 0，worker = total - controlPlane，total 始终正确。
 */
async function queryControlPlaneCount(context: PrometheusContext): Promise<number> {
  const candidates = [
    'count(kube_node_role{role="control-plane"})',
    'count(kube_node_role{role="master"})',
    'count(kube_node_labels{label_node_role_kubernetes_io_control_plane="true"})',
    'count(kube_node_labels{label_node_role_kubernetes_io_master="true"})'
  ]
  for (const expr of candidates) {
    const count = await safeQueryCount(context, expr)
    if (count > 0) return count
  }
  return 0
}

/**
 * 从 Prometheus（kube-state-metrics）获取集群资源概览。
 * 数据源缺失或任一项查询失败均按 0 处理，函数不抛异常。
 */
export async function fetchClusterResourceOverviewFromPrometheus(
  cluster: string
): Promise<ClusterOverviewK8sStats> {
  if (!cluster) return emptyOverview()

  try {
    const datasource = await loadPrometheusDatasource(cluster)
    if (!datasource) return emptyOverview()

    const context = resolveContext(datasource)
    const [total, controlPlane, deployment, statefulSet, daemonSet, cronJob, job] =
      await Promise.all([
        safeQueryCount(context, 'count(kube_node_info)'),
        queryControlPlaneCount(context),
        safeQueryCount(context, 'count(kube_deployment_created)'),
        safeQueryCount(context, 'count(kube_statefulset_created)'),
        safeQueryCount(context, 'count(kube_daemonset_created)'),
        safeQueryCount(context, 'count(kube_cronjob_created)'),
        safeQueryCount(context, 'count(kube_job_created)')
      ])

    const cp = Math.min(controlPlane, total)
    return {
      nodes: { controlPlane: cp, worker: Math.max(0, total - cp), total },
      workloads: { deployment, statefulSet, daemonSet, cronJob, job }
    }
  } catch {
    return emptyOverview()
  }
}

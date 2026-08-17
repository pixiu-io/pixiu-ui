import { type ComputedRef, type Ref, computed, ref, unref } from 'vue'
import { fetchKubeListAll } from '@/api/kubernetes/list'
import type { K8sNode } from '@/api/kubernetes/node'
import {
  getPodCpuRequestMillicores,
  parseNodeCpuMillicores,
  type MetricsPodSpec
} from '@/api/kubernetes/metrics'

/**
 * 集群 CPU Request 承诺率
 *
 * 全部 Pod 容器 CPU requests（毫核）与节点 allocatable CPU（毫核）的比值，
 * 反映集群资源被"承诺/预留"的比例，用于概览页用量情况仪表。
 */
export function useClusterRequestCommitment(clusterName: Ref<string> | ComputedRef<string>) {
  const cluster = computed(() => String(unref(clusterName) || '').trim())

  const loading = ref(false)
  const cpuRequestCommitPercent = ref(0)

  let refreshTimer: ReturnType<typeof setInterval> | null = null

  async function load(silent = false) {
    const name = cluster.value
    if (!name) {
      if (!silent) cpuRequestCommitPercent.value = 0
      return
    }

    if (!silent) loading.value = true
    try {
      const [nodesRes, podsRes] = await Promise.all([
        fetchKubeListAll<K8sNode>(name, `/pixiu/proxy/${encodeURIComponent(name)}/api/v1/nodes`, {
          silence403: true
        }),
        fetchKubeListAll<MetricsPodSpec>(
          name,
          `/pixiu/proxy/${encodeURIComponent(name)}/api/v1/pods`,
          { silence403: true }
        )
      ])

      const allocatableMillicores = (nodesRes.items ?? []).reduce(
        (sum, n) => sum + parseNodeCpuMillicores(n.status?.allocatable?.cpu),
        0
      )
      const requestsMillicores = (podsRes.items ?? []).reduce(
        (sum, p) => sum + getPodCpuRequestMillicores(p),
        0
      )

      cpuRequestCommitPercent.value =
        requestsMillicores > 0 && allocatableMillicores > 0
          ? +((requestsMillicores / allocatableMillicores) * 100).toFixed(2)
          : 0
    } catch {
      if (!silent) cpuRequestCommitPercent.value = 0
    } finally {
      if (!silent) loading.value = false
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

  /** 手动刷新：静默拉数（不整页 loading） */
  function refresh() {
    return load(true)
  }

  return {
    loading,
    cpuRequestCommitPercent,
    startRefresh,
    stopRefresh,
    refresh
  }
}

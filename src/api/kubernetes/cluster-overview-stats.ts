import { kubeProxyAxios } from '@/api/kubeProxy'
import type { K8sNode } from './node'
import yaml from 'js-yaml'

/** 与 nodes.vue 对齐：管控面节点识别（用于单节点详情等场景） */
export function isK8sControlPlaneNode(node: K8sNode): boolean {
  const labels = node.metadata?.labels ?? {}
  return (
    'node-role.kubernetes.io/control-plane' in labels || 'node-role.kubernetes.io/master' in labels
  )
}

export interface ClusterOverviewK8sNodeSplit {
  controlPlane: number
  worker: number
  total: number
}

export interface ClusterOverviewK8sWorkloadCounts {
  deployment: number
  statefulSet: number
  daemonSet: number
  cronJob: number
  job: number
}

export interface ClusterOverviewK8sStats {
  nodes: ClusterOverviewK8sNodeSplit
  workloads: ClusterOverviewK8sWorkloadCounts
}

/**
 * 概览页：节点管控/工作划分 + 工作负载数量。
 * 使用 list limit=1 + remainingItemCount 仅取总数，不拉全量列表。
 */
export interface ClusterBasicNetwork {
  serviceCidr: string
  clusterDns: string
  podCidr: string
}

/** 从 kubeadm-config ConfigMap 解析网络配置（不存在则返回 '-'） */
export async function fetchClusterBasicNetwork(cluster: string): Promise<ClusterBasicNetwork> {
  const empty: ClusterBasicNetwork = { serviceCidr: '-', clusterDns: '-', podCidr: '-' }
  if (!cluster) return empty
  try {
    const { data } = await kubeProxyAxios.get<{ data?: Record<string, string> }>(
      `/pixiu/proxy/${encodeURIComponent(cluster)}/api/v1/namespaces/kube-system/configmaps/kubeadm-config`,
      { silence403: true } as any
    )
    const yamlText = data.data?.ClusterConfiguration ?? ''
    if (!yamlText) return empty
    const serviceSubnet = yamlText.match(/serviceSubnet:\s*(\S+)/)?.[1]
    const podSubnet = yamlText.match(/podSubnet:\s*(\S+)/)?.[1]
    const dnsDomain = yamlText.match(/dnsDomain:\s*(\S+)/)?.[1]
    return {
      serviceCidr: serviceSubnet ?? '-',
      clusterDns: dnsDomain ?? '-',
      podCidr: podSubnet ?? '-'
    }
  } catch {
    return empty
  }
}

export interface ClusterDetailInfo {
  osImage: string
  containerRuntime: string
  kubeProxyMode: string
  apiServerPort: string
  haMode: string
  cni: string
}

const KNOWN_CNI_PLUGINS = ['calico', 'flannel', 'cilium', 'weave', 'kube-router', 'canal', 'multus']

/** 通过 kube-system 下的 Deployment 名称识别 CNI 类型 */
export async function detectCniFromDeployments(cluster: string): Promise<string> {
  if (!cluster) return '-'
  try {
    const c = encodeURIComponent(cluster)
    const { data } = await kubeProxyAxios.get<{ items: Array<{ metadata?: { name?: string } }> }>(
      `/pixiu/proxy/${c}/apis/apps/v1/namespaces/kube-system/deployments`,
      { silence403: true } as any
    )
    for (const deploy of data.items ?? []) {
      const name = (deploy.metadata?.name ?? '').toLowerCase()
      for (const cni of KNOWN_CNI_PLUGINS) {
        if (name.includes(cni)) return cni
      }
    }
    return '-'
  } catch {
    return '-'
  }
}

/** 从节点信息和 kube-proxy ConfigMap 获取集群详情 */
export async function fetchClusterDetailInfo(
  cluster: string,
  kubeConfig?: string
): Promise<ClusterDetailInfo> {
  const empty: ClusterDetailInfo = {
    osImage: '-',
    containerRuntime: '-',
    kubeProxyMode: 'iptables',
    apiServerPort: '6443',
    haMode: '-',
    cni: '-'
  }
  if (!cluster) return empty
  try {
    const c = encodeURIComponent(cluster)
    // 从 kubeconfig 解析 api server 端口
    if (kubeConfig) {
      try {
        const kc = yaml.load(kubeConfig) as { clusters?: Array<{ cluster?: { server?: string } }> }
        const server = kc?.clusters?.[0]?.cluster?.server
        if (server) {
          const url = new URL(server)
          if (url.port) empty.apiServerPort = url.port
        }
      } catch {
        // 解析 kubeconfig 失败时忽略，apiServerPort 保持默认
      }
    }
    const { data: nodeRes } = await kubeProxyAxios.get<{ items: K8sNode[] }>(
      `/pixiu/proxy/${c}/api/v1/nodes?limit=1`,
      { silence403: true, skipErrorNotification: true } as any
    )
    const firstNode = nodeRes.items?.[0]
    if (firstNode) {
      empty.osImage = firstNode.status?.nodeInfo?.osImage ?? '-'
      empty.containerRuntime = firstNode.status?.nodeInfo?.containerRuntimeVersion ?? '-'
      const { data: allNodesRes } = await kubeProxyAxios.get<{ items: K8sNode[] }>(
        `/pixiu/proxy/${c}/api/v1/nodes`,
        { silence403: true, skipErrorNotification: true } as any
      )
      const cpCount = (allNodesRes.items ?? []).filter(isK8sControlPlaneNode).length
      empty.haMode = cpCount > 1 ? 'ha' : 'single'
    }
    try {
      const { data: kpConfig } = await kubeProxyAxios.get<{ data?: Record<string, string> }>(
        `/pixiu/proxy/${c}/api/v1/namespaces/kube-system/configmaps/kube-proxy`,
        { silence403: true } as any
      )
      const kpYaml =
        kpConfig.data?.config ?? kpConfig.data?.Config ?? kpConfig.data?.config_conf ?? ''
      const mode = kpYaml.match(/mode:\s*(\S+)/)?.[1]
      if (mode) empty.kubeProxyMode = mode
    } catch {
      // 获取 kube-proxy configmap 失败时忽略，kubeProxyMode 保持默认
    }
    empty.cni = await detectCniFromDeployments(cluster)
  } catch {
    // 节点信息获取失败时忽略，保持 empty 默认值
  }
  return empty
}

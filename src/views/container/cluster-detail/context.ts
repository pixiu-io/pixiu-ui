import type { InjectionKey, ComputedRef, Ref } from 'vue'

/** 集群详情页注入上下文（query 仅 cluster=；展示字段由接口按 name 拉取） */
export interface ClusterDetailContext {
  /** 后端集群资源名，对应 query `cluster` */
  name: string
  /** 展示名称（别名） */
  aliasName: string
  /** Pixiu 集群 ID */
  id: number
  resourceVersion: number
  /** 与列表一致的 ClusterStatus */
  status: number
  version: string
  /** 0 导入集群，1 自建集群 */
  clusterType: number
  planId: number
  isProtected: boolean
  createTime: string
  nodeCount: number
  nodeReady: number
  nodeNotReady: number
  permissionId: number
  /** 由 name 派生的稳定整数，用于 Mock 图表/表格 */
  seed: number
}

export const clusterDetailContextKey: InjectionKey<ComputedRef<ClusterDetailContext>> =
  Symbol('clusterDetailContext')

export interface ClusterDetailNamespaceContext {
  namespace: Ref<string>
  namespaceOptions: Ref<string[]>
}

export const clusterDetailNamespaceKey: InjectionKey<ClusterDetailNamespaceContext> =
  Symbol('clusterDetailNamespace')

/** 刷新当前集群详情（别名、保护状态等变更后） */
export const clusterDetailRefreshKey: InjectionKey<() => Promise<void>> = Symbol('clusterDetailRefresh')

/** 将集群名哈希为稳定非负整数，供演示数据使用 */
export function clusterNameSeed(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return h
}

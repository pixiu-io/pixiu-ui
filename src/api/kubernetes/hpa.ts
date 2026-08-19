import { kubeProxyAxios } from '@/api/kubeProxy'

/** autoscaling/v2 HorizontalPodAutoscaler（与 kubectl get hpa -A 一致） */
export interface K8sCrossVersionObjectReference {
  kind?: string
  name?: string
  apiVersion?: string
}

export interface K8sMetricTarget {
  type?: string
  averageUtilization?: number
  averageValue?: string
  value?: string
}

export interface K8sMetricSpec {
  type?: string
  resource?: {
    name?: string
    target?: K8sMetricTarget
  }
  pods?: { metric?: { name?: string }; target?: K8sMetricTarget }
  object?: {
    metric?: { name?: string }
    describedObject?: K8sCrossVersionObjectReference
    target?: K8sMetricTarget
  }
  external?: { metric?: { name?: string }; target?: K8sMetricTarget }
}

export interface K8sMetricStatus {
  type?: string
  resource?: {
    name?: string
    current?: { averageUtilization?: number; averageValue?: string }
  }
  pods?: { metric?: { name?: string }; current?: { averageValue?: string } }
  object?: { metric?: { name?: string }; current?: { value?: string } }
  external?: { metric?: { name?: string }; current?: { value?: string } }
}

export interface K8sHorizontalPodAutoscaler {
  metadata?: {
    name?: string
    namespace?: string
    uid?: string
    creationTimestamp?: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  spec?: {
    scaleTargetRef?: K8sCrossVersionObjectReference
    minReplicas?: number
    maxReplicas?: number
    metrics?: K8sMetricSpec[]
  }
  status?: {
    currentReplicas?: number
    desiredReplicas?: number
    currentMetrics?: K8sMetricStatus[]
  }
}

type ListResp = { items?: K8sHorizontalPodAutoscaler[]; metadata?: { continue?: string } }

function hpaCollectionPath(cluster: string, namespace?: string): string {
  const c = encodeURIComponent(cluster)
  if (namespace) {
    return `/pixiu/proxy/${c}/apis/autoscaling/v2/namespaces/${encodeURIComponent(namespace)}/horizontalpodautoscalers`
  }
  return `/pixiu/proxy/${c}/apis/autoscaling/v2/horizontalpodautoscalers`
}

function hpaItemPath(cluster: string, namespace: string, name: string): string {
  return `${hpaCollectionPath(cluster, namespace)}/${encodeURIComponent(name)}`
}

async function listAllHpas(
  cluster: string,
  namespace?: string
): Promise<K8sHorizontalPodAutoscaler[]> {
  const path = hpaCollectionPath(cluster, namespace)
  const all: K8sHorizontalPodAutoscaler[] = []
  let continueToken: string | undefined
  do {
    const params: Record<string, string> = { limit: '500' }
    if (continueToken) params.continue = continueToken
    const { data } = await kubeProxyAxios.get<ListResp>(path, { params })
    all.push(...(data.items ?? []))
    continueToken = data.metadata?.continue || undefined
  } while (continueToken)
  return all
}

export async function fetchK8sHpaList(
  cluster: string,
  params: { page: number; limit: number; namespace?: string; name?: string }
): Promise<{ items: K8sHorizontalPodAutoscaler[]; total: number }> {
  const page = Math.max(1, params.page || 1)
  const limit = Math.max(1, params.limit || 10)
  let all = await listAllHpas(cluster, params.namespace || undefined)
  const q = (params.name ?? '').trim().toLowerCase()
  if (q) {
    all = all.filter((i) => (i.metadata?.name ?? '').toLowerCase().includes(q))
  }
  const total = all.length
  const start = (page - 1) * limit
  return { items: all.slice(start, start + limit), total }
}

export async function fetchK8sHpa(
  cluster: string,
  namespace: string,
  name: string
): Promise<K8sHorizontalPodAutoscaler> {
  const { data } = await kubeProxyAxios.get<K8sHorizontalPodAutoscaler>(
    hpaItemPath(cluster, namespace, name)
  )
  return data
}

export async function createK8sHpa(
  cluster: string,
  namespace: string,
  body: object
): Promise<K8sHorizontalPodAutoscaler> {
  const { data } = await kubeProxyAxios.post<K8sHorizontalPodAutoscaler>(
    hpaCollectionPath(cluster, namespace),
    body,
    { skipErrorNotification: true } as any
  )
  return data
}

export async function updateK8sHpa(
  cluster: string,
  namespace: string,
  name: string,
  body: object
): Promise<K8sHorizontalPodAutoscaler> {
  const { data } = await kubeProxyAxios.put<K8sHorizontalPodAutoscaler>(
    hpaItemPath(cluster, namespace, name),
    body
  )
  return data
}

// ── 暂停/恢复：原生 HPA 无暂停开关，以 min=max=当前副本锁定模拟 ──
// 暂停前的 min/max 存入 annotation，恢复时还原
export const HPA_PAUSED_MIN_ANNOTATION = 'autoscaling.pixiu.io/paused-min-replicas'
export const HPA_PAUSED_MAX_ANNOTATION = 'autoscaling.pixiu.io/paused-max-replicas'
// 创建 HPA 时记录目标工作负载的当前副本数，供执行历史推算最早一条伸缩事件的变更前副本数
export const HPA_INITIAL_REPLICAS_ANNOTATION = 'autoscaling.pixiu.io/initial-replicas'

/** 是否处于暂停态（以是否存在锁定 annotation 判定） */
export function isK8sHpaPaused(hpa: K8sHorizontalPodAutoscaler): boolean {
  return hpa.metadata?.annotations?.[HPA_PAUSED_MIN_ANNOTATION] !== undefined
}

/**
 * 暂停：min/max 锁定为当前副本数（HPA 不再伸缩），原 min/max 记入 annotation；
 * 恢复：从 annotation 还原 min/max 并移除标记。
 */
export async function setK8sHpaPaused(
  cluster: string,
  namespace: string,
  name: string,
  paused: boolean
): Promise<void> {
  const hpa = await fetchK8sHpa(cluster, namespace, name)
  const annotations = { ...(hpa.metadata?.annotations ?? {}) }
  if (paused) {
    const oldMin = hpa.spec?.minReplicas ?? 1
    const oldMax = hpa.spec?.maxReplicas ?? oldMin
    // 锁定到当前实际副本；采集不到时退回原 min，避免锁到 0
    const pin = hpa.status?.currentReplicas || oldMin
    annotations[HPA_PAUSED_MIN_ANNOTATION] = String(oldMin)
    annotations[HPA_PAUSED_MAX_ANNOTATION] = String(oldMax)
    hpa.spec = { ...hpa.spec, minReplicas: pin, maxReplicas: pin }
  } else {
    const min = Number(annotations[HPA_PAUSED_MIN_ANNOTATION])
    const max = Number(annotations[HPA_PAUSED_MAX_ANNOTATION])
    delete annotations[HPA_PAUSED_MIN_ANNOTATION]
    delete annotations[HPA_PAUSED_MAX_ANNOTATION]
    hpa.spec = {
      ...hpa.spec,
      // annotation 缺失或非法时保持现状，仅解除锁定标记
      minReplicas: Number.isFinite(min) && min > 0 ? min : (hpa.spec?.minReplicas ?? 1),
      maxReplicas:
        Number.isFinite(max) && max > 0 ? max : (hpa.spec?.maxReplicas ?? hpa.spec?.minReplicas)
    }
  }
  hpa.metadata = { ...hpa.metadata, annotations }
  await updateK8sHpa(cluster, namespace, name, hpa)
}

export async function deleteK8sHpa(
  cluster: string,
  namespace: string,
  name: string
): Promise<void> {
  await kubeProxyAxios.delete(hpaItemPath(cluster, namespace, name))
}

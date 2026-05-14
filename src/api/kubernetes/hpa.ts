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

async function listAllHpas(cluster: string, namespace?: string): Promise<K8sHorizontalPodAutoscaler[]> {
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

export async function fetchK8sHpa(cluster: string, namespace: string, name: string): Promise<K8sHorizontalPodAutoscaler> {
  const { data } = await kubeProxyAxios.get<K8sHorizontalPodAutoscaler>(hpaItemPath(cluster, namespace, name))
  return data
}

export async function deleteK8sHpa(cluster: string, namespace: string, name: string): Promise<void> {
  await kubeProxyAxios.delete(hpaItemPath(cluster, namespace, name))
}

import type { K8sPod } from '@/api/kubernetes/pod'

/** 与 kubectl get pod 的 STATUS 列对齐：phase 为 Succeeded 时展示 Completed */
export function formatPodDisplayStatus(pod: K8sPod): string {
  if (pod.metadata?.deletionTimestamp) return 'Terminating'
  const phase = pod.status?.phase
  if (phase === 'Succeeded') return 'Completed'
  if (phase === 'Completed') return 'Completed'

  const containers = pod.status?.containerStatuses ?? []
  if (
    containers.length > 0 &&
    containers.every((c) => {
      const reason = (c as { state?: { terminated?: { reason?: string } } }).state?.terminated
        ?.reason
      return reason === 'Completed'
    })
  ) {
    return 'Completed'
  }

  return phase || '未知'
}

export function isPodCompleted(pod: K8sPod): boolean {
  return formatPodDisplayStatus(pod) === 'Completed'
}

export function podStatusTagType(
  status: string
): 'success' | 'warning' | 'info' | 'danger' {
  if (status === 'Running') return 'success'
  if (status === 'Pending' || status === 'Terminating') return 'warning'
  if (status === 'Failed') return 'danger'
  return 'info'
}

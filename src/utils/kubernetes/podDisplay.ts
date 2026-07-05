import type { K8sContainerStatus, K8sPod } from '@/api/kubernetes/pod'

function findContainerStatus(
  name: string | undefined,
  statuses: K8sContainerStatus[] | undefined
): K8sContainerStatus | undefined {
  if (!statuses?.length) return undefined
  if (name) {
    const found = statuses.find((s) => s.name === name)
    if (found) return found
  }
  return undefined
}

/** 从单个容器状态提取 kubectl STATUS 列展示用的 reason */
function containerStatusReason(status?: K8sContainerStatus): string | undefined {
  const state = status?.state
  if (!state) return undefined
  if (state.waiting?.reason) return state.waiting.reason
  const terminated = state.terminated
  if (terminated) {
    if (terminated.reason) return terminated.reason
    if (terminated.exitCode === 0) return 'Completed'
    return 'Error'
  }
  return undefined
}

function isInitContainerCompleted(status?: K8sContainerStatus): boolean {
  const terminated = status?.state?.terminated
  if (!terminated) return false
  if (terminated.reason === 'Completed') return true
  return terminated.exitCode === 0 && !terminated.reason
}

/** 与 kubectl get pod 的 STATUS 列对齐 */
export function formatPodDisplayStatus(pod: K8sPod): string {
  if (pod.metadata?.deletionTimestamp) return 'Terminating'

  const phase = pod.status?.phase
  if (phase === 'Succeeded') return 'Completed'
  if (phase === 'Completed') return 'Completed'

  const containerStatuses = pod.status?.containerStatuses ?? []
  if (
    containerStatuses.length > 0 &&
    containerStatuses.every((c) => containerStatusReason(c) === 'Completed')
  ) {
    return 'Completed'
  }

  const initContainers = pod.spec?.initContainers ?? []
  const initStatuses = pod.status?.initContainerStatuses ?? []
  if (initContainers.length > 0) {
    for (const ic of initContainers) {
      const st = findContainerStatus(ic.name, initStatuses)
      if (isInitContainerCompleted(st)) continue
      return containerStatusReason(st) || 'PodInitializing'
    }
  }

  let reason = pod.status?.reason || phase || '未知'
  const specContainers = pod.spec?.containers ?? []
  for (let i = specContainers.length - 1; i >= 0; i--) {
    const name = specContainers[i]?.name
    const st = findContainerStatus(name, containerStatuses) ?? containerStatuses[i]
    const cr = containerStatusReason(st)
    if (cr) {
      reason = cr
      break
    }
  }

  return reason
}

export function isPodCompleted(pod: K8sPod): boolean {
  return formatPodDisplayStatus(pod) === 'Completed'
}

const POD_STATUS_DANGER = new Set([
  'Failed',
  'Error',
  'CrashLoopBackOff',
  'ImagePullBackOff',
  'ErrImagePull',
  'CreateContainerConfigError',
  'CreateContainerError',
  'InvalidImageName',
  'OOMKilled',
  'Evicted'
])

const POD_STATUS_WARNING = new Set([
  'Pending',
  'Terminating',
  'ContainerCreating',
  'PodInitializing',
  'Unknown'
])

export function podStatusTagType(
  status: string
): 'success' | 'warning' | 'info' | 'danger' {
  if (status === 'Running' || status === 'Completed') return 'success'
  if (POD_STATUS_DANGER.has(status) || status.endsWith('BackOff') || status.startsWith('Err')) {
    return 'danger'
  }
  if (POD_STATUS_WARNING.has(status)) return 'warning'
  return 'info'
}

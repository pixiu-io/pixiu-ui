/**
 * 根据 K8s 集群版本返回 CronJob API 版本。
 * - >= 1.21: batch/v1 (GA since k8s 1.21)
 * - <  1.21: batch/v1beta1
 * - 无法解析时返回空字符串，调用方应跳过 CronJob 请求
 */
export function getCronJobApiVersion(k8sVersion?: string): string {
  if (!k8sVersion || k8sVersion === '-') return ''
  try {
    const parts = k8sVersion.replace(/^v/, '').split('.')
    const major = parseInt(parts[0]!, 10)
    const minor = parseInt(parts[1]!, 10)
    if (isNaN(major) || isNaN(minor)) return ''
    if (major > 1 || (major === 1 && minor >= 21)) return 'batch/v1'
    return 'batch/v1beta1'
  } catch {
    return ''
  }
}

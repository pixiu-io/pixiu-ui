import { ElMessage } from 'element-plus'
import { isHttpError, type HttpError } from '@/utils/http/error'
import { PixiuApiError } from '@/api/container'

/** 是否已由 HTTP 层提示过错误，页面无需重复提示 */
export function isErrorNotified(e: unknown): boolean {
  if (e instanceof PixiuApiError && e.notified) return true
  if (isHttpError(e)) {
    const h = e as HttpError & { toasted?: boolean; handled?: boolean }
    if (h.toasted || h.handled) return true
  }
  return false
}

/** 统一错误提示：已提示过的错误跳过，否则弹一次 */
export function notifyError(e: unknown, fallback?: string): void {
  if (isErrorNotified(e)) return
  const msg =
    typeof e === 'string' ? e : (e instanceof Error ? e.message : '') || fallback || '操作失败'
  ElMessage.error(msg)
}

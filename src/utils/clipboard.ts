/**
 * 复制文本到剪贴板。
 * Clipboard API 仅在安全上下文（HTTPS / localhost）可用；
 * HTTP 等场景回退到 textarea + execCommand。
 */
export async function copyText(text: string): Promise<boolean> {
  const value = String(text ?? '')
  if (!value) return false

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      // 权限被拒或非安全上下文异常时走回退
    }
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '0'
    document.body.appendChild(textarea)
    textarea.select()
    textarea.setSelectionRange(0, value.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}

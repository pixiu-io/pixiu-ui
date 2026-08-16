/**
 * 锁屏密码加解密（Web Crypto AES-GCM）
 * 替代已停更的 crypto-js。
 *
 * 密文格式：`v1.<ivBase64>.<cipherBase64>`
 * 与旧版 CryptoJS AES 密文不兼容；升级后需重新设置锁屏密码。
 */

const TEXT = new TextEncoder()
const DECODE = new TextDecoder()
const SALT = TEXT.encode('pixiu-lock-v1')

async function deriveKey(secret: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', TEXT.encode(secret), 'PBKDF2', false, [
    'deriveKey'
  ])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: 100_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]!)
  return btoa(s)
}

function fromBase64(b64: string): Uint8Array {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

/** 加密锁屏密码 */
export async function encryptLockPassword(password: string, secret: string): Promise<string> {
  if (!secret) throw new Error('VITE_LOCK_ENCRYPT_KEY is empty')
  const key = await deriveKey(secret)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, TEXT.encode(password))
  return `v1.${toBase64(iv)}.${toBase64(cipher)}`
}

/** 解密锁屏密码；失败返回 null */
export async function decryptLockPassword(payload: string, secret: string): Promise<string | null> {
  try {
    if (!secret || !payload.startsWith('v1.')) return null
    const parts = payload.split('.')
    if (parts.length !== 3) return null
    const [, ivB64, cipherB64] = parts
    if (!ivB64 || !cipherB64) return null
    const key = await deriveKey(secret)
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(ivB64) },
      key,
      fromBase64(cipherB64)
    )
    return DECODE.decode(plain)
  } catch {
    return null
  }
}

/** 校验输入密码是否匹配已存密文 */
export async function verifyLockPassword(
  inputPassword: string,
  storedPayload: string,
  secret: string
): Promise<boolean> {
  const plain = await decryptLockPassword(storedPayload, secret)
  return plain !== null && plain === inputPassword
}

/**
 * Ingress API GroupVersion 协商与 v1 / v1beta1 结构转换。
 *
 * 时间线：
 * - >= 1.19: networking.k8s.io/v1 (GA)
 * - >= 1.14: networking.k8s.io/v1beta1
 * - <  1.14: extensions/v1beta1
 */

export const INGRESS_API_V1 = 'networking.k8s.io/v1'
export const INGRESS_API_V1BETA1 = 'networking.k8s.io/v1beta1'
export const INGRESS_API_EXTENSIONS = 'extensions/v1beta1'

/** Discovery 探测顺序：新 → 旧 */
export const INGRESS_API_CANDIDATES = [
  INGRESS_API_V1,
  INGRESS_API_V1BETA1,
  INGRESS_API_EXTENSIONS
] as const

/**
 * Discovery 失败时按集群版本兜底。
 * 无法解析时默认 v1（与当前主流集群一致）。
 */
export function getIngressApiVersionFallback(k8sVersion?: string): string {
  if (!k8sVersion || k8sVersion === '-') return INGRESS_API_V1
  try {
    const parts = k8sVersion.replace(/^v/, '').split('.')
    const major = parseInt(parts[0]!, 10)
    const minor = parseInt(parts[1]!, 10)
    if (isNaN(major) || isNaN(minor)) return INGRESS_API_V1
    if (major > 1 || (major === 1 && minor >= 19)) return INGRESS_API_V1
    if (major === 1 && minor >= 14) return INGRESS_API_V1BETA1
    return INGRESS_API_EXTENSIONS
  } catch {
    return INGRESS_API_V1
  }
}

export function isIngressV1(groupVersion: string): boolean {
  return groupVersion === INGRESS_API_V1
}

type AnyRecord = Record<string, any>

function convertBackendToV1(backend: AnyRecord | undefined): AnyRecord | undefined {
  if (!backend) return undefined
  // already v1
  if (backend.service || backend.resource) return backend
  const serviceName = backend.serviceName
  const servicePort = backend.servicePort
  if (!serviceName && servicePort == null) return backend
  const port: AnyRecord = {}
  if (typeof servicePort === 'number') port.number = servicePort
  else if (typeof servicePort === 'string') {
    const n = Number(servicePort)
    if (!Number.isNaN(n) && String(n) === servicePort) port.number = n
    else port.name = servicePort
  }
  return {
    service: {
      name: serviceName,
      ...(Object.keys(port).length ? { port } : {})
    }
  }
}

function convertBackendToV1Beta1(backend: AnyRecord | undefined): AnyRecord | undefined {
  if (!backend) return undefined
  // already v1beta1
  if (backend.serviceName != null || backend.servicePort != null) return backend
  const svc = backend.service
  if (!svc) return backend
  const port = svc.port?.number ?? svc.port?.name
  return {
    serviceName: svc.name,
    ...(port != null ? { servicePort: port } : {})
  }
}

/** 将任意版本 Ingress 规范为 UI 使用的 v1 形态 */
export function normalizeIngressToV1(obj: AnyRecord): AnyRecord {
  if (!obj || typeof obj !== 'object') return obj
  const out: AnyRecord = { ...obj, apiVersion: INGRESS_API_V1, kind: obj.kind || 'Ingress' }
  const spec = obj.spec ? { ...obj.spec } : undefined
  if (!spec) return out

  if (spec.backend && !spec.defaultBackend) {
    spec.defaultBackend = convertBackendToV1(spec.backend)
    delete spec.backend
  } else if (spec.defaultBackend) {
    spec.defaultBackend = convertBackendToV1(spec.defaultBackend)
  }

  if (Array.isArray(spec.rules)) {
    spec.rules = spec.rules.map((rule: AnyRecord) => {
      const http = rule.http
      if (!http?.paths) return rule
      return {
        ...rule,
        http: {
          ...http,
          paths: http.paths.map((p: AnyRecord) => ({
            ...p,
            pathType: p.pathType || 'ImplementationSpecific',
            backend: convertBackendToV1(p.backend)
          }))
        }
      }
    })
  }

  // v1beta1 注解 → ingressClassName
  if (!spec.ingressClassName) {
    const ann = obj.metadata?.annotations || {}
    const cls = ann['kubernetes.io/ingress.class']
    if (cls) spec.ingressClassName = cls
  }

  out.spec = spec
  return out
}

/** 将 UI v1 形态转为目标 API 版本写入形态 */
export function denormalizeIngressFromV1(obj: AnyRecord, groupVersion: string): AnyRecord {
  if (isIngressV1(groupVersion)) {
    return { ...obj, apiVersion: INGRESS_API_V1, kind: 'Ingress' }
  }

  const out: AnyRecord = {
    ...obj,
    apiVersion: groupVersion,
    kind: 'Ingress'
  }
  const spec = obj.spec ? { ...obj.spec } : undefined
  if (!spec) return out

  if (spec.defaultBackend) {
    spec.backend = convertBackendToV1Beta1(spec.defaultBackend)
    delete spec.defaultBackend
  }
  if (spec.backend) {
    spec.backend = convertBackendToV1Beta1(spec.backend)
  }

  if (Array.isArray(spec.rules)) {
    spec.rules = spec.rules.map((rule: AnyRecord) => {
      const http = rule.http
      if (!http?.paths) return rule
      return {
        ...rule,
        http: {
          ...http,
          paths: http.paths.map((p: AnyRecord) => {
            const next: AnyRecord = {
              ...p,
              backend: convertBackendToV1Beta1(p.backend)
            }
            // pathType 在较新 v1beta1 可用；保留有助于行为一致
            if (!next.pathType) next.pathType = 'ImplementationSpecific'
            return next
          })
        }
      }
    })
  }

  // ingressClassName → 注解（旧 API）
  if (spec.ingressClassName) {
    const metadata = { ...(out.metadata || {}) }
    const annotations = { ...(metadata.annotations || {}) }
    if (!annotations['kubernetes.io/ingress.class']) {
      annotations['kubernetes.io/ingress.class'] = spec.ingressClassName
    }
    metadata.annotations = annotations
    out.metadata = metadata
    delete spec.ingressClassName
  }

  out.spec = spec
  return out
}

/** patch 对象同样需要按目标版本转换 spec 字段 */
export function denormalizeIngressPatchFromV1(patch: AnyRecord, groupVersion: string): AnyRecord {
  if (isIngressV1(groupVersion) || !patch) return patch
  const out: AnyRecord = { ...patch }
  if (patch.metadata) out.metadata = { ...patch.metadata }
  if (patch.spec) {
    // 复用完整对象转换逻辑
    const converted = denormalizeIngressFromV1(
      { apiVersion: INGRESS_API_V1, kind: 'Ingress', spec: patch.spec },
      groupVersion
    )
    out.spec = converted.spec
    if (converted.metadata?.annotations) {
      out.metadata = {
        ...(out.metadata || {}),
        annotations: {
          ...(out.metadata?.annotations || {}),
          ...converted.metadata.annotations
        }
      }
    }
  }
  return out
}

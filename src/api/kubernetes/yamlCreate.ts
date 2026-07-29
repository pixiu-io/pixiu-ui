import { isAxiosError } from 'axios'
import yaml from 'js-yaml'
import { kubeProxyAxios } from '@/api/kubeProxy'
import { PixiuApiError } from '@/api/container'

function checkEmpty(_name: string, value: unknown): boolean {
  return value === undefined || value === '' || value === null
}

function k8sErrorMessage(err: unknown): string {
  if (!isAxiosError(err) || !err.response) return err instanceof Error ? err.message : '请求失败'
  const d = err.response.data as { message?: string; reason?: string; status?: string }
  return d?.message || d?.reason || d?.status || err.message || '请求失败'
}

// kind → resource name (lowercase plural) for well-known K8s resources
const KIND_RESOURCE_MAP: Record<string, string> = {
  Namespace: 'namespaces',
  Node: 'nodes',
  ServiceAccount: 'serviceaccounts',
  ConfigMap: 'configmaps',
  Secret: 'secrets',
  PersistentVolume: 'persistentvolumes',
  PersistentVolumeClaim: 'persistentvolumeclaims',
  StorageClass: 'storageclasses',
  Pod: 'pods',
  Service: 'services',
  Endpoints: 'endpoints',
  Ingress: 'ingresses',
  Deployment: 'deployments',
  StatefulSet: 'statefulsets',
  DaemonSet: 'daemonsets',
  ReplicaSet: 'replicasets',
  Job: 'jobs',
  CronJob: 'cronjobs',
  HorizontalPodAutoscaler: 'horizontalpodautoscalers',
  ClusterRole: 'clusterroles',
  ClusterRoleBinding: 'clusterrolebindings',
  Role: 'roles',
  RoleBinding: 'rolebindings',
  CustomResourceDefinition: 'customresourcedefinitions',
  NetworkPolicy: 'networkpolicies',
  ResourceQuota: 'resourcequotas',
  LimitRange: 'limitranges',
  Event: 'events',
}

// cluster-scoped resources (don't need namespace)
const CLUSTER_SCOPED_KINDS = new Set([
  'Namespace', 'Node', 'PersistentVolume', 'ClusterRole', 'ClusterRoleBinding',
  'StorageClass', 'CustomResourceDefinition',
])

function kindToResource(kind: string): string {
  if (KIND_RESOURCE_MAP[kind]) return KIND_RESOURCE_MAP[kind]
  return (kind.endsWith('s') ? kind.toLowerCase() : kind.toLowerCase() + 's')
}

function resolveResourceUrl(yamlData: Record<string, unknown>): {
  url: string
  name: string
} {
  const kind = yamlData.kind as string | undefined
  const apiVersion = yamlData.apiVersion as string | undefined
  const metadata = yamlData.metadata as { name?: string; namespace?: string } | undefined
  const name = metadata?.name

  if (checkEmpty('kind', kind)) throw new Error('kind 为必填项')
  if (checkEmpty('apiVersion', apiVersion)) throw new Error('apiVersion 为必填项')
  if (!name) throw new Error('metadata.name 为必填项')

  const apiVersionStr = apiVersion as string
  // v1 → /api/v1, {group}/{version} → /apis/{group}/{version}
  const groupPath = apiVersionStr.includes('/')
    ? `/apis/${apiVersionStr}`
    : `/api/${apiVersionStr}`

  const resource = kindToResource(kind as string)
  let url = `${groupPath}/${resource}`

  if (!CLUSTER_SCOPED_KINDS.has(kind as string)) {
    const namespace = metadata?.namespace
    if (namespace) {
      url = `${groupPath}/namespaces/${encodeURIComponent(namespace)}/${resource}`
    }
  }

  return { url, name }
}

function parseYamlDocuments(yamlText: string): Record<string, unknown>[] {
  const trimmed = yamlText.trim()
  if (!trimmed) {
    throw new Error('YAML 创建资源不能为空')
  }

  try {
    const docs: Record<string, unknown>[] = []
    for (const doc of yaml.loadAll(trimmed)) {
      if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) continue
      docs.push(doc as Record<string, unknown>)
    }
    if (docs.length === 0) {
      throw new Error('YAML 须为有效的 Kubernetes 对象')
    }
    return docs
  } catch (e) {
    if (e instanceof Error && (e.message.includes('YAML') || e.message.includes('对象') || e.message.includes('Kubernetes'))) throw e
    throw new Error(e instanceof Error ? e.message : 'YAML 解析失败')
  }
}

/**
 * 与 dashboard `pixiuyaml/index.vue` 一致：解析 YAML → POST 创建
 * 支持单个文档和 --- 分隔的多文档批量创建
 */
export async function createK8sResourceFromYaml(cluster: string, yamlText: string): Promise<void> {
  const docs = parseYamlDocuments(yamlText)
  if (docs.length > 1) {
    return createK8sResourcesFromYaml(cluster, docs)
  }
  return postOneResource(cluster, docs[0])
}

async function postOneResource(cluster: string, yamlData: Record<string, unknown>, opts?: { ignoreExisting?: boolean }): Promise<void> {
  const { url } = resolveResourceUrl(yamlData)
  const base = `/pixiu/proxy/${encodeURIComponent(cluster)}`
  try {
    await kubeProxyAxios.post(`${base}${url}`, yamlData, { skipErrorNotification: true } as any)
  } catch (postErr) {
    if (opts?.ignoreExisting && isAxiosError(postErr) && postErr.response?.status === 409) return
    if (opts?.ignoreExisting && postErr instanceof PixiuApiError && /already exists/i.test(postErr.message)) return
    if (postErr instanceof PixiuApiError) throw postErr
    if (isAxiosError(postErr) && postErr.response?.status === 409) {
      throw new Error(k8sErrorMessage(postErr) || '资源已存在')
    }
    throw new Error(k8sErrorMessage(postErr))
  }
}

/**
 * 批量创建多个 Kubernetes 资源（使用 --- 分隔的 YAML 多文档）
 */
async function createK8sResourcesFromYaml(cluster: string, docs: Record<string, unknown>[]): Promise<void> {
  const errors: string[] = []
  for (const yamlData of docs) {
    try {
      await postOneResource(cluster, yamlData, { ignoreExisting: true })
    } catch (postErr) {
      if (postErr instanceof PixiuApiError) throw postErr
      const kind = yamlData.kind as string ?? 'Unknown'
      const name = (yamlData.metadata as { name?: string })?.name ?? ''
      errors.push(`${kind}/${name}: ${k8sErrorMessage(postErr)}`)
    }
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'))
  }
}

/**
 * 与 dashboard `viewOrEdit/index.vue` 一致：解析 YAML → PUT 覆盖更新
 */
export async function updateK8sResourceFromYaml(cluster: string, yamlText: string): Promise<void> {
  const docs = parseYamlDocuments(yamlText)
  if (docs.length > 1) {
    throw new Error('YAML 更新不支持多文档，请拆分后逐个操作')
  }
  const yamlData = docs[0]
  const { url, name } = resolveResourceUrl(yamlData)
  const base = `/pixiu/proxy/${encodeURIComponent(cluster)}`
  try {
    await kubeProxyAxios.put(`${base}${url}/${encodeURIComponent(name)}`, yamlData, { skipErrorNotification: true } as any)
  } catch (e) {
    if (e instanceof PixiuApiError) throw e
    throw new Error(k8sErrorMessage(e))
  }
}

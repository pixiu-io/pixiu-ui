import { isAxiosError } from 'axios'
import yaml from 'js-yaml'
import { kubeProxyAxios } from '@/api/kubeProxy'
import { PixiuApiError } from '@/api/container'

interface K8sAPIResource {
  name: string
  kind: string
  namespaced: boolean
}

interface APIResourceList {
  resources?: K8sAPIResource[]
}

function checkEmpty(_name: string, value: unknown): boolean {
  return value === undefined || value === '' || value === null
}

function k8sErrorMessage(err: unknown): string {
  if (!isAxiosError(err) || !err.response) return err instanceof Error ? err.message : '请求失败'
  const d = err.response.data as { message?: string; reason?: string; status?: string }
  return d?.message || d?.reason || d?.status || err.message || '请求失败'
}

function parseYamlObject(yamlText: string): Record<string, unknown> {
  const trimmed = yamlText.trim()
  if (!trimmed) {
    throw new Error('YAML 创建资源不能为空')
  }

  try {
    const loaded = yaml.load(trimmed)
    if (loaded === null || typeof loaded !== 'object' || Array.isArray(loaded)) {
      throw new Error('YAML 须为单个 Kubernetes 对象')
    }
    return loaded as Record<string, unknown>
  } catch (e) {
    if (e instanceof Error && (e.message.includes('YAML') || e.message.includes('对象'))) throw e
    throw new Error(e instanceof Error ? e.message : 'YAML 解析失败')
  }
}

async function resolveResourceUrl(
  cluster: string,
  yamlData: Record<string, unknown>
): Promise<{ url: string; kind: string; apiVersion: string; name: string }> {
  const kind = yamlData.kind as string | undefined
  const apiVersion = yamlData.apiVersion as string | undefined
  const metadata = yamlData.metadata as { name?: string; namespace?: string } | undefined

  if (checkEmpty('kind', kind)) throw new Error('kind 为必填项')
  if (checkEmpty('apiVersion', apiVersion)) throw new Error('apiVersion 为必填项')
  if (!metadata || checkEmpty('metadata', metadata) || checkEmpty('metadata.name', metadata.name)) {
    throw new Error('metadata.name 为必填项')
  }

  const name = metadata.name as string
  const base = `/pixiu/proxy/${encodeURIComponent(cluster)}`

  // apiVersion 为 "v1" 属于 core group (/api)，含 "/" 的属于 named group (/apis)
  const apiVersionStr = apiVersion as string
  const APIPaths = apiVersionStr.includes('/') ? (['/apis'] as const) : (['/api'] as const)

  let found = false
  let wantedAPIPath = ''
  let wantedResource: K8sAPIResource | null = null

  for (const APIPath of APIPaths) {
    try {
      const { data } = await kubeProxyAxios.get<APIResourceList>(`${base}${APIPath}/${apiVersion}`, {
        skipErrorNotification: true
      } as any)
      for (const resource of data.resources ?? []) {
        if (resource.kind === kind) {
          found = true
          wantedAPIPath = APIPath
          wantedResource = resource
          break
        }
      }
    } catch {
      continue
    }
    if (found) break
  }

  if (!found || !wantedResource) {
    throw new Error(`kind: ${kind} apiVersion: ${apiVersion} 暂不支持`)
  }

  let url = `${base}${wantedAPIPath}/${apiVersion}`
  if (wantedResource.namespaced) {
    const namespace = metadata.namespace
    if (checkEmpty('metadata.namespace', namespace)) {
      throw new Error('metadata.namespace 为必填项')
    }
    url = `${url}/namespaces/${encodeURIComponent(namespace as string)}`
  }
  url = `${url}/${wantedResource.name}`
  return { url, kind: kind as string, apiVersion: apiVersion as string, name }
}

/**
 * 与 dashboard `pixiuyaml/index.vue` 一致：解析 YAML → 查 API 资源列表 → POST 创建
 * k8s API 资源已存在时返回 409 Conflict，直接依赖此状态码判断，无需额外 GET 探测
 */
export async function createK8sResourceFromYaml(cluster: string, yamlText: string): Promise<void> {
  const yamlData = parseYamlObject(yamlText)
  const { url } = await resolveResourceUrl(cluster, yamlData)

  try {
    await kubeProxyAxios.post(url, yamlData, { skipErrorNotification: true } as any)
  } catch (postErr) {
    if (postErr instanceof PixiuApiError) throw postErr
    if (isAxiosError(postErr) && postErr.response?.status === 409) {
      throw new Error(k8sErrorMessage(postErr) || '资源已存在')
    }
    throw new Error(k8sErrorMessage(postErr))
  }
}

/**
 * 与 dashboard `viewOrEdit/index.vue` 一致：解析 YAML → 查 API 资源列表 → PUT 覆盖更新
 */
export async function updateK8sResourceFromYaml(cluster: string, yamlText: string): Promise<void> {
  const yamlData = parseYamlObject(yamlText)
  const { url, name } = await resolveResourceUrl(cluster, yamlData)
  try {
    await kubeProxyAxios.put(`${url}/${encodeURIComponent(name)}`, yamlData, { skipErrorNotification: true } as any)
  } catch (e) {
    if (e instanceof PixiuApiError) throw e
    throw new Error(k8sErrorMessage(e))
  }
}

import { pixiuAxios } from '@/api/container'

const HELM_BASE = '/pixiu/helms'

async function helmGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await pixiuAxios.get(url, { params })
  const { code, result, message } = res.data
  if (code !== 200) throw new Error(message || '请求失败')
  return result as T
}

async function helmPost<T = void>(url: string, data?: unknown): Promise<T> {
  const res = await pixiuAxios.post(url, data)
  const { code, result, message } = res.data
  if (code !== 200) throw new Error(message || '请求失败')
  return result as T
}

async function helmPut<T = void>(url: string, data?: unknown): Promise<T> {
  const res = await pixiuAxios.put(url, data)
  const { code, result, message } = res.data
  if (code !== 200) throw new Error(message || '请求失败')
  return result as T
}

async function helmDelete(url: string): Promise<void> {
  const res = await pixiuAxios.delete(url)
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '请求失败')
}

export interface HelmRepository {
  id: number
  name: string
  url: string
  username?: string
  password?: string
  resource_version: number
  gmt_create?: string
  gmt_modified?: string
}

export interface HelmReleaseChartMeta {
  metadata?: {
    name?: string
    version?: string
    appVersion?: string
  }
}

export interface HelmReleaseInfo {
  status?: string
  first_deployed?: string
  last_deployed?: string
}

export interface HelmReleaseItem {
  name: string
  namespace?: string
  version?: number
  chart?: HelmReleaseChartMeta
  info?: HelmReleaseInfo
}

export interface HelmReleaseForm {
  name: string
  chart: string
  version: string
  values?: Record<string, unknown>
  preview?: boolean
}

export interface CreateHelmRepository {
  name: string
  url: string
  username?: string
  password?: string
}

export interface UpdateHelmRepository extends CreateHelmRepository {
  resource_version: number
}

function releaseBase(cluster: string, namespace: string) {
  return `${HELM_BASE}/clusters/${encodeURIComponent(cluster)}/namespaces/${encodeURIComponent(namespace)}/releases`
}

export async function fetchHelmReleaseList(
  cluster: string,
  namespace: string
): Promise<HelmReleaseItem[]> {
  const list = await helmGet<HelmReleaseItem[] | null>(releaseBase(cluster, namespace))
  return list ?? []
}

export async function fetchHelmRelease(
  cluster: string,
  namespace: string,
  name: string
): Promise<HelmReleaseItem> {
  return helmGet<HelmReleaseItem>(`${releaseBase(cluster, namespace)}/${encodeURIComponent(name)}`)
}

export async function installHelmRelease(
  cluster: string,
  namespace: string,
  body: HelmReleaseForm
): Promise<HelmReleaseItem> {
  return helmPost<HelmReleaseItem>(releaseBase(cluster, namespace), body)
}

export async function upgradeHelmRelease(
  cluster: string,
  namespace: string,
  body: HelmReleaseForm
): Promise<HelmReleaseItem> {
  return helmPut<HelmReleaseItem>(releaseBase(cluster, namespace), body)
}

export async function uninstallHelmRelease(
  cluster: string,
  namespace: string,
  name: string
): Promise<void> {
  await helmDelete(`${releaseBase(cluster, namespace)}/${encodeURIComponent(name)}`)
}

export async function fetchHelmReleaseHistory(
  cluster: string,
  namespace: string,
  name: string
): Promise<HelmReleaseItem[]> {
  const list = await helmGet<HelmReleaseItem[] | null>(
    `${releaseBase(cluster, namespace)}/${encodeURIComponent(name)}/history`
  )
  return list ?? []
}

export async function rollbackHelmRelease(
  cluster: string,
  namespace: string,
  name: string,
  version: number
): Promise<void> {
  const res = await pixiuAxios.post(
    `${releaseBase(cluster, namespace)}/${encodeURIComponent(name)}/rollback`,
    undefined,
    { params: { version } }
  )
  const { code, message } = res.data
  if (code !== 200) throw new Error(message || '请求失败')
}

export async function fetchHelmRepositoryList(): Promise<HelmRepository[]> {
  const list = await helmGet<HelmRepository[] | null>(`${HELM_BASE}/repositories`)
  return list ?? []
}

export async function fetchHelmRepository(id: number): Promise<HelmRepository> {
  return helmGet<HelmRepository>(`${HELM_BASE}/repositories/${id}`)
}

export async function createHelmRepository(body: CreateHelmRepository): Promise<void> {
  await helmPost(`${HELM_BASE}/repositories`, body)
}

export async function updateHelmRepository(id: number, body: UpdateHelmRepository): Promise<void> {
  await helmPut(`${HELM_BASE}/repositories/${id}`, body)
}

export async function deleteHelmRepository(id: number): Promise<void> {
  await helmDelete(`${HELM_BASE}/repositories/${id}`)
}

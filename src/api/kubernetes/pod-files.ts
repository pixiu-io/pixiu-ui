import { kubeProxyAxios } from '@/api/kubeProxy'

export interface PodFileEntry {
  name: string
  type: 'dir' | 'file' | 'link' | 'other' | string
  size: number
  modTime?: string
  mode?: string
  uid?: string
  gid?: string
}

export interface PodFileListResult {
  path: string
  items: PodFileEntry[]
}

function filesBase(cluster: string, namespace: string, pod: string) {
  return `/pixiu/kubeproxy/clusters/${encodeURIComponent(cluster)}/namespaces/${encodeURIComponent(namespace)}/pods/${encodeURIComponent(pod)}`
}

/** 列出 Pod 容器内目录 */
export async function fetchPodFileList(params: {
  cluster: string
  namespace: string
  pod: string
  container: string
  path?: string
}): Promise<PodFileListResult> {
  const res = await kubeProxyAxios.get(`${filesBase(params.cluster, params.namespace, params.pod)}/files`, {
    params: {
      container: params.container,
      path: params.path || '/'
    },
    timeout: 60000
  })
  const { code, result, message } = res.data ?? {}
  if (code !== 200) throw new Error(message || '获取文件列表失败')
  return {
    path: result?.path || params.path || '/',
    items: Array.isArray(result?.items) ? result.items : []
  }
}

/** 下载 Pod 容器内文件或文件夹（文件夹打包为 .tar） */
export async function downloadPodFile(params: {
  cluster: string
  namespace: string
  pod: string
  container: string
  path: string
  filename?: string
}): Promise<void> {
  const url = `${filesBase(params.cluster, params.namespace, params.pod)}/files/download`
  const res = await kubeProxyAxios.get(url, {
    params: {
      container: params.container,
      path: params.path
    },
    responseType: 'blob',
    timeout: 120000
  })

  const contentType = String(res.headers['content-type'] || '')
  if (contentType.includes('application/json')) {
    const text = await (res.data as Blob).text()
    let msg = '下载失败'
    try {
      const parsed = JSON.parse(text) as { message?: string }
      if (parsed.message) msg = parsed.message
    } catch {
      // ignore
    }
    throw new Error(msg)
  }

  const filename =
    params.filename || params.path.split('/').filter(Boolean).pop() || 'download'
  const blobUrl = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(blobUrl)
}

const POD_FILE_MAX_UPLOAD_BYTES = 100 * 1024 * 1024

/** 上传本地文件到 Pod 容器当前目录（重名覆盖） */
export async function uploadPodFile(params: {
  cluster: string
  namespace: string
  pod: string
  container: string
  path: string
  file: File
}): Promise<void> {
  if (params.file.size > POD_FILE_MAX_UPLOAD_BYTES) {
    throw new Error('文件超过大小限制（100MiB）')
  }
  const form = new FormData()
  form.append('file', params.file)
  const res = await kubeProxyAxios.post(
    `${filesBase(params.cluster, params.namespace, params.pod)}/files/upload`,
    form,
    {
      params: {
        container: params.container,
        path: params.path || '/'
      },
      timeout: 120000
    }
  )
  const { code, message } = res.data ?? {}
  if (code !== 200) throw new Error(message || '上传失败')
}

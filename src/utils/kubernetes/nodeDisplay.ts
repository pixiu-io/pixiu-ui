import type { K8sNode } from '@/api/kubernetes/node'

/** 从 node-role.kubernetes.io/* 等标签解析角色，与 K8s 节点角色约定一致 */
export function getNodeRoleParts(node: K8sNode): string[] {
  const labels = node.metadata?.labels
  if (!labels) return []
  const roles: string[] = []
  for (const key of Object.keys(labels)) {
    if (key.startsWith('node-role.kubernetes.io/')) {
      const seg = key.slice('node-role.kubernetes.io/'.length)
      if (seg) roles.push(seg)
    }
  }
  const kr = labels['kubernetes.io/role']
  if (typeof kr === 'string' && kr && !roles.includes(kr)) {
    roles.push(kr)
  }
  return [...new Set(roles)]
}

/** master 与 control-plane 同时存在时，仅展示 control-plane */
function normalizeRoleParts(parts: string[]): string[] {
  const lower = parts.map((p) => p.toLowerCase())
  const hasCp = lower.includes('control-plane')
  const hasMaster = lower.includes('master')
  if (hasCp && hasMaster) {
    return parts.filter((p) => p.toLowerCase() !== 'master')
  }
  return parts
}

/**
 * 无角色标签时展示 `node`（橘色 warning）；
 * 有标签时经 normalize 后展示，如同时有 master 与 control-plane 则只保留 control-plane。
 */
export function getNodeRoleDisplayTags(node: K8sNode): string[] {
  const parts = normalizeRoleParts(getNodeRoleParts(node))
  if (parts.length > 0) return parts
  return ['node']
}

/** 控制面节点（含 legacy master）；其余为工作节点 */
export function formatNodeTypeText(node: K8sNode): '控制节点' | '普通节点' {
  const parts = normalizeRoleParts(getNodeRoleParts(node))
  for (const p of parts) {
    const l = p.toLowerCase()
    if (l === 'control-plane' || l === 'master') return '控制节点'
  }
  return '普通节点'
}

export function nodeRoleTagType(role: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' {
  const r = role.toLowerCase()
  if (r === 'node') return 'warning'
  if (r === 'control-plane' || r === 'master') return 'danger'
  if (r.includes('etcd')) return 'warning'
  if (r === 'worker') return 'info'
  return 'primary'
}

export function formatNodeStatusText(row: K8sNode): string {
  const conditions = row.status?.conditions
  if (!conditions?.length) return '未知'
  let status = '已停止'
  for (const c of conditions) {
    if (c.type === 'Ready' && c.status === 'True') {
      status = '运行中'
      break
    }
  }
  if (status === '运行中' && row.spec?.unschedulable) {
    return '禁止调度'
  }
  return status
}

export function formatNodeInternalIp(row: K8sNode): string {
  const addrs = row.status?.addresses
  if (!addrs?.length) return '-'
  for (const a of addrs) {
    if (a.type === 'InternalIP') return a.address
  }
  return addrs[0]?.address ?? '-'
}

export function formatKubeletVersion(row: K8sNode): string {
  return row.status?.nodeInfo?.kubeletVersion ?? '-'
}

/** 与 kubectl / dashboard 一致，完整展示如 docker://20.10.15、containerd://1.7.28-tke.2 */
export function formatContainerRuntime(row: K8sNode): string {
  const v = row.status?.nodeInfo?.containerRuntimeVersion
  if (!v) return '-'
  return String(v)
}

export function formatNodeCreationTime(iso?: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 节点 metadata.labels 转为 `key: value` 行（按键名排序），用于表格展示 */
export function formatNodeLabelLines(node: K8sNode): string[] {
  const labels = node.metadata?.labels
  if (!labels || typeof labels !== 'object') return []
  return Object.keys(labels)
    .sort((a, b) => a.localeCompare(b))
    .map((k) => `${k}: ${String(labels[k] ?? '')}`)
}

export function nodeStatusTagType(
  text: string
): 'success' | 'warning' | 'info' | 'danger' {
  if (text === '运行中') return 'success'
  if (text === '禁止调度') return 'warning'
  if (text === '已停止') return 'danger'
  return 'info'
}

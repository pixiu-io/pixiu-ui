export type RbacActionKey = 'view' | 'list' | 'create' | 'modify' | 'delete'

export interface K8sPolicyRule {
  apiGroups?: string[]
  resources?: string[]
  verbs?: string[]
  nonResourceURLs?: string[]
}

export interface RbacRuleMatrixRow {
  id: string
  apiGroup: string
  resource: string
  actions: Record<RbacActionKey, boolean>
}

export const RBAC_ACTION_COLUMNS: Array<{ key: RbacActionKey; label: string }> = [
  { key: 'view', label: '查看' },
  { key: 'list', label: '列表' },
  { key: 'create', label: '创建' },
  { key: 'modify', label: '修改' },
  { key: 'delete', label: '删除' }
]

const ACTION_VERBS: Record<RbacActionKey, string[]> = {
  view: ['get'],
  list: ['list', 'watch'],
  create: ['create'],
  modify: ['update', 'patch'],
  delete: ['delete', 'deletecollection']
}

const ALL_VERBS = Object.values(ACTION_VERBS).flat()

function formatApiGroup(apiGroup: string): string {
  if (apiGroup === '' || apiGroup === '*') return apiGroup === '*' ? '*' : 'api'
  return apiGroup
}

function parseApiGroup(display: string): string {
  if (display === 'api') return ''
  return display
}

function expandVerbs(verbs: string[]): string[] {
  if (verbs.includes('*')) return [...ALL_VERBS]
  return verbs
}

function verbsToActions(verbs: string[]): Record<RbacActionKey, boolean> {
  const expanded = expandVerbs(verbs)
  return {
    view: ACTION_VERBS.view.some((v) => expanded.includes(v)),
    list: ACTION_VERBS.list.some((v) => expanded.includes(v)),
    create: ACTION_VERBS.create.some((v) => expanded.includes(v)),
    modify: ACTION_VERBS.modify.some((v) => expanded.includes(v)),
    delete: ACTION_VERBS.delete.some((v) => expanded.includes(v))
  }
}

function mergeActions(
  current: Record<RbacActionKey, boolean>,
  next: Record<RbacActionKey, boolean>
): Record<RbacActionKey, boolean> {
  return {
    view: current.view || next.view,
    list: current.list || next.list,
    create: current.create || next.create,
    modify: current.modify || next.modify,
    delete: current.delete || next.delete
  }
}

/** 将 ClusterRole PolicyRule 展开为权限矩阵行（Kuboard 风格） */
export function policyRulesToMatrix(rules: K8sPolicyRule[]): RbacRuleMatrixRow[] {
  const map = new Map<string, RbacRuleMatrixRow>()

  for (const rule of rules) {
    const groups = rule.apiGroups?.length ? rule.apiGroups : ['']
    const resources = rule.resources?.length ? rule.resources : ['*']
    const actions = verbsToActions(rule.verbs ?? [])

    for (const group of groups) {
      for (const resource of resources) {
        const id = `${group}\0${resource}`
        const existing = map.get(id)
        if (existing) {
          existing.actions = mergeActions(existing.actions, actions)
          continue
        }
        map.set(id, {
          id,
          apiGroup: formatApiGroup(group),
          resource: resource || '*',
          actions: { ...actions }
        })
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const g = a.apiGroup.localeCompare(b.apiGroup)
    return g !== 0 ? g : a.resource.localeCompare(b.resource)
  })
}

function rowSelectedVerbs(row: RbacRuleMatrixRow): Set<string> {
  const verbs = new Set<string>()
  for (const col of RBAC_ACTION_COLUMNS) {
    if (!row.actions[col.key]) continue
    for (const verb of ACTION_VERBS[col.key]) {
      verbs.add(verb)
    }
  }
  return verbs
}

/** 将权限矩阵还原为 PolicyRule，供提交后端（仅包含已勾选操作的资源行） */
export function matrixToPolicyRules(rows: RbacRuleMatrixRow[]): K8sPolicyRule[] {
  const grouped = new Map<
    string,
    { apiGroups: string[]; resources: Set<string>; verbs: Set<string> }
  >()

  for (const row of rows) {
    const verbs = rowSelectedVerbs(row)
    if (verbs.size === 0) continue

    const apiGroup = parseApiGroup(row.apiGroup)
    const key = `${apiGroup}\0${[...verbs].sort().join(',')}`
    if (!grouped.has(key)) {
      grouped.set(key, { apiGroups: [apiGroup], resources: new Set(), verbs })
    }
    grouped.get(key)!.resources.add(row.resource)
  }

  return Array.from(grouped.values()).map((value) => ({
    apiGroups: value.apiGroups,
    resources: [...value.resources],
    verbs: [...value.verbs]
  }))
}

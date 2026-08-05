/**
 * 权限状态：当前用户可用 API / 资源作用域
 * 用于菜单过滤、按钮鉴权、K8s 资源可见性
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  fetchMyPermissions,
  type MyPermissionsResult,
  type RoleAPIScopeRecord
} from '@/api/auth-permission'

export const usePermissionStore = defineStore('permissionStore', () => {
  const loaded = ref(false)
  const isRoot = ref(false)
  const role = ref(2)
  const apis = ref<MyPermissionsResult['apis']>([])
  const scopes = ref<RoleAPIScopeRecord[]>([])
  const buttons = ref<string[]>([])

  const apiSet = computed(() => new Set(buttons.value))

  async function loadPermissions() {
    try {
      const data = await fetchMyPermissions()
      isRoot.value = !!data.is_root
      role.value = data.role
      apis.value = data.apis || []
      scopes.value = data.scopes || []
      buttons.value = data.buttons || []
      loaded.value = true
    } catch (e) {
      // 权限接口失败时保持未加载，避免误放行
      loaded.value = false
      isRoot.value = false
      apis.value = []
      scopes.value = []
      buttons.value = []
      throw e
    }
  }

  function clear() {
    loaded.value = false
    isRoot.value = false
    role.value = 2
    apis.value = []
    scopes.value = []
    buttons.value = []
  }

  /** 是否拥有指定 METHOD:path 或简单按钮标记 */
  function hasAPI(auth: string): boolean {
    if (isRoot.value) return true
    if (!auth) return true
    if (apiSet.value.has(auth)) return true
    // 兼容仅传 path（默认 GET）
    if (apiSet.value.has(`GET:${auth}`)) return true
    return buttons.value.includes(auth)
  }

  /**
   * 是否可访问指定 K8s 资源作用域。
   * - 超管：全部放行
   * - 无任何 scopes：不按作用域限制（兼容仅绑定平台 API 的角色）
   * - 有 scopes：必须命中 cluster/namespace/resource_name（支持 *）
   */
  function canAccessScope(opts: {
    cluster?: string
    namespace?: string
    resourceName?: string
  }): boolean {
    if (isRoot.value) return true
    if (!scopes.value.length) return true

    const cluster = (opts.cluster || '').trim()
    const namespace = (opts.namespace || '').trim()
    const resourceName = (opts.resourceName || '*').trim() || '*'

    return scopes.value.some((s) => {
      const sc = (s.cluster || '').trim()
      const sn = (s.namespace || '').trim()
      const sr = (s.resource_name || '*').trim() || '*'
      if (cluster && sc !== '*' && sc !== cluster) return false
      if (namespace && sn !== '*' && sn !== namespace) return false
      if (resourceName !== '*' && sr !== '*' && sr !== resourceName) return false
      return true
    })
  }

  /** 某集群下允许的命名空间；null 表示不限制 */
  function allowedNamespaces(cluster: string): string[] | null {
    if (isRoot.value) return null
    if (!scopes.value.length) return null
    const names = new Set<string>()
    let hasWildcard = false
    for (const s of scopes.value) {
      const sc = (s.cluster || '').trim()
      if (sc !== '*' && sc !== cluster) continue
      const sn = (s.namespace || '').trim()
      if (!sn || sn === '*') {
        hasWildcard = true
        break
      }
      names.add(sn)
    }
    if (hasWildcard) return null
    if (!names.size) return []
    return Array.from(names)
  }

  /** 当前用户是否被授予访问该集群（scopes 或超管） */
  function canAccessCluster(cluster: string): boolean {
    if (isRoot.value) return true
    if (!scopes.value.length) return true
    return scopes.value.some((s) => {
      const sc = (s.cluster || '').trim()
      return sc === '*' || sc === cluster
    })
  }

  return {
    loaded,
    isRoot,
    role,
    apis,
    scopes,
    buttons,
    loadPermissions,
    clear,
    hasAPI,
    canAccessScope,
    allowedNamespaces,
    canAccessCluster
  }
})

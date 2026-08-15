/**
 * 权限状态：菜单 / 按钮(API) / 数据(scope) 三层模型
 * - menus: 侧栏与路由可见性
 * - buttons: METHOD:path，对齐 ValidAccess / hasAuth
 * - scopes: pixiu 资源实例可见性
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
  const menus = ref<string[]>([])

  const apiSet = computed(() => new Set(buttons.value))
  const menuSet = computed(() => new Set(menus.value))

  /** 并发去重：登录与路由守卫可能同时触发，避免重复请求被客户端取消导致 broken pipe */
  let loadingPromise: Promise<void> | null = null

  async function loadPermissions(force = false) {
    if (!force && loaded.value) return
    if (loadingPromise) return loadingPromise

    loadingPromise = (async () => {
      try {
        const data = await fetchMyPermissions()
        isRoot.value = !!data.is_root
        role.value = data.role
        apis.value = data.apis || []
        scopes.value = data.scopes || []
        buttons.value = data.buttons || []
        menus.value = data.menus || []
        loaded.value = true
      } catch (e) {
        loaded.value = false
        isRoot.value = false
        apis.value = []
        scopes.value = []
        buttons.value = []
        menus.value = []
        throw e
      } finally {
        loadingPromise = null
      }
    })()

    return loadingPromise
  }

  function clear() {
    loadingPromise = null
    loaded.value = false
    isRoot.value = false
    role.value = 2
    apis.value = []
    scopes.value = []
    buttons.value = []
    menus.value = []
  }

  /** 是否拥有指定菜单码 */
  function hasMenu(code: string): boolean {
    if (isRoot.value) return true
    if (!code) return true
    return menuSet.value.has(code)
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
   * 是否可访问某 pixiu 资源（超管或 scope 命中）
   * resource_type：plan / cluster / node / agent / account / datasource / distribution / runner
   */
  function canAccessResource(resourceType: string, resourceId: number): boolean {
    if (isRoot.value) return true
    if (!scopes.value.length) return false
    return scopes.value.some(
      (s) => s.resource_type === resourceType && s.resource_id === resourceId
    )
  }

  /** 某资源类型下被授权访问的 resource_id 集合 */
  function authorizedResourceIds(resourceType: string): number[] {
    return scopes.value.filter((s) => s.resource_type === resourceType).map((s) => s.resource_id)
  }

  return {
    loaded,
    isRoot,
    role,
    apis,
    scopes,
    buttons,
    menus,
    loadPermissions,
    clear,
    hasMenu,
    hasAPI,
    canAccessResource,
    authorizedResourceIds
  }
})

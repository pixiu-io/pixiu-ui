/**
 * useAuth - 权限验证管理
 *
 * 结合用户角色、后端下发的 API 列表与资源作用域，控制按钮/操作显示。
 */

import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/store/modules/user'
import { usePermissionStore } from '@/store/modules/permission'
import { useAppMode } from '@/hooks/core/useAppMode'
import type { AppRouteRecord } from '@/types/router'

type AuthItem = NonNullable<AppRouteRecord['meta']['authList']>[number]

export const useAuth = () => {
  const route = useRoute()
  const { isFrontendMode } = useAppMode()
  const userStore = useUserStore()
  const permissionStore = usePermissionStore()
  const { info } = storeToRefs(userStore)

  const backendAuthList: AuthItem[] = Array.isArray(route.meta.authList)
    ? (route.meta.authList as AuthItem[])
    : []

  /**
   * 检查是否拥有某权限标识
   * - 优先使用后端 /pixiu/users/permissions 下发的 buttons（METHOD:path）
   * - 回退到 userInfo.buttons / route.meta.authList
   */
  const hasAuth = (auth: string): boolean => {
    if (!auth) return true
    if (permissionStore.isRoot) return true
    if (permissionStore.loaded && permissionStore.hasAPI(auth)) return true

    const frontendAuthList = info.value?.buttons ?? []
    if (isFrontendMode.value) {
      // 未加载到后端权限时，若 buttons 为空则不拦截（兼容旧逻辑）
      if (!permissionStore.loaded && frontendAuthList.length === 0) return true
      return frontendAuthList.includes(auth)
    }

    return backendAuthList.some((item) => item?.authMark === auth)
  }

  /**
   * 是否可访问某 pixiu 资源（超管或 scope 命中）
   * resource_type：plan / cluster / node / agent / account / datasource / distribution / runner
   */
  const canAccessResource = (resourceType: string, resourceId: number) =>
    permissionStore.canAccessResource(resourceType, resourceId)

  return {
    hasAuth,
    canAccessResource
  }
}

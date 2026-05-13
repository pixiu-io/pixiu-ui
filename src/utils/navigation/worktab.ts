/**
 * 工作标签页管理模块
 *
 * 提供工作标签页（Worktab）的自动管理功能
 *
 * ## 主要功能
 *
 * - 根据路由导航自动创建和更新工作标签页
 * - iframe 页面标签页特殊处理
 * - 标签页信息提取（标题、路径、缓存状态等）
 * - 固定标签页支持
 * - 根据系统设置控制标签页显示
 * - 首页标签页特殊处理
 *
 * ## 使用场景
 *
 * - 路由守卫中自动创建标签页
 * - 页面切换时更新标签页状态
 * - 多标签页导航系统
 *
 * @module utils/navigation/worktab
 * @author Pixiu Cloud Team
 */
import { useWorktabStore } from '@/store/modules/worktab'
import { RouteLocationNormalized } from 'vue-router'
import { isIframe } from './route'
import { useSettingStore } from '@/store/modules/setting'
import { IframeRouteManager } from '@/router/core'
import { useCommon } from '@/hooks/core/useCommon'

/**
 * 根据当前路由信息设置工作标签页（worktab）
 * @param to 当前路由对象
 */
export const setWorktab = (to: RouteLocationNormalized): void => {
  const worktabStore = useWorktabStore()
  const { meta, path, name, params, query } = to

  const clusterParam = query.cluster
  const clusterKey = Array.isArray(clusterParam) ? clusterParam[0] : clusterParam

  // 容器模块中带 cluster 的 meta.isHide 全屏子页（创建/详情等）：以路由 name 作为 tabGroup，
  // 每种页面类型复用同一工作台标签，互不干扰；返回列表时不会残留多余标签。
  if (
    meta.isHide &&
    clusterKey &&
    typeof path === 'string' &&
    path.startsWith('/container/') &&
    !path.startsWith('/container/cluster')
  ) {
    const title = (meta.title as string) || `容器集群:${String(clusterKey)}`
    worktabStore.openTab({
      title,
      icon: meta.icon as string,
      path,
      name: name as string,
      keepAlive: Boolean(meta.keepAlive),
      params,
      query,
      tabGroup: name as string,
      fixedTab: meta.fixedTab as boolean | undefined
    })
    return
  }

  if (!meta.isHideTab) {
    // 如果是 iframe 页面，则特殊处理工作标签页
    if (isIframe(path)) {
      const iframeRoute = IframeRouteManager.getInstance().findByPath(to.path)

      if (iframeRoute?.meta) {
        worktabStore.openTab({
          title: iframeRoute.meta.title,
          icon: meta.icon as string,
          path,
          name: name as string,
          keepAlive: meta.keepAlive as boolean,
          params,
          query
        })
      }
    } else if (useSettingStore().showWorkTab || path === useCommon().homePath.value) {
      const tabGroup = meta.tabGroup as string | undefined
      const title =
        tabGroup === 'clusterDetail' && query.cluster
          ? `容器集群:${String(query.aliasName || query.cluster)}`
          : (meta.title as string)
      worktabStore.openTab({
        title,
        icon: meta.icon as string,
        path,
        name: name as string,
        keepAlive: meta.keepAlive as boolean,
        params,
        query,
        fixedTab: meta.fixedTab as boolean,
        tabGroup
      })
    }
  }
}

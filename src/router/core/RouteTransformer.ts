/**
 * 路由转换器
 *
 * 负责将菜单数据转换为 Vue Router 路由配置
 *
 * @module router/core/RouteTransformer
 * @author Pixiu Cloud Team
 */

import type { RouteRecordRaw } from 'vue-router'
import type { AppRouteRecord } from '@/types/router'
import { ComponentLoader } from './ComponentLoader'
import { IframeRouteManager } from './IframeRouteManager'

interface ConvertedRoute extends Omit<RouteRecordRaw, 'children'> {
  id?: number
  children?: ConvertedRoute[]
  component?: RouteRecordRaw['component'] | (() => Promise<any>)
}

export class RouteTransformer {
  private componentLoader: ComponentLoader
  private iframeManager: IframeRouteManager

  constructor(componentLoader: ComponentLoader) {
    this.componentLoader = componentLoader
    this.iframeManager = IframeRouteManager.getInstance()
  }

  /**
   * 转换路由配置
   */
  transform(route: AppRouteRecord, depth = 0): ConvertedRoute {
    const { component, children, ...routeConfig } = route

    // 基础路由配置
    const converted: ConvertedRoute = {
      ...routeConfig,
      component: undefined
    }

    // 处理不同类型的路由
    if (route.meta.isIframe) {
      this.handleIframeRoute(converted, route, depth)
    } else if (this.isFirstLevelRoute(route, depth)) {
      this.handleFirstLevelRoute(converted, route, component as string)
    } else {
      this.handleNormalRoute(converted, component as string)
    }

    // 递归处理子路由，并修正可能被 normalize 成绝对路径的子 path
    // Vue Router 嵌套匹配：子路由 path 必须是「父 path 之后的剩余部分」，
    // 若上游 MenuProcessor.normalizeMenuPaths 已将子 path 拼成绝对路径，
    // 这里去掉父路径前缀还原为相对路径，避免 to.matched 为空导致「点击无反应」。
    if (children?.length) {
      const parentPath = String(route.path || '')
      converted.children = children.map((child) => {
        const normalizedChild = this.normalizeChildPath(child, parentPath)
        return this.transform(normalizedChild, depth + 1)
      })
    }

    return converted
  }

  /**
   * 将被 normalize 成绝对路径的子路由 path 还原为相对路径。
   * - 如果子 path 以 / 开头并且以 `{parentPath}/...` 形式开头，则去掉父前缀
   * - 否则保持原 path（外部链接、iframe、合法相对路径都不受影响）
   */
  private normalizeChildPath(child: AppRouteRecord, parentPath: string): AppRouteRecord {
    const childPath = String(child.path || '')
    if (!childPath.startsWith('/')) return child
    if (childPath.startsWith('http://') || childPath.startsWith('https://')) return child

    const cleanParent = parentPath.replace(/\/$/, '')
    if (!cleanParent) return child

    const prefix = `${cleanParent}/`
    if (childPath.startsWith(prefix)) {
      const newPath = childPath.slice(prefix.length)
      console.debug(
        `[RouteTransformer] 子路径还原绝对→相对: parent='${cleanParent}' before='${childPath}' after='${newPath}' name=${String(child.name ?? '')}`
      )
      return {
        ...child,
        path: newPath
      }
    }
    // 恰好等于父路径（极端情况）：转成空串相对路径
    if (childPath === cleanParent) {
      console.debug(
        `[RouteTransformer] 子路径恰好等于父路径→空串: parent='${cleanParent}' before='${childPath}' name=${String(child.name ?? '')}`
      )
      return { ...child, path: '' }
    }
    return child
  }

  /**
   * 判断是否为一级路由（需要 Layout 包裹）
   */
  private isFirstLevelRoute(route: AppRouteRecord, depth: number): boolean {
    return depth === 0 && (!route.children || route.children.length === 0)
  }

  /**
   * 处理 iframe 类型路由
   */
  private handleIframeRoute(
    targetRoute: ConvertedRoute,
    sourceRoute: AppRouteRecord,
    depth: number
  ): void {
    if (depth === 0) {
      // 顶级 iframe：用 Layout 包裹
      targetRoute.component = this.componentLoader.loadLayout()
      targetRoute.path = this.extractFirstSegment(sourceRoute.path || '')
      targetRoute.name = ''

      targetRoute.children = [
        {
          ...sourceRoute,
          component: this.componentLoader.loadIframe()
        } as ConvertedRoute
      ]
    } else {
      // 非顶级（嵌套）iframe：直接使用 Iframe.vue
      targetRoute.component = this.componentLoader.loadIframe()
    }

    // 记录 iframe 路由
    this.iframeManager.add(sourceRoute)
  }

  /**
   * 处理一级菜单路由
   */
  private handleFirstLevelRoute(
    converted: ConvertedRoute,
    route: AppRouteRecord,
    component: string | undefined
  ): void {
    converted.component = this.componentLoader.loadLayout()
    converted.path = this.extractFirstSegment(route.path || '')
    converted.name = ''
    route.meta.isFirstLevel = true

    converted.children = [
      {
        ...route,
        component: component ? this.componentLoader.load(component) : undefined
      } as ConvertedRoute
    ]
  }

  /**
   * 处理普通路由
   */
  private handleNormalRoute(converted: ConvertedRoute, component: string | undefined): void {
    if (component) {
      converted.component = this.componentLoader.load(component)
    }
  }

  /**
   * 提取路径的第一段
   */
  private extractFirstSegment(path: string): string {
    const segments = path.split('/').filter(Boolean)
    return segments.length > 0 ? `/${segments[0]}` : '/'
  }
}

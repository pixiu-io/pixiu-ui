/**
 * 路由全局前置守卫模块
 *
 * 提供完整的路由导航守卫功能
 *
 * ## 主要功能
 *
 * - 登录状态验证和重定向
 * - 动态路由注册和权限控制
 * - 菜单数据获取和处理（前端/后端模式）
 * - 用户信息获取和缓存
 * - 页面标题设置
 * - 工作标签页管理
 * - 进度条和加载动画控制
 * - 静态路由识别和处理
 * - 错误处理和异常跳转
 *
 * ## 使用场景
 *
 * - 路由跳转前的权限验证
 * - 动态菜单加载和路由注册
 * - 用户登录状态管理
 * - 页面访问控制
 * - 路由级别的加载状态管理
 *
 * ## 工作流程
 *
 * 1. 检查登录状态，未登录跳转到登录页
 * 2. 首次访问时获取用户信息和菜单数据
 * 3. 根据权限动态注册路由
 * 4. 设置页面标题和工作标签页
 * 5. 处理根路径重定向到首页
 * 6. 未匹配路由跳转到 404 页面
 *
 * @module router/guards/beforeEach
 * @author Pixiu Cloud Team
 */
import type { Router, RouteLocationNormalized, NavigationGuardNext } from 'vue-router'
import { nextTick } from 'vue'
import NProgress from 'nprogress'
import { useSettingStore } from '@/store/modules/setting'
import { useUserStore } from '@/store/modules/user'
import { useMenuStore } from '@/store/modules/menu'
import { setWorktab } from '@/utils/navigation'
import { setPageTitle } from '@/utils/router'
import { RoutesAlias } from '../routesAlias'
import { staticRoutes } from '../routes/staticRoutes'
import { loadingService } from '@/utils/ui'
import { useWorktabStore } from '@/store/modules/worktab'
import { ApiStatus } from '@/utils/http/status'
import { isHttpError } from '@/utils/http/error'
import { RouteRegistry, MenuProcessor, IframeRouteManager, RoutePermissionValidator } from '../core'
import { getFirstMenuPath } from '@/utils'
import { usePermissionStore } from '@/store/modules/permission'

// 路由注册器实例
let routeRegistry: RouteRegistry | null = null

// 菜单处理器实例
const menuProcessor = new MenuProcessor()

// 跟踪是否需要关闭 loading
let pendingLoading = false

// 路由初始化失败标记，防止死循环
// 一旦设置为 true，只有刷新页面或重新登录才能重置
let routeInitFailed = false

// 路由初始化进行中标记，防止并发请求
let routeInitInProgress = false

// 动态路由初始化共享 promise：多个并发导航共享同一份初始化，避免互相 next(false) 取消
let initPromise: Promise<void> | null = null

// 导航计数器：guard 入口自增；结束时若自己已不是最新导航（已被更新的导航取代），放弃调用 next()
let navigationCounter = 0

/**
 * 获取 pendingLoading 状态
 */
export function getPendingLoading(): boolean {
  return pendingLoading
}

/**
 * 重置 pendingLoading 状态
 */
export function resetPendingLoading(): void {
  pendingLoading = false
}

/**
 * 获取路由初始化失败状态
 */
export function getRouteInitFailed(): boolean {
  return routeInitFailed
}

/**
 * 重置路由初始化状态（用于重新登录场景）
 */
export function resetRouteInitState(): void {
  routeInitFailed = false
  routeInitInProgress = false
  initPromise = null
}

/**
 * 设置路由全局前置守卫
 */
export function setupBeforeEachGuard(router: Router): void {
  // 初始化路由注册器
  routeRegistry = new RouteRegistry(router)

  router.beforeEach(
    async (
      to: RouteLocationNormalized,
      from: RouteLocationNormalized,
      next: NavigationGuardNext
    ) => {
      try {
        await handleRouteGuard(to, from, next, router)
      } catch (error) {
        console.error('[RouteGuard] 路由守卫处理失败:', error)
        closeLoading()
        next({ name: 'Exception500' })
      }
    }
  )
}

/**
 * 关闭 loading 效果
 */
function closeLoading(): void {
  if (pendingLoading) {
    nextTick(() => {
      loadingService.hideLoading()
      pendingLoading = false
    })
  }
}

/**
 * 处理路由守卫逻辑
 */
async function handleRouteGuard(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext,
  router: Router
): Promise<void> {
  // 导航计数器自增：标记本次导航的身份，供被更新的导航取代时放弃 next()（防重入死循环）
  const navigationId = ++navigationCounter

  const settingStore = useSettingStore()
  const userStore = useUserStore()

  // 启动进度条
  if (settingStore.showNprogress) {
    NProgress.start()
  }

  // 1. 检查登录状态
  if (!handleLoginStatus(to, userStore, next)) {
    return
  }

  // 2. 检查路由初始化是否已失败（防止死循环）
  if (routeInitFailed) {
    // 已在错误页则放行；catch-all(NotFound) 也会 matched.length>0，不能 next() 否则会伪装成 404
    if (to.name === 'Exception500' || to.name === 'Exception404' || to.name === 'Exception401') {
      next()
      return
    }
    next({ name: 'Exception500', replace: true })
    return
  }

  // 3. 确保动态路由已注册（并发安全：等待共享 promise，绝不用 next(false) 取消并发导航）
  if (!routeRegistry?.isRegistered() && userStore.isLogin) {
    if (routeInitFailed) {
      if (to.name === 'Exception500' || to.name === 'Exception404' || to.name === 'Exception401') {
        next()
        return
      }
      next({ name: 'Exception500', replace: true })
      return
    }

    try {
      await ensureRoutesInitialized(router)
    } catch (error) {
      closeLoading()
      if (isUnauthorizedError(error)) {
        routeInitInProgress = false
        next(false)
        return
      }
      routeInitFailed = true
      routeInitInProgress = false
      if (isHttpError(error)) {
        console.error(`[RouteGuard] 错误码: ${error.code}, 消息: ${error.message}`)
      }
      next({ name: 'Exception500', replace: true })
      return
    }

    // 初始化成功：动态路由已注册。若本导航已被更新的导航取代，显式中止本导航
    // （next(false) 避免 vue-router 报 "next was never called" / Invalid navigation guard）
    if (isNavigationStale(navigationId)) {
      next(false)
      return
    }

    const menuStore = useMenuStore()
    const resolvedHome = menuStore.getHomePath() || getFirstMenuPath(menuStore.menuList) || ''

    // 登录后默认去首页，避免停留在 / 或登录页触发 catch-all 404
    let navigationPath = to.path
    if (
      navigationPath === '/' ||
      navigationPath === RoutesAlias.Login ||
      navigationPath === '/login'
    ) {
      navigationPath = resolvedHome
    }

    // 静态路由不依赖菜单权限，初始化后直接恢复目标地址（登录页除外）
    if (isStaticRoute(to.path) && to.path !== RoutesAlias.Login && to.path !== '/login') {
      next({ path: to.path, query: to.query, hash: to.hash, replace: true })
      return
    }

    if (!navigationPath) {
      routeInitFailed = true
      next({ name: 'Exception500', replace: true })
      return
    }

    const { path: validatedPath, hasPermission } = RoutePermissionValidator.validatePath(
      navigationPath,
      menuStore.menuList,
      resolvedHome || '/'
    )

    const targetPath = hasPermission ? navigationPath : validatedPath
    const useOriginalQuery = targetPath === to.path

    if (!hasPermission) {
      console.warn(`[RouteGuard] 用户无权限访问路径: ${to.path}，已跳转到首页`)
    }

    next({
      path: targetPath,
      query: useOriginalQuery ? to.query : {},
      hash: useOriginalQuery ? to.hash : undefined,
      replace: true
    })
    return
  }

  // 4. 处理根路径重定向
  if (handleRootPathRedirect(to, next)) {
    return
  }

  // 5. 处理已匹配的路由
  if (to.matched.length > 0) {
    // 已登录时避免 catch-all 将 /login、/ 等误渲染为 404
    if (userStore.isLogin && to.matched.some((r) => r.name === 'NotFound')) {
      const menuStore = useMenuStore()
      const fallback =
        menuStore.getHomePath() || getFirstMenuPath(menuStore.menuList) || RoutesAlias.Login
      if (fallback && fallback !== '/' && fallback !== to.path) {
        next({ path: fallback, replace: true })
        return
      }
    }

    // 已注册路由后仍按 meta.menu 二次校验，防止手输 URL / 权限变更残留
    if (userStore.isLogin && !canAccessMatchedRoute(to)) {
      const menuStore = useMenuStore()
      const fallback =
        menuStore.getHomePath() || getFirstMenuPath(menuStore.menuList) || RoutesAlias.Login
      // 禁止回退到 /：会被 catch-all 打成 404，造成「返回首页」死循环
      if (!fallback || fallback === '/' || fallback === to.path) {
        next({ path: RoutesAlias.Login, replace: true })
        return
      }
      console.warn(`[RouteGuard] 无菜单权限访问: ${to.path}，跳转 ${fallback}`)
      next({ path: fallback, replace: true })
      return
    }

    setWorktab(to)
    setPageTitle(to)
    next()
    return
  }

  // 6. 未匹配到路由，跳转到 404
  next({ name: 'Exception404' })
}

/**
 * 按匹配记录的 meta.menu / public 校验当前导航是否允许。
 * 取匹配链上最深一层声明的 menu 码（叶子优先）。
 */
function canAccessMatchedRoute(to: RouteLocationNormalized): boolean {
  const permissionStore = usePermissionStore()
  if (permissionStore.isRoot) return true
  if (!permissionStore.loaded) return false

  // 静态页（登录、异常页等）不走菜单码
  if (isStaticRoute(to.path)) return true

  let requiredMenu: string | undefined
  for (const record of to.matched) {
    const meta = record.meta || {}
    if (meta.public) return true
    const code = meta.menu as string | undefined
    if (code) requiredMenu = code
  }
  if (!requiredMenu) return true
  return permissionStore.hasMenu(requiredMenu)
}

/**
 * 处理登录状态
 * @returns true 表示可以继续，false 表示已处理跳转
 */
function handleLoginStatus(
  to: RouteLocationNormalized,
  userStore: ReturnType<typeof useUserStore>,
  next: NavigationGuardNext
): boolean {
  if (to.path === RoutesAlias.Login || to.path === '/login') {
    const hasToken = Boolean(userStore.accessToken || localStorage.getItem('pixiu-access-token'))
    if (hasToken && userStore.isLogin) {
      next({ path: '/', replace: true })
      return false
    }
    return true
  }

  const cachedToken = localStorage.getItem('pixiu-access-token') || ''
  if (!cachedToken && !userStore.accessToken) {
    next({
      name: 'Login',
      query: { redirect: to.fullPath }
    })
    return false
  }

  if (cachedToken && !userStore.accessToken) {
    userStore.setToken(cachedToken)
  }

  // 某些场景（如持久化恢复时序）可能出现 isLogin 短暂失真；
  // 只要 token 仍存在，即恢复为已登录状态，避免误触发强制登出。
  if (!userStore.isLogin && userStore.accessToken) {
    userStore.setLoginStatus(true)
  }

  const hasToken = Boolean(userStore.accessToken || cachedToken)

  // 有 token 视为已登录，允许继续
  if (hasToken) {
    return true
  }

  // 未登录且访问需要权限的页面，跳转到登录页并携带 redirect 参数
  next({
    name: 'Login',
    query: { redirect: to.fullPath }
  })
  return false
}

/**
 * 检查路由是否为静态路由
 */
function isStaticRoute(path: string): boolean {
  const checkRoute = (routes: any[], targetPath: string): boolean => {
    return routes.some((route) => {
      // catch-all 和 404/500 路由不应视为可匿名访问的静态页，
      // 否则未登录时手动输入任意地址会直接落到 404，无法跳转登录页。
      if (
        route.name === 'Exception404' ||
        route.name === 'Exception500' ||
        route.name === 'NotFound'
      ) {
        return false
      }

      // 处理动态路由参数匹配
      const routePath = route.path
      const pattern = routePath.replace(/:[^/]+/g, '[^/]+').replace(/\*/g, '.*')
      const regex = new RegExp(`^${pattern}$`)

      if (regex.test(targetPath)) {
        return true
      }
      if (route.children && route.children.length > 0) {
        return checkRoute(route.children, targetPath)
      }
      return false
    })
  }

  return checkRoute(staticRoutes, path)
}

/**
 * 判断导航是否已被更新的导航取代
 */
function isNavigationStale(navigationId: number): boolean {
  return navigationId !== navigationCounter
}

/**
 * 确保动态路由已注册（并发安全）
 * 多个并发导航共享同一份初始化 promise，等待而非互相 next(false) 取消，避免刷新后黑屏卡死。
 */
export async function ensureRoutesInitialized(router: Router): Promise<void> {
  if (routeRegistry?.isRegistered()) return
  // 初始化进行中：共享同一份 promise，等待即可（不 cancel 并发导航）
  if (routeInitInProgress && initPromise) {
    return initPromise
  }
  if (!initPromise) {
    initPromise = performRouteInit(router).finally(() => {
      initPromise = null // 无论成败都重置，允许后续重试（如重新登录后）
    })
  }
  return initPromise
}

/**
 * 动态路由初始化（仅做数据初始化，不做导航）
 * 负责：获取用户信息、菜单数据、注册动态路由、写入 store、保存 iframe 路由、验证工作标签页。
 */
async function performRouteInit(router: Router): Promise<void> {
  routeInitInProgress = true
  pendingLoading = true
  loadingService.showLoading()
  try {
    // 1. 获取用户信息
    await fetchUserInfo()
    // 2. 获取菜单数据
    const menuList = await menuProcessor.getMenuList()
    // 3. 验证菜单数据
    if (!menuProcessor.validateMenuList(menuList)) {
      throw new Error('获取菜单列表失败，请重新登录')
    }
    // 4. 注册动态路由
    routeRegistry?.register(menuList)
    // 5. 保存菜单数据到 store
    const menuStore = useMenuStore()
    menuStore.setMenuList(menuList)
    menuStore.addRemoveRouteFns(routeRegistry?.getRemoveRouteFns() || [])
    // 6. 保存 iframe 路由
    IframeRouteManager.getInstance().save()
    // 7. 验证工作标签页
    useWorktabStore().validateWorktabs(router)
  } finally {
    routeInitInProgress = false
    closeLoading()
  }
}

/**
 * 获取用户信息
 */
async function fetchUserInfo(): Promise<void> {
  const userStore = useUserStore()
  // 登录时已设置用户信息；刷新页面时需重新拉取权限作用域
  if (userStore.info?.userId) {
    userStore.checkAndClearWorktabs()
    const permissionStore = usePermissionStore()
    if (!permissionStore.loaded) {
      try {
        await permissionStore.loadPermissions()
        if (userStore.info) {
          userStore.setUserInfo({
            ...(userStore.info as Api.Auth.UserInfo),
            buttons: permissionStore.buttons
          })
        }
      } catch (e) {
        console.warn('[RouteGuard] 加载用户权限失败:', e)
        throw e instanceof Error ? e : new Error('加载用户权限失败')
      }
    }
    return
  }
}

/**
 * 重置路由相关状态
 */
export function resetRouterState(delay: number): void {
  setTimeout(() => {
    routeRegistry?.unregister()
    IframeRouteManager.getInstance().clear()

    const menuStore = useMenuStore()
    menuStore.removeAllDynamicRoutes()
    menuStore.setMenuList([])

    // 重置路由初始化状态，允许重新登录后再次初始化
    resetRouteInitState()
  }, delay)
}

/**
 * 处理根路径重定向到首页
 * @returns true 表示已处理跳转，false 表示无需跳转
 */
function handleRootPathRedirect(to: RouteLocationNormalized, next: NavigationGuardNext): boolean {
  if (to.path !== '/') {
    return false
  }

  const menuStore = useMenuStore()
  const target = menuStore.getHomePath() || getFirstMenuPath(menuStore.menuList) || ''

  if (target && target !== '/') {
    next({ path: target, replace: true })
    return true
  }

  return false
}

/**
 * 判断是否为未授权错误（401）
 */
function isUnauthorizedError(error: unknown): boolean {
  return isHttpError(error) && error.code === ApiStatus.unauthorized
}

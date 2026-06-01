import { AppRouteRecord } from '@/types/router'
import { dashboardRoutes } from './dashboard'
import { systemRoutes, systemMgrRoutes } from './system'
import { safeguardRoutes } from './safeguard'
import { appstoreRoutes } from './appstore'
import { helpRoutes } from './help'
import { containerRoutes } from './container'

/**
 * 导出所有模块化路由
 */
export const routeModules: AppRouteRecord[] = [
  dashboardRoutes,
  containerRoutes,
  safeguardRoutes,
  appstoreRoutes,
  systemRoutes,
  systemMgrRoutes,
  ...helpRoutes
]

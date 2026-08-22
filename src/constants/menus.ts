/**
 * 菜单权限码常量（与后端 pkg/rbac/menu/catalog.go 对齐）
 * 菜单可见性只认 menus[]，不要用 METHOD:path 兼做菜单码。
 */
export const MenuCodes = {
  Dashboard: 'dashboard',
  DashboardConsole: 'dashboard.console',

  Container: 'container',
  ContainerCluster: 'container.cluster',
  ContainerPlan: 'container.plan',
  ContainerAgent: 'container.agent',

  Middleware: 'middleware',
  MiddlewareElasticsearch: 'middleware.elasticsearch',
  MiddlewareRedis: 'middleware.redis',
  MiddlewareNacos: 'middleware.nacos',

  Monitor: 'monitor',
  MonitorRealtime: 'monitor.realtime',
  MonitorLogs: 'monitor.logs',
  MonitorAlert: 'monitor.alert',
  MonitorDatasource: 'monitor.datasource',

  AI: 'ai',
  AIAccount: 'ai.account',

  Safeguard: 'safeguard',
  SafeguardRunner: 'safeguard.runner',
  SafeguardHost: 'safeguard.host',

  Appstore: 'appstore',

  System: 'system',
  SystemRole: 'system.role',
  SystemPermission: 'system.permission',
  SystemAudit: 'system.audit',
  SystemUserCenter: 'system.user-center',

  SystemMgr: 'system-mgr',
  SystemUser: 'system.user',
  SystemTenant: 'system.tenant',
  SystemApi: 'system.api',
  SystemEmail: 'system.email'
} as const

export type MenuCode = (typeof MenuCodes)[keyof typeof MenuCodes]

import { AppRouteRecord } from '@/types/router'
import { MenuCodes } from '@/constants/menus'

export const systemRoutes: AppRouteRecord = {
  path: '/system',
  name: 'System',
  component: '/index/index',
  meta: {
    title: 'menus.system.title',
    icon: 'ri:shield-user-line',
    menu: MenuCodes.System
  },
  children: [
    {
      path: 'role',
      name: 'Role',
      component: '/system/role',
      meta: {
        title: 'menus.system.role',
        icon: 'ri:admin-line',
        keepAlive: true,
        menu: MenuCodes.SystemRole
      }
    },
    {
      path: 'permission',
      name: 'Permission',
      component: '/system/permission',
      meta: {
        title: 'menus.system.permission',
        icon: 'ri:shield-keyhole-line',
        keepAlive: true,
        menu: MenuCodes.SystemPermission
      }
    },
    {
      path: 'audit',
      name: 'SafeguardAudit',
      component: '/safeguard/audit',
      meta: {
        title: 'menus.safeguard.audit',
        icon: 'ri:shield-check-line',
        keepAlive: true,
        menu: MenuCodes.SystemAudit
      }
    },
    {
      path: 'user-center',
      name: 'UserCenter',
      component: '/system/user-center',
      meta: {
        title: 'menus.system.userCenter',
        icon: 'ri:user-line',
        isHide: true,
        keepAlive: true,
        isHideTab: true,
        public: true,
        menu: MenuCodes.SystemUserCenter
      }
    }
  ]
}

export const systemMgrRoutes: AppRouteRecord = {
  path: '/system-mgr',
  name: 'SystemMgr',
  component: '/index/index',
  meta: {
    title: 'menus.system.sysMgr',
    icon: 'ri:settings-3-line',
    menu: MenuCodes.SystemMgr
  },
  children: [
    {
      path: 'user',
      name: 'User',
      component: '/system/user',
      meta: {
        title: 'menus.system.user',
        icon: 'ri:user-line',
        keepAlive: true,
        menu: MenuCodes.SystemUser
      }
    },
    {
      path: 'tenant',
      name: 'Tenant',
      component: '/system/tenant',
      meta: {
        title: 'menus.system.tenant',
        icon: 'ri:building-line',
        keepAlive: true,
        menu: MenuCodes.SystemTenant
      }
    },
    {
      path: 'api',
      name: 'ApiManage',
      component: '/system/api',
      meta: {
        title: 'menus.system.api',
        icon: 'ri:links-line',
        keepAlive: true,
        menu: MenuCodes.SystemApi
      }
    },
    {
      path: 'email',
      name: 'SystemEmail',
      component: '/system/email',
      meta: {
        title: 'menus.system.email',
        icon: 'ri:mail-send-line',
        keepAlive: true,
        menu: MenuCodes.SystemEmail
      }
    }
  ]
}

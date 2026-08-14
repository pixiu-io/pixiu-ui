import { AppRouteRecord } from '@/types/router'
import { MenuCodes } from '@/constants/menus'

export const monitorRoutes: AppRouteRecord = {
  path: '/monitor',
  name: 'Monitor',
  component: '/index/index',
  meta: {
    title: 'menus.safeguard.monitor',
    icon: 'ri:alarm-warning-line',
    keepAlive: false,
    menu: MenuCodes.Monitor
  },
  children: [
    {
      path: 'dashboard',
      name: 'MonitorDashboard',
      component: '/safeguard/dashboard',
      meta: {
        title: 'menus.safeguard.dashboard',
        icon: 'ri:dashboard-3-line',
        menu: MenuCodes.MonitorRealtime
      }
    },
    {
      path: 'realtime-query',
      name: 'MonitorRealtimeQuery',
      component: '/safeguard/realtime-query',
      meta: {
        title: 'menus.safeguard.realtimeQuery',
        icon: 'ri:line-chart-line',
        menu: MenuCodes.MonitorRealtime
      }
    },
    {
      path: 'logs',
      name: 'MonitorLogs',
      component: '/safeguard/logs',
      meta: {
        title: 'menus.safeguard.logs',
        icon: 'ri:file-text-line',
        menu: MenuCodes.MonitorLogs
      }
    },
    {
      path: 'alert-config',
      name: 'MonitorAlertConfig',
      component: '/safeguard/alert-config',
      meta: {
        title: '配置告警',
        icon: 'ri:alarm-line',
        menu: MenuCodes.MonitorAlert
      }
    },
    {
      path: 'datasource',
      name: 'MonitorDatasource',
      component: '/safeguard/datasource',
      meta: {
        title: 'menus.safeguard.datasource',
        icon: 'ri:database-2-line',
        menu: MenuCodes.MonitorDatasource
      }
    }
  ]
}

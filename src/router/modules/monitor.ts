import { AppRouteRecord } from '@/types/router'

export const monitorRoutes: AppRouteRecord = {
  path: '/monitor',
  name: 'Monitor',
  component: '/index/index',
  meta: {
    title: 'menus.safeguard.monitor',
    icon: 'ri:alarm-warning-line',
    keepAlive: false
  },
  children: [
    {
      path: 'datasource',
      name: 'MonitorDatasource',
      component: '/safeguard/datasource',
      meta: {
        title: 'menus.safeguard.datasource',
        icon: 'ri:database-2-line',
        keepAlive: true
      }
    },
    {
      path: 'logs',
      name: 'MonitorLogs',
      component: '/safeguard/logs',
      meta: {
        title: 'menus.safeguard.logs',
        icon: 'ri:file-text-line',
        keepAlive: true
      }
    }
  ]
}

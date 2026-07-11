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
      path: 'realtime-query',
      name: 'MonitorRealtimeQuery',
      component: '/safeguard/realtime-query',
      meta: {
        title: 'menus.safeguard.realtimeQuery',
        icon: 'ri:line-chart-line'
      }
    },
    {
      path: 'logs',
      name: 'MonitorLogs',
      component: '/safeguard/logs',
      meta: {
        title: 'menus.safeguard.logs',
        icon: 'ri:file-text-line'
      }
    },
    {
      path: 'alert-config',
      name: 'MonitorAlertConfig',
      component: '/safeguard/alert-config',
      meta: {
        title: '配置告警',
        icon: 'ri:alarm-line'
      }
    },
    {
      path: 'datasource',
      name: 'MonitorDatasource',
      component: '/safeguard/datasource',
      meta: {
        title: 'menus.safeguard.datasource',
        icon: 'ri:database-2-line'
      }
    }
  ]
}

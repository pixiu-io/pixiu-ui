import { AppRouteRecord } from '@/types/router'

export const safeguardRoutes: AppRouteRecord = {
  path: '/safeguard',
  name: 'Safeguard',
  component: '/index/index',
  meta: {
    title: 'menus.safeguard.title',
    icon: 'ri:shield-check-line',
    keepAlive: false
  },
  children: [
    {
      path: 'host',
      name: 'SafeguardHost',
      component: '/safeguard/host',
      meta: {
        title: 'menus.safeguard.host',
        icon: 'ri:server-line',
        keepAlive: true
      }
    },
    {
      path: 'audit',
      name: 'SafeguardAudit',
      component: '/safeguard/audit',
      meta: {
        title: 'menus.safeguard.audit',
        icon: 'ri:shield-check-line',
        keepAlive: true
      }
    },
    {
      path: 'agent',
      name: 'SafeguardAgent',
      component: '/safeguard/agent',
      meta: {
        title: 'menus.safeguard.agent',
        icon: 'ri:robot-2-line',
        keepAlive: true
      }
    }
  ]
}

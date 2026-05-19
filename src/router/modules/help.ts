import { AppRouteRecord } from '@/types/router'

export const helpRoutes: AppRouteRecord[] = [
  {
    name: 'ChangeLog',
    path: '/change/log',
    component: '/change/log',
    meta: {
      title: 'menus.plan.log',
      showTextBadge: 'v2.0.1',
      icon: 'ri:gamepad-line',
      keepAlive: false
    }
  }
]

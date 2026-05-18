import { AppRouteRecord } from '@/types/router'

export const helpRoutes: AppRouteRecord[] = [
  {
    name: 'ChangeLog',
    path: '/change/log',
    component: '/change/log',
    meta: {
      title: 'menus.plan.log',
      showTextBadge: `v${__APP_VERSION__}`,
      icon: 'ri:gamepad-line',
      keepAlive: false
    }
  }
]

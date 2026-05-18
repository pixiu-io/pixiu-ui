import { AppRouteRecord } from '@/types/router'

export const appstoreRoutes: AppRouteRecord = {
  path: '/appstore',
  name: 'Appstore',
  component: '/appstore/index',
  meta: {
    title: 'menus.appstore.title',
    icon: 'ri:store-2-line',
    keepAlive: true
  },
  children: []
}

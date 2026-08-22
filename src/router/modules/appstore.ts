import { AppRouteRecord } from '@/types/router'
import { MenuCodes } from '@/constants/menus'
import { HELM_UI_VISIBLE } from '@/constants/feature-flags'

export const appstoreRoutes: AppRouteRecord = {
  path: '/appstore',
  name: 'Appstore',
  component: '/appstore/index',
  meta: {
    title: 'menus.appstore.title',
    icon: 'ri:store-2-line',
    keepAlive: true,
    menu: MenuCodes.Appstore,
    isHide: !HELM_UI_VISIBLE
  }
}

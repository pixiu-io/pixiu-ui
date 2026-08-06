import { AppRouteRecord } from '@/types/router'
import { MenuCodes } from '@/constants/menus'

export const safeguardRoutes: AppRouteRecord = {
  path: '/safeguard',
  name: 'Safeguard',
  component: '/index/index',
  meta: {
    title: 'menus.safeguard.title',
    icon: 'ri:tools-fill',
    keepAlive: false,
    menu: MenuCodes.Safeguard
  },
  children: [
    {
      path: 'runner',
      name: 'SafeguardRunner',
      component: '/safeguard/runner',
      meta: {
        title: 'menus.safeguard.runner',
        icon: 'ri:terminal-box-line',
        keepAlive: true,
        menu: MenuCodes.SafeguardRunner
      }
    },
    {
      path: 'agent',
      name: 'SafeguardAgent',
      component: '/safeguard/agent',
      meta: {
        title: 'menus.safeguard.agent',
        icon: 'ri:robot-2-line',
        keepAlive: true,
        isHide: true,
        menu: MenuCodes.ContainerAgent
      }
    },
    {
      path: 'host',
      name: 'SafeguardHost',
      component: '/safeguard/host',
      meta: {
        title: 'menus.safeguard.host',
        icon: 'ri:server-line',
        keepAlive: true,
        menu: MenuCodes.SafeguardHost
      }
    },
    {
      path: 'distribution',
      redirect: { name: 'SafeguardRunner', query: { tab: 'distribution' } },
      meta: {
        title: 'menus.safeguard.runner',
        isHide: true,
        menu: MenuCodes.SafeguardRunner
      }
    },
    {
      path: 'runner-distribution',
      redirect: { name: 'SafeguardRunner' },
      meta: {
        title: 'menus.safeguard.runner',
        isHide: true,
        menu: MenuCodes.SafeguardRunner
      }
    }
  ]
}

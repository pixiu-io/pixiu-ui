import { AppRouteRecord } from '@/types/router'
import { MenuCodes } from '@/constants/menus'

export const middlewareRoutes: AppRouteRecord = {
  path: '/middleware',
  name: 'Middleware',
  component: '/index/index',
  meta: {
    title: '中间件',
    icon: 'ri:stack-line',
    keepAlive: false,
    menu: MenuCodes.Middleware
  },
  children: [
    {
      path: 'elasticsearch',
      name: 'MiddlewareElasticsearch',
      component: '/middleware/elasticsearch',
      meta: {
        title: 'Elasticsearch',
        icon: 'ri:search-line',
        menu: MenuCodes.MiddlewareElasticsearch
      }
    }
  ]
}

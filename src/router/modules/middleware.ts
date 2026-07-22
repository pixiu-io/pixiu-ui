import { AppRouteRecord } from '@/types/router'

export const middlewareRoutes: AppRouteRecord = {
  path: '/middleware',
  name: 'Middleware',
  component: '/index/index',
  meta: {
    title: '中间件',
    icon: 'ri:stack-line',
    keepAlive: false
  },
  children: [
    {
      path: 'elasticsearch',
      name: 'MiddlewareElasticsearch',
      component: '/middleware/elasticsearch',
      meta: {
        title: 'Elasticsearch',
        icon: 'ri:search-line'
      }
    }
  ]
}

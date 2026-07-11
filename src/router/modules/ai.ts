import { AppRouteRecord } from '@/types/router'

export const aiRoutes: AppRouteRecord = {
  path: '/ai',
  name: 'AI',
  component: '/index/index',
  meta: {
    title: '智能助手',
    icon: 'ri:robot-2-line'
  },
  children: [
    {
      path: 'ai-account',
      name: 'AiAccount',
      component: '/system/ai-account',
      meta: {
        title: 'Provider',
        icon: 'ri:openai-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    }
  ]
}

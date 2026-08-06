import { AppRouteRecord } from '@/types/router'
import { MenuCodes } from '@/constants/menus'

export const aiRoutes: AppRouteRecord = {
  path: '/ai',
  name: 'AI',
  component: '/index/index',
  meta: {
    title: '智能助手',
    icon: 'ri:robot-2-line',
    menu: MenuCodes.AI
  },
  children: [
    {
      path: 'ai-account',
      name: 'AiAccount',
      component: '/system/ai-account',
      meta: {
        title: 'AI 账号',
        icon: 'ri:openai-line',
        keepAlive: true,
        menu: MenuCodes.AIAccount
      }
    }
  ]
}

import App from './App.vue'
import { createApp } from 'vue'
import { initStore } from './store'
import { initRouter } from './router'
import { router } from './router'
import { ensureRoutesInitialized } from './router/guards/beforeEach'
import language from './locales'
import '@styles/core/tailwind.css'
import '@styles/index.scss'
import '@utils/sys/console.ts'
import { setupGlobDirectives } from './directives'
import { setupErrorHandle } from './utils/sys/error-handle'
import NProgress from 'nprogress'
import { loadingService } from '@/utils/ui'

document.addEventListener('touchstart', function () {}, { passive: false })

// 懒加载 chunk 失败兜底：避免刷新/导航后黑屏卡死
router.onError((error: any) => {
  const message = error?.message || ''
  if (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed')
  ) {
    loadingService.hideLoading()
    NProgress.done()
    if (!sessionStorage.getItem('pixiu-chunk-reload')) {
      sessionStorage.setItem('pixiu-chunk-reload', '1')
      window.location.reload()
    } else {
      sessionStorage.removeItem('pixiu-chunk-reload')
      void router.replace({ name: 'Exception500' })
    }
  }
})

async function bootstrap(): Promise<void> {
  const app = createApp(App)
  initStore(app)
  initRouter(app)
  setupGlobDirectives(app)
  setupErrorHandle(app)

  // 已登录时先把动态路由初始化完成，避免守卫内初始化窗口的并发竞态（刷新卡死根因）
  if (localStorage.getItem('pixiu-access-token')) {
    try {
      await ensureRoutesInitialized(router)
    } catch (error) {
      console.warn('[Bootstrap] 路由初始化失败，交由守卫处理:', error)
    }
  }

  app.use(language)
  app.mount('#app')
}

void bootstrap()

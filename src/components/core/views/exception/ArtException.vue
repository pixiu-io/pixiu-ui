<template>
  <div class="page-content !border-0 !bg-transparent min-h-screen flex-cc">
    <div class="flex-cc max-md:!block max-md:text-center">
      <ThemeSvg :src="data.imgUrl" size="100%" class="!w-100" />
      <div class="ml-15 w-75 max-md:mx-auto max-md:mt-10 max-md:w-full max-md:text-center">
        <p class="text-xl leading-7 text-g-600 max-md:text-lg">{{ data.desc }}</p>
        <ElButton type="primary" size="large" @click="backHome" v-ripple class="mt-5">{{
          data.btnText
        }}</ElButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import { useMenuStore } from '@/store/modules/menu'
  import { useUserStore } from '@/store/modules/user'
  import { getFirstMenuPath } from '@/utils'
  import { RoutesAlias } from '@/router/routesAlias'

  const router = useRouter()
  const userStore = useUserStore()
  const menuStore = useMenuStore()

  interface ExceptionData {
    /** 标题 */
    title: string
    /** 描述 */
    desc: string
    /** 按钮文本 */
    btnText: string
    /** 图片地址 */
    imgUrl: string
  }

  withDefaults(
    defineProps<{
      data: ExceptionData
    }>(),
    {}
  )

  /**
   * 解析可导航首页。
   * 优先用菜单第一项（与侧栏一致）；勿回退到 `/`——根路径常被 catch-all 当成 404，导致「返回首页」无效。
   */
  function resolveHomePath(): string {
    const fromMenu = getFirstMenuPath(menuStore.menuList)
    if (fromMenu && fromMenu !== '/') return fromMenu
    const configured = (menuStore.getHomePath() || '').trim()
    if (configured && configured !== '/') return configured
    return ''
  }

  const backHome = async () => {
    const targetHomePath = resolveHomePath()

    if (!userStore.isLogin) {
      await router.push({
        name: 'Login',
        query: targetHomePath ? { redirect: targetHomePath } : undefined
      })
      return
    }

    if (!targetHomePath) {
      ElMessage.warning('暂无可用首页，请联系管理员配置菜单权限')
      await router.replace(RoutesAlias.Login)
      return
    }

    if (router.currentRoute.value.path === targetHomePath) {
      window.location.reload()
      return
    }

    await router.replace(targetHomePath)
  }
</script>

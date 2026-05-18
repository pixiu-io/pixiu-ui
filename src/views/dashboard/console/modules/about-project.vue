<template>
  <div class="art-card p-5 flex-b mb-5 max-sm:mb-4">
    <div>
      <h2 class="text-2xl font-medium">关于项目</h2>
      <p class="text-g-700 mt-1">一个开源的企业级容器平台，为企业提供 Kubernetes 资源可视化部署和管理功能。</p>
      <p class="text-g-700 mt-1">使用了 Vue3、TypeScript、Vite、Element Plus 等前沿技术</p>

      <div class="flex flex-wrap gap-3.5 max-w-150 mt-9">
        <div
          class="w-60 flex-cb h-12.5 px-3.5 border border-g-300 c-p rounded-lg text-sm bg-g-100 duration-300 hover:-translate-y-1 max-sm:w-full"
          v-for="link in linkList"
          :key="link.label"
          @click="goPage(link.url)"
        >
          <span class="text-g-700 flex items-center gap-2">
            <ArtSvgIcon
              v-if="link.icon"
              :icon="link.icon"
              class="text-base shrink-0"
              :class="link.iconClass"
            />
            {{ link.label }}
          </span>
          <ArtSvgIcon icon="ri:arrow-right-s-line" class="text-lg text-g-600" />
        </div>
      </div>
    </div>
    <img class="w-75 max-md:!hidden" src="@imgs/draw/draw1.png" alt="draw1" />
  </div>
</template>

<script setup lang="ts">
  import AppConfig from '@/config'
  import { WEB_LINKS } from '@/utils/constants'

  const systemName = AppConfig.systemInfo.name

  const linkList = [
    { label: '项目官网', url: WEB_LINKS.DOCS },
    { label: '文档', url: WEB_LINKS.INTRODUCE },
    {
      label: 'Github',
      url: WEB_LINKS.GITHUB_HOME,
      icon: 'simple-icons:github',
      iconClass: 'about-github-icon'
    },
    { label: '哔哩哔哩', url: WEB_LINKS.BILIBILI }
  ]

  /**
   * 在新标签页中打开指定 URL
   * @param url 要打开的网页地址
   */
  const goPage = (url: string): void => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
</script>

<style scoped>
  .about-github-icon {
    color: #24292f;
  }
</style>

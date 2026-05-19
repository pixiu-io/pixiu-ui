<!-- 面包屑导航 -->
<template>
  <nav class="ml-2.5 max-lg:!hidden" aria-label="breadcrumb">
    <ul class="flex-c h-full">
      <li
        v-for="(item, index) in breadcrumbItems"
        :key="item.key"
        class="box-border flex-c h-7 text-sm leading-7"
      >
        <div
          :class="
            isClickable(item, index)
              ? 'c-p py-1 rounded tad-200 hover:bg-active-color hover:[&_span]:text-g-600'
              : ''
          "
          @click="handleBreadcrumbClick(item, index)"
        >
          <span
            class="block max-w-46 overflow-hidden text-ellipsis whitespace-nowrap px-1.5 text-sm text-g-600 dark:text-g-800"
            >{{ formatMenuTitle(item.title) }}</span
          >
        </div>
        <div
          v-if="!isLastItem(index) && item.title"
          class="mx-1 text-sm not-italic text-g-500"
          aria-hidden="true"
        >
          /
        </div>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import type { RouteLocationMatched, RouteRecordRaw } from 'vue-router'
  import { formatMenuTitle } from '@/utils/router'
  import { resolveClusterAlias } from '@/utils/navigation/cluster-query'

  defineOptions({ name: 'ArtBreadcrumb' })

  export interface BreadcrumbItem {
    key: string
    path: string
    meta: RouteRecordRaw['meta']
    title: string
  }

  const route = useRoute()
  const router = useRouter()

  const CLUSTER_DETAIL_TITLE_MAP: Record<string, string> = {
    ClusterDetailOverview: '基本信息',
    ClusterDetailNodes: '节点管理',
    ClusterDetailNamespaces: '命名空间',
    ClusterDetailWorkloads: '工作负载',
    ClusterDetailPods: 'Pod',
    ClusterDetailServices: '服务与路由',
    ClusterDetailConfig: '配置管理',
    ClusterDetailStorage: '存储',
    ClusterDetailAutoscaling: '弹性伸缩',
    ClusterDetailAuth: '认证配置',
    ClusterDetailApiservices: 'APIService',
    ClusterDetailAddonComponents: '扩展组件',
    ClusterDetailAlert: '告警',
    ClusterDetailLogs: '日志',
    ClusterDetailEvents: '事件',
    ClusterDetailPrometheus: '监控'
  }

  // 使用computed替代watch，提高性能
  const breadcrumbItems = computed<BreadcrumbItem[]>(() => {
    const { matched } = route
    const matchedLength = matched.length

    // 处理首页情况
    if (!matchedLength || isHomeRoute(matched[0])) {
      return []
    }

    // 处理一级菜单和普通路由
    const firstRoute = matched[0]
    const isFirstLevel = firstRoute.meta?.isFirstLevel
    const lastIndex = matchedLength - 1
    const currentRoute = matched[lastIndex]
    const currentRouteMeta = currentRoute.meta

    let items = isFirstLevel
      ? [createBreadcrumbItem(currentRoute, matchedLength - 1)]
      : matched.map((m, index) => createBreadcrumbItem(m, index))

    // 过滤包裹容器：如果有多个项目且第一个是容器路由（如 /outside），则移除它
    if (items.length > 1 && isWrapperContainer(items[0])) {
      items = items.slice(1)
    }

    // 去掉相邻重复标题（如父子路由 title 相同时）
    items = items.filter((item, index, arr) => {
      if (index === 0) return true
      return arr[index - 1]?.title !== item.title
    })

    // IFrame 页面特殊处理：如果过滤后只剩一个 iframe 页面，或者所有项都是包裹容器，则仅展示当前页
    if (currentRouteMeta?.isIframe && (items.length === 1 || items.every(isWrapperContainer))) {
      return [createBreadcrumbItem(currentRoute, matchedLength - 1)]
    }

    return items
  })

  // 辅助函数：判断是否为包裹容器路由
  const isWrapperContainer = (item: BreadcrumbItem): boolean =>
    item.path === '/outside' && !!item.meta?.isIframe

  // 辅助函数：创建面包屑项目
  const createBreadcrumbItem = (matched: RouteLocationMatched, index: number): BreadcrumbItem => {
    const routeName = matched.name ? String(matched.name) : 'anonymous'
    const rawTitle = String(matched.meta?.title ?? '')
    let mappedTitle: string
    if (rawTitle === 'menus.container.clusterDetail') {
      if (CLUSTER_DETAIL_TITLE_MAP[routeName]) {
        // 已知子页（如 ClusterDetailWorkloads → "工作负载"）
        mappedTitle = CLUSTER_DETAIL_TITLE_MAP[routeName]
      } else {
        // 父级布局路由--显示集群别名（URL / 缓存 / 内部名）
        const alias = resolveClusterAlias(route)
        mappedTitle = alias || rawTitle
      }
    } else {
      mappedTitle = rawTitle
    }
    return {
      key: `${matched.path}::${routeName}::${index}`,
      path: matched.path,
      meta: matched.meta,
      title: mappedTitle
    }
  }

  // 辅助函数：判断是否为首页
  const isHomeRoute = (route: RouteLocationMatched): boolean => route.name === '/'

  // 辅助函数：判断是否为最后一项
  const isLastItem = (index: number): boolean => {
    const itemsLength = breadcrumbItems.value.length
    return index === itemsLength - 1
  }

  // 辅助函数：判断是否可点击
  const isClickable = (item: BreadcrumbItem, index: number): boolean =>
    item.path !== '/outside' && !isLastItem(index)

  // 辅助函数：查找路由的第一个有效子路由
  const findFirstValidChild = (route: RouteRecordRaw) =>
    route.children?.find((child) => !child.redirect && !child.meta?.isHide)

  // 辅助函数：构建完整路径
  const buildFullPath = (childPath: string): string => `/${childPath}`.replace('//', '/')

  // 处理面包屑点击事件
  async function handleBreadcrumbClick(item: BreadcrumbItem, index: number): Promise<void> {
    // 如果是最后一项或外部链接，不处理
    if (isLastItem(index) || item.path === '/outside') {
      return
    }

    try {
      // 缓存路由表查找结果
      const routes = router.getRoutes()
      const targetRoute = routes.find((route) => route.path === item.path)

      if (!targetRoute?.children?.length) {
        await router.push(item.path)
        return
      }

      const firstValidChild = findFirstValidChild(targetRoute)
      if (firstValidChild) {
        await router.push(buildFullPath(firstValidChild.path))
      } else {
        await router.push(item.path)
      }
    } catch (error) {
      console.error('导航失败:', error)
    }
  }
</script>

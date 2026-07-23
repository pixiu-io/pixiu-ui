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
            item.path !== '/outside' && index < breadcrumbItems.length - 1
              ? 'c-p py-1 rounded tad-200 hover:bg-active-color hover:[&_span]:text-g-600'
              : ''
          "
          @click="handleBreadcrumbClick(item, index, breadcrumbItems.length)"
        >
          <span
            class="block max-w-46 overflow-hidden text-ellipsis whitespace-nowrap px-1.5 text-sm text-g-600 dark:text-g-800"
            >{{ formatMenuTitle(item.title) }}</span
          >
        </div>
        <div
          v-if="index < breadcrumbItems.length - 1 && item.title"
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
  import {
    buildClusterRouteQuery,
    isClusterDetailSubPath,
    resolveClusterAlias
  } from '@/utils/navigation/cluster-query'

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
    ClusterDetailAlert: '告警',
    ClusterDetailEvents: '事件',
    ClusterDetailPrometheus: '监控'
  }

  const breadcrumbItems = computed<BreadcrumbItem[]>(() => {
    const { matched } = route
    const matchedLength = matched.length

    if (!matchedLength || isHomeRoute(matched[0])) {
      return []
    }

    const firstRoute = matched[0]
    const isFirstLevel = firstRoute.meta?.isFirstLevel
    const lastIndex = matchedLength - 1
    const currentRoute = matched[lastIndex]
    const currentRouteMeta = currentRoute.meta

    let items = isFirstLevel
      ? [createBreadcrumbItem(currentRoute, matchedLength - 1)]
      : matched.map((m, index) => createBreadcrumbItem(m, index))

    if (items.length > 1 && isWrapperContainer(items[0])) {
      items = items.slice(1)
    }

    items = items.filter((item, index, arr) => {
      if (index === 0) return true
      return arr[index - 1]?.title !== item.title
    })

    if (currentRouteMeta?.isIframe && (items.length === 1 || items.every(isWrapperContainer))) {
      return [createBreadcrumbItem(currentRoute, matchedLength - 1)]
    }

    return ensureClusterDetailBreadcrumb(items)
  })

  const isWrapperContainer = (item: BreadcrumbItem): boolean =>
    item.path === '/outside' && !!item.meta?.isIframe

  /** 从工作负载详情等全屏子页返回时，matched 可能缺少布局父级，补插集群名称段 */
  function ensureClusterDetailBreadcrumb(items: BreadcrumbItem[]): BreadcrumbItem[] {
    if (!isClusterDetailSubPath(route.path)) return items

    const clusterLabel = resolveClusterAlias(route).trim()
    if (!clusterLabel) return items

    const routeName = route.name ? String(route.name) : ''
    if (!routeName || !CLUSTER_DETAIL_TITLE_MAP[routeName]) return items
    if (items.some((item) => item.title === clusterLabel)) return items

    const clusterItem: BreadcrumbItem = {
      key: `cluster-name::${clusterLabel}`,
      path: '/container/overview',
      meta: {
        isClusterNameCrumb: true,
        clusterQuery: buildClusterRouteQuery(route)
      },
      title: clusterLabel
    }

    const next = [...items]
    next.splice(Math.max(next.length - 1, 1), 0, clusterItem)
    return next
  }

  const createBreadcrumbItem = (matched: RouteLocationMatched, index: number): BreadcrumbItem => {
    const routeName = matched.name ? String(matched.name) : ''
    const rawTitle = String(matched.meta?.title ?? '')
    const isClusterDetailMeta =
      matched.meta?.tabGroup === 'clusterDetail' || rawTitle === 'menus.container.clusterDetail'

    let mappedTitle: string
    if (isClusterDetailMeta && routeName && CLUSTER_DETAIL_TITLE_MAP[routeName]) {
      mappedTitle = CLUSTER_DETAIL_TITLE_MAP[routeName]
    } else if (isClusterDetailMeta) {
      const alias = resolveClusterAlias(route)
      mappedTitle = alias || rawTitle
    } else {
      mappedTitle = rawTitle
    }

    return {
      key: `${matched.path}::${routeName || 'anonymous'}::${index}`,
      path: matched.path,
      meta: matched.meta,
      title: mappedTitle
    }
  }

  const isHomeRoute = (route: RouteLocationMatched): boolean => route.name === '/'

  const findFirstValidChild = (route: RouteRecordRaw) =>
    route.children?.find((child) => !child.redirect && !child.meta?.isHide)

  const buildFullPath = (childPath: string): string => `/${childPath}`.replace('//', '/')

  async function handleBreadcrumbClick(
    item: BreadcrumbItem,
    index: number,
    total: number
  ): Promise<void> {
    if (index >= total - 1 || item.path === '/outside') {
      return
    }

    try {
      if (item.meta?.isClusterNameCrumb && item.meta?.clusterQuery) {
        await router.push({
          path: '/container/overview',
          query: item.meta.clusterQuery as Record<string, string>
        })
        return
      }

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

<template>
  <ElBreadcrumb separator="/">
    <ElBreadcrumbItem :to="clusterOverviewTo">{{ clusterAlias }}</ElBreadcrumbItem>
    <ElBreadcrumbItem :to="parentTo">{{ parentLabel }}</ElBreadcrumbItem>
    <ElBreadcrumbItem>{{ currentLabel }}</ElBreadcrumbItem>
  </ElBreadcrumb>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useRoute } from 'vue-router'
  import { buildClusterRouteQuery, resolveClusterAlias } from '@/utils/navigation/cluster-query'

  defineOptions({ name: 'ClusterResourceBreadcrumb' })

  const props = defineProps<{
    /** 上一级列表页 path，如 /container/workloads */
    parentPath: string
    /** 上一级列表页标题，如「工作负载」 */
    parentLabel: string
    /** 当前页标题，如「创建 Deployment」 */
    currentLabel: string
    /** 上一级列表页额外 query（如 tab） */
    parentQuery?: Record<string, string | undefined>
  }>()

  const route = useRoute()

  const clusterAlias = computed(() => resolveClusterAlias(route))

  const clusterOverviewTo = computed(() => ({
    path: '/container/overview',
    query: buildClusterRouteQuery(route)
  }))

  const parentTo = computed(() => ({
    path: props.parentPath,
    query: buildClusterRouteQuery(route, props.parentQuery)
  }))
</script>

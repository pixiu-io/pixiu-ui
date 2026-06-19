<!-- 集群详情：顶栏 + 左侧资源菜单 + 子路由（URL: /container/<页>?cluster=<name>） -->
<template>
  <div class="cluster-detail-layout art-full-height">
    <header class="cluster-detail-header">
      <div class="cluster-detail-header__left">
        <ElButton :icon="ArrowLeft" text @click="goBack">返回</ElButton>
        <ElDivider direction="vertical" />
        <div class="cluster-detail-name-wrap">
          <span class="cluster-detail-name-label">集群名称：</span>
          <ElSelect
            :model-value="ctx.name"
            class="cluster-detail-cluster-select"
            :fit-input-width="true"
            :loading="clusterListLoading"
            placeholder="请选择集群"
            placement="bottom-start"
            teleported
            popper-class="cluster-detail-cluster-select-popper"
            @visible-change="onClusterSelectVisible"
            @change="onClusterSelectChange"
          >
            <template #header>
              <ElInput
                ref="clusterSearchInputRef"
                v-model="clusterSearchKeyword"
                class="cluster-detail-cluster-search"
                placeholder="搜索集群"
                clearable
                @click.stop
                @keydown.stop
              >
                <template #prefix>
                  <ElIcon><Search /></ElIcon>
                </template>
              </ElInput>
            </template>
            <ElOption
              v-for="c in filteredClusterSelectOptions"
              :key="c.name"
              :label="c.aliasName || c.name"
              :value="c.name"
            />
            <template #empty>
              <span class="cluster-detail-cluster-empty">无匹配集群</span>
            </template>
          </ElSelect>
        </div>
        <ElTag :type="statusTag.type" effect="light" class="cluster-detail-status">
          {{ statusTag.text }}
        </ElTag>
        <ElDivider direction="vertical" />
        <div class="cluster-detail-ns-wrap">
          <span class="cluster-detail-name-label">命名空间：</span>
          <ElSelect
            v-model="selectedNamespace"
            class="cluster-detail-ns-select"
            clearable
            placeholder="所有命名空间"
            :loading="nsLoading"
            :fit-input-width="true"
            popper-class="cluster-detail-ns-select-popper"
            @visible-change="onNamespaceSelectVisibleChange"
          >
            <template #header>
              <ElInput
                ref="namespaceSearchInputRef"
                v-model="namespaceSearchKeyword"
                class="cluster-detail-ns-search"
                placeholder="搜索命名空间"
                clearable
                @click.stop
                @keydown.stop
              >
                <template #prefix>
                  <ElIcon><Search /></ElIcon>
                </template>
              </ElInput>
            </template>
            <template #label="{ label, value }">
              <span style="display: inline-flex; align-items: center; gap: 4px">
                <span class="ns-selected-label">{{ label }}</span>
                <span v-if="isSystemNamespace(String(value || ''))" class="ns-system-tag"
                  >系统</span
                >
              </span>
            </template>
            <ElOption v-for="ns in filteredNamespaceOptions" :key="ns" :value="ns" :label="ns">
              <span style="display: inline-flex; align-items: center; gap: 0">
                <span class="ns-option-name">{{ ns }}</span>
                <span v-if="isSystemNamespace(ns)" class="ns-system-tag">系统</span>
              </span>
            </ElOption>
            <template #empty>
              <span class="cluster-detail-ns-empty">无匹配命名空间</span>
            </template>
          </ElSelect>
          <ElTag v-if="ctx.permissionId" type="success" effect="plain" style="margin-left: 8px">
            授权
          </ElTag>
        </div>
      </div>
      <div class="cluster-detail-header__right">
        <ElButton
          link
          type="primary"
          class="cluster-detail-remote-login-btn"
          :disabled="cloudShellDisabled"
          @click="openCloudShell"
        >
          远程登录
        </ElButton>
        <ElButton
          v-ripple
          class="cluster-detail-header-action-btn"
          :disabled="!ctx.name"
          @click="yamlCreateVisible = true"
          >YAML创建资源</ElButton
        >
      </div>
    </header>

    <ClusterCloudShell ref="cloudShellRef" />
    <ClusterYamlCreateDialog v-model:visible="yamlCreateVisible" :cluster="ctx.name" />

    <div class="cluster-detail-body">
      <aside class="cluster-detail-sider">
        <ElMenu
          :default-active="activeMenuKey"
          :default-openeds="DEFAULT_SUBMENU_OPENEDS"
          :text-color="getMenuTheme.textColor"
          :active-text-color="'var(--theme-color)'"
          class="cluster-detail-menu"
          @select="onMenuSelect"
        >
          <ElMenuItem index="overview">
            <span>基本信息</span>
          </ElMenuItem>

          <ElSubMenu index="group-resource">
            <template #title>
              <span>资源对象</span>
            </template>
            <ElMenuItem index="nodes">节点管理</ElMenuItem>
            <ElMenuItem index="namespaces">命名空间</ElMenuItem>
            <ElMenuItem index="workloads">工作负载</ElMenuItem>
            <ElMenuItem index="pods">Pod</ElMenuItem>
            <ElMenuItem index="services">服务与路由</ElMenuItem>
            <ElMenuItem index="config">配置管理</ElMenuItem>
            <ElMenuItem index="storage">存储</ElMenuItem>
          </ElSubMenu>

          <ElSubMenu index="group-ops">
            <template #title>
              <span>运维中心</span>
            </template>
            <ElMenuItem index="autoscaling">弹性伸缩</ElMenuItem>
            <ElMenuItem index="auth">认证授权</ElMenuItem>
            <ElMenuItem index="addon-components">组件管理</ElMenuItem>
            <ElMenuItem index="crds">自定义资源</ElMenuItem>
            <ElMenuItem index="apiservices">APIService</ElMenuItem>
          </ElSubMenu>

          <ElSubMenu index="group-monitor">
            <template #title>
              <span>监控告警</span>
            </template>
            <ElMenuItem index="logs">
              <span>日志</span>
              <span class="menu-new-tag">NEW</span>
            </ElMenuItem>
            <ElMenuItem index="events">事件</ElMenuItem>
            <ElMenuItem index="alert">配置告警</ElMenuItem>
            <ElMenuItem index="prometheus">Prometheus监控</ElMenuItem>
          </ElSubMenu>
        </ElMenu>
      </aside>

      <main class="cluster-detail-main">
        <RouterView v-slot="{ Component, route: childRoute }">
          <Transition name="fade-slide" mode="out-in">
            <KeepAlive>
              <component :is="Component" :key="clusterChildViewKey(childRoute)" />
            </KeepAlive>
          </Transition>
        </RouterView>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage, type InputInstance } from 'element-plus'
  import { ArrowLeft, Refresh, Search } from '@element-plus/icons-vue'
  import { computed, nextTick, provide, ref, watch } from 'vue'
  import { useRoute, useRouter, type RouteLocationNormalizedLoaded } from 'vue-router'
  import { fetchClusterByName, fetchClusterList } from '@/api/container'
  import type { ClusterItem } from '@/api/container'
  import { resolveClusterNamespaces } from '@/api/kubernetes/namespace'
  import type { PermissionListItem } from '@/api/system-manage'
  import ClusterYamlCreateDialog from './modules/cluster-yaml-create-dialog.vue'
  import ClusterCloudShell from '@/views/container/cluster/modules/cluster-cloud-shell.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    clusterDetailActiveMenuKey,
    clusterDetailContextKey,
    clusterDetailNamespaceKey,
    clusterDetailRefreshKey,
    clusterNameSeed,
    type ClusterDetailContext
  } from './context'
  import { buildClusterRouteQuery, setClusterAliasCache } from '@/utils/navigation/cluster-query'
  import { useSettingStore } from '@/store/modules/setting'
  import { storeToRefs } from 'pinia'

  defineOptions({ name: 'ClusterDetailLayout' })

  const route = useRoute()
  const router = useRouter()
  const userStore = useUserStore()
  const settingStore = useSettingStore()
  const { getMenuTheme } = storeToRefs(settingStore)

  /** 默认展开「资源对象」「运维中心」「监控告警」 */
  const DEFAULT_SUBMENU_OPENEDS: string[] = ['group-resource', 'group-ops', 'group-monitor']

  const DETAIL_SEGMENTS = new Set([
    'overview',
    'nodes',
    'namespaces',
    'workloads',
    'pods',
    'services',
    'config',
    'storage',
    'autoscaling',
    'auth',
    'addon-components',
    'crds',
    'apiservices',
    'alert',
    'logs',
    'events',
    'prometheus'
  ])

  const clusterRow = ref<ClusterItem | null>(null)
  const clusterListItems = ref<ClusterItem[]>([])
  const clusterListLoading = ref(false)
  const clusterListLoaded = ref(false)
  let clusterListPromise: Promise<void> | null = null
  const yamlCreateVisible = ref(false)
  const cloudShellRef = ref<InstanceType<typeof ClusterCloudShell> | null>(null)

  const selectedNamespace = ref('default')
  const namespaceOptions = ref<string[]>([])
  const namespaceSearchKeyword = ref('')
  const namespaceSearchInputRef = ref<InputInstance>()
  const clusterSearchKeyword = ref('')
  const clusterSearchInputRef = ref<InputInstance>()
  const nsLoading = ref(false)
  const permissionDetail = ref<PermissionListItem | null>(null)

  const filteredNamespaceOptions = computed(() => {
    const kw = namespaceSearchKeyword.value.trim().toLowerCase()
    if (!kw) return namespaceOptions.value
    return namespaceOptions.value.filter((ns) => ns.toLowerCase().includes(kw))
  })

  function onNamespaceSelectVisibleChange(visible: boolean) {
    if (!visible) {
      namespaceSearchKeyword.value = ''
      return
    }
    const cluster = String(route.query.cluster ?? '')
    const permissionId = Number(clusterRow.value?.permissionId) || 0
    if (cluster && permissionId > 0) {
      void loadNamespaceOptions(cluster)
    }
    void nextTick(() => namespaceSearchInputRef.value?.focus())
  }

  function getNsCacheKey(cluster: string) { return `pixiu-ns-${cluster}` }
  function loadCachedNamespace(cluster: string): string | null {
    try {
      const v = localStorage.getItem(getNsCacheKey(cluster))
      return (v && v !== 'undefined' && v !== 'null') ? v : null
    }
    catch { return null }
  }
  function saveCachedNamespace(cluster: string, ns: string) {
    if (!ns || ns === 'undefined' || ns === 'null') return
    try { localStorage.setItem(getNsCacheKey(cluster), ns) }
    catch { /* ignore */ }
  }

  async function loadNamespaceOptions(clusterName: string) {
    if (!clusterName) {
      namespaceOptions.value = []
      permissionDetail.value = null
      return
    }
    nsLoading.value = true
    try {
      const row = clusterRow.value || findClusterInList(clusterName)
      const permissionId = Number(row?.permissionId) || 0
      const { names, permissionDetail: detail } = await resolveClusterNamespaces(
        clusterName,
        permissionId
      )
      permissionDetail.value = detail
      namespaceOptions.value = names

      if (selectedNamespace.value && !namespaceOptions.value.includes(selectedNamespace.value)) {
        selectedNamespace.value = namespaceOptions.value[0] || ''
      }
    } catch {
      namespaceOptions.value = []
      permissionDetail.value = null
    } finally {
      nsLoading.value = false
    }
  }

  function refreshNamespaceOptions() {
    const cluster = String(route.query.cluster ?? '')
    if (cluster) void loadNamespaceOptions(cluster)
  }

  function isSystemNamespace(ns: string): boolean {
    return ns === 'default' || ns.startsWith('kube-')
  }

  async function loadClusterListForSelect(force = false) {
    if (clusterListLoaded.value && !force) return
    if (clusterListPromise && !force) return clusterListPromise

    clusterListPromise = (async () => {
      clusterListLoading.value = true
      try {
        const limit = 500
        let page = 1
        const acc: ClusterItem[] = []
        let total = 0
        do {
          const res = await fetchClusterList({ page, limit })
          total = res.total
          acc.push(...res.items)
          if (acc.length >= total || res.items.length === 0) break
          page++
          if (page > 40) break
        } while (true)
        clusterListItems.value = acc
        clusterListLoaded.value = true
      } catch {
        clusterListItems.value = []
        clusterListLoaded.value = false
      } finally {
        clusterListLoading.value = false
        clusterListPromise = null
      }
    })()

    return clusterListPromise
  }

  function findClusterInList(name: string): ClusterItem | undefined {
    if (!name) return undefined
    return clusterListItems.value.find((c) => c.name === name)
  }

  /** 优先用已加载的集群列表解析当前集群，避免与 loadClusterListForSelect 重复请求列表 */
  async function loadClusterRow(name: string) {
    if (!name) {
      clusterRow.value = null
      return
    }
    await loadClusterListForSelect()
    const fromList = findClusterInList(name)
    if (fromList) {
      clusterRow.value = fromList
      return
    }
    try {
      clusterRow.value = await fetchClusterByName(name)
    } catch {
      clusterRow.value = null
    }
  }

  function onClusterSelectVisible(visible: boolean) {
    if (!visible) {
      clusterSearchKeyword.value = ''
      return
    }
    void loadClusterListForSelect()
    void nextTick(() => clusterSearchInputRef.value?.focus())
  }

  function refreshClusterList() {
    clusterListLoaded.value = false
    clusterListPromise = null
    void loadClusterListForSelect(true)
  }

  function onClusterSelectChange(name: string | number | boolean | undefined) {
    if (name === undefined || name === null || name === '') return
    const s = String(name)
    if (s === String(route.query.cluster ?? '')) return
    const selected = clusterListItems.value.find((c) => c.name === s)
    const aliasName = selected?.aliasName || s
    setClusterAliasCache(s, aliasName)
    router.push({ path: route.path, query: buildClusterRouteQuery(route, { cluster: s, aliasName }) })
  }

  watch(
    () => String(route.query.cluster ?? ''),
    async (name) => {
      if (!name) {
        clusterRow.value = null
        namespaceOptions.value = []
        permissionDetail.value = null
        return
      }

      // 1. 优先加载集群基本信息（确保拿到正确的 permissionId）
      await loadClusterRow(name)

      // 2. 加载对应的命名空间选项
      selectedNamespace.value = loadCachedNamespace(name) ?? 'default'
      await loadNamespaceOptions(name)
    },
    { immediate: true }
  )

  watch(
    () => Number(clusterRow.value?.permissionId) || 0,
    (permissionId, prev) => {
      if (permissionId <= 0 || permissionId === prev) return
      const cluster = String(route.query.cluster ?? '')
      if (cluster) void loadNamespaceOptions(cluster)
    }
  )

  const ctx = computed<ClusterDetailContext>(() => {
    const name = String(route.query.cluster ?? '')
    const row = clusterRow.value
    return {
      name,
      aliasName: row?.aliasName ?? name,
      id: row?.id ?? 0,
      resourceVersion: row?.resourceVersion ?? 0,
      status: row?.status ?? 0,
      version: row?.version ?? '-',
      clusterType: row?.clusterType ?? 0,
      planId: row?.planId ?? 0,
      isProtected: row?.isProtected ?? false,
      createTime: row?.createTime ?? '-',
      nodeCount: row?.nodeCount ?? 0,
      nodeReady: row?.nodeReady ?? 0,
      nodeNotReady: row?.nodeNotReady ?? 0,
      permissionId: row?.permissionId ?? 0,
      seed: clusterNameSeed(name)
    }
  })

  /** 无列表或未展开下拉时也要有当前项的 Option，否则选中态无法显示别名；搜索时也要保留当前选中项 */
  function stubClusterRow(name: string): ClusterItem {
    return {
      id: 0,
      resourceVersion: 0,
      name,
      aliasName: name,
      clusterName: name,
      version: '-',
      status: 0,
      clusterType: 0,
      nodeReady: 0,
      nodeNotReady: 0,
      nodeCount: 0,
      isProtected: false,
      permissionId: 0,
      createTime: '',
      planId: 0
    }
  }

  const clusterSelectOptions = computed(() => {
    const list = clusterListItems.value
    const currentName = String(route.query.cluster ?? '')
    if (!currentName) return list

    if (list.some((c) => c.name === currentName)) return list

    const row = clusterRow.value
    if (row?.name === currentName) {
      return [row, ...list]
    }
    return [stubClusterRow(currentName), ...list]
  })

  const filteredClusterSelectOptions = computed(() => {
    const kw = clusterSearchKeyword.value.trim().toLowerCase()
    const options = clusterSelectOptions.value
    if (!kw) return options
    return options.filter((c) => {
      const alias = (c.aliasName || '').toLowerCase()
      const name = (c.name || '').toLowerCase()
      return alias.includes(kw) || name.includes(kw)
    })
  })

  async function refreshClusterRow() {
    const name = String(route.query.cluster ?? '')
    if (!name) {
      clusterRow.value = null
      return
    }
    clusterListLoaded.value = false
    clusterListPromise = null
    await loadClusterListForSelect(true)
    const fromList = findClusterInList(name)
    if (fromList) {
      clusterRow.value = fromList
      return
    }
    try {
      clusterRow.value = await fetchClusterByName(name)
    } catch {
      clusterRow.value = null
    }
  }

  const activeMenuKey = computed(() => {
    const m = route.path.match(/\/container\/([^/]+)$/)
    const seg = m?.[1] ?? 'overview'
    return DETAIL_SEGMENTS.has(seg) ? seg : 'overview'
  })

  provide(clusterDetailContextKey, ctx)
  provide(clusterDetailNamespaceKey, { namespace: selectedNamespace, namespaceOptions })
  provide(clusterDetailActiveMenuKey, activeMenuKey)
  provide(clusterDetailRefreshKey, refreshClusterRow)

  watch(
    () => [ctx.value.name, ctx.value.aliasName] as const,
    ([name, alias]) => {
      if (name) setClusterAliasCache(name, alias)
    },
    { immediate: true }
  )

  function clusterQuerySignature(q: Record<string, string>): string {
    return Object.keys(q)
      .sort()
      .map((k) => `${k}=${q[k]}`)
      .join('&')
  }

  /** 接口拉取到别名后写回 URL，避免从详情返回后面包屑显示内部集群名 */
  watch(
    () => [String(route.query.cluster ?? ''), ctx.value.name, ctx.value.aliasName] as const,
    ([queryCluster, ctxName, alias]) => {
      if (!queryCluster || queryCluster !== ctxName || !alias) return
      const nextQuery = buildClusterRouteQuery(route, { cluster: queryCluster, aliasName: alias })
      const currentQuery = buildClusterRouteQuery(route)
      if (clusterQuerySignature(nextQuery) === clusterQuerySignature(currentQuery)) return
      router.replace({
        path: route.path,
        query: nextQuery
      })
    }
  )

  // 命名空间变更时缓存到 localStorage
  watch(selectedNamespace, (ns) => {
    const cluster = String(route.query.cluster ?? '')
    if (cluster && ns && ns !== 'undefined' && ns !== 'null') saveCachedNamespace(cluster, ns)
  })

  const STATUS_CONFIG = {
    0: { type: 'success' as const, text: '运行中' },
    1: { type: 'primary' as const, text: '部署中' },
    2: { type: 'info' as const, text: '等待部署' },
    3: { type: 'danger' as const, text: '部署失败' },
    4: { type: 'warning' as const, text: '集群失联' }
  }

  const statusTag = computed(() => {
    const s = ctx.value.status
    return STATUS_CONFIG[s as keyof typeof STATUS_CONFIG] ?? { type: 'info' as const, text: '未知' }
  })

  function isCustomClusterNotRunning(row: Pick<ClusterDetailContext, 'clusterType' | 'status'>): boolean {
    return Number(row.clusterType) === 1 && Number(row.status) !== 0
  }

  const cloudShellDisabled = computed(
    () => !ctx.value.name || !ctx.value.id || isCustomClusterNotRunning(ctx.value)
  )

  function openCloudShell() {
    if (cloudShellDisabled.value) return
    const userId = Number(userStore.getUserInfo?.userId || 0)
    if (!userId) {
      ElMessage.warning('未获取到当前用户信息，请重新登录后重试')
      return
    }
    cloudShellRef.value?.open({
      clusterName: ctx.value.name,
      clusterAlias: ctx.value.aliasName || ctx.value.name,
      clusterId: ctx.value.id,
      userId
    })
  }

  /** 切换集群时强制重建子页面，避免 KeepAlive 复用旧集群数据 */
  function clusterChildViewKey(childRoute: RouteLocationNormalizedLoaded): string {
    const cluster = String(childRoute.query.cluster ?? '')
    const routeKey = String(childRoute.name ?? childRoute.path)
    return cluster ? `${routeKey}::${cluster}` : routeKey
  }

  function preservedQuery(): Record<string, string> {
    return buildClusterRouteQuery(route)
  }

  /** 去掉历史书签里的 alias/status 等参数，只保留 cluster 和 aliasName */
  watch(
    () => [route.path, route.query] as const,
    () => {
      const cluster = route.query.cluster
      if (cluster == null || cluster === '') return
      const stale = ['alias', 'status', 'version', 'nodeCount'].some((k) => route.query[k] != null)
      if (stale) {
        const q = buildClusterRouteQuery(route, {
          cluster: String(cluster),
          aliasName:
            (typeof route.query.aliasName === 'string' && route.query.aliasName !== ''
              ? route.query.aliasName
              : undefined) ?? ctx.value.aliasName
        })
        if (clusterQuerySignature(q) === clusterQuerySignature(buildClusterRouteQuery(route))) return
        router.replace({ path: route.path, query: q })
      }
    },
    { immediate: true, flush: 'post' }
  )

  function onMenuSelect(index: string) {
    if (index.startsWith('group-')) return
    router.push({ path: `/container/${index}`, query: preservedQuery() })
  }

  function goBack() {
    router.push('/container/cluster')
  }

  watch(
    () => [route.path, route.query.cluster] as const,
    () => {
      const seg = route.path.replace(/^\/container\//, '').split('/')[0]
      if (seg && DETAIL_SEGMENTS.has(seg) && !route.query.cluster) {
        router.replace({ path: '/container/cluster' })
      }
    },
    { immediate: true }
  )
</script>

<style scoped>
  .cluster-detail-layout {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    margin: -4px -4px 0;
  }

  .cluster-detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
    padding: 10px 0 14px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .cluster-detail-header__left {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 8px;
    min-width: 0;
  }

  .cluster-detail-header__right {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 8px;
  }

  .cluster-detail-header-action-btn.el-button {
    height: 28px;
    padding: 0 12px;
    font-size: 13px;
    line-height: 1;
  }

  .cluster-detail-header-action-btn.el-button > span {
    font-size: 13px;
  }

  .cluster-detail-remote-login-btn.el-button {
    height: auto;
    padding: 0 4px;
    font-size: 12px;
    line-height: 1;
    /* 与下方 KubeConfig「下载」等 ElLink 一致：悬停为浅主色，避免 link 按钮默认变灰过深 */
    --el-button-hover-link-text-color: var(--el-color-primary-light-3);
    --el-button-active-color: var(--el-color-primary-dark-2);
  }

  .cluster-detail-remote-login-btn.el-button > span {
    font-size: 12px;
  }

  .cluster-detail-name-wrap {
    display: inline-flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 4px;
    min-width: 0;
    max-width: 100%;
    white-space: nowrap;
  }

  /* 与侧栏「基本信息」等 ElMenuItem 文案一致 */
  .cluster-detail-name-label {
    font-size: 13px;
    color: var(--el-text-color-regular);
    flex-shrink: 0;
    white-space: nowrap;
  }

  .cluster-detail-cluster-select {
    flex: 0 1 auto;
    width: max-content;
    min-width: 150px;
    max-width: min(32vw, 360px);
  }

  .cluster-detail-cluster-select :deep(.el-select__wrapper) {
    font-size: 14px;
    font-weight: 600;
    min-height: 32px;
    max-width: 100%;
    overflow: hidden;
    box-shadow: 0 0 0 1px var(--el-border-color) inset !important;
    background-color: var(--el-fill-color-blank);
    border-radius: 6px;
    position: relative;
    z-index: 0;
    transition: box-shadow 0.2s;
  }

  /* 非 filterable 时选中项仍在 .el-select__placeholder 上，主题默认 z-index:-1 会沉到透明背景下方导致看不见 */
  .cluster-detail-cluster-select :deep(.el-select__placeholder) {
    z-index: 1;
  }

  .cluster-detail-cluster-select :deep(.el-select__selected-item) {
    color: var(--el-color-primary);
    z-index: 1;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cluster-detail-cluster-select :deep(.el-select__selection) {
    flex: 1;
    min-width: 0;
  }

  .cluster-detail-cluster-select :deep(.el-select__caret) {
    color: var(--el-text-color-secondary);
  }

  .cluster-detail-cluster-select :deep(.el-select__wrapper:hover) {
    box-shadow: 0 0 0 1px var(--el-border-color-hover) inset !important;
  }

  .cluster-detail-cluster-select :deep(.el-select__wrapper.is-focused) {
    box-shadow: 0 0 0 1px var(--el-color-primary) inset !important;
  }

  .cluster-detail-status {
    margin-left: 4px;
  }

  .cluster-detail-ns-wrap {
    display: inline-flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 4px;
    white-space: nowrap;
  }

  .cluster-detail-ns-select {
    flex: 0 1 auto;
    width: max-content;
    min-width: 170px;
    max-width: min(38vw, 440px);
  }

  .cluster-detail-ns-select :deep(.el-select__wrapper) {
    font-size: 13px;
    min-height: 32px;
    max-width: 100%;
    box-shadow: 0 0 0 1px var(--el-border-color) inset !important;
    background-color: var(--el-fill-color-blank);
    border-radius: 6px;
    transition: box-shadow 0.2s;
  }

  .cluster-detail-ns-select :deep(.el-select__selection) {
    min-width: 0;
  }

  .cluster-detail-ns-select :deep(.el-select__selected-item),
  .cluster-detail-ns-select :deep(.el-select__placeholder) {
    font-size: 13px;
    overflow: visible;
    text-overflow: clip;
    white-space: nowrap;
  }

  .cluster-detail-ns-select :deep(.el-select__placeholder) {
    color: var(--el-text-color-regular);
    font-size: 13px;
  }

  .cluster-detail-ns-select :deep(.el-select__wrapper:hover) {
    box-shadow: 0 0 0 1px var(--el-border-color-hover) inset !important;
  }

  .cluster-detail-ns-select :deep(.el-select__wrapper.is-focused) {
    box-shadow: 0 0 0 1px var(--el-color-primary) inset !important;
  }

  .ns-refresh-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    cursor: pointer;
    color: var(--el-text-color-secondary);
    border-radius: 4px;
    transition:
      color 0.15s,
      background-color 0.15s;
  }

  .ns-refresh-btn:hover {
    color: var(--el-color-primary);
    background-color: var(--el-color-primary-light-9);
  }

  .ns-refresh-btn.is-loading {
    animation: ns-refresh-spin 0.8s linear infinite;
    pointer-events: none;
    opacity: 0.6;
  }

  @keyframes ns-refresh-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .ns-option-name {
    font-size: 13px;
  }

  .ns-selected-label {
    font-size: 13px;
    color: var(--el-text-color-primary);
  }

  .ns-system-tag {
    margin-left: 6px;
    font-size: 11px;
    padding: 0 4px;
    line-height: 16px;
    border-radius: 3px;
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
    border: 1px solid var(--el-color-primary-light-7);
    flex-shrink: 0;
  }

  .cluster-detail-body {
    display: flex;
    flex: 1;
    min-height: 0;
    padding-top: 12px;
  }

  .cluster-detail-sider {
    width: 180px;
    flex-shrink: 0;
    padding-right: 4px;
    border-right: 1px solid var(--el-border-color-lighter);
  }

  .cluster-detail-menu {
    border-right: none;
    --el-menu-bg-color: transparent;
  }

  .cluster-detail-menu :deep(.el-sub-menu__title),
  .cluster-detail-menu :deep(.el-menu-item) {
    height: 40px;
    line-height: 40px;
  }

  .menu-new-tag {
    display: inline-block;
    margin-left: 6px;
    padding: 0 5px;
    font-size: 10px;
    line-height: 16px;
    color: #fff;
    background: #f56c6c;
    border-radius: 3px;
    vertical-align: middle;
  }

  .cluster-detail-main {
    flex: 1;
    min-width: 0;
    padding-left: 16px;
    overflow: auto;
  }

  .fade-slide-enter-active,
  .fade-slide-leave-active {
    transition:
      opacity 0.15s ease,
      transform 0.15s ease;
  }

  .fade-slide-enter-from,
  .fade-slide-leave-to {
    opacity: 0;
    transform: translateY(4px);
  }
</style>

<style>
  .cluster-detail-cluster-select-popper .el-select-dropdown__header {
    padding: 10px 12px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .cluster-detail-cluster-select-popper .cluster-detail-cluster-search .el-input__wrapper {
    min-height: 30px;
    height: 30px;
    padding-top: 0;
    padding-bottom: 0;
  }

  .cluster-detail-cluster-select-popper .cluster-detail-cluster-search .el-input__inner {
    font-size: 13px;
  }

  .cluster-detail-cluster-select-popper .cluster-detail-cluster-empty {
    display: block;
    padding: 8px 0;
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    text-align: center;
  }

  .cluster-detail-cluster-select-popper .el-select-dropdown__list {
    max-height: 280px;
    overflow-x: auto;
    overflow-y: auto;
  }

  .cluster-detail-cluster-select-popper .el-select-dropdown__item {
    overflow: visible;
    text-overflow: clip;
    white-space: nowrap;
  }

  .cluster-detail-ns-select-popper .el-select-dropdown__header {
    padding: 10px 12px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .cluster-detail-ns-select-popper .cluster-detail-ns-search .el-input__wrapper {
    min-height: 30px;
    height: 30px;
    padding-top: 0;
    padding-bottom: 0;
  }

  .cluster-detail-ns-select-popper .cluster-detail-ns-search .el-input__inner {
    font-size: 13px;
  }

  .cluster-detail-ns-select-popper .cluster-detail-ns-empty {
    display: block;
    padding: 8px 0;
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    text-align: center;
  }

  .cluster-detail-ns-select-popper .el-select-dropdown__list {
    max-height: 280px;
    overflow-x: auto;
    overflow-y: auto;
  }

  .cluster-detail-ns-select-popper .el-select-dropdown__item {
    overflow: visible;
    text-overflow: clip;
    white-space: nowrap;
  }

  .cluster-detail-ns-select-popper .ns-option-name {
    display: inline-block;
    min-width: max-content;
  }

  /* dark 模式下同步外部侧边栏菜单文字颜色 */
  .dark .cluster-detail-menu .el-menu-item,
  .dark .cluster-detail-menu .el-sub-menu__title {
    color: var(--art-gray-800) !important;
  }

  /* 集群内资源列表空状态（与自定义资源列表一致） */
  .cluster-detail-layout .cluster-table-empty {
    padding: 0 20px;
    line-height: 50px;
    font-size: 12px !important;
    color: var(--el-text-color-secondary);
    text-align: center;
  }

  .cluster-detail-layout .el-table__empty-block {
    min-height: 40px;
  }

  .cluster-detail-layout .el-table__empty-text {
    line-height: 40px;
    padding: 0;
  }
</style>

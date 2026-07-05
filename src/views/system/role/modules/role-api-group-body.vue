<template>
  <div v-if="showK8sClusters" v-loading="clusterListLoading" class="role-api-picker__k8s">
    <ElCollapse
      :model-value="clusterExpandedKeys"
      class="role-api-picker__cluster-collapse"
      @update:model-value="onClusterExpandedChange"
    >
      <ElCollapseItem v-for="cluster in clusterNodes" :key="cluster.name" :name="cluster.name">
        <template #title>
          <div class="role-api-picker__cluster-title">
            <ElCheckbox
              :model-value="isClusterFullyChecked(cluster)"
              :indeterminate="isClusterIndeterminate(cluster)"
              @change="(val: boolean) => emit('toggleCluster', cluster, val)"
              @click.stop
            />
            <span class="role-api-picker__cluster-name">{{ cluster.label }}</span>
            <span class="role-api-picker__cluster-count">({{ clusterCountLabel(cluster) }})</span>
          </div>
        </template>
        <div v-loading="isNamespaceLoading(cluster.name)" class="role-api-picker__ns-wrap">
          <ElCollapse
            :model-value="getNamespaceExpandedKeys(cluster.name)"
            class="role-api-picker__ns-collapse"
            @update:model-value="(keys) => setNamespaceExpandedKeys(cluster.name, keys as string[])"
          >
            <ElCollapseItem v-for="ns in getNamespaceNodes(cluster)" :key="ns.name" :name="ns.name">
              <template #title>
                <div class="role-api-picker__ns-title">
                  <ElCheckbox
                    :model-value="isNamespaceFullyChecked(cluster, ns)"
                    :indeterminate="isNamespaceIndeterminate(cluster, ns)"
                    @change="(val: boolean) => emit('toggleNamespace', cluster.name, ns, val)"
                    @click.stop
                  />
                  <span class="role-api-picker__ns-name">{{ ns.label }}</span>
                  <span class="role-api-picker__ns-count">({{ countVisibleScopes(cluster, ns) }})</span>
                </div>
              </template>
              <ElCollapse
                :model-value="getSubGroupExpandedKeys(cluster.name, ns.name)"
                class="role-api-picker__subgroup-collapse"
                @update:model-value="(keys) => setSubGroupExpandedKeys(cluster.name, ns.name, keys as string[])"
              >
                <ElCollapseItem
                  v-for="subgroup in getSubGroupNodes(cluster, ns)"
                  :key="subgroup.key"
                  :name="subgroup.key"
                >
                  <template #title>
                    <div class="role-api-picker__subgroup-title">
                      <ElCheckbox
                        :model-value="isSubGroupFullyChecked(cluster, ns, subgroup)"
                        :indeterminate="isSubGroupIndeterminate(cluster, ns, subgroup)"
                        @change="(val: boolean) => emit('toggleSubGroup', cluster.name, ns.name, subgroup, val)"
                        @click.stop
                      />
                      <span class="role-api-picker__subgroup-name">{{ subgroup.label }}</span>
                      <span class="role-api-picker__subgroup-count">({{ getVisibleSubgroupApis(cluster, ns, subgroup).length }})</span>
                    </div>
                  </template>
                  <div class="role-api-picker__items">
                    <ElCheckbox
                      v-for="api in getVisibleSubgroupApis(cluster, ns, subgroup)"
                      :key="api.id"
                      :model-value="isApiChecked(api.id, cluster.name, ns.name)"
                      class="role-api-picker__item"
                      @change="(val: boolean) => onToggleApi(api.id, cluster.name, ns.name, val)"
                    >
                      <span class="role-api-picker__item-label">{{ formatApiDescription(api) }}</span>
                    </ElCheckbox>
                  </div>
                </ElCollapseItem>
              </ElCollapse>
            </ElCollapseItem>
          </ElCollapse>
          <div
            v-if="isClusterExpanded(cluster.name) && !isNamespaceLoading(cluster.name) && !getNamespaceNodes(cluster).length"
            class="role-api-picker__empty-inline"
          >
            {{ namespaceMap[cluster.name] ? '无匹配权限' : '暂无命名空间' }}
          </div>
        </div>
      </ElCollapseItem>
    </ElCollapse>
    <div v-if="!clusterListLoading && !clusterNodes.length" class="role-api-picker__empty-inline">
      {{ clusterList.length ? '无匹配权限' : '暂无集群' }}
    </div>
  </div>
  <div v-else class="role-api-picker__items">
    <ElCheckbox
      v-for="api in group.apis"
      :key="api.id"
      :model-value="checkedIds.includes(api.id)"
      class="role-api-picker__item"
      @change="(val: boolean) => emit('toggleApi', api.id, val)"
    >
      <span class="role-api-picker__item-label">{{ formatApiDescription(api) }}</span>
    </ElCheckbox>
  </div>
</template>

<script setup lang="ts">
  import { makeScopeKey } from './role-api-scope-utils'

  const KUBERNETES_GROUP_KEY = 'Kubernetes 资源'
  const UNGROUPED_SUBGROUP_KEY = '__ungrouped_subgroup__'
  const UNGROUPED_SUBGROUP_LABEL = '未分类'

  export interface ClusterPickerNode {
    name: string
    label: string
    apis: ApiItem[]
  }

  export interface NamespacePickerNode {
    name: string
    label: string
    apis: ApiItem[]
  }

  interface SubGroupNode {
    key: string
    label: string
    apis: ApiItem[]
  }

  interface ApiItem {
    id: number
    method: string
    path: string
    group: string
    sub_group: string
    description: string
  }

  interface ApiGroup {
    key: string
    label: string
    apis: ApiItem[]
  }

  const props = defineProps<{
    group: ApiGroup
    filterText: string
    checkedIds: number[]
    /** 为 true 时直接展示集群树，不依赖「Kubernetes 资源」分组 */
    clustersOnly?: boolean
    /** 使用 RoleAPIScope 维度勾选（cluster + namespace + api） */
    useScopeMode?: boolean
    scopePanel?: 'available' | 'assigned'
    selectedScopeKeys?: string[]
    transferCheckedScopeKeys?: string[]
    clusterExpandedKeys: string[]
    clusterList: ClusterPickerNode[]
    clusterListLoading: boolean
    namespaceMap: Record<string, NamespacePickerNode[]>
    namespaceLoadingMap: Record<string, boolean>
    namespaceExpandedByCluster: Record<string, string[]>
    subgroupExpandedByNamespace: Record<string, string[]>
  }>()

  const emit = defineEmits<{
    (e: 'toggleApi', apiId: number, checked: boolean): void
    (
      e: 'toggleScope',
      payload: { apiId: number; cluster: string; namespace: string; resourceName: string; checked: boolean }
    ): void
    (e: 'toggleCluster', cluster: ClusterPickerNode, checked: boolean): void
    (e: 'toggleNamespace', clusterName: string, ns: NamespacePickerNode, checked: boolean): void
    (e: 'toggleSubGroup', clusterName: string, namespaceName: string, subgroup: SubGroupNode, checked: boolean): void
    (e: 'update:clusterExpandedKeys', keys: string[]): void
    (e: 'update:namespaceExpandedByCluster', value: Record<string, string[]>): void
    (e: 'update:subgroupExpandedByNamespace', value: Record<string, string[]>): void
    (e: 'loadNamespaces', clusterName: string): void
  }>()

  const sortedGroupApis = computed(() =>
    [...props.group.apis].sort((a, b) =>
      formatApiDescription(a).localeCompare(formatApiDescription(b), 'zh-CN')
    )
  )

  const isK8sGroup = computed(
    () => props.group.key === KUBERNETES_GROUP_KEY || props.group.label === KUBERNETES_GROUP_KEY
  )

  const showK8sClusters = computed(() => props.clustersOnly === true || isK8sGroup.value)

  const selectedScopeKeySet = computed(() => new Set(props.selectedScopeKeys ?? []))

  const transferCheckedScopeKeySet = computed(() => new Set(props.transferCheckedScopeKeys ?? []))

  function isScopeAssigned(apiId: number, cluster: string, namespace: string): boolean {
    return selectedScopeKeySet.value.has(makeScopeKey(apiId, cluster, namespace))
  }

  function isScopeVisible(apiId: number, cluster: string, namespace: string): boolean {
    const assigned = isScopeAssigned(apiId, cluster, namespace)
    if (props.scopePanel === 'assigned') return assigned
    return !assigned
  }

  function isApiChecked(apiId: number, cluster: string, namespace: string): boolean {
    if (props.useScopeMode) {
      return transferCheckedScopeKeySet.value.has(makeScopeKey(apiId, cluster, namespace))
    }
    return props.checkedIds.includes(apiId)
  }

  function onToggleApi(apiId: number, cluster: string, namespace: string, checked: boolean) {
    if (props.useScopeMode) {
      emit('toggleScope', { apiId, cluster, namespace, resourceName: '*', checked })
      return
    }
    emit('toggleApi', apiId, checked)
  }

  function collectVisibleScopeKeys(cluster: ClusterPickerNode): string[] {
    const keys: string[] = []
    for (const ns of getNamespaceNodes(cluster)) {
      for (const subgroup of getSubGroupNodes(cluster, ns)) {
        for (const api of subgroup.apis) {
          if (isScopeVisible(api.id, cluster.name, ns.name)) {
            keys.push(makeScopeKey(api.id, cluster.name, ns.name))
          }
        }
      }
    }
    return keys
  }

  function filterApisByScopeVisibility(apis: ApiItem[], clusterName: string, namespaceName: string): ApiItem[] {
    if (!props.useScopeMode) return apis
    return apis.filter((api) => isScopeVisible(api.id, clusterName, namespaceName))
  }

  function countVisibleScopes(cluster: ClusterPickerNode, ns?: NamespacePickerNode): number {
    if (!props.useScopeMode) {
      return ns ? ns.apis.length : cluster.apis.length
    }
    if (ns) {
      return filterApisByScopeVisibility(
        ns.apis.length ? ns.apis : sortedGroupApis.value,
        cluster.name,
        ns.name
      ).length
    }
    return getNamespaceNodes(cluster).reduce((sum, namespace) => sum + countVisibleScopes(cluster, namespace), 0)
  }

  const clusterNodes = computed(() => {
    if (!showK8sClusters.value) return []
    const text = props.filterText.trim().toLowerCase()

    return props.clusterList
      .map((cluster) => {
        let clusterApis = sortedGroupApis.value
        if (text) {
          const clusterMatched =
            cluster.label.toLowerCase().includes(text) || cluster.name.toLowerCase().includes(text)
          const namespaces = props.namespaceMap[cluster.name] ?? []
          const namespaceMatched = namespaces.some((ns) => ns.name.toLowerCase().includes(text))
          if (clusterMatched || namespaceMatched) {
            return { ...cluster, apis: clusterApis }
          }
          clusterApis = sortedGroupApis.value.filter((api) => {
            const subGroupMatched = (api.sub_group || UNGROUPED_SUBGROUP_LABEL).toLowerCase().includes(text)
            return (
              subGroupMatched ||
              formatApiDescription(api).toLowerCase().includes(text) ||
              api.path.toLowerCase().includes(text) ||
              api.method.toLowerCase().includes(text)
            )
          })
        }
        return { ...cluster, apis: clusterApis }
      })
      .filter((cluster) => {
        if (props.useScopeMode) {
          const namespaces = props.namespaceMap[cluster.name]
          if (namespaces === undefined || isNamespaceLoading(cluster.name)) {
            return true
          }
          return getNamespaceNodes(cluster).length > 0
        }
        if (props.clustersOnly && !text) return true
        if (cluster.apis.length > 0) return true
        if (!text) return false
        const clusterMatched =
          cluster.label.toLowerCase().includes(text) || cluster.name.toLowerCase().includes(text)
        const namespaces = props.namespaceMap[cluster.name] ?? []
        return clusterMatched || namespaces.some((ns) => ns.name.toLowerCase().includes(text))
      })
  })

  function namespaceKey(clusterName: string, namespaceName: string): string {
    return `${clusterName}::${namespaceName}`
  }

  function normalizeSubGroup(subGroup?: string): { key: string; label: string } {
    const value = subGroup?.trim()
    if (!value) return { key: UNGROUPED_SUBGROUP_KEY, label: UNGROUPED_SUBGROUP_LABEL }
    return { key: value, label: value }
  }

  function onClusterExpandedChange(keys: string[]) {
    const prev = props.clusterExpandedKeys
    emit('update:clusterExpandedKeys', keys)
    keys.filter((key) => !prev.includes(key)).forEach((clusterName) => {
      emit('loadNamespaces', clusterName)
    })
  }

  function isClusterExpanded(clusterName: string): boolean {
    return props.clusterExpandedKeys.includes(clusterName)
  }

  function isNamespaceLoading(clusterName: string): boolean {
    return Boolean(props.namespaceLoadingMap[clusterName])
  }

  function getNamespaceExpandedKeys(clusterName: string): string[] {
    return props.namespaceExpandedByCluster[clusterName] ?? []
  }

  function setNamespaceExpandedKeys(clusterName: string, keys: string[]) {
    emit('update:namespaceExpandedByCluster', {
      ...props.namespaceExpandedByCluster,
      [clusterName]: keys
    })
  }

  function getSubGroupExpandedKeys(clusterName: string, namespaceName: string): string[] {
    return props.subgroupExpandedByNamespace[namespaceKey(clusterName, namespaceName)] ?? []
  }

  function setSubGroupExpandedKeys(clusterName: string, namespaceName: string, keys: string[]) {
    emit('update:subgroupExpandedByNamespace', {
      ...props.subgroupExpandedByNamespace,
      [namespaceKey(clusterName, namespaceName)]: keys
    })
  }

  function getVisibleSubgroupApis(
    cluster: ClusterPickerNode,
    ns: NamespacePickerNode,
    subgroup: SubGroupNode
  ): ApiItem[] {
    return filterApisByScopeVisibility(subgroup.apis, cluster.name, ns.name)
  }

  function getNamespaceNodes(cluster: ClusterPickerNode): NamespacePickerNode[] {
    const namespaces = props.namespaceMap[cluster.name] ?? []
    const text = props.filterText.trim().toLowerCase()
    const clusterMatched =
      text &&
      (cluster.label.toLowerCase().includes(text) || cluster.name.toLowerCase().includes(text))

    return namespaces
      .map((ns) => {
        let apis = cluster.apis.length ? cluster.apis : sortedGroupApis.value
        if (text && !clusterMatched) {
          const nsMatched = ns.name.toLowerCase().includes(text)
          if (!nsMatched) {
            apis = apis.filter((api) => {
              const subGroupMatched = (api.sub_group || UNGROUPED_SUBGROUP_LABEL).toLowerCase().includes(text)
              return (
                subGroupMatched ||
                formatApiDescription(api).toLowerCase().includes(text) ||
                api.path.toLowerCase().includes(text) ||
                api.method.toLowerCase().includes(text)
              )
            })
          }
        }
        apis = filterApisByScopeVisibility(apis, cluster.name, ns.name)
        return { ...ns, apis }
      })
      .filter((ns) => {
        if (ns.apis.length === 0) return false
        if (props.useScopeMode) {
          return getSubGroupNodes(cluster, ns).length > 0
        }
        return true
      })
  }

  function getSubGroupNodes(cluster: ClusterPickerNode, ns: NamespacePickerNode): SubGroupNode[] {
    const text = props.filterText.trim().toLowerCase()
    const map = new Map<string, SubGroupNode>()
    ns.apis.forEach((api) => {
      if (props.useScopeMode && !isScopeVisible(api.id, cluster.name, ns.name)) {
        return
      }
      const { key, label } = normalizeSubGroup(api.sub_group)
      if (!map.has(key)) {
        map.set(key, { key, label, apis: [] })
      }
      map.get(key)!.apis.push(api)
    })

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        apis: item.apis.sort((a, b) =>
          formatApiDescription(a).localeCompare(formatApiDescription(b), 'zh-CN')
        )
      }))
      .filter((item) => {
        if (item.apis.length === 0) return false
        if (!text) return true
        const clusterMatched =
          cluster.label.toLowerCase().includes(text) || cluster.name.toLowerCase().includes(text)
        const nsMatched = ns.name.toLowerCase().includes(text)
        const subgroupMatched = item.label.toLowerCase().includes(text)
        if (clusterMatched || nsMatched || subgroupMatched) return true
        return item.apis.some((api) => {
          return (
            formatApiDescription(api).toLowerCase().includes(text) ||
            api.path.toLowerCase().includes(text) ||
            api.method.toLowerCase().includes(text)
          )
        })
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
  }

  function clusterCountLabel(cluster: ClusterPickerNode): string | number {
    if (props.useScopeMode) {
      const loaded = props.namespaceMap[cluster.name]
      if (loaded) return getNamespaceNodes(cluster).length
      return cluster.apis.length
    }
    const loaded = props.namespaceMap[cluster.name]
    if (loaded) return getNamespaceNodes(cluster).length
    return cluster.apis.length
  }

  function formatApiDescription(api: Pick<ApiItem, 'description' | 'path'>): string {
    return api.description?.trim() || api.path
  }

  function isClusterFullyChecked(cluster: ClusterPickerNode): boolean {
    if (props.useScopeMode) {
      const keys = collectVisibleScopeKeys(cluster)
      if (!keys.length) return false
      return keys.every((key) => transferCheckedScopeKeySet.value.has(key))
    }
    if (!cluster.apis.length) return false
    return cluster.apis.every((api) => props.checkedIds.includes(api.id))
  }

  function isClusterIndeterminate(cluster: ClusterPickerNode): boolean {
    if (props.useScopeMode) {
      const keys = collectVisibleScopeKeys(cluster)
      const checkedCount = keys.filter((key) => transferCheckedScopeKeySet.value.has(key)).length
      return checkedCount > 0 && checkedCount < keys.length
    }
    const checkedCount = cluster.apis.filter((api) => props.checkedIds.includes(api.id)).length
    return checkedCount > 0 && checkedCount < cluster.apis.length
  }

  function isNamespaceFullyChecked(cluster: ClusterPickerNode, ns: NamespacePickerNode): boolean {
    if (props.useScopeMode) {
      const keys: string[] = []
      for (const subgroup of getSubGroupNodes(cluster, ns)) {
        for (const api of subgroup.apis) {
          if (isScopeVisible(api.id, cluster.name, ns.name)) {
            keys.push(makeScopeKey(api.id, cluster.name, ns.name))
          }
        }
      }
      if (!keys.length) return false
      return keys.every((key) => transferCheckedScopeKeySet.value.has(key))
    }
    if (!ns.apis.length) return false
    return ns.apis.every((api) => props.checkedIds.includes(api.id))
  }

  function isNamespaceIndeterminate(cluster: ClusterPickerNode, ns: NamespacePickerNode): boolean {
    if (props.useScopeMode) {
      const keys: string[] = []
      for (const subgroup of getSubGroupNodes(cluster, ns)) {
        for (const api of subgroup.apis) {
          if (isScopeVisible(api.id, cluster.name, ns.name)) {
            keys.push(makeScopeKey(api.id, cluster.name, ns.name))
          }
        }
      }
      const checkedCount = keys.filter((key) => transferCheckedScopeKeySet.value.has(key)).length
      return checkedCount > 0 && checkedCount < keys.length
    }
    const checkedCount = ns.apis.filter((api) => props.checkedIds.includes(api.id)).length
    return checkedCount > 0 && checkedCount < ns.apis.length
  }

  function isSubGroupFullyChecked(
    cluster: ClusterPickerNode,
    ns: NamespacePickerNode,
    subgroup: SubGroupNode
  ): boolean {
    if (props.useScopeMode) {
      const keys = subgroup.apis
        .filter((api) => isScopeVisible(api.id, cluster.name, ns.name))
        .map((api) => makeScopeKey(api.id, cluster.name, ns.name))
      if (!keys.length) return false
      return keys.every((key) => transferCheckedScopeKeySet.value.has(key))
    }
    if (!subgroup.apis.length) return false
    return subgroup.apis.every((api) => props.checkedIds.includes(api.id))
  }

  function isSubGroupIndeterminate(
    cluster: ClusterPickerNode,
    ns: NamespacePickerNode,
    subgroup: SubGroupNode
  ): boolean {
    if (props.useScopeMode) {
      const keys = subgroup.apis
        .filter((api) => isScopeVisible(api.id, cluster.name, ns.name))
        .map((api) => makeScopeKey(api.id, cluster.name, ns.name))
      const checkedCount = keys.filter((key) => transferCheckedScopeKeySet.value.has(key)).length
      return checkedCount > 0 && checkedCount < keys.length
    }
    const checkedCount = subgroup.apis.filter((api) => props.checkedIds.includes(api.id)).length
    return checkedCount > 0 && checkedCount < subgroup.apis.length
  }
</script>

<style scoped lang="scss">
  .role-api-picker__k8s {
    min-height: 24px;
  }

  .role-api-picker__cluster-collapse {
    border: none;

    :deep(.el-collapse-item__header) {
      display: flex;
      align-items: center;
      height: 28px;
      min-height: 28px;
      padding: 0 4px;
      font-size: 12px;
      line-height: 1;
      border-bottom: none;
      background: transparent;
    }

    :deep(.el-collapse-item__arrow) {
      margin: 0 0 0 2px;
    }

    :deep(.el-collapse-item__wrap) {
      border-bottom: none;
    }

    :deep(.el-collapse-item__content) {
      padding: 0 4px 4px 18px;
    }
  }

  .role-api-picker__cluster-title {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    min-width: 0;
    height: 28px;
  }

  .role-api-picker__cluster-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .role-api-picker__cluster-count {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .role-api-picker__ns-wrap {
    min-height: 20px;
  }

  .role-api-picker__ns-collapse {
    border: none;

    :deep(.el-collapse-item__header) {
      display: flex;
      align-items: center;
      height: 26px;
      min-height: 26px;
      padding: 0 2px;
      font-size: 12px;
      line-height: 1;
      border-bottom: none;
      background: transparent;
    }

    :deep(.el-collapse-item__content) {
      padding: 0 2px 4px 18px;
    }
  }

  .role-api-picker__ns-title {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    min-width: 0;
    height: 26px;
  }

  .role-api-picker__subgroup-collapse {
    border: none;

    :deep(.el-collapse-item__header) {
      display: flex;
      align-items: center;
      height: 26px;
      min-height: 26px;
      padding: 0 2px;
      font-size: 12px;
      line-height: 1;
      border-bottom: none;
      background: transparent;
    }

    :deep(.el-collapse-item__content) {
      padding: 0 2px 4px 16px;
    }
  }

  .role-api-picker__subgroup-title {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    min-width: 0;
    height: 26px;
  }

  .role-api-picker__subgroup-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .role-api-picker__subgroup-count {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .role-api-picker__ns-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .role-api-picker__ns-count {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .role-api-picker__items {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .role-api-picker__item {
    display: flex;
    align-items: center;
    width: 100%;
    height: 28px;
    margin-right: 0;

    :deep(.el-checkbox__label) {
      flex: 1;
      min-width: 0;
      padding-left: 8px;
      font-size: 12px;
      line-height: 28px;
    }
  }

  .role-api-picker__item-label {
    display: block;
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 28px;
  }

  .role-api-picker__empty-inline {
    padding: 8px 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    text-align: center;
  }
</style>

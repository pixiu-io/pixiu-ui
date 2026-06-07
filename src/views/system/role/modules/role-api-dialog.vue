<template>
  <ElDialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="600px"
    class="role-api-dialog"
    header-class="role-api-dialog-header"
    body-class="role-api-dialog-body"
    footer-class="role-api-dialog-footer"
    align-center
    destroy-on-close
    @close="handleClose"
  >
    <ElForm label-width="90px" class="role-api-form">
      <ElFormItem label="关联资源" label-position="top" class="role-api-transfer-item">
        <div v-loading="loading" class="role-api-picker">
          <div class="role-api-picker__panel">
            <div class="role-api-picker__header">
              <ElCheckbox
                :model-value="isLeftPanelAllChecked"
                :indeterminate="isLeftPanelIndeterminate"
                @change="toggleLeftPanelAll"
              />
              <span class="role-api-picker__title">
                未选资源
                <span class="role-api-picker__count">
                  {{ mode === 'kubernetes' ? leftTransferScopeKeys.length : `${leftCheckedIds.length}/${leftApiIds.length}` }}
                </span>
              </span>
              <button
                type="button"
                class="role-api-picker__expand-btn"
                :disabled="mode === 'kubernetes' ? clusterListLoading || !clusterList.length : !filteredLeftGroups.length"
                @click="togglePanelExpandAll('left')"
              >
                {{ isLeftAllExpanded ? '收起' : '展开' }}
              </button>
            </div>
            <ElInput
              v-model="leftFilter"
              class="role-api-picker__filter"
              size="small"
              clearable
              placeholder="请输入"
            />
            <ElScrollbar class="role-api-picker__body">
              <RoleApiGroupBody
                v-if="mode === 'kubernetes'"
                :group="k8sPickerGroup"
                clusters-only
                use-scope-mode
                scope-panel="available"
                :selected-scope-keys="selectedScopeKeys"
                :transfer-checked-scope-keys="leftTransferScopeKeys"
                :filter-text="leftFilter"
                :checked-ids="leftCheckedIds"
                :cluster-expanded-keys="leftK8sClusterExpandedKeys"
                :cluster-list="clusterList"
                :cluster-list-loading="clusterListLoading"
                :namespace-map="namespaceMap"
                :namespace-loading-map="namespaceLoadingMap"
                :namespace-expanded-by-cluster="leftK8sNsExpandedByCluster"
                :subgroup-expanded-by-namespace="leftK8sSubGroupExpandedByNamespace"
                @toggle-scope="(payload) => toggleScopeTransfer(payload, 'left')"
                @toggle-cluster="(cluster, checked) => toggleK8sCluster(cluster, 'left', checked)"
                @toggle-namespace="(clusterName, ns, checked) => toggleK8sNamespace(clusterName, ns, 'left', checked)"
                @toggle-sub-group="(clusterName, namespaceName, subgroup, checked) => toggleK8sSubGroup(clusterName, namespaceName, subgroup, 'left', checked)"
                @load-namespaces="ensureNamespacesLoaded"
                @update:cluster-expanded-keys="leftK8sClusterExpandedKeys = $event"
                @update:namespace-expanded-by-cluster="leftK8sNsExpandedByCluster = $event"
                @update:subgroup-expanded-by-namespace="leftK8sSubGroupExpandedByNamespace = $event"
              />
              <ElCollapse v-else v-model="leftExpandedKeys" class="role-api-picker__collapse">
                <ElCollapseItem
                  v-for="group in filteredLeftGroups"
                  :key="group.key"
                  :name="group.key"
                >
                  <template #title>
                    <div class="role-api-picker__group-title">
                      <ElCheckbox
                        :model-value="isGroupFullyChecked(group, 'left')"
                        :indeterminate="isGroupIndeterminate(group, 'left')"
                        @change="(val: boolean) => toggleGroup(group, 'left', val)"
                        @click.stop
                      />
                      <span
                        class="role-api-picker__group-name"
                        @click.stop="toggleGroupExpand(group.key, 'left')"
                      >{{ group.label }}</span>
                      <span
                        class="role-api-picker__group-count"
                        @click.stop="toggleGroupExpand(group.key, 'left')"
                      >({{ group.apis.length }})</span>
                    </div>
                  </template>
                  <RoleApiGroupBody
                    :group="group"
                    :filter-text="leftFilter"
                    :checked-ids="leftCheckedIds"
                    :cluster-expanded-keys="leftK8sClusterExpandedKeys"
                    :cluster-list="clusterList"
                    :cluster-list-loading="clusterListLoading"
                    :namespace-map="namespaceMap"
                    :namespace-loading-map="namespaceLoadingMap"
                    :namespace-expanded-by-cluster="leftK8sNsExpandedByCluster"
                    :subgroup-expanded-by-namespace="leftK8sSubGroupExpandedByNamespace"
                    @toggle-api="(id, checked) => toggleApiCheck(id, 'left', checked)"
                    @toggle-cluster="(cluster, checked) => toggleK8sCluster(cluster, 'left', checked)"
                    @toggle-namespace="(clusterName, ns, checked) => toggleK8sNamespace(clusterName, ns, 'left', checked)"
                    @toggle-sub-group="(clusterName, namespaceName, subgroup, checked) => toggleK8sSubGroup(clusterName, namespaceName, subgroup, 'left', checked)"
                    @load-namespaces="ensureNamespacesLoaded"
                    @update:cluster-expanded-keys="leftK8sClusterExpandedKeys = $event"
                    @update:namespace-expanded-by-cluster="leftK8sNsExpandedByCluster = $event"
                    @update:subgroup-expanded-by-namespace="leftK8sSubGroupExpandedByNamespace = $event"
                  />
                </ElCollapseItem>
              </ElCollapse>
              <div
                v-if="mode === 'kubernetes' ? !clusterListLoading && !clusterList.length : !filteredLeftGroups.length"
                class="role-api-picker__empty"
              >
                暂无数据
              </div>
            </ElScrollbar>
          </div>

          <div class="role-api-picker__actions">
            <ElButton
              type="primary"
              class="role-api-picker__action-btn"
              :disabled="mode === 'kubernetes' ? !leftTransferScopeKeys.length : !leftCheckedIds.length"
              @click="moveToRight"
            >
              <ElIcon><ArrowRight /></ElIcon>
            </ElButton>
            <ElButton
              type="primary"
              class="role-api-picker__action-btn"
              :disabled="mode === 'kubernetes' ? !rightTransferScopeKeys.length : !rightCheckedIds.length"
              @click="moveToLeft"
            >
              <ElIcon><ArrowLeft /></ElIcon>
            </ElButton>
          </div>

          <div class="role-api-picker__panel">
            <div class="role-api-picker__header">
              <ElCheckbox
                :model-value="isRightPanelAllChecked"
                :indeterminate="isRightPanelIndeterminate"
                @change="toggleRightPanelAll"
              />
              <span class="role-api-picker__title">
                已选资源
                <span class="role-api-picker__count">
                  {{ mode === 'kubernetes' ? rightTransferScopeKeys.length : `${rightCheckedIds.length}/${rightApiIds.length}` }}
                </span>
              </span>
              <button
                type="button"
                class="role-api-picker__expand-btn"
                :disabled="mode === 'kubernetes' ? clusterListLoading || !clusterList.length : !filteredRightGroups.length"
                @click="togglePanelExpandAll('right')"
              >
                {{ isRightAllExpanded ? '收起' : '展开' }}
              </button>
            </div>
            <ElInput
              v-model="rightFilter"
              class="role-api-picker__filter"
              size="small"
              clearable
              placeholder="请输入"
            />
            <ElScrollbar class="role-api-picker__body">
              <RoleApiGroupBody
                v-if="mode === 'kubernetes'"
                :group="k8sPickerGroup"
                clusters-only
                use-scope-mode
                scope-panel="assigned"
                :selected-scope-keys="selectedScopeKeys"
                :transfer-checked-scope-keys="rightTransferScopeKeys"
                :filter-text="rightFilter"
                :checked-ids="rightCheckedIds"
                :cluster-expanded-keys="rightK8sClusterExpandedKeys"
                :cluster-list="clusterList"
                :cluster-list-loading="clusterListLoading"
                :namespace-map="namespaceMap"
                :namespace-loading-map="namespaceLoadingMap"
                :namespace-expanded-by-cluster="rightK8sNsExpandedByCluster"
                :subgroup-expanded-by-namespace="rightK8sSubGroupExpandedByNamespace"
                @toggle-scope="(payload) => toggleScopeTransfer(payload, 'right')"
                @toggle-cluster="(cluster, checked) => toggleK8sCluster(cluster, 'right', checked)"
                @toggle-namespace="(clusterName, ns, checked) => toggleK8sNamespace(clusterName, ns, 'right', checked)"
                @toggle-sub-group="(clusterName, namespaceName, subgroup, checked) => toggleK8sSubGroup(clusterName, namespaceName, subgroup, 'right', checked)"
                @load-namespaces="ensureNamespacesLoaded"
                @update:cluster-expanded-keys="rightK8sClusterExpandedKeys = $event"
                @update:namespace-expanded-by-cluster="rightK8sNsExpandedByCluster = $event"
                @update:subgroup-expanded-by-namespace="rightK8sSubGroupExpandedByNamespace = $event"
              />
              <ElCollapse v-else v-model="rightExpandedKeys" class="role-api-picker__collapse">
                <ElCollapseItem
                  v-for="group in filteredRightGroups"
                  :key="group.key"
                  :name="group.key"
                >
                  <template #title>
                    <div class="role-api-picker__group-title">
                      <ElCheckbox
                        :model-value="isGroupFullyChecked(group, 'right')"
                        :indeterminate="isGroupIndeterminate(group, 'right')"
                        @change="(val: boolean) => toggleGroup(group, 'right', val)"
                        @click.stop
                      />
                      <span
                        class="role-api-picker__group-name"
                        @click.stop="toggleGroupExpand(group.key, 'right')"
                      >{{ group.label }}</span>
                      <span
                        class="role-api-picker__group-count"
                        @click.stop="toggleGroupExpand(group.key, 'right')"
                      >({{ group.apis.length }})</span>
                    </div>
                  </template>
                  <RoleApiGroupBody
                    :group="group"
                    :filter-text="rightFilter"
                    :checked-ids="rightCheckedIds"
                    :cluster-expanded-keys="rightK8sClusterExpandedKeys"
                    :cluster-list="clusterList"
                    :cluster-list-loading="clusterListLoading"
                    :namespace-map="namespaceMap"
                    :namespace-loading-map="namespaceLoadingMap"
                    :namespace-expanded-by-cluster="rightK8sNsExpandedByCluster"
                    :subgroup-expanded-by-namespace="rightK8sSubGroupExpandedByNamespace"
                    @toggle-api="(id, checked) => toggleApiCheck(id, 'right', checked)"
                    @toggle-cluster="(cluster, checked) => toggleK8sCluster(cluster, 'right', checked)"
                    @toggle-namespace="(clusterName, ns, checked) => toggleK8sNamespace(clusterName, ns, 'right', checked)"
                    @toggle-sub-group="(clusterName, namespaceName, subgroup, checked) => toggleK8sSubGroup(clusterName, namespaceName, subgroup, 'right', checked)"
                    @load-namespaces="ensureNamespacesLoaded"
                    @update:cluster-expanded-keys="rightK8sClusterExpandedKeys = $event"
                    @update:namespace-expanded-by-cluster="rightK8sNsExpandedByCluster = $event"
                    @update:subgroup-expanded-by-namespace="rightK8sSubGroupExpandedByNamespace = $event"
                  />
                </ElCollapseItem>
              </ElCollapse>
              <div
                v-if="mode === 'kubernetes' ? !clusterListLoading && !clusterList.length : !filteredRightGroups.length"
                class="role-api-picker__empty"
              >
                暂无数据
              </div>
            </ElScrollbar>
          </div>
        </div>
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click="dialogVisible = false">取消</ElButton>
      <ElButton type="primary" :loading="submitting" @click="handleSubmit">提交修改</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
  import { fetchClusterList, type ClusterItem } from '@/api/container'
  import { fetchK8sNamespaceList } from '@/api/kubernetes/namespace'
  import {
    fetchGetRoleAPIs,
    fetchGetRoleAPIScopes,
    fetchUpdateRoleAPIs,
    fetchUpdateRoleAPIScopes
  } from '@/api/system-manage'
  import { ElMessage } from 'element-plus'
  import RoleApiGroupBody, {
    type ClusterPickerNode,
    type NamespacePickerNode
  } from './role-api-group-body.vue'
  import {
    keyToScopeItem,
    makeScopeKey,
    normalizeResourceName,
    scopeItemToKey,
    scopeKeysFromItems,
    type RoleAPIScopeItem
  } from './role-api-scope-utils'

  type RoleListItem = Api.SystemManage.RoleListItem

  const UNGROUPED_KEY = '__ungrouped__'
  const UNGROUPED_LABEL = '未分类'
  const KUBERNETES_GROUP_KEY = 'Kubernetes 资源'

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

  type PanelSide = 'left' | 'right'

  type RoleApiDialogMode = 'api' | 'kubernetes'

  interface Props {
    visible: boolean
    roleData?: Partial<RoleListItem>
    /** api：平台 API 权限；kubernetes：Kubernetes 权限 */
    mode?: RoleApiDialogMode
  }

  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'success'): void
  }

  const props = withDefaults(defineProps<Props>(), {
    mode: 'api'
  })
  const emit = defineEmits<Emits>()

  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })

  const loading = ref(false)
  const submitting = ref(false)
  const allApis = ref<ApiItem[]>([])
  const selectedApiIds = ref<number[]>([])
  const selectedScopes = ref<RoleAPIScopeItem[]>([])
  const initialScopes = ref<RoleAPIScopeItem[]>([])
  const leftTransferScopeKeys = ref<string[]>([])
  const rightTransferScopeKeys = ref<string[]>([])
  const leftCheckedIds = ref<number[]>([])
  const rightCheckedIds = ref<number[]>([])
  const leftFilter = ref('')
  const rightFilter = ref('')
  const leftExpandedKeys = ref<string[]>([])
  const rightExpandedKeys = ref<string[]>([])
  const leftK8sClusterExpandedKeys = ref<string[]>([])
  const rightK8sClusterExpandedKeys = ref<string[]>([])
  const leftK8sNsExpandedByCluster = ref<Record<string, string[]>>({})
  const rightK8sNsExpandedByCluster = ref<Record<string, string[]>>({})
  const leftK8sSubGroupExpandedByNamespace = ref<Record<string, string[]>>({})
  const rightK8sSubGroupExpandedByNamespace = ref<Record<string, string[]>>({})
  const clusterList = ref<ClusterPickerNode[]>([])
  const clusterListLoading = ref(false)
  const namespaceMap = ref<Record<string, NamespacePickerNode[]>>({})
  const namespaceLoadingMap = ref<Record<string, boolean>>({})
  let clusterListLoaded = false
  const namespaceLoadedSet = new Set<string>()

  const roleName = computed(() => props.roleData?.roleName || '')

  const dialogTitle = computed(() => {
    const name = roleName.value
    if (props.mode === 'kubernetes') {
      return '修改 kubernetes 权限'
    }
    return name ? `修改权限 - ${name}` : '修改权限'
  })

  const selectedIdSet = computed(() => new Set(selectedApiIds.value))

  function isKubernetesApi(api: ApiItem): boolean {
    const { key } = normalizeGroup(api.group)
    return key === KUBERNETES_GROUP_KEY
  }

  /** 当前对话框模式下可见的 API（修改权限不含 K8s；修改 kubernetes 权限仅含 K8s） */
  const dialogApis = computed(() => {
    if (props.mode === 'kubernetes') {
      return allApis.value.filter(isKubernetesApi)
    }
    return allApis.value.filter((api) => !isKubernetesApi(api))
  })

  const leftApiIds = computed(() =>
    dialogApis.value.filter((api) => !selectedIdSet.value.has(api.id)).map((api) => api.id)
  )

  const rightApiIds = computed(() =>
    dialogApis.value.filter((api) => selectedIdSet.value.has(api.id)).map((api) => api.id)
  )

  const leftGroups = computed(() =>
    buildGroups(dialogApis.value.filter((api) => !selectedIdSet.value.has(api.id)))
  )

  const rightGroups = computed(() =>
    buildGroups(dialogApis.value.filter((api) => selectedIdSet.value.has(api.id)))
  )

  const filteredLeftGroups = computed(() => filterGroups(leftGroups.value, leftFilter.value))

  const filteredRightGroups = computed(() => filterGroups(rightGroups.value, rightFilter.value))

  const selectedScopeKeys = computed(() => scopeKeysFromItems(selectedScopes.value))

  const k8sPickerGroup = computed((): ApiGroup => ({
    key: KUBERNETES_GROUP_KEY,
    label: KUBERNETES_GROUP_KEY,
    apis: dialogApis.value
  }))

  const visibleLeftApiIds = computed(() =>
    filteredLeftGroups.value.flatMap((group) => group.apis.map((api) => api.id))
  )

  const visibleRightApiIds = computed(() =>
    filteredRightGroups.value.flatMap((group) => group.apis.map((api) => api.id))
  )

  const isLeftPanelAllChecked = computed(
    () =>
      visibleLeftApiIds.value.length > 0 &&
      visibleLeftApiIds.value.every((id) => leftCheckedIds.value.includes(id))
  )

  const isLeftPanelIndeterminate = computed(() => {
    const checkedCount = visibleLeftApiIds.value.filter((id) =>
      leftCheckedIds.value.includes(id)
    ).length
    return checkedCount > 0 && checkedCount < visibleLeftApiIds.value.length
  })

  const isRightPanelAllChecked = computed(
    () =>
      visibleRightApiIds.value.length > 0 &&
      visibleRightApiIds.value.every((id) => rightCheckedIds.value.includes(id))
  )

  const isRightPanelIndeterminate = computed(() => {
    const checkedCount = visibleRightApiIds.value.filter((id) =>
      rightCheckedIds.value.includes(id)
    ).length
    return checkedCount > 0 && checkedCount < visibleRightApiIds.value.length
  })

  const isLeftAllExpanded = computed(() => {
    if (props.mode === 'kubernetes') {
      const clusterKeys = clusterList.value.map((cluster) => cluster.name)
      if (!clusterKeys.length) return false
      return clusterKeys.every((key) => leftK8sClusterExpandedKeys.value.includes(key))
    }
    const keys = filteredLeftGroups.value.map((group) => group.key)
    if (!keys.length) return false
    return keys.every((key) => leftExpandedKeys.value.includes(key))
  })

  const isRightAllExpanded = computed(() => {
    if (props.mode === 'kubernetes') {
      const clusterKeys = clusterList.value.map((cluster) => cluster.name)
      if (!clusterKeys.length) return false
      return clusterKeys.every((key) => rightK8sClusterExpandedKeys.value.includes(key))
    }
    const keys = filteredRightGroups.value.map((group) => group.key)
    if (!keys.length) return false
    return keys.every((key) => rightExpandedKeys.value.includes(key))
  })

  function getExpandedKeysRef(side: PanelSide) {
    return side === 'left' ? leftExpandedKeys : rightExpandedKeys
  }

  function isKubernetesGroup(group: ApiGroup): boolean {
    return group.key === KUBERNETES_GROUP_KEY || group.label === KUBERNETES_GROUP_KEY
  }

  function getK8sClusterExpandedRef(side: PanelSide) {
    return side === 'left' ? leftK8sClusterExpandedKeys : rightK8sClusterExpandedKeys
  }

  async function ensureClusterListLoaded() {
    if (clusterListLoaded || clusterListLoading.value) return
    clusterListLoading.value = true
    try {
      const { items } = await fetchClusterList({ page: 1, limit: 500 })
      clusterList.value = items.map((cluster: ClusterItem) => ({
        name: cluster.name,
        label: cluster.aliasName?.trim() || cluster.name,
        apis: []
      }))
      clusterListLoaded = true
    } catch (e: unknown) {
      const err = e as { message?: string }
      ElMessage.error(err?.message || '获取集群列表失败')
      clusterList.value = []
    } finally {
      clusterListLoading.value = false
    }
  }

  async function ensureNamespacesLoaded(clusterName: string) {
    if (namespaceLoadedSet.has(clusterName) || namespaceLoadingMap.value[clusterName]) return
    namespaceLoadingMap.value = { ...namespaceLoadingMap.value, [clusterName]: true }
    try {
      const { items } = await fetchK8sNamespaceList(clusterName, { page: 1, limit: 500 })
      const namespaces = items
        .map((item) => item.metadata?.name?.trim())
        .filter((name): name is string => Boolean(name))
        .sort((a, b) => a.localeCompare(b, 'zh-CN'))
        .map((name) => ({
          name,
          label: name,
          apis: []
        }))
      namespaceMap.value = { ...namespaceMap.value, [clusterName]: namespaces }
      namespaceLoadedSet.add(clusterName)
    } catch (e: unknown) {
      const err = e as { message?: string }
      ElMessage.error(err?.message || `获取集群 ${clusterName} 命名空间失败`)
      namespaceMap.value = { ...namespaceMap.value, [clusterName]: [] }
      namespaceLoadedSet.add(clusterName)
    } finally {
      const next = { ...namespaceLoadingMap.value }
      delete next[clusterName]
      namespaceLoadingMap.value = next
    }
  }

  function toggleScopeTransferBatch(keys: string[], side: PanelSide, checked: boolean) {
    const target = side === 'left' ? leftTransferScopeKeys : rightTransferScopeKeys
    const current = new Set(target.value)
    keys.forEach((key) => {
      if (checked) {
        current.add(key)
      } else {
        current.delete(key)
      }
    })
    target.value = Array.from(current)
  }

  function toggleScopeTransfer(
    payload: {
      apiId: number
      cluster: string
      namespace: string
      resourceName: string
      checked: boolean
    },
    side: PanelSide
  ) {
    const key = makeScopeKey(payload.apiId, payload.cluster, payload.namespace, payload.resourceName)
    toggleScopeTransferBatch([key], side, payload.checked)
  }

  function collectScopeKeysForCluster(
    cluster: ClusterPickerNode,
    panel: 'available' | 'assigned'
  ): string[] {
    const selectedSet = new Set(selectedScopeKeys.value)
    const keys: string[] = []
    const namespaces = namespaceMap.value[cluster.name] ?? []
    const apiList = dialogApis.value

    if (namespaces.length) {
      namespaces.forEach((ns) => {
        apiList.forEach((api) => {
          const key = makeScopeKey(api.id, cluster.name, ns.name)
          const assigned = selectedSet.has(key)
          if (panel === 'assigned' ? assigned : !assigned) {
            keys.push(key)
          }
        })
      })
      return keys
    }

    apiList.forEach((api) => {
      const key = makeScopeKey(api.id, cluster.name, '*')
      const assigned = selectedSet.has(key)
      if (panel === 'assigned' ? assigned : !assigned) {
        keys.push(key)
      }
    })
    return keys
  }

  function collectScopeKeysForNamespace(
    clusterName: string,
    ns: NamespacePickerNode,
    panel: 'available' | 'assigned'
  ): string[] {
    const selectedSet = new Set(selectedScopeKeys.value)
    const apiList = ns.apis.length ? ns.apis : dialogApis.value
    return apiList
      .filter((api) => {
        const key = makeScopeKey(api.id, clusterName, ns.name)
        const assigned = selectedSet.has(key)
        return panel === 'assigned' ? assigned : !assigned
      })
      .map((api) => makeScopeKey(api.id, clusterName, ns.name))
  }

  function toggleK8sCluster(cluster: ClusterPickerNode, side: PanelSide, checked: boolean) {
    if (props.mode === 'kubernetes') {
      const panel = side === 'left' ? 'available' : 'assigned'
      toggleScopeTransferBatch(collectScopeKeysForCluster(cluster, panel), side, checked)
      return
    }
    const current = new Set(getCheckedIds(side).value)
    cluster.apis.forEach((api) => {
      if (checked) {
        current.add(api.id)
      } else {
        current.delete(api.id)
      }
    })
    setCheckedIds(side, Array.from(current))
  }

  function toggleK8sNamespace(
    clusterName: string,
    ns: NamespacePickerNode,
    side: PanelSide,
    checked: boolean
  ) {
    if (props.mode === 'kubernetes') {
      const panel = side === 'left' ? 'available' : 'assigned'
      toggleScopeTransferBatch(collectScopeKeysForNamespace(clusterName, ns, panel), side, checked)
      return
    }
    const current = new Set(getCheckedIds(side).value)
    ns.apis.forEach((api) => {
      if (checked) {
        current.add(api.id)
      } else {
        current.delete(api.id)
      }
    })
    setCheckedIds(side, Array.from(current))
  }

  function toggleK8sSubGroup(
    clusterName: string,
    namespaceName: string,
    subgroup: { apis: Array<{ id: number }> },
    side: PanelSide,
    checked: boolean
  ) {
    if (props.mode === 'kubernetes') {
      const panel = side === 'left' ? 'available' : 'assigned'
      const selectedSet = new Set(selectedScopeKeys.value)
      const keys = subgroup.apis
        .filter((api) => {
          const key = makeScopeKey(api.id, clusterName, namespaceName)
          const assigned = selectedSet.has(key)
          return panel === 'assigned' ? assigned : !assigned
        })
        .map((api) => makeScopeKey(api.id, clusterName, namespaceName))
      toggleScopeTransferBatch(keys, side, checked)
      return
    }
    const current = new Set(getCheckedIds(side).value)
    subgroup.apis.forEach((api) => {
      if (checked) {
        current.add(api.id)
      } else {
        current.delete(api.id)
      }
    })
    setCheckedIds(side, Array.from(current))
  }

  function toggleGroupExpand(groupKey: string, side: PanelSide) {
    const expanded = getExpandedKeysRef(side)
    const index = expanded.value.indexOf(groupKey)
    if (index >= 0) {
      expanded.value = expanded.value.filter((key) => key !== groupKey)
    } else {
      expanded.value = [...expanded.value, groupKey]
      if (props.mode === 'kubernetes' && groupKey === KUBERNETES_GROUP_KEY) {
        void ensureClusterListLoaded()
      }
    }
  }

  function togglePanelExpandAll(side: PanelSide) {
    if (props.mode === 'kubernetes') {
      const k8sExpanded = getK8sClusterExpandedRef(side)
      const clusterKeys = clusterList.value.map((cluster) => cluster.name)
      const isAllExpanded =
        clusterKeys.length > 0 && clusterKeys.every((key) => k8sExpanded.value.includes(key))

      if (isAllExpanded) {
        k8sExpanded.value = []
        if (side === 'left') {
          leftK8sNsExpandedByCluster.value = {}
          leftK8sSubGroupExpandedByNamespace.value = {}
        } else {
          rightK8sNsExpandedByCluster.value = {}
          rightK8sSubGroupExpandedByNamespace.value = {}
        }
        return
      }

      void ensureClusterListLoaded().then(() => {
        const keys = clusterList.value.map((cluster) => cluster.name)
        k8sExpanded.value = [...keys]
        keys.forEach((clusterName) => {
          void ensureNamespacesLoaded(clusterName)
        })
      })
      return
    }

    const groups = side === 'left' ? filteredLeftGroups.value : filteredRightGroups.value
    const expanded = getExpandedKeysRef(side)
    const allKeys = groups.map((group) => group.key)
    const isAllExpanded =
      allKeys.length > 0 && allKeys.every((key) => expanded.value.includes(key))

    if (isAllExpanded) {
      expanded.value = []
      if (side === 'left') {
        leftK8sClusterExpandedKeys.value = []
        leftK8sNsExpandedByCluster.value = {}
        leftK8sSubGroupExpandedByNamespace.value = {}
      } else {
        rightK8sClusterExpandedKeys.value = []
        rightK8sNsExpandedByCluster.value = {}
        rightK8sSubGroupExpandedByNamespace.value = {}
      }
      return
    }
    expanded.value = [...allKeys]
    const hasK8s = groups.some((group) => isKubernetesGroup(group))
    if (hasK8s) {
      void ensureClusterListLoaded().then(() => {
        const clusterKeys = clusterList.value.map((cluster) => cluster.name)
        getK8sClusterExpandedRef(side).value = [...clusterKeys]
        clusterKeys.forEach((clusterName) => {
          void ensureNamespacesLoaded(clusterName)
        })
      })
    }
  }

  function normalizeGroup(group?: string): { key: string; label: string } {
    const value = group?.trim()
    if (!value) {
      return { key: UNGROUPED_KEY, label: UNGROUPED_LABEL }
    }
    return { key: value, label: value }
  }

  function buildGroups(apis: ApiItem[]): ApiGroup[] {
    const map = new Map<string, ApiGroup>()

    apis.forEach((api) => {
      const { key, label } = normalizeGroup(api.group)
      if (!map.has(key)) {
        map.set(key, { key, label, apis: [] })
      }
      map.get(key)!.apis.push(api)
    })

    return Array.from(map.values())
      .map((group) => ({
        ...group,
        apis: group.apis.sort((a, b) => formatApiDescription(a).localeCompare(formatApiDescription(b), 'zh-CN'))
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
  }

  function filterGroups(groups: ApiGroup[], keyword: string): ApiGroup[] {
    const text = keyword.trim().toLowerCase()
    if (!text) return groups

    return groups
      .map((group) => {
        const groupMatched =
          group.label.toLowerCase().includes(text) || group.key.toLowerCase().includes(text)
        if (groupMatched) return group
        if (props.mode === 'kubernetes' && isKubernetesGroup(group) && clusterList.value.length) {
          const clusterMatched = clusterList.value.some(
            (cluster) =>
              cluster.label.toLowerCase().includes(text) || cluster.name.toLowerCase().includes(text)
          )
          if (clusterMatched) return group
          const namespaceMatched = Object.values(namespaceMap.value).some((namespaces) =>
            namespaces.some((ns) => ns.name.toLowerCase().includes(text))
          )
          if (namespaceMatched) return group
        }
        const apis = group.apis.filter((api) => {
          return (
            api.sub_group.toLowerCase().includes(text) ||
            formatApiDescription(api).toLowerCase().includes(text) ||
            api.path.toLowerCase().includes(text) ||
            api.method.toLowerCase().includes(text)
          )
        })
        return { ...group, apis }
      })
      .filter((group) => group.apis.length > 0)
  }

  function formatApiDescription(api: Pick<ApiItem, 'description' | 'path'>): string {
    return api.description?.trim() || api.path
  }

  function mapApiResource(api: {
    id: number
    method: string
    path: string
    group?: string
    sub_group?: string
    description?: string
  }): ApiItem {
    const { key, label } = normalizeGroup(api.group)
    return {
      id: api.id,
      method: api.method,
      path: api.path,
      group: key === UNGROUPED_KEY ? '' : label,
      sub_group: api.sub_group?.trim() || '',
      description: api.description?.trim() || ''
    }
  }

  function sanitizeScopes(items: Array<RoleAPIScopeItem | null | undefined>): RoleAPIScopeItem[] {
    if (!Array.isArray(items) || items.length === 0) return []

    const seen = new Set<string>()
    const result: RoleAPIScopeItem[] = []

    for (const item of items) {
      if (!item) continue
      const apiId = Number(item.api_id)
      const cluster = String(item.cluster || '').trim()
      const namespace = String(item.namespace || '').trim()
      if (!Number.isFinite(apiId) || apiId <= 0 || !cluster || !namespace) continue

      const normalized: RoleAPIScopeItem = {
        api_id: apiId,
        cluster,
        namespace,
        resource_name: normalizeResourceName(item.resource_name)
      }
      const key = scopeItemToKey(normalized)
      if (seen.has(key)) continue
      seen.add(key)
      result.push(normalized)
    }

    return result
  }

  function getCheckedIds(side: PanelSide) {
    return side === 'left' ? leftCheckedIds : rightCheckedIds
  }

  function setCheckedIds(side: PanelSide, ids: number[]) {
    if (side === 'left') {
      leftCheckedIds.value = ids
      return
    }
    rightCheckedIds.value = ids
  }

  function toggleApiCheck(apiId: number, side: PanelSide, checked: boolean) {
    const current = new Set(getCheckedIds(side).value)
    if (checked) {
      current.add(apiId)
    } else {
      current.delete(apiId)
    }
    setCheckedIds(side, Array.from(current))
  }

  function isGroupFullyChecked(group: ApiGroup, side: PanelSide): boolean {
    const ids = group.apis.map((api) => api.id)
    if (!ids.length) return false
    const checked = getCheckedIds(side).value
    return ids.every((id) => checked.includes(id))
  }

  function isGroupIndeterminate(group: ApiGroup, side: PanelSide): boolean {
    const ids = group.apis.map((api) => api.id)
    const checkedCount = ids.filter((id) => getCheckedIds(side).value.includes(id)).length
    return checkedCount > 0 && checkedCount < ids.length
  }

  function toggleGroup(group: ApiGroup, side: PanelSide, checked: boolean) {
    const current = new Set(getCheckedIds(side).value)
    group.apis.forEach((api) => {
      if (checked) {
        current.add(api.id)
      } else {
        current.delete(api.id)
      }
    })
    setCheckedIds(side, Array.from(current))
  }

  function togglePanelAll(side: PanelSide, checked: boolean) {
    const visibleIds = side === 'left' ? visibleLeftApiIds.value : visibleRightApiIds.value
    const current = new Set(getCheckedIds(side).value)
    visibleIds.forEach((id) => {
      if (checked) {
        current.add(id)
      } else {
        current.delete(id)
      }
    })
    setCheckedIds(side, Array.from(current))
  }

  function toggleLeftPanelAll(checked: boolean) {
    togglePanelAll('left', checked)
  }

  function toggleRightPanelAll(checked: boolean) {
    togglePanelAll('right', checked)
  }

  function moveToRight() {
    if (props.mode === 'kubernetes') {
      const existing = new Set(selectedScopeKeys.value)
      const next = sanitizeScopes(selectedScopes.value)
      leftTransferScopeKeys.value.forEach((key) => {
        if (existing.has(key)) return
        const item = keyToScopeItem(key)
        if (!item) return
        next.push(item)
        existing.add(key)
      })
      selectedScopes.value = next
      leftTransferScopeKeys.value = []
      return
    }
    const next = new Set(selectedApiIds.value)
    leftCheckedIds.value.forEach((id) => next.add(id))
    selectedApiIds.value = Array.from(next)
    leftCheckedIds.value = []
  }

  function moveToLeft() {
    if (props.mode === 'kubernetes') {
      const remove = new Set(rightTransferScopeKeys.value)
      selectedScopes.value = selectedScopes.value.filter((item) => !remove.has(scopeItemToKey(item)))
      rightTransferScopeKeys.value = []
      return
    }
    const remove = new Set(rightCheckedIds.value)
    selectedApiIds.value = selectedApiIds.value.filter((id) => !remove.has(id))
    rightCheckedIds.value = []
  }

  async function loadK8sScopes(roleId: number) {
    const { scopes, apis } = await fetchGetRoleAPIScopes(roleId)
    allApis.value = apis.map(mapApiResource)
    selectedScopes.value = sanitizeScopes(
      (scopes || []).map((scope) => ({
        api_id: scope.api_id,
        cluster: scope.cluster,
        namespace: scope.namespace,
        resource_name: normalizeResourceName(scope.resource_name)
      }))
    )
    initialScopes.value = sanitizeScopes(selectedScopes.value)
    selectedApiIds.value = []
    leftTransferScopeKeys.value = []
    rightTransferScopeKeys.value = []
    leftCheckedIds.value = []
    rightCheckedIds.value = []
    leftFilter.value = ''
    rightFilter.value = ''
    leftExpandedKeys.value = []
    rightExpandedKeys.value = []
    leftK8sClusterExpandedKeys.value = []
    rightK8sClusterExpandedKeys.value = []
    leftK8sNsExpandedByCluster.value = {}
    rightK8sNsExpandedByCluster.value = {}
    leftK8sSubGroupExpandedByNamespace.value = {}
    rightK8sSubGroupExpandedByNamespace.value = {}
  }

  async function loadRoleAPIs() {
    const roleId = props.roleData?.id
    if (!roleId) return

    loading.value = true
    try {
      if (props.mode === 'kubernetes') {
        await loadK8sScopes(roleId)
        return
      }

      const { associated, unassociated } = await fetchGetRoleAPIs(roleId)
      const merged = [...associated, ...unassociated]
      const seen = new Set<number>()

      allApis.value = merged
        .filter((api) => {
          if (seen.has(api.id)) return false
          seen.add(api.id)
          return true
        })
        .map(mapApiResource)

      selectedApiIds.value = associated
        .filter((api) => (api.group || '').trim() !== KUBERNETES_GROUP_KEY)
        .map((api) => api.id)
      leftCheckedIds.value = []
      rightCheckedIds.value = []
      leftFilter.value = ''
      rightFilter.value = ''
      leftExpandedKeys.value = []
      rightExpandedKeys.value = []
      leftK8sClusterExpandedKeys.value = []
      rightK8sClusterExpandedKeys.value = []
      leftK8sNsExpandedByCluster.value = {}
      rightK8sNsExpandedByCluster.value = {}
      leftK8sSubGroupExpandedByNamespace.value = {}
      rightK8sSubGroupExpandedByNamespace.value = {}
    } catch (e: unknown) {
      const err = e as { message?: string }
      ElMessage.error(err?.message || '获取角色权限失败')
      dialogVisible.value = false
    } finally {
      loading.value = false
    }
  }

  function handleClose() {
    allApis.value = []
    selectedApiIds.value = []
    selectedScopes.value = []
    initialScopes.value = []
    leftTransferScopeKeys.value = []
    rightTransferScopeKeys.value = []
    leftCheckedIds.value = []
    rightCheckedIds.value = []
    leftFilter.value = ''
    rightFilter.value = ''
    leftExpandedKeys.value = []
    rightExpandedKeys.value = []
    leftK8sClusterExpandedKeys.value = []
    rightK8sClusterExpandedKeys.value = []
    leftK8sNsExpandedByCluster.value = {}
    rightK8sNsExpandedByCluster.value = {}
    leftK8sSubGroupExpandedByNamespace.value = {}
    rightK8sSubGroupExpandedByNamespace.value = {}
    clusterList.value = []
    clusterListLoaded = false
    namespaceMap.value = {}
    namespaceLoadingMap.value = {}
    namespaceLoadedSet.clear()
  }

  watch(leftExpandedKeys, (keys) => {
    if (props.mode === 'kubernetes' && keys.includes(KUBERNETES_GROUP_KEY)) {
      void ensureClusterListLoaded()
    }
  })

  watch(rightExpandedKeys, (keys) => {
    if (props.mode === 'kubernetes' && keys.includes(KUBERNETES_GROUP_KEY)) {
      void ensureClusterListLoaded()
    }
  })

  watch([leftFilter, rightFilter], ([left, right]) => {
    if (props.mode !== 'kubernetes') return
    const text = (left || right).trim()
    if (!text) return
    const groups = [...filteredLeftGroups.value, ...filteredRightGroups.value]
    if (groups.some((group) => isKubernetesGroup(group))) {
      void ensureClusterListLoaded().then(() => {
        clusterList.value.forEach((cluster) => {
          void ensureNamespacesLoaded(cluster.name)
        })
      })
    }
  })

  watch(leftK8sClusterExpandedKeys, (keys, prev = []) => {
    keys.filter((key) => !prev.includes(key)).forEach((clusterName) => {
      void ensureNamespacesLoaded(clusterName)
    })
  })

  watch(rightK8sClusterExpandedKeys, (keys, prev = []) => {
    keys.filter((key) => !prev.includes(key)).forEach((clusterName) => {
      void ensureNamespacesLoaded(clusterName)
    })
  })

  async function handleSubmit() {
    const roleId = props.roleData?.id
    if (!roleId) return

    submitting.value = true
    try {
      if (props.mode === 'kubernetes') {
        const current = sanitizeScopes(selectedScopes.value)
        const initial = sanitizeScopes(initialScopes.value)
        const initialMap = new Map(initial.map((item) => [scopeItemToKey(item), item]))
        const currentMap = new Map(current.map((item) => [scopeItemToKey(item), item]))

        const addScopes = current
          .filter((item) => !initialMap.has(scopeItemToKey(item)))
          .map((scope) => ({
            api_id: scope.api_id,
            cluster: scope.cluster,
            namespace: scope.namespace,
            resource_name: normalizeResourceName(scope.resource_name)
          }))

        const removeScopes = initial
          .filter((item) => !currentMap.has(scopeItemToKey(item)))
          .map((scope) => ({
            api_id: scope.api_id,
            cluster: scope.cluster,
            namespace: scope.namespace,
            resource_name: normalizeResourceName(scope.resource_name)
          }))

        if (addScopes.length === 0 && removeScopes.length === 0) {
          ElMessage.success('权限更新成功')
          emit('success')
          dialogVisible.value = false
          return
        }

        await fetchUpdateRoleAPIScopes(
          roleId,
          {
            add_scopes: addScopes,
            remove_scopes: removeScopes
          }
        )
      } else {
        await fetchUpdateRoleAPIs(roleId, selectedApiIds.value)
      }
      ElMessage.success('权限更新成功')
      emit('success')
      dialogVisible.value = false
    } catch (e: unknown) {
      const err = e as { message?: string }
      ElMessage.error(err?.message || '权限更新失败')
    } finally {
      submitting.value = false
    }
  }

  watch(
    () => props.visible,
    (visible) => {
      if (visible && props.roleData?.id) {
        void loadRoleAPIs().then(() => {
          if (props.mode === 'kubernetes') {
            void ensureClusterListLoaded()
          }
        })
      }
    }
  )
</script>

<style scoped lang="scss">
  .role-api-dialog {
    font-size: 12px;

    :deep(.el-dialog__title) {
      font-size: 12px;
    }

    :deep(.el-button) {
      font-size: 12px;
    }
  }

  :global(.role-api-dialog-header) {
    padding: 12px 20px 0 !important;
    margin-bottom: 0 !important;
  }

  :global(.role-api-dialog-body) {
    padding: 20px 16px 12px 20px !important;
    font-size: 12px;
  }

  :global(.role-api-dialog-footer) {
    display: flex !important;
    justify-content: center !important;
    align-items: center;
    gap: 12px;
  }

  .role-api-form {
    font-size: 12px;
    margin-top: 0;

    :deep(.el-form-item) {
      margin-top: 0;
      margin-bottom: 0;
    }

    :deep(.el-form-item__label) {
      font-size: 12px;
      height: auto !important;
      line-height: 1.4 !important;
    }

    :deep(.el-form-item__content) {
      max-width: none;
    }
  }

  .role-api-transfer-item {
    margin-top: 0 !important;

    :deep(.el-form-item__label) {
      display: block !important;
      width: fit-content !important;
      height: auto !important;
      min-height: 0 !important;
      padding: 0 !important;
      margin-bottom: 10px !important;
      text-align: left;
      line-height: 1.4 !important;
      box-sizing: border-box;
    }

    :deep(.el-form-item__content) {
      margin-left: 0 !important;
      width: 100%;
    }
  }

  .role-api-picker {
    display: flex;
    flex-wrap: nowrap;
    align-items: stretch;
    gap: 0;
    width: max-content;
    max-width: 100%;
    font-size: 12px;
  }

  .role-api-picker__panel {
    flex-shrink: 0;
    width: 240px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--el-border-radius-base);
    background: var(--el-bg-color-overlay);
    overflow: hidden;
  }

  .role-api-picker__header {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 40px;
    padding: 0 12px;
    background: var(--el-fill-color-light);
    border-bottom: 1px solid var(--el-border-color-lighter);
    box-sizing: border-box;
  }

  .role-api-picker__title {
    flex: 1;
    min-width: 0;
    font-size: 12px;
    color: var(--el-text-color-primary);
  }

  .role-api-picker__count {
    margin-left: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .role-api-picker__expand-btn {
    flex-shrink: 0;
    padding: 0;
    border: none;
    background: transparent;
    font-size: 12px;
    line-height: 1;
    color: var(--el-color-primary);
    cursor: pointer;
    user-select: none;

    &:hover:not(:disabled) {
      color: var(--el-color-primary-light-3);
    }

    &:disabled {
      color: var(--el-text-color-disabled);
      cursor: not-allowed;
    }
  }

  .role-api-picker__filter {
    padding: 10px 12px;
    box-sizing: border-box;

    :deep(.el-input__wrapper) {
      height: 30px;
      min-height: 30px;
      font-size: 12px;
    }

    :deep(.el-input__inner) {
      height: 30px;
      line-height: 30px;
      font-size: 12px;
    }
  }

  .role-api-picker__body {
    height: 240px;
    padding: 0 6px 8px;
    box-sizing: border-box;
  }

  .role-api-picker__collapse {
    border: none;

    :deep(.el-collapse-item__header) {
      display: flex;
      align-items: center;
      height: 32px;
      min-height: 32px;
      padding: 0 6px;
      font-size: 12px;
      line-height: 1;
      border-bottom: none;
      background: transparent;
    }

    :deep(.el-collapse-item__arrow) {
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 0 0 4px;
      line-height: 1;
    }

    :deep(.el-collapse-item__wrap) {
      border-bottom: none;
    }

    :deep(.el-collapse-item__content) {
      padding: 0 6px 6px 28px;
    }
  }

  .role-api-picker__group-title {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    min-width: 0;
    height: 32px;

    :deep(.el-checkbox) {
      display: inline-flex;
      align-items: center;
      height: 32px;
      margin-right: 0;
    }

    :deep(.el-checkbox__input) {
      display: inline-flex;
      align-items: center;
    }

    :deep(.el-checkbox__inner) {
      vertical-align: middle;
    }
  }

  .role-api-picker__group-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    cursor: pointer;
    user-select: none;
  }

  .role-api-picker__group-count {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    cursor: pointer;
    user-select: none;
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

  .role-api-picker__empty {
    padding: 24px 0;
    text-align: center;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .role-api-picker__actions {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    align-self: center;
    gap: 10px;
    padding: 0 8px;

    :deep(.role-api-picker__action-btn.el-button) {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      width: 32px !important;
      min-width: 32px !important;
      max-width: 32px;
      height: 32px !important;
      padding: 0 !important;
      margin: 0;
      border-radius: var(--el-border-radius-base);
    }

    :deep(.role-api-picker__action-btn .el-icon) {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      line-height: 1;
    }
  }
</style>

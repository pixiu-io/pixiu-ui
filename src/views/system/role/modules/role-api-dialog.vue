<template>
  <ElDialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="760px"
    class="role-api-dialog"
    header-class="role-api-dialog-header"
    body-class="role-api-dialog-body"
    footer-class="role-api-dialog-footer"
    align-center
    destroy-on-close
    @close="handleClose"
  >
    <ElForm label-width="0" class="role-api-form">
      <ElFormItem class="role-api-transfer-item" label-width="0">
        <ElTabs v-model="activeMode" class="role-api-tabs">
          <ElTabPane label="菜单权限" name="menu">
            <div v-loading="menuLoading" class="menu-perm-pane">
              <ElCheckboxGroup v-model="selectedMenuCodes" class="menu-perm-groups">
                <div
                  v-for="group in menuGroups"
                  :key="group.code"
                  class="menu-perm-group"
                >
                  <div class="menu-perm-group__title">{{ group.title }}</div>
                  <div class="menu-perm-group__items">
                    <ElCheckbox
                      v-for="item in group.items"
                      :key="item.code"
                      :label="item.code"
                      :disabled="item.public"
                    >
                      {{ item.title }}
                    </ElCheckbox>
                  </div>
                </div>
              </ElCheckboxGroup>
            </div>
          </ElTabPane>
          <ElTabPane label="API / 按钮权限" name="api">
        <!-- api 模式：双栏穿梭框绑定 API 权限点 -->
        <div v-loading="loading" class="api-perm-pane">
          <div class="role-api-picker">
          <div class="role-api-picker__panel">
            <div class="role-api-picker__header">
              <ElCheckbox
                :model-value="isLeftPanelAllChecked"
                :indeterminate="isLeftPanelIndeterminate"
                @change="(val) => toggleLeftPanelAll(Boolean(val))"
              />
              <span class="role-api-picker__title">
                未选资源
                <span class="role-api-picker__count">
                  {{ leftCheckedIds.length }}/{{ leftApiIds.length }}
                </span>
              </span>
              <button
                type="button"
                class="role-api-picker__expand-btn"
                @click="selectReadonlyApis"
              >
                只读
              </button>
              <button
                type="button"
                class="role-api-picker__expand-btn"
                :disabled="!filteredLeftGroups.length"
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
              <ElCollapse v-model="leftExpandedKeys" class="role-api-picker__collapse">
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
                        @change="(val) => toggleGroup(group, 'left', Boolean(val))"
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
                    @toggle-api="(id, checked) => toggleApiCheck(id, 'left', checked)"
                  />
                </ElCollapseItem>
              </ElCollapse>
              <div v-if="!filteredLeftGroups.length" class="role-api-picker__empty">暂无数据</div>
            </ElScrollbar>
          </div>

          <div class="role-api-picker__actions">
            <ElButton
              type="primary"
              class="role-api-picker__action-btn"
              :disabled="!leftCheckedIds.length"
              @click="moveToRight"
            >
              <ElIcon><ArrowRight /></ElIcon>
            </ElButton>
            <ElButton
              type="primary"
              class="role-api-picker__action-btn"
              :disabled="!rightCheckedIds.length"
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
                @change="(val) => toggleRightPanelAll(Boolean(val))"
              />
              <span class="role-api-picker__title">
                已选资源
                <span class="role-api-picker__count">
                  {{ rightCheckedIds.length }}/{{ rightApiIds.length }}
                </span>
              </span>
              <button
                type="button"
                class="role-api-picker__expand-btn"
                :disabled="!filteredRightGroups.length"
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
              <ElCollapse v-model="rightExpandedKeys" class="role-api-picker__collapse">
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
                        @change="(val) => toggleGroup(group, 'right', Boolean(val))"
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
                    @toggle-api="(id, checked) => toggleApiCheck(id, 'right', checked)"
                  />
                </ElCollapseItem>
              </ElCollapse>
              <div v-if="!filteredRightGroups.length" class="role-api-picker__empty">暂无数据</div>
            </ElScrollbar>
          </div>
          </div>
        </div>
          </ElTabPane>
          <ElTabPane label="数据权限" name="scope">
        <!-- scope 模式：pixiu 资源作用域（左右穿梭框选择资源实例） -->
        <div v-loading="loading || scopeResourcesPending" class="scope-config">
          <div class="role-api-picker">
            <!-- 左侧：未选资源 -->
            <div class="role-api-picker__panel">
              <div class="role-api-picker__header">
                <ElCheckbox
                  :model-value="isScopeLeftAllChecked"
                  :indeterminate="isScopeLeftIndeterminate"
                  @change="(val) => toggleScopePanelAll('left', Boolean(val))"
                />
                <span class="role-api-picker__title">
                  未选资源
                  <span class="role-api-picker__count">
                    {{ scopeLeftCheckedKeys.length }}/{{ scopeLeftVisibleKeys.length }}
                  </span>
                </span>
                <button
                  type="button"
                  class="role-api-picker__expand-btn"
                  :disabled="!filteredScopeLeftGroups.length"
                  @click="toggleScopePanelExpandAll('left')"
                >
                  {{ isScopeLeftAllExpanded ? '收起' : '展开' }}
                </button>
              </div>
              <ElInput
                v-model="scopeLeftFilter"
                class="role-api-picker__filter"
                size="small"
                clearable
                placeholder="请输入"
              />
              <ElScrollbar class="role-api-picker__body">
                <ElCollapse v-model="scopeLeftExpandedKeys" class="role-api-picker__collapse">
                  <ElCollapseItem
                    v-for="group in filteredScopeLeftGroups"
                    :key="group.resource_type"
                    :name="group.resource_type"
                  >
                    <template #title>
                      <div class="role-api-picker__group-title">
                        <ElCheckbox
                          :model-value="isScopeGroupFullyChecked(group, 'left')"
                          :indeterminate="isScopeGroupIndeterminate(group, 'left')"
                          @change="(val) => toggleScopeGroup(group, 'left', Boolean(val))"
                          @click.stop
                        />
                        <span
                          class="role-api-picker__group-name"
                          @click.stop="toggleScopeGroupExpand(group.resource_type, 'left')"
                        >{{ group.label }}</span>
                        <span
                          class="role-api-picker__group-count"
                          @click.stop="toggleScopeGroupExpand(group.resource_type, 'left')"
                        >({{ group.items.length }})</span>
                      </div>
                    </template>
                    <div class="role-api-picker__items">
                      <ElCheckbox
                        v-for="item in group.items"
                        :key="scopeResourceKey(item)"
                        :model-value="scopeLeftCheckedKeys.includes(scopeResourceKey(item))"
                        class="role-api-picker__item"
                        @change="(val) => toggleScopeItem(item, 'left', Boolean(val))"
                      >
                        <span class="scope-item-label">
                          <span class="scope-item-name">{{ item.label }}</span>
                        </span>
                      </ElCheckbox>
                    </div>
                  </ElCollapseItem>
                </ElCollapse>
                <div v-if="!filteredScopeLeftGroups.length" class="role-api-picker__empty">
                  暂无数据
                </div>
              </ElScrollbar>
            </div>

            <!-- 中间移动按钮 -->
            <div class="role-api-picker__actions">
              <ElButton
                type="primary"
                class="role-api-picker__action-btn"
                :disabled="!scopeLeftCheckedKeys.length"
                @click="moveScopeToRight"
              >
                <ElIcon><DArrowRight /></ElIcon>
              </ElButton>
              <ElButton
                type="primary"
                class="role-api-picker__action-btn"
                :disabled="!scopeRightCheckedKeys.length"
                @click="moveScopeToLeft"
              >
                <ElIcon><DArrowLeft /></ElIcon>
              </ElButton>
            </div>

            <!-- 右侧：已选资源 -->
            <div class="role-api-picker__panel">
              <div class="role-api-picker__header">
                <ElCheckbox
                  :model-value="isScopeRightAllChecked"
                  :indeterminate="isScopeRightIndeterminate"
                  @change="(val) => toggleScopePanelAll('right', Boolean(val))"
                />
                <span class="role-api-picker__title">
                  已选资源
                  <span class="role-api-picker__count">
                    {{ scopeRightCheckedKeys.length }}/{{ scopeRightVisibleKeys.length }}
                  </span>
                </span>
                <button
                  type="button"
                  class="role-api-picker__expand-btn"
                  :disabled="!filteredScopeRightGroups.length"
                  @click="toggleScopePanelExpandAll('right')"
                >
                  {{ isScopeRightAllExpanded ? '收起' : '展开' }}
                </button>
              </div>
              <ElInput
                v-model="scopeRightFilter"
                class="role-api-picker__filter"
                size="small"
                clearable
                placeholder="请输入"
              />
              <ElScrollbar class="role-api-picker__body">
                <ElCollapse v-model="scopeRightExpandedKeys" class="role-api-picker__collapse">
                  <ElCollapseItem
                    v-for="group in filteredScopeRightGroups"
                    :key="group.resource_type"
                    :name="group.resource_type"
                  >
                    <template #title>
                      <div class="role-api-picker__group-title">
                        <ElCheckbox
                          :model-value="isScopeGroupFullyChecked(group, 'right')"
                          :indeterminate="isScopeGroupIndeterminate(group, 'right')"
                          @change="(val) => toggleScopeGroup(group, 'right', Boolean(val))"
                          @click.stop
                        />
                        <span
                          class="role-api-picker__group-name"
                          @click.stop="toggleScopeGroupExpand(group.resource_type, 'right')"
                        >{{ group.label }}</span>
                        <span
                          class="role-api-picker__group-count"
                          @click.stop="toggleScopeGroupExpand(group.resource_type, 'right')"
                        >({{ group.items.length }})</span>
                      </div>
                    </template>
                    <div class="role-api-picker__items">
                      <ElCheckbox
                        v-for="item in group.items"
                        :key="scopeResourceKey(item)"
                        :model-value="scopeRightCheckedKeys.includes(scopeResourceKey(item))"
                        class="role-api-picker__item"
                        @change="(val) => toggleScopeItem(item, 'right', Boolean(val))"
                      >
                        <span class="scope-item-label">
                          <span class="scope-item-tag">{{ resourceTypeLabel(item.resource_type) }}</span>
                          <span class="scope-item-name">{{ item.label }}</span>
                        </span>
                      </ElCheckbox>
                    </div>
                  </ElCollapseItem>
                </ElCollapse>
                <div v-if="!filteredScopeRightGroups.length" class="role-api-picker__empty">
                  暂无数据
                </div>
              </ElScrollbar>
            </div>
          </div>
        </div>

          </ElTabPane>
        </ElTabs>
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click="dialogVisible = false">取消</ElButton>
      <ElButton type="primary" :loading="submitting" @click="handleSubmit">提交修改</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { ArrowLeft, ArrowRight, DArrowLeft, DArrowRight } from '@element-plus/icons-vue'
  import { fetchClusterList } from '@/api/container'
  import { fetchPlanList } from '@/api/plan'
  import { fetchPixiuNodeList } from '@/api/node'
  import { fetchAgentList } from '@/api/agent'
  import { fetchGetAIAccountList } from '@/api/ai-account'
  import { fetchDatasourceList } from '@/api/datasource'
  import { fetchGetDistributionList } from '@/api/distribution'
  import { fetchGetRunnerList } from '@/api/runner'
  import {
    fetchGetRoleAPIs,
    fetchGetRoleAPIScopes,
    fetchGetRoleMenus,
    fetchUpdateRoleAPIs,
    fetchUpdateRoleAPIScopes,
    fetchUpdateRoleMenus,
    type MenuResource,
    type RoleAPIScopeRecord
  } from '@/api/system-manage'
  import { ElMessage } from 'element-plus'
  import RoleApiGroupBody from './role-api-group-body.vue'
  import { scopeItemToKey, type RoleAPIScopeItem } from './role-api-scope-utils'

  type RoleListItem = Api.SystemManage.RoleListItem

  const UNGROUPED_KEY = '__ungrouped__'
  const UNGROUPED_LABEL = '未分类'

  /** pixiu 自有资源类型常量（与后端 role_api_scopes.resource_type 对齐） */
  const RESOURCE_TYPES: Array<{ value: string; label: string }> = [
    { value: 'plan', label: '部署计划' },
    { value: 'cluster', label: '集群' },
    { value: 'node', label: '节点' },
    { value: 'agent', label: 'Agent' },
    { value: 'account', label: '账号' },
    { value: 'datasource', label: '数据源' },
    { value: 'distribution', label: '操作系统' },
    { value: 'runner', label: 'Runner' }
  ]

  /** 资源类型 -> 列表查看 API（method:path）。scope 记录的 api_id 归属到该类型列表 API */
  const RESOURCE_TYPE_LIST_API: Record<string, string> = {
    plan: 'GET:/pixiu/plans',
    cluster: 'GET:/pixiu/clusters',
    node: 'GET:/pixiu/nodes',
    agent: 'GET:/pixiu/agents',
    account: 'GET:/pixiu/assistant/accounts',
    datasource: 'GET:/pixiu/datasources',
    distribution: 'GET:/pixiu/distributions',
    runner: 'GET:/pixiu/runners'
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

  interface ScopeResourceOption {
    id: number
    label: string
  }

  interface ScopeResourceItem {
    resource_type: string
    resource_id: number
    label: string
  }

  interface ScopeResourceGroup {
    resource_type: string
    label: string
    items: ScopeResourceItem[]
  }

  type PanelSide = 'left' | 'right'

  type ScopeSide = 'left' | 'right'

  type RoleApiDialogMode = 'api' | 'scope' | 'menu'

  interface Props {
    visible: boolean
    roleData?: Partial<RoleListItem>
  }

  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'success'): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  /** 当前激活的 tab 模式（默认 API 权限） */
  const activeMode = ref<RoleApiDialogMode>('menu')
  /** api 模式是否已加载完成（已加载则切回时不重复请求） */
  const apiLoaded = ref(false)
  /** scope 模式是否已加载完成 */
  const scopeLoaded = ref(false)
  /** scope 模式是否加载中（防止重复触发） */
  const scopeLoading = ref(false)
  /** menu 模式是否已加载 */
  const menuLoaded = ref(false)
  const menuLoading = ref(false)
  const menuCatalog = ref<MenuResource[]>([])
  const selectedMenuCodes = ref<string[]>([])
  /** api 模式数据快照（scope 加载会覆盖共享的 allApis，切回 api 时据此恢复） */
  const apiModeApis = ref<ApiItem[]>([])
  const apiModeSelectedIds = ref<number[]>([])

  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })

  const loading = ref(false)
  const submitting = ref(false)
  const allApis = ref<ApiItem[]>([])
  const selectedApiIds = ref<number[]>([])
  const initialScopes = ref<RoleAPIScopeItem[]>([])
  const leftCheckedIds = ref<number[]>([])
  const rightCheckedIds = ref<number[]>([])
  const leftFilter = ref('')
  const rightFilter = ref('')
  const leftExpandedKeys = ref<string[]>([])
  const rightExpandedKeys = ref<string[]>([])

  /** scope 模式：已选资源集合（key 为 resource_type|resource_id） */
  const selectedResourceKeys = ref<string[]>([])
  /** scope 模式：左/右侧面板勾选与筛选状态 */
  const scopeLeftCheckedKeys = ref<string[]>([])
  const scopeRightCheckedKeys = ref<string[]>([])
  const scopeLeftFilter = ref('')
  const scopeRightFilter = ref('')
  const scopeLeftExpandedKeys = ref<string[]>([])
  const scopeRightExpandedKeys = ref<string[]>([])

  /** scope 模式：resource_type -> 已加载资源实例 */
  const resourceMap = ref<Record<string, ScopeResourceOption[]>>({})
  /** scope 模式：resource_type -> 加载中标记 */
  const resourceLoading = ref<Record<string, boolean>>({})

  const roleName = computed(() => props.roleData?.roleName || '')

  const dialogTitle = computed(() => {
    const name = roleName.value
    if (activeMode.value === 'scope') {
      return name ? `修改数据权限 - ${name}` : '修改数据权限'
    }
    if (activeMode.value === 'menu') {
      return name ? `修改菜单权限 - ${name}` : '修改菜单权限'
    }
    return name ? `修改 API 权限 - ${name}` : '修改 API 权限'
  })

  const menuGroups = computed(() => {
    const catalog = menuCatalog.value
    const dirs = catalog.filter((m) => m.kind === 'directory')
    const leaves = catalog.filter((m) => m.kind !== 'directory')
    const groups = dirs.map((dir) => ({
      code: dir.code,
      title: dir.title,
      items: leaves.filter((m) => m.parent_code === dir.code)
    }))
    const orphans = leaves.filter((m) => !m.parent_code)
    if (orphans.length) {
      groups.push({ code: '_root', title: '其他', items: orphans })
    }
    return groups.filter((g) => g.items.length > 0)
  })

  /** scope 模式：任一资源类型仍在加载中 */
  const scopeResourcesPending = computed(() =>
    RESOURCE_TYPES.some((t) => Boolean(resourceLoading.value[t.value]))
  )

  const selectedIdSet = computed(() => new Set(selectedApiIds.value))

  /** 当前对话框模式下可见的 API（scope 与 api 模式均展示全部 API） */
  const dialogApis = computed(() => allApis.value)

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
    const keys = filteredLeftGroups.value.map((group) => group.key)
    if (!keys.length) return false
    return keys.every((key) => leftExpandedKeys.value.includes(key))
  })

  const isRightAllExpanded = computed(() => {
    const keys = filteredRightGroups.value.map((group) => group.key)
    if (!keys.length) return false
    return keys.every((key) => rightExpandedKeys.value.includes(key))
  })

  function getExpandedKeysRef(side: PanelSide) {
    return side === 'left' ? leftExpandedKeys : rightExpandedKeys
  }

  function toggleGroupExpand(groupKey: string, side: PanelSide) {
    const expanded = getExpandedKeysRef(side)
    const index = expanded.value.indexOf(groupKey)
    if (index >= 0) {
      expanded.value = expanded.value.filter((key) => key !== groupKey)
    } else {
      expanded.value = [...expanded.value, groupKey]
    }
  }

  function togglePanelExpandAll(side: PanelSide) {
    const groups = side === 'left' ? filteredLeftGroups.value : filteredRightGroups.value
    const expanded = getExpandedKeysRef(side)
    const allKeys = groups.map((group) => group.key)
    const isAllExpanded =
      allKeys.length > 0 && allKeys.every((key) => expanded.value.includes(key))

    if (isAllExpanded) {
      expanded.value = []
      return
    }
    expanded.value = [...allKeys]
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
      const resourceType = String(item.resource_type || '').trim()
      const resourceId = Number(item.resource_id)
      if (!Number.isFinite(apiId) || apiId <= 0) continue
      if (!resourceType) continue
      if (!Number.isFinite(resourceId) || resourceId <= 0) continue

      const normalized: RoleAPIScopeItem = {
        api_id: apiId,
        resource_type: resourceType,
        resource_id: resourceId
      }
      const key = scopeItemToKey(normalized)
      if (seen.has(key)) continue
      seen.add(key)
      result.push(normalized)
    }

    return result
  }

  /** ----- scope 模式：资源加载 ----- */

  async function loadScopeResources(resourceType: string): Promise<ScopeResourceOption[]> {
    switch (resourceType) {
      case 'plan': {
        const { list } = await fetchPlanList({ page: 1, limit: 500 })
        return list.map((item) => ({ id: item.id, label: item.name }))
      }
      case 'cluster': {
        const { items } = await fetchClusterList({ page: 1, limit: 500 })
        return items.map((item) => ({
          id: item.id,
          label: item.aliasName?.trim() || item.name
        }))
      }
      case 'node': {
        const { list } = await fetchPixiuNodeList({ page: 1, limit: 500 })
        return list.map((item) => ({ id: item.id, label: item.name || item.ip }))
      }
      case 'agent': {
        const { items } = await fetchAgentList({ page: 1, limit: 500 })
        return items.map((item) => ({ id: item.id, label: item.name }))
      }
      case 'account': {
        const { records } = await fetchGetAIAccountList({ current: 1, size: 500 })
        return records.map((item) => ({ id: item.id, label: item.name }))
      }
      case 'datasource': {
        const { items } = await fetchDatasourceList({ page: 1, limit: 500 })
        return items.map((item) => ({ id: item.id, label: item.name }))
      }
      case 'distribution': {
        const { records } = await fetchGetDistributionList({ current: 1, size: 500 })
        return records.map((item) => ({ id: item.id, label: item.name }))
      }
      case 'runner': {
        const { records } = await fetchGetRunnerList({ current: 1, size: 500 })
        return records.map((item) => ({ id: item.id, label: item.name }))
      }
      default:
        return []
    }
  }

  async function ensureResourcesLoaded(resourceType: string) {
    if (resourceMap.value[resourceType] || resourceLoading.value[resourceType]) return
    // 按 key 写入，避免并行加载时整对象替换互相覆盖
    resourceLoading.value[resourceType] = true
    try {
      const list = await loadScopeResources(resourceType)
      resourceMap.value[resourceType] = list
    } catch (e: unknown) {
      const err = e as { message?: string }
      ElMessage.error(err?.message || `获取${resourceTypeLabel(resourceType)}列表失败`)
      resourceMap.value[resourceType] = []
    } finally {
      delete resourceLoading.value[resourceType]
    }
  }

  /** ----- scope 模式：穿梭勾选 ----- */

  function scopeResourceKey(item: { resource_type: string; resource_id: number }): string {
    return `${item.resource_type}|${item.resource_id}`
  }

  function splitScopeKey(key: string): { resource_type: string; resource_id: number } {
    const idx = key.indexOf('|')
    return { resource_type: key.slice(0, idx), resource_id: Number(key.slice(idx + 1)) }
  }

  function resourceTypeLabel(resourceType: string): string {
    return RESOURCE_TYPES.find((t) => t.value === resourceType)?.label || resourceType
  }

  function resourceLabelFor(resourceType: string, resourceId: number): string {
    const opt = resourceMap.value[resourceType]?.find((o) => o.id === resourceId)
    return opt?.label || `${resourceType}:${resourceId}`
  }

  function getScopeExpandedRef(side: ScopeSide) {
    return side === 'left' ? scopeLeftExpandedKeys : scopeRightExpandedKeys
  }

  function getScopeCheckedRef(side: ScopeSide) {
    return side === 'left' ? scopeLeftCheckedKeys : scopeRightCheckedKeys
  }

  function getScopeVisibleKeys(side: ScopeSide): string[] {
    return side === 'left' ? scopeLeftVisibleKeys.value : scopeRightVisibleKeys.value
  }

  const selectedResourceKeySet = computed(() => new Set(selectedResourceKeys.value))

  /** 左侧分组：全部已加载资源实例，剔除已授权（右侧）资源 */
  const scopeLeftGroups = computed<ScopeResourceGroup[]>(() => {
    const selected = selectedResourceKeySet.value
    return RESOURCE_TYPES.map((t) => ({
      resource_type: t.value,
      label: t.label,
      items: (resourceMap.value[t.value] || [])
        .filter((opt) => !selected.has(`${t.value}|${opt.id}`))
        .map((opt) => ({ resource_type: t.value, resource_id: opt.id, label: opt.label }))
    })).filter((group) => group.items.length > 0)
  })

  /** 右侧分组：已授权资源实例，按资源类型归组 */
  const scopeRightGroups = computed<ScopeResourceGroup[]>(() => {
    const byType = new Map<string, ScopeResourceItem[]>()
    for (const key of selectedResourceKeys.value) {
      const { resource_type, resource_id } = splitScopeKey(key)
      const list = byType.get(resource_type) || []
      list.push({
        resource_type,
        resource_id,
        label: resourceLabelFor(resource_type, resource_id)
      })
      byType.set(resource_type, list)
    }
    return Array.from(byType.entries()).map(([resource_type, items]) => ({
      resource_type,
      label: resourceTypeLabel(resource_type),
      items
    }))
  })

  function filterScopeGroups(groups: ScopeResourceGroup[], keyword: string): ScopeResourceGroup[] {
    const text = keyword.trim().toLowerCase()
    if (!text) return groups
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.label.toLowerCase().includes(text) || group.label.toLowerCase().includes(text)
        )
      }))
      .filter((group) => group.items.length > 0)
  }

  const filteredScopeLeftGroups = computed(() =>
    filterScopeGroups(scopeLeftGroups.value, scopeLeftFilter.value)
  )

  const filteredScopeRightGroups = computed(() =>
    filterScopeGroups(scopeRightGroups.value, scopeRightFilter.value)
  )

  const scopeLeftVisibleKeys = computed(() =>
    filteredScopeLeftGroups.value.flatMap((group) => group.items.map(scopeResourceKey))
  )

  const scopeRightVisibleKeys = computed(() =>
    filteredScopeRightGroups.value.flatMap((group) => group.items.map(scopeResourceKey))
  )

  const isScopeLeftAllChecked = computed(
    () =>
      scopeLeftVisibleKeys.value.length > 0 &&
      scopeLeftVisibleKeys.value.every((key) => scopeLeftCheckedKeys.value.includes(key))
  )

  const isScopeLeftIndeterminate = computed(() => {
    const count = scopeLeftVisibleKeys.value.filter((key) =>
      scopeLeftCheckedKeys.value.includes(key)
    ).length
    return count > 0 && count < scopeLeftVisibleKeys.value.length
  })

  const isScopeRightAllChecked = computed(
    () =>
      scopeRightVisibleKeys.value.length > 0 &&
      scopeRightVisibleKeys.value.every((key) => scopeRightCheckedKeys.value.includes(key))
  )

  const isScopeRightIndeterminate = computed(() => {
    const count = scopeRightVisibleKeys.value.filter((key) =>
      scopeRightCheckedKeys.value.includes(key)
    ).length
    return count > 0 && count < scopeRightVisibleKeys.value.length
  })

  const isScopeLeftAllExpanded = computed(() => {
    const keys = filteredScopeLeftGroups.value.map((group) => group.resource_type)
    if (!keys.length) return false
    return keys.every((key) => scopeLeftExpandedKeys.value.includes(key))
  })

  const isScopeRightAllExpanded = computed(() => {
    const keys = filteredScopeRightGroups.value.map((group) => group.resource_type)
    if (!keys.length) return false
    return keys.every((key) => scopeRightExpandedKeys.value.includes(key))
  })

  function toggleScopeGroupExpand(groupKey: string, side: ScopeSide) {
    const expanded = getScopeExpandedRef(side)
    const index = expanded.value.indexOf(groupKey)
    if (index >= 0) {
      expanded.value = expanded.value.filter((key) => key !== groupKey)
    } else {
      expanded.value = [...expanded.value, groupKey]
    }
  }

  function toggleScopePanelExpandAll(side: ScopeSide) {
    const groups = side === 'left' ? filteredScopeLeftGroups.value : filteredScopeRightGroups.value
    const expanded = getScopeExpandedRef(side)
    const allKeys = groups.map((group) => group.resource_type)
    const isAllExpanded = allKeys.length > 0 && allKeys.every((key) => expanded.value.includes(key))
    expanded.value = isAllExpanded ? [] : [...allKeys]
  }

  function isScopeGroupFullyChecked(group: ScopeResourceGroup, side: ScopeSide): boolean {
    const keys = group.items.map(scopeResourceKey)
    if (!keys.length) return false
    const checked = getScopeCheckedRef(side).value
    return keys.every((key) => checked.includes(key))
  }

  function isScopeGroupIndeterminate(group: ScopeResourceGroup, side: ScopeSide): boolean {
    const keys = group.items.map(scopeResourceKey)
    const count = keys.filter((key) => getScopeCheckedRef(side).value.includes(key)).length
    return count > 0 && count < keys.length
  }

  function toggleScopeGroup(group: ScopeResourceGroup, side: ScopeSide, checked: boolean) {
    const current = new Set(getScopeCheckedRef(side).value)
    group.items.forEach((item) => {
      const key = scopeResourceKey(item)
      if (checked) current.add(key)
      else current.delete(key)
    })
    getScopeCheckedRef(side).value = Array.from(current)
  }

  function toggleScopePanelAll(side: ScopeSide, checked: boolean) {
    const visibleKeys = getScopeVisibleKeys(side)
    const current = new Set(getScopeCheckedRef(side).value)
    visibleKeys.forEach((key) => {
      if (checked) current.add(key)
      else current.delete(key)
    })
    getScopeCheckedRef(side).value = Array.from(current)
  }

  function toggleScopeItem(item: ScopeResourceItem, side: ScopeSide, checked: boolean) {
    const current = new Set(getScopeCheckedRef(side).value)
    const key = scopeResourceKey(item)
    if (checked) current.add(key)
    else current.delete(key)
    getScopeCheckedRef(side).value = Array.from(current)
  }

  function moveScopeToRight() {
    const current = new Set(selectedResourceKeys.value)
    scopeLeftCheckedKeys.value.forEach((key) => current.add(key))
    selectedResourceKeys.value = Array.from(current)
    scopeLeftCheckedKeys.value = []
  }

  function moveScopeToLeft() {
    const remove = new Set(scopeRightCheckedKeys.value)
    selectedResourceKeys.value = selectedResourceKeys.value.filter((key) => !remove.has(key))
    scopeRightCheckedKeys.value = []
  }

  /** 资源类型 -> 列表 API 的 api_id（按 method:path 在 allApis 中匹配） */
  function computeListApiIdByType(): Record<string, number> {
    const result: Record<string, number> = {}
    for (const [resourceType, apiPath] of Object.entries(RESOURCE_TYPE_LIST_API)) {
      const api = allApis.value.find((a) => `${a.method}:${a.path}` === apiPath)
      if (api) result[resourceType] = api.id
    }
    return result
  }

  /** ----- api 模式：穿梭勾选 ----- */

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
    const next = new Set(selectedApiIds.value)
    leftCheckedIds.value.forEach((id) => next.add(id))
    selectedApiIds.value = Array.from(next)
    leftCheckedIds.value = []
  }

  function moveToLeft() {
    const remove = new Set(rightCheckedIds.value)
    selectedApiIds.value = selectedApiIds.value.filter((id) => !remove.has(id))
    rightCheckedIds.value = []
  }

  /** 勾选左侧所有 GET 请求（只读权限），仅勾选不移到已选 */
  function selectReadonlyApis() {
    const getIds = filteredLeftGroups.value
      .flatMap((group) => group.apis)
      .filter((api) => (api.method || '').toUpperCase() === 'GET')
      .map((api) => api.id)
    const current = new Set(leftCheckedIds.value)
    getIds.forEach((id) => current.add(id))
    leftCheckedIds.value = Array.from(current)
  }

  /** ----- 数据加载 ----- */

  async function loadRoleScopes(roleId: number) {
    const { scopes, apis } = await fetchGetRoleAPIScopes(roleId)
    allApis.value = (apis || []).map(mapApiResource)
    initialScopes.value = sanitizeScopes(scopes || [])

    // 右侧初始集合：后端 scopes 按 (resource_type, resource_id) 去重还原
    const seen = new Set<string>()
    const keys: string[] = []
    for (const scope of initialScopes.value) {
      const key = `${scope.resource_type}|${scope.resource_id}`
      if (seen.has(key)) continue
      seen.add(key)
      keys.push(key)
    }
    selectedResourceKeys.value = keys

    // 加载全部资源类型的实例，供左侧分组展示
    RESOURCE_TYPES.forEach((t) => void ensureResourcesLoaded(t.value))

    selectedApiIds.value = []
    leftCheckedIds.value = []
    rightCheckedIds.value = []
    leftFilter.value = ''
    rightFilter.value = ''
    leftExpandedKeys.value = []
    rightExpandedKeys.value = []
    scopeLeftFilter.value = ''
    scopeRightFilter.value = ''
    scopeLeftCheckedKeys.value = []
    scopeRightCheckedKeys.value = []
    scopeLeftExpandedKeys.value = []
    scopeRightExpandedKeys.value = []
  }

  async function loadRoleAPIs() {
    const roleId = props.roleData?.id
    if (!roleId) return

    loading.value = true
    try {
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
      apiModeApis.value = allApis.value

      selectedApiIds.value = associated.map((api) => api.id)
      apiModeSelectedIds.value = selectedApiIds.value
      apiLoaded.value = true
      leftCheckedIds.value = []
      rightCheckedIds.value = []
      leftFilter.value = ''
      rightFilter.value = ''
      leftExpandedKeys.value = []
      rightExpandedKeys.value = []
    } catch (e: unknown) {
      const err = e as { message?: string }
      ElMessage.error(err?.message || '获取角色权限失败')
      dialogVisible.value = false
    } finally {
      loading.value = false
    }
  }

  /** 清空穿梭框全部数据（打开弹窗与关闭时调用） */
  function resetDialogData() {
    allApis.value = []
    selectedApiIds.value = []
    initialScopes.value = []
    selectedResourceKeys.value = []
    leftCheckedIds.value = []
    rightCheckedIds.value = []
    leftFilter.value = ''
    rightFilter.value = ''
    leftExpandedKeys.value = []
    rightExpandedKeys.value = []
    scopeLeftFilter.value = ''
    scopeRightFilter.value = ''
    scopeLeftCheckedKeys.value = []
    scopeRightCheckedKeys.value = []
    scopeLeftExpandedKeys.value = []
    scopeRightExpandedKeys.value = []
    resourceMap.value = {}
    resourceLoading.value = {}
    menuCatalog.value = []
    selectedMenuCodes.value = []
  }

  function handleClose() {
    resetDialogData()
  }

  /** ----- 提交 ----- */

  async function handleSubmit() {
    const roleId = props.roleData?.id
    if (!roleId) return

    submitting.value = true
    try {
      if (activeMode.value === 'scope') {
        const listApiIdByType = computeListApiIdByType()
        const currentKeys = selectedResourceKeys.value
        const initialKeySet = new Set(
          initialScopes.value.map((s) => `${s.resource_type}|${s.resource_id}`)
        )

        const addScopes: RoleAPIScopeRecord[] = []
        const removeScopes: RoleAPIScopeRecord[] = []
        const skippedTypes = new Set<string>()

        for (const key of currentKeys) {
          const { resource_type, resource_id } = splitScopeKey(key)
          const apiId = listApiIdByType[resource_type]
          if (apiId == null) {
            skippedTypes.add(resource_type)
            continue
          }
          if (!initialKeySet.has(key)) {
            addScopes.push({ api_id: apiId, resource_type, resource_id })
          }
        }

        for (const scope of initialScopes.value) {
          const key = `${scope.resource_type}|${scope.resource_id}`
          if (currentKeys.includes(key)) continue
          if (listApiIdByType[scope.resource_type] == null) {
            skippedTypes.add(scope.resource_type)
            continue
          }
          removeScopes.push({
            api_id: scope.api_id,
            resource_type: scope.resource_type,
            resource_id: scope.resource_id
          })
        }

        skippedTypes.forEach((type) => {
          console.warn(
            `[role-api-dialog] 资源类型 ${type} 未在 API 列表匹配到列表 API，已跳过该类型资源的作用域同步`
          )
        })

        if (addScopes.length === 0 && removeScopes.length === 0) {
          ElMessage.success('权限更新成功')
          emit('success')
          dialogVisible.value = false
          return
        }

        await fetchUpdateRoleAPIScopes(roleId, {
          add_scopes: addScopes,
          remove_scopes: removeScopes
        })
      } else if (activeMode.value === 'menu') {
        const publicCodes = menuCatalog.value.filter((m) => m.public).map((m) => m.code)
        const leafSelected = selectedMenuCodes.value.filter((code) => {
          const def = menuCatalog.value.find((m) => m.code === code)
          return Boolean(def && !def.public && def.kind !== 'directory')
        })
        // 仅公共菜单 / 全不选 → 清空显式绑定，回退 API 推导
        const codes =
          leafSelected.length === 0
            ? []
            : Array.from(new Set([...leafSelected, ...publicCodes]))
        await fetchUpdateRoleMenus(roleId, codes)
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

  /** 按当前 tab 模式加载对应数据：scope/menu 首次进入才加载；api 已加载则恢复快照不重复请求 */
  function loadForMode(mode: RoleApiDialogMode) {
    const roleId = props.roleData?.id
    if (!roleId) return

    if (mode === 'api') {
      if (apiLoaded.value) {
        // scope 加载会覆盖共享的 allApis，切回 api 时恢复 api 模式快照
        allApis.value = apiModeApis.value
        selectedApiIds.value = apiModeSelectedIds.value
        return
      }
      if (!loading.value) {
        void loadRoleAPIs()
      }
      return
    }

    if (mode === 'menu') {
      if (menuLoaded.value || menuLoading.value) return
      menuLoading.value = true
      void fetchGetRoleMenus(roleId)
        .then((data) => {
          menuCatalog.value = data.catalog || []
          selectedMenuCodes.value = (data.associated || []).filter((code) => {
            const def = (data.catalog || []).find((m) => m.code === code)
            return def && def.kind !== 'directory'
          })
          menuLoaded.value = true
        })
        .catch((e: unknown) => {
          const err = e as { message?: string }
          ElMessage.error(err?.message || '获取角色菜单权限失败')
        })
        .finally(() => {
          menuLoading.value = false
        })
      return
    }

    if (!scopeLoaded.value && !scopeLoading.value) {
      scopeLoading.value = true
      void loadRoleScopes(roleId)
        .then(() => {
          scopeLoaded.value = true
        })
        .catch((e: unknown) => {
          const err = e as { message?: string }
          ElMessage.error(err?.message || '获取角色资源权限失败')
        })
        .finally(() => {
          scopeLoading.value = false
        })
    }
  }

  watch(activeMode, (mode) => {
    loadForMode(mode)
  })

  watch(
    () => props.visible,
    (visible) => {
      if (visible && props.roleData?.id) {
        resetDialogData()
        apiLoaded.value = false
        scopeLoaded.value = false
        scopeLoading.value = false
        menuLoaded.value = false
        menuLoading.value = false
        apiModeApis.value = []
        apiModeSelectedIds.value = []
        activeMode.value = 'menu'
        loadForMode('menu')
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
    padding: 16px 20px 12px !important;
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
    width: 100%;

    :deep(.el-form-item) {
      margin-top: 0;
      margin-bottom: 0;
      width: 100%;
    }

    :deep(.el-form-item__label) {
      display: none;
    }

    :deep(.el-form-item__content) {
      margin-left: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
      flex: 1 1 auto;
    }
  }

  .role-api-tabs {
    width: 100%;

    :deep(.el-tabs__header) {
      margin-bottom: 10px;
    }

    :deep(.el-tabs__content),
    :deep(.el-tab-pane) {
      width: 100%;
    }

    :deep(.el-tabs__item) {
      height: 32px;
      font-size: 12px;
      line-height: 32px;
    }

    :deep(.el-tabs__nav-wrap::after) {
      height: 1px;
    }
  }

  .api-perm-pane {
    width: 100%;
  }

  .role-api-transfer-item {
    margin-top: 0 !important;
    width: 100%;

    :deep(.el-form-item__content) {
      margin-left: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
    }
  }

  /* scope 配置 */
  .scope-config {
    font-size: 12px;
    width: 100%;
  }

  /* scope 穿梭框条目（左侧/右侧通用） */
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

  .scope-item-label {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    min-width: 0;
    overflow: hidden;
  }

  .scope-item-tag {
    flex-shrink: 0;
    max-width: 64px;
    height: 18px;
    padding: 0 6px;
    line-height: 16px;
    border: 1px solid var(--el-color-primary-light-7);
    border-radius: 3px;
    box-sizing: border-box;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }

  .scope-item-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* api 穿梭框 */
  .role-api-picker {
    display: flex;
    flex-wrap: nowrap;
    align-items: stretch;
    gap: 0;
    width: 100%;
    max-width: none;
    font-size: 12px;
  }

  .role-api-picker__panel {
    flex: 1 1 0;
    min-width: 0;
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

  .menu-perm-pane {
    width: 100%;
    font-size: 12px;
  }

  .menu-perm-groups {
    display: flex;
    flex-direction: column;
    gap: 10px;
    /* 与 API / 按钮权限穿梭框总高度一致：header40 + filter50 + body240 */
    height: 330px;
    overflow: auto;
    width: 100%;
    /* 仅保留少量顶距，避免首组标题贴线被裁切 */
    padding: 8px 0 6px;
    box-sizing: border-box;
    /* 默认隐藏滑动块，悬停时显示 */
    scrollbar-width: thin;
    scrollbar-color: transparent transparent;

    &:hover {
      scrollbar-color: rgba(144, 147, 153, 0.45) transparent;
    }

    &::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }

    &::-webkit-scrollbar-thumb {
      background: transparent;
      border-radius: 3px;
    }

    &:hover::-webkit-scrollbar-thumb {
      background: rgba(144, 147, 153, 0.45);
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    :deep(.el-checkbox) {
      height: 24px;
      margin-right: 14px;
      margin-top: 0;
      margin-bottom: 0;
    }

    :deep(.el-checkbox__label) {
      font-size: 12px;
      line-height: 24px;
      padding-left: 6px;
    }
  }

  .menu-perm-group__title {
    margin-bottom: 4px;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--el-text-color-primary);
  }

  .menu-perm-group__items {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 10px;
  }
</style>

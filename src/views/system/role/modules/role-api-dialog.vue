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
                  {{ `${leftCheckedIds.length}/${leftApiIds.length}` }}
                </span>
              </span>
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
                        @change="(val: boolean) => toggleGroup(group, 'left', !!val)"
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
                    @toggle-api="(id, checked) => toggleApiCheck(id, 'left', !!checked)"
                  />
                </ElCollapseItem>
              </ElCollapse>
              <div
                v-if="!filteredLeftGroups.length"
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
                @change="toggleRightPanelAll"
              />
              <span class="role-api-picker__title">
                已选资源
                <span class="role-api-picker__count">
                  {{ `${rightCheckedIds.length}/${rightApiIds.length}` }}
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
                        @change="(val: boolean) => toggleGroup(group, 'right', !!val)"
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
                    @toggle-api="(id, checked) => toggleApiCheck(id, 'right', !!checked)"
                  />
                </ElCollapseItem>
              </ElCollapse>
              <div
                v-if="!filteredRightGroups.length"
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
  import {
    fetchGetRoleAPIs,
    fetchUpdateRoleAPIs,
  } from '@/api/system-manage'
  import { ElMessage } from 'element-plus'
  import RoleApiGroupBody from './role-api-group-body.vue'

  type RoleListItem = Api.SystemManage.RoleListItem

  const UNGROUPED_KEY = '__ungrouped__'
  const UNGROUPED_LABEL = '未分类'

  interface ApiItem {
    id: number
    method: string
    path: string
    group: string
    description: string
  }

  interface ApiGroup {
    key: string
    label: string
    apis: ApiItem[]
  }

  type PanelSide = 'left' | 'right'

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

  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })

  const loading = ref(false)
  const submitting = ref(false)
  const allApis = ref<ApiItem[]>([])
  const selectedApiIds = ref<number[]>([])
  const leftCheckedIds = ref<number[]>([])
  const rightCheckedIds = ref<number[]>([])
  const leftFilter = ref('')
  const rightFilter = ref('')
  const leftExpandedKeys = ref<string[]>([])
  const rightExpandedKeys = ref<string[]>([])

  const roleName = computed(() => props.roleData?.roleName || '')

  const dialogTitle = computed(() => {
    const name = roleName.value
    return name ? `修改权限 - ${name}` : '修改权限'
  })

  const selectedIdSet = computed(() => new Set(selectedApiIds.value))

  const dialogApis = computed(() => {
    return allApis.value
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

  const visibleLeftApiIds = computed(() =>
    filteredLeftGroups.value.flatMap((group) => group.apis.map((api) => api.id))
  )

  const visibleRightApiIds = computed(() =>
    filteredRightGroups.value.flatMap((group) => group.apis.map((api) => api.id))
  )

  const isLeftPanelAllChecked = computed(() => {
    if (!visibleLeftApiIds.value.length) return false
    return visibleLeftApiIds.value.every((id) => leftCheckedIds.value.includes(id))
  })

  const isLeftPanelIndeterminate = computed(() => {
    const checkedCount = visibleLeftApiIds.value.filter((id) =>
      leftCheckedIds.value.includes(id)
    ).length
    return checkedCount > 0 && checkedCount < visibleLeftApiIds.value.length
  })

  const isRightPanelAllChecked = computed(() => {
    if (!visibleRightApiIds.value.length) return false
    return visibleRightApiIds.value.every((id) => rightCheckedIds.value.includes(id))
  })

  const isRightPanelIndeterminate = computed(() => {
    const checkedCount = visibleRightApiIds.value.filter((id) =>
      rightCheckedIds.value.includes(id)
    ).length
    return checkedCount > 0 && checkedCount < visibleRightApiIds.value.length
  })

  const isLeftAllExpanded = computed(() => {
    return (
      leftExpandedKeys.value.length > 0 &&
      leftExpandedKeys.value.length === filteredLeftGroups.value.length
    )
  })

  const isRightAllExpanded = computed(() => {
    return (
      rightExpandedKeys.value.length > 0 &&
      rightExpandedKeys.value.length === filteredRightGroups.value.length
    )
  })

  function toggleLeftPanelAll(val: any) {
    const checked = !!val
    if (checked) {
      leftCheckedIds.value = [...visibleLeftApiIds.value]
    } else {
      leftCheckedIds.value = []
    }
  }

  function toggleRightPanelAll(val: any) {
    const checked = !!val
    if (checked) {
      rightCheckedIds.value = [...visibleRightApiIds.value]
    } else {
      rightCheckedIds.value = []
    }
  }

  function togglePanelExpandAll(side: PanelSide) {
    const expanded = side === 'left' ? leftExpandedKeys : rightExpandedKeys
    const groups = side === 'left' ? filteredLeftGroups.value : filteredRightGroups.value
    const isAllExpanded = side === 'left' ? isLeftAllExpanded.value : isRightAllExpanded.value

    if (isAllExpanded) {
      expanded.value = []
      return
    }
    expanded.value = groups.map((g) => g.key)
  }

  function toggleGroupExpand(key: string, side: PanelSide) {
    const expanded = side === 'left' ? leftExpandedKeys : rightExpandedKeys
    const index = expanded.value.indexOf(key)
    if (index > -1) {
      expanded.value.splice(index, 1)
    } else {
      expanded.value.push(key)
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
        const apis = group.apis.filter((api) => {
          return (
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
    description?: string
  }): ApiItem {
    const { key, label } = normalizeGroup(api.group)
    return {
      id: api.id,
      method: api.method,
      path: api.path,
      group: key === UNGROUPED_KEY ? '' : label,
      description: api.description?.trim() || ''
    }
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

      selectedApiIds.value = associated
        .map((api) => api.id)
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

  function resetState() {
    selectedApiIds.value = []
    leftCheckedIds.value = []
    rightCheckedIds.value = []
    leftFilter.value = ''
    rightFilter.value = ''
    leftExpandedKeys.value = []
    rightExpandedKeys.value = []
  }

  function handleClose() {
    allApis.value = []
    resetState()
  }

  async function handleSubmit() {
    const roleId = props.roleData?.id
    if (!roleId) return

    submitting.value = true
    try {
      await fetchUpdateRoleAPIs(roleId, selectedApiIds.value)
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
        void loadRoleAPIs()
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

  .role-api-picker {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    height: 400px;
    font-size: 12px;

    &__panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      height: 100%;
      border: 1px solid var(--el-border-color-light);
      border-radius: 4px;
      overflow: hidden;
    }

    &__header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--el-fill-color-light);
      border-bottom: 1px solid var(--el-border-color-light);
    }

    &__title {
      flex: 1;
      font-weight: bold;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    &__count {
      font-weight: normal;
      color: var(--el-text-color-secondary);
      font-size: 11px;
    }

    &__expand-btn {
      padding: 2px 4px;
      font-size: 11px;
      color: var(--el-color-primary);
      background: transparent;
      border: none;
      cursor: pointer;

      &:disabled {
        color: var(--el-text-color-disabled);
        cursor: not-allowed;
      }
    }

    &__filter {
      padding: 8px;
      background: white;

      :deep(.el-input__wrapper) {
        box-shadow: 0 0 0 1px var(--el-border-color-light) inset;
      }
    }

    &__body {
      flex: 1;
      background: white;
    }

    &__collapse {
      border: none;

      :deep(.el-collapse-item__header) {
        height: 36px;
        padding: 0 12px;
        background: transparent;
        border-bottom: 1px solid var(--el-border-color-extra-light);
      }

      :deep(.el-collapse-item__wrap) {
        border-bottom: 1px solid var(--el-border-color-extra-light);
      }

      :deep(.el-collapse-item__content) {
        padding: 0;
      }
    }

    &__group-title {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      font-size: 12px;
    }

    &__group-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__group-count {
      color: var(--el-text-color-secondary);
      font-size: 11px;
      margin-right: 4px;
    }

    &__actions {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 12px;
      padding-top: 40px;
    }

    &__action-btn {
      width: 32px;
      height: 32px;
      padding: 0;
      margin-left: 0 !important;

      :deep(.el-icon) {
        font-size: 14px;
      }
    }

    &__empty {
      padding: 40px 0;
      text-align: center;
      color: var(--el-text-color-disabled);
      font-size: 12px;
    }
  }
</style>

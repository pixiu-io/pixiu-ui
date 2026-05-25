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
                <span class="role-api-picker__count">{{ leftCheckedIds.length }}/{{ leftApiIds.length }}</span>
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
                  <div class="role-api-picker__items">
                    <ElCheckbox
                      v-for="api in group.apis"
                      :key="api.id"
                      :model-value="leftCheckedIds.includes(api.id)"
                      class="role-api-picker__item"
                      @change="(val: boolean) => toggleApiCheck(api.id, 'left', val)"
                    >
                      <span class="role-api-picker__item-label">{{ formatApiDescription(api) }}</span>
                    </ElCheckbox>
                  </div>
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
                @change="toggleRightPanelAll"
              />
              <span class="role-api-picker__title">
                已选资源
                <span class="role-api-picker__count">{{ rightCheckedIds.length }}/{{ rightApiIds.length }}</span>
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
                  <div class="role-api-picker__items">
                    <ElCheckbox
                      v-for="api in group.apis"
                      :key="api.id"
                      :model-value="rightCheckedIds.includes(api.id)"
                      class="role-api-picker__item"
                      @change="(val: boolean) => toggleApiCheck(api.id, 'right', val)"
                    >
                      <span class="role-api-picker__item-label">{{ formatApiDescription(api) }}</span>
                    </ElCheckbox>
                  </div>
                </ElCollapseItem>
              </ElCollapse>
              <div v-if="!filteredRightGroups.length" class="role-api-picker__empty">暂无数据</div>
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
  import { fetchGetRoleAPIs, fetchUpdateRoleAPIs } from '@/api/system-manage'
  import { ElMessage } from 'element-plus'

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

  const leftApiIds = computed(() =>
    allApis.value.filter((api) => !selectedIdSet.value.has(api.id)).map((api) => api.id)
  )

  const rightApiIds = computed(() =>
    allApis.value.filter((api) => selectedIdSet.value.has(api.id)).map((api) => api.id)
  )

  const leftGroups = computed(() => buildGroups(allApis.value.filter((api) => !selectedIdSet.value.has(api.id))))

  const rightGroups = computed(() => buildGroups(allApis.value.filter((api) => selectedIdSet.value.has(api.id))))

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
        const apis = group.apis.filter((api) => {
          if (groupMatched) return true
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

      selectedApiIds.value = associated.map((api) => api.id)
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

  function handleClose() {
    allApis.value = []
    selectedApiIds.value = []
    leftCheckedIds.value = []
    rightCheckedIds.value = []
    leftFilter.value = ''
    rightFilter.value = ''
    leftExpandedKeys.value = []
    rightExpandedKeys.value = []
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

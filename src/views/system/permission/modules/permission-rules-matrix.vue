<template>
  <div v-loading="loading" class="permission-rules-matrix">
    <div class="permission-rules-matrix__toolbar">
      <ElInput
        v-model="searchKeyword"
        clearable
        placeholder="搜索资源分组 / 资源名称"
        class="permission-rules-matrix__search"
      >
        <template #prefix>
          <ElIcon><Search /></ElIcon>
        </template>
      </ElInput>
      <div class="permission-rules-matrix__batch">
        <ElButton
          text
          type="primary"
          class="permission-rules-matrix__batch-btn"
          :disabled="!filteredRows.length || loading"
          @click="selectAll"
        >
          全选
        </ElButton>
        <ElButton
          text
          type="primary"
          class="permission-rules-matrix__batch-btn"
          :disabled="!filteredRows.length || loading"
          @click="deselectAll"
        >
          全不选
        </ElButton>
        <ElButton
          text
          type="primary"
          class="permission-rules-matrix__batch-btn"
          :disabled="!filteredRows.length || loading"
          @click="selectReadOnly"
        >
          只读
        </ElButton>
      </div>
    </div>
    <ElTable
      :data="filteredRows"
      border
      size="small"
      class="permission-rules-matrix__table"
      max-height="360"
    >
      <ElTableColumn prop="apiGroup" label="资源分组" width="180" />
      <ElTableColumn prop="resource" label="资源名称" min-width="160" />
      <ElTableColumn label="授权操作" min-width="280">
        <template #default="{ row }">
          <div class="permission-rules-matrix__actions">
            <ElCheckbox
              v-for="col in RBAC_ACTION_COLUMNS"
              :key="col.key"
              v-model="row.actions[col.key]"
              @change="emit('change')"
            >
              {{ col.label }}
            </ElCheckbox>
          </div>
        </template>
      </ElTableColumn>
    </ElTable>
    <div v-if="hasSearch && !filteredRows.length" class="permission-rules-matrix__empty">
      未找到匹配的资源
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Search } from '@element-plus/icons-vue'
  import { computed, ref } from 'vue'
  import {
    RBAC_ACTION_COLUMNS,
    type RbacRuleMatrixRow
  } from '@/utils/kubernetes/rbac-rules-matrix'

  defineOptions({ name: 'PermissionRulesMatrix' })

  defineProps<{
    loading?: boolean
  }>()

  const rows = defineModel<RbacRuleMatrixRow[]>({ default: () => [] })

  const emit = defineEmits<{
    change: []
  }>()

  const searchKeyword = ref('')

  const hasSearch = computed(() => Boolean(searchKeyword.value.trim()))

  const filteredRows = computed(() => {
    const keyword = searchKeyword.value.trim().toLowerCase()
    if (!keyword) return rows.value
    return rows.value.filter(
      (row) =>
        row.apiGroup.toLowerCase().includes(keyword) ||
        row.resource.toLowerCase().includes(keyword)
    )
  })

  function setFilteredRowsActions(checked: boolean) {
    for (const row of filteredRows.value) {
      for (const col of RBAC_ACTION_COLUMNS) {
        row.actions[col.key] = checked
      }
    }
    emit('change')
  }

  function selectAll() {
    setFilteredRowsActions(true)
  }

  function deselectAll() {
    setFilteredRowsActions(false)
  }

  /** 只读：勾选查看(get)、列表(list/watch)，取消其余操作 */
  function selectReadOnly() {
    for (const row of filteredRows.value) {
      row.actions.view = true
      row.actions.list = true
      row.actions.create = false
      row.actions.modify = false
      row.actions.delete = false
    }
    emit('change')
  }
</script>

<style scoped lang="scss">
  .permission-rules-matrix {
    margin-top: 8px;
    font-size: 12px;
  }

  .permission-rules-matrix__toolbar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    margin-bottom: 8px;
  }

  .permission-rules-matrix__batch {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 8px;
  }

  .permission-rules-matrix__batch :deep(.el-button + .el-button) {
    margin-left: 0;
  }

  .permission-rules-matrix__batch-btn,
  .permission-rules-matrix__batch-btn:hover,
  .permission-rules-matrix__batch-btn:focus,
  .permission-rules-matrix__batch-btn:active {
    padding: 0;
    margin: 0;
    font-size: 12px;
    height: auto;
    min-height: auto;
    min-width: 0;
    border: none;
    background-color: transparent !important;
  }

  .permission-rules-matrix__batch-btn:hover,
  .permission-rules-matrix__batch-btn:focus {
    color: var(--el-color-primary);
  }

  .permission-rules-matrix__batch-btn.is-disabled,
  .permission-rules-matrix__batch-btn.is-disabled:hover {
    color: var(--el-text-color-placeholder);
    background-color: transparent !important;
  }

  .permission-rules-matrix__search {
    width: 240px;
  }

  .permission-rules-matrix__search :deep(.el-input__wrapper) {
    min-height: 32px;
    font-size: 12px;
  }

  .permission-rules-matrix__table :deep(.el-table__cell) {
    font-size: 12px;
  }

  .permission-rules-matrix__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    align-items: center;
  }

  .permission-rules-matrix__actions :deep(.el-checkbox) {
    margin-right: 0;
    height: auto;
  }

  .permission-rules-matrix__actions :deep(.el-checkbox__label) {
    padding-left: 6px;
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .permission-rules-matrix__empty {
    margin-top: 8px;
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    text-align: center;
  }
</style>

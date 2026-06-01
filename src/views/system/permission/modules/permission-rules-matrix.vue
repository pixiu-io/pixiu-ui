<template>
  <div v-loading="loading" class="permission-rules-matrix">
    <div class="permission-rules-matrix__toolbar">
      <span class="permission-rules-matrix__title">权限（ClusterRole: {{ roleName }}）</span>
    </div>
    <ElTable
      :data="rows"
      border
      size="small"
      class="permission-rules-matrix__table"
      max-height="360"
    >
      <ElTableColumn prop="apiGroup" label="资源分组" width="120" />
      <ElTableColumn prop="resource" label="资源名称" min-width="140" />
      <ElTableColumn label="授权操作" min-width="320">
        <template #default="{ row }">
          <div class="permission-rules-matrix__actions">
            <label
              v-for="col in RBAC_ACTION_COLUMNS"
              :key="col.key"
              class="permission-rules-matrix__action"
              :style="{ '--action-color': col.color }"
            >
              <ElCheckbox v-model="row.actions[col.key]" @change="emit('change')" />
              <span>{{ col.label }}</span>
            </label>
          </div>
        </template>
      </ElTableColumn>
    </ElTable>
  </div>
</template>

<script setup lang="ts">
  import {
    RBAC_ACTION_COLUMNS,
    type RbacRuleMatrixRow
  } from '@/utils/kubernetes/rbac-rules-matrix'

  defineOptions({ name: 'PermissionRulesMatrix' })

  withDefaults(
    defineProps<{
      loading?: boolean
      roleName?: string
    }>(),
    {
      loading: false,
      roleName: 'view'
    }
  )

  const rows = defineModel<RbacRuleMatrixRow[]>({ default: () => [] })

  const emit = defineEmits<{
    change: []
  }>()
</script>

<style scoped lang="scss">
  .permission-rules-matrix {
    margin-top: 8px;
    font-size: 12px;
  }

  .permission-rules-matrix__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .permission-rules-matrix__title {
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .permission-rules-matrix__table :deep(.el-table__cell) {
    font-size: 12px;
  }

  .permission-rules-matrix__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    align-items: center;
  }

  .permission-rules-matrix__action {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border: 1px solid color-mix(in srgb, var(--action-color) 55%, transparent);
    border-radius: 4px;
    color: var(--action-color);
    cursor: pointer;
    user-select: none;
  }

  .permission-rules-matrix__action :deep(.el-checkbox) {
    height: auto;
  }

  .permission-rules-matrix__action :deep(.el-checkbox__label) {
    display: none;
  }
</style>

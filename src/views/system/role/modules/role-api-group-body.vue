<template>
  <div class="role-api-picker__items">
    <ElCheckbox
      v-for="api in group.apis"
      :key="api.id"
      :model-value="checkedIds.includes(api.id)"
      class="role-api-picker__item"
      @change="(val) => emit('toggleApi', api.id, Boolean(val))"
    >
      <span class="role-api-picker__item-label">{{ formatApiDescription(api) }}</span>
    </ElCheckbox>
  </div>
</template>

<script setup lang="ts">
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

  defineProps<{
    group: ApiGroup
    filterText: string
    checkedIds: number[]
  }>()

  const emit = defineEmits<{
    (e: 'toggleApi', apiId: number, checked: boolean): void
  }>()

  function formatApiDescription(api: Pick<ApiItem, 'description' | 'path'>): string {
    return api.description?.trim() || api.path
  }
</script>

<style scoped lang="scss">
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
</style>

<template>
  <div class="role-api-picker__items">
    <ElCheckbox
      v-for="api in sortedGroupApis"
      :key="api.id"
      :model-value="checkedIds.includes(api.id)"
      class="role-api-picker__item"
      @change="(val: boolean) => emit('toggleApi', api.id, !!val)"
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
  }>()

  const emit = defineEmits<{
    (e: 'toggleApi', apiId: number, checked: boolean): void
  }>()

  const sortedGroupApis = computed(() => {
    const text = props.filterText.trim().toLowerCase()
    let apis = [...props.group.apis]
    if (text) {
      apis = apis.filter((api) => {
        return (
          formatApiDescription(api).toLowerCase().includes(text) ||
          api.path.toLowerCase().includes(text) ||
          api.method.toLowerCase().includes(text)
        )
      })
    }
    return apis.sort((a, b) =>
      formatApiDescription(a).localeCompare(formatApiDescription(b), 'zh-CN')
    )
  })

  function formatApiDescription(api: Pick<ApiItem, 'description' | 'path'>): string {
    return api.description?.trim() || api.path
  }
</script>

<style scoped lang="scss">
  .role-api-picker {
    &__items {
      padding: 4px 0;
    }

    &__item {
      display: flex;
      align-items: center;
      height: 32px;
      padding: 0 24px;
      margin: 0 !important;
      width: 100%;

      &:hover {
        background: var(--el-fill-color-extra-light);
      }

      :deep(.el-checkbox__label) {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        padding-left: 8px;
        font-size: 12px;
      }
    }

    &__item-label {
      font-size: 12px;
    }
  }
</style>

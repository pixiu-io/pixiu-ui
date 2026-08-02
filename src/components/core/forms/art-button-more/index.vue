<!-- 更多按钮 -->
<template>
  <div>
    <ElDropdown v-if="hasAnyAuthItem" trigger="click" @command="handleCommand">
      <ArtIconButton icon="ri:more-2-fill" class="!size-6 bg-g-200 dark:bg-g-300/45 !text-[12px]" />
      <template #dropdown>
        <ElDropdownMenu>
          <template v-for="item in list" :key="item.key">
            <ElDropdownItem
              v-if="!item.auth || hasAuth(item.auth)"
              :command="item"
              :disabled="item.disabled"
            >
              <div class="flex-c" :style="{ color: item.color }">
                <span>{{ item.label }}</span>
              </div>
            </ElDropdownItem>
          </template>
        </ElDropdownMenu>
      </template>
    </ElDropdown>
  </div>
</template>

<script setup lang="ts">
  import { useAuth } from '@/hooks/core/useAuth'

  defineOptions({ name: 'ArtButtonMore' })

  const { hasAuth } = useAuth()

  export interface ButtonMoreItem {
    /** 按钮标识，可用于点击事件 */
    key: string | number
    /** 按钮文本 */
    label: string
    /** 是否禁用 */
    disabled?: boolean
    /** 权限标识 */
    auth?: string
    /** 图标组件 */
    icon?: string
    /** 文本颜色 */
    color?: string
    /** 图标颜色（优先级高于 color） */
    iconColor?: string
  }

  interface Props {
    /** 下拉项列表 */
    list: ButtonMoreItem[]
    /** 整体权限控制 */
    auth?: string
  }

  const props = withDefaults(defineProps<Props>(), {})

  // 检查是否有任何有权限的 item
  const hasAnyAuthItem = computed(() => {
    return props.list.some((item) => !item.auth || hasAuth(item.auth))
  })

  const emit = defineEmits<{
    (e: 'click', item: ButtonMoreItem): void
  }>()

  /** 使用 ElDropdown command，避免 item @click 在部分环境下连发两次 */
  const handleCommand = (item: ButtonMoreItem) => {
    if (!item || item.disabled) return
    emit('click', item)
  }
</script>

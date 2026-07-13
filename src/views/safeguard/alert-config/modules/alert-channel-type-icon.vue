<template>
  <img
    v-if="option?.image"
    :src="option.image"
    alt=""
    class="alert-channel-type-icon alert-channel-type-icon--image"
    :style="sizeStyle"
  />
  <ArtSvgIcon
    v-else-if="option?.icon"
    :icon="option.icon"
    class="alert-channel-type-icon"
    :style="{ color: option.color, ...sizeStyle }"
  />
</template>

<script setup lang="ts">
  import type { AlertChannelType } from '@/api/alert'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { getAlertChannelTypeOption } from './alert-channel-types'

  defineOptions({ name: 'AlertChannelTypeIcon' })

  const props = withDefaults(
    defineProps<{
      channelType: AlertChannelType
      size?: number
    }>(),
    { size: 16 }
  )

  const option = computed(() => getAlertChannelTypeOption(props.channelType))

  const sizeStyle = computed(() => ({
    width: `${props.size}px`,
    height: `${props.size}px`,
    fontSize: `${props.size}px`
  }))
</script>

<style scoped lang="scss">
  .alert-channel-type-icon {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
  }

  .alert-channel-type-icon--image {
    object-fit: contain;
  }
</style>

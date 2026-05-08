<template>
  <ArtSearchBar
    v-model="formData"
    :items="formItems"
    @reset="handleReset"
    @search="handleSearch"
  />
</template>

<script setup lang="ts">
  interface Props {
    modelValue: {
      hostName?: string
    }
  }
  interface Emits {
    (e: 'update:modelValue', value: Props['modelValue']): void
    (e: 'search', params: Props['modelValue']): void
    (e: 'reset'): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const formData = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
  })

  const formItems = computed(() => [
    {
      label: '主机名称',
      key: 'hostName',
      type: 'input',
      placeholder: '请输入主机名称（模糊）',
      clearable: true
    }
  ])

  function handleReset() {
    emit('reset')
  }

  function handleSearch(params: Props['modelValue']) {
    emit('search', params)
  }
</script>

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
      planId?: number
      hostName?: string
    }
    planOptions: { label: string; value: number }[]
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
      label: '部署计划',
      key: 'planId',
      type: 'select',
      props: {
        placeholder: '请选择部署计划',
        clearable: true,
        filterable: true,
        style: { width: '260px' },
        options: props.planOptions.map((o) => ({ label: o.label, value: o.value }))
      }
    },
    {
      label: '主机名称',
      key: 'hostName',
      type: 'input',
      placeholder: '请输入主机名称或 IP 过滤',
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

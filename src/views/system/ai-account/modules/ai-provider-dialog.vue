<template>
  <ElDialog
    v-model="dialogVisible"
    :title="dialogType === 'add' ? '新增供应商' : '编辑供应商'"
    width="540px"
    align-center
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="100px">
      <ElFormItem label="唯一标识" prop="name">
        <ElInput v-model="formData.name" placeholder="例如：deepseek" />
      </ElFormItem>
      <ElFormItem label="Base URL" prop="baseUrl">
        <ElInput v-model="formData.baseUrl" placeholder="例如：https://api.deepseek.com" />
      </ElFormItem>
      <ElFormItem label="协议" prop="protocol">
        <ElSelect v-model="formData.protocol" style="width: 100%">
          <ElOption label="OpenAI Chat Completions" value="openai_chat" />
          <ElOption label="OpenAI Responses" value="openai_responses" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="最大 Token" prop="maxTokens">
        <ElInputNumber v-model="formData.maxTokens" :min="1" :max="1000000" style="width: 100%" />
      </ElFormItem>
      <ElFormItem label="说明">
        <ElInput v-model="formData.description" type="textarea" :rows="3" />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click="dialogVisible = false">取消</ElButton>
      <ElButton type="primary" @click="handleSubmit">提交</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'

  interface ProviderFormData {
    name: string
    baseUrl: string
    protocol: string
    description: string
    maxTokens: number
  }

  const props = defineProps<{
    visible: boolean
    type: string
    providerData?: Partial<Api.SystemManage.AIProviderListItem>
  }>()
  const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void
    (e: 'submit', data: ProviderFormData): void
  }>()
  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })
  const dialogType = computed(() => props.type)
  const formRef = ref<FormInstance>()
  const formData = reactive<ProviderFormData>({
    name: '',
    baseUrl: '',
    protocol: 'openai_chat',
    description: '',
    maxTokens: 4096
  })
  const rules: FormRules = {
    name: [{ required: true, message: '请输入唯一标识', trigger: 'blur' }],
    baseUrl: [{ required: true, message: '请输入 Base URL', trigger: 'blur' }],
    protocol: [{ required: true, message: '请选择协议', trigger: 'change' }],
    maxTokens: [{ required: true, message: '请输入最大 Token', trigger: 'blur' }]
  }

  watch(
    () => [props.visible, props.type, props.providerData],
    ([visible]) => {
      if (!visible) return
      const row = props.providerData
      Object.assign(formData, {
        name: row?.name || '',
        baseUrl: row?.baseUrl || '',
        protocol: row?.protocol || 'openai_chat',
        description: row?.description || '',
        maxTokens: row?.maxTokens || 4096
      })
      nextTick(() => formRef.value?.clearValidate())
    },
    { immediate: true }
  )

  async function handleSubmit() {
    if (!formRef.value) return
    const valid = await formRef.value.validate().catch(() => false)
    if (valid) emit('submit', { ...formData })
  }
</script>

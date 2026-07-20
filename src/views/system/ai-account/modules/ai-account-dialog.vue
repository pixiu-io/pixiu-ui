<template>
  <ElDialog
    v-model="dialogVisible"
    :title="dialogType === 'add' ? '新增 AI 账号' : '编辑 AI 账号'"
    width="520px"
    align-center
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="90px">
      <ElFormItem label="供应商" prop="providerId">
        <ElSelect
          v-model="formData.providerId"
          filterable
          placeholder="请选择供应商"
          style="width: 100%"
        >
          <ElOption
            v-for="provider in providers"
            :key="provider.id"
            :label="provider.name"
            :value="provider.id"
          />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="账号名称" prop="name">
        <ElInput v-model="formData.name" placeholder="例如：DeepSeek 默认账号" />
      </ElFormItem>
      <ElFormItem label="API Key" prop="apiKey">
        <ElInput
          v-model="formData.apiKey"
          type="password"
          show-password
          :placeholder="dialogType === 'add' ? '请输入 API Key' : '留空表示保持原 API Key'"
        />
      </ElFormItem>
      <ElFormItem label="模型" prop="model">
        <ElInput v-model="formData.model" placeholder="例如：deepseek-chat" />
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

  interface AccountFormData {
    providerId: number | undefined
    name: string
    apiKey: string
    model: string
  }

  const props = defineProps<{
    visible: boolean
    type: string
    accountData?: Partial<Api.SystemManage.AIAccountListItem>
    providers: Api.SystemManage.AIProviderListItem[]
  }>()
  const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void
    (e: 'submit', data: AccountFormData): void
  }>()

  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })
  const dialogType = computed(() => props.type)
  const formRef = ref<FormInstance>()
  const formData = reactive<AccountFormData>({
    providerId: undefined,
    name: '',
    apiKey: '',
    model: ''
  })
  const rules = computed<FormRules>(() => ({
    providerId: [{ required: true, message: '请选择供应商', trigger: 'change' }],
    name: [{ required: true, message: '请输入账号名称', trigger: 'blur' }],
    apiKey:
      props.type === 'add' ? [{ required: true, message: '请输入 API Key', trigger: 'blur' }] : [],
    model: [{ required: true, message: '请输入模型', trigger: 'blur' }]
  }))

  watch(
    () => [props.visible, props.type, props.accountData],
    ([visible]) => {
      if (!visible) return
      const row = props.accountData
      Object.assign(formData, {
        providerId: row?.providerId,
        name: row?.name || '',
        apiKey: '',
        model: row?.model || ''
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

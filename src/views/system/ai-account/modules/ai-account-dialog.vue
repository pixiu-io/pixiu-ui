<template>
  <ElDialog
    v-model="dialogVisible"
    :title="dialogType === 'add' ? '新增Provider' : '编辑 AI 配置'"
    width="560px"
    align-center
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="92px">
      <ElFormItem label="供应商" prop="provider">
        <ElInput v-model="formData.provider" placeholder="例如 OpenAI / Azure OpenAI" />
      </ElFormItem>
      <ElFormItem label="API Key" prop="apiKey">
        <div class="api-key-field">
          <ElInput
            v-model="formData.apiKey"
            :type="apiKeyVisible ? 'text' : 'password'"
            placeholder="请输入 API Key"
          />
          <button
            type="button"
            class="api-key-eye"
            :title="apiKeyVisible ? '隐藏' : '显示'"
            @click="apiKeyVisible = !apiKeyVisible"
          >
            <ElIcon :size="14">
              <component :is="apiKeyVisible ? View : Hide" />
            </ElIcon>
          </button>
        </div>
      </ElFormItem>
      <ElFormItem label="Base URL" prop="baseUrl">
        <ElInput v-model="formData.baseUrl" placeholder="例如 https://api.openai.com" />
      </ElFormItem>
      <ElFormItem label="模型" prop="model">
        <ElInput v-model="formData.model" placeholder="例如 gpt-4.1 / gpt-4o-mini" />
      </ElFormItem>
      <ElFormItem label="说明" prop="description">
        <ElInput
          v-model="formData.description"
          type="textarea"
          :rows="4"
          placeholder="可选，备注用途或场景"
        />
      </ElFormItem>
      <ElFormItem label="启用状态" prop="enabled">
        <ElSwitch v-model="formData.enabled" />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <div class="dialog-footer">
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="handleSubmit">提交</ElButton>
      </div>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import { Hide, View } from '@element-plus/icons-vue'

  interface Props {
    visible: boolean
    type: string
    accountData?: Partial<Api.SystemManage.AIAccountListItem>
  }

  interface Emits {
    (e: 'update:visible', value: boolean): void
    (
      e: 'submit',
      data: {
        provider: string
        apiKey: string
        baseUrl: string
        model: string
        description: string
        enabled: boolean
      }
    ): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })

  const dialogType = computed(() => props.type)
  const formRef = ref<FormInstance>()
  const apiKeyVisible = ref(false)

  const formData = reactive({
    provider: '',
    apiKey: '',
    baseUrl: '',
    model: '',
    description: '',
    enabled: true
  })

  const rules: FormRules = {
    provider: [{ required: true, message: '请输入供应商', trigger: 'blur' }],
    apiKey: [{ required: true, message: '请输入 API Key', trigger: 'blur' }],
    baseUrl: [{ required: true, message: '请输入 Base URL', trigger: 'blur' }]
  }

  const initFormData = () => {
    const isEdit = props.type === 'edit' && props.accountData
    const row = props.accountData

    Object.assign(formData, {
      provider: isEdit && row ? row.provider || '' : '',
      apiKey: isEdit && row ? row.apiKey || '' : '',
      baseUrl: isEdit && row ? row.baseUrl || '' : '',
      model: isEdit && row ? row.model || '' : '',
      description: isEdit && row ? row.description || '' : '',
      enabled: isEdit && row ? Boolean(row.enabled) : true
    })
  }

  watch(
    () => [props.visible, props.type, props.accountData],
    ([visible]) => {
      if (visible) {
        initFormData()
        apiKeyVisible.value = false
        nextTick(() => {
          formRef.value?.clearValidate()
        })
      }
    },
    { immediate: true }
  )

  const handleSubmit = async () => {
    if (!formRef.value) return

    await formRef.value.validate((valid) => {
      if (valid) {
        emit('submit', { ...formData })
      }
    })
  }
</script>

<style scoped>
  :deep(.el-dialog__title) {
    font-size: 14px;
  }

  :deep(.el-form-item__label) {
    font-size: 13px;
  }

  :deep(.el-dialog__body) {
    padding: 16px 28px;
  }

  :deep(.el-form-item__content) {
    max-width: 400px;
  }

  :deep(.el-input__inner),
  :deep(.el-textarea__inner) {
    font-size: 12px;
  }

  .api-key-field {
    position: relative;
    width: 100%;
  }

  .api-key-field .api-key-eye {
    position: absolute;
    right: 6px;
    top: 6px;
    display: inline-flex;
    width: 22px;
    height: 22px;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: #8c8c8c;
    cursor: pointer;
    z-index: 2;
  }

  .api-key-field .api-key-eye:hover {
    background: #f0f0f0;
    color: #262626;
  }
</style>

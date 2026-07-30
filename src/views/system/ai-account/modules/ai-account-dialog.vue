<template>
  <ElDialog
    v-model="dialogVisible"
    :title="dialogType === 'add' ? '新增 AI 账号' : '编辑 AI 账号'"
    width="560px"
    align-center
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="100px">
      <ElFormItem label="账号名称" prop="name">
        <ElInput v-model="formData.name" placeholder="例如 生产环境 GLM" />
      </ElFormItem>
      <ElFormItem label="Provider" prop="providerId">
        <ElSelect v-model="formData.providerId" placeholder="请选择 Provider" style="width: 100%">
          <ElOption
            v-for="provider in providers"
            :key="provider.id"
            :label="`${provider.name} (${provider.protocol})`"
            :value="provider.id"
          />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="API Key" prop="apiKey">
        <div class="api-key-field">
          <ElInput
            v-model="formData.apiKey"
            :type="apiKeyVisible ? 'text' : 'password'"
            :placeholder="dialogType === 'edit' ? '留空表示不修改' : '请输入 API Key'"
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
      <ElFormItem label="模型" prop="model">
        <ElInput v-model="formData.model" placeholder="例如 gpt-4.1 / gpt-4o-mini" />
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
    providers: Api.SystemManage.AIProviderListItem[]
  }

  interface Emits {
    (e: 'update:visible', value: boolean): void
    (
      e: 'submit',
      data: {
        name: string
        providerId: number
        apiKey: string
        model: string
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
    name: '',
    providerId: undefined as number | undefined,
    apiKey: '',
    model: ''
  })

  const rules: FormRules = {
    name: [{ required: true, message: '请输入账号名称', trigger: 'blur' }],
    providerId: [{ required: true, message: '请选择 Provider', trigger: 'change' }],
    apiKey: [
      {
        validator: (_rule, value, callback) => {
          if (props.type === 'add' && !String(value || '').trim())
            callback(new Error('请输入 API Key'))
          else callback()
        },
        trigger: 'blur'
      }
    ],
    model: [{ required: true, message: '请输入模型', trigger: 'blur' }]
  }

  const initFormData = () => {
    const isEdit = props.type === 'edit' && props.accountData
    const row = props.accountData

    Object.assign(formData, {
      name: isEdit && row ? row.name || '' : '',
      providerId: isEdit && row ? row.providerId : props.providers[0]?.id,
      apiKey: '',
      model: isEdit && row ? row.model || '' : ''
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
        emit('submit', { ...formData, providerId: formData.providerId! })
      }
    })
  }
</script>

<style scoped>
  :deep(.el-dialog__title) {
    font-size: 14px;
  }

  :deep(.el-form-item__label) {
    font-size: 12px;
    color: var(--el-text-color-regular);
    padding-right: 12px;
  }

  :deep(.el-dialog__body) {
    padding: 10px 16px 12px 16px;
  }

  :deep(.el-input__inner),
  :deep(.el-textarea__inner) {
    font-size: 12px;
  }

  :deep(.el-form-item__content) {
    max-width: 400px;
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

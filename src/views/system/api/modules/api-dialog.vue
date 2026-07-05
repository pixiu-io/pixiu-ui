<template>
  <ElDialog
    v-model="dialogVisible"
    :title="dialogType === 'add' ? '创建 API' : '编辑 API'"
    width="500px"
    align-center
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="80px">
      <ElFormItem label="请求方法" prop="method">
        <ElSelect v-model="formData.method" placeholder="请选择请求方法">
          <ElOption label="GET" value="GET" />
          <ElOption label="POST" value="POST" />
          <ElOption label="PUT" value="PUT" />
          <ElOption label="DELETE" value="DELETE" />
          <ElOption label="PATCH" value="PATCH" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="请求路径" prop="path">
        <ElInput v-model="formData.path" placeholder="如 /pixiu/users/:id" />
      </ElFormItem>
      <ElFormItem label="资源" prop="group">
        <ElInput v-model="formData.group" placeholder="如 /pixiu/users" />
      </ElFormItem>
      <ElFormItem label="动作" prop="description">
        <ElInput
          v-model="formData.description"
          type="textarea"
          placeholder="请输入描述"
        />
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

  interface Props {
    visible: boolean
    type: string
    apiData?: Partial<Api.SystemManage.APIListItem>
  }

  interface Emits {
    (e: 'update:visible', value: boolean): void
    (
      e: 'submit',
      data: { method: string; path: string; group: string; description: string }
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

  const formData = reactive({
    method: 'GET',
    path: '',
    group: '',
    description: ''
  })

  const rules: FormRules = {
    method: [{ required: true, message: '请选择请求方法', trigger: 'change' }],
    path: [
      { required: true, message: '请输入请求路径', trigger: 'blur' },
      { max: 255, message: '路径长度不能超过 255 个字符', trigger: 'blur' }
    ]
  }

  const initFormData = () => {
    const isEdit = props.type === 'edit' && props.apiData
    const row = props.apiData

    Object.assign(formData, {
      method: isEdit && row ? row.method || 'GET' : 'GET',
      path: isEdit && row ? row.path || '' : '',
      group: isEdit && row ? row.group || '' : '',
      description: isEdit && row ? row.description || '' : ''
    })
  }

  watch(
    () => [props.visible, props.type, props.apiData],
    ([visible]) => {
      if (visible) {
        initFormData()
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
    padding: 16px 40px 16px 24px;
  }

  :deep(.el-form-item__content) {
    max-width: 350px;
  }

  :deep(.el-input__inner),
  :deep(.el-textarea__inner) {
    font-size: 12px;
  }
</style>

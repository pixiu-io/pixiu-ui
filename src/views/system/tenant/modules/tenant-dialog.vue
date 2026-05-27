<template>
  <ElDialog
    v-model="dialogVisible"
    :title="dialogType === 'add' ? '创建租户' : '编辑租户'"
    width="500px"
    align-center
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="80px">
      <ElFormItem label="租户名称" prop="tenantName">
        <ElInput v-model="formData.tenantName" placeholder="请输入租户名称" />
      </ElFormItem>
      <ElFormItem label="描述" prop="description">
        <ElInput
          v-model="formData.description"
          type="textarea"
          :rows="5"
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
    tenantData?: Partial<Api.SystemManage.TenantListItem>
  }

  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'submit', data: { tenantName: string; description: string }): void
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
    tenantName: '',
    description: ''
  })

  const rules: FormRules = {
    tenantName: [
      { required: true, message: '请输入租户名称', trigger: 'blur' },
      { min: 2, max: 100, message: '长度在 2 到 100 个字符', trigger: 'blur' }
    ]
  }

  const initFormData = () => {
    const isEdit = props.type === 'edit' && props.tenantData
    const row = props.tenantData

    Object.assign(formData, {
      tenantName: isEdit && row ? row.tenantName || '' : '',
      description: isEdit && row ? row.description || '' : ''
    })
  }

  watch(
    () => [props.visible, props.type, props.tenantData],
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

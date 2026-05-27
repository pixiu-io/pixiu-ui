<template>
  <ElDialog
    v-model="dialogVisible"
    :title="dialogType === 'add' ? '创建角色' : '编辑角色'"
    width="500px"
    align-center
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="80px">
      <ElFormItem label="角色名称" prop="roleName">
        <ElInput v-model="formData.roleName" placeholder="请输入角色名称" />
      </ElFormItem>
      <ElFormItem v-if="dialogType === 'add'" label="租户" prop="tenantId">
        <ElSelect
          v-model="formData.tenantId"
          placeholder="请选择租户"
          filterable
          :loading="tenantLoading"
        >
          <ElOption
            v-for="item in tenantOptions"
            :key="item.id"
            :label="item.tenantName"
            :value="item.id"
          />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="描述" prop="description">
        <ElInput
          v-model="formData.description"
          type="textarea"
          :rows="5"
          placeholder="请输入角色描述"
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
  import { ElMessage } from 'element-plus'
  import { PixiuApiError } from '@/api/container'
  import { fetchGetTenantList } from '@/api/system-manage'

  interface Props {
    visible: boolean
    type: string
    roleData?: Partial<Api.SystemManage.RoleListItem>
  }

  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'submit', data: { roleName: string; tenantId?: number; description: string }): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })

  const dialogType = computed(() => props.type)

  const formRef = ref<FormInstance>()
  const tenantOptions = ref<Api.SystemManage.TenantListItem[]>([])
  const tenantLoading = ref(false)

  const formData = reactive({
    roleName: '',
    tenantId: undefined as number | undefined,
    description: ''
  })

  const rules: FormRules = {
    roleName: [
      { required: true, message: '请输入角色名称', trigger: 'blur' },
      { min: 2, max: 100, message: '长度在 2 到 100 个字符', trigger: 'blur' }
    ],
    tenantId: [
      { required: true, message: '请选择租户', trigger: 'change' },
      {
        validator: (_rule, value, callback) => {
          if (value === undefined || value === null || Number(value) <= 0) {
            callback(new Error('请选择租户'))
            return
          }
          callback()
        },
        trigger: 'change'
      }
    ]
  }

  async function loadTenantOptions() {
    tenantLoading.value = true
    try {
      const { records } = await fetchGetTenantList({ current: 1, size: 500 })
      tenantOptions.value = records
      if (props.type === 'add' && records.length && !formData.tenantId) {
        formData.tenantId = records[0].id
      }
    } catch (e: unknown) {
      tenantOptions.value = []
      if (e instanceof PixiuApiError && e.notified) return
      const err = e as { message?: string }
      ElMessage.error(err?.message || '获取租户列表失败')
    } finally {
      tenantLoading.value = false
    }
  }

  const initFormData = () => {
    const isEdit = props.type === 'edit' && props.roleData
    const row = props.roleData

    Object.assign(formData, {
      roleName: isEdit && row ? row.roleName || '' : '',
      tenantId: undefined,
      description: isEdit && row ? row.description || '' : ''
    })
  }

  watch(
    () => props.visible,
    (visible) => {
      if (!visible) return
      initFormData()
      if (dialogType.value === 'add') {
        void loadTenantOptions()
      }
      nextTick(() => {
        formRef.value?.clearValidate()
      })
    }
  )

  const handleSubmit = async () => {
    if (!formRef.value) return

    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return

    emit('submit', {
      roleName: formData.roleName,
      tenantId: formData.tenantId,
      description: formData.description
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

  :deep(.el-select__wrapper) {
    font-size: 12px;
  }
</style>

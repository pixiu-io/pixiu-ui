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
      <ElFormItem v-if="dialogType === 'add'" label="租户 ID" prop="tenantId">
        <ElSelect
          v-model="formData.tenantId"
          placeholder="请选择租户，默认为全局角色"
          clearable
          filterable
          :loading="tenantLoading"
          @visible-change="handleTenantSelectVisible"
        >
          <ElOption label="全局角色" :value="0" />
          <ElOption
            v-for="item in tenantOptions"
            :key="item.id"
            :label="`${item.tenantName} (${item.id})`"
            :value="item.id"
          />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="描述" prop="description">
        <ElInput
          v-model="formData.description"
          type="textarea"
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
    tenantId: 0 as number | undefined,
    description: ''
  })

  const rules: FormRules = {
    roleName: [
      { required: true, message: '请输入角色名称', trigger: 'blur' },
      { min: 2, max: 100, message: '长度在 2 到 100 个字符', trigger: 'blur' }
    ]
  }

  async function loadTenantOptions() {
    tenantLoading.value = true
    try {
      const res = await fetchGetTenantList({ current: 1, size: 200 })
      tenantOptions.value = res.records
    } catch {
      ElMessage.error('获取租户列表失败')
    } finally {
      tenantLoading.value = false
    }
  }

  function handleTenantSelectVisible(visible: boolean) {
    if (visible) {
      loadTenantOptions()
    }
  }

  const initFormData = () => {
    const isEdit = props.type === 'edit' && props.roleData
    const row = props.roleData

    Object.assign(formData, {
      roleName: isEdit && row ? row.roleName || '' : '',
      tenantId: 0,
      description: isEdit && row ? row.description || '' : ''
    })
  }

  watch(
    () => [props.visible, props.type, props.roleData],
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

  :deep(.el-select__wrapper) {
    font-size: 12px;
  }
</style>

<template>
  <ElDialog
    v-model="dialogVisible"
    :title="dialogType === 'add' ? '创建用户' : '编辑用户'"
    width="500px"
    align-center
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="80px">
      <ElFormItem label="用户名" prop="username">
        <ElInput v-model="formData.username" placeholder="请输入用户名" />
      </ElFormItem>
      <ElFormItem v-if="dialogType === 'add'" label="登录密码" prop="password">
        <ElInput v-model="formData.password" type="password" placeholder="请输入密码" show-password />
      </ElFormItem>
      <ElFormItem label="用户类型" prop="role">
        <ElSelect
          v-model="formData.role"
          :loading="roleLoading"
          :disabled="isSuperAdmin"
          placeholder="请选择用户类型"
          clearable
        >
          <ElOption v-if="isSuperAdmin" label="超级管理员" value="0" />
          <ElOption
            v-for="r in roleList"
            :key="r.id"
            :label="r.roleName"
            :value="String(r.id)"
          />
        </ElSelect>
      </ElFormItem>
      <ElFormItem v-if="dialogType === 'edit'" label="状态" prop="status">
        <ElSelect v-model="formData.status">
          <ElOption label="正常" value="0" />
          <ElOption label="禁用" value="1" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="手机号" prop="phone">
        <ElInput v-model="formData.phone" placeholder="请输入手机号" />
      </ElFormItem>
      <ElFormItem label="邮箱" prop="email">
        <ElInput v-model="formData.email" placeholder="请输入邮箱" />
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
  import { ElMessage } from 'element-plus'
  import { PixiuApiError } from '@/api/container'
  import { fetchGetRoleList } from '@/api/system-manage'

  interface Props {
    visible: boolean
    type: string
    userData?: Partial<Api.SystemManage.UserListItem>
  }

  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'submit', data: { username: string; password: string; phone: string; email: string; description: string; role: string; status: string }): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  // 对话框显示控制
  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })

  const dialogType = computed(() => props.type)
  const isSuperAdmin = computed(() => props.type === 'edit' && props.userData?.role === 0)

  // 表单实例
  const formRef = ref<FormInstance>()

  // 表单数据
  const formData = reactive<any>({
    username: '',
    password: '',
    phone: '',
    email: '',
    description: '',
    role: '',
    status: '0'
  })

  const roleList = ref<Api.SystemManage.RoleListItem[]>([])
  const roleLoading = ref(false)

  async function loadRoleList() {
    roleLoading.value = true
    try {
      const { records } = await fetchGetRoleList({ current: 1, size: 500 })
      roleList.value = records
      ensureRoleSelection()
    } catch (e: unknown) {
      roleList.value = []
      if (e instanceof PixiuApiError && e.notified) return
      const err = e as { message?: string }
      ElMessage.error(err?.message || '获取角色列表失败')
    } finally {
      roleLoading.value = false
    }
  }

  /** 创建时默认选第一项；编辑时若当前 role 不在列表中则保留原值 */
  function ensureRoleSelection() {
    if (isSuperAdmin.value) {
      formData.role = '0'
      return
    }
    const current = String(formData.role ?? '')
    if (current && roleList.value.some((r) => String(r.id) === current)) return
    if (props.type === 'add' && roleList.value.length) {
      formData.role = String(roleList.value[0].id)
    }
  }

  // 表单验证规则
  const rules: FormRules = {
    username: [
      { required: true, message: '请输入用户名', trigger: 'blur' },
      { min: 2, max: 20, message: '长度在 2 到 20 个字符', trigger: 'blur' }
    ],
    password: [
      { required: true, message: '请输入密码', trigger: 'blur' },
      { min: 6, max: 32, message: '长度在 6 到 32 个字符', trigger: 'blur' },
      { pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, message: '密码不符合要求，至少包含一个大写字母、一个小写字母、一个数字', trigger: 'blur' }
    ],
    phone: [
      { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号格式', trigger: 'blur' }
    ],
    email: [
      { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
    ],
    role: [{ required: true, message: '请选择角色', trigger: 'blur' }]
  }

  const initFormData = () => {
    const isEdit = props.type === 'edit' && props.userData
    const row = props.userData

    Object.assign(formData, {
      username: isEdit && row ? row.userName || '' : '',
      password: '',
      phone: isEdit && row ? row.userPhone || '' : '',
      email: isEdit && row ? row.userEmail || '' : '',
      description: '',
      role: isEdit && row ? String(row.role ?? '') : '',
      status: isEdit && row ? String(row.status ?? '0') : '0'
    })
  }

  watch(
    () => props.visible,
    (visible) => {
      if (!visible) return
      initFormData()
      void loadRoleList()
      nextTick(() => {
        formRef.value?.clearValidate()
      })
    }
  )

  const handleSubmit = async () => {
    if (!formRef.value) return

    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return

    // 成功后再由父组件关闭弹窗，失败时保持打开以便修改
    emit('submit', { ...formData } as any)
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

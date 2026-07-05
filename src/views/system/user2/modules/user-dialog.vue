<template>
  <ElDialog
    v-model="dialogVisible"
    :title="dialogType === 'add' ? '添加用户' : '编辑用户'"
    width="30%"
    align-center
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="80px">
      <ElFormItem label="用户名" prop="username">
        <ElInput v-model="formData.username" placeholder="请输入用户名" :disabled="dialogType === 'edit'" />
      </ElFormItem>
      <ElFormItem v-if="dialogType === 'add'" label="密码" prop="password">
        <ElInput v-model="formData.password" type="password" show-password placeholder="请输入密码" />
      </ElFormItem>
      <ElFormItem label="手机号" prop="phone">
        <ElInput v-model="formData.phone" placeholder="请输入手机号" />
      </ElFormItem>
      <ElFormItem label="邮箱" prop="email">
        <ElInput v-model="formData.email" placeholder="请输入邮箱" />
      </ElFormItem>
      <ElFormItem label="状态" prop="status">
        <ElSelect v-model="formData.status">
          <ElOption label="正常" value="0" />
          <ElOption label="停用" value="1" />
          <ElOption label="禁用" value="2" />
        </ElSelect>
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
  import { fetchCreateUser, fetchUpdateUser } from '@/api/system-manage'
  import type { FormInstance, FormRules } from 'element-plus'

  interface Props {
    visible: boolean
    type: string
    userData?: Partial<Api.SystemManage.UserListItem>
  }

  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'submit'): void
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
    username: '',
    password: '',
    phone: '',
    email: '',
    status: '0'
  })

  const rules: FormRules = {
    username: [
      { required: true, message: '请输入用户名', trigger: 'blur' },
      { min: 2, max: 20, message: '长度在 2 到 20 个字符', trigger: 'blur' }
    ],
    phone: [
      { required: true, message: '请输入手机号', trigger: 'blur' },
      { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号格式', trigger: 'blur' }
    ],
    email: [{ type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }],
    password: [
      {
        validator: (_rule, value, callback) => {
          if (dialogType.value === 'add' && !value) {
            callback(new Error('请输入密码'))
            return
          }
          callback()
        },
        trigger: 'blur'
      }
    ]
  }

  const initFormData = () => {
    const isEdit = props.type === 'edit' && props.userData
    const row = props.userData

    Object.assign(formData, {
      username: isEdit && row ? row.userName || '' : '',
      phone: isEdit && row ? row.userPhone || '' : '',
      password: '',
      email: isEdit && row ? row.userEmail || '' : '',
      status: isEdit && row ? row.status || '0' : '0'
    })
  }

  watch(
    () => [props.visible, props.type, props.userData],
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

    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return

    if (dialogType.value === 'add') {
      await fetchCreateUser({
        name: formData.username,
        password: formData.password,
        email: formData.email,
        phone: formData.phone,
        status: Number(formData.status)
      })
      ElMessage.success('添加成功')
    } else {
      const userId = props.userData?.id
      const resourceVersion =
        props.userData?.resourceVersion ??
        (props.userData as Partial<{ resource_version: number }> | undefined)?.resource_version

      if (userId == null || resourceVersion == null) {
        ElMessage.error('缺少用户标识，无法更新')
        return
      }
      await fetchUpdateUser({
        id: userId,
        resourceVersion,
        email: formData.email,
        phone: formData.phone,
        status: Number(formData.status),
        role: (props.userData as any).role || 0
      })
      ElMessage.success('更新成功')
    }

    dialogVisible.value = false
    emit('submit')
  }
</script>

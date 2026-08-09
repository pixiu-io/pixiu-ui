<template>
  <ElDialog
    v-model="dialogVisible"
    :title="dialogType === 'add' ? '新建邮件配置' : '编辑邮件配置'"
    width="720px"
    align-center
    destroy-on-close
    class="email-dialog"
    body-class="email-dialog-body"
    header-class="email-dialog-header"
    footer-class="email-dialog-footer"
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="100px">
      <div class="email-form-grid">
        <ElFormItem label="名称" prop="name">
          <ElInput v-model="formData.name" placeholder="请输入配置名称" />
        </ElFormItem>
        <ElFormItem label="SMTP 服务器" prop="smtp_host">
          <ElInput v-model="formData.smtp_host" placeholder="例如 smtp.example.com" />
        </ElFormItem>
        <ElFormItem label="端口" prop="smtp_port">
          <ElInputNumber v-model="formData.smtp_port" :min="1" :max="65535" style="width: 100%" />
        </ElFormItem>
        <ElFormItem label="用户名" prop="username">
          <ElInput v-model="formData.username" placeholder="SMTP 认证用户名（可选）" />
        </ElFormItem>
        <ElFormItem label="密码" prop="password">
          <ElInput
            v-model="formData.password"
            type="password"
            show-password
            :placeholder="passwordPlaceholder"
          />
        </ElFormItem>
        <ElFormItem label="加密方式" prop="encryption">
          <ElSelect v-model="formData.encryption" style="width: 100%">
            <ElOption
              v-for="opt in encryptionOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="发件人邮箱" prop="from_email">
          <ElInput v-model="formData.from_email" placeholder="例如 no-reply@pixiu.io" />
        </ElFormItem>
        <ElFormItem label="发件人名称" prop="from_name">
          <ElInput v-model="formData.from_name" placeholder="发件人显示名称（可选）" />
        </ElFormItem>
        <ElFormItem label="启用" prop="enabled">
          <ElSwitch v-model="formData.enabled" />
        </ElFormItem>
        <ElFormItem label="设为默认" prop="is_default">
          <ElSwitch v-model="formData.is_default" />
        </ElFormItem>
        <ElFormItem label="描述" prop="description" class="email-description-item">
          <ElInput
            v-model="formData.description"
            type="textarea"
            :rows="3"
            placeholder="请输入描述（可选）"
          />
        </ElFormItem>
      </div>

      <!-- 编辑时密码已设置提示 -->
      <ElAlert
        v-if="dialogType === 'edit' && passwordSet"
        type="info"
        :closable="false"
        title="已设置密码，如需修改请在下方填写新密码；留空表示保持原密码不变"
        style="margin-bottom: 4px"
      />
    </ElForm>

    <!-- 发送测试邮件（仅编辑模式，需已保存的配置 ID） -->
    <template v-if="dialogType === 'edit' && hasId">
      <ElDivider content-position="left">发送测试邮件</ElDivider>
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px">
        <ElInput
          v-model="testTo"
          placeholder="输入收件人邮箱"
          style="width: 260px"
          @keyup.enter="handleTestSend"
        />
        <ElButton type="primary" plain :loading="testing" @click="handleTestSend">发送测试</ElButton>
      </div>
    </template>

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
  import {
    fetchTestSendEmail,
    type EmailConfigCreateParams,
    type EmailConfigItem
  } from '@/api/system-manage'

  interface Props {
    visible: boolean
    type: string
    emailData?: Partial<EmailConfigItem>
  }

  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'submit', data: EmailConfigCreateParams): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })

  const dialogType = computed(() => props.type)
  const hasId = computed(() => !!props.emailData?.id)
  const passwordSet = computed(() => !!props.emailData?.password_set)
  const passwordPlaceholder = computed(() =>
    dialogType.value === 'edit' ? '留空表示不修改密码' : '请输入 SMTP 认证密码'
  )

  const formRef = ref<FormInstance>()

  const encryptionOptions = [
    { label: '无加密', value: 'none' },
    { label: 'SSL', value: 'ssl' },
    { label: 'TLS', value: 'tls' },
    { label: 'STARTTLS', value: 'starttls' }
  ]

  const formData = reactive({
    name: '',
    smtp_host: '',
    smtp_port: 25,
    username: '',
    password: '',
    from_email: '',
    from_name: '',
    encryption: 'none',
    enabled: true,
    is_default: false,
    description: ''
  })

  const testTo = ref('')
  const testing = ref(false)

  const rules: FormRules = {
    name: [
      { required: true, message: '请输入配置名称', trigger: 'blur' },
      { min: 2, max: 100, message: '长度在 2 到 100 个字符', trigger: 'blur' }
    ],
    smtp_host: [{ required: true, message: '请输入 SMTP 服务器地址', trigger: 'blur' }],
    smtp_port: [{ required: true, message: '请输入 SMTP 端口', trigger: 'blur' }],
    from_email: [
      { required: true, message: '请输入发件人邮箱', trigger: 'blur' },
      { type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' }
    ]
  }

  const initFormData = () => {
    const isEdit = props.type === 'edit' && props.emailData
    const row = props.emailData

    Object.assign(formData, {
      name: isEdit && row ? row.name || '' : '',
      smtp_host: isEdit && row ? row.smtp_host || '' : '',
      smtp_port: isEdit && row && row.smtp_port ? row.smtp_port : 25,
      username: isEdit && row ? row.username || '' : '',
      // 密码不回显，编辑时留空表示不修改
      password: '',
      from_email: isEdit && row ? row.from_email || '' : '',
      from_name: isEdit && row ? row.from_name || '' : '',
      encryption: isEdit && row && row.encryption ? row.encryption : 'none',
      enabled: isEdit && row ? !!row.enabled : true,
      is_default: isEdit && row ? !!row.is_default : false,
      description: isEdit && row ? row.description || '' : ''
    })
    testTo.value = ''
  }

  watch(
    () => [props.visible, props.type, props.emailData],
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

  const handleSubmit = () => {
    if (!formRef.value) return

    formRef.value.validate((valid) => {
      if (!valid) return

      const data: EmailConfigCreateParams = {
        name: formData.name,
        smtp_host: formData.smtp_host,
        smtp_port: Number(formData.smtp_port),
        from_email: formData.from_email,
        from_name: formData.from_name || '',
        encryption: formData.encryption,
        enabled: formData.enabled,
        is_default: formData.is_default,
        description: formData.description || ''
      }
      if (formData.username) data.username = formData.username
      if (formData.password) data.password = formData.password
      emit('submit', data)
    })
  }

  const handleTestSend = async () => {
    const to = testTo.value.trim()
    if (!/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(to)) {
      ElMessage.error('请输入有效的收件人邮箱')
      return
    }
    if (!hasId.value || !props.emailData?.id) return

    testing.value = true
    try {
      await fetchTestSendEmail(props.emailData.id, to)
      ElMessage.success('测试邮件发送成功')
    } catch {
      // 错误提示由 HTTP 封装处理
    } finally {
      testing.value = false
    }
  }
</script>

<style scoped>
  .email-form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 12px;
    /* 直接作用在表单内容上，保证右侧留白一定生效 */
    padding-right: 35px;
    box-sizing: border-box;
  }

  .email-description-item {
    grid-column: 1 / -1;
  }

  /* Dialog teleport 到 body：用 :global 命中 body-class / footer-class */
  :global(.email-dialog-header) {
    padding: 16px 24px 12px 16px !important;
  }

  :global(.email-dialog-header .el-dialog__title) {
    font-size: 14px;
  }

  :global(.email-dialog-body) {
    padding: 12px 8px 16px 8px !important;
  }

  :global(.email-dialog-footer) {
    padding: 12px 35px 16px 16px !important;
  }

  :global(.email-dialog-body .el-form-item__label) {
    font-size: 12px !important;
    padding-right: 8px;
  }

  :global(.email-dialog-body .el-form-item__content) {
    max-width: none;
  }

  :global(.email-dialog-body .el-input),
  :global(.email-dialog-body .el-textarea),
  :global(.email-dialog-body .el-select),
  :global(.email-dialog-body .el-input-number),
  :global(.email-dialog-body .el-input__inner),
  :global(.email-dialog-body .el-textarea__inner),
  :global(.email-dialog-body .el-select__wrapper),
  :global(.email-dialog-body .el-input-number .el-input__inner) {
    font-size: 12px !important;
  }

  :global(.email-dialog-body .el-input__inner::placeholder),
  :global(.email-dialog-body .el-textarea__inner::placeholder),
  :global(.email-dialog-body .el-select__placeholder) {
    font-size: 12px !important;
  }
</style>

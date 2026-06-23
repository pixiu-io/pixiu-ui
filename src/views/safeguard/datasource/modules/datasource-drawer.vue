<!-- 数据源管理：添加/编辑抽屉 -->
<template>
  <ElDrawer
    v-model="visible"
    direction="rtl"
    size="50%"
    destroy-on-close
    :show-close="false"
    class="datasource-drawer"
  >
    <template #header>
      <div class="datasource-drawer-header">
        <span class="datasource-drawer-title">{{ isEdit ? '编辑数据源' : '添加数据源' }}</span>
        <ElButton text circle class="datasource-drawer-icon-btn" title="关闭" @click="closeDrawer">
          <ElIcon :size="16"><Close /></ElIcon>
        </ElButton>
      </div>
    </template>

    <div v-loading="editLoading" class="datasource-drawer-body">
      <ElForm :model="formData" :rules="rules" ref="formRef" label-width="100px" class="datasource-form">
        <ElFormItem label="名称" prop="name">
          <ElInput v-model="formData.name" placeholder="请输入数据源名称" />
        </ElFormItem>
        <ElFormItem label="集群" prop="cluster_name">
          <ElInput v-model="formData.cluster_name" placeholder="请输入集群名称" />
        </ElFormItem>
        <ElFormItem label="类型" prop="type">
          <ElSelect v-model="formData.type" placeholder="请选择类型" style="width: 100%" @change="onTypeChange">
            <ElOption label="日志" :value="0" />
            <ElOption label="告警" :value="1" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="数据来源" prop="sub_type">
          <ElSelect v-model="formData.sub_type" placeholder="请选择数据来源" style="width: 100%">
            <ElOption
              v-for="item in currentSubTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </ElSelect>
        </ElFormItem>
        <template v-if="formData.type === 0">
          <ElFormItem label="URL">
            <ElInput v-model="formData.config_log_url" placeholder="请输入日志数据源 URL" />
          </ElFormItem>
          <ElFormItem label="用户名">
            <ElInput v-model="formData.config_log_user_name" placeholder="请输入用户名" />
          </ElFormItem>
          <ElFormItem label="密码">
            <ElInput v-model="formData.config_log_password" type="password" placeholder="请输入密码" show-password />
          </ElFormItem>
        </template>
        <template v-if="formData.type === 1">
          <ElFormItem label="URL">
            <ElInput v-model="formData.config_alert_url" placeholder="请输入告警数据源 URL" />
          </ElFormItem>
        </template>
        <ElFormItem label="设为默认">
          <ElSwitch v-model="formData.is_default" />
        </ElFormItem>
        <ElFormItem label="描述">
          <ElInput v-model="formData.description" type="textarea" :rows="3" placeholder="请输入描述" />
        </ElFormItem>
      </ElForm>
    </div>

    <template #footer>
      <div class="datasource-drawer-footer">
        <ElButton @click="closeDrawer">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="handleSubmit">确定</ElButton>
      </div>
    </template>
  </ElDrawer>
</template>

<script setup lang="ts">
  import { Close } from '@element-plus/icons-vue'
  import { ElIcon, ElMessage, type FormInstance, type FormRules } from 'element-plus'
  import { computed, ref, watch } from 'vue'
  import {
    fetchCreateDatasource,
    fetchGetDatasource,
    fetchUpdateDatasource,
    type CreateDatasourceParams,
    type UpdateDatasourceParams,
    type DatasourceConfig
  } from '@/api/datasource'

  defineOptions({ name: 'DatasourceDrawer' })

  interface FormData {
  name: string
  cluster_name: string
  type: number
  sub_type: string
  config_log_url: string
  config_log_user_name: string
  config_log_password: string
  config_alert_url: string
  is_default: boolean
  description: string
}

  const props = defineProps<{
    editId?: number
  }>()

  const visible = defineModel<boolean>({ default: false })
  const emit = defineEmits<{
    success: []
  }>()

  const isEdit = computed(() => props.editId != null && props.editId > 0)
  const editLoading = ref(false)
  const submitting = ref(false)
  const formRef = ref<FormInstance>()
  const formData = ref<FormData>({
    name: '',
    cluster_name: '',
    type: 0,
    sub_type: '',
    config_log_url: '',
    config_log_user_name: '',
    config_log_password: '',
    config_alert_url: '',
    is_default: false,
    description: ''
  })
  const editResourceVersion = ref(0)

  const logSubTypes = [
    { value: 'loki', label: 'Loki' },
    { value: 'es', label: 'Elasticsearch' }
  ]
  const alertSubTypes = [
    { value: 'prometheus', label: 'Prometheus' }
  ]

  const currentSubTypeOptions = computed(() =>
    formData.value.type === 0 ? logSubTypes : alertSubTypes
  )

  function onTypeChange() {
    formData.value.sub_type = ''
  }

  const rules: FormRules = {
    name: [{ required: true, message: '请输入数据源名称', trigger: 'blur' }],
    type: [{ required: true, message: '请选择类型', trigger: 'change' }],
    sub_type: [{ required: true, message: '请选择数据来源', trigger: 'change' }]
  }

  watch(visible, (val) => {
    if (val) {
      resetForm()
      if (isEdit.value && props.editId) {
        loadEditData(props.editId)
      }
    }
  })

  function resetForm() {
    formData.value = {
      name: '',
      cluster_name: '',
      type: 0,
      sub_type: '',
      config_log_url: '',
      config_log_user_name: '',
      config_log_password: '',
      config_alert_url: '',
      is_default: false,
      description: ''
    }
    editResourceVersion.value = 0
  }

  function buildConfig(): DatasourceConfig | undefined {
    if (formData.value.type === 0) {
      if (!formData.value.config_log_url && !formData.value.config_log_user_name && !formData.value.config_log_password) {
        return undefined
      }
      return {
        log: {
          url: formData.value.config_log_url || undefined,
          user_name: formData.value.config_log_user_name || undefined,
          password: formData.value.config_log_password || undefined
        }
      }
    } else {
      if (!formData.value.config_alert_url) {
        return undefined
      }
      return {
        alert: {
          url: formData.value.config_alert_url || undefined
        }
      }
    }
  }

  function fillFormFromConfig(config?: DatasourceConfig) {
    if (config?.log) {
      formData.value.config_log_url = config.log.url || ''
      formData.value.config_log_user_name = config.log.user_name || ''
      formData.value.config_log_password = config.log.password || ''
    }
    if (config?.alert) {
      formData.value.config_alert_url = config.alert.url || ''
    }
  }

  async function loadEditData(id: number) {
    editLoading.value = true
    try {
      const data = await fetchGetDatasource(id)
      formData.value = {
        name: data.name,
        cluster_name: data.clusterName || '',
        type: data.type,
        sub_type: data.subType,
        config_log_url: '',
        config_log_user_name: '',
        config_log_password: '',
        config_alert_url: '',
        is_default: data.isDefault,
        description: data.description || ''
      }
      fillFormFromConfig(data.config)
      editResourceVersion.value = data.resourceVersion
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '获取数据失败')
      closeDrawer()
    } finally {
      editLoading.value = false
    }
  }

  function closeDrawer() {
    visible.value = false
  }

  async function handleSubmit() {
    if (!formRef.value) return
    await formRef.value.validate(async (valid) => {
      if (valid) {
        submitting.value = true
        try {
          if (isEdit.value && props.editId) {
            const params: UpdateDatasourceParams = {
              id: props.editId,
              resourceVersion: editResourceVersion.value,
              name: formData.value.name,
              sub_type: formData.value.sub_type,
              config: buildConfig(),
              is_default: formData.value.is_default,
              description: formData.value.description || undefined
            }
            await fetchUpdateDatasource(params)
            ElMessage.success('修改成功')
          } else {
            const params: CreateDatasourceParams = {
              name: formData.value.name,
              type: formData.value.type,
              sub_type: formData.value.sub_type,
              config: buildConfig(),
              is_default: formData.value.is_default,
              description: formData.value.description || undefined,
              cluster_name: formData.value.cluster_name || undefined
            }
            await fetchCreateDatasource(params)
            ElMessage.success('创建成功')
          }
          emit('success')
          closeDrawer()
        } catch (error) {
          ElMessage.error(error instanceof Error ? error.message : '操作失败')
        } finally {
          submitting.value = false
        }
      }
    })
  }
</script>

<style scoped lang="less">
  .datasource-drawer {
    :deep(.el-drawer__header) {
      margin-bottom: 0;
      padding: 20px 24px 12px;
    }
  }

  .datasource-drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .datasource-drawer-title {
    font-size: 16px;
    font-weight: 600;
  }

  .datasource-drawer-body {
    padding: 0 24px;
  }

  .datasource-form {
    padding-top: 12px;
  }

  .datasource-drawer-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
</style>

<!-- 数据源管理：添加/编辑抽屉 -->
<template>
  <ElDrawer
    v-model="visible"
    direction="rtl"
    size="55%"
    destroy-on-close
    :trap-focus="false"
    :show-close="false"
    class="datasource-drawer"
    body-class="datasource-drawer__body"
    footer-class="datasource-drawer__footer"
  >
    <template #header>
      <div class="datasource-drawer-header">
        <span class="datasource-drawer-title">{{ isEdit ? '编辑数据源' : '添加数据源' }}</span>
        <ElButton text circle class="datasource-drawer-icon-btn" title="关闭" @click="closeDrawer">
          <ElIcon :size="16"><Close /></ElIcon>
        </ElButton>
      </div>
    </template>

    <div v-loading="editLoading" class="datasource-drawer-content">
      <ElForm
        :model="formData"
        :rules="rules"
        ref="formRef"
        label-width="88px"
        class="datasource-form"
      >
        <ElFormItem label="名称" prop="name">
          <ElInput v-model="formData.name" placeholder="请输入数据源名称" />
        </ElFormItem>
        <ElFormItem label="集群" prop="cluster_name">
          <ElSelect
            v-if="clusterOptionList.length || clusterListLoading"
            v-model="formData.cluster_name"
            placeholder="请选择集群（可选）"
            style="width: 100%"
            clearable
            filterable
          >
            <ElOption
              v-for="item in clusterOptionList"
              :key="item.name"
              :label="item.aliasName || item.name"
              :value="item.name"
            />
          </ElSelect>
          <span v-else class="datasource-cluster-empty-hint">暂无可用集群</span>
        </ElFormItem>
        <ElFormItem label="类型" prop="type">
          <ElRadioGroup v-model="formData.type" class="sc-radio-group datasource-type-group" @change="onTypeChange">
            <ElRadioButton value="0">日志</ElRadioButton>
            <ElRadioButton value="1">告警</ElRadioButton>
          </ElRadioGroup>
        </ElFormItem>
        <ElFormItem label="数据来源" prop="sub_type">
          <ElSelect
            v-model="formData.sub_type"
            placeholder="请选择数据来源"
            style="width: 100%"
            popper-class="datasource-sub-type-popper"
          >
            <template v-if="selectedSubType" #prefix>
              <ArtSvgIcon
                :icon="selectedSubType.icon"
                class="datasource-sub-type-option__logo datasource-sub-type-option__logo--prefix"
                :style="{ color: selectedSubType.color }"
              />
            </template>
            <ElOption
              v-for="item in currentSubTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            >
              <div class="datasource-sub-type-option">
                <ArtSvgIcon
                  :icon="item.icon"
                  class="datasource-sub-type-option__logo"
                  :style="{ color: item.color }"
                />
                <span class="datasource-sub-type-option__name">{{ item.label }}</span>
              </div>
            </ElOption>
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="默认数据源">
          <ElSwitch v-model="formData.is_default" />
        </ElFormItem>
        <template v-if="formData.type === '0'">
          <ElFormItem label="URL" prop="config_log_url">
            <ElInput v-model="formData.config_log_url" placeholder="请输入日志数据源 URL" />
          </ElFormItem>
          <ElFormItem label="用户名">
            <ElInput v-model="formData.config_log_user_name" placeholder="请输入用户名" />
          </ElFormItem>
          <ElFormItem label="密码">
            <ElInput v-model="formData.config_log_password" type="password" placeholder="请输入密码" show-password />
          </ElFormItem>
        </template>
        <template v-if="formData.type === '1'">
          <ElFormItem label="URL" prop="config_alert_url">
            <ElInput v-model="formData.config_alert_url" placeholder="请输入告警数据源 URL" />
          </ElFormItem>
        </template>
        <ElFormItem label="描述">
          <ElInput v-model="formData.description" type="textarea" :rows="3" placeholder="请输入描述" />
        </ElFormItem>
      </ElForm>
    </div>

    <template #footer>
      <div class="datasource-drawer-footer">
        <div class="datasource-drawer-footer-left">
          <ElButton @click="handleTest">测试</ElButton>
        </div>
        <div class="datasource-drawer-footer-right">
          <ElButton @click="closeDrawer">取消</ElButton>
          <ElButton type="primary" :loading="submitting" @click="handleSubmit">确定</ElButton>
        </div>
      </div>
    </template>
  </ElDrawer>
</template>

<script setup lang="ts">
  import { Close } from '@element-plus/icons-vue'
  import { ElIcon, ElMessage, type FormInstance, type FormRules } from 'element-plus'
  import { computed, reactive, ref, watch } from 'vue'
  import {
    fetchCreateDatasource,
    fetchGetDatasource,
    fetchUpdateDatasource,
    type CreateDatasourcePayload,
    type DatasourceConfig,
    type DatasourceSubType,
    type DatasourceType,
    type UpdateDatasourcePayload
  } from '@/api/datasource'
  import { fetchClusterList, PixiuApiError, type ClusterItem } from '@/api/container'

  defineOptions({ name: 'DatasourceDrawer' })

  interface FormData {
    name: string
    cluster_name: string
    type: string
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
  const formData = reactive<FormData>({
    name: '',
    cluster_name: '',
    type: '0',
    sub_type: 'loki',
    config_log_url: '',
    config_log_user_name: '',
    config_log_password: '',
    config_alert_url: '',
    is_default: false,
    description: ''
  })
  const editResourceVersion = ref(0)
  const clusterList = ref<ClusterItem[]>([])
  const clusterListLoading = ref(false)
  let clusterLoadPromise: Promise<void> | null = null

  const clusterOptionList = computed(() => {
    const list = [...clusterList.value]
    const selected = formData.cluster_name
    if (selected && !list.some((item) => item.name === selected)) {
      list.unshift({
        id: 0,
        resourceVersion: 0,
        name: selected,
        aliasName: selected,
        clusterName: selected,
        version: '-',
        status: 0,
        clusterType: 0,
        planId: 0,
        nodeReady: 0,
        nodeNotReady: 0,
        nodeCount: 0,
        isProtected: false,
        permissionId: 0,
        createTime: '-'
      })
    }
    return list
  })

  function resolveClusterName(clusterName: string): string {
    if (!clusterName) return ''
    const byName = clusterList.value.find((item) => item.name === clusterName)
    if (byName) return byName.name
    const byAlias = clusterList.value.find(
      (item) => item.aliasName === clusterName || item.clusterName === clusterName
    )
    return byAlias?.name ?? clusterName
  }

  interface SubTypeOption {
    value: DatasourceSubType
    label: string
    icon: string
    color: string
  }

  const logSubTypes: SubTypeOption[] = [
    { value: 'loki', label: 'Loki', icon: 'simple-icons:grafana', color: '#F46800' },
    { value: 'es', label: 'Elasticsearch', icon: 'simple-icons:elasticsearch', color: '#005571' }
  ]
  const alertSubTypes: SubTypeOption[] = [
    { value: 'prometheus', label: 'Prometheus', icon: 'simple-icons:prometheus', color: '#E6522C' }
  ]

  const currentSubTypeOptions = computed(() =>
    formData.type === '0' ? logSubTypes : alertSubTypes
  )

  const selectedSubType = computed(() =>
    currentSubTypeOptions.value.find((item) => item.value === formData.sub_type)
  )

  function onTypeChange() {
    if (formData.type === '0') {
      formData.sub_type = logSubTypes[0].value
    } else if (formData.type === '1') {
      formData.sub_type = alertSubTypes[0].value
    }
  }

  const rules = computed<FormRules>(() => ({
    name: [{ required: true, message: '请输入数据源名称', trigger: 'blur' }],
    type: [{ required: true, message: '请选择类型', trigger: 'change' }],
    sub_type: [{ required: true, message: '请选择数据来源', trigger: 'change' }],
    config_log_url: formData.type === '0'
      ? [{ required: true, message: '请输入 URL', trigger: 'blur' }]
      : [],
    config_alert_url: formData.type === '1'
      ? [{ required: true, message: '请输入 URL', trigger: 'blur' }]
      : []
  }))

  async function loadClusters() {
    if (clusterLoadPromise) return clusterLoadPromise
    clusterListLoading.value = true
    clusterLoadPromise = (async () => {
      try {
        const limit = 500
        let page = 1
        const acc: ClusterItem[] = []
        let total = 0
        do {
          const res = await fetchClusterList({ page, limit })
          total = res.total
          acc.push(...(res.items ?? []))
          if (acc.length >= total || res.items.length === 0) break
          page++
          if (page > 40) break
        } while (true)
        clusterList.value = acc
        if (formData.cluster_name) {
          formData.cluster_name = resolveClusterName(formData.cluster_name)
        }
      } catch {
        clusterList.value = []
      } finally {
        clusterListLoading.value = false
        clusterLoadPromise = null
      }
    })()
    return clusterLoadPromise
  }

  watch(
    visible,
    async (val) => {
      if (val) {
        resetForm()
        await loadClusters()
        if (isEdit.value && props.editId) {
          await loadEditData(props.editId)
        }
      } else {
        clusterLoadPromise = null
      }
    },
    { immediate: true }
  )

  function resetForm() {
    Object.assign(formData, {
      name: '',
      cluster_name: '',
      type: '0',
      sub_type: logSubTypes[0].value,
      config_log_url: '',
      config_log_user_name: '',
      config_log_password: '',
      config_alert_url: '',
      is_default: false,
      description: ''
    })
    editResourceVersion.value = 0
  }

  function resolveFormUrl(): string {
    if (formData.type === '0') {
      return formData.config_log_url.trim()
    }
    return formData.config_alert_url.trim()
  }

  function buildConfig(): CreateDatasourcePayload['config'] {
    if (formData.type === '0') {
      return {
        headers: [],
        log: {
          url: formData.config_log_url || undefined,
          userName: formData.config_log_user_name || undefined,
          password: formData.config_log_password || undefined
        }
      }
    }
    return {
      headers: [],
      alert: {
        url: formData.config_alert_url || undefined
      }
    }
  }

  function fillFormFromConfig(config: DatasourceConfig) {
    if (config.log) {
      formData.config_log_url = config.log.url || ''
      formData.config_log_user_name = config.log.userName || ''
      formData.config_log_password = config.log.password || ''
    }
    if (config.alert) {
      formData.config_alert_url = config.alert.url || ''
    }
  }

  async function loadEditData(id: number) {
    editLoading.value = true
    try {
      const data = await fetchGetDatasource(id)
      Object.assign(formData, {
        name: data.name,
        cluster_name: resolveClusterName(data.clusterName || ''),
        type: String(data.type),
        sub_type: data.subType,
        config_log_url: '',
        config_log_user_name: '',
        config_log_password: '',
        config_alert_url: '',
        is_default: data.isDefault,
        description: data.description || ''
      })
      fillFormFromConfig(data.config)
      editResourceVersion.value = data.resourceVersion
    } catch (error) {
      if (!(error instanceof PixiuApiError) || !error.notified) {
        ElMessage.error(error instanceof Error ? error.message : '获取数据失败')
      }
      closeDrawer()
    } finally {
      editLoading.value = false
    }
  }

  function closeDrawer() {
    visible.value = false
  }

  function handleTest() {
    ElMessage.info('功能开发中')
  }

  async function handleSubmit() {
    if (!formRef.value) return
    await formRef.value.validate(async (valid) => {
      if (valid) {
        submitting.value = true
        try {
          const url = resolveFormUrl()
          const type = Number(formData.type) as DatasourceType
          const subType = formData.sub_type as DatasourceSubType
          const config = buildConfig()

          if (isEdit.value && props.editId) {
            const payload: UpdateDatasourcePayload = {
              id: props.editId,
              resourceVersion: editResourceVersion.value,
              clusterName: formData.cluster_name || undefined,
              name: formData.name,
              type,
              subType,
              url,
              config,
              isDefault: formData.is_default,
              description: formData.description || undefined
            }
            await fetchUpdateDatasource(payload)
            ElMessage.success('修改成功')
          } else {
            const payload: CreateDatasourcePayload = {
              clusterName: formData.cluster_name || '',
              name: formData.name,
              type,
              subType,
              url,
              config,
              isDefault: formData.is_default,
              description: formData.description || ''
            }
            await fetchCreateDatasource(payload)
            ElMessage.success('创建成功')
          }
          emit('success')
          closeDrawer()
        } catch (error) {
          if (!(error instanceof PixiuApiError) || !error.notified) {
            ElMessage.error(error instanceof Error ? error.message : '操作失败')
          }
        } finally {
          submitting.value = false
        }
      }
    })
  }
</script>

<style scoped lang="less">
  .datasource-form {
    padding-top: 12px;
    font-size: 12px;

    :deep(.el-form-item__label) {
      font-size: 12px;
    }

    :deep(.el-input__inner),
    :deep(.el-textarea__inner) {
      font-size: 12px;
    }

    :deep(.el-input__inner::placeholder),
    :deep(.el-textarea__inner::placeholder) {
      font-size: 12px;
    }

    :deep(.el-select__placeholder),
    :deep(.el-select__selected-item) {
      font-size: 12px;
    }

    :deep(.el-select-dropdown__item) {
      font-size: 12px;
    }

    :deep(.el-select__wrapper) {
      align-items: center;
    }
  }

  .datasource-cluster-empty-hint {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .datasource-form :deep(.el-select__prefix) {
    display: inline-flex;
    align-items: center;
  }

  .datasource-form :deep(.sc-radio-group.el-radio-group) {
    margin-top: 2px;
  }

  .datasource-form :deep(.datasource-type-group.sc-radio-group.el-radio-group) {
    min-width: 180px;
    width: 180px;
    max-width: 180px;
  }

  .datasource-form :deep(.datasource-type-group .el-radio-button__inner) {
    padding-left: 10px !important;
    padding-right: 10px !important;
  }

  .datasource-form :deep(.sc-radio-group .el-radio-button__inner) {
    font-size: 12px;
  }

  .datasource-sub-type-option__logo--prefix {
    margin-right: 0;
  }

  .datasource-drawer-footer {
    display: flex;
    justify-content: space-between;
    gap: 12px;

    :deep(.el-button) {
      font-size: 12px;
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

  .datasource-sub-type-option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 22px;
    line-height: 22px;
    pointer-events: none;
  }

  .datasource-sub-type-option__logo {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    font-size: 16px;
  }

  .datasource-sub-type-option__logo :deep(svg) {
    color: inherit;
  }

  .datasource-sub-type-option__name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
  }
</style>

<style lang="less">
  .datasource-drawer.el-drawer {
    .el-drawer__header {
      margin-bottom: 0;
      padding: 20px 40px 12px 20px !important;
    }

    .datasource-drawer__body {
      padding: 0 40px 0 11px !important;
      overflow: visible;
    }

    .datasource-drawer__footer {
      padding: 12px 40px 16px 40px !important;
    }
  }

  .datasource-sub-type-popper.el-select__popper:not(.el-tree-select__popper) {
    .el-select-dropdown__list {
      padding: 5px !important;

      .el-select-dropdown__item {
        height: 34px !important;
        line-height: 1 !important;
        padding: 0 12px !important;
        display: flex !important;
        align-items: center !important;
        box-sizing: border-box;

        &.is-selected {
          margin-bottom: 0 !important;
        }
      }
    }
  }
</style>

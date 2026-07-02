<!-- 数据源管理：添加/编辑对话框 -->
<template>
  <ElDialog
    v-model="visible"
    :title="isEdit ? '编辑数据源' : '添加数据源'"
    width="760px"
    destroy-on-close
    class="datasource-dialog"
    @closed="resetForm"
  >
    <div v-loading="editLoading">
      <ElForm
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-width="88px"
        class="datasource-create-form"
      >
        <section class="datasource-form-section">
          <div class="datasource-form-section__title">基础信息</div>

          <ElRow :gutter="16">
            <ElCol :span="12">
              <ElFormItem label="名称" prop="name">
                <ElInput v-model="formData.name" maxlength="64" show-word-limit placeholder="请输入数据源名称" />
              </ElFormItem>
            </ElCol>

            <ElCol :span="12">
              <ElFormItem label="关联集群">
                <ElSelect
                  v-if="clusterOptionList.length || clusterListLoading"
                  v-model="formData.cluster_name"
                  placeholder="请选择集群（可选）"
                  class="w-full"
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
            </ElCol>

            <ElCol :span="12">
              <ElFormItem label="类型" prop="type">
                <ElSelect v-model="formData.type" class="w-full" @change="onTypeChange">
                  <ElOption label="日志" :value="0" />
                  <ElOption label="告警" :value="1" disabled />
                </ElSelect>
              </ElFormItem>
            </ElCol>

            <ElCol :span="12">
              <ElFormItem label="数据来源" prop="sub_type">
                <ElSelect
                  v-model="formData.sub_type"
                  class="w-full datasource-sub-type-select"
                  placeholder="请选择数据来源"
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
                    :disabled="item.disabled"
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
            </ElCol>

            <ElCol :span="12">
              <ElFormItem label="默认数据源">
                <ElSwitch v-model="formData.is_default" />
              </ElFormItem>
            </ElCol>
          </ElRow>

          <ElFormItem label="接入地址" prop="url">
            <ElInput
              v-model="formData.url"
              placeholder="请输入接入地址，如: http://xx.example.com"
            />
          </ElFormItem>

          <ElFormItem label="描述">
            <ElInput
              v-model="formData.description"
              type="textarea"
              :rows="3"
              maxlength="200"
              show-word-limit
              placeholder="请输入描述"
            />
          </ElFormItem>
        </section>

        <section class="datasource-form-section datasource-form-section--advanced">
          <div class="datasource-form-section__title">高级配置</div>

          <ElCollapse v-model="advancedPanels" class="datasource-advanced-collapse">
            <ElCollapseItem
              name="auth"
              class="datasource-advanced-collapse__item"
            >
              <template #title>
                <div class="datasource-advanced-collapse__title">
                  <span>鉴权</span>
                  <span class="datasource-advanced-collapse__hint">需要时再填写用户名和密码</span>
                </div>
              </template>

              <ElRow :gutter="16">
                <ElCol :span="12">
                  <ElFormItem label="用户名">
                    <ElInput
                      v-if="formData.type === 0"
                      v-model="formData.log.userName"
                      placeholder="可选，用于基础认证"
                    />
                    <ElInput
                      v-else
                      v-model="formData.alert.userName"
                      placeholder="可选，用于基础认证"
                    />
                  </ElFormItem>
                </ElCol>

                <ElCol :span="12">
                  <ElFormItem label="密码">
                    <ElInput
                      v-if="formData.type === 0"
                      v-model="formData.log.password"
                      type="password"
                      show-password
                      placeholder="可选，用于基础认证"
                    />
                    <ElInput
                      v-else
                      v-model="formData.alert.password"
                      type="password"
                      show-password
                      placeholder="可选，用于基础认证"
                    />
                  </ElFormItem>
                </ElCol>
              </ElRow>
            </ElCollapseItem>

            <ElCollapseItem name="headers" class="datasource-advanced-collapse__item">
              <template #title>
                <div class="datasource-advanced-collapse__title">
                  <span>自定义请求头</span>
                  <span class="datasource-advanced-collapse__hint">需要时再补充额外 Header</span>
                </div>
              </template>

              <div class="datasource-form-section__head datasource-form-section__head--inner">
                <div class="datasource-form-section__summary">
                  已填写 {{ filledHeaderCount }} 个请求头
                </div>
                <ElButton text type="primary" @click="addHeader">
                  <ElIcon><Plus /></ElIcon>
                  新增请求头
                </ElButton>
              </div>

              <div class="datasource-headers-panel">
                <div
                  v-for="(header, index) in formData.headers"
                  :key="`header-${index}`"
                  class="datasource-headers__row"
                >
                  <ElInput v-model="header.key" placeholder="Key" />
                  <ElInput v-model="header.value" placeholder="Value" />
                  <ElButton text type="danger" @click="removeHeader(index)">移除</ElButton>
                </div>
              </div>
            </ElCollapseItem>
          </ElCollapse>
        </section>
      </ElForm>
    </div>

    <template #footer>
      <div class="datasource-dialog__footer">
        <ElButton @click="handleTest">测试</ElButton>
        <div class="datasource-dialog__footer-actions">
          <ElButton @click="closeDialog">取消</ElButton>
          <ElButton type="primary" :loading="submitting" @click="handleSubmit">
            {{ isEdit ? '保存' : '创建' }}
          </ElButton>
        </div>
      </div>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { Plus } from '@element-plus/icons-vue'
  import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
  import { computed, reactive, ref, watch } from 'vue'
  import {
    fetchCreateDatasource,
    fetchGetDatasource,
    fetchUpdateDatasource,
    resolveDatasourceUrl,
    type CreateDatasourcePayload,
    type DatasourceConfig,
    type DatasourceSubType,
    type DatasourceType,
    type UpdateDatasourcePayload
  } from '@/api/datasource'
  import { fetchClusterList, PixiuApiError, type ClusterItem } from '@/api/container'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'

  defineOptions({ name: 'DatasourceDialog' })

  interface SubTypeOption {
    value: DatasourceSubType
    label: string
    icon: string
    color: string
    disabled?: boolean
  }

  const logSubTypes: SubTypeOption[] = [
    { value: 'loki', label: 'Loki', icon: 'simple-icons:grafana', color: '#F46800' },
    { value: 'es', label: 'Elasticsearch', icon: 'simple-icons:elasticsearch', color: '#005571' }
  ]
  const alertSubTypes: SubTypeOption[] = [
    {
      value: 'prometheus',
      label: 'Prometheus',
      icon: 'simple-icons:prometheus',
      color: '#E6522C',
      disabled: true
    }
  ]

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
  const advancedPanels = ref<string[]>([])
  const editResourceVersion = ref(0)
  const clusterList = ref<ClusterItem[]>([])
  const clusterListLoading = ref(false)
  let clusterLoadPromise: Promise<void> | null = null

  const formData = reactive({
    name: '',
    cluster_name: '',
    type: 0 as DatasourceType,
    sub_type: 'loki' as DatasourceSubType,
    url: '',
    description: '',
    is_default: false,
    log: {
      userName: '',
      password: ''
    },
    alert: {
      userName: '',
      password: ''
    },
    headers: [{ key: '', value: '' }]
  })

  const rules: FormRules = {
    name: [{ required: true, message: '请输入数据源名称', trigger: 'blur' }],
    type: [{ required: true, message: '请选择类型', trigger: 'change' }],
    sub_type: [{ required: true, message: '请选择数据来源', trigger: 'change' }],
    url: [{ required: true, message: '请输入接入地址', trigger: 'blur' }]
  }

  const currentSubTypeOptions = computed(() =>
    formData.type === 0 ? logSubTypes : alertSubTypes
  )

  const selectedSubType = computed(() =>
    currentSubTypeOptions.value.find((item) => item.value === formData.sub_type)
  )

  const filledHeaderCount = computed(
    () => formData.headers.filter((item) => item.key.trim() || item.value.trim()).length
  )

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

  function onTypeChange() {
    formData.sub_type = currentSubTypeOptions.value[0]?.value ?? 'loki'
  }

  function addHeader() {
    if (!advancedPanels.value.includes('headers')) {
      advancedPanels.value = [...advancedPanels.value, 'headers']
    }
    formData.headers.push({ key: '', value: '' })
  }

  function removeHeader(index: number) {
    if (formData.headers.length === 1) {
      formData.headers[0] = { key: '', value: '' }
      return
    }
    formData.headers.splice(index, 1)
  }

  function buildConfig(): CreateDatasourcePayload['config'] {
    const headers = formData.headers
      .map((item) => ({ key: item.key.trim(), value: item.value.trim() }))
      .filter((item) => item.key || item.value)
    const url = formData.url.trim()

    if (formData.type === 0) {
      return {
        headers,
        log: {
          url,
          userName: formData.log.userName.trim() || undefined,
          password: formData.log.password.trim() || undefined
        }
      }
    }

    return {
      headers,
      alert: {
        url,
        userName: formData.alert.userName.trim() || undefined,
        password: formData.alert.password.trim() || undefined
      }
    }
  }

  function fillFormFromConfig(config: DatasourceConfig) {
    formData.url = resolveDatasourceUrl({ config })
    formData.log.userName = config.log?.userName || ''
    formData.log.password = config.log?.password || ''
    formData.alert.userName = config.alert?.userName || ''
    formData.alert.password = config.alert?.password || ''
    formData.headers = config.headers?.length
      ? config.headers.map((item) => ({ key: item.key, value: item.value }))
      : [{ key: '', value: '' }]
  }

  function hasAuthData(): boolean {
    if (formData.type === 0) {
      return Boolean(formData.log.userName.trim() || formData.log.password.trim())
    }
    return Boolean(formData.alert.userName.trim() || formData.alert.password.trim())
  }

  function hasHeaderData(): boolean {
    return formData.headers.some((item) => item.key.trim() || item.value.trim())
  }

  function syncAdvancedPanelsFromForm() {
    const panels: string[] = []
    if (hasAuthData()) panels.push('auth')
    if (hasHeaderData()) panels.push('headers')
    advancedPanels.value = panels
  }

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
        advancedPanels.value = []
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
    formRef.value?.resetFields()
    Object.assign(formData, {
      name: '',
      cluster_name: '',
      type: 0,
      sub_type: 'loki',
      url: '',
      description: '',
      is_default: false,
      log: { userName: '', password: '' },
      alert: { userName: '', password: '' },
      headers: [{ key: '', value: '' }]
    })
    editResourceVersion.value = 0
    advancedPanels.value = []
  }

  async function loadEditData(id: number) {
    editLoading.value = true
    try {
      const data = await fetchGetDatasource(id)
      Object.assign(formData, {
        name: data.name,
        cluster_name: resolveClusterName(data.clusterName || ''),
        type: data.type,
        sub_type: data.subType,
        url: '',
        description: data.description || '',
        is_default: data.isDefault,
        log: { userName: '', password: '' },
        alert: { userName: '', password: '' },
        headers: [{ key: '', value: '' }]
      })
      fillFormFromConfig(data.config)
      syncAdvancedPanelsFromForm()
      editResourceVersion.value = data.resourceVersion
    } catch (error) {
      if (!(error instanceof PixiuApiError) || !error.notified) {
        ElMessage.error(error instanceof Error ? error.message : '获取数据失败')
      }
      closeDialog()
    } finally {
      editLoading.value = false
    }
  }

  function closeDialog() {
    visible.value = false
  }

  function handleTest() {
    ElMessage.info('功能开发中')
  }

  async function handleSubmit() {
    if (!formRef.value) return
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return

    submitting.value = true
    try {
      const url = formData.url.trim()
      const config = buildConfig()

      if (isEdit.value && props.editId) {
        const payload: UpdateDatasourcePayload = {
          id: props.editId,
          resourceVersion: editResourceVersion.value,
          clusterName: formData.cluster_name || undefined,
          name: formData.name,
          type: formData.type,
          subType: formData.sub_type,
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
          type: formData.type,
          subType: formData.sub_type,
          url,
          config,
          isDefault: formData.is_default,
          description: formData.description || ''
        }
        await fetchCreateDatasource(payload)
        ElMessage.success('创建成功')
      }
      emit('success')
      closeDialog()
    } catch (error) {
      if (!(error instanceof PixiuApiError) || !error.notified) {
        ElMessage.error(error instanceof Error ? error.message : '操作失败')
      }
    } finally {
      submitting.value = false
    }
  }
</script>

<style scoped lang="less">
  .datasource-create-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 12px;
    padding-top: 0;

    :deep(.el-form-item__label) {
      font-size: 12px;
      color: var(--el-text-color-regular);
    }

    :deep(.el-input__inner),
    :deep(.el-textarea__inner),
    :deep(.el-select__wrapper),
    :deep(.el-select__selected-item),
    :deep(.el-select__placeholder),
    :deep(.el-input__wrapper) {
      font-size: 12px;
    }

    :deep(.el-input__inner::placeholder),
    :deep(.el-textarea__inner::placeholder),
    :deep(.el-input__wrapper input::placeholder),
    :deep(.el-textarea__wrapper textarea::placeholder) {
      font-size: 12px !important;
      opacity: 1;
    }

    :deep(.el-select-dropdown__item) {
      font-size: 12px;
    }

    :deep(.el-button) {
      font-size: 12px;
    }

    :deep(.el-select__prefix) {
      display: inline-flex;
      align-items: center;
    }
  }

  .datasource-sub-type-option__logo--prefix {
    margin-right: 0;
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

  .datasource-cluster-empty-hint {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .datasource-form-section {
    padding: 12px 18px 8px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 12px;
    background: var(--el-fill-color-blank);
  }

  .datasource-form-section--advanced {
    padding-bottom: 4px;
  }

  .datasource-form-section__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .datasource-form-section__head--inner {
    margin-bottom: 10px;
  }

  .datasource-form-section__title {
    margin-bottom: 8px;
    color: var(--el-text-color-primary);
    font-size: 14px;
    font-weight: 700;
  }

  .datasource-form-section__summary {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .datasource-advanced-collapse {
    border-top: 0;
    border-bottom: 0;
  }

  .datasource-advanced-collapse :deep(.el-collapse-item__header) {
    height: auto;
    min-height: 52px;
    padding: 0 2px;
    border-bottom-color: var(--el-border-color-lighter);
    background: transparent;
    color: var(--el-text-color-primary);
    line-height: 1.4;
  }

  .datasource-advanced-collapse :deep(.el-collapse-item__wrap) {
    border-bottom: 0;
    background: transparent;
  }

  .datasource-advanced-collapse :deep(.el-collapse-item:last-child .el-collapse-item__header) {
    border-bottom: 0;
  }

  .datasource-advanced-collapse :deep(.el-collapse-item__content) {
    padding: 12px 2px 8px;
  }

  .datasource-advanced-collapse__title {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 0;
    color: var(--el-text-color-primary);
  }

  .datasource-advanced-collapse__hint {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    font-weight: 400;
  }

  .datasource-headers-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .datasource-headers__row {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 12px;
    align-items: center;
  }

  .datasource-dialog__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .datasource-dialog__footer-actions {
    display: flex;
    gap: 12px;
  }

  :global(html:not(.dark)) .datasource-form-section {
    border-color: #e6edf5;
    background: linear-gradient(180deg, #fff 0%, #f8fbff 100%);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 90%);
  }

  :global(html.dark) .datasource-form-section {
    border-color: var(--el-border-color);
    background: var(--art-gray-200);
  }
</style>

<style lang="less">
  .datasource-dialog {
    .el-dialog__header {
      padding-top: 16px;
      padding-bottom: 8px;
      margin-bottom: 0;
    }

    .el-dialog__title {
      font-size: 16px;
      color: var(--el-text-color-primary);
    }

    .el-dialog__body {
      padding-top: 0;
      padding-bottom: 16px;
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

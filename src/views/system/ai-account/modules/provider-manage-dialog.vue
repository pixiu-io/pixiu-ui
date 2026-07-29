<template>
  <ElDialog v-model="dialogVisible" title="Provider 管理" width="860px" align-center>
    <div class="provider-toolbar">
      <ElButton type="primary" @click="openForm()">新增自定义 Provider</ElButton>
      <span class="provider-tip">内置 Provider 由系统维护，不允许编辑或删除</span>
    </div>

    <ElTable v-loading="loading" :data="providers" border max-height="440">
      <ElTableColumn prop="name" label="名称" min-width="120" />
      <ElTableColumn prop="protocol" label="协议" min-width="140" />
      <ElTableColumn prop="baseUrl" label="Base URL" min-width="230" show-overflow-tooltip />
      <ElTableColumn label="类型" width="90">
        <template #default="{ row }">
          <ElTag :type="row.builtin ? 'info' : 'success'" size="small">
            {{ row.builtin ? '内置' : '自定义' }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="操作" width="130" fixed="right">
        <template #default="{ row }">
          <template v-if="!row.builtin">
            <ElButton link type="primary" @click="openForm(row)">编辑</ElButton>
            <ElButton link type="danger" @click="removeProvider(row)">删除</ElButton>
          </template>
          <span v-else class="readonly-text">只读</span>
        </template>
      </ElTableColumn>
    </ElTable>

    <ElDialog
      v-model="formVisible"
      :title="editingProvider ? '编辑自定义 Provider' : '新增自定义 Provider'"
      width="560px"
      append-to-body
      align-center
    >
      <ElForm ref="formRef" :model="formData" :rules="rules" label-width="100px">
        <ElFormItem label="名称" prop="name">
          <ElInput v-model="formData.name" placeholder="例如 new-api" />
        </ElFormItem>
        <ElFormItem label="协议" prop="protocol">
          <ElSelect v-model="formData.protocol" style="width: 100%">
            <ElOption label="OpenAI Chat Completions" value="openai_chat" />
            <ElOption label="OpenAI Responses" value="openai_responses" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="Base URL" prop="baseUrl">
          <ElInput v-model="formData.baseUrl" placeholder="例如 https://api.example.com/v1" />
        </ElFormItem>
        <ElFormItem label="最大 Token" prop="maxTokens">
          <ElInputNumber v-model="formData.maxTokens" :min="1" :max="200000" />
        </ElFormItem>
        <ElFormItem label="说明" prop="description">
          <ElInput v-model="formData.description" type="textarea" :rows="3" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="formVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submitForm">保存</ElButton>
      </template>
    </ElDialog>
  </ElDialog>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    fetchCreateAIProvider,
    fetchDeleteAIProvider,
    fetchGetAIProviderList,
    fetchUpdateAIProvider
  } from '@/api/ai-account'

  const props = defineProps<{ visible: boolean }>()
  const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void
    (e: 'changed'): void
  }>()

  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })
  const providers = ref<Api.SystemManage.AIProviderListItem[]>([])
  const loading = ref(false)
  const submitting = ref(false)
  const formVisible = ref(false)
  const formRef = ref<FormInstance>()
  const editingProvider = ref<Api.SystemManage.AIProviderListItem | null>(null)
  const formData = reactive({
    name: '',
    protocol: 'openai_chat',
    baseUrl: '',
    maxTokens: 4096,
    description: ''
  })
  const rules: FormRules = {
    name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
    protocol: [{ required: true, message: '请选择协议', trigger: 'change' }],
    baseUrl: [{ required: true, message: '请输入 Base URL', trigger: 'blur' }]
  }

  async function loadProviders() {
    loading.value = true
    try {
      providers.value = await fetchGetAIProviderList()
    } finally {
      loading.value = false
    }
  }

  function openForm(row?: unknown) {
    const provider = row as Api.SystemManage.AIProviderListItem | undefined
    editingProvider.value = provider || null
    Object.assign(formData, {
      name: provider?.name || '',
      protocol: provider?.protocol || 'openai_chat',
      baseUrl: provider?.baseUrl || '',
      maxTokens: provider?.maxTokens || 4096,
      description: provider?.description || ''
    })
    formVisible.value = true
    nextTick(() => formRef.value?.clearValidate())
  }

  async function submitForm() {
    if (!formRef.value || !(await formRef.value.validate())) return
    submitting.value = true
    try {
      if (editingProvider.value) {
        await fetchUpdateAIProvider({
          id: editingProvider.value.id,
          resourceVersion: editingProvider.value.resourceVersion,
          ...formData
        })
      } else {
        await fetchCreateAIProvider(formData)
      }
      ElMessage.success('保存成功')
      formVisible.value = false
      await loadProviders()
      emit('changed')
    } finally {
      submitting.value = false
    }
  }

  async function removeProvider(row: unknown) {
    const provider = row as Api.SystemManage.AIProviderListItem
    await ElMessageBox.confirm(`确认删除自定义 Provider“${provider.name}”吗？`, '删除 Provider', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    await fetchDeleteAIProvider(provider.id)
    ElMessage.success('删除成功')
    await loadProviders()
    emit('changed')
  }

  watch(
    () => props.visible,
    (visible) => {
      if (visible) void loadProviders()
    }
  )
</script>

<style scoped>
  .provider-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .provider-tip,
  .readonly-text {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
</style>

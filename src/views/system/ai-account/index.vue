<template>
  <div class="ai-config-page art-full-height">
    <ElCard>
      <ElTabs v-model="activeTab" @tab-change="handleTabChange">
        <ElTabPane label="供应商" name="providers">
          <div class="toolbar">
            <ElButton type="primary" @click="showProviderDialog('add')">新增供应商</ElButton>
            <ElInput
              v-model="providerSearch"
              clearable
              placeholder="搜索供应商"
              @keyup.enter="loadProviders"
              @clear="loadProviders"
            />
          </div>
          <ElTable v-loading="providerLoading" :data="providers" height="calc(100vh - 270px)">
            <ElTableColumn prop="name" label="唯一标识" min-width="130" />
            <ElTableColumn label="类型" width="90">
              <template #default="{ row }">
                <ElTag v-if="row.builtin" size="small" type="info">内置</ElTag>
                <ElTag v-else size="small" type="success">自定义</ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn prop="baseUrl" label="Base URL" min-width="240" show-overflow-tooltip />
            <ElTableColumn prop="protocol" label="协议" min-width="160" />
            <ElTableColumn prop="maxTokens" label="最大 Token" width="120" />
            <ElTableColumn prop="description" label="说明" min-width="180" show-overflow-tooltip />
            <ElTableColumn label="操作" width="140" fixed="right">
              <template #default="{ row }">
                <ElButton
                  link
                  type="primary"
                  :disabled="row.builtin"
                  @click="showProviderDialog('edit', row)"
                  >编辑</ElButton
                >
                <ElButton link type="danger" :disabled="row.builtin" @click="deleteProvider(row)"
                  >删除</ElButton
                >
              </template>
            </ElTableColumn>
          </ElTable>
          <ElPagination
            v-model:current-page="providerPage"
            v-model:page-size="providerPageSize"
            :total="providerTotal"
            layout="total, sizes, prev, pager, next"
            @current-change="loadProviders"
            @size-change="handleProviderPageSize"
          />
        </ElTabPane>

        <ElTabPane label="我的账号" name="accounts">
          <div class="toolbar">
            <ElButton
              type="primary"
              :disabled="providerOptions.length === 0"
              @click="showAccountDialog('add')"
              >新增账号</ElButton
            >
            <div class="filters">
              <ElSelect
                v-model="accountProviderId"
                clearable
                placeholder="全部供应商"
                @change="loadAccounts"
              >
                <ElOption
                  v-for="item in providerOptions"
                  :key="item.id"
                  :label="item.name"
                  :value="item.id"
                />
              </ElSelect>
              <ElInput
                v-model="accountSearch"
                clearable
                placeholder="搜索账号名称"
                @keyup.enter="loadAccounts"
                @clear="loadAccounts"
              />
            </div>
          </div>
          <ElAlert
            v-if="providerOptions.length === 0"
            type="warning"
            show-icon
            :closable="false"
            title="请先创建供应商，再创建 AI 账号"
          />
          <ElTable v-loading="accountLoading" :data="accounts" height="calc(100vh - 270px)">
            <ElTableColumn prop="name" label="账号名称" min-width="150" />
            <ElTableColumn label="供应商" min-width="130">
              <template #default="{ row }">{{ providerName(row.providerId) }}</template>
            </ElTableColumn>
            <ElTableColumn prop="model" label="模型" min-width="180" />
            <ElTableColumn prop="apiKey" label="API Key" min-width="150" />
            <ElTableColumn prop="createTime" label="创建时间" width="170" />
            <ElTableColumn label="操作" width="140" fixed="right">
              <template #default="{ row }">
                <ElButton link type="primary" @click="showAccountDialog('edit', row)"
                  >编辑</ElButton
                >
                <ElButton link type="danger" @click="deleteAccount(row)">删除</ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
          <ElPagination
            v-model:current-page="accountPage"
            v-model:page-size="accountPageSize"
            :total="accountTotal"
            layout="total, sizes, prev, pager, next"
            @current-change="loadAccounts"
            @size-change="handleAccountPageSize"
          />
        </ElTabPane>
      </ElTabs>
    </ElCard>

    <AIProviderDialog
      v-model:visible="providerDialogVisible"
      :type="dialogType"
      :provider-data="currentProvider"
      @submit="submitProvider"
    />
    <AIAccountDialog
      v-model:visible="accountDialogVisible"
      :type="dialogType"
      :account-data="currentAccount"
      :providers="providerOptions"
      @submit="submitAccount"
    />
  </div>
</template>

<script setup lang="ts">
  import { ElMessage, ElMessageBox } from 'element-plus'
  import type { DialogType } from '@/types'
  import {
    fetchCreateAIAccount,
    fetchCreateAIProvider,
    fetchDeleteAIAccount,
    fetchDeleteAIProvider,
    fetchGetAIAccountList,
    fetchGetAIProviderList,
    fetchUpdateAIAccount,
    fetchUpdateAIProvider
  } from '@/api/ai-account'
  import AIAccountDialog from './modules/ai-account-dialog.vue'
  import AIProviderDialog from './modules/ai-provider-dialog.vue'

  defineOptions({ name: 'AiAccount' })
  type Provider = Api.SystemManage.AIProviderListItem
  type Account = Api.SystemManage.AIAccountListItem

  const activeTab = ref('providers')
  const dialogType = ref<DialogType>('add')
  const providers = ref<Provider[]>([])
  const providerOptions = ref<Provider[]>([])
  const accounts = ref<Account[]>([])
  const providerLoading = ref(false)
  const accountLoading = ref(false)
  const providerSearch = ref('')
  const accountSearch = ref('')
  const accountProviderId = ref<number>()
  const providerPage = ref(1)
  const providerPageSize = ref(10)
  const providerTotal = ref(0)
  const accountPage = ref(1)
  const accountPageSize = ref(10)
  const accountTotal = ref(0)
  const providerDialogVisible = ref(false)
  const accountDialogVisible = ref(false)
  const currentProvider = ref<Partial<Provider>>({})
  const currentAccount = ref<Partial<Account>>({})

  async function loadProviderOptions() {
    const result = await fetchGetAIProviderList({ current: 1, size: 1000 })
    providerOptions.value = result.records
  }

  async function loadProviders() {
    providerLoading.value = true
    try {
      const result = await fetchGetAIProviderList({
        current: providerPage.value,
        size: providerPageSize.value,
        name: providerSearch.value || undefined
      })
      providers.value = result.records
      providerTotal.value = result.total
      await loadProviderOptions()
    } finally {
      providerLoading.value = false
    }
  }

  async function loadAccounts() {
    accountLoading.value = true
    try {
      if (providerOptions.value.length === 0) await loadProviderOptions()
      const result = await fetchGetAIAccountList({
        current: accountPage.value,
        size: accountPageSize.value,
        name: accountSearch.value || undefined,
        providerId: accountProviderId.value
      })
      accounts.value = result.records
      accountTotal.value = result.total
    } finally {
      accountLoading.value = false
    }
  }

  function providerName(id: number) {
    return providerOptions.value.find((item) => item.id === id)?.name || `#${id}`
  }

  function handleTabChange(name: string | number) {
    if (name === 'accounts') void loadAccounts()
  }
  function handleProviderPageSize() {
    providerPage.value = 1
    void loadProviders()
  }
  function handleAccountPageSize() {
    accountPage.value = 1
    void loadAccounts()
  }
  function showProviderDialog(type: DialogType, row?: any) {
    dialogType.value = type
    currentProvider.value = row || {}
    providerDialogVisible.value = true
  }
  function showAccountDialog(type: DialogType, row?: any) {
    dialogType.value = type
    currentAccount.value = row || {}
    accountDialogVisible.value = true
  }

  async function submitProvider(data: {
    name: string
    baseUrl: string
    protocol: string
    description: string
    maxTokens: number
  }) {
    if (dialogType.value === 'add') await fetchCreateAIProvider(data)
    else
      await fetchUpdateAIProvider({
        id: currentProvider.value.id!,
        resourceVersion: currentProvider.value.resourceVersion || 0,
        ...data
      })
    providerDialogVisible.value = false
    ElMessage.success(dialogType.value === 'add' ? '供应商创建成功' : '供应商更新成功')
    await loadProviders()
  }

  async function submitAccount(data: {
    providerId?: number
    name: string
    apiKey: string
    model: string
  }) {
    if (!data.providerId) return
    const payload = {
      providerId: data.providerId,
      name: data.name,
      apiKey: data.apiKey,
      model: data.model
    }
    if (dialogType.value === 'add') await fetchCreateAIAccount(payload)
    else
      await fetchUpdateAIAccount({
        id: currentAccount.value.id!,
        resourceVersion: currentAccount.value.resourceVersion || 0,
        ...payload
      })
    accountDialogVisible.value = false
    ElMessage.success(dialogType.value === 'add' ? '账号创建成功' : '账号更新成功')
    await loadAccounts()
  }

  async function deleteProvider(row: any) {
    await ElMessageBox.confirm(`确认删除供应商“${row.name}”吗？`, '删除供应商', { type: 'warning' })
    await fetchDeleteAIProvider(row.id)
    ElMessage.success('删除成功')
    await loadProviders()
  }

  async function deleteAccount(row: any) {
    await ElMessageBox.confirm(`确认删除账号“${row.name}”吗？`, '删除 AI 账号', { type: 'warning' })
    await fetchDeleteAIAccount(row.id)
    ElMessage.success('删除成功')
    await loadAccounts()
  }

  void loadProviders()
</script>

<style scoped>
  .ai-config-page {
    padding-top: 10px;
  }
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }
  .toolbar > .el-input {
    width: 240px;
  }
  .filters {
    display: flex;
    gap: 8px;
  }
  .filters .el-select,
  .filters .el-input {
    width: 200px;
  }
  .el-pagination {
    justify-content: flex-end;
    margin-top: 12px;
  }
  .el-alert {
    margin-bottom: 12px;
  }
</style>

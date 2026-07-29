<template>
  <div class="ai-account-page art-full-height" style="padding-top: 10px">
    <div
      class="ai-account-toolbar"
      style="
        margin-bottom: 10px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      "
    >
      <div style="display: flex; gap: 8px">
        <ElButton @click="showDialog('add')" v-ripple>添加账号</ElButton>
        <ElButton @click="providerDialogVisible = true">管理 Provider</ElButton>
      </div>
      <div style="display: flex; align-items: center; gap: 8px">
        <ElInput
          v-model="searchForm.name"
          clearable
          placeholder="请输入账号名称"
          style="width: 220px"
          @keyup.enter="handleSearch"
          @clear="resetAndSearch"
        />
        <ElSelect
          v-model="searchForm.providerId"
          clearable
          placeholder="Provider"
          style="width: 180px"
          @change="handleSearch"
          @clear="handleSearch"
        >
          <ElOption
            v-for="provider in providers"
            :key="provider.id"
            :label="provider.name"
            :value="provider.id"
          />
        </ElSelect>
        <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData" />
      </div>
    </div>

    <ElCard class="art-table-card">
      <ArtTable
        row-key="id"
        :show-table-header="false"
        :loading="loading"
        :data="data"
        :columns="columns"
        :pagination="pagination"
        :pagination-options="{ align: 'right' }"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />

      <AIAccountDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :account-data="currentAccountData"
        :providers="providers"
        @submit="handleDialogSubmit"
      />
      <ProviderManageDialog v-model:visible="providerDialogVisible" @changed="loadProviders" />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTable } from '@/hooks/core/useTable'
  import {
    fetchCreateAIAccount,
    fetchDeleteAIAccount,
    fetchGetAIAccountList,
    fetchGetAIProviderList,
    fetchUpdateAIAccount
  } from '@/api/ai-account'
  import AIAccountDialog from './modules/ai-account-dialog.vue'
  import ProviderManageDialog from './modules/provider-manage-dialog.vue'
  import { ElLink, ElMessage, ElMessageBox, ElTag } from 'element-plus'
  import { DialogType } from '@/types'

  defineOptions({ name: 'AiAccount' })

  type AIAccountListItem = Api.SystemManage.AIAccountListItem

  const dialogType = ref<DialogType>('add')
  const dialogVisible = ref(false)
  const currentAccountData = ref<Partial<AIAccountListItem>>({})
  const providers = ref<Api.SystemManage.AIProviderListItem[]>([])
  const providerDialogVisible = ref(false)

  const searchForm = ref({
    name: undefined as string | undefined,
    providerId: undefined as number | undefined
  })

  const {
    columns,
    columnChecks,
    data,
    loading,
    pagination,
    getData,
    replaceSearchParams,
    resetSearchParams,
    handleSizeChange,
    handleCurrentChange,
    refreshData
  } = useTable({
    core: {
      apiFn: fetchGetAIAccountList,
      apiParams: {
        current: 1,
        size: 10,
        ...searchForm.value
      },
      columnsFactory: () => [
        {
          prop: 'name',
          label: '账号名称',
          minWidth: 140,
          formatter: (row) => h('span', { style: { fontSize: '12px' } }, row.name || '-')
        },
        {
          prop: 'provider',
          label: 'Provider',
          minWidth: 150,
          formatter: (row) => h(ElTag, { size: 'small' }, () => row.provider?.name || '-')
        },
        {
          prop: 'model',
          label: '模型',
          minWidth: 160,
          showOverflowTooltip: true,
          formatter: (row) => h('span', { style: { fontSize: '12px' } }, row.model || '-')
        },
        {
          prop: 'protocol',
          label: '协议',
          minWidth: 220,
          showOverflowTooltip: true,
          formatter: (row) =>
            h('span', { style: { fontSize: '12px' } }, row.provider?.protocol || '-')
        },
        {
          prop: 'baseUrl',
          label: 'Base URL',
          minWidth: 220,
          showOverflowTooltip: true,
          formatter: (row) =>
            h('span', { style: { fontSize: '12px' } }, row.provider?.baseUrl || '-')
        },
        {
          prop: 'createTime',
          label: '创建时间',
          width: 170,
          showOverflowTooltip: true,
          formatter: (row) => h('span', { style: { fontSize: '12px' } }, row.createTime || '')
        },
        {
          prop: 'operation',
          label: '操作',
          width: 140,
          fixed: 'right',
          formatter: (row) =>
            h('div', { style: 'display:flex;align-items:center;gap:10px;flex-wrap:nowrap' }, [
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () => showDialog('edit', row)
                },
                () => '编辑'
              ),
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () => deleteAccount(row)
                },
                () => '删除'
              )
            ])
        }
      ]
    }
  })

  const handleSearch = () => {
    replaceSearchParams({
      name: searchForm.value.name,
      providerId: searchForm.value.providerId
    })
    getData()
  }

  const resetAndSearch = () => {
    searchForm.value.name = undefined
    searchForm.value.providerId = undefined
    resetSearchParams()
    handleSearch()
  }

  const showDialog = (type: DialogType, row?: AIAccountListItem): void => {
    dialogType.value = type
    currentAccountData.value = row || {}
    nextTick(() => {
      dialogVisible.value = true
    })
  }

  const deleteAccount = (row: AIAccountListItem): void => {
    ElMessageBox.confirm(
      `确认删除 AI 账号“${row.name} / ${row.model || '-'}”吗？`,
      '删除 AI 账号',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'error'
      }
    ).then(async () => {
      try {
        await fetchDeleteAIAccount(row.id)
        ElMessage.success('删除成功')
        await refreshData()
      } catch {
        // HTTP 错误提示由统一封装处理
      }
    })
  }

  const handleDialogSubmit = async (data: {
    name: string
    providerId: number
    apiKey: string
    model: string
  }) => {
    try {
      if (dialogType.value === 'add') {
        await fetchCreateAIAccount(data)
        ElMessage.success('添加成功')
      } else {
        const row = currentAccountData.value
        await fetchUpdateAIAccount({
          id: row.id!,
          resourceVersion: row.resourceVersion ?? 0,
          ...data
        })
        ElMessage.success('更新成功')
      }
      dialogVisible.value = false
      currentAccountData.value = {}
      await refreshData()
    } catch {
      // HTTP 错误提示由统一封装处理
    }
  }

  const loadProviders = async () => {
    try {
      providers.value = await fetchGetAIProviderList()
    } catch {
      providers.value = []
    }
  }

  onMounted(loadProviders)
</script>

<style lang="scss" scoped>
  .ai-account-page :deep(.art-table-card > .el-card__body) {
    padding-top: 12px;
    padding-bottom: 10px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .ai-account-page :deep(.art-table) {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    height: auto !important;
    overflow: visible;
  }

  .ai-account-page :deep(.art-table .el-table) {
    flex: 1 1 0;
    min-height: 0;
    height: 100% !important;
  }

  .ai-account-page :deep(.custom-pagination) {
    flex: 0 0 auto;
    margin-top: 10px;
    margin-bottom: 0;
    padding-bottom: 4px;
    box-sizing: border-box;
  }

  .ai-account-page :deep(.el-pagination) {
    padding: 0;
  }

  .ai-account-toolbar {
    flex-shrink: 0;
  }
</style>

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
      <ElButton @click="showDialog('add')" v-ripple>添加</ElButton>
      <div style="display: flex; align-items: center; gap: 8px">
        <ElInput
          v-model="searchForm.provider"
          clearable
          placeholder="请输入供应商"
          style="width: 220px"
          @keyup.enter="handleSearch"
          @clear="resetAndSearch"
        />
        <ElSelect
          v-model="searchForm.enabled"
          clearable
          placeholder="启用状态"
          style="width: 120px"
          @change="handleSearch"
          @clear="handleSearch"
        >
          <ElOption label="已启用" :value="true" />
          <ElOption label="已停用" :value="false" />
        </ElSelect>
        <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData" />
      </div>
    </div>

    <ElCard class="art-table-card">
      <ArtTable
        row-key="id"
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
        @submit="handleDialogSubmit"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTable } from '@/hooks/core/useTable'
  import {
    fetchCreateAIAccount,
    fetchDeleteAIAccount,
    fetchGetAIAccountList,
    fetchUpdateAIAccount
  } from '@/api/ai-account'
  import AIAccountDialog from './modules/ai-account-dialog.vue'
  import { ElLink, ElMessage, ElMessageBox, ElSwitch, ElTag } from 'element-plus'
  import { DialogType } from '@/types'

  defineOptions({ name: 'AiAccount' })

  type AIAccountListItem = Api.SystemManage.AIAccountListItem

  const dialogType = ref<DialogType>('add')
  const dialogVisible = ref(false)
  const currentAccountData = ref<Partial<AIAccountListItem>>({})

  const searchForm = ref({
    provider: undefined as string | undefined,
    enabled: undefined as boolean | undefined
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
          prop: 'provider',
          label: '供应商',
          minWidth: 140,
          formatter: (row) => h('span', { style: { fontSize: '12px' } }, row.provider || '-')
        },
        {
          prop: 'enabled',
          label: '状态',
          width: 100,
          formatter: (row) =>
            h(ElTag, { size: 'small', type: row.enabled ? 'success' : 'info' }, () =>
              row.enabled ? '启用' : '停用'
            )
        },
        {
          prop: 'model',
          label: '模型',
          minWidth: 160,
          showOverflowTooltip: true,
          formatter: (row) => h('span', { style: { fontSize: '12px' } }, row.model || '-')
        },
        {
          prop: 'baseUrl',
          label: 'Base URL',
          minWidth: 220,
          showOverflowTooltip: true,
          formatter: (row) => h('span', { style: { fontSize: '12px' } }, row.baseUrl || '-')
        },
        {
          prop: 'toggleEnabled',
          label: '启用',
          width: 100,
          formatter: (row) =>
            h(ElSwitch, {
              modelValue: row.enabled,
              size: 'small',
              onChange: (value) => toggleEnabled(row, Boolean(value))
            })
        },
        {
          prop: 'description',
          label: '说明',
          minWidth: 200,
          showOverflowTooltip: true,
          formatter: (row) => h('span', { style: { fontSize: '12px' } }, row.description || '-')
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
      provider: searchForm.value.provider,
      enabled: searchForm.value.enabled
    })
    getData()
  }

  const resetAndSearch = () => {
    searchForm.value.provider = undefined
    searchForm.value.enabled = undefined
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
      `确认删除 AI 配置“${row.provider} / ${row.model || '-'}”吗？`,
      '删除 AI 配置',
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

  const toggleEnabled = async (row: AIAccountListItem, enabled: boolean) => {
    try {
      await fetchUpdateAIAccount({
        id: row.id,
        resourceVersion: row.resourceVersion,
        provider: row.provider,
        apiKey: row.apiKey,
        baseUrl: row.baseUrl,
        model: row.model,
        description: row.description,
        enabled
      })
      ElMessage.success(enabled ? '已启用' : '已停用')
      await refreshData()
    } catch {
      await refreshData()
    }
  }

  const handleDialogSubmit = async (data: {
    provider: string
    apiKey: string
    baseUrl: string
    model: string
    description: string
    enabled: boolean
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
</script>

<style lang="scss" scoped>
  .ai-account-page :deep(.art-table-card > .el-card__body) {
    padding-top: 8px;
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

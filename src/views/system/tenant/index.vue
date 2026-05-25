<!-- 租户管理页面 -->
<template>
  <div class="tenant-page art-full-height" style="padding-top: 10px">
    <div
      class="tenant-toolbar"
      style="margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between"
    >
      <ElButton @click="showDialog('add')" v-ripple>创建租户</ElButton>
      <div style="display: flex; align-items: center; gap: 8px">
        <ElInput
          v-model="searchForm.tenantName"
          clearable
          placeholder="请输入租户名称"
          style="width: 240px"
          @keyup.enter="handleSearch"
          @clear="resetSearchParams"
        />
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

      <TenantDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :tenant-data="currentTenantData"
        @submit="handleDialogSubmit"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTable } from '@/hooks/core/useTable'
  import {
    fetchCreateTenant,
    fetchDeleteTenant,
    fetchGetTenantList,
    fetchUpdateTenant
  } from '@/api/system-manage'
  import TenantDialog from './modules/tenant-dialog.vue'
  import { ElLink, ElMessage, ElMessageBox } from 'element-plus'
  import { DialogType } from '@/types'

  defineOptions({ name: 'Tenant' })

  type TenantListItem = Api.SystemManage.TenantListItem

  const dialogType = ref<DialogType>('add')
  const dialogVisible = ref(false)
  const currentTenantData = ref<Partial<TenantListItem>>({})

  const searchForm = ref({
    tenantName: undefined as string | undefined
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
      apiFn: fetchGetTenantList,
      apiParams: {
        current: 1,
        size: 10,
        ...searchForm.value
      },
      columnsFactory: () => [
        {
          prop: 'tenantName',
          label: '租户名称',
          width: 280,
          showOverflowTooltip: true,
          formatter: (row) =>
            h('span', { class: 'tenant-name', style: { fontSize: '12px' } }, row.tenantName)
        },
        {
          prop: 'createTime',
          label: '创建时间',
          width: 240,
          showOverflowTooltip: true,
          sortable: true,
          formatter: (row) =>
            h('span', { class: 'create-time', style: { fontSize: '12px' } }, row.createTime ?? '')
        },
        {
          prop: 'description',
          label: '描述',
          minWidth: 200,
          showOverflowTooltip: true,
          formatter: (row) =>
            h('span', { style: { fontSize: '12px' } }, row.description || '-')
        },
        {
          prop: 'operation',
          label: '操作',
          width: 120,
          fixed: 'right',
          formatter: (row) =>
            h('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:nowrap' }, [
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
                  onClick: () => deleteTenant(row)
                },
                () => '删除'
              )
            ])
        }
      ]
    }
  })

  const handleSearch = () => {
    replaceSearchParams({ tenantName: searchForm.value.tenantName })
    getData()
  }

  const showDialog = (type: DialogType, row?: TenantListItem): void => {
    dialogType.value = type
    currentTenantData.value = row || {}
    nextTick(() => {
      dialogVisible.value = true
    })
  }

  const deleteTenant = (row: TenantListItem): void => {
    ElMessageBox.confirm(`确定要删除租户「${row.tenantName}」吗？`, '删除租户', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'error'
    }).then(async () => {
      try {
        await fetchDeleteTenant(row.id)
        ElMessage.success('删除成功')
        await refreshData()
      } catch {
        // 错误提示由 HTTP 封装处理
      }
    })
  }

  const handleDialogSubmit = async (data: { tenantName: string; description: string }) => {
    try {
      if (dialogType.value === 'add') {
        await fetchCreateTenant({
          name: data.tenantName,
          description: data.description || undefined
        })
        ElMessage.success('添加成功')
      } else {
        const row = currentTenantData.value
        await fetchUpdateTenant({
          id: row.id!,
          resourceVersion: row.resourceVersion ?? 0,
          name: data.tenantName,
          description: data.description
        })
        ElMessage.success('更新成功')
      }
      dialogVisible.value = false
      currentTenantData.value = {}
      await refreshData()
    } catch {
      // 错误提示由 HTTP 封装处理
    }
  }
</script>

<style lang="scss" scoped>
  .tenant-page :deep(.tenant-name),
  .tenant-page :deep(.create-time) {
    font-size: 12px;
  }

  .tenant-page :deep(.art-table-card .el-card__body) {
    padding-top: 8px;
    padding-bottom: 0;
  }

  .tenant-page :deep(.custom-pagination) {
    padding-bottom: 0;
    margin-bottom: 0;
  }

  .tenant-page :deep(.el-pagination) {
    padding: 2px 0;
  }
</style>

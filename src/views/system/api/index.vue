<!-- API 管理页面 -->
<template>
  <div class="api-page art-full-height" style="padding-top: 10px">
    <div
      class="api-toolbar"
      style="margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between"
    >
      <ElButton @click="showDialog('add')" v-ripple>创建 API</ElButton>
      <div style="display: flex; align-items: center; gap: 8px">
        <ElInput
          v-model="searchForm.path"
          clearable
          placeholder="请输入 API 路径"
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

      <ApiDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :api-data="currentApiData"
        @submit="handleDialogSubmit"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTable } from '@/hooks/core/useTable'
  import {
    fetchCreateAPI,
    fetchDeleteAPI,
    fetchGetAPIList,
    fetchUpdateAPI
  } from '@/api/system-manage'
  import ApiDialog from './modules/api-dialog.vue'
  import { ElLink, ElMessage, ElMessageBox, ElTag } from 'element-plus'
  import { DialogType } from '@/types'

  defineOptions({ name: 'ApiManage' })

  type APIListItem = Api.SystemManage.APIListItem

  const dialogType = ref<DialogType>('add')
  const dialogVisible = ref(false)
  const currentApiData = ref<Partial<APIListItem>>({})

  const searchForm = ref({
    path: undefined as string | undefined,
    group: undefined as string | undefined
  })

  const getMethodTagType = (method: string) => {
    const map: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'info'> = {
      GET: 'primary',
      POST: 'success',
      PUT: 'warning',
      DELETE: 'danger',
      PATCH: 'info'
    }
    return map[method?.toUpperCase()] || 'info'
  }

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
      apiFn: fetchGetAPIList,
      apiParams: {
        current: 1,
        size: 10,
        ...searchForm.value
      },
      columnsFactory: () => [
        {
          prop: 'group',
          label: '资源',
          width: 130,
          formatter: (row) =>
            h('span', { style: { fontSize: '12px' } }, row.group || '-')
        },
        {
          prop: 'method',
          label: '请求方法',
          width: 100,
          formatter: (row) =>
            h(
              ElTag,
              { type: getMethodTagType(row.method), size: 'small' },
              () => row.method
            )
        },
        {
          prop: 'description',
          label: '动作',
          minWidth: 160,
          showOverflowTooltip: true,
          formatter: (row) =>
            h('span', { style: { fontSize: '12px' } }, row.description || '-')
        },
        {
          prop: 'path',
          label: '请求路径',
          minWidth: 220,
          showOverflowTooltip: true,
          formatter: (row) =>
            h('span', { class: 'api-path', style: { fontSize: '12px' } }, row.path)
        },
        {
          prop: 'createTime',
          label: '创建日期',
          width: 170,
          showOverflowTooltip: true,
          sortable: true,
          formatter: (row) =>
            h('span', { class: 'create-time', style: { fontSize: '12px' } }, row.createTime ?? '')
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
                  onClick: () => deleteApi(row)
                },
                () => '删除'
              )
            ])
        }
      ]
    }
  })

  const handleSearch = () => {
    replaceSearchParams({ path: searchForm.value.path })
    getData()
  }

  const showDialog = (type: DialogType, row?: APIListItem): void => {
    dialogType.value = type
    currentApiData.value = row || {}
    nextTick(() => {
      dialogVisible.value = true
    })
  }

  const deleteApi = (row: APIListItem): void => {
    ElMessageBox.confirm(`确定要删除 API「${row.method} ${row.path}」吗？`, '删除 API', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'error'
    }).then(async () => {
      try {
        await fetchDeleteAPI(row.id)
        ElMessage.success('删除成功')
        await refreshData()
      } catch {
        // 错误提示由 HTTP 封装处理
      }
    })
  }

  const handleDialogSubmit = async (data: {
    method: string
    path: string
    group: string
    description: string
  }) => {
    try {
      if (dialogType.value === 'add') {
        await fetchCreateAPI({
          method: data.method,
          path: data.path,
          group: data.group || undefined,
          description: data.description || undefined
        })
        ElMessage.success('添加成功')
      } else {
        const row = currentApiData.value
        await fetchUpdateAPI({
          id: row.id!,
          resourceVersion: row.resourceVersion ?? 0,
          method: data.method,
          path: data.path,
          description: data.description
        })
        ElMessage.success('更新成功')
      }
      dialogVisible.value = false
      currentApiData.value = {}
      await refreshData()
    } catch {
      // 错误提示由 HTTP 封装处理
    }
  }
</script>

<style lang="scss" scoped>
  .api-page :deep(.api-path),
  .api-page :deep(.create-time) {
    font-size: 12px;
  }

  .api-page :deep(.art-table-card .el-card__body) {
    padding-top: 8px;
    padding-bottom: 0;
  }

  .api-page :deep(.custom-pagination) {
    padding-bottom: 0;
    margin-bottom: 0;
  }

  .api-page :deep(.el-pagination) {
    padding: 2px 0;
  }
</style>

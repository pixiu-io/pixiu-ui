<!-- 数据源管理页面 -->
<template>
  <div class="datasource-page art-full-height">
    <ElAlert
      v-if="alertVisible"
      type="info"
      closable
      show-icon
      class="quota-alert"
      style="margin: 5px 0 20px 0"
      description="管理日志和告警数据源，支持 Loki、Elasticsearch、Prometheus 等类型。"
      @close="alertVisible = false"
    />
    <div
      class="datasource-toolbar"
      :style="{
        marginTop: alertVisible ? '0' : '10px',
        marginBottom: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }"
    >
      <ElButton @click="showDrawer" v-ripple>添加数据源</ElButton>
      <div style="display: flex; align-items: center; gap: 8px">
        <ElInput
          v-model="searchForm.nameSelector"
          clearable
          placeholder="请输入数据源名称"
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
        :show-table-header="false"
        :loading="loading"
        :data="data"
        :columns="columns"
        :pagination="pagination"
        :pagination-options="tablePaginationOptions"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />
    </ElCard>

    <DatasourceDrawer v-model="drawerVisible" :edit-id="editId" @success="refreshData" />
  </div>
</template>

<script setup lang="ts">
  import { h, ref } from 'vue'
  import { useTable } from '@/hooks/core/useTable'
  import { ElAlert, ElButton, ElInput, ElLink, ElMessage, ElMessageBox, ElTag } from 'element-plus'
  import {
    fetchGetDatasourceList,
    fetchDeleteDatasource,
    type DatasourceItem,
    DatasourceTypeMap,
    DatasourceSubTypeMap
  } from '@/api/datasource'
  import { PixiuApiError } from '@/api/container'
  import DatasourceDrawer from './modules/datasource-drawer.vue'

  defineOptions({ name: 'DatasourceManage' })

  const searchForm = ref({ nameSelector: undefined as string | undefined })
  const drawerVisible = ref(false)
  const editId = ref<number | undefined>(undefined)
  const alertVisible = ref(true)

  const tablePaginationOptions = {
    align: 'right' as const,
    hideOnEmpty: false
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
      apiFn: async (params: { current: number; size: number; nameSelector?: string }) => {
        return await fetchGetDatasourceList({
          current: params.current,
          size: params.size,
          nameSelector: params.nameSelector
        })
      },
      apiParams: {
        current: 1,
        size: 10,
        ...searchForm.value
      },
      columnsFactory: () => [
        {
          prop: 'name',
          label: '名称',
          minWidth: 180,
          formatter: (row: any) =>
            h('span', { style: { fontSize: '12px' } }, row.name)
        },
        {
          prop: 'type',
          label: '类型',
          minWidth: 80,
          formatter: (row: any) =>
            h(ElTag, { type: DatasourceTypeMap[row.type]?.type || 'info', size: 'small', effect: 'light' }, () => DatasourceTypeMap[row.type]?.label || '未知')
        },
        {
          prop: 'subType',
          label: '数据来源',
          minWidth: 120,
          formatter: (row: any) =>
            h('span', { style: { fontSize: '12px' } }, DatasourceSubTypeMap[row.subType] || row.subType)
        },
        {
          prop: 'url',
          label: 'URL',
          minWidth: 260,
          formatter: (row: any) =>
            h('span', { style: { fontSize: '12px', wordBreak: 'break-all' } }, row.url)
        },
        {
          prop: 'isDefault',
          label: '默认',
          minWidth: 70,
          formatter: (row: any) =>
            row.isDefault
              ? h(ElTag, { type: 'success', size: 'small', effect: 'light' }, () => '是')
              : h('span', { style: { fontSize: '12px', color: 'var(--el-text-color-secondary)' } }, '-')
        },
        {
          prop: 'clusterName',
          label: '集群',
          minWidth: 140,
          formatter: (row: any) =>
            h('span', { style: { fontSize: '12px' } }, row.clusterName || '-')
        },
        {
          prop: 'description',
          label: '描述',
          minWidth: 160,
          formatter: (row: any) =>
            h('span', { style: { fontSize: '12px' } }, row.description || '-')
        },
        {
          prop: 'gmtCreate',
          label: '创建时间',
          minWidth: 160,
          formatter: (row: any) =>
            h('span', { style: { fontSize: '12px' } }, row.gmtCreate || '-')
        },
        {
          prop: 'operation',
          label: '操作',
          minWidth: 120,
          fixed: 'right',
          formatter: (row: any) =>
            h('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:nowrap' }, [
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () => editDatasource(row)
                },
                () => '编辑'
              ),
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () => deleteDatasource(row)
                },
                () => '删除'
              )
            ])
        }
      ]
    }
  })

  const handleSearch = () => {
    replaceSearchParams({ nameSelector: searchForm.value.nameSelector })
    getData()
  }

  function showDrawer() {
    editId.value = undefined
    drawerVisible.value = true
  }

  function editDatasource(row: DatasourceItem) {
    editId.value = row.id
    drawerVisible.value = true
  }

  async function deleteDatasource(row: DatasourceItem) {
    try {
      await ElMessageBox.confirm(`确定要删除数据源 ${row.name} 吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      await fetchDeleteDatasource(row.id)
      ElMessage.success('删除成功')
      refreshData()
    } catch (error) {
      if (error !== 'cancel' && (!(error instanceof PixiuApiError) || !error.notified)) {
        ElMessage.error(error instanceof Error ? error.message : '删除失败')
      }
    }
  }
</script>

<style lang="scss" scoped>
  .datasource-page :deep(.art-table-card > .el-card__body) {
    padding-top: 8px;
    padding-bottom: 10px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .datasource-page :deep(.art-table) {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    height: auto !important;
    overflow: visible;
  }

  .datasource-page :deep(.art-table .el-table) {
    flex: 1 1 0;
    min-height: 0;
    height: 100% !important;
  }

  .datasource-page :deep(.custom-pagination) {
    flex: 0 0 auto;
    margin-top: 10px;
    margin-bottom: 0;
    padding-bottom: 4px;
    box-sizing: border-box;
  }

  .datasource-page :deep(.el-pagination) {
    padding: 0;
  }

  .datasource-page :deep(.el-table th),
  .datasource-page :deep(.el-table td) {
    font-size: 12px;
  }

  .datasource-toolbar {
    flex-shrink: 0;
  }

  .quota-alert {
    flex-shrink: 0;
  }
</style>

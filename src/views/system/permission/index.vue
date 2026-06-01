<!-- 授权管理页面 -->
<template>
  <div class="permission-page art-full-height" style="padding-top: 10px">
    <div
      class="permission-toolbar"
      style="margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between"
    >
      <ElButton @click="showGrantDrawer" v-ripple>添加权限</ElButton>
      <div style="display: flex; align-items: center; gap: 8px">
        <ElInput
          v-model="searchForm.clusterName"
          clearable
          placeholder="请输入集群名称"
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

      <PermissionGrantDrawer v-model="grantDrawerVisible" @success="refreshData" />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTable } from '@/hooks/core/useTable'
  import { ElLink, ElMessage } from 'element-plus'
  import PermissionGrantDrawer from './modules/permission-grant-drawer.vue'

  defineOptions({ name: 'PermissionManage' })

  const searchForm = ref({ clusterName: undefined as string | undefined })
  const grantDrawerVisible = ref(false)

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
      apiFn: async () => {
        return { code: 200, data: { records: [], total: 0, current: 1, size: 10 } }
      },
      apiParams: { current: 1, size: 10 },
      columnsFactory: () => [
        { prop: 'name', label: '授权名称', width: 160, formatter: (row: any) => h('span', { style: { fontSize: '12px' } }, row.name) },
        { prop: 'cluster', label: '集群', width: 150, formatter: (row: any) => h('span', { style: { fontSize: '12px' } }, row.cluster) },
        { prop: 'saNamespace', label: 'SA 命名空间', width: 150, formatter: (row: any) => h('span', { style: { fontSize: '12px' } }, row.saNamespace) },
        { prop: 'saName', label: 'SA 名称', width: 180, formatter: (row: any) => h('span', { style: { fontSize: '12px' } }, row.saName) },
        { prop: 'createTime', label: '创建日期', width: 170, formatter: (row: any) => h('span', { style: { fontSize: '12px' } }, row.createTime ?? '-') },
        {
          prop: 'operation',
          label: '操作',
          width: 140,
          fixed: 'right',
          formatter: (row: any) =>
            h('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:nowrap' }, [
              h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => viewKubeconfig(row) }, () => '查看'),
              h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => downloadKubeconfig(row) }, () => '下载'),
              h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => deletePermission(row) }, () => '删除')
            ])
        }
      ]
    }
  })

  const handleSearch = () => {
    replaceSearchParams({ clusterName: searchForm.value.clusterName })
    getData()
  }

  function showGrantDrawer() {
    grantDrawerVisible.value = true
  }

  function viewKubeconfig(row: any) { ElMessage.info('kubeconfig 内容: ' + (row.content || '-')) }

  function downloadKubeconfig(row: any) {
    if (!row.content) { ElMessage.warning('暂无内容'); return }
    const blob = new Blob([row.content], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${row.name || 'kubeconfig'}.yaml`; a.click()
    URL.revokeObjectURL(url)
  }

  function deletePermission(row: any) { ElMessage.info('删除功能暂未实现') }
</script>

<style lang="scss" scoped>
  .permission-page :deep(.art-table-card .el-card__body) { padding-top: 8px; padding-bottom: 0; }
  .permission-page :deep(.custom-pagination) { padding-bottom: 0; margin-bottom: 0; }
  .permission-page :deep(.el-pagination) { padding: 2px 0; }
</style>

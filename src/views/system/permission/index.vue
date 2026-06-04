<!-- 授权管理页面 -->
<template>
  <div class="permission-page art-full-height" style="padding-top: 10px">
    <div
      class="permission-toolbar"
      style="margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between"
    >
      <div style="display: flex; align-items: center; gap: 8px">
        <ElButton @click="showGrantDrawer" v-ripple>添加权限</ElButton>
        <ElButton v-if="selectedIds.length > 0" type="danger" plain @click="handleBatchDelete" v-ripple>
          批量删除 ({{ selectedIds.length }})
        </ElButton>
      </div>
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
        @selection-change="handleSelectionChange"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />

      <PermissionGrantDrawer v-model="grantDrawerVisible" @success="refreshData" />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTable } from '@/hooks/core/useTable'
  import { ElLink, ElMessage, ElMessageBox, ElTag } from 'element-plus'
  import {
    fetchDeletePermission,
    fetchGetPermission,
    fetchPermissionList,
    fetchBatchDeletePermissions
  } from '@/api/system-manage'
  import PermissionGrantDrawer from './modules/permission-grant-drawer.vue'

  defineOptions({ name: 'PermissionManage' })

  const searchForm = ref({ clusterName: undefined as string | undefined })
  const grantDrawerVisible = ref(false)
  const selectedIds = ref<number[]>([])

  const handleSelectionChange = (selection: any[]) => {
    selectedIds.value = selection.map((item) => item.id)
  }

  const formatExpiration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '-'
    const units = [
      { label: '年', value: 365 * 24 * 3600 },
      { label: '月', value: 30 * 24 * 3600 },
      { label: '天', value: 24 * 3600 },
      { label: '时', value: 3600 }
    ]

    let remaining = seconds
    let result = ''

    for (const unit of units) {
      const val = Math.floor(remaining / unit.value)
      if (val > 0) {
        result += `${val}${unit.label}`
        remaining %= unit.value
      }
    }

    return result || '不足1小时'
  }

  const checkIsExpired = (createTime: string, expirationSeconds: number) => {
    if (!createTime || !expirationSeconds) return false
    const createDate = new Date(createTime)
    if (isNaN(createDate.getTime())) return false

    const expireTime = createDate.getTime() + expirationSeconds * 1000
    return Date.now() > expireTime
  }

  const pTypeMap: Record<number, string> = {
    0: '只读',
    1: '自定义',
    2: '管理员'
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
      apiFn: async (params: { current: number; size: number; clusterName?: string }) => {
        const { total, items } = await fetchPermissionList({
          page: params.current,
          limit: params.size,
          clusterName: params.clusterName
        })
        return {
          code: 200,
          data: { records: items, total, current: params.current, size: params.size }
        }
      },
      apiParams: { current: 1, size: 10 },
      columnsFactory: () => [
        { type: 'selection', width: 50 },
        {
          prop: 'name',
          label: '授权名称',
          minWidth: 160,
          formatter: (row: any) => h('span', { style: { fontSize: '12px' } }, row.name)
        },
        {
          prop: 'clusterId',
          label: '集群',
          minWidth: 100,
          formatter: (row: any) => h('span', { style: { fontSize: '12px' } }, row.clusterId)
        },
        {
          prop: 'userId',
          label: '用户',
          minWidth: 100,
          formatter: (row: any) => h('span', { style: { fontSize: '12px' } }, row.userId)
        },
        {
          prop: 'pType',
          label: '授权类型',
          minWidth: 100,
          formatter: (row: any) => h('span', { style: { fontSize: '12px' } }, pTypeMap[row.pType] ?? row.pType)
        },
        {
          prop: 'namespace',
          label: '命名空间',
          minWidth: 120,
          formatter: (row: any) => h('span', { style: { fontSize: '12px' } }, row.namespace || '-')
        },
        {
          prop: 'expirationSeconds',
          label: '有效期',
          minWidth: 200,
          formatter: (row: any) => {
            const isExpired = checkIsExpired(row.createTime, row.expirationSeconds)
            return h('div', { style: 'display:flex;align-items:center;gap:8px' }, [
              h('span', { style: { fontSize: '12px' } }, formatExpiration(row.expirationSeconds)),
              h(
                ElTag,
                {
                  type: isExpired ? 'danger' : 'primary',
                  size: 'small',
                  effect: 'light'
                },
                () => (isExpired ? '已过期' : '有效')
              )
            ])
          }
        },
        {
          prop: 'createTime',
          label: '创建日期',
          minWidth: 160,
          formatter: (row: any) => h('span', { style: { fontSize: '12px' } }, row.createTime ?? '-')
        },
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

  async function viewKubeconfig(row: { id: number; content?: string }) {
    try {
      const detail = await fetchGetPermission(row.id)
      ElMessage.info('kubeconfig 内容: ' + (detail.content || '-'))
    } catch (e: unknown) {
      const err = e as { message?: string }
      ElMessage.error(err?.message || '获取 kubeconfig 失败')
    }
  }

  function downloadKubeconfig(row: { name?: string; content?: string }) {
    if (!row.content) {
      ElMessage.warning('暂无内容')
      return
    }
    const blob = new Blob([row.content], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${row.name || 'kubeconfig'}.yaml`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function deletePermission(row: { id: number; name?: string }) {
    try {
      await ElMessageBox.confirm(`确定删除授权「${row.name || row.id}」吗？`, '删除确认', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
      await fetchDeletePermission(row.id)
      ElMessage.success('删除成功')
      selectedIds.value = selectedIds.value.filter((id: number) => id !== row.id)
      refreshData()
    } catch (e: unknown) {
      if (e === 'cancel' || e === 'close') return
      const err = e as { message?: string }
      ElMessage.error(err?.message || '删除失败')
    }
  }

  async function handleBatchDelete() {
    if (selectedIds.value.length === 0) return

    try {
      await ElMessageBox.confirm(`确定删除选中的 ${selectedIds.value.length} 个授权吗？`, '批量删除确认', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
      await fetchBatchDeletePermissions(selectedIds.value)
      ElMessage.success('批量删除成功')
      selectedIds.value = []
      refreshData()
    } catch (e: unknown) {
      if (e === 'cancel' || e === 'close') return
      const err = e as { message?: string }
      ElMessage.error(err?.message || '批量删除失败')
    }
  }
</script>

<style lang="scss" scoped>
  .permission-page :deep(.art-table-card .el-card__body) { padding-top: 8px; padding-bottom: 0; }
  .permission-page :deep(.custom-pagination) { padding-bottom: 0; margin-bottom: 0; }
  .permission-page :deep(.el-pagination) { padding: 2px 0; }
</style>

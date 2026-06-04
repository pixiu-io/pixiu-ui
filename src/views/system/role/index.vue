<!-- 角色管理页面 -->
<template>
  <div class="role-page art-full-height" style="padding-top: 10px">
    <div
      class="role-toolbar"
      style="margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between"
    >
      <ElButton @click="showDialog('add')" v-ripple>创建角色</ElButton>
      <div style="display: flex; align-items: center; gap: 8px">
        <ElInput
          v-model="searchForm.roleName"
          clearable
          placeholder="请输入角色名称"
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

      <RoleDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :role-data="currentRoleData"
        @submit="handleDialogSubmit"
      />

      <RoleApiDialog
        v-model:visible="apiDialogVisible"
        :role-data="currentRoleData"
        @success="refreshData"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTable } from '@/hooks/core/useTable'
  import {
    fetchCreateRole,
    fetchDeleteRole,
    fetchGetRoleList,
    fetchGetTenantList,
    fetchUpdateRole
  } from '@/api/system-manage'
  import RoleDialog from './modules/role-dialog.vue'
  import RoleApiDialog from './modules/role-api-dialog.vue'
  import { ElLink, ElMessage, ElMessageBox, ElTag } from 'element-plus'
  import { DialogType } from '@/types'

  defineOptions({ name: 'Role' })

  type RoleListItem = Api.SystemManage.RoleListItem

  const dialogType = ref<DialogType>('add')
  const dialogVisible = ref(false)
  const apiDialogVisible = ref(false)
  const currentRoleData = ref<Partial<RoleListItem>>({})

  const searchForm = ref({
    roleName: undefined as string | undefined
  })

  const tenantNameMap = ref<Record<number, string>>({})

  async function loadTenantMap() {
    try {
      const { records } = await fetchGetTenantList({ current: 1, size: 500 })
      const map: Record<number, string> = {}
      for (const item of records) {
        map[item.id] = item.tenantName
      }
      tenantNameMap.value = map
    } catch {
      // ignore
    }
  }
  onMounted(() => { void loadTenantMap() })

  const getTenantTag = (tenantId?: number) => {
    if (!tenantId) return { type: 'info' as const, text: '全局角色' }
    const name = tenantNameMap.value[tenantId]
    if (name) return { type: 'primary' as const, text: name }
    return { type: 'primary' as const, text: `租户 ${tenantId}` }
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
      apiFn: fetchGetRoleList,
      apiParams: {
        current: 1,
        size: 10,
        ...searchForm.value
      },
      columnsFactory: () => [
        {
          prop: 'roleName',
          label: '角色名称',
          width: 160,
          formatter: (row) =>
            h('span', { class: 'role-name', style: { fontSize: '12px' } }, row.roleName)
        },
        {
          prop: 'tenantId',
          label: '租户',
          formatter: (row) => {
            const tag = getTenantTag(row.tenantId)
            return h(ElTag, { type: tag.type, size: 'small' }, () => tag.text)
          }
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
          prop: 'description',
          label: '描述',
          minWidth: 160,
          showOverflowTooltip: true,
          formatter: (row) =>
            h('span', { style: { fontSize: '12px' } }, row.description || '-')
        },
        {
          prop: 'operation',
          label: '操作',
          width: 180,
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
                  onClick: () => showApiDialog(row)
                },
                () => '修改权限'
              ),
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () => deleteRole(row)
                },
                () => '删除'
              )
            ])
        }
      ]
    }
  })

  const handleSearch = () => {
    replaceSearchParams({ roleName: searchForm.value.roleName })
    getData()
  }

  const showDialog = (type: DialogType, row?: RoleListItem): void => {
    dialogType.value = type
    currentRoleData.value = row || {}
    nextTick(() => {
      dialogVisible.value = true
    })
  }

  const showApiDialog = (row: RoleListItem): void => {
    currentRoleData.value = row
    nextTick(() => {
      apiDialogVisible.value = true
    })
  }

  const deleteRole = (row: RoleListItem): void => {
    ElMessageBox.confirm(`确定要删除角色「${row.roleName}」吗？`, '删除角色', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'error'
    }).then(async () => {
      try {
        await fetchDeleteRole(row.id)
        ElMessage.success('删除成功')
        await refreshData()
      } catch (e: any) {
        ElMessage.error(e?.message || '删除失败')
      }
    })
  }

  const handleDialogSubmit = async (data: {
    roleName: string
    tenantId?: number
    description: string
  }) => {
    try {
      if (dialogType.value === 'add') {
        if (!data.tenantId || data.tenantId <= 0) {
          ElMessage.warning('请选择租户')
          return
        }
        await fetchCreateRole({
          name: data.roleName,
          tenantId: data.tenantId,
          description: data.description || undefined
        })
        ElMessage.success('添加成功')
      } else {
        const row = currentRoleData.value
        await fetchUpdateRole({
          id: row.id!,
          resourceVersion: row.resourceVersion ?? 0,
          name: data.roleName,
          description: data.description
        })
        ElMessage.success('更新成功')
      }
      dialogVisible.value = false
      currentRoleData.value = {}
      await refreshData()
    } catch (e: any) {
      ElMessage.error(e?.message || '操作失败')
    }
  }
</script>

<style lang="scss" scoped>
  .role-page :deep(.role-name),
  .role-page :deep(.create-time) {
    font-size: 12px;
  }

  .role-page :deep(.art-table-card .el-card__body) {
    padding-top: 8px;
    padding-bottom: 0;
  }

  .role-page :deep(.custom-pagination) {
    padding-bottom: 0;
    margin-bottom: 0;
  }

  .role-page :deep(.el-pagination) {
    padding: 2px 0;
  }
</style>

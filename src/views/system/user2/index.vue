<template>
  <div class="user-page art-full-height">
    <UserSearch v-model="searchForm" @search="handleSearch" @reset="resetSearchParams"></UserSearch>

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElButton @click="showDialog('add')" v-ripple>新增用户</ElButton>
        </template>
      </ArtTableHeader>

      <ArtTable
        row-key="id"
        :loading="loading"
        :data="data"
        :columns="columns"
        :pagination="pagination"
        :pagination-options="{ align: 'right' }"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      >
      </ArtTable>

      <UserDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :user-data="currentUserData"
        @submit="handleDialogSubmit"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTable } from '@/hooks/core/useTable'
  import { fetchGetUserList } from '@/api/system-manage'
  import UserSearch from './modules/user-search.vue'
  import UserDialog from './modules/user-dialog.vue'
  import { ElTag, ElMessage, ElMessageBox, ElImage, ElLink } from 'element-plus'
  import { DialogType } from '@/types'

  defineOptions({ name: 'User2' })

  type UserListItem = Api.SystemManage.UserListItem

  const dialogType = ref<DialogType>('add')
  const dialogVisible = ref(false)
  const currentUserData = ref<Partial<UserListItem>>({})

  const searchForm = ref({
    userName: undefined,
    userPhone: undefined,
    userEmail: undefined,
    status: '0'
  })

  const USER_STATUS_CONFIG = {
    '0': { type: 'success' as const, text: '正常' },
    '1': { type: 'warning' as const, text: '停用' },
    '2': { type: 'danger' as const, text: '禁用' }
  } as const

  const getUserStatusConfig = (status: string) => {
    return (
      USER_STATUS_CONFIG[status as keyof typeof USER_STATUS_CONFIG] || {
        type: 'info' as const,
        text: '未知'
      }
    )
  }

  const getUserRoleText = (role?: number) => {
    if (role === 2) return '超级管理员'
    if (role === 1) return '管理员'
    return '普通用户'
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
      apiFn: fetchGetUserList,
      apiParams: {
        current: 1,
        size: 20,
        ...searchForm.value
      },
      columnsFactory: () => [
        { type: 'selection', width: 30 },
        {
          prop: 'userInfo',
          label: '用户名',
          width: 280,
          formatter: (row) => {
            return h('div', { class: 'user flex-c' }, [
              h(ElImage, {
                class: 'size-9.5 rounded-md',
                src: row.avatar,
                previewSrcList: row.avatar ? [row.avatar] : [],
                previewTeleported: true
              }),
              h('div', { class: 'ml-2' }, [
                h('p', { class: 'user-name' }, row.userName),
                h('p', { class: 'email' }, row.userEmail)
              ])
            ])
          }
        },
        {
          prop: 'status',
          label: '状态',
          formatter: (row) => {
            const statusConfig = getUserStatusConfig(row.status)
            return h(ElTag, { type: statusConfig.type }, () => statusConfig.text)
          }
        },
        {
          prop: 'role',
          label: '角色',
          formatter: (row) => getUserRoleText(row.role)
        },
        { prop: 'userPhone', label: '手机号' },
        {
          prop: 'createTime',
          label: '创建日期',
          sortable: true
        },
        {
          prop: 'operation',
          label: '操作',
          width: 180,
          fixed: 'right',
          formatter: (row) =>
            h('div', { class: 'flex items-center gap-2' }, [
              h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => showDialog('edit', row) }, () => '编辑'),
              h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => deleteUser(row) }, () => '删除')
            ])
        }
      ]
    }
  })

  const handleSearch = (params: Api.SystemManage.UserSearchParams) => {
    replaceSearchParams(params)
    getData()
  }

  const showDialog = (type: DialogType, row?: UserListItem): void => {
    dialogType.value = type
    currentUserData.value = row || {}
    nextTick(() => {
      dialogVisible.value = true
    })
  }

  const deleteUser = (_row: UserListItem): void => {
    ElMessageBox.confirm(`确定要注销该用户吗？`, '注销用户', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'error'
    }).then(() => {
      ElMessage.success('注销成功')
    })
  }

  const handleDialogSubmit = async () => {
    dialogVisible.value = false
    currentUserData.value = {}
    refreshData()
  }
</script>

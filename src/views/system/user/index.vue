<!-- 用户管理页面 -->
<!-- art-full-height 自动计算出页面剩余高度 -->
<!-- art-table-card 一个符合系统样式的 class，同时自动撑满剩余高度 -->
<!-- 更多 useTable 使用示例请移步至 功能示例 下面的高级表格示例或者查看官方文档 -->
<!-- useTable 文档：https://www.pixiu-cloud.com/docs/zh/guide/hooks/use-table.html -->
<template>
  <div class="user-page art-full-height">
    <ElCard class="art-table-card">
      <!-- 表格头部 -->
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <div style="display:flex;align-items:center;justify-content:space-between;width:100%">
            <ElButton @click="showDialog('add')" v-ripple>新增用户</ElButton>
            <ElInput
              v-model="searchForm.userName"
              clearable
              placeholder="请输入用户名"
              style="width: 320px; margin-right: 12px"
              @keyup.enter="handleSearch"
              @clear="resetSearchParams"
            />
          </div>
        </template>
      </ArtTableHeader>

      <!-- 表格 -->
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

      <!-- 用户弹窗 -->
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
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { ACCOUNT_TABLE_DATA } from '@/mock/temp/formData'
  import { useTable } from '@/hooks/core/useTable'
  import { fetchBatchDeleteUsers, fetchCreateUser, fetchGetUserList, fetchUpdateUser } from '@/api/system-manage'
    import UserDialog from './modules/user-dialog.vue'
  import { ElLink, ElMessage } from 'element-plus'
  import { DialogType } from '@/types'

  defineOptions({ name: 'User' })

  type UserListItem = Api.SystemManage.UserListItem

  // 弹窗相关
  const dialogType = ref<DialogType>('add')
  const dialogVisible = ref(false)
  const currentUserData = ref<Partial<UserListItem>>({})


  // 搜索表单
  const searchForm = ref({
    userName: undefined,
    userGender: undefined,
    userPhone: undefined,
    userEmail: undefined,
    status: undefined
  })

  /** 用户状态：接口 status 字段，0-正常，1-禁用 */
  const getUserStatusText = (status: string | number | undefined) => {
    const value = Number(status)
    if (value === 0) return '正常'
    if (value === 1) return '禁用'
    return '未知'
  }

  /** 用户角色：接口 role 字段，0-普通用户，1-管理员，2-超级管理员 */
  const getUserRoleText = (role?: number) => {
    if (role === 2) return '超级管理员'
    if (role === 1) return '管理员'
    if (role === 0) return '普通用户'
    return '未知'
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
    // 核心配置
    core: {
      apiFn: fetchGetUserList,
      apiParams: {
        current: 1,
        size: 20,
        ...searchForm.value
      },
      // 自定义分页字段映射，未设置时将使用全局配置 tableConfig.ts 中的 paginationKey
      // paginationKey: {
      //   current: 'pageNum',
      //   size: 'pageSize'
      // },
      columnsFactory: () => [
        {
          prop: 'userInfo',
          label: '用户名',
          width: 280,
          // visible: false, // 默认是否显示列
          formatter: (row) =>
            h('span', { class: 'user-name', style: { fontSize: '12px' } }, row.userName)
        },
        {
          prop: 'status',
          label: '状态',
          formatter: (row) =>
            h('span', { style: { fontSize: '12px' } }, getUserStatusText(row.status))
        },
        {
          prop: 'role',
          label: '角色',
          formatter: (row) =>
            h('span', { class: 'user-role', style: { fontSize: '12px' } }, getUserRoleText(row.role))
        },
        { prop: 'userPhone', label: '手机号' },
        {
          prop: 'userEmail',
          label: '邮箱',
          formatter: (row) =>
            h('span', { class: 'user-email', style: { fontSize: '12px' } }, row.userEmail || '-')
        },
        {
          prop: 'createTime',
          label: '创建日期',
          sortable: true,
          formatter: (row) =>
            h('span', { class: 'create-time', style: { fontSize: '12px' } }, row.createTime ?? '')
        },
        {
          prop: 'operation',
          label: '操作',
          width: 120,
          fixed: 'right', // 固定列
          formatter: (row) =>
            h('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:nowrap' }, [
              h(ElLink, {
                type: 'primary',
                underline: 'never',
                style: 'font-size:12px',
                onClick: () => showDialog('edit', row)
              }, () => '编辑'),
              h(ElLink, {
                type: 'primary',
                underline: 'never',
                style: 'font-size:12px',
                onClick: () => deleteUser(row)
              }, () => '删除')
            ])
        }
      ]
    },
    // 数据处理
    transform: {
      // 数据转换器 - 替换头像
      dataTransformer: (records) => {
        // 类型守卫检查
        if (!Array.isArray(records)) {
          console.warn('数据转换器: 期望数组类型，实际收到:', typeof records)
          return []
        }

        // 使用本地头像替换接口返回的头像
        return records.map((item, index: number) => {
          return {
            ...item,
            avatar: ACCOUNT_TABLE_DATA[index % ACCOUNT_TABLE_DATA.length].avatar
          }
        })
      }
    }
  })

  /**
   * 搜索处理
   * @param params 参数
   */
  const handleSearch = () => {
    replaceSearchParams({ userName: searchForm.value.userName })
    getData()
  }

  /**
   * 显示用户弹窗
   */
  const showDialog = (type: DialogType, row?: UserListItem): void => {
    console.log('打开弹窗:', { type, row })
    dialogType.value = type
    currentUserData.value = row || {}
    nextTick(() => {
      dialogVisible.value = true
    })
  }


  /**
   * 删除用户
   */
  const deleteUser = (row: UserListItem): void => {
    if (row.role === 2) {
      ElMessage.warning('超级管理员不允许删除')
      return
    }
    ElMessageBox.confirm(`确定要注销该用户吗？`, '注销用户', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'error'
    }).then(async () => {
      try {
        await fetchBatchDeleteUsers([row.id])
        ElMessage.success('注销成功')
        await refreshData()
      } catch {
        // 错误提示由 HTTP 封装处理
      }
    })
  }

  /**
   * 处理弹窗提交事件
   */
  const handleDialogSubmit = async (data: { username: string; phone: string; role: string }) => {
    try {
      if (dialogType.value === 'add') {
        await fetchCreateUser({
          name: data.username,
          password: 'Pixiu@123',
          phone: data.phone,
          role: Number(data.role) || 0
        })
        ElMessage.success('添加成功')
      } else {
        const row = currentUserData.value
        await fetchUpdateUser({
          id: row.id!,
          resourceVersion: row.resourceVersion ?? 0,
          phone: data.phone,
          role: Number(data.role) || 0
        })
        ElMessage.success('更新成功')
      }
      dialogVisible.value = false
      currentUserData.value = {}
      await refreshData()
    } catch (error) {
      // 错误提示由 HTTP 封装处理
    }
  }

</script>

<style lang="scss" scoped>
  .user-page :deep(.user-name),
  .user-page :deep(.user-role),
  .user-page :deep(.user-email),
  .user-page :deep(.create-time) {
    font-size: 12px;
  }
</style>
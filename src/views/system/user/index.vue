<!-- 用户管理页面 -->
<!-- art-full-height 自动计算出页面剩余高度 -->
<!-- art-table-card 一个符合系统样式的 class，同时自动撑满剩余高度 -->
<!-- 更多 useTable 使用示例请移步至 功能示例 下面的高级表格示例或者查看官方文档 -->
<!-- useTable 文档：https://www.pixiu-cloud.com/docs/zh/guide/hooks/use-table.html -->
<template>
  <div class="user-page art-full-height" style="padding-top: 10px">
    <div class="user-toolbar" style="margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
      <ElButton @click="showDialog('add')" v-ripple>创建用户</ElButton>
      <div style="display: flex; align-items: center; gap: 8px;">
        <ElInput
          v-model="searchForm.userName"
          clearable
          placeholder="请输入用户名"
          style="width: 240px"
          @keyup.enter="handleSearch"
          @clear="resetSearchParams"
        />
        <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData" />
      </div>
    </div>
    <ElCard class="art-table-card">
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

      <!-- 修改密码弹窗 -->
      <ElDialog v-model="passwordVisible" title="修改密码" width="420px" align-center destroy-on-close class="password-dialog">
        <ElForm ref="passwordFormRef" :model="passwordForm" :rules="passwordRules" label-width="80px">
          <ElFormItem label="新密码" prop="newPassword">
            <ElInput v-model="passwordForm.newPassword" type="password" placeholder="请输入新密码" show-password />
          </ElFormItem>
          <ElFormItem label="确认密码" prop="confirmPassword">
            <ElInput v-model="passwordForm.confirmPassword" type="password" placeholder="请再次输入新密码" show-password />
          </ElFormItem>
        </ElForm>
        <template #footer>
          <ElButton @click="passwordVisible = false">取消</ElButton>
          <ElButton type="primary" :loading="passwordSubmitting" @click="submitPassword">确认</ElButton>
        </template>
      </ElDialog>

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
  import { PixiuApiError } from '@/api/container'
  import { fetchBatchDeleteUsers, fetchCreateUser, fetchGetRoleList, fetchGetUserList, fetchResetUserPassword, fetchUpdateUser } from '@/api/system-manage'
    import UserDialog from './modules/user-dialog.vue'
  import { ElLink, ElMessage } from 'element-plus'
  import { DialogType } from '@/types'

  defineOptions({ name: 'User' })

  type UserListItem = Api.SystemManage.UserListItem

  // 弹窗相关
  const dialogType = ref<DialogType>('add')
  const dialogVisible = ref(false)
  const currentUserData = ref<Partial<UserListItem>>({})

  // 修改密码
  const passwordVisible = ref(false)
  const passwordSubmitting = ref(false)
  const passwordUserId = ref(0)
  const passwordResourceVersion = ref(0)
  const passwordFormRef = ref()
  const passwordForm = reactive({ newPassword: '', confirmPassword: '' })
  const passwordRules = {
    newPassword: [
      { required: true, message: '请输入新密码', trigger: 'blur' },
      { min: 6, max: 32, message: '长度在 6 到 32 个字符', trigger: 'blur' },
      { pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, message: '密码不符合要求，至少包含一个大写字母、一个小写字母、一个数字', trigger: 'blur' }
    ],
    confirmPassword: [
      { required: true, message: '请再次输入新密码', trigger: 'blur' },
      { validator: (_rule: any, value: string, callback: any) => { if (value !== passwordForm.newPassword) callback(new Error('两次密码不一致')); else callback() }, trigger: 'blur' }
    ]
  }


  // 搜索表单
  const searchForm = ref({
    userName: undefined,
    userGender: undefined,
    userPhone: undefined,
    userEmail: undefined,
    status: undefined
  })

  /** 用户状态：接口 status 字段，0-正常，1-禁用 */
  const getStatusTag = (status: string | number | undefined) => {
    const value = Number(status)
    if (value === 0) return { type: 'primary' as const, text: '正常' }
    if (value === 1) return { type: 'info' as const, text: '禁用' }
    return { type: 'info' as const, text: '未知' }
  }

  /** 角色 ID → 名称映射 */
  const roleNameMap = ref<Record<number, string>>({})

  async function loadRoleMap() {
    try {
      const { records } = await fetchGetRoleList(
        { current: 1, size: 500 },
        { skipErrorNotification: true }
      )
      const map: Record<number, string> = {}
      for (const r of records) {
        map[r.id] = r.roleName
      }
      roleNameMap.value = map
    } catch {
      // ignore
    }
  }
  onMounted(() => { void loadRoleMap() })

  /** 用户角色显示：0=超级管理员，其他查角色表 */
  const getUserRoleText = (role?: number) => {
    if (role === 0) return '超级管理员'
    if (role === undefined || role === null) return '未知'
    return roleNameMap.value[role] || `角色 ${role}`
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
        size: 10,
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
          width: 160,
          // visible: false, // 默认是否显示列
          formatter: (row) =>
            h('span', { class: 'user-name', style: { fontSize: '12px' } }, row.userName)
        },
        {
          prop: 'status',
          label: '状态',
          formatter: (row) => {
            const tag = getStatusTag(row.status)
            return h(ElTag, { type: tag.type, size: 'small' }, () => tag.text)
          }
        },
        {
          prop: 'role',
          label: '角色',
          formatter: (row) =>
            h('span', { class: 'user-role', style: { fontSize: '12px' } }, getUserRoleText(row.role))
        },
        { prop: 'userPhone', label: '手机号', formatter: (row) => h('span', { style: { fontSize: '12px' } }, row.userPhone || '-') },
        {
          prop: 'userEmail',
          label: '邮箱',
          formatter: (row) =>
            h('span', { class: 'user-email', style: { fontSize: '12px' } }, row.userEmail || '-')
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
          width: 160,
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
                onClick: () => openPasswordDialog(row)
              }, () => '修改密码'),
              h(ElLink, {
                type: 'primary',
                underline: 'never',
                disabled: row.role === 0,
                style: { fontSize: '12px', color: row.role === 0 ? 'var(--el-text-color-disabled)' : undefined },
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
  function openPasswordDialog(row: UserListItem) {
    passwordUserId.value = row.id
    passwordResourceVersion.value = row.resourceVersion ?? 0
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
    passwordVisible.value = true
    nextTick(() => passwordFormRef.value?.clearValidate())
  }

  async function submitPassword() {
    if (!passwordFormRef.value) return
    await passwordFormRef.value.validate(async (valid: boolean) => {
      if (!valid) return
      passwordSubmitting.value = true
      try {
        await fetchResetUserPassword(passwordUserId.value, passwordResourceVersion.value, passwordForm.newPassword)
        ElMessage.success('密码修改成功')
        passwordVisible.value = false
        await refreshData()
      } catch (e: any) {
        ElMessage.error(e?.message || '修改密码失败')
      } finally {
        passwordSubmitting.value = false
      }
    })
  }

  const deleteUser = (row: UserListItem): void => {
    if (row.role === 0) {
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
  const handleDialogSubmit = async (data: { username: string; password: string; phone: string; email: string; description: string; role: string; status: string }) => {
    try {
      if (dialogType.value === 'add') {
        await fetchCreateUser({
          name: data.username,
          password: data.password || 'Pixiu@123',
          phone: data.phone,
          email: data.email,
          role: Number(data.role) || 0
        })
        ElMessage.success('添加成功')
      } else {
        const row = currentUserData.value
        await fetchUpdateUser({
          id: row.id!,
          resourceVersion: row.resourceVersion ?? 0,
          phone: data.phone,
          email: data.email,
          role: Number(data.role) || 0,
          status: Number(data.status)
        })
        ElMessage.success('更新成功')
      }
      dialogVisible.value = false
      currentUserData.value = {}
      await refreshData()
    } catch (error: unknown) {
      if (error instanceof PixiuApiError && error.notified) return
      const err = error as { message?: string }
      ElMessage.error(err?.message || '操作失败')
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

  .user-page :deep(.art-table-card .el-card__body) {
    padding-top: 8px;
    padding-bottom: 0;
  }

  .user-page :deep(.custom-pagination) {
    padding-bottom: 0;
    margin-bottom: 0;
  }

  .user-page :deep(.el-pagination) {
    padding: 2px 0;
  }
</style>

<style>
  .password-dialog .el-input {
    max-width: 280px;
  }

  .password-dialog .el-input__inner {
    font-size: 12px;
  }
</style>
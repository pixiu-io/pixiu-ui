<!-- 系统邮件配置管理页面 -->
<template>
  <div class="email-page art-full-height" style="padding-top: 10px">
    <div
      class="email-toolbar"
      style="margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between"
    >
      <ElButton @click="showDialog('add')" v-ripple>新建邮件配置</ElButton>
      <div style="display: flex; align-items: center; gap: 8px">
        <ElInput
          v-model="searchForm.name"
          clearable
          placeholder="请输入配置名称"
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
        :pagination-options="{ align: 'right' }"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />

      <EmailDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :email-data="currentEmailData"
        @submit="handleDialogSubmit"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTable } from '@/hooks/core/useTable'
  import {
    fetchCreateEmail,
    fetchDeleteEmail,
    fetchGetEmailList,
    fetchTestSendEmail,
    fetchUpdateEmail,
    type EmailConfigCreateParams,
    type EmailConfigItem
  } from '@/api/system-manage'
  import EmailDialog from './modules/email-dialog.vue'
  import { ElLink, ElMessage, ElMessageBox, ElTag } from 'element-plus'
  import { DialogType } from '@/types'

  defineOptions({ name: 'SystemEmail' })

  const dialogType = ref<DialogType>('add')
  const dialogVisible = ref(false)
  const currentEmailData = ref<Partial<EmailConfigItem>>({})

  const searchForm = ref({
    name: undefined as string | undefined
  })

  const encryptionMap: Record<string, string> = {
    none: '无加密',
    ssl: 'SSL',
    tls: 'TLS',
    starttls: 'STARTTLS'
  }
  const getEncryptionText = (value?: string) =>
    encryptionMap[(value || '').toLowerCase()] || value || '无加密'

  const getSenderText = (row: EmailConfigItem) =>
    row.from_name ? `${row.from_name} <${row.from_email}>` : row.from_email

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
      apiFn: fetchGetEmailList,
      apiParams: {
        current: 1,
        size: 10,
        ...searchForm.value
      },
      columnsFactory: () => [
        {
          prop: 'name',
          label: '名称',
          width: 160,
          showOverflowTooltip: true,
          formatter: (row) =>
            h('span', { class: 'email-name', style: { fontSize: '12px' } }, row.name)
        },
        {
          prop: 'smtp_host',
          label: 'SMTP 服务器',
          width: 180,
          showOverflowTooltip: true,
          formatter: (row) =>
            h('span', { style: { fontSize: '12px' } }, row.smtp_host || '-')
        },
        {
          prop: 'smtp_port',
          label: '端口',
          width: 80,
          formatter: (row) =>
            h('span', { style: { fontSize: '12px' } }, String(row.smtp_port ?? '-'))
        },
        {
          prop: 'username',
          label: '用户名',
          width: 140,
          showOverflowTooltip: true,
          formatter: (row) =>
            h('span', { style: { fontSize: '12px' } }, row.username || '-')
        },
        {
          prop: 'from_email',
          label: '发件人',
          minWidth: 200,
          showOverflowTooltip: true,
          formatter: (row) =>
            h('span', { style: { fontSize: '12px' } }, getSenderText(row))
        },
        {
          prop: 'encryption',
          label: '加密方式',
          width: 110,
          formatter: (row) =>
            h('span', { style: { fontSize: '12px' } }, getEncryptionText(row.encryption))
        },
        {
          prop: 'enabled',
          label: '启用状态',
          width: 90,
          formatter: (row) =>
            h(
              ElTag,
              { type: row.enabled ? 'success' : 'info', size: 'small' },
              () => (row.enabled ? '启用' : '停用')
            )
        },
        {
          prop: 'is_default',
          label: '默认',
          width: 90,
          formatter: (row) =>
            h(
              ElTag,
              { type: row.is_default ? 'warning' : 'info', size: 'small' },
              () => (row.is_default ? '默认' : '否')
            )
        },
        {
          prop: 'operation',
          label: '操作',
          width: 150,
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
                  onClick: () => handleTestSend(row)
                },
                () => '测试'
              ),
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () => deleteEmail(row)
                },
                () => '删除'
              )
            ])
        }
      ]
    }
  })

  const handleSearch = () => {
    replaceSearchParams({ name: searchForm.value.name })
    getData()
  }

  const showDialog = (type: DialogType, row?: EmailConfigItem): void => {
    dialogType.value = type
    currentEmailData.value = row || {}
    nextTick(() => {
      dialogVisible.value = true
    })
  }

  const deleteEmail = (row: EmailConfigItem): void => {
    ElMessageBox.confirm(`确定要删除邮件配置「${row.name}」吗？`, '删除邮件配置', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'error'
    }).then(async () => {
      try {
        await fetchDeleteEmail(row.id)
        ElMessage.success('删除成功')
        await refreshData()
      } catch {
        // 错误提示由 HTTP 封装处理
      }
    })
  }

  const handleTestSend = (row: EmailConfigItem): void => {
    ElMessageBox.prompt(`请输入收件人邮箱，向「${row.name}」发送测试邮件`, '发送测试邮件', {
      confirmButtonText: '发送',
      cancelButtonText: '取消',
      inputType: 'text',
      inputPattern: /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/,
      inputErrorMessage: '请输入有效的邮箱地址'
    })
      .then(async ({ value }) => {
        try {
          await fetchTestSendEmail(row.id, value.trim())
          ElMessage.success('测试邮件发送成功')
        } catch {
          // 错误提示由 HTTP 封装处理
        }
      })
      .catch(() => undefined)
  }

  const handleDialogSubmit = async (data: EmailConfigCreateParams) => {
    try {
      if (dialogType.value === 'add') {
        await fetchCreateEmail(data)
        ElMessage.success('创建成功')
      } else {
        const row = currentEmailData.value
        await fetchUpdateEmail(row.id!, {
          ...data,
          id: row.id!,
          resource_version: row.resource_version ?? 0
        })
        ElMessage.success('更新成功')
      }
      dialogVisible.value = false
      currentEmailData.value = {}
      await refreshData()
    } catch {
      // 错误提示由 HTTP 封装处理
    }
  }
</script>

<style lang="scss" scoped>
  .email-page :deep(.email-name) {
    font-size: 12px;
  }

  .email-page :deep(.art-table-card > .el-card__body) {
    padding-top: 12px;
    padding-bottom: 10px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .email-page :deep(.art-table) {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    height: auto !important;
    overflow: visible;
  }

  .email-page :deep(.art-table .el-table) {
    flex: 1 1 0;
    min-height: 0;
    height: 100% !important;
  }

  .email-page :deep(.custom-pagination) {
    flex: 0 0 auto;
    margin-top: 10px;
    margin-bottom: 0;
    padding-bottom: 4px;
    box-sizing: border-box;
  }

  .email-page :deep(.el-pagination) {
    padding: 0;
  }

  .email-toolbar {
    flex-shrink: 0;
  }
</style>

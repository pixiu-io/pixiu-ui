<template>
  <div class="agent-page art-full-height">
    <!-- 搜索区 -->
    <ElCard class="mb-4 search-card">
      <ElForm :model="searchForm" inline class="search-form">
        <div class="search-form-left">
          <ElFormItem label="名称">
            <ElInput
              v-model="searchForm.nameSelector"
              placeholder="请输入名称"
              clearable
              style="width: 160px"
              @keyup.enter="handleSearch"
            />
          </ElFormItem>
          <ElFormItem label="状态">
            <ElSelect
              v-model="searchForm.status"
              placeholder="全部"
              clearable
              style="width: 140px"
            >
              <ElOption label="未知" :value="0" />
              <ElOption label="在线" :value="1" />
              <ElOption label="离线" :value="2" />
              <ElOption label="异常" :value="3" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="用户ID">
            <ElInput
              v-model="searchForm.userId"
              placeholder="请输入用户ID"
              clearable
              style="width: 140px"
              @keyup.enter="handleSearch"
            />
          </ElFormItem>
        </div>
        <ElFormItem class="search-form-actions">
          <ElButton type="primary" @click="handleSearch" v-ripple>查询</ElButton>
          <ElButton @click="handleReset" v-ripple>重置</ElButton>
        </ElFormItem>
      </ElForm>
    </ElCard>

    <!-- 列表 -->
    <ElCard class="art-table-card">
      <ArtTableHeader :loading="loading" @refresh="refreshData">
        <template #left>
          <ElButton @click="openDialog('add')" v-ripple>新增 Agent</ElButton>
        </template>
      </ArtTableHeader>
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
    </ElCard>

    <!-- 弹窗 -->
    <ElDialog
      v-model="dialogVisible"
      :title="dialogType === 'add' ? '新增 Agent' : '编辑 Agent'"
      width="500px"
      destroy-on-close
    >
      <ElForm
        ref="dialogFormRef"
        :model="dialogForm"
        :rules="dialogRules"
        label-width="90px"
      >
        <ElFormItem label="名称" prop="name">
          <ElInput v-model="dialogForm.name" placeholder="请输入名称" />
        </ElFormItem>
        <ElFormItem label="状态" prop="status">
          <ElSelect v-model="dialogForm.status" placeholder="请选择状态" style="width: 100%">
            <ElOption label="未知" :value="0" />
            <ElOption label="在线" :value="1" />
            <ElOption label="离线" :value="2" />
            <ElOption label="异常" :value="3" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="用户ID" prop="userId">
          <ElInput v-model="dialogForm.userId" placeholder="请输入用户ID" />
        </ElFormItem>
        <ElFormItem label="描述" prop="description">
          <ElInput
            v-model="dialogForm.description"
            type="textarea"
            :rows="3"
            placeholder="请输入描述"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="handleSubmit">确定</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { ElTag, ElMessage, ElMessageBox } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'
  import { useTable } from '@/hooks/core/useTable'
  import {
    fetchAgentList,
    fetchCreateAgent,
    fetchUpdateAgent,
    fetchDeleteAgent,
  } from '@/api/agent'
  import type { AgentItem } from '@/api/agent'

  defineOptions({ name: 'SafeguardAgent' })

  // 状态配置
  const STATUS_CONFIG: Record<number, { label: string; type: 'info' | 'success' | 'warning' | 'danger' }> = {
    0: { label: '未知', type: 'info' },
    1: { label: '在线', type: 'success' },
    2: { label: '离线', type: 'warning' },
    3: { label: '异常', type: 'danger' },
  }

  /** 格式化 ISO 日期为 yyyy-MM-dd HH:mm:ss */
  function formatDate(iso: string): string {
    if (!iso) return '-'
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  // 搜索表单
  const searchForm = ref({
    // @ts-ignore
      nameSelector: '',
    status: '' as string | number,
    userId: '',
  })

  // 弹窗
  const dialogVisible = ref(false)
  const dialogType = ref<'add' | 'edit'>('add')
  const dialogFormRef = ref<FormInstance>()
  const submitting = ref(false)
  const dialogForm = ref({
    name: '',
    status: 0,
    userId: '',
    description: '',
    id: 0,
    resourceVersion: 0,
  })

  const dialogRules: FormRules = {
    name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
    userId: [{ required: true, message: '请输入用户ID', trigger: 'blur' }],
  }

  const {
    columns,
    data,
    loading,
    pagination,
    getData,
    replaceSearchParams,
    resetSearchParams,
    handleSizeChange,
    handleCurrentChange,
    refreshData,
  } = useTable({
    core: {
      apiFn: async (params: { current: number; size: number }) => {
        const { total, items } = await fetchAgentList({
          page: params.current,
          limit: params.size,
          // @ts-ignore
      nameSelector: searchForm.value.nameSelector || undefined,
          userId: searchForm.value.userId ? Number(searchForm.value.userId) : undefined,
          status: searchForm.value.status !== '' ? Number(searchForm.value.status) : undefined,
        })
        return {
          code: 200,
          data: { records: items, total, current: params.current, size: params.size },
        }
      },
      columnsFactory: () => [
        { type: 'selection', width: 50 },
        {
          prop: 'name',
          label: '名称',
          minWidth: 140,
          formatter: (row: AgentItem) =>
            h('span', { style: 'font-size:12px' }, row.name || '-'),
        },
        {
          prop: 'status',
          label: '状态',
          width: 90,
          formatter: (row: AgentItem) => {
            const cfg = STATUS_CONFIG[row.status] ?? { label: '未知', type: 'info' as const }
            return h(ElTag, { type: cfg.type, size: 'small' }, () => cfg.label)
          },
        },
        {
          prop: 'userId',
          label: '用户ID',
          width: 100,
          formatter: (row: AgentItem) =>
            h('span', { style: 'font-size:12px' }, String(row.userId)),
        },
        {
          prop: 'lastReportTime',
          label: '上次上报时间',
          width: 170,
          formatter: (row: AgentItem) =>
            h('span', { style: 'font-size:12px' }, formatDate(row.lastReportTime)),
        },
        {
          prop: 'description',
          label: '描述',
          minWidth: 160,
          showOverflowTooltip: true,
          formatter: (row: AgentItem) =>
            h('span', { style: 'font-size:12px' }, row.description || '-'),
        },
        {
          prop: 'operation',
          label: '操作',
          width: 120,
          fixed: 'right',
          formatter: (row: AgentItem) =>
            h('div', [
              h(ArtButtonTable, {
                type: 'edit',
                onClick: () => openDialog('edit', row),
              }),
              h(ArtButtonTable, {
                type: 'delete',
                onClick: () => handleDelete(row),
              }),
            ]),
        },
      ],
    },
  })

  const selectedRows = ref<AgentItem[]>([])

  function handleSearch() {
    replaceSearchParams({
      // @ts-ignore
      nameSelector: searchForm.value.nameSelector.trim() || undefined,
      userId: searchForm.value.userId ? Number(searchForm.value.userId) : undefined,
      status: searchForm.value.status !== '' ? Number(searchForm.value.status) : undefined,
    })
    getData()
  }

  function handleReset() {
    searchForm.value = { // @ts-ignore
      nameSelector: '', status: '', userId: '' }
    resetSearchParams()
  }

  function openDialog(type: 'add' | 'edit', row?: AgentItem) {
    dialogType.value = type
    if (type === 'edit' && row) {
      dialogForm.value = {
        name: row.name,
        status: row.status,
        userId: String(row.userId),
        description: row.description,
        id: row.id,
        resourceVersion: row.resourceVersion,
      }
    } else {
      dialogForm.value = {
        name: '',
        status: 0,
        userId: '',
        description: '',
        id: 0,
        resourceVersion: 0,
      }
    }
    dialogVisible.value = true
  }

  async function handleSubmit() {
    if (!dialogFormRef.value) return
    const valid = await dialogFormRef.value.validate().catch(() => false)
    if (!valid) return

    submitting.value = true
    try {
      if (dialogType.value === 'add') {
        await fetchCreateAgent({
          name: dialogForm.value.name,
          status: dialogForm.value.status,
          userId: Number(dialogForm.value.userId),
          description: dialogForm.value.description,
        })
        ElMessage.success('创建成功')
      } else {
        await fetchUpdateAgent(dialogForm.value.id, {
          name: dialogForm.value.name,
          status: dialogForm.value.status,
          description: dialogForm.value.description,
          resourceVersion: dialogForm.value.resourceVersion,
        })
        ElMessage.success('更新成功')
      }
      dialogVisible.value = false
      refreshData()
    } catch (e: any) {
      ElMessage.error(e.message || '操作失败')
    } finally {
      submitting.value = false
    }
  }

  function handleSelectionChange(rows: AgentItem[]) {
    selectedRows.value = rows
  }

  function handleDelete(row: AgentItem) {
    ElMessageBox.confirm(`确定要删除 Agent「${row.name}」吗？`, '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }).then(async () => {
      try {
        await fetchDeleteAgent(row.id)
        ElMessage.success('删除成功')
        refreshData()
      } catch (e: any) {
        ElMessage.error(e.message || '删除失败')
      }
    }).catch(() => {})
  }
</script>

<style scoped>
  .search-card :deep(.el-card__body) {
    padding-bottom: 0;
  }

  .search-form {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .search-form-left {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
  }

  .search-form-actions {
    margin-left: auto;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .agent-page .art-table .el-table {
    font-size: 13px;
  }

  .agent-page .art-table .el-table th.el-table__cell {
    font-size: 13px;
  }
</style>

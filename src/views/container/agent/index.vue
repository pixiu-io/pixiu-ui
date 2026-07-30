<template>
  <div class="agent-page art-full-height">
    <ElAlert
      v-if="alertVisible"
      type="info"
      closable
      show-icon
      class="quota-alert"
      style="margin: 5px 0 20px 0"
      description="管理 Pixiu Agent，支持部署代理和集群代理。创建后可将 Token 下发到目标节点启动 Agent。"
      @close="alertVisible = false"
    />

    <div class="agent-toolbar" :class="{ 'agent-toolbar--no-alert': !alertVisible }">
      <ElButton v-ripple @click="openAddDialog">新增Agent</ElButton>
      <div class="agent-toolbar__right">
        <ElInput
          v-model="searchForm.name"
          clearable
          placeholder="请输入代理名称"
          class="agent-toolbar__search"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
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
        :pagination-options="{ align: 'right', hideOnEmpty: false }"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />
    </ElCard>

    <ElDialog v-model="addVisible" title="新增代理" width="560px" align-center destroy-on-close class="agent-dialog" @closed="resetForm">
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="80px">
        <ElFormItem label="名称" prop="name">
          <ElInput v-model="form.name" placeholder="请输入代理名称" clearable />
        </ElFormItem>
        <ElFormItem label="类型" prop="type">
          <ElRadioGroup v-model="form.type" class="kube-mode-group">
            <ElRadioButton :value="0">部署代理</ElRadioButton>
            <ElRadioButton :value="1">集群代理</ElRadioButton>
          </ElRadioGroup>
        </ElFormItem>
        <ElFormItem label="描述">
          <ElInput v-model="form.description" type="textarea" :rows="3" placeholder="可选" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="addVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="submitLoading" @click="handleSubmit">确定</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="editVisible" title="编辑代理" width="560px" align-center destroy-on-close class="agent-dialog" @closed="resetEditForm">
      <ElForm ref="editFormRef" :model="editForm" :rules="rules" label-width="80px">
        <ElFormItem label="名称" prop="name">
          <ElInput v-model="editForm.name" placeholder="请输入代理名称" clearable />
        </ElFormItem>
        <ElFormItem label="描述">
          <ElInput v-model="editForm.description" type="textarea" :rows="3" placeholder="可选" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="editVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="editLoading" @click="handleEditSubmit">确定</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="tokenVisible" title="查看凭证" width="560px" align-center destroy-on-close class="agent-dialog">
      <div class="token-dialog-body">
        <ElInput v-model="tokenValue" type="textarea" :rows="4" readonly resize="none" />
        <div class="token-dialog-tip">将 Token 配置到目标节点环境变量后启动 Agent。</div>
      </div>
      <template #footer>
        <ElButton @click="tokenVisible = false">关闭</ElButton>
        <ElButton type="primary" @click="copyToken">复制 Token</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
import { h, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { useTable } from '@/hooks/core/useTable'
import { useSkipFirstActivatedRefresh } from '@/hooks/core/useSkipFirstActivatedRefresh'
import {
  fetchAgentList,
  fetchAgentDetail,
  fetchCreateAgent,
  fetchUpdateAgent,
  fetchDeleteAgent,
  type AgentItem
} from '@/api/agent'

defineOptions({ name: 'ContainerAgent' })

const alertVisible = ref(true)
const addVisible = ref(false)
const editVisible = ref(false)
const submitLoading = ref(false)
const editLoading = ref(false)
const formRef = ref<FormInstance>()
const editFormRef = ref<FormInstance>()
const form = ref({ name: '', type: 0, description: '' })
const editForm = ref({ name: '', description: '' })
const editRow = ref<AgentItem | null>(null)
const rules: FormRules = { name: [{ required: true, message: '请输入名称', trigger: 'blur' }] }

const searchForm = ref({ name: undefined as string | undefined })

function resetForm() {
  form.value = { name: '', type: 0, description: '' }
  formRef.value?.resetFields()
}

function openAddDialog() {
  addVisible.value = true
}

function resetEditForm() {
  editForm.value = { name: '', description: '' }
  editRow.value = null
  editFormRef.value?.resetFields()
}

function openEditDialog(row: AgentItem) {
  editRow.value = row
  editForm.value = { name: row.name, description: row.description || '' }
  editVisible.value = true
}

const tokenVisible = ref(false)
const tokenValue = ref('')

async function showToken(row: AgentItem) {
  tokenVisible.value = true
  tokenValue.value = '加载中...'
  try {
    const detail = await fetchAgentDetail(row.id)
    tokenValue.value = detail.token || '无'
  } catch {
    tokenValue.value = '获取失败'
  }
}

function copyToken() {
  if (tokenValue.value && tokenValue.value !== '获取失败' && tokenValue.value !== '无' && tokenValue.value !== '加载中...') {
    navigator.clipboard.writeText(tokenValue.value)
    ElMessage.success('已复制')
  }
}

async function handleEditSubmit() {
  if (!editFormRef.value || !editRow.value) return
  await editFormRef.value.validate(async (valid) => {
    if (!valid) return
    editLoading.value = true
    try {
      await fetchUpdateAgent(editRow.value!.id, editRow.value!.resourceVersion, {
        name: editForm.value.name.trim(),
        description: editForm.value.description.trim()
      })
      ElMessage.success('更新成功')
      editVisible.value = false
      refreshData()
    } catch (e: any) {
      ElMessage.error(e?.message || '更新失败')
    } finally {
      editLoading.value = false
    }
  })
}

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    submitLoading.value = true
    try {
      await fetchCreateAgent(form.value.name.trim(), form.value.type, form.value.description.trim())
      ElMessage.success('创建成功')
      addVisible.value = false
      refreshData()
    } catch (e: any) {
      ElMessage.error(e?.message || '创建失败')
    } finally {
      submitLoading.value = false
    }
  })
}

async function handleDelete(row: AgentItem) {
  try {
    await ElMessageBox.confirm(`确定删除代理「${row.name}」吗？`, '提示', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })
  } catch { return }
  try {
    await fetchDeleteAgent(row.id)
    ElMessage.success('删除成功')
    refreshData()
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

function formatDateTime(raw?: string) {
  if (!raw) return '-'
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const {
  columns, columnChecks, data, loading, pagination, handleSizeChange, handleCurrentChange, refreshData
} = useTable({
  core: {
    apiFn: async (params: { current: number; size: number; name?: string }) => {
      const { total, items } = await fetchAgentList({ page: params.current, limit: params.size, nameSelector: params.name })
      return { code: 200, data: { records: items, total, current: params.current, size: params.size } }
    },
    apiParams: { current: 1, size: 10 },
    columnsFactory: () => [
      { type: 'selection', width: 30 },
      { prop: 'name', label: '名称', minWidth: 180, formatter: (row: AgentItem) => h('span', { style: 'font-size:12px' }, row.name || '-') },
      { prop: 'status', label: '状态', width: 100, formatter: (row: AgentItem) => {
        const online = row.status === 1
        return h('div', { style: 'display:flex;align-items:center;gap:4px' }, [
          h('span', { style: `width:8px;height:8px;border-radius:50%;background:${online ? '#16a34a' : '#9ca3af'};flex-shrink:0` }),
          h('span', { style: 'font-size:12px' }, online ? '在线' : '离线')
        ])
      }},
      { prop: 'type', label: '类型', width: 100, formatter: (row: AgentItem) => h('span', { style: 'font-size:12px' }, row.type === 1 ? '集群代理' : '部署代理') },
      { prop: 'hostname', label: '主机名', minWidth: 140, formatter: (row: AgentItem) => h('span', { style: 'font-size:12px' }, row.hostname || '-') },
      { prop: 'version', label: '版本', width: 100, formatter: (row: AgentItem) => h('span', { style: 'font-size:12px' }, row.version || '-') },
      { prop: 'lastHeartbeat', label: '上次同步时间', minWidth: 170, formatter: (row: AgentItem) => h('span', { style: 'font-size:12px' }, formatDateTime(row.lastHeartbeat)) },
      { prop: 'gmtCreate', label: '创建时间', minWidth: 170, formatter: (row: AgentItem) => h('span', { style: 'font-size:12px' }, formatDateTime(row.gmtCreate)) },
      {
        prop: 'operation', label: '操作', width: 160, fixed: 'right',
        formatter: (row: AgentItem) => h('div', { style: 'display:flex;align-items:center;gap:8px' }, [
          h('span', { style: 'font-size:12px;color:var(--el-color-primary);cursor:pointer', onClick: () => showToken(row) }, '查看凭证'),
          h('span', { style: 'font-size:12px;color:var(--el-color-primary);cursor:pointer', onClick: () => openEditDialog(row) }, '编辑'),
          h('span', { style: 'font-size:12px;color:var(--el-color-primary);cursor:pointer', onClick: () => handleDelete(row) }, '删除')
        ])
      }
    ]
  }
})

useSkipFirstActivatedRefresh(refreshData)

function handleSearch() {
  refreshData()
}
</script>

<style>
.agent-page .art-table .el-table { font-size: 13px; }
.agent-page .art-table .el-scrollbar__bar { display: none; }
.agent-page .el-table__row:hover .icon-action {
  opacity: 1;
}
.agent-dialog .el-dialog__body { padding: 10px 16px 12px 16px; }
.agent-dialog .el-form-item__label { font-size: 12px; color: var(--el-text-color-regular); padding-right: 12px; }
.agent-dialog .el-input__inner,
.agent-dialog .el-textarea__inner { font-size: 12px; }
.agent-dialog .el-form-item__content { max-width: 400px; }
</style>

<style scoped>
.agent-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; flex-shrink: 0; gap: 12px; }
.agent-toolbar--no-alert { margin-top: 10px; }
.agent-toolbar__right { display: flex; align-items: center; gap: 8px; }
.agent-toolbar__search { width: 280px; max-width: 100%; }
.agent-page :deep(.art-table-card) { flex: 1; min-height: 0; }
.agent-page :deep(.art-table-card > .el-card__body) { padding-top: 12px; padding-bottom: 10px; }
.agent-page :deep(.custom-pagination) { margin-top: 10px; margin-bottom: 0; padding-bottom: 4px; }

.token-dialog-body { display: flex; flex-direction: column; gap: 10px; }
.token-dialog-tip { font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.5; }

.kube-mode-group {
  display: flex;
  width: 200px;
  min-width: 200px;
  max-width: 200px;
  overflow: hidden;
  box-sizing: border-box;
  margin-top: 0;
  margin-bottom: 0;
}
.kube-mode-group :deep(.el-radio-button) { flex: 1 1 0; min-width: 0; display: flex; }
.kube-mode-group :deep(.el-radio-button__inner) {
  display: flex; flex: 1; align-items: center; justify-content: center;
  width: 100%; box-sizing: border-box; text-align: center;
  font-size: 12px; padding: 0 10px; line-height: 10px; font-weight: 400;
  color: var(--el-text-color-regular); background: transparent;
  border: 1px solid var(--el-border-color); border-radius: 0 !important;
  transition: border-color 0.15s, color 0.15s, background-color 0.15s;
}
.kube-mode-group :deep(.el-radio-button:first-child .el-radio-button__inner),
.kube-mode-group :deep(.el-radio-button:last-child .el-radio-button__inner) { border-radius: 0 !important; }
.kube-mode-group :deep(.el-radio-button__inner:hover) { border-color: var(--el-color-primary); color: var(--el-color-primary); }
.kube-mode-group :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background-color: var(--el-bg-color-overlay) !important; color: var(--el-color-primary) !important;
  font-weight: 500 !important; border-color: var(--el-color-primary) !important;
  box-shadow: none !important; position: relative; z-index: 1;
}
</style>

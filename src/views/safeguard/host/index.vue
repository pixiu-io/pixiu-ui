<template>
  <div class="host-page art-full-height">
    <HostSearch v-model="searchForm" @search="handleSearch" @reset="handleReset" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="handleTableRefresh">
        <template #left>
          <ElButton v-ripple @click="openAddNodeDialog">新增节点</ElButton>
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

    <!-- 新增节点 -->
    <ElDialog
      v-model="addNodeVisible"
      title="新增节点"
      width="520px"
      align-center
      destroy-on-close
      :close-on-click-modal="false"
      class="host-node-dialog--form"
      @closed="resetAddNodeForm"
    >
      <ElForm
        ref="addNodeFormRef"
        class="host-node-form"
        :model="addNodeForm"
        :rules="addNodeRules"
        label-width="100px"
        label-position="right"
      >
        <ElFormItem label="主机名称" prop="name">
          <ElInput v-model="addNodeForm.name" clearable placeholder="小写字母、数字、中划线" />
        </ElFormItem>
        <ElFormItem label="IP 地址" prop="ip">
          <ElInput v-model="addNodeForm.ip" clearable />
        </ElFormItem>
        <ElFormItem label="认证方式" prop="authType">
          <ElRadioGroup v-model="addNodeForm.authType">
            <ElRadio value="password">密码</ElRadio>
            <ElRadio value="key">密钥</ElRadio>
          </ElRadioGroup>
        </ElFormItem>
        <ElFormItem label="用户名">
          <span class="host-add-node-fixed-user">root</span>
        </ElFormItem>
        <template v-if="addNodeForm.authType === 'password'">
          <ElFormItem label="密码" prop="password">
            <ElInput v-model="addNodeForm.password" type="password" show-password />
          </ElFormItem>
        </template>
        <template v-else>
          <ElFormItem label="私钥" prop="privateKey">
            <ElInput
              v-model="addNodeForm.privateKey"
              type="textarea"
              :rows="6"
              placeholder="请粘贴 SSH 私钥内容（PEM 格式）"
              spellcheck="false"
            />
          </ElFormItem>
        </template>
      </ElForm>
      <template #footer>
        <ElButton @click="addNodeVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="addNodeSubmitting" @click="submitAddNode">确定</ElButton>
      </template>
    </ElDialog>

    <!-- 编辑节点（PUT /pixiu/nodes/:nodeId） -->
    <ElDialog
      v-model="editNodeVisible"
      title="编辑节点"
      width="520px"
      align-center
      destroy-on-close
      :close-on-click-modal="false"
      class="host-node-dialog--form"
      @closed="resetEditNodeForm"
    >
      <ElForm
        ref="editNodeFormRef"
        class="host-node-form"
        :model="editNodeForm"
        :rules="editNodeRules"
        label-width="100px"
        label-position="right"
      >
        <ElFormItem label="主机名称" prop="name">
          <ElInput v-model="editNodeForm.name" clearable />
        </ElFormItem>
        <ElFormItem label="IP 地址" prop="ip">
          <ElInput v-model="editNodeForm.ip" clearable />
        </ElFormItem>
        <ElFormItem label="认证方式" prop="authType">
          <ElRadioGroup v-model="editNodeForm.authType">
            <ElRadio value="password">密码</ElRadio>
            <ElRadio value="key">密钥</ElRadio>
          </ElRadioGroup>
        </ElFormItem>
        <ElFormItem label="用户名">
          <span class="host-add-node-fixed-user">root</span>
        </ElFormItem>
        <template v-if="editNodeForm.authType === 'password'">
          <ElFormItem label="密码" prop="password">
            <ElInput v-model="editNodeForm.password" type="password" show-password />
          </ElFormItem>
        </template>
        <template v-else>
          <ElFormItem label="私钥" prop="privateKey">
            <ElInput
              v-model="editNodeForm.privateKey"
              type="textarea"
              :rows="6"
              placeholder="请粘贴 SSH 私钥内容（PEM 格式）"
              spellcheck="false"
            />
          </ElFormItem>
        </template>
      </ElForm>
      <template #footer>
        <ElButton @click="editNodeVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="editNodeSubmitting" @click="submitEditNode">确定</ElButton>
      </template>
    </ElDialog>

    <HostRemoteSsh ref="hostRemoteSshRef" />
  </div>
</template>

<script setup lang="ts">
  import { h, nextTick, onActivated, reactive, ref } from 'vue'
  import { CopyDocument } from '@element-plus/icons-vue'
  import { ElLink, ElMessage, ElMessageBox, ElTag } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'
  import ArtButtonMore, { type ButtonMoreItem } from '@/components/core/forms/art-button-more/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import {
    fetchCreatePixiuNode,
    fetchDeletePixiuNode,
    fetchPixiuNodeList,
    fetchUpdatePixiuNode,
    type PixiuNodeItem
  } from '@/api/node'
  import { fetchPlanList, fetchPlanWithResources } from '@/api/plan'
  import { useRoute } from 'vue-router'
  import HostSearch from './modules/host-search.vue'
  import HostRemoteSsh from './modules/host-remote-ssh.vue'

  defineOptions({ name: 'SafeguardHost' })

  const route = useRoute()
  const hostRemoteSshRef = ref<InstanceType<typeof HostRemoteSsh> | null>(null)

  const searchForm = ref<{ hostName?: string }>({})
  const selectedRows = ref<PixiuNodeItem[]>([])

  function handleSelectionChange(rows: PixiuNodeItem[]) {
    selectedRows.value = rows
  }

  function authTypeLabelFromJson(authStr: string): string {
    try {
      const o = JSON.parse(authStr) as { type?: string }
      return authTypeLabel(o?.type)
    } catch {
      return '—'
    }
  }

  function authTypeLabel(t?: string): string {
    if (t === 'password') return '密码'
    if (t === 'key') return '密钥'
    if (t === 'none') return '无'
    return t?.trim() ? String(t) : '—'
  }

  function authTagType(t?: string): 'success' | 'warning' | 'info' {
    if (t === 'password') return 'success'
    if (t === 'key') return 'warning'
    return 'info'
  }

  function parseAuthForForm(authStr: string): {
    authType: 'password' | 'key'
    password: string
    privateKey: string
  } {
    try {
      const o = JSON.parse(authStr) as {
        type?: string
        password?: { user?: string; password?: string }
        key?: { data?: string }
      }
      if (o.type === 'key') {
        return { authType: 'key', password: '', privateKey: o.key?.data ?? '' }
      }
      return {
        authType: 'password',
        password: o.password?.password ?? '',
        privateKey: ''
      }
    } catch {
      return { authType: 'password', password: '', privateKey: '' }
    }
  }

  /** 无下拉时：URL ?planId= 或全平台仅 1 个部署计划 */
  async function resolvePlanIdForCreate(): Promise<number | null> {
    const raw = route.query.planId
    const s = Array.isArray(raw) ? raw[0] : raw
    const fromQuery = Number(s)
    if (Number.isFinite(fromQuery) && fromQuery > 0) return Math.trunc(fromQuery)
    try {
      const { list } = await fetchPlanList({ page: 1, limit: 2 })
      if (list.length === 1) return list[0].id
    } catch {
      /* ignore */
    }
    return null
  }

  /** —— 新增节点 —— */
  const addNodeVisible = ref(false)
  const addNodeFormRef = ref<FormInstance>()
  const addNodeSubmitting = ref(false)

  const addNodeEmpty = () => ({
    name: '',
    ip: '',
    authType: 'password' as 'password' | 'key',
    password: '',
    privateKey: ''
  })

  const addNodeForm = reactive(addNodeEmpty())

  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/

  const addNodeRules: FormRules = {
    name: [
      { required: true, message: '请输入主机名称', trigger: 'blur' },
      {
        validator: (_r, value: string, cb) => {
          const hostname = String(value ?? '').trim()
          const hostnamePattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
          if (!hostnamePattern.test(hostname)) {
            cb(
              new Error(
                '主机名称需符合 Linux 规范：1-63 位，小写字母/数字/中划线，且不能以中划线开头或结尾'
              )
            )
            return
          }
          cb()
        },
        trigger: 'blur'
      }
    ],
    ip: [
      { required: true, message: '请输入 IP 地址', trigger: 'blur' },
      {
        validator: (_r, value: string, cb) => {
          if (!ipPattern.test(value)) cb(new Error('请输入有效的 IP 地址'))
          else cb()
        },
        trigger: 'blur'
      }
    ],
    authType: [{ required: true, message: '请选择认证方式', trigger: 'change' }],
    password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
    privateKey: [{ required: true, message: '请粘贴私钥内容', trigger: 'blur' }]
  }

  function openAddNodeDialog() {
    Object.assign(addNodeForm, addNodeEmpty())
    addNodeVisible.value = true
    nextTick(() => addNodeFormRef.value?.clearValidate())
  }

  function resetAddNodeForm() {
    Object.assign(addNodeForm, addNodeEmpty())
    addNodeFormRef.value?.clearValidate()
  }

  async function submitAddNode() {
    if (!addNodeFormRef.value || addNodeSubmitting.value) return
    const valid = await addNodeFormRef.value
      .validate()
      .then(() => true)
      .catch(() => false)
    if (!valid) return

    const planId = await resolvePlanIdForCreate()
    if (planId == null) {
      ElMessage.warning(
        '无法确定部署计划：请在地址栏增加 ?planId=计划ID（数字），或确保系统中仅存在一个部署计划'
      )
      return
    }

    addNodeSubmitting.value = true
    try {
      const resources = await fetchPlanWithResources(planId)
      const rt = resources.config?.runtime?.runtime
      const cri = rt === 'docker' || rt === 'containerd' ? rt : 'containerd'

      const auth =
        addNodeForm.authType === 'password'
          ? {
              type: 'password' as const,
              password: { user: 'root', password: addNodeForm.password }
            }
          : { type: 'key' as const, key: { data: addNodeForm.privateKey } }

      await fetchCreatePixiuNode({
        name: addNodeForm.name.trim(),
        plan_id: planId,
        role: ['node'],
        cri,
        ip: addNodeForm.ip.trim(),
        auth
      })
      ElMessage.success('新增节点成功')
      addNodeVisible.value = false
      await refreshData()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '新增节点失败'
      ElMessage.error(msg)
    } finally {
      addNodeSubmitting.value = false
    }
  }

  /** —— 编辑节点 —— */
  const editNodeVisible = ref(false)
  const editNodeFormRef = ref<FormInstance>()
  const editNodeSubmitting = ref(false)
  const editingNodeId = ref(0)
  const editingResourceVersion = ref(0)
  const editingPlanId = ref(0)
  const editingNodeRole = ref<string[]>(['node'])
  const editingNodeCri = ref<'docker' | 'containerd'>('containerd')

  const editNodeEmpty = () => ({
    name: '',
    ip: '',
    authType: 'password' as 'password' | 'key',
    password: '',
    privateKey: ''
  })

  const editNodeForm = reactive(editNodeEmpty())

  const editNodeRules: FormRules = {
    name: [{ required: true, message: '请输入主机名称', trigger: 'blur' }],
    ip: [
      { required: true, message: '请输入 IP 地址', trigger: 'blur' },
      {
        validator: (_r, value: string, cb) => {
          if (!ipPattern.test(value)) cb(new Error('请输入有效的 IP 地址'))
          else cb()
        },
        trigger: 'blur'
      }
    ],
    authType: [{ required: true, message: '请选择认证方式', trigger: 'change' }],
    password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
    privateKey: [{ required: true, message: '请粘贴私钥内容', trigger: 'blur' }]
  }

  function openEditNodeDialog(row: PixiuNodeItem) {
    editingNodeId.value = row.id
    const rv = row.resource_version
    editingResourceVersion.value =
      typeof rv === 'number' && !Number.isNaN(rv) ? rv : 0
    const parsed = parseAuthForForm(row.auth || '{}')
    const roles = row.role
      ? row.role
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : []
    editingPlanId.value = row.plan_id
    editingNodeRole.value = roles.length ? roles : ['node']
    editingNodeCri.value = row.cri === 'docker' ? 'docker' : 'containerd'
    Object.assign(editNodeForm, {
      name: row.name,
      ip: row.ip,
      authType: parsed.authType,
      password: parsed.password,
      privateKey: parsed.privateKey
    })
    editNodeVisible.value = true
    nextTick(() => editNodeFormRef.value?.clearValidate())
  }

  function resetEditNodeForm() {
    Object.assign(editNodeForm, editNodeEmpty())
    editingNodeId.value = 0
    editingResourceVersion.value = 0
    editingPlanId.value = 0
    editingNodeRole.value = ['node']
    editingNodeCri.value = 'containerd'
    editNodeFormRef.value?.clearValidate()
  }

  async function submitEditNode() {
    if (!editNodeFormRef.value || editNodeSubmitting.value || !editingNodeId.value) return
    const valid = await editNodeFormRef.value
      .validate()
      .then(() => true)
      .catch(() => false)
    if (!valid) return

    editNodeSubmitting.value = true
    try {
      const auth =
        editNodeForm.authType === 'password'
          ? {
              type: 'password' as const,
              password: { user: 'root', password: editNodeForm.password }
            }
          : { type: 'key' as const, key: { data: editNodeForm.privateKey } }

      await fetchUpdatePixiuNode(editingNodeId.value, {
        resource_version:
          typeof editingResourceVersion.value === 'number' &&
          !Number.isNaN(editingResourceVersion.value)
            ? editingResourceVersion.value
            : 0,
        name: editNodeForm.name.trim(),
        plan_id: editingPlanId.value,
        role: [...editingNodeRole.value],
        cri: editingNodeCri.value,
        ip: editNodeForm.ip.trim(),
        auth
      })
      ElMessage.success('更新成功')
      editNodeVisible.value = false
      await refreshData()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '更新失败'
      ElMessage.error(msg)
    } finally {
      editNodeSubmitting.value = false
    }
  }

  function hostMoreClick(item: ButtonMoreItem, row: PixiuNodeItem) {
    if (item.key === 'delete') void handleDeleteNode(row)
  }

  async function handleDeleteNode(row: PixiuNodeItem) {
    try {
      await ElMessageBox.confirm(`确定删除主机「${row.name}」吗？`, '删除确认', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
    try {
      await fetchDeletePixiuNode(row.id)
      ElMessage.success('已删除')
      await refreshData()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '删除失败'
      ElMessage.error(msg)
    }
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
      immediate: true,
      apiFn: async (params: { current: number; size: number; hostName?: string }) => {
        const { list, total } = await fetchPixiuNodeList({
          page: params.current,
          limit: params.size,
          nameSelector: params.hostName?.trim() || undefined,
          plan_id: undefined
        })
        return {
          code: 200,
          data: {
            records: list,
            total,
            current: params.current,
            size: params.size
          }
        }
      },
      apiParams: {
        current: 1,
        size: 10,
        hostName: undefined as string | undefined
      },
      columnsFactory: () => [
        { type: 'selection', width: 48 },
        {
          prop: 'name',
          label: '主机名称',
          minWidth: 200,
          formatter: (row: PixiuNodeItem) =>
            h('div', { style: 'display:flex;align-items:center;gap:4px' }, [
              h('span', { style: 'font-size:14px;color:var(--el-text-color-primary)' }, row.name),
              h(
                'span',
                {
                  class: 'icon-action',
                  style:
                    'cursor:pointer;color:var(--el-text-color-secondary);display:inline-flex;align-items:center',
                  title: '复制主机名称',
                  onClick: (e: MouseEvent) => {
                    e.stopPropagation()
                    void navigator.clipboard.writeText(row.name || '')
                    ElMessage.success('已复制')
                  }
                },
                [h(CopyDocument, { style: 'width:12px;height:12px' })]
              )
            ])
        },
        {
          prop: 'ip',
          label: 'IP',
          minWidth: 140,
          formatter: (row: PixiuNodeItem) =>
            h('div', { style: 'display:flex;align-items:center;gap:4px' }, [
              h(
                'span',
                { style: 'font-size:13px;font-family:var(--el-font-family-mono,monospace)' },
                row.ip || '—'
              ),
              ...(row.ip
                ? [
                    h(
                      'span',
                      {
                        class: 'icon-action',
                        style:
                          'cursor:pointer;color:var(--el-text-color-secondary);display:inline-flex;align-items:center',
                        title: '复制 IP',
                        onClick: (e: MouseEvent) => {
                          e.stopPropagation()
                          void navigator.clipboard.writeText(row.ip)
                          ElMessage.success('已复制')
                        }
                      },
                      [h(CopyDocument, { style: 'width:12px;height:12px' })]
                    )
                  ]
                : [])
            ])
        },
        {
          prop: 'auth',
          label: '认证类型',
          width: 120,
          formatter: (row: PixiuNodeItem) => {
            let t: string | undefined
            try {
              t = (JSON.parse(row.auth || '{}') as { type?: string }).type
            } catch {
              t = undefined
            }
            return h(ElTag, { type: authTagType(t), size: 'small' }, () => authTypeLabelFromJson(row.auth || ''))
          }
        },
        {
          prop: 'operation',
          label: '操作',
          width: 160,
          fixed: 'right',
          formatter: (row: PixiuNodeItem) =>
            h('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:nowrap' }, [
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () => hostRemoteSshRef.value?.open(row)
                },
                () => '远程登陆'
              ),
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () => openEditNodeDialog(row)
                },
                () => '编辑'
              ),
              h(ArtButtonMore, {
                list: [
                  {
                    key: 'delete',
                    label: '删除',
                    icon: 'ri:delete-back-2-line'
                  }
                ],
                onClick: (item: ButtonMoreItem) => hostMoreClick(item, row)
              })
            ])
        }
      ]
    }
  })

  function handleSearch(params: typeof searchForm.value) {
    replaceSearchParams({
      hostName: params.hostName
    })
    void getData()
  }

  function handleReset() {
    void resetSearchParams()
  }

  async function handleTableRefresh() {
    await refreshData()
  }

  onActivated(() => {
    void refreshData()
  })
</script>

<style>
  .host-page .icon-action {
    opacity: 0;
    transition: opacity 0.15s;
  }
  .host-page .el-table__row:hover .icon-action {
    opacity: 1;
  }
  .host-page .art-table .el-table {
    font-size: 13px;
  }
  .host-page .art-table .el-table th.el-table__cell {
    font-size: 13px;
  }
  .host-add-node-fixed-user {
    color: var(--el-text-color-regular);
  }

  /*
   * 与「导入集群」弹窗一致：body/footer 水平 16px 留白，表单项占满内容区（见 cluster-add-dialog.vue）。
   */
  .host-node-dialog--form .el-dialog__body {
    padding: 10px 16px 12px 16px !important;
    box-sizing: border-box;
  }
  .host-node-dialog--form .el-dialog__footer {
    padding: 12px 16px 16px 16px !important;
    box-sizing: border-box;
  }

  .host-node-form {
    padding-top: 12px;
  }
  .host-node-form :deep(.el-form-item) {
    margin-bottom: 18px;
  }
  .host-node-form :deep(.el-form-item__label) {
    font-size: 14px;
    color: var(--el-text-color-regular);
    padding-right: 12px;
  }
  .host-node-form :deep(.el-form-item__content) {
    flex-wrap: wrap;
  }
  .host-node-form :deep(.el-form-item__content .el-input),
  .host-node-form :deep(.el-form-item__content .el-textarea),
  .host-node-form :deep(.el-form-item__content .el-input-number) {
    width: 100%;
    max-width: 100%;
  }
</style>

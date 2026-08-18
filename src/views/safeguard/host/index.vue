<template>
  <div class="host-page art-full-height">
    <ElAlert
      v-if="alertVisible"
      type="info"
      closable
      show-icon
      class="quota-alert"
      style="margin: 5px 0 20px 0"
      description="管理主机节点，支持新增、编辑和删除节点。节点可用于自建集群部署与远程 SSH 连接。"
      @close="alertVisible = false"
    />

    <div class="host-toolbar" :class="{ 'host-toolbar--no-alert': !alertVisible }">
      <ElButton v-ripple @click="openAddNodeDialog">新增节点</ElButton>
      <div class="host-toolbar__right">
        <ElInput
          v-model="searchForm.hostName"
          clearable
          placeholder="请输入主机名称"
          class="host-toolbar__search"
          @keyup.enter="handleSearch(searchForm)"
          @clear="handleSearch(searchForm)"
        />
        <ArtTableHeader
          v-model:columns="columnChecks"
          :loading="loading"
          @refresh="handleTableRefresh"
        />
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
        @selection-change="handleSelectionChange"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />
    </ElCard>

    <!-- 新增节点 -->
    <ElDialog
      v-model="addNodeVisible"
      title="新增节点"
      width="510px"
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
        label-width="80px"
        label-position="right"
      >
        <ElFormItem label="主机名称" prop="name">
          <ElInput v-model="addNodeForm.name" clearable placeholder="小写字母、数字、中划线" />
        </ElFormItem>
        <ElFormItem label="IP 地址" prop="ip">
          <ElInput v-model="addNodeForm.ip" clearable />
        </ElFormItem>
        <ElFormItem label="认证方式" prop="authType">
          <ElRadioGroup v-model="addNodeForm.authType" class="host-node-auth-group">
            <ElRadio value="password">密码</ElRadio>
            <ElRadio value="key">密钥</ElRadio>
          </ElRadioGroup>
        </ElFormItem>
        <template v-if="addNodeForm.authType === 'password'">
          <ElFormItem label="SSH 用户" prop="user">
            <ElInput v-model="addNodeForm.user" clearable placeholder="请输入 SSH 登录用户" />
          </ElFormItem>
          <ElFormItem label="SSH 密码" prop="password">
            <ElInput v-model="addNodeForm.password" type="password" show-password />
          </ElFormItem>
        </template>
        <template v-else>
          <ElFormItem label="SSH 用户">
            <ElInput model-value="root" disabled />
          </ElFormItem>
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
        <ElFormItem class="host-node-advanced-toggle-item">
          <template #label>
            <ElButton link type="primary" @click="addNodeAdvancedVisible = !addNodeAdvancedVisible">
              高级选项
            </ElButton>
          </template>
        </ElFormItem>
        <template v-if="addNodeAdvancedVisible">
          <ElFormItem label="SSH 端口" prop="port">
            <ElInputNumber v-model="addNodeForm.port" :min="1" :max="65535" />
          </ElFormItem>
          <ElFormItem
            v-if="addNodeForm.authType === 'password' && addNodeForm.user.trim() !== 'root'"
            label-width="0"
            class="host-node-sudo-tip"
          >
            <ElAlert
              type="info"
              :closable="false"
              show-icon
              class="quota-alert"
              description="非 root 用户须具备 sudo 权限（免密或密码与 SSH 密码相同）。"
            />
          </ElFormItem>
        </template>
      </ElForm>
      <template #footer>
        <div class="host-node-footer">
          <ElButton :loading="addNodeTesting" @click="testAddNodeConnectivity">测试联通</ElButton>
          <div class="host-node-footer__right">
            <ElButton @click="addNodeVisible = false">取消</ElButton>
            <ElButton type="primary" :loading="addNodeSubmitting" @click="submitAddNode"
              >确定</ElButton
            >
          </div>
        </div>
      </template>
    </ElDialog>

    <!-- 编辑节点（PUT /pixiu/nodes/:nodeId） -->
    <ElDialog
      v-model="editNodeVisible"
      title="编辑节点"
      width="510px"
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
        label-width="80px"
        label-position="right"
      >
        <ElFormItem label="主机名称" prop="name">
          <ElInput v-model="editNodeForm.name" clearable />
        </ElFormItem>
        <ElFormItem label="IP 地址" prop="ip">
          <ElInput v-model="editNodeForm.ip" clearable />
        </ElFormItem>
        <ElFormItem label="认证方式" prop="authType">
          <ElRadioGroup v-model="editNodeForm.authType" class="host-node-auth-group">
            <ElRadio value="password">密码</ElRadio>
            <ElRadio value="key">密钥</ElRadio>
          </ElRadioGroup>
        </ElFormItem>
        <template v-if="editNodeForm.authType === 'password'">
          <ElFormItem label="SSH 用户" prop="user">
            <ElInput v-model="editNodeForm.user" clearable placeholder="请输入 SSH 登录用户" />
          </ElFormItem>
          <ElFormItem label="SSH 密码" prop="password">
            <ElInput v-model="editNodeForm.password" type="password" show-password />
          </ElFormItem>
        </template>
        <template v-else>
          <ElFormItem label="SSH 用户">
            <ElInput model-value="root" disabled />
          </ElFormItem>
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
        <ElFormItem class="host-node-advanced-toggle-item">
          <template #label>
            <ElButton
              link
              type="primary"
              @click="editNodeAdvancedVisible = !editNodeAdvancedVisible"
            >
              高级选项
            </ElButton>
          </template>
        </ElFormItem>
        <template v-if="editNodeAdvancedVisible">
          <ElFormItem label="SSH 端口" prop="port">
            <ElInputNumber v-model="editNodeForm.port" :min="1" :max="65535" />
          </ElFormItem>
          <ElFormItem
            v-if="editNodeForm.authType === 'password' && editNodeForm.user.trim() !== 'root'"
            label-width="0"
            class="host-node-sudo-tip"
          >
            <ElAlert
              type="info"
              :closable="false"
              show-icon
              class="quota-alert"
              description="非 root 用户须具备 sudo 权限（免密或密码与 SSH 密码相同）。"
            />
          </ElFormItem>
        </template>
      </ElForm>
      <template #footer>
        <div class="host-node-footer">
          <ElButton :loading="editNodeTesting" @click="testEditNodeConnectivity">测试联通</ElButton>
          <div class="host-node-footer__right">
            <ElButton @click="editNodeVisible = false">取消</ElButton>
            <ElButton type="primary" :loading="editNodeSubmitting" @click="submitEditNode"
              >确定</ElButton
            >
          </div>
        </div>
      </template>
    </ElDialog>

    <HostRemoteSsh ref="hostRemoteSshRef" />
  </div>
</template>

<script setup lang="ts">
  import { h, nextTick, reactive, ref } from 'vue'
  import { CopyDocument } from '@element-plus/icons-vue'
  import { ElAlert, ElInput, ElLink, ElMessage, ElMessageBox } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'
  import ArtButtonMore, {
    type ButtonMoreItem
  } from '@/components/core/forms/art-button-more/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { useSkipFirstActivatedRefresh } from '@/hooks/core/useSkipFirstActivatedRefresh'
  import {
    fetchCreatePixiuNode,
    fetchDeletePixiuNode,
    fetchNodeConnectivity,
    fetchNodeConnectivityByAuth,
    fetchPixiuNodeList,
    fetchUpdatePixiuNode,
    type NodeAuthResult,
    type PixiuNodeItem
  } from '@/api/node'
  import { PixiuApiError } from '@/api/container'
  import HostRemoteSsh from './modules/host-remote-ssh.vue'

  defineOptions({ name: 'SafeguardHost' })

  const hostRemoteSshRef = ref<InstanceType<typeof HostRemoteSsh> | null>(null)

  const searchForm = ref<{ hostName?: string }>({})
  const alertVisible = ref(true)
  const selectedRows = ref<PixiuNodeItem[]>([])

  function handleSelectionChange(rows: PixiuNodeItem[]) {
    selectedRows.value = rows
  }

  function authTypeLabelFromJson(auth?: NodeAuthResult | null): string {
    return authTypeLabel(auth?.type)
  }

  function authTypeLabel(t?: string): string {
    if (t === 'password') return '密码'
    if (t === 'key') return '密钥'
    if (t === 'none') return '无'
    return t?.trim() ? String(t) : '-'
  }

  function parseAuthForForm(auth?: NodeAuthResult | null): {
    authType: 'password' | 'key'
    user: string
    port: number
    password: string
    privateKey: string
  } {
    if (!auth) {
      return { authType: 'password', user: 'root', port: 22, password: '', privateKey: '' }
    }
    if (auth.type === 'key') {
      return {
        authType: 'key',
        user: 'root',
        port: normalizeSSHPort(auth.port),
        password: '',
        privateKey: ''
      }
    }
    return {
      authType: 'password',
      user: 'root',
      port: normalizeSSHPort(auth.port),
      password: '',
      privateKey: ''
    }
  }

  function normalizeSSHPort(port: unknown): number {
    const value = Number(port)
    return Number.isInteger(value) && value >= 1 && value <= 65535 ? value : 22
  }

  /** -- 新增节点 -- */
  const addNodeVisible = ref(false)
  const addNodeFormRef = ref<FormInstance>()
  const addNodeSubmitting = ref(false)
  const addNodeTesting = ref(false)
  const addNodeAdvancedVisible = ref(false)

  const addNodeEmpty = () => ({
    name: '',
    ip: '',
    authType: 'password' as 'password' | 'key',
    user: 'root',
    port: 22,
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
    user: [
      {
        validator: (_r, value: string, cb) => {
          if (String(value ?? '').trim()) cb()
          else cb(new Error('请输入 SSH 登录用户'))
        },
        trigger: 'blur'
      }
    ],
    port: [
      {
        validator: (_r, value: number, cb) => {
          if (Number.isInteger(value) && value >= 1 && value <= 65535) cb()
          else cb(new Error('请输入 1-65535 之间的 SSH 端口'))
        },
        trigger: 'change'
      }
    ],
    password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
    privateKey: [{ required: true, message: '请粘贴私钥内容', trigger: 'blur' }]
  }

  function openAddNodeDialog() {
    Object.assign(addNodeForm, addNodeEmpty())
    addNodeAdvancedVisible.value = false
    addNodeVisible.value = true
    nextTick(() => addNodeFormRef.value?.clearValidate())
  }

  function resetAddNodeForm() {
    Object.assign(addNodeForm, addNodeEmpty())
    addNodeAdvancedVisible.value = false
    addNodeFormRef.value?.clearValidate()
  }

  /** 新增节点前 SSH 连通性预检（模式B：使用表单填写的 host+凭据） */
  async function testAddNodeConnectivity() {
    if (addNodeTesting.value) return
    if (!addNodeForm.ip.trim()) {
      ElMessage.warning('请先填写 IP 地址')
      return
    }
    addNodeTesting.value = true
    try {
      const params = {
        host: addNodeForm.ip.trim(),
        port: addNodeForm.port || 22,
        user: addNodeForm.user.trim() || 'root',
        password: addNodeForm.authType === 'password' ? addNodeForm.password : '',
        privateKey: addNodeForm.authType === 'key' ? addNodeForm.privateKey : ''
      }
      const r = await fetchNodeConnectivityByAuth(params)
      if (r.connected) {
        ElMessage.success(`${params.host} SSH 连通正常`)
      } else {
        ElMessage.error(`${params.host} SSH 连通失败：${r.message || '未知原因'}`)
      }
    } catch (e: any) {
      ElMessage.error(`测试失败：${e?.message || '未知错误'}`)
    } finally {
      addNodeTesting.value = false
    }
  }

  async function submitAddNode() {
    if (!addNodeFormRef.value || addNodeSubmitting.value) return
    const valid = await addNodeFormRef.value
      .validate()
      .then(() => true)
      .catch(() => false)
    if (!valid) return

    addNodeSubmitting.value = true
    let created = false
    try {
      const auth =
        addNodeForm.authType === 'password'
          ? {
              type: 'password' as const,
              ...(addNodeForm.port !== 22 ? { port: addNodeForm.port } : {}),
              password: { user: addNodeForm.user.trim() || 'root', password: addNodeForm.password }
            }
          : {
              type: 'key' as const,
              ...(addNodeForm.port !== 22 ? { port: addNodeForm.port } : {}),
              key: { data: addNodeForm.privateKey }
            }

      await fetchCreatePixiuNode({
        name: addNodeForm.name.trim(),
        ip: addNodeForm.ip.trim(),
        auth
      })
      created = true
    } catch (e: unknown) {
      if (e instanceof PixiuApiError && e.notified) return
      const msg = e instanceof Error ? e.message : '新增节点失败'
      ElMessage.error(msg)
      return
    } finally {
      addNodeSubmitting.value = false
    }

    if (!created) return

    ElMessage.success('新增节点成功')
    addNodeVisible.value = false
    await refreshData()
  }

  /** -- 编辑节点 -- */
  const editNodeVisible = ref(false)
  const editNodeFormRef = ref<FormInstance>()
  const editNodeSubmitting = ref(false)
  const editNodeTesting = ref(false)
  const editNodeAdvancedVisible = ref(false)
  const editingNodeId = ref(0)
  const editingResourceVersion = ref(0)

  const editNodeEmpty = () => ({
    name: '',
    ip: '',
    authType: 'password' as 'password' | 'key',
    user: 'root',
    port: 22,
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
    user: [
      {
        validator: (_r, value: string, cb) => {
          if (String(value ?? '').trim()) cb()
          else cb(new Error('请输入 SSH 登录用户'))
        },
        trigger: 'blur'
      }
    ],
    port: [
      {
        validator: (_r, value: number, cb) => {
          if (Number.isInteger(value) && value >= 1 && value <= 65535) cb()
          else cb(new Error('请输入 1-65535 之间的 SSH 端口'))
        },
        trigger: 'change'
      }
    ],
    password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
    privateKey: [{ required: true, message: '请粘贴私钥内容', trigger: 'blur' }]
  }

  function openEditNodeDialog(row: PixiuNodeItem) {
    editingNodeId.value = row.id
    const rv = row.resource_version
    editingResourceVersion.value = typeof rv === 'number' && !Number.isNaN(rv) ? rv : 0
    const parsed = parseAuthForForm(row.auth)
    Object.assign(editNodeForm, {
      name: row.name,
      ip: row.ip,
      authType: parsed.authType,
      user: parsed.user,
      port: parsed.port,
      password: parsed.password,
      privateKey: parsed.privateKey
    })
    editNodeAdvancedVisible.value = parsed.port !== 22
    editNodeVisible.value = true
    nextTick(() => editNodeFormRef.value?.clearValidate())
  }

  function resetEditNodeForm() {
    Object.assign(editNodeForm, editNodeEmpty())
    editNodeAdvancedVisible.value = false
    editingNodeId.value = 0
    editingResourceVersion.value = 0
    editNodeFormRef.value?.clearValidate()
  }

  /** 编辑节点 SSH 连通性预检（模式B：使用表单当前填写的 host+凭据） */
  async function testEditNodeConnectivity() {
    if (editNodeTesting.value) return
    if (!editNodeForm.ip.trim()) {
      ElMessage.warning('请先填写 IP 地址')
      return
    }
    editNodeTesting.value = true
    try {
      const params = {
        host: editNodeForm.ip.trim(),
        port: editNodeForm.port || 22,
        user: editNodeForm.user.trim() || 'root',
        password: editNodeForm.authType === 'password' ? editNodeForm.password : '',
        privateKey: editNodeForm.authType === 'key' ? editNodeForm.privateKey : ''
      }
      const r = await fetchNodeConnectivityByAuth(params)
      if (r.connected) {
        ElMessage.success(`${params.host} SSH 连通正常`)
      } else {
        ElMessage.error(`${params.host} SSH 连通失败：${r.message || '未知原因'}`)
      }
    } catch (e: any) {
      ElMessage.error(`测试失败：${e?.message || '未知错误'}`)
    } finally {
      editNodeTesting.value = false
    }
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
              ...(editNodeForm.port !== 22 ? { port: editNodeForm.port } : {}),
              password: {
                user: editNodeForm.user.trim() || 'root',
                password: editNodeForm.password
              }
            }
          : {
              type: 'key' as const,
              ...(editNodeForm.port !== 22 ? { port: editNodeForm.port } : {}),
              key: { data: editNodeForm.privateKey }
            }

      await fetchUpdatePixiuNode(editingNodeId.value, {
        resource_version:
          typeof editingResourceVersion.value === 'number' &&
          !Number.isNaN(editingResourceVersion.value)
            ? editingResourceVersion.value
            : 0,
        name: editNodeForm.name.trim(),
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
        { type: 'selection', width: 30 },
        {
          prop: 'name',
          label: '主机名称',
          minWidth: 140,
          formatter: (row: PixiuNodeItem) =>
            h('div', { style: 'display:flex;align-items:center;gap:4px' }, [
              h('span', { style: 'font-size:12px;color:var(--el-text-color-primary)' }, row.name),
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
          minWidth: 120,
          formatter: (row: PixiuNodeItem) =>
            h('div', { style: 'display:flex;align-items:center;gap:4px' }, [
              h(
                'span',
                { style: 'font-size:12px;color:var(--el-text-color-primary)' },
                row.ip || '-'
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
          prop: 'port',
          label: '端口',
          minWidth: 70,
          formatter: (row: PixiuNodeItem) =>
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-text-color-regular)' },
              row.auth?.port || 22
            )
        },
        {
          prop: 'auth',
          label: '认证类型',
          minWidth: 100,
          formatter: (row: PixiuNodeItem) =>
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-text-color-regular)' },
              authTypeLabelFromJson(row.auth)
            )
        },
        {
          prop: 'operation',
          label: '操作',
          width: 200,
          fixed: 'right',
          formatter: (row: PixiuNodeItem) =>
            h('div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:nowrap' }, [
              h(
                ElLink,
                {
                  type: checkingNodeId.value === row.id ? 'info' : 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () => checkNodeConnectivity(row)
                },
                () => (checkingNodeId.value === row.id ? '检测中' : '检测连通性')
              ),
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () => hostRemoteSshRef.value?.open(row)
                },
                () => '登录'
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

  const checkingNodeId = ref<number | null>(null)

  async function checkNodeConnectivity(row: PixiuNodeItem) {
    if (checkingNodeId.value) return
    checkingNodeId.value = row.id
    try {
      const r = await fetchNodeConnectivity(row.id)
      if (r.connected) {
        ElMessage.success(`${row.ip} SSH 连通正常`)
      } else {
        ElMessage.error(`${row.ip} SSH 连通失败：${r.message || '未知原因'}`)
      }
    } catch (e: any) {
      ElMessage.error(`检测失败：${e?.message || '未知错误'}`)
    } finally {
      checkingNodeId.value = null
    }
  }

  function handleSearch(params: typeof searchForm.value) {
    replaceSearchParams({
      hostName: params.hostName
    })
    void getData()
  }

  async function handleTableRefresh() {
    await refreshData()
  }

  useSkipFirstActivatedRefresh(refreshData)
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

  /* 与「导入集群」弹窗样式一致（对齐 cluster-add-dialog.vue cluster-add-dialog--import） */
  .host-node-dialog--form .el-dialog__body {
    padding: 10px 21px 12px 16px !important;
  }
  .host-node-dialog--form .el-dialog__footer {
    padding: 12px 16px 16px 16px !important;
  }

  .host-node-form {
    padding-top: 12px;
  }
  .host-add-node-fixed-user {
    color: var(--el-text-color-regular);
  }
</style>

<style scoped>
  /* :deep 仅在 scoped 下生效；此前写在非 scoped 中导致 padding 未覆盖默认卡片内边距 */
  .host-page :deep(.art-table-card) {
    flex: 1;
    min-height: 0;
  }

  .host-page :deep(.art-table-card > .el-card__body) {
    padding-top: 12px;
    padding-bottom: 7px !important;
  }

  .host-page :deep(.custom-pagination) {
    flex: 0 0 auto;
    margin-top: 10px;
    margin-bottom: 0;
    padding-bottom: 1px;
    box-sizing: border-box;
  }

  .host-page :deep(.el-pagination) {
    padding: 0;
  }

  .host-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    flex-shrink: 0;
    gap: 12px;
  }

  .host-toolbar--no-alert {
    margin-top: 10px;
  }

  .host-toolbar__right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .host-toolbar__search {
    width: 280px;
    max-width: 100%;
  }

  .host-node-form :deep(.el-form-item:first-child) {
    margin-top: 6px;
  }
  .host-node-form :deep(.el-form-item__label) {
    font-size: 12px;
    color: var(--el-text-color-regular);
    padding-right: 12px;
  }
  .host-node-form :deep(.el-form-item__content) {
    max-width: 480px;
  }
  .host-node-form :deep(.el-form-item__content .el-input),
  .host-node-form :deep(.el-form-item__content .el-textarea) {
    width: 100%;
    max-width: 100%;
  }
  /* SSH 端口宽度调小 */
  .host-node-form :deep(.el-form-item__content .el-input-number) {
    width: 120px !important;
    max-width: 120px !important;
  }
  .host-node-form :deep(.el-input__inner),
  .host-node-form :deep(.el-textarea__inner) {
    font-size: 12px;
    color: var(--el-text-color-primary);
  }
  .host-node-auth-group :deep(.el-radio__label) {
    font-size: 12px;
  }
  .host-node-advanced-toggle-item {
    margin-bottom: 12px;
  }
  .host-node-advanced-toggle-item :deep(.el-form-item__content) {
    display: none;
  }
  .host-node-advanced-toggle-item :deep(.el-button) {
    font-size: 12px;
    height: auto;
    padding: 0;
  }
  .host-node-advanced-toggle__icon {
    margin-left: 2px;
    font-size: 12px;
  }
  .host-node-form :deep(.el-input-number) {
    width: 120px !important;
  }
  .host-node-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .host-node-footer__right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .host-node-sudo-tip {
    margin-bottom: 0;
  }
  .host-node-sudo-tip :deep(.quota-alert.el-alert) {
    margin: 0;
    width: 100%;
  }
</style>

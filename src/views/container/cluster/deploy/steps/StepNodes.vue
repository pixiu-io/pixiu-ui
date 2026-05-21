<template>
  <div class="step-nodes">
    <ElDivider
      content-position="left"
      class="section-divider-top"
      style="margin-top: 24px; margin-bottom: 30px"
      >新增节点</ElDivider
    >
    <div class="nodes-toolbar">
      <div class="nodes-toolbar__left">
        <ElButton v-ripple :disabled="readOnly" @click="openAddDialog">添加节点</ElButton>
      </div>
      <div class="nodes-toolbar__filters">
        <ElInput
          v-model="searchForm.name"
          clearable
          placeholder="请输入节点名"
          class="nodes-toolbar__name"
        />
      </div>
    </div>

    <ElTable
      :data="pagedNodes"
      stripe
      class="nodes-table"
      @selection-change="handleSelectionChange"
    >
      <template #empty>
        <div class="nodes-empty">
          <span
            >暂无节点，请点击
            <ElLink
              type="primary"
              :underline="false"
              style="font-size: 12px; vertical-align: baseline"
              @click="openAddDialog"
              >添加节点</ElLink
            >
            添加</span
          >
        </div>
      </template>
      <ElTableColumn label="节点名称" min-width="140">
        <template #default="{ row }">
          <ElLink type="primary" :underline="false" style="font-size: 12px" @click="openEditDialog(row, pageOffset + 0)">{{ row.name }}</ElLink>
        </template>
      </ElTableColumn>
      <ElTableColumn label="角色" min-width="140">
        <template #default="{ row }">
          <ElTag
            v-for="r in row.role"
            :key="r"
            :type="r === 'master' ? 'primary' : 'info'"
            size="small"
            class="role-tag"
            >{{ r }}</ElTag
          >
        </template>
      </ElTableColumn>
      <ElTableColumn label="IP 地址" prop="ip" min-width="160" />
      <ElTableColumn label="认证方式" min-width="100">
        <template #default="{ row }">
          {{ row.authType === 'password' ? '密码' : '密钥' }}
        </template>
      </ElTableColumn>
      <ElTableColumn label="操作" width="120" fixed="right">
        <template #default="{ row, $index }">
          <ElLink
            type="primary"
            :underline="false"
            :disabled="readOnly"
            style="font-size: 12px; margin-right: 12px"
            @click="openEditDialog(row, pageOffset + 0)"
            >编辑</ElLink
          >
          <ElLink
            type="primary"
            :underline="false"
            :disabled="readOnly"
            style="font-size: 12px"
            @click="removeNode(pageOffset + 0)"
            >删除</ElLink
          >
        </template>
      </ElTableColumn>
    </ElTable>

    <div class="nodes-pagination">
      <ElPagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="filteredNodes.length"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        background
      />
    </div>

    <!-- 新增/编辑节点对话框 -->
    <ElDialog
      v-model="dialogVisible"
      :title="editIndex >= 0 ? '编辑节点' : '新增节点'"
      width="540px"
      align-center
      destroy-on-close
      :lock-scroll="false"
      class="node-form-dialog"
      @closed="handleDialogClosed"
    >
      <ElForm
        ref="nodeFormRef"
        :model="nodeForm"
        :rules="nodeRules"
        label-width="88px"
        label-position="right"
        class="node-form"
      >
        <ElFormItem label="节点名称" prop="name">
          <ElInput v-model="nodeForm.name" clearable />
        </ElFormItem>
        <ElFormItem label="节点角色" prop="role">
          <ElCheckboxGroup v-model="nodeForm.role" class="node-role-group">
            <ElCheckbox value="master">master</ElCheckbox>
            <ElCheckbox value="node">node</ElCheckbox>
          </ElCheckboxGroup>
        </ElFormItem>
        <ElFormItem label="IP 地址" prop="ip">
          <ElInput v-model="nodeForm.ip" clearable />
        </ElFormItem>
        <ElFormItem label="认证方式" prop="authType">
          <ElRadioGroup v-model="nodeForm.authType" class="node-auth-group">
            <ElRadio value="password">密码</ElRadio>
            <ElRadio value="key">密钥</ElRadio>
          </ElRadioGroup>
        </ElFormItem>
        <ElFormItem label="用户名">
          <span style="color: var(--el-text-color-regular)">root</span>
        </ElFormItem>
        <template v-if="nodeForm.authType === 'password'">
          <ElFormItem label="密码" prop="password">
            <ElInput v-model="nodeForm.password" type="password" show-password />
          </ElFormItem>
        </template>
        <template v-else>
          <ElFormItem label="私钥" prop="privateKey">
            <ElInput
              v-model="nodeForm.privateKey"
              type="textarea"
              :rows="6"
              placeholder="请粘贴 SSH 私钥内容（PEM 格式）"
              spellcheck="false"
              class="key-textarea"
            />
          </ElFormItem>
        </template>
      </ElForm>
      <template #footer>
        <ElButton class="node-form-dialog__btn" @click="dialogVisible = false">取消</ElButton>
        <ElButton class="node-form-dialog__btn" type="primary" @click="submitNode">确定</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElLink } from 'element-plus'
  import type { DeployClusterForm, NodeConfig } from './StepBasic.vue'

  defineOptions({ name: 'StepNodes' })

  const props = withDefaults(defineProps<{ form: DeployClusterForm; readOnly?: boolean }>(), {
    readOnly: false
  })
  const emit = defineEmits<{ 'update:form': [DeployClusterForm] }>()
  const readOnly = computed(() => props.readOnly)

  const dialogVisible = ref(false)
  const editIndex = ref(-1)
  const nodeFormRef = ref<FormInstance>()

  const emptyNode = (): NodeConfig => ({
    name: '',
    role: [],
    ip: '',
    authType: 'password',
    user: 'root',
    password: '',
    privateKey: ''
  })

  const nodeForm = reactive<NodeConfig>(emptyNode())
  const searchForm = reactive<{ name: string }>({ name: '' })
  const currentPage = ref(1)
  const pageSize = ref(10)

  const filteredNodes = computed(() => {
    const keyword = searchForm.name.trim().toLowerCase()
    return props.form.nodes.filter((n) => {
      const nameMatch = !keyword || n.name.toLowerCase().includes(keyword)
      return nameMatch
    })
  })

  const pageOffset = computed(() => (currentPage.value - 1) * pageSize.value)
  const pagedNodes = computed(() =>
    filteredNodes.value.slice(pageOffset.value, pageOffset.value + pageSize.value)
  )

  const selectedNodes = ref<NodeConfig[]>([])
  function handleSelectionChange(rows: NodeConfig[]) {
    selectedNodes.value = rows
  }

  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/

  const nodeRules: FormRules = {
    name: [
      { required: true, message: '请输入节点名称', trigger: 'blur' },
      {
        validator: (_r, value: string, cb) => {
          const hostname = String(value ?? '').trim()
          // Linux 主机名：1-63 位，仅小写字母/数字/中划线，且不能以中划线开头或结尾
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
    role: [
      { required: true, message: '请至少选择一个角色', trigger: 'change' },
      {
        validator: (_r, value: string[], cb) => {
          if (!value || value.length === 0) cb(new Error('请至少选择一个角色'))
          else cb()
        },
        trigger: 'change'
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
    password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
    privateKey: [{ required: true, message: '请粘贴私钥内容', trigger: 'blur' }]
  }

  function openAddDialog() {
    if (readOnly.value) return
    Object.assign(nodeForm, emptyNode())
    editIndex.value = -1
    dialogVisible.value = true
    nextTick(() => nodeFormRef.value?.clearValidate())
  }

  function openEditDialog(row: NodeConfig, idx: number) {
    if (readOnly.value) return
    Object.assign(nodeForm, { ...row })
    editIndex.value = idx
    dialogVisible.value = true
    nextTick(() => nodeFormRef.value?.clearValidate())
  }

  function removeNode(idx: number) {
    if (readOnly.value) return
    const nodes = [...props.form.nodes]
    nodes.splice(idx, 1)
    emit('update:form', { ...props.form, nodes })
  }

  async function submitNode() {
    if (readOnly.value) return
    if (!nodeFormRef.value) return
    const valid = await nodeFormRef.value
      .validate()
      .then(() => true)
      .catch(() => false)
    if (!valid) return

    const nodes = props.form.nodes
    const isEdit = editIndex.value >= 0

    const dupName = nodes.find(
      (n, i) => n.name === nodeForm.name && (!isEdit || i !== editIndex.value)
    )
    if (dupName) {
      ElMessage.warning(`节点名称 "${nodeForm.name}" 已存在，请修改后重试`)
      return
    }

    const dupIp = nodes.find((n, i) => n.ip === nodeForm.ip && (!isEdit || i !== editIndex.value))
    if (dupIp) {
      ElMessage.warning(`IP 地址 "${nodeForm.ip}" 已存在，请修改后重试`)
      return
    }

    const node: NodeConfig = { ...nodeForm, role: [...nodeForm.role] }
    const updated = [...nodes]
    if (isEdit) {
      updated[editIndex.value] = node
    } else {
      updated.push(node)
    }
    emit('update:form', { ...props.form, nodes: updated })
    dialogVisible.value = false
  }

  function handleDialogClosed() {
    Object.assign(nodeForm, emptyNode())
    editIndex.value = -1
    nodeFormRef.value?.clearValidate()
  }

  async function validate(): Promise<boolean> {
    const hasMaster = props.form.nodes.some((n) => n.role.includes('master'))
    if (!hasMaster) {
      ElMessage.warning('至少需要配置 1 个 master 节点')
      return false
    }
    if (props.form.nodes.length === 0) {
      ElMessage.warning('请至少添加一个节点')
      return false
    }
    return true
  }

  defineExpose({ validate })
</script>

<style scoped>
  .step-nodes {
    width: 100%;
    max-width: none;
    padding-top: 0;
  }

  .section-divider-top {
    margin-top: 0;
    margin-bottom: 4px;
  }

  .section-divider-top :deep(.el-divider__text) {
    font-size: 13px;
    font-weight: 500;
  }

  .nodes-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 16px;
  }

  .nodes-toolbar__left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .nodes-toolbar__filters {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }

  .nodes-toolbar__name {
    width: 220px;
  }

  .nodes-table {
    width: 100%;
  }

  .nodes-table :deep(.el-table__header th.el-table__cell) {
    font-weight: 600;
  }

  .role-tag {
    margin-right: 4px;
  }

  .nodes-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 48px;
    color: var(--el-text-color-placeholder);
    font-size: 12px;
  }

  .nodes-pagination {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
  }

  .key-textarea :deep(textarea) {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    line-height: 1.5;
  }

  .node-form :deep(.el-form-item) {
    margin-bottom: 16px;
  }

  .node-form :deep(.el-form-item:first-child) {
    margin-top: 2px;
  }

  .node-form :deep(.el-form-item:last-child) {
    margin-bottom: 8px;
  }

  .node-role-group,
  .node-auth-group {
    display: flex;
    gap: 22px;
    align-items: center;
    min-height: 34px;
    line-height: 34px;
  }

  .node-form-dialog :deep(.el-dialog__header) {
    margin-right: 0;
    padding: 14px 20px 8px;
  }

  .node-form-dialog :deep(.el-dialog__body) {
    padding: 4px 52px 6px !important;
  }

  .node-form-dialog :deep(.el-dialog__footer) {
    padding: 4px 20px 12px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .node-form-dialog :deep(.el-dialog__headerbtn) {
    top: 14px;
    right: 16px;
  }

  .node-form-dialog :deep(.el-dialog__close) {
    font-size: 16px;
  }

  .node-form-dialog :deep(.el-dialog__title) {
    font-size: 20px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--el-text-color-primary);
  }

  .node-form-dialog :deep(.el-input__wrapper) {
    min-height: 34px;
    border-radius: 6px;
  }

  .node-form-dialog :deep(.el-input__wrapper:hover) {
    box-shadow: 0 0 0 1px var(--el-border-color-hover) inset;
  }

  .node-form-dialog :deep(.el-input__wrapper.is-focus) {
    box-shadow: 0 0 0 1px var(--el-color-primary) inset;
  }

  .node-form-dialog :deep(.el-input__inner),
  .node-form-dialog :deep(.el-textarea__inner) {
    font-size: 12px;
    color: var(--el-text-color-primary);
  }

  .node-form-dialog :deep(.el-input__inner::placeholder),
  .node-form-dialog :deep(.el-textarea__inner::placeholder) {
    color: var(--el-text-color-placeholder);
    opacity: 0.9;
  }

  .node-form-dialog :deep(.el-form-item__content) {
    line-height: 34px;
  }

  .node-form-dialog :deep(.el-form-item__content .el-checkbox-group),
  .node-form-dialog :deep(.el-form-item__content .el-radio-group) {
    display: inline-flex;
    align-items: center;
    min-height: 34px;
    line-height: 34px;
    margin-left: 0;
  }

  .node-form-dialog :deep(.el-form-item__label) {
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .node-form-dialog
    :deep(.el-form-item.is-required:not(.is-no-asterisk) > .el-form-item__label:before) {
    margin-right: 4px;
  }

  .node-form-dialog :deep(.el-textarea__inner) {
    min-height: 120px !important;
    border-radius: 6px;
  }

  .node-form-dialog :deep(.el-textarea__inner:hover) {
    border-color: var(--el-border-color-hover);
  }

  .node-form-dialog :deep(.el-textarea__inner:focus) {
    border-color: var(--el-color-primary);
  }

  .node-form-dialog :deep(.el-radio),
  .node-form-dialog :deep(.el-checkbox) {
    height: 32px;
    line-height: 32px;
    margin-right: 0;
  }

  .node-form-dialog :deep(.el-radio__label),
  .node-form-dialog :deep(.el-checkbox__label) {
    font-size: 12px !important;
  }

  .node-form-dialog :deep(.el-radio__input.is-checked .el-radio__inner),
  .node-form-dialog :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
    border-color: var(--el-color-primary);
    background-color: var(--el-color-primary);
  }

  .node-form-dialog :deep(.el-radio__input .el-radio__inner:hover),
  .node-form-dialog :deep(.el-checkbox__input .el-checkbox__inner:hover) {
    border-color: var(--el-color-primary-light-3);
  }

  .node-form-dialog :deep(.el-radio__input.is-checked + .el-radio__label),
  .node-form-dialog :deep(.el-checkbox__input.is-checked + .el-checkbox__label) {
    color: var(--el-color-primary);
  }

  .node-form-dialog__btn {
    min-width: 72px;
    height: 34px;
    border-radius: 6px;
  }

  .node-form-dialog__btn:not(.el-button--primary) {
    border-color: var(--el-border-color);
    color: var(--el-text-color-primary);
  }

  .node-form-dialog__btn:not(.el-button--primary):hover {
    border-color: var(--el-color-primary-light-3);
    color: var(--el-color-primary);
    background-color: var(--el-color-primary-light-9);
  }

  .node-form-dialog__btn.el-button--primary:hover {
    filter: brightness(1.05);
  }

  .node-form-dialog :deep(.node-role-group .el-checkbox) {
    display: inline-flex;
    align-items: center;
  }
  .step-nodes :deep(.el-table__header) th {
    font-size: 13px;
  }

  .step-nodes :deep(.el-table__body) td {
    font-size: 12px;
  }
</style>

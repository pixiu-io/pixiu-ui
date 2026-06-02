<!-- 授权管理：添加权限抽屉（布局对齐 RAM 权限管理） -->
<template>
  <ElDrawer
    v-model="visible"
    direction="rtl"
    size="60%"
    destroy-on-close
    :show-close="false"
    class="permission-grant-drawer"
  >
    <template #header>
      <div class="permission-grant-drawer-header">
        <span class="permission-grant-drawer-title">权限管理</span>
        <ElButton
          text
          circle
          class="permission-grant-drawer-icon-btn"
          title="关闭"
          @click="closeDrawer"
        >
          <ElIcon :size="16"><Close /></ElIcon>
        </ElButton>
      </div>
    </template>

    <div class="permission-grant-body">
      <div class="permission-grant-user">
        <span class="permission-grant-user-tag">用户选择</span>
        <ElSelect
          v-model="selectedUserId"
          class="permission-grant-user-select"
          placeholder="请选择用户"
          filterable
          :loading="userLoading"
        >
          <ElOption
            v-for="u in userOptions"
            :key="u.id"
            :label="u.userName"
            :value="u.id"
          />
        </ElSelect>
      </div>

      <div class="permission-grant-section">
        <div class="permission-grant-section-title">添加权限</div>
        <div class="permission-grant-table">
          <div class="permission-grant-table-head">
            <span class="col-cluster">集群</span>
            <span class="col-namespace">命名空间</span>
            <span class="col-role">权限管理</span>
            <span class="col-action">操作</span>
          </div>
          <template v-for="(row, index) in rows" :key="row.key">
            <div class="permission-grant-table-row">
              <div class="col-cluster">
                <ElSelect
                  v-if="clusterOptions.length"
                  v-model="row.cluster"
                  placeholder="请选择集群"
                  filterable
                  @change="() => onClusterChange(row)"
                >
                  <ElOption
                    v-for="c in clusterOptions"
                    :key="c.name"
                    :label="c.aliasName || c.name"
                    :value="c.name"
                    :disabled="isClusterUnavailable(c)"
                  >
                    <ElTooltip
                      v-if="isClusterUnavailable(c)"
                      content="集群不可用"
                      placement="right"
                    >
                      <span class="permission-grant-cluster-option is-disabled">
                        {{ c.aliasName || c.name }}
                      </span>
                    </ElTooltip>
                    <span v-else class="permission-grant-cluster-option">
                      {{ c.aliasName || c.name }}
                    </span>
                  </ElOption>
                </ElSelect>
                <span v-else class="permission-grant-empty-hint">暂无可用集群</span>
              </div>
              <div class="col-namespace">
                <ElSelect
                  v-if="row.cluster && namespaceOptions(row).length"
                  v-model="row.namespaces"
                  multiple
                  collapse-tags
                  collapse-tags-tooltip
                  :max-collapse-tags="2"
                  placeholder="请选择命名空间"
                  filterable
                  :loading="row.nsLoading"
                  @change="(val: string[]) => onNamespacesChange(row, val)"
                >
                  <ElOption
                    v-if="row.allNamespaces.length > 1"
                    label="全部命名空间"
                    value="__all__"
                  />
                  <ElOption v-for="ns in row.allNamespaces" :key="ns" :label="ns" :value="ns" />
                </ElSelect>
                <span v-else-if="row.cluster" class="permission-grant-empty-hint">暂无命名空间</span>
                <span v-else class="permission-grant-empty-hint">请先选择集群</span>
              </div>
              <div class="col-role">
                <ElSelect
                  v-model="row.preset"
                  placeholder="权限类型"
                  class="permission-grant-preset-select"
                  @change="() => onPresetChange(row)"
                >
                  <ElOption
                    v-for="p in permissionPresets"
                    :key="p.value"
                    :label="p.label"
                    :value="p.value"
                  />
                </ElSelect>
              </div>
              <div class="col-action">
                <ElLink
                  type="primary"
                  :underline="false"
                  class="permission-grant-delete-link"
                  :disabled="rows.length <= 1"
                  @click="removeRow(index)"
                >
                  删除
                </ElLink>
              </div>
            </div>
            <div v-if="row.preset === 'custom'" class="permission-grant-rules-panel">
              <PermissionRulesMatrix
                v-model="row.ruleMatrixRows"
                :loading="row.rulesLoading"
                @change="() => syncRulesFromMatrix(row)"
              />
            </div>
          </template>
        </div>
        <ElButton text type="primary" class="permission-grant-add-btn" disabled>
          + 添加权限
        </ElButton>
      </div>

      <div class="permission-grant-section permission-grant-legend">
        <div class="permission-grant-section-title">权限说明</div>
        <ElTable :data="permissionLegend" border size="small" class="permission-grant-legend-table">
          <ElTableColumn prop="label" label="访问权限" width="120" />
          <ElTableColumn prop="desc" label="集群内 RBAC 权限" min-width="320" />
        </ElTable>
      </div>

      <div class="permission-grant-advanced">
        <div class="permission-grant-section-title">高级设置</div>
        <ElForm label-width="64px" class="permission-grant-advanced-form">
          <ElFormItem label="有效期">
            <ElSelect v-model="expirationSeconds" placeholder="选择有效期">
              <ElOption label="24 小时" :value="86400" />
              <ElOption label="7 天" :value="604800" />
              <ElOption label="30 天" :value="2592000" />
              <ElOption label="90 天" :value="7776000" />
              <ElOption label="1 年" :value="31536000" />
            </ElSelect>
          </ElFormItem>
        </ElForm>
      </div>
    </div>

    <template #footer>
      <div class="permission-grant-footer">
        <ElButton @click="closeDrawer">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="handleSubmit">确定</ElButton>
      </div>
    </template>
  </ElDrawer>
</template>

<script setup lang="ts">
  import { Close } from '@element-plus/icons-vue'
  import { ElIcon, ElMessage } from 'element-plus'
  import { ref, watch } from 'vue'
  import { fetchClusterList, type ClusterItem } from '@/api/container'
  import { fetchK8sClusterRole } from '@/api/kubernetes/rbac'
  import { fetchK8sNamespaceList } from '@/api/kubernetes/namespace'
  import { fetchGetUserList } from '@/api/system-manage'
  import { useUserStore } from '@/store/modules/user'
  import PermissionRulesMatrix from './permission-rules-matrix.vue'
  import {
    type K8sPolicyRule,
    type RbacRuleMatrixRow,
    matrixToPolicyRules,
    policyRulesToMatrix
  } from '@/utils/kubernetes/rbac-rules-matrix'

  defineOptions({ name: 'PermissionGrantDrawer' })

  type PermissionPreset = 'admin' | 'readonly' | 'ops' | 'developer' | 'custom'

  interface GrantRow {
    key: number
    cluster: string
    namespaces: string[]
    allNamespaces: string[]
    nsLoading: boolean
    preset: PermissionPreset
    customRoleName: string
    ruleMatrixRows: RbacRuleMatrixRow[]
    rulesLoading: boolean
    rulesJson: string
  }

  const CUSTOM_CLUSTER_ROLE = 'view'

  const visible = defineModel<boolean>({ default: false })

  const emit = defineEmits<{
    success: []
  }>()

  const userStore = useUserStore()
  const submitting = ref(false)
  const clusterOptions = ref<ClusterItem[]>([])
  const userOptions = ref<Api.SystemManage.UserListItem[]>([])
  const userLoading = ref(false)
  const selectedUserId = ref<number | undefined>(undefined)
  const expirationSeconds = ref(31536000)

  let rowKeySeq = 0

  const permissionPresets = [
    { label: '管理员', value: 'admin' as const },
    { label: '只读用户', value: 'readonly' as const },
    { label: '自定义', value: 'custom' as const }
  ]

  const permissionLegend = [
    {
      label: '管理员',
      desc: '对全部命名空间下全部 Kubernetes 资源具备读写权限（cluster-admin）'
    },
    {
      label: '只读用户',
      desc: '对全部命名空间下全部 Kubernetes 资源具备只读权限（view）'
    },
    {
      label: '自定义',
      desc: '绑定指定 ClusterRole 或自定义 PolicyRule。'
    }
  ]

  function defaultSelectedUserId(): number | undefined {
    const id = userStore.getUserInfo?.userId
    return id != null ? Number(id) : undefined
  }

  async function loadUsers() {
    userLoading.value = true
    try {
      const { records } = await fetchGetUserList({ current: 1, size: 500 })
      userOptions.value = records
      if (selectedUserId.value == null) {
        const defaultId = defaultSelectedUserId()
        if (defaultId != null && records.some((u) => u.id === defaultId)) {
          selectedUserId.value = defaultId
        }
      }
    } catch {
      userOptions.value = []
      ElMessage.warning('加载用户列表失败')
    } finally {
      userLoading.value = false
    }
  }

  function createRow(): GrantRow {
    return {
      key: ++rowKeySeq,
      cluster: '',
      namespaces: [],
      allNamespaces: [],
      nsLoading: false,
      preset: 'readonly',
      customRoleName: CUSTOM_CLUSTER_ROLE,
      ruleMatrixRows: [],
      rulesLoading: false,
      rulesJson: '[]'
    }
  }

  const rows = ref<GrantRow[]>([createRow()])

  function namespaceOptions(row: GrantRow) {
    if (!row.cluster) return []
    if (row.allNamespaces.length > 1) {
      return ['__all__', ...row.allNamespaces]
    }
    return row.allNamespaces
  }

  function presetToPType(preset: PermissionPreset): number {
    if (preset === 'readonly') return 0
    if (preset === 'admin') return 2
    return 1
  }

  function defaultRulesForPreset(preset: PermissionPreset): object[] {
    if (preset === 'ops') {
      return [
        {
          apiGroups: ['', 'apps', 'batch', 'extensions', 'networking.k8s.io'],
          resources: ['*'],
          verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete']
        }
      ]
    }
    if (preset === 'developer') {
      return [
        {
          apiGroups: ['', 'apps', 'batch'],
          resources: [
            'pods',
            'pods/log',
            'services',
            'configmaps',
            'secrets',
            'deployments',
            'replicasets',
            'statefulsets',
            'jobs',
            'cronjobs'
          ],
          verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete']
        }
      ]
    }
    return []
  }

  function syncRulesFromMatrix(row: GrantRow) {
    row.rulesJson = JSON.stringify(matrixToPolicyRules(row.ruleMatrixRows))
  }

  async function loadViewClusterRoleRules(row: GrantRow) {
    if (!row.cluster) {
      row.ruleMatrixRows = []
      row.rulesJson = '[]'
      return
    }
    row.rulesLoading = true
    try {
      const data = (await fetchK8sClusterRole(row.cluster, CUSTOM_CLUSTER_ROLE)) as {
        rules?: K8sPolicyRule[]
      }
      const rules = data.rules ?? []
      row.customRoleName = CUSTOM_CLUSTER_ROLE
      row.ruleMatrixRows = policyRulesToMatrix(rules)
      row.rulesJson = JSON.stringify(matrixToPolicyRules(row.ruleMatrixRows))
    } catch {
      row.ruleMatrixRows = []
      row.rulesJson = '[]'
      ElMessage.warning(`获取 ClusterRole ${CUSTOM_CLUSTER_ROLE} 失败`)
    } finally {
      row.rulesLoading = false
    }
  }

  function parseRules(row: GrantRow): object[] {
    if (row.preset === 'custom') {
      if (row.ruleMatrixRows.length) {
        return matrixToPolicyRules(row.ruleMatrixRows)
      }
      try {
        const parsed = JSON.parse(row.rulesJson || '[]')
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
    return defaultRulesForPreset(row.preset)
  }

  function resolveTargetNamespaces(row: GrantRow): string[] {
    if (row.namespaces.includes('__all__')) {
      return []
    }
    return row.namespaces.filter((n) => n !== '__all__')
  }

  async function loadClusters() {
    try {
      const { items } = await fetchClusterList({ page: 1, limit: 500 })
      clusterOptions.value = items
    } catch {
      clusterOptions.value = []
    }
  }

  function isClusterUnavailable(cluster: ClusterItem): boolean {
    return Number(cluster.status) !== 0
  }

  async function loadNamespacesForRow(row: GrantRow) {
    if (!row.cluster) {
      row.allNamespaces = []
      row.namespaces = []
      return
    }
    row.nsLoading = true
    try {
      const { items } = await fetchK8sNamespaceList(row.cluster, { page: 1, limit: 500 })
      row.allNamespaces = items.map((n) => n.metadata.name).filter(Boolean)
    } catch {
      row.allNamespaces = []
      ElMessage.warning(`加载集群 ${row.cluster} 命名空间失败`)
    } finally {
      row.nsLoading = false
    }
  }

  function onClusterChange(row: GrantRow) {
    row.namespaces = []
    loadNamespacesForRow(row)
    if (row.preset === 'custom') {
      void loadViewClusterRoleRules(row)
    }
  }

  function onNamespacesChange(row: GrantRow, val: string[]) {
    if (val.includes('__all__') && val.length > 1) {
      row.namespaces = ['__all__']
    } else if (val.includes('__all__')) {
      row.namespaces = ['__all__']
    }
  }

  function onPresetChange(row: GrantRow) {
    if (row.preset === 'custom') {
      if (!row.cluster) {
        ElMessage.warning('请先选择集群')
        return
      }
      void loadViewClusterRoleRules(row)
      return
    }
    row.ruleMatrixRows = []
    row.rulesJson = JSON.stringify(defaultRulesForPreset(row.preset), null, 2)
  }

  function removeRow(index: number) {
    if (rows.value.length <= 1) return
    rows.value.splice(index, 1)
  }

  function resetForm() {
    rows.value = [createRow()]
    selectedUserId.value = defaultSelectedUserId()
    expirationSeconds.value = 31536000
    if (clusterOptions.value.length === 1) {
      const row = rows.value[0]
      row.cluster = clusterOptions.value[0].name
      loadNamespacesForRow(row)
    }
  }

  function closeDrawer() {
    visible.value = false
  }

  function validateRows(): boolean {
    for (let i = 0; i < rows.value.length; i++) {
      const row = rows.value[i]
      const label = `第 ${i + 1} 行`
      if (!row.cluster) {
        ElMessage.warning(`${label}：请选择集群`)
        return false
      }
      const ns = resolveTargetNamespaces(row)
      if (!ns.length) {
        ElMessage.warning(`${label}：请选择命名空间`)
        return false
      }
      if (row.preset === 'custom' && !parseRules(row).length) {
        ElMessage.warning(`${label}：自定义权限加载失败，请重新选择集群`)
        return false
      }
    }
    return true
  }

  function buildGrantName(row: GrantRow, index: number): string {
    return `grant-${row.cluster}-${row.preset}-${Date.now()}-${index + 1}`
  }

  async function handleSubmit() {
    if (!selectedUserId.value) {
      ElMessage.warning('请选择用户')
      return
    }
    if (!validateRows()) return
    submitting.value = true
    const userId = selectedUserId.value
    try {
      const { pixiuAxios } = await import('@/api/container')
      for (let i = 0; i < rows.value.length; i++) {
        const row = rows.value[i]
        const payload: Record<string, unknown> = {
          cluster: row.cluster,
          name: buildGrantName(row, i),
          user_id: userId,
          p_type: presetToPType(row.preset),
          target_namespaces: resolveTargetNamespaces(row),
          expiration_seconds: expirationSeconds.value,
          rules: parseRules(row)
        }
        if (row.preset === 'custom') {
          payload.p_type = 1
        }
        await pixiuAxios.post(
          `/pixiu/clusters/${encodeURIComponent(row.cluster)}/permissions`,
          payload
        )
      }
      ElMessage.success('授权创建成功')
      visible.value = false
      emit('success')
    } catch (e: unknown) {
      const err = e as { notified?: boolean; message?: string }
      if (!err.notified) {
        ElMessage.error(err?.message || '创建失败')
      }
    } finally {
      submitting.value = false
    }
  }

  watch(visible, (open) => {
    if (open) {
      void Promise.all([loadClusters(), loadUsers()]).then(() => resetForm())
    }
  })
</script>

<style scoped lang="scss">
  .permission-grant-drawer {
    font-size: 12px;
  }

  .permission-grant-drawer :deep(.el-drawer__header) {
    margin-bottom: 0;
    padding: 8px 20px 4px;
  }

  .permission-grant-drawer :deep(.el-drawer__body) {
    flex: 1;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 4px 20px 12px;
  }

  .permission-grant-drawer :deep(.el-drawer__footer) {
    padding: 12px 20px 16px;
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .permission-grant-drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: 28px;
    padding-right: 4px;
  }

  .permission-grant-drawer-title {
    font-size: 14px;
    font-weight: 500;
    line-height: 1;
    color: var(--el-text-color-primary);
  }

  .permission-grant-drawer-icon-btn {
    width: 28px;
    height: 28px;
    padding: 0;
    color: var(--el-text-color-regular);
  }

  .permission-grant-drawer-icon-btn:hover {
    color: var(--el-text-color-primary);
  }

  .permission-grant-user {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    margin-left: -4px;
    font-size: 12px;
  }

  .permission-grant-user-tag {
    flex-shrink: 0;
    width: 64px;
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .permission-grant-user-select {
    width: 160px;
  }

  .permission-grant-user-select :deep(.el-select__wrapper) {
    min-height: 32px;
    font-size: 12px;
  }

  .permission-grant-user-select :deep(.el-select__placeholder),
  .permission-grant-user-select :deep(.el-select__selected-item) {
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .permission-grant-section {
    margin-bottom: 20px;
  }

  .permission-grant-section-title {
    margin-bottom: 10px;
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .permission-grant-table {
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
    overflow: hidden;
  }

  .permission-grant-table-head,
  .permission-grant-table-row {
    display: grid;
    grid-template-columns: minmax(140px, 1.1fr) minmax(200px, 1.4fr) minmax(120px, 0.9fr) 56px;
    gap: 8px;
    align-items: center;
    padding: 10px 12px;
    font-size: 12px;
  }

  .permission-grant-table :deep(.el-select),
  .permission-grant-table :deep(.el-input) {
    width: 100%;
  }

  .permission-grant-table :deep(.el-input__wrapper),
  .permission-grant-table :deep(.el-select__wrapper) {
    min-height: 32px;
  }

  .permission-grant-advanced-form {
    max-width: 280px;
    margin-left: -4px;
    font-size: 12px;
  }

  .permission-grant-advanced-form :deep(.el-select) {
    width: 160px;
  }

  .permission-grant-advanced-form :deep(.el-form-item__label) {
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .permission-grant-advanced-form :deep(.el-input__wrapper),
  .permission-grant-advanced-form :deep(.el-select__wrapper) {
    min-height: 32px;
    font-size: 12px;
  }

  .permission-grant-advanced-form :deep(.el-input__inner),
  .permission-grant-advanced-form :deep(.el-select__placeholder),
  .permission-grant-advanced-form :deep(.el-select__selected-item) {
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .permission-grant-table-head {
    background: var(--el-fill-color-light);
    color: var(--el-text-color-secondary);
    font-weight: 500;
    padding-top: 8px;
    padding-bottom: 8px;
  }

  .permission-grant-table-row + .permission-grant-table-row {
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .permission-grant-rules-panel {
    padding: 8px 12px 12px;
    border-top: 1px solid var(--el-border-color-lighter);
    background: var(--el-fill-color-blank);
  }

  .permission-grant-preset-select {
    width: 100%;
  }

  .permission-grant-delete-link {
    font-size: 12px;
  }

  .permission-grant-add-btn {
    margin-top: 8px;
    padding-left: 0;
    font-size: 12px;
    cursor: not-allowed;
  }

  .permission-grant-add-btn.is-disabled {
    color: var(--el-text-color-placeholder);
  }

  .permission-grant-empty-hint {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    line-height: 32px;
  }

  .permission-grant-cluster-option {
    display: inline-block;
    width: 100%;
  }

  .permission-grant-cluster-option.is-disabled {
    cursor: not-allowed;
  }

  .permission-grant-legend-table {
    font-size: 12px;
  }

  .permission-grant-legend-table :deep(.el-table__cell) {
    font-size: 12px;
  }

  .permission-grant-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>

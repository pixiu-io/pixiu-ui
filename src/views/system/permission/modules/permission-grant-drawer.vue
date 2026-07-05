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
        <span class="permission-grant-drawer-title">{{ isEdit ? '修改授权' : '添加授权' }}</span>
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

    <div v-loading="editLoading" class="permission-grant-body">
      <div class="permission-grant-basic-row">
        <div class="permission-grant-field">
          <span class="permission-grant-field-tag">绑定用户</span>
          <ElSelect
            v-model="selectedUserId"
            class="permission-grant-field-select"
            placeholder="请选择用户"
            filterable
            :loading="userLoading"
            :disabled="isEdit"
          >
            <ElOption v-for="u in grantUserOptions" :key="u.id" :label="u.userName" :value="u.id" />
          </ElSelect>
        </div>
        <div class="permission-grant-field">
          <span class="permission-grant-field-tag">授权期限</span>
          <ElSelect
            v-model="expirationSeconds"
            class="permission-grant-field-select"
            placeholder="选择授权期限"
          >
            <ElOption label="24 小时" :value="86400" />
            <ElOption label="7 天" :value="604800" />
            <ElOption label="30 天" :value="2592000" />
            <ElOption label="90 天" :value="7776000" />
            <ElOption label="1 年" :value="31536000" />
          </ElSelect>
        </div>
        <div v-if="isEdit" class="permission-grant-field">
          <span class="permission-grant-force-label">强制修改</span>
          <ElCheckbox v-model="forceUpdate" class="permission-grant-force-check" />
        </div>
      </div>

      <div class="permission-grant-section">
        <div class="permission-grant-section-title">添加权限</div>
        <div class="permission-grant-table">
          <div class="permission-grant-table-head">
            <span class="col-cluster">集群</span>
            <span class="col-role">权限管理</span>
            <span class="col-namespace">命名空间</span>
            <span class="col-action">操作</span>
          </div>
          <template v-for="(row, index) in rows" :key="row.key">
            <div class="permission-grant-table-row">
              <div class="col-cluster">
                <ElSelect
                  v-if="filteredClusterOptions.length"
                  v-model="row.cluster"
                  placeholder="请选择集群"
                  filterable
                  :disabled="isEdit"
                  @change="() => onClusterChange(row)"
                >
                  <ElOption
                    v-for="c in filteredClusterOptions"
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
              <div class="col-role">
                <ElSelect
                  v-model="row.preset"
                  placeholder="权限类型"
                  class="permission-grant-preset-select"
                  :disabled="isEdit"
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
                  class="permission-grant-ns-select"
                  popper-class="permission-grant-ns-popper"
                  :loading="row.nsLoading"
                  :disabled="row.preset === 'admin' || row.preset === 'readonly'"
                  @change="(val: string[]) => onNamespacesChange(row, val)"
                >
                  <ElOption
                    v-if="row.allNamespaces.length > 1 && row.preset !== 'custom'"
                    label="全部命名空间"
                    value="__all__"
                  >
                    <span class="permission-grant-ns-option">
                      <ElCheckbox
                        :model-value="row.namespaces.includes('__all__')"
                        @click.prevent
                      />
                      <span>全部命名空间</span>
                    </span>
                  </ElOption>
                  <ElOption v-for="ns in row.allNamespaces" :key="ns" :label="ns" :value="ns">
                    <span class="permission-grant-ns-option">
                      <ElCheckbox :model-value="row.namespaces.includes(ns)" @click.prevent />
                      <span>{{ ns }}</span>
                    </span>
                  </ElOption>
                </ElSelect>
                <span v-else-if="row.cluster" class="permission-grant-empty-hint"
                  >暂无命名空间</span
                >
                <span v-else class="permission-grant-empty-hint">请先选择集群</span>
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
  import { ElCheckbox, ElIcon, ElMessage } from 'element-plus'
  import { computed, ref, watch } from 'vue'
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

  const CUSTOM_CLUSTER_ROLE = 'pixiu-view'

  const props = defineProps<{
    editPermissionId?: number
  }>()

  const visible = defineModel<boolean>({ default: false })

  const emit = defineEmits<{
    success: []
  }>()

  const isEdit = computed(() => props.editPermissionId != null && props.editPermissionId > 0)
  const editLoading = ref(false)
  const editResourceVersion = ref(0)
  const forceUpdate = ref(false)

  const userStore = useUserStore()
  const submitting = ref(false)
  const clusterOptions = ref<ClusterItem[]>([])
  const userOptions = ref<Api.SystemManage.UserListItem[]>([])
  const userLoading = ref(false)
  const selectedUserId = ref<number | undefined>(undefined)
  const expirationSeconds = ref(31536000)

  let rowKeySeq = 0

  const filteredClusterOptions = computed(() => {
    return clusterOptions.value.filter((c: ClusterItem) => Number(c.permissionId) === 0)
  })

  function currentUserId(): number | undefined {
    const id = userStore.getUserInfo?.userId
    return id != null ? Number(id) : undefined
  }

  const grantUserOptions = computed(() => {
    const selfId = currentUserId()
    if (selfId == null) return userOptions.value
    return userOptions.value.filter((u) => u.id !== selfId)
  })

  function pickDefaultGrantUserId(): number | undefined {
    return grantUserOptions.value[0]?.id
  }

  const permissionPresets = [
    { label: '管理员', value: 'admin' as const },
    { label: '只读用户', value: 'readonly' as const },
    { label: '自定义', value: 'custom' as const }
  ]

  const permissionLegend = [
    {
      label: '管理员',
      desc: '对全部命名空间下全部 Kubernetes 资源具备读写权限'
    },
    {
      label: '只读用户',
      desc: '对全部命名空间下全部 Kubernetes 资源具备只读权限'
    },
    {
      label: '自定义',
      desc: '绑定指定 ClusterRole 或自定义规则'
    }
  ]

  async function loadUsers() {
    userLoading.value = true
    try {
      const { records } = await fetchGetUserList({ current: 1, size: 500 })
      userOptions.value = records
      const selfId = currentUserId()
      if (
        selectedUserId.value == null ||
        selectedUserId.value === selfId ||
        !grantUserOptions.value.some((u) => u.id === selectedUserId.value)
      ) {
        selectedUserId.value = pickDefaultGrantUserId()
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
    if (row.preset === 'custom') {
      return row.allNamespaces
    }
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

  function mergePermissionRules(
    row: GrantRow,
    permissionRules: Array<{ apiGroups?: string[]; resources?: string[]; verbs?: string[] }>
  ) {
    // 先将所有行置为未选中
    for (const matrixRow of row.ruleMatrixRows) {
      matrixRow.actions = { view: false, list: false, create: false, modify: false, delete: false }
    }
    // 根据权限 rules 勾选对应的操作
    for (const rule of permissionRules) {
      const groups = rule.apiGroups?.length ? rule.apiGroups : ['']
      const resources = rule.resources?.length ? rule.resources : ['*']
      const verbs = rule.verbs ?? []
      for (const group of groups) {
        for (const resource of resources) {
          const id = `${group}\0${resource}`
          const matrixRow = row.ruleMatrixRows.find((r) => r.id === id)
          if (!matrixRow) continue
          // 根据 verbs 设置勾选状态
          if (verbs.includes('*') || verbs.includes('get')) matrixRow.actions.view = true
          if (verbs.includes('*') || verbs.includes('list') || verbs.includes('watch')) matrixRow.actions.list = true
          if (verbs.includes('*') || verbs.includes('create')) matrixRow.actions.create = true
          if (verbs.includes('*') || verbs.includes('update') || verbs.includes('patch')) matrixRow.actions.modify = true
          if (verbs.includes('*') || verbs.includes('delete') || verbs.includes('deletecollection')) matrixRow.actions.delete = true
        }
      }
    }
    row.rulesJson = JSON.stringify(matrixToPolicyRules(row.ruleMatrixRows))
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
      if (row.preset === 'admin' || row.preset === 'readonly') {
        row.namespaces = ['__all__']
      }
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
    if (val.includes('__all__')) {
      row.namespaces = ['__all__']
    }
  }

  function onPresetChange(row: GrantRow) {
    if (row.preset === 'admin' || row.preset === 'readonly') {
      row.namespaces = ['__all__']
    }

    if (row.preset === 'custom') {
      row.namespaces = row.namespaces.filter((n) => n !== '__all__')
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
    selectedUserId.value = pickDefaultGrantUserId()
    expirationSeconds.value = 31536000
    forceUpdate.value = false
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

      if (row.preset === 'admin' || row.preset === 'readonly') {
        // 管理员和只读用户强制全命名空间，不走常规验证
        continue
      }

      const ns = resolveTargetNamespaces(row)
      if (!ns.length && !row.namespaces.includes('__all__')) {
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
    try {
      const { pixiuAxios } = await import('@/api/container')
      if (isEdit.value) {
        const row = rows.value[0]
        const payload: Record<string, unknown> = {
          id: props.editPermissionId,
          resource_version: editResourceVersion.value,
          p_type: presetToPType(row.preset),
          expiration_seconds: expirationSeconds.value,
          target_namespaces: resolveTargetNamespaces(row),
          rules: parseRules(row),
          force: forceUpdate.value
        }
        if (row.preset === 'custom') {
          payload.p_type = 1
        }
        await pixiuAxios.put(`/pixiu/clusters/permissions/${props.editPermissionId}`, payload)
        ElMessage.success('修改成功')
      } else {
        // 创建模式
        const userId = selectedUserId.value
        for (let i = 0; i < rows.value.length; i++) {
          const row = rows.value[i]
          const cluster = clusterOptions.value.find((c: ClusterItem) => c.name === row.cluster)
          if (!cluster) {
            ElMessage.warning(`第 ${i + 1} 行：未找到集群 ${row.cluster}`)
            return
          }
          const payload: Record<string, unknown> = {
            cluster_id: cluster.id,
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
          await pixiuAxios.post(`/pixiu/clusters/${cluster.id}/permissions`, payload)
        }
        ElMessage.success('授权创建成功')
      }
      visible.value = false
      emit('success')
    } catch (e: unknown) {
      const err = e as { notified?: boolean; message?: string }
      if (!err.notified) {
        ElMessage.error(err?.message || (isEdit.value ? '修改失败' : '创建失败'))
      }
    } finally {
      submitting.value = false
    }
  }

  watch(visible, (open: boolean) => {
    if (open) {
      void Promise.all([loadClusters(), loadUsers()]).then(() => {
        if (isEdit.value) {
          forceUpdate.value = false
          void loadEditData()
        } else {
          resetForm()
        }
      })
    }
  })

  async function loadEditData() {
    editLoading.value = true
    const { fetchGetPermission } = await import('@/api/system-manage')
    try {
      const detail = await fetchGetPermission(props.editPermissionId!)
      editResourceVersion.value = detail.resourceVersion
      selectedUserId.value = detail.userId
      expirationSeconds.value = detail.expirationSeconds
      const row = createRow()
      row.cluster = detail.clusterName || detail.cluster || ''
      const pType = Number(detail.pType)
      if (pType === 2) {
        row.preset = 'admin'
      } else if (pType === 1) {
        row.preset = 'custom'
      } else {
        row.preset = 'readonly'
      }
      if (detail.targetNamespaces && detail.targetNamespaces.length > 0) {
        row.namespaces = detail.targetNamespaces
      } else if (detail.namespace) {
        row.namespaces = [detail.namespace]
      }
      if (row.cluster) {
        await loadNamespacesForRow(row)
        if (
          row.preset === 'custom' &&
          row.namespaces.length &&
          !row.namespaces.includes('__all__')
        ) {
          row.namespaces = row.namespaces.filter((n) => n !== '__all__')
        }
        if (row.preset === 'custom') {
          await loadViewClusterRoleRules(row)
          // 将权限的 rules 与完整 ClusterRole 矩阵合并，仅勾选已授权的操作
          if (detail.rules && detail.rules.length > 0) {
            mergePermissionRules(row, detail.rules)
          }
        }
      }
      rows.value = [row]
    } catch {
      ElMessage.warning('获取权限详情失败')
      resetForm()
    } finally {
      editLoading.value = false
    }
  }
</script>

<style scoped lang="scss">
  .permission-grant-drawer {
    font-size: 12px;
  }

  .permission-grant-drawer :deep(.el-drawer__header) {
    margin-bottom: 0;
    padding: 8px 20px 0;
  }

  .permission-grant-drawer :deep(.el-drawer__body) {
    flex: 1;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 0 !important;
  }

  .permission-grant-body {
    padding: 0 20px 12px;
    box-sizing: border-box;
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
    min-height: 24px;
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

  .permission-grant-basic-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 24px;
    margin-top: 20px;
    margin-bottom: 12px;
    font-size: 12px;
  }

  .permission-grant-field {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .permission-grant-field-tag {
    flex-shrink: 0;
    width: 64px;
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .permission-grant-field-select {
    width: 220px;
  }

  .permission-grant-field-select :deep(.el-select__wrapper) {
    min-height: 32px;
    font-size: 12px;
  }

  .permission-grant-field-select :deep(.el-select__placeholder),
  .permission-grant-field-select :deep(.el-select__selected-item) {
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .permission-grant-force-label {
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .permission-grant-force-check :deep(.el-checkbox__label) {
    display: none;
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
    grid-template-columns: minmax(140px, 1.1fr) minmax(120px, 0.9fr) minmax(200px, 1.4fr) 56px;
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

  .permission-grant-ns-option {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .permission-grant-ns-option :deep(.el-checkbox) {
    height: auto;
    margin-right: 0;
  }

  .permission-grant-ns-option :deep(.el-checkbox__label) {
    display: none;
  }
</style>

<style>
  /* ElDrawer 挂载到 body，需全局样式确保标题与内容间距生效 */
  .permission-grant-drawer.el-drawer .el-drawer__header {
    margin-bottom: 0 !important;
    padding: 8px 20px 0 !important;
  }

  .permission-grant-drawer.el-drawer .el-drawer__body {
    padding: 0 !important;
  }

  .permission-grant-ns-popper .el-select-dropdown__item {
    padding-right: 12px;
  }

  .permission-grant-ns-popper.el-select-dropdown.is-multiple .el-select-dropdown__item.is-selected::after {
    display: none;
  }
</style>

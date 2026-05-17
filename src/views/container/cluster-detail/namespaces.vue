<template>
  <div class="namespaces-page">
    <ElCard class="art-table-card">
      <ArtTableHeader
        v-model:columns="columnChecks"
        :loading="loading"
        layout="size,fullscreen,columns,settings"
        @refresh="onRefresh"
      >
        <template #left>
          <div class="namespaces-toolbar">
            <ElButton v-ripple @click="createDialogVisible = true">新建命名空间</ElButton>
            <div class="namespaces-toolbar__filters">
              <ElInput
                v-model="searchForm.name"
                clearable
                placeholder="请输入命名空间名称"
                class="namespaces-toolbar__name"
                @keyup.enter="runSearch"
                @clear="runSearch"
              />
              <div
                class="namespaces-toolbar-search-btn"
                role="button"
                tabindex="0"
                title="搜索"
                @click="forceSearch"
                @keyup.enter="forceSearch"
              >
                <ArtSvgIcon icon="ri:search-line" class="text-g-700" />
              </div>
            </div>
          </div>
        </template>
      </ArtTableHeader>

      <ArtTable
        row-key="rowKey"
        :loading="loading"
        :data="data"
        :columns="columns"
        :pagination="pagination"
        :pagination-options="{ align: 'right' }"
        @selection-change="onSelectionChange"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />
    </ElCard>

    <ElDialog v-model="createDialogVisible" title="新建命名空间" width="420px" destroy-on-close>
      <ElInput
        v-model="createForm.name"
        clearable
        maxlength="63"
        show-word-limit
        placeholder="请输入命名空间名称"
      />
      <template #footer>
        <ElButton @click="createDialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="createSubmitting" @click="submitCreate">确定</ElButton>
      </template>
    </ElDialog>

    <K8sYamlDialog
      v-model="yamlVisible"
      title="编辑YAML"
      :yaml="yamlText"
      :read-only="false"
      footer-mode="edit"
      confirm-text="确定"
      width="900px"
      :editor-height="480"
      :submit-loading="yamlSubmitting"
      @save="onNamespaceYamlSave"
    />

    <ElDialog
      v-model="quotaVisible"
      title="配额管理"
      width="560px"
      destroy-on-close
      @close="resetQuotaDialog"
    >
      <ElAlert
        type="info"
        :closable="false"
        show-icon
        class="mb-3"
        description="配额用于限制命名空间下的资源使用，支持以命名空间为粒度进行资源划分。"
      />
      <ElTable :data="quotaRows" size="small" border>
        <ElTableColumn prop="name" label="应用资源" min-width="220" />
        <ElTableColumn label="配额" width="200">
          <template #default="{ row }">
            <ElInputNumber v-model="row.value" :min="0" :precision="0" controls-position="right" />
          </template>
        </ElTableColumn>
      </ElTable>
      <template #footer>
        <ElButton @click="quotaVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="quotaSubmitting" @click="submitQuota">确认</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import {
    ElAlert,
    ElButton,
    ElDialog,
    ElInput,
    ElInputNumber,
    ElLink,
    ElMessage,
    ElMessageBox,
    ElTable,
    ElTableColumn,
    ElTag
  } from 'element-plus'
  import { CopyDocument } from '@element-plus/icons-vue'
  import yaml from 'js-yaml'
  import ArtButtonMore, {
    type ButtonMoreItem
  } from '@/components/core/forms/art-button-more/index.vue'
  import K8sYamlDialog from '@/components/kubernetes/k8s-yaml-dialog.vue'
  import { h, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { useTable } from '@/hooks/core/useTable'
  import {
    createK8sNamespaceQuota,
    createK8sNamespace,
    deleteK8sNamespaceQuota,
    deleteK8sNamespace,
    fetchK8sNamespace,
    fetchK8sNamespaceQuotaList,
    fetchK8sNamespaceList,
    patchK8sNamespaceQuota,
    type K8sNamespace
  } from '@/api/kubernetes/namespace'
  import { fetchK8sPodList } from '@/api/kubernetes/pod'
  import { updateK8sResourceFromYaml } from '@/api/kubernetes/yamlCreate'
  import { formatNodeCreationTime } from '@/utils/kubernetes/nodeDisplay'

  defineOptions({ name: 'ClusterDetailNamespaces' })

  const route = useRoute()

  const searchForm = ref<{ name?: string }>({})
  const createDialogVisible = ref(false)
  const createSubmitting = ref(false)
  const createForm = ref<{ name: string }>({ name: '' })

  const yamlVisible = ref(false)
  const yamlText = ref('')
  const yamlSubmitting = ref(false)
  const quotaVisible = ref(false)
  const quotaSubmitting = ref(false)
  const quotaNamespaceName = ref('')
  const quotaExists = ref(false)
  const quotaName = ref('')
  const quotaOldHard = ref<Record<string, string>>({})

  type QuotaRow = { name: string; key: string; value: number | null }

  const quotaRows = ref<QuotaRow[]>(buildDefaultQuotaRows())

  function buildDefaultQuotaRows(): QuotaRow[] {
    return [
      { name: 'CPU(核)', key: 'limits.cpu', value: null },
      { name: '内存(GiB)', key: 'limits.memory', value: null },
      { name: '无状态负载 Deployment', key: 'count/deployments.apps', value: null },
      { name: '有状态负载 StatefulSet', key: 'count/statefulsets.apps', value: null },
      { name: '普通任务 Job', key: 'count/jobs.batch', value: null },
      { name: '定时任务 CronJob', key: 'count/cronjobs.batch', value: null },
      { name: '容器组 Pod', key: 'count/pods', value: null }
    ]
  }

  const selectedNamespaces = ref<K8sNamespace[]>([])

  watch(
    () => String(route.query.cluster ?? ''),
    () => {
      selectedNamespaces.value = []
    }
  )

  type TableParams = { current: number; size: number; name?: string }

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
      apiFn: async (params: TableParams) => {
        const cluster = String(route.query.cluster ?? '')
        if (!cluster)
          return {
            code: 200,
            data: {
              records: [] as (K8sNamespace & { rowKey: string })[],
              total: 0,
              current: 1,
              size: params.size
            }
          }
        const { items, total } = await fetchK8sNamespaceList(cluster, {
          page: params.current,
          limit: params.size,
          name: (params.name ?? '').trim() || undefined
        })
        const records = items.map((row, i) => ({ ...row, rowKey: row.metadata?.name ?? `ns-${i}` }))
        return { code: 200, data: { records, total, current: params.current, size: params.size } }
      },
      apiParams: { current: 1, size: 10, name: undefined },
      columnsFactory: () => [
        { type: 'selection', width: 30 },
        {
          prop: 'metadata.name',
          label: '命名空间',
          minWidth: 200,
          formatter: (row: K8sNamespace) => {
            const name = row.metadata?.name ?? '-'
            const isSystem = name === 'default' || name.startsWith('kube-')
            return h('div', { style: 'line-height:1.8' }, [
              h('div', { style: 'display:flex;align-items:center;gap:8px' }, [
                h('span', { style: 'font-size:12px;color:var(--el-text-color-primary)' }, name),
                isSystem
                  ? h(
                      'span',
                      {
                        style:
                          'font-size:11px;padding:0 4px;line-height:16px;border-radius:3px;background:var(--el-color-primary-light-9);color:var(--el-color-primary);border:1px solid var(--el-color-primary-light-7);flex-shrink:0'
                      },
                      '系统'
                    )
                  : null,
                h(
                  'span',
                  {
                    class: 'icon-action',
                    style:
                      'cursor:pointer;color:var(--el-text-color-secondary);display:inline-flex;align-items:center',
                    title: '复制',
                    onClick: (e: MouseEvent) => {
                      e.stopPropagation()
                      navigator.clipboard.writeText(row.metadata?.name ?? '')
                      ElMessage.success('已复制')
                    }
                  },
                  [h(CopyDocument, { style: 'width:12px;height:12px' })]
                )
              ])
            ])
          }
        },
        {
          prop: 'status.phase',
          label: '状态',
          width: 110,
          formatter: (row: K8sNamespace) => {
            const phase = row.status?.phase ?? '未知'
            const type =
              phase === 'Active' ? 'success' : phase === 'Terminating' ? 'warning' : 'info'
            const text = phase === 'Active' ? '运行中' : phase === 'Terminating' ? '终止中' : phase
            return h(ElTag, { type, size: 'small' }, () => text)
          }
        },
        {
          prop: 'metadata.creationTimestamp',
          label: '创建时间',
          width: 170,
          formatter: (row: K8sNamespace) =>
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-text-color-regular)' },
              formatNodeCreationTime(row.metadata?.creationTimestamp)
            )
        },
        {
          prop: 'desc',
          label: '描述',
          minWidth: 180,
          showOverflowTooltip: true,
          formatter: (row: K8sNamespace) =>
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-text-color-regular)' },
              row.metadata?.annotations?.description ??
                row.metadata?.annotations?.['kubernetes.io/description'] ??
                '-'
            )
        },
        {
          prop: 'operation',
          label: '操作',
          width: 160,
          fixed: 'right',
          formatter: (row: K8sNamespace) =>
            h('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:nowrap' }, [
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () => void openQuotaDialog(row)
                },
                () => '配额管理'
              ),
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () => void removeNamespace(row)
                },
                () => '删除'
              ),
              h(ArtButtonMore, {
                list: [{ key: 'yaml', label: '查看YAML', icon: 'ri:file-code-line' }],
                onClick: (item: ButtonMoreItem) => namespaceMoreClick(item, row)
              })
            ])
        }
      ]
    }
  })

  function onSelectionChange(rows: K8sNamespace[]) {
    selectedNamespaces.value = rows
  }

  function runSearch() {
    const name = (searchForm.value.name ?? '').trim() || undefined
    replaceSearchParams({ name })
    getData()
  }

  function forceSearch() {
    const name = (searchForm.value.name ?? '').trim() || undefined
    replaceSearchParams({ name })
    getData()
  }

  function onRefresh() {
    refreshData()
  }

  async function submitCreate() {
    const cluster = String(route.query.cluster ?? '')
    const name = createForm.value.name.trim()
    if (!cluster) {
      ElMessage.warning('未选择集群')
      return
    }
    if (!name) {
      ElMessage.warning('请输入命名空间名称')
      return
    }
    createSubmitting.value = true
    try {
      await createK8sNamespace(cluster, name)
      ElMessage.success(`Namespace(${name}) 创建成功`)
      createDialogVisible.value = false
      createForm.value.name = ''
      onRefresh()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '创建失败')
    } finally {
      createSubmitting.value = false
    }
  }

  async function removeNamespace(row: K8sNamespace) {
    const cluster = String(route.query.cluster ?? '')
    const name = row.metadata?.name
    if (!cluster || !name) return
    try {
      const { total } = await fetchK8sPodList(cluster, {
        page: 1,
        limit: 1,
        namespace: name
      })
      if (total > 0) {
        ElMessage.warning(`命名空间 "${name}" 下存在 Pod，无法删除`)
        return
      }
      await ElMessageBox.confirm(`确定删除命名空间 "${name}" 吗？`, '删除命名空间', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      await deleteK8sNamespace(cluster, name)
      ElMessage.success(`Namespace(${name}) 删除成功`)
      onRefresh()
    } catch {
      // 用户取消/删除失败都不额外处理
    }
  }

  async function viewYaml(row: K8sNamespace) {
    const cluster = String(route.query.cluster ?? '')
    const name = row.metadata?.name
    if (!cluster || !name) return
    try {
      const ns = await fetchK8sNamespace(cluster, name)
      yamlText.value = yaml.dump(ns, { quotingType: '"' })
      yamlVisible.value = true
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '加载失败')
    }
  }

  async function submitYamlEdit() {
    const cluster = String(route.query.cluster ?? '')
    if (!cluster) return
    yamlSubmitting.value = true
    try {
      await updateK8sResourceFromYaml(cluster, yamlText.value)
      ElMessage.success('YAML 更新成功')
      yamlVisible.value = false
      onRefresh()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '更新失败')
    } finally {
      yamlSubmitting.value = false
    }
  }

  function onNamespaceYamlSave(text: string) {
    yamlText.value = text
    void submitYamlEdit()
  }

  function namespaceMoreClick(item: ButtonMoreItem, row: K8sNamespace) {
    switch (item.key) {
      case 'yaml':
        void viewYaml(row)
        break
    }
  }

  function getQuotaNameForNamespace(ns: string): string {
    return `pixiu-${ns}-quota`
  }

  function resetQuotaDialog() {
    quotaNamespaceName.value = ''
    quotaExists.value = false
    quotaName.value = ''
    quotaOldHard.value = {}
    quotaRows.value = buildDefaultQuotaRows()
  }

  function hardToRowValue(key: string, hard: Record<string, string>): number | null {
    const raw = hard[key]
    if (!raw) return null
    if (key === 'limits.memory') {
      const n = raw.endsWith('Gi') ? raw.slice(0, -2) : raw
      const v = Number(n)
      return Number.isFinite(v) ? v : null
    }
    const v = Number(raw)
    return Number.isFinite(v) ? v : null
  }

  function rowValueToHard(key: string, value: number | null): string | null {
    if (value === null || value === 0) return null
    if (key === 'limits.memory') return `${value}Gi`
    return String(value)
  }

  async function openQuotaDialog(row: K8sNamespace) {
    const cluster = String(route.query.cluster ?? '')
    const namespace = row.metadata?.name
    if (!cluster || !namespace) return
    resetQuotaDialog()
    quotaNamespaceName.value = namespace
    try {
      const { items } = await fetchK8sNamespaceQuotaList(cluster, namespace)
      if (items.length > 0) {
        const quota = items[0]
        const hard = quota.spec?.hard ?? {}
        quotaExists.value = true
        quotaName.value = quota.metadata?.name ?? getQuotaNameForNamespace(namespace)
        quotaOldHard.value = { ...hard }
        quotaRows.value = quotaRows.value.map((r) => ({
          ...r,
          value: hardToRowValue(r.key, hard)
        }))
      }
      quotaVisible.value = true
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '加载配额失败')
    }
  }

  async function submitQuota() {
    const cluster = String(route.query.cluster ?? '')
    const namespace = quotaNamespaceName.value
    if (!cluster || !namespace) return

    const newHard: Record<string, string | null> = {}
    for (const row of quotaRows.value) {
      const v = rowValueToHard(row.key, row.value)
      if (v !== null) newHard[row.key] = v
    }
    const needDelete = Object.keys(newHard).length === 0

    quotaSubmitting.value = true
    try {
      if (quotaExists.value) {
        const qn = quotaName.value || getQuotaNameForNamespace(namespace)
        if (needDelete) {
          await deleteK8sNamespaceQuota(cluster, namespace, qn)
        } else {
          for (const k of Object.keys(quotaOldHard.value)) {
            if (!(k in newHard)) newHard[k] = null
          }
          await patchK8sNamespaceQuota(cluster, namespace, qn, { spec: { hard: newHard } })
        }
      } else if (!needDelete) {
        const body = {
          apiVersion: 'v1',
          kind: 'ResourceQuota',
          metadata: {
            name: getQuotaNameForNamespace(namespace),
            namespace
          },
          spec: { hard: newHard }
        }
        await createK8sNamespaceQuota(cluster, namespace, body)
      }
      ElMessage.success('命名空间配额设置成功')
      quotaVisible.value = false
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '配额设置失败')
    } finally {
      quotaSubmitting.value = false
    }
  }
</script>

<style>
  .namespaces-page .icon-action {
    opacity: 0;
    transition: opacity 0.15s;
  }
  .namespaces-page .el-table__row:hover .icon-action {
    opacity: 1;
  }
  .namespaces-page .art-table .el-table {
    font-size: 13px;
  }
  .namespaces-page .art-table .el-table th.el-table__cell {
    font-size: 13px;
  }
</style>

<style scoped>
  .namespaces-toolbar {
    display: flex;
    width: 100%;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .namespaces-toolbar__filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-left: auto;
    margin-right: 8px;
  }

  .namespaces-toolbar__name {
    width: 360px;
    max-width: 100%;
  }

  .namespaces-toolbar-search-btn {
    flex-shrink: 0;
    display: flex;
    width: 32px;
    height: 32px;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: 6px;
    background: color-mix(in srgb, var(--art-gray-300) 55%, transparent);
    color: var(--el-text-color-secondary);
    transition: background-color 0.15s ease;
  }

  .namespaces-toolbar-search-btn:hover {
    background: var(--art-gray-300);
  }

  .namespaces-toolbar-search-btn:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 1px;
  }

  .mb-3 {
    margin-bottom: 12px;
  }
</style>

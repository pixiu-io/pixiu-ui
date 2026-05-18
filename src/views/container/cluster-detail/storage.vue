<template>
  <div class="storage-page">
    <ElCard class="art-table-card">
      <ElTabs v-model="kind">
        <!-- ── PV Tab ── -->
        <ElTabPane label="PersistentVolume" name="pv">
          <ArtTableHeader
            v-model:columns="pvColumnChecks"
            :loading="pvLoading"
            layout="size,fullscreen,columns,settings"
            style="margin-top: 15px"
            @refresh="onPvRefresh"
          >
            <template #left>
              <div class="workloads-toolbar">
                <ElButton v-ripple @click="goCreatePV">新建</ElButton>
                <div class="workloads-toolbar__filters">
                  <ElInput
                    v-model="pvSearchForm.name"
                    clearable
                    placeholder="请输入名称"
                    class="workloads-toolbar__search"
                    @keyup.enter="runPvSearch"
                    @clear="runPvSearch"
                  />
                  <div
                    class="workloads-toolbar-search-btn"
                    role="button"
                    tabindex="0"
                    title="搜索"
                    @click="forcePvSearch"
                    @keyup.enter="forcePvSearch"
                  >
                    <ArtSvgIcon icon="ri:search-line" class="text-g-700" />
                  </div>
                </div>
              </div>
            </template>
          </ArtTableHeader>

          <ArtTable
            row-key="rowKey"
            :loading="pvLoading"
            :data="pvData"
            :columns="pvColumns"
            :pagination="pvPagination"
            :pagination-options="CLUSTER_TABLE_PAGINATION_OPTIONS"
            @pagination:size-change="pvHandleSizeChange"
            @pagination:current-change="pvHandleCurrentChange"
            @sort-change="onPvSortChange"
>
        <template #empty>
          <ClusterTableEmpty />
        </template>
          </ArtTable>
        </ElTabPane>

        <!-- ── PVC Tab ── -->
        <ElTabPane label="PersistentVolumeClaim" name="pvc">
          <ArtTableHeader
            v-model:columns="pvcColumnChecks"
            :loading="pvcLoading"
            layout="size,fullscreen,columns,settings"
            style="margin-top: 15px"
            @refresh="onPvcRefresh"
          >
            <template #left>
              <div class="workloads-toolbar">
                <ElButton v-ripple @click="goCreatePVC">新建</ElButton>
                <div class="workloads-toolbar__filters">
                  <ElInput
                    v-model="pvcSearchForm.name"
                    clearable
                    placeholder="请输入名称"
                    class="workloads-toolbar__search"
                    @keyup.enter="runPvcSearch"
                    @clear="runPvcSearch"
                  />
                  <div
                    class="workloads-toolbar-search-btn"
                    role="button"
                    tabindex="0"
                    title="搜索"
                    @click="forcePvcSearch"
                    @keyup.enter="forcePvcSearch"
                  >
                    <ArtSvgIcon icon="ri:search-line" class="text-g-700" />
                  </div>
                </div>
              </div>
            </template>
          </ArtTableHeader>

          <ArtTable
            row-key="rowKey"
            :loading="pvcLoading"
            :data="pvcData"
            :columns="pvcVisibleColumns"
            :pagination="pvcPagination"
            :pagination-options="CLUSTER_TABLE_PAGINATION_OPTIONS"
            @pagination:size-change="pvcHandleSizeChange"
            @pagination:current-change="pvcHandleCurrentChange"
            @sort-change="onPvcSortChange"
>
        <template #empty>
          <ClusterTableEmpty />
        </template>
          </ArtTable>
        </ElTabPane>

        <!-- ── StorageClass Tab ── -->
        <ElTabPane label="StorageClass" name="sc">
          <ArtTableHeader
            v-model:columns="scColumnChecks"
            :loading="scLoading"
            layout="size,fullscreen,columns,settings"
            style="margin-top: 15px"
            @refresh="onScRefresh"
          >
            <template #left>
              <div class="workloads-toolbar">
                <ElButton v-ripple @click="goCreateStorageClass">新建</ElButton>
                <div class="workloads-toolbar__filters">
                  <ElInput
                    v-model="scSearchForm.name"
                    clearable
                    placeholder="请输入名称"
                    class="workloads-toolbar__search"
                    @keyup.enter="runScSearch"
                    @clear="runScSearch"
                  />
                  <div
                    class="workloads-toolbar-search-btn"
                    role="button"
                    tabindex="0"
                    title="搜索"
                    @click="forceScSearch"
                    @keyup.enter="forceScSearch"
                  >
                    <ArtSvgIcon icon="ri:search-line" class="text-g-700" />
                  </div>
                </div>
              </div>
            </template>
          </ArtTableHeader>

          <ArtTable
            row-key="rowKey"
            :loading="scLoading"
            :data="scData"
            :columns="scColumns"
            :pagination="scPagination"
            :pagination-options="CLUSTER_TABLE_PAGINATION_OPTIONS"
            @pagination:size-change="scHandleSizeChange"
            @pagination:current-change="scHandleCurrentChange"
            @sort-change="onScSortChange"
>
        <template #empty>
          <ClusterTableEmpty />
        </template>
          </ArtTable>
        </ElTabPane>
      </ElTabs>
    </ElCard>

    <K8sYamlDialog
      v-model="yamlVisible"
      title="查看 YAML"
      :yaml="yamlText"
      read-only
      width="900px"
      :editor-height="480"
    />

    <K8sYamlDialog
      v-model="scEditYamlVisible"
      title="编辑 YAML"
      :yaml="scEditYamlText"
      :read-only="false"
      footer-mode="edit"
      confirm-text="确认"
      width="900px"
      :editor-height="480"
      :submit-loading="scEditYamlSubmitting"
      @save="saveScYaml"
    />
  </div>
</template>

<script setup lang="ts">
  import {
    ElButton,
    ElCard,
    ElInput,
    ElLink,
    ElMessage,
    ElMessageBox,
    ElTag,
    ElTabs,
    ElTabPane
  } from 'element-plus'
  import { CopyDocument } from '@element-plus/icons-vue'
  import yaml from 'js-yaml'
  import { computed, h, inject, ref, watch } from 'vue'
import { CLUSTER_TABLE_PAGINATION_OPTIONS } from './constants/table'
import ClusterTableEmpty from './components/cluster-table-empty.vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useTable } from '@/hooks/core/useTable'
  import { fetchK8sPVCList, fetchK8sPVC, deleteK8sPVC, type K8sPVC } from '@/api/kubernetes/pvc'
  import { fetchK8sPVList, fetchK8sPV, deleteK8sPV, type K8sPV } from '@/api/kubernetes/pv'
  import { fetchK8sStorageClassList, fetchK8sStorageClass, deleteK8sStorageClass, putK8sStorageClass, type K8sStorageClass } from '@/api/kubernetes/storageclass'
  import { formatNodeCreationTime } from '@/utils/kubernetes/nodeDisplay'
  import { clusterDetailNamespaceKey } from './context'
  import K8sYamlDialog from '@/components/kubernetes/k8s-yaml-dialog.vue'

  defineOptions({ name: 'ClusterDetailStorage' })

  const route = useRoute()
  const router = useRouter()
  const tabFromQuery = String(route.query.tab ?? '').toLowerCase()
  const kind = ref<'pvc' | 'pv' | 'sc'>(
    tabFromQuery === 'pvc' || tabFromQuery === 'sc' ? (tabFromQuery as 'pvc' | 'sc') : 'pv'
  )

  // ── PVC tab state ──
  const pvcSearchForm = ref<{ name?: string }>({})
  const pvcSortOrder = ref<'ascending' | 'descending' | null>(null)

  // ── PV tab state ──
  const pvSearchForm = ref<{ name?: string }>({})
  const pvSortOrder = ref<'ascending' | 'descending' | null>(null)

  // ── StorageClass tab state ──
  const scSearchForm = ref<{ name?: string }>({})
  const scSortOrder = ref<'ascending' | 'descending' | null>(null)

  const globalNs = inject(clusterDetailNamespaceKey)
  const selectedNamespace = computed(() => globalNs?.namespace.value ?? '')

  // ── YAML dialog state ──
  const yamlVisible = ref(false)
  const yamlText = ref('')

  // ── SC 编辑 YAML dialog state ──
  const scEditYamlVisible = ref(false)
  const scEditYamlText = ref('')
  const scEditYamlName = ref('')
  const scEditYamlSubmitting = ref(false)

  // ── Shared helpers ──
  function renderNsCell(ns: string) {
    const isSystem = ns === 'default' || ns.startsWith('kube-')
    return h('div', { style: 'display:flex;align-items:center;gap:6px' }, [
      h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, ns),
      isSystem
        ? h('span', {
            style:
              'font-size:11px;padding:0 4px;line-height:16px;border-radius:3px;background:var(--el-color-primary-light-9);color:var(--el-color-primary);border:1px solid var(--el-color-primary-light-7);flex-shrink:0'
          }, '系统')
        : null
    ])
  }

  function renderNameCell(name: string) {
    return h('div', { style: 'display:flex;align-items:center;gap:8px' }, [
      h('span', { style: 'font-size:12px;color:var(--el-text-color-primary)' }, name),
      h('span', {
        class: 'icon-action',
        style: 'cursor:pointer;color:var(--el-text-color-secondary);display:inline-flex;align-items:center',
        title: '复制',
        onClick: (e: MouseEvent) => {
          e.stopPropagation()
          navigator.clipboard.writeText(name)
          ElMessage.success('已复制')
        }
      }, [h(CopyDocument, { style: 'width:12px;height:12px' })])
    ])
  }

  async function openYamlDialog(res: 'pvc' | 'pv' | 'sc', ns: string, name: string) {
    const cluster = String(route.query.cluster ?? '')
    if (!cluster || !name) return
    try {
      let resource: unknown
      if (res === 'pvc') resource = await fetchK8sPVC(cluster, ns, name)
      else if (res === 'pv') resource = await fetchK8sPV(cluster, name)
      else resource = await fetchK8sStorageClass(cluster, name)
      yamlText.value = yaml.dump(resource, { quotingType: '"' })
      yamlVisible.value = true
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '加载失败')
    }
  }

  async function openScEditYaml(name: string) {
    const cluster = String(route.query.cluster ?? '')
    if (!cluster || !name) return
    try {
      const resource = await fetchK8sStorageClass(cluster, name)
      scEditYamlText.value = yaml.dump(resource, { quotingType: '"' })
      scEditYamlName.value = name
      scEditYamlVisible.value = true
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '加载失败')
    }
  }

  async function saveScYaml(yamlStr: string) {
    const cluster = String(route.query.cluster ?? '')
    if (!cluster || !scEditYamlName.value) return
    scEditYamlSubmitting.value = true
    try {
      const body = yaml.load(yamlStr) as object
      await putK8sStorageClass(cluster, scEditYamlName.value, body)
      ElMessage.success('更新成功')
      scEditYamlVisible.value = false
      onScRefresh()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '更新失败')
    } finally {
      scEditYamlSubmitting.value = false
    }
  }

  async function deleteResource(res: 'pvc' | 'pv' | 'sc', ns: string, name: string, refresh: () => void) {
    const cluster = String(route.query.cluster ?? '')
    if (!cluster || !name) return
    try {
      await ElMessageBox.confirm(`确定删除 "${name}" 吗？`, '删除确认', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
      if (res === 'pvc') await deleteK8sPVC(cluster, ns, name)
      else if (res === 'pv') await deleteK8sPV(cluster, name)
      else await deleteK8sStorageClass(cluster, name)
      ElMessage.success('删除成功')
      refresh()
    } catch {
      // user cancel
    }
  }

  // ── PVC useTable ──
  type PvcParams = { current: number; size: number; name?: string; namespace?: string }
  const {
    columns: pvcColumns,
    columnChecks: pvcColumnChecks,
    data: pvcData,
    loading: pvcLoading,
    pagination: pvcPagination,
    getData: getPvcData,
    replaceSearchParams: replacePvcSearchParams,
    handleSizeChange: pvcHandleSizeChange,
    handleCurrentChange: pvcHandleCurrentChange,
    refreshData: refreshPvcData
  } = useTable({
    core: {
      immediate: false,
      apiFn: async (params: PvcParams) => {
        const cluster = String(route.query.cluster ?? '')
        if (!cluster) return { code: 200, data: { records: [] as (K8sPVC & { rowKey: string })[], total: 0, current: 1, size: params.size } }
        const { items, total } = await fetchK8sPVCList(cluster, {
          page: params.current, limit: params.size,
          namespace: selectedNamespace.value || undefined,
          name: (params.name ?? '').trim() || undefined
        })
        let list = items.map((d, i) => ({ ...d, rowKey: d.metadata?.uid ?? d.metadata?.name ?? `pvc-${i}` }))
        if (pvcSortOrder.value) {
          list = [...list].sort((a, b) => {
            const ta = a.metadata?.creationTimestamp ?? '', tb = b.metadata?.creationTimestamp ?? ''
            return pvcSortOrder.value === 'ascending' ? ta.localeCompare(tb) : tb.localeCompare(ta)
          })
        }
        return { code: 200, data: { records: list, total, current: params.current, size: params.size } }
      },
      apiParams: { current: 1, size: 10, name: undefined, namespace: undefined },
      columnsFactory: () => [
        { type: 'selection', width: 30 },
        {
          prop: 'metadata.name', label: '名称', minWidth: 160,
          formatter: (row: K8sPVC) => renderNameCell(row.metadata?.name ?? '-')
        },
        {
          prop: 'metadata.namespace', label: '命名空间', width: 160,
          formatter: (row: K8sPVC) => renderNsCell(row.metadata?.namespace ?? '-')
        },
        {
          prop: 'status.phase', label: '状态', width: 100,
          formatter: (row: K8sPVC) => {
            const phase = row.status?.phase ?? '-'
            const typeMap: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
              Bound: 'success',
              Pending: 'warning',
              Lost: 'danger'
            }
            return h(ElTag, { type: typeMap[phase] ?? 'info', size: 'small' }, () => phase)
          }
        },
        {
          prop: 'capacity', label: '容量', width: 100,
          formatter: (row: K8sPVC) =>
            h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, row.status?.capacity?.storage ?? row.spec?.resources?.requests?.storage ?? '-')
        },
        {
          prop: 'accessModes', label: '访问模式', minWidth: 160,
          formatter: (row: K8sPVC) =>
            h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, (row.status?.accessModes ?? row.spec?.accessModes ?? []).join(', ') || '-')
        },
        {
          prop: 'spec.storageClassName', label: '存储类', minWidth: 160,
          formatter: (row: K8sPVC) =>
            h('span', { style: 'font-size:12px;font-weight:400;color:var(--el-text-color-regular)' }, row.spec?.storageClassName ?? '-')
        },
        {
          prop: 'metadata.creationTimestamp', label: '创建时间', width: 168, sortable: 'custom',
          formatter: (row: K8sPVC) =>
            h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, formatNodeCreationTime(row.metadata?.creationTimestamp))
        },
        {
          prop: 'operation', label: '操作', width: 160, fixed: 'right',
          formatter: (row: K8sPVC) =>
            h('div', { style: 'display:flex;align-items:center;gap:12px' }, [
              h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => void openYamlDialog('pvc', row.metadata?.namespace ?? '', row.metadata?.name ?? '') }, () => '编辑YAML'),
              h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => void deleteResource('pvc', row.metadata?.namespace ?? '', row.metadata?.name ?? '', onPvcRefresh) }, () => '删除')
            ])
        }
      ]
    }
  })

  const pvcVisibleColumns = computed(() =>
    pvcColumns.value.filter((c) => !(selectedNamespace.value && c.prop === 'metadata.namespace'))
  )
  function runPvcSearch() {
    const name = (pvcSearchForm.value.name ?? '').trim() || undefined
    replacePvcSearchParams({ name, namespace: selectedNamespace.value || undefined })
    getPvcData()
  }
  function forcePvcSearch() {
    const name = (pvcSearchForm.value.name ?? '').trim() || undefined
    replacePvcSearchParams({ name, namespace: selectedNamespace.value || undefined })
    getPvcData()
  }
  function onPvcRefresh() { refreshPvcData() }
  function onPvcSortChange({ prop, order }: { prop: string; order: string | null }) {
    if (prop === 'metadata.creationTimestamp') { pvcSortOrder.value = (order as 'ascending' | 'descending' | null) ?? null; getPvcData() }
  }

  // ── PV useTable ──
  type PvParams = { current: number; size: number; name?: string }
  const {
    columns: pvColumns,
    columnChecks: pvColumnChecks,
    data: pvData,
    loading: pvLoading,
    pagination: pvPagination,
    getData: getPvData,
    replaceSearchParams: replacePvSearchParams,
    handleSizeChange: pvHandleSizeChange,
    handleCurrentChange: pvHandleCurrentChange,
    refreshData: refreshPvData
  } = useTable({
    core: {
      immediate: true,
      apiFn: async (params: PvParams) => {
        const cluster = String(route.query.cluster ?? '')
        if (!cluster) return { code: 200, data: { records: [] as (K8sPV & { rowKey: string })[], total: 0, current: 1, size: params.size } }
        const { items, total } = await fetchK8sPVList(cluster, {
          page: params.current, limit: params.size,
          name: (params.name ?? '').trim() || undefined
        })
        let list = items.map((d, i) => ({ ...d, rowKey: d.metadata?.uid ?? d.metadata?.name ?? `pv-${i}` }))
        if (pvSortOrder.value) {
          list = [...list].sort((a, b) => {
            const ta = a.metadata?.creationTimestamp ?? '', tb = b.metadata?.creationTimestamp ?? ''
            return pvSortOrder.value === 'ascending' ? ta.localeCompare(tb) : tb.localeCompare(ta)
          })
        }
        return { code: 200, data: { records: list, total, current: params.current, size: params.size } }
      },
      apiParams: { current: 1, size: 10, name: undefined },
      columnsFactory: () => [
        { type: 'selection', width: 30 },
        {
          prop: 'metadata.name', label: '名称', minWidth: 160,
          formatter: (row: K8sPV) => renderNameCell(row.metadata?.name ?? '-')
        },
        {
          prop: 'status.phase', label: '状态', width: 100,
          formatter: (row: K8sPV) => {
            const phase = row.status?.phase ?? '-'
            const typeMap: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'info'> = {
              Available: 'primary',
              Bound: 'success',
              Released: 'warning',
              Failed: 'danger'
            }
            return h(ElTag, { type: typeMap[phase] ?? 'info', size: 'small' }, () => phase)
          }
        },
        {
          prop: 'spec.capacity.storage', label: '容量', width: 100,
          formatter: (row: K8sPV) =>
            h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, row.spec?.capacity?.storage ?? '-')
        },
        {
          prop: 'spec.accessModes', label: '访问模式', minWidth: 150,
          formatter: (row: K8sPV) =>
            h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, (row.spec?.accessModes ?? []).join(', ') || '-')
        },
        {
          prop: 'spec.persistentVolumeReclaimPolicy', label: '回收策略', width: 120,
          formatter: (row: K8sPV) =>
            h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, row.spec?.persistentVolumeReclaimPolicy ?? '-')
        },
        {
          prop: 'spec.claimRef', label: 'PVC', minWidth: 150,
          formatter: (row: K8sPV) =>
            h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, row.spec?.claimRef?.name ?? '-')
        },
        {
          prop: 'spec.storageClassName', label: '存储类', minWidth: 150,
          formatter: (row: K8sPV) =>
            h('span', { style: 'font-size:12px;font-weight:400;color:var(--el-text-color-regular)' }, row.spec?.storageClassName ?? '-')
        },
        {
          prop: 'metadata.creationTimestamp', label: '创建时间', width: 168, sortable: 'custom',
          formatter: (row: K8sPV) =>
            h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, formatNodeCreationTime(row.metadata?.creationTimestamp))
        },
        {
          prop: 'operation', label: '操作', width: 160, fixed: 'right',
          formatter: (row: K8sPV) =>
            h('div', { style: 'display:flex;align-items:center;gap:12px' }, [
              h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => void openYamlDialog('pv', '', row.metadata?.name ?? '') }, () => '编辑YAML'),
              h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => void deleteResource('pv', '', row.metadata?.name ?? '', onPvRefresh) }, () => '删除')
            ])
        }
      ]
    }
  })

  function runPvSearch() {
    const name = (pvSearchForm.value.name ?? '').trim() || undefined
    replacePvSearchParams({ name })
    getPvData()
  }
  function forcePvSearch() {
    const name = (pvSearchForm.value.name ?? '').trim() || undefined
    replacePvSearchParams({ name })
    getPvData()
  }
  function onPvRefresh() { refreshPvData() }
  function onPvSortChange({ prop, order }: { prop: string; order: string | null }) {
    if (prop === 'metadata.creationTimestamp') { pvSortOrder.value = (order as 'ascending' | 'descending' | null) ?? null; getPvData() }
  }

  // ── StorageClass useTable ──
  type ScParams = { current: number; size: number; name?: string }
  const {
    columns: scColumns,
    columnChecks: scColumnChecks,
    data: scData,
    loading: scLoading,
    pagination: scPagination,
    getData: getScData,
    replaceSearchParams: replaceScSearchParams,
    handleSizeChange: scHandleSizeChange,
    handleCurrentChange: scHandleCurrentChange,
    refreshData: refreshScData
  } = useTable({
    core: {
      immediate: false,
      apiFn: async (params: ScParams) => {
        const cluster = String(route.query.cluster ?? '')
        if (!cluster) return { code: 200, data: { records: [] as (K8sStorageClass & { rowKey: string })[], total: 0, current: 1, size: params.size } }
        const { items, total } = await fetchK8sStorageClassList(cluster, {
          page: params.current, limit: params.size,
          name: (params.name ?? '').trim() || undefined
        })
        let list = items.map((d, i) => ({ ...d, rowKey: d.metadata?.uid ?? d.metadata?.name ?? `sc-${i}` }))
        if (scSortOrder.value) {
          list = [...list].sort((a, b) => {
            const ta = a.metadata?.creationTimestamp ?? '', tb = b.metadata?.creationTimestamp ?? ''
            return scSortOrder.value === 'ascending' ? ta.localeCompare(tb) : tb.localeCompare(ta)
          })
        }
        return { code: 200, data: { records: list, total, current: params.current, size: params.size } }
      },
      apiParams: { current: 1, size: 10, name: undefined },
      columnsFactory: () => [
        { type: 'selection', width: 30 },
        {
          prop: 'metadata.name', label: '名称', minWidth: 160,
          formatter: (row: K8sStorageClass) => renderNameCell(row.metadata?.name ?? '-')
        },
        {
          prop: 'provisioner', label: '提供者', minWidth: 200,
          formatter: (row: K8sStorageClass) =>
            h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, row.provisioner ?? '-')
        },
        {
          prop: 'reclaimPolicy', label: '回收策略', width: 120,
          formatter: (row: K8sStorageClass) =>
            h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, row.reclaimPolicy ?? 'Delete')
        },
        {
          prop: 'volumeBindingMode', label: '绑定模式', width: 160,
          formatter: (row: K8sStorageClass) =>
            h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, row.volumeBindingMode ?? '-')
        },
        {
          prop: 'metadata.creationTimestamp', label: '创建时间', width: 168, sortable: 'custom',
          formatter: (row: K8sStorageClass) =>
            h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, formatNodeCreationTime(row.metadata?.creationTimestamp))
        },
        {
          prop: 'operation', label: '操作', width: 160, fixed: 'right',
          formatter: (row: K8sStorageClass) =>
            h('div', { style: 'display:flex;align-items:center;gap:12px' }, [
              h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => void openScEditYaml(row.metadata?.name ?? '') }, () => '编辑YAML'),
              h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => void deleteResource('sc', '', row.metadata?.name ?? '', onScRefresh) }, () => '删除')
            ])
        }
      ]
    }
  })

  function runScSearch() {
    const name = (scSearchForm.value.name ?? '').trim() || undefined
    replaceScSearchParams({ name })
    getScData()
  }
  function forceScSearch() {
    const name = (scSearchForm.value.name ?? '').trim() || undefined
    replaceScSearchParams({ name })
    getScData()
  }
  function onScRefresh() { refreshScData() }
  function onScSortChange({ prop, order }: { prop: string; order: string | null }) {
    if (prop === 'metadata.creationTimestamp') { scSortOrder.value = (order as 'ascending' | 'descending' | null) ?? null; getScData() }
  }

  function goCreateStorageClass() {
    router.push({ path: '/container/storageclass-create', query: { cluster: String(route.query.cluster ?? '') } })
  }

  function goCreatePV() {
    router.push({ path: '/container/pv-create', query: { cluster: String(route.query.cluster ?? '') } })
  }

  function goCreatePVC() {
    router.push({
      path: '/container/pvc-create',
      query: {
        cluster: String(route.query.cluster ?? ''),
        namespace: selectedNamespace.value || ''
      }
    })
  }

  // ── Tab lazy loading ──
  const pvcLoaded = ref(false)
  const scLoaded = ref(false)
  watch(kind, (val) => {
    if (String(route.query.tab ?? '') !== val) {
      router.replace({
        query: {
          ...route.query,
          tab: val
        }
      })
    }
    const cluster = String(route.query.cluster ?? '')
    if (!cluster) return
    if (val === 'pvc' && !pvcLoaded.value) { pvcLoaded.value = true; getPvcData() }
    else if (val === 'sc' && !scLoaded.value) { scLoaded.value = true; getScData() }
  })

  watch(
    () => String(route.query.cluster ?? ''),
    (cluster) => {
      if (!cluster) return
      if (kind.value === 'pvc' && !pvcLoaded.value) {
        pvcLoaded.value = true
        getPvcData()
      } else if (kind.value === 'sc' && !scLoaded.value) {
        scLoaded.value = true
        getScData()
      }
    },
    { immediate: true }
  )

  watch(selectedNamespace, () => {
    if (kind.value === 'pvc') getPvcData()
  })
</script>

<style>
  .storage-page .icon-action {
    opacity: 0;
    transition: opacity 0.15s;
  }
  .storage-page .el-table__row:hover .icon-action {
    opacity: 1;
  }
  .storage-page .art-table .el-table {
    font-size: 13px;
  }
  .storage-page .art-table .el-table th.el-table__cell {
    font-size: 13px;
  }
</style>

<style scoped>
  .workloads-toolbar {
    display: flex;
    width: 100%;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .workloads-toolbar__filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-left: auto;
    margin-right: 8px;
  }

  .workloads-toolbar__ns-select {
    width: 160px;
  }

  .workloads-toolbar__ns-select :deep(.el-select__placeholder) {
    color: var(--el-text-color-regular);
    font-size: 13px;
  }

  .workloads-toolbar__search {
    width: 350px;
    max-width: 100%;
  }

  .workloads-toolbar-search-btn {
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

  .workloads-toolbar-search-btn:hover {
    background: var(--art-gray-300);
  }

  .workloads-toolbar-search-btn:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 1px;
  }

</style>

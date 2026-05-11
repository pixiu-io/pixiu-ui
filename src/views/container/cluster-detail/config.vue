<template>
  <div class="config-page">
    <ElCard class="art-table-card">
      <ElTabs v-model="kind">
        <!-- ── ConfigMap Tab ── -->
        <ElTabPane label="ConfigMap" name="cm">
          <ArtTableHeader
            v-model:columns="cmColumnChecks"
            :loading="cmLoading"
            layout="size,fullscreen,columns,settings"
            style="margin-top: 15px"
            @refresh="onCmRefresh"
          >
            <template #left>
              <div class="workloads-toolbar">
                <ElButton v-ripple @click="ElMessage.warning('暂不支持，功能开发中')">新建</ElButton>
                <div class="workloads-toolbar__filters">
                  <ElInput
                    v-model="cmSearchForm.name"
                    clearable
                    placeholder="请输入名称"
                    class="workloads-toolbar__search"
                    @keyup.enter="runCmSearch"
                    @clear="runCmSearch"
                  />
                  <div
                    class="workloads-toolbar-search-btn"
                    role="button"
                    tabindex="0"
                    title="搜索"
                    @click="forceCmSearch"
                    @keyup.enter="forceCmSearch"
                  >
                    <ArtSvgIcon icon="ri:search-line" class="text-g-700" />
                  </div>
                </div>
              </div>
            </template>
          </ArtTableHeader>

          <ArtTable
            row-key="rowKey"
            :loading="cmLoading"
            :data="cmData"
            :columns="cmVisibleColumns"
            :pagination="cmPagination"
            :pagination-options="{ align: 'right' }"
            @pagination:size-change="cmHandleSizeChange"
            @pagination:current-change="cmHandleCurrentChange"
            @sort-change="onCmSortChange"
          />
        </ElTabPane>

        <!-- ── Secret Tab ── -->
        <ElTabPane label="Secret" name="sec">
          <ArtTableHeader
            v-model:columns="secColumnChecks"
            :loading="secLoading"
            layout="size,fullscreen,columns,settings"
            style="margin-top: 15px"
            @refresh="onSecRefresh"
          >
            <template #left>
              <div class="workloads-toolbar">
                <ElButton v-ripple @click="ElMessage.warning('暂不支持，功能开发中')">新建</ElButton>
                <div class="workloads-toolbar__filters">
                  <ElInput
                    v-model="secSearchForm.name"
                    clearable
                    placeholder="请输入名称"
                    class="workloads-toolbar__search"
                    @keyup.enter="runSecSearch"
                    @clear="runSecSearch"
                  />
                  <div
                    class="workloads-toolbar-search-btn"
                    role="button"
                    tabindex="0"
                    title="搜索"
                    @click="forceSecSearch"
                    @keyup.enter="forceSecSearch"
                  >
                    <ArtSvgIcon icon="ri:search-line" class="text-g-700" />
                  </div>
                </div>
              </div>
            </template>
          </ArtTableHeader>

          <ArtTable
            row-key="rowKey"
            :loading="secLoading"
            :data="secData"
            :columns="secVisibleColumns"
            :pagination="secPagination"
            :pagination-options="{ align: 'right' }"
            @pagination:size-change="secHandleSizeChange"
            @pagination:current-change="secHandleCurrentChange"
            @sort-change="onSecSortChange"
          />
        </ElTabPane>
      </ElTabs>
    </ElCard>

    <!-- YAML readonly dialog -->
    <K8sYamlDialog
      v-model="yamlVisible"
      title="查看 YAML"
      :yaml="yamlText"
      read-only
      width="900px"
      :editor-height="480"
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
  import { useRoute } from 'vue-router'
  import { useTable } from '@/hooks/core/useTable'
  import {
    fetchK8sConfigMapList,
    fetchK8sConfigMap,
    deleteK8sConfigMap,
    type K8sConfigMap
  } from '@/api/kubernetes/configmap'
  import {
    fetchK8sSecretList,
    fetchK8sSecret,
    deleteK8sSecret,
    type K8sSecret
  } from '@/api/kubernetes/secret'
  import { formatNodeCreationTime } from '@/utils/kubernetes/nodeDisplay'
  import { clusterDetailNamespaceKey } from './context'
  import K8sYamlDialog from '@/components/kubernetes/k8s-yaml-dialog.vue'

  defineOptions({ name: 'ClusterDetailConfig' })

  const route = useRoute()
  const kind = ref('cm')

  // ── ConfigMap tab state ──
  const cmSearchForm = ref<{ name?: string }>({})
  const cmSortOrder = ref<'ascending' | 'descending' | null>(null)

  // ── Secret tab state ──
  const secSearchForm = ref<{ name?: string }>({})
  const secSortOrder = ref<'ascending' | 'descending' | null>(null)
  const globalNs = inject(clusterDetailNamespaceKey)
  const selectedNamespace = computed(() => globalNs?.namespace.value ?? '')

  // ── YAML dialog state ──
  const yamlVisible = ref(false)
  const yamlText = ref('')

  // ── Render helpers ──
  function renderNsCell(ns: string) {
    const isSystem = ns === 'default' || ns.startsWith('kube-')
    return h('div', { style: 'display:flex;align-items:center;gap:6px' }, [
      h('span', { style: 'font-size:12px' }, ns),
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
      h('span', { style: 'font-size:14px;color:var(--el-text-color-primary)' }, name),
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

  // ── YAML dialog ──
  async function openYamlDialog(k: 'cm' | 'sec', ns: string, name: string) {
    const cluster = String(route.query.cluster ?? '')
    if (!cluster || !ns || !name) return
    try {
      let resource: unknown
      if (k === 'cm') resource = await fetchK8sConfigMap(cluster, ns, name)
      else resource = await fetchK8sSecret(cluster, ns, name)
      yamlText.value = yaml.dump(resource, { quotingType: '"' })
      yamlVisible.value = true
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '加载失败')
    }
  }

  // ── Delete resource ──
  async function deleteResource(k: 'cm' | 'sec', ns: string, name: string, refresh: () => void) {
    const cluster = String(route.query.cluster ?? '')
    if (!cluster || !ns || !name) return
    try {
      await ElMessageBox.confirm(`确定删除 "${name}" 吗？`, '删除确认', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
      if (k === 'cm') await deleteK8sConfigMap(cluster, ns, name)
      else await deleteK8sSecret(cluster, ns, name)
      ElMessage.success('删除成功')
      refresh()
    } catch {
      // user cancel
    }
  }

  // ── ConfigMap useTable ──
  type CmParams = { current: number; size: number; name?: string; namespace?: string }
  const {
    columns: cmColumns,
    columnChecks: cmColumnChecks,
    data: cmData,
    loading: cmLoading,
    pagination: cmPagination,
    getData: getCmData,
    replaceSearchParams: replaceCmSearchParams,
    handleSizeChange: cmHandleSizeChange,
    handleCurrentChange: cmHandleCurrentChange,
    refreshData: refreshCmData
  } = useTable({
    core: {
      immediate: true,
      apiFn: async (params: CmParams) => {
        const cluster = String(route.query.cluster ?? '')
        if (!cluster) return { code: 200, data: { records: [] as (K8sConfigMap & { rowKey: string })[], total: 0, current: 1, size: params.size } }
        const { items, total } = await fetchK8sConfigMapList(cluster, {
          page: params.current, limit: params.size,
          namespace: selectedNamespace.value || undefined,
          name: (params.name ?? '').trim() || undefined
        })
        let list = items.map((d, i) => ({ ...d, rowKey: d.metadata?.uid ?? d.metadata?.name ?? `cm-${i}` }))
        if (cmSortOrder.value) {
          list = [...list].sort((a, b) => {
            const ta = a.metadata?.creationTimestamp ?? '', tb = b.metadata?.creationTimestamp ?? ''
            return cmSortOrder.value === 'ascending' ? ta.localeCompare(tb) : tb.localeCompare(ta)
          })
        }
        return { code: 200, data: { records: list, total, current: params.current, size: params.size } }
      },
      apiParams: { current: 1, size: 10, name: undefined, namespace: undefined },
      columnsFactory: () => [
        { type: 'selection' },
        {
          prop: 'metadata.name',
          label: '名称',
          minWidth: 200,
          formatter: (row: K8sConfigMap) => renderNameCell(row.metadata?.name ?? '—')
        },
        {
          prop: 'metadata.namespace',
          label: '命名空间',
          width: 160,
          formatter: (row: K8sConfigMap) => renderNsCell(row.metadata?.namespace ?? '—')
        },
        {
          prop: 'dataCount',
          label: '数据项数',
          width: 100,
          formatter: (row: K8sConfigMap) => {
            const count = Object.keys(row.data ?? {}).length + Object.keys(row.binaryData ?? {}).length
            return h('span', { style: 'font-size:12px' }, String(count))
          }
        },
        {
          prop: 'metadata.creationTimestamp',
          label: '创建时间',
          width: 168,
          sortable: 'custom',
          formatter: (row: K8sConfigMap) =>
            h('span', { style: 'font-size:12px' }, formatNodeCreationTime(row.metadata?.creationTimestamp))
        },
        {
          prop: 'operation',
          label: '操作',
          width: 160,
          fixed: 'right',
          formatter: (row: K8sConfigMap) =>
            h('div', { style: 'display:flex;align-items:center;gap:12px' }, [
              h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => void openYamlDialog('cm', row.metadata?.namespace ?? '', row.metadata?.name ?? '') }, () => '查看YAML'),
              h(ElLink, { type: 'danger', underline: 'never', style: 'font-size:12px', onClick: () => void deleteResource('cm', row.metadata?.namespace ?? '', row.metadata?.name ?? '', onCmRefresh) }, () => '删除')
            ])
        }
      ]
    }
  })

  const cmVisibleColumns = computed(() =>
    cmColumns.value.filter((c) => !(selectedNamespace.value && c.prop === 'metadata.namespace'))
  )
  function runCmSearch() {
    const name = (cmSearchForm.value.name ?? '').trim() || undefined
    replaceCmSearchParams({ name, namespace: selectedNamespace.value || undefined })
    getCmData()
  }
  function forceCmSearch() {
    const name = (cmSearchForm.value.name ?? '').trim() || undefined
    replaceCmSearchParams({ name, namespace: selectedNamespace.value || undefined })
    getCmData()
  }
  function onCmRefresh() { refreshCmData() }
  function onCmSortChange({ prop, order }: { prop: string; order: string | null }) {
    if (prop === 'metadata.creationTimestamp') { cmSortOrder.value = (order as 'ascending' | 'descending' | null) ?? null; getCmData() }
  }

  // ── Secret useTable ──
  type SecParams = { current: number; size: number; name?: string; namespace?: string }
  const {
    columns: secColumns,
    columnChecks: secColumnChecks,
    data: secData,
    loading: secLoading,
    pagination: secPagination,
    getData: getSecData,
    replaceSearchParams: replaceSecSearchParams,
    handleSizeChange: secHandleSizeChange,
    handleCurrentChange: secHandleCurrentChange,
    refreshData: refreshSecData
  } = useTable({
    core: {
      immediate: false,
      apiFn: async (params: SecParams) => {
        const cluster = String(route.query.cluster ?? '')
        if (!cluster) return { code: 200, data: { records: [] as (K8sSecret & { rowKey: string })[], total: 0, current: 1, size: params.size } }
        const { items, total } = await fetchK8sSecretList(cluster, {
          page: params.current, limit: params.size,
          namespace: selectedNamespace.value || undefined,
          name: (params.name ?? '').trim() || undefined
        })
        let list = items.map((d, i) => ({ ...d, rowKey: d.metadata?.uid ?? d.metadata?.name ?? `sec-${i}` }))
        if (secSortOrder.value) {
          list = [...list].sort((a, b) => {
            const ta = a.metadata?.creationTimestamp ?? '', tb = b.metadata?.creationTimestamp ?? ''
            return secSortOrder.value === 'ascending' ? ta.localeCompare(tb) : tb.localeCompare(ta)
          })
        }
        return { code: 200, data: { records: list, total, current: params.current, size: params.size } }
      },
      apiParams: { current: 1, size: 10, name: undefined, namespace: undefined },
      columnsFactory: () => [
        { type: 'selection' },
        {
          prop: 'metadata.name',
          label: '名称',
          minWidth: 200,
          formatter: (row: K8sSecret) => renderNameCell(row.metadata?.name ?? '—')
        },
        {
          prop: 'metadata.namespace',
          label: '命名空间',
          width: 160,
          formatter: (row: K8sSecret) => renderNsCell(row.metadata?.namespace ?? '—')
        },
        {
          prop: 'type',
          label: '类型',
          width: 280,
          showOverflowTooltip: true,
          formatter: (row: K8sSecret) =>
            h(ElTag, { type: 'info', size: 'small' }, () => row.type ?? 'Opaque')
        },
        {
          prop: 'dataCount',
          label: '数据项数',
          width: 100,
          formatter: (row: K8sSecret) => {
            const count = Object.keys(row.data ?? {}).length + Object.keys(row.stringData ?? {}).length
            return h('span', { style: 'font-size:12px' }, String(count))
          }
        },
        {
          prop: 'metadata.creationTimestamp',
          label: '创建时间',
          width: 168,
          sortable: 'custom',
          formatter: (row: K8sSecret) =>
            h('span', { style: 'font-size:12px' }, formatNodeCreationTime(row.metadata?.creationTimestamp))
        },
        {
          prop: 'operation',
          label: '操作',
          width: 160,
          fixed: 'right',
          formatter: (row: K8sSecret) =>
            h('div', { style: 'display:flex;align-items:center;gap:12px' }, [
              h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px', onClick: () => void openYamlDialog('sec', row.metadata?.namespace ?? '', row.metadata?.name ?? '') }, () => '查看YAML'),
              h(ElLink, { type: 'danger', underline: 'never', style: 'font-size:12px', onClick: () => void deleteResource('sec', row.metadata?.namespace ?? '', row.metadata?.name ?? '', onSecRefresh) }, () => '删除')
            ])
        }
      ]
    }
  })

  const secVisibleColumns = computed(() =>
    secColumns.value.filter((c) => !(selectedNamespace.value && c.prop === 'metadata.namespace'))
  )
  function runSecSearch() {
    const name = (secSearchForm.value.name ?? '').trim() || undefined
    replaceSecSearchParams({ name, namespace: selectedNamespace.value || undefined })
    getSecData()
  }
  function forceSecSearch() {
    const name = (secSearchForm.value.name ?? '').trim() || undefined
    replaceSecSearchParams({ name, namespace: selectedNamespace.value || undefined })
    getSecData()
  }
  function onSecRefresh() { refreshSecData() }
  function onSecSortChange({ prop, order }: { prop: string; order: string | null }) {
    if (prop === 'metadata.creationTimestamp') { secSortOrder.value = (order as 'ascending' | 'descending' | null) ?? null; getSecData() }
  }

  // ── Tab lazy loading ──
  watch(kind, (val) => {
    const cluster = String(route.query.cluster ?? '')
    if (!cluster) return
    if (val === 'sec') getSecData()
  })

  watch(selectedNamespace, () => {
    if (kind.value === 'cm') getCmData()
    if (kind.value === 'sec') getSecData()
  })
</script>

<style>
  .config-page .icon-action {
    opacity: 0;
    transition: opacity 0.15s;
  }
  .config-page .el-table__row:hover .icon-action {
    opacity: 1;
  }
  .config-page .art-table .el-table {
    font-size: 13px;
  }
  .config-page .art-table .el-table th.el-table__cell {
    font-size: 13px;
  }
</style>

<style scoped>
  .workloads-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .workloads-toolbar__filters {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .workloads-toolbar__ns-select {
    width: 180px;
  }
  .workloads-toolbar__search {
    width: 200px;
  }
  .workloads-toolbar-search-btn {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    border: 1px solid var(--el-border-color);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: border-color 0.2s;
  }
  .workloads-toolbar-search-btn:hover {
    border-color: var(--el-color-primary);
  }
</style>

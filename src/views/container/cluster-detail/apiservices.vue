<template>
  <div class="apiservices-page">
    <div class="cluster-toolbar">
      <div />
      <div class="cluster-toolbar__right">
        <ElInput
          v-model="searchForm.name"
          clearable
          placeholder="请输入名称"
          class="cluster-toolbar__search"
          @keyup.enter="runSearch"
          @clear="runSearch"
        />
        <div
          class="cluster-toolbar-search-btn"
          role="button"
          tabindex="0"
          title="搜索"
          @click="forceSearch"
          @keyup.enter="forceSearch"
        >
          <ArtSvgIcon icon="ri:search-line" class="text-g-700" />
        </div>
        <ArtTableHeader
          v-model:columns="columnChecks"
          :loading="loading"
          layout="size,columns,settings"
          @refresh="onRefresh"
        />
      </div>
    </div>

    <ElCard class="art-table-card">
      <ArtTable
        row-key="rowKey"
        :show-table-header="false"
        :loading="loading"
        :data="data"
        :columns="columns"
        :pagination="pagination"
        :pagination-options="CLUSTER_TABLE_PAGINATION_OPTIONS"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      >
        <template #empty>
          <ClusterTableEmpty />
        </template>
      </ArtTable>
    </ElCard>

    <K8sYamlDialog
      v-model="yamlVisible"
      title="查看 YAML"
      :yaml="yamlText"
      footer-mode="edit"
      width="900px"
      :editor-height="480"
      :submit-loading="yamlSaving"
      @save="onYamlSave"
    />
  </div>
</template>

<script setup lang="ts">
  import { ElMessage, ElLink } from 'element-plus'
  import { CopyDocument } from '@element-plus/icons-vue'
  import yaml from 'js-yaml'
  import { h, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { CLUSTER_TABLE_PAGINATION_OPTIONS } from './constants/table'
  import ClusterTableEmpty from './components/cluster-table-empty.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { useSkipFirstActivatedRefresh } from '@/hooks/core/useSkipFirstActivatedRefresh'
  import { fetchK8sAPIService, fetchK8sAPIServiceList, type K8sAPIService } from '@/api/kubernetes/apiservice'
  import K8sYamlDialog from '@/components/kubernetes/k8s-yaml-dialog.vue'
  import { updateK8sResourceFromYaml } from '@/api/kubernetes/yamlCreate'

  defineOptions({ name: 'ClusterDetailApiservices' })

  const route = useRoute()
  const searchForm = ref<{ name?: string }>({})
  const yamlVisible = ref(false)
  const yamlText = ref('')
  const yamlSaving = ref(false)

  function renderNameCell(row: K8sAPIService) {
    const name = row.metadata?.name ?? '-'
    return h('div', { style: 'display:flex;align-items:center;gap:8px' }, [
      h(ElLink, {
        type: 'primary', underline: 'never', style: 'font-size:12px',
        onClick: () => void openYaml(row)
      }, () => name),
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

  function formatServiceRef(row: K8sAPIService): string {
    const s = row.spec?.service
    if (!s?.name) return 'Local'
    if (s.namespace) return `${s.namespace}/${s.name}`
    return s.name
  }

  function formatAvailable(row: K8sAPIService): string {
    const conds = row.status?.conditions ?? []
    const available = conds.find((c) => c.type === 'Available')
    return available?.status === 'True' ? 'True' : 'False'
  }

  function formatAge(ts: string | undefined): string {
    if (!ts) return '-'
    const now = Date.now()
    const created = new Date(ts).getTime()
    const diff = now - created
    const seconds = Math.floor(diff / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    if (hours < 48) return `${hours}h`
    return `${Math.floor(hours / 24)}d`
  }

  async function openYaml(row: K8sAPIService) {
    const cluster = String(route.query.cluster ?? '')
    const name = row.metadata?.name
    if (!cluster || !name) return
    try {
      const resource = await fetchK8sAPIService(cluster, name)
      yamlText.value = yaml.dump(resource, { quotingType: '"' })
      yamlVisible.value = true
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '加载失败')
    }
  }

  function onYamlSave(text: string) {
    yamlText.value = text
    void saveYaml()
  }

  async function saveYaml() {
    const cluster = String(route.query.cluster ?? '')
    yamlSaving.value = true
    try {
      await updateK8sResourceFromYaml(cluster, yamlText.value)
      ElMessage.success('保存成功')
      yamlVisible.value = false
      refreshData()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      yamlSaving.value = false
    }
  }

  type TableParams = { current: number; size: number; name?: string }

  const {
    columns, columnChecks, data, loading, pagination,
    getData, replaceSearchParams,
    handleSizeChange, handleCurrentChange, refreshData
  } = useTable({
    core: {
      immediate: false,
      apiFn: async (params: TableParams) => {
        const cluster = String(route.query.cluster ?? '')
        if (!cluster) {
          return { code: 200 as const, data: { records: [], total: 0, current: 1, size: params.size } }
        }
        const { items, total } = await fetchK8sAPIServiceList(cluster, {
          page: params.current, limit: params.size,
          name: (params.name ?? '').trim() || undefined
        })
        const records = items.map((row, i) => ({
          ...row, rowKey: row.metadata?.uid ?? row.metadata?.name ?? `apiservice-${i}`
        }))
        return { code: 200 as const, data: { records, total, current: params.current, size: params.size } }
      },
      apiParams: { current: 1, size: 10, name: undefined },
      columnsFactory: () => [
        {
          prop: 'metadata.name', label: 'NAME', minWidth: 200,
          formatter: (row: K8sAPIService) => renderNameCell(row)
        },
        {
          prop: 'spec.service', label: 'SERVICE', minWidth: 200,
          formatter: (row: K8sAPIService) =>
            h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, formatServiceRef(row))
        },
        {
          prop: 'available', label: 'AVAILABLE', width: 110,
          formatter: (row: K8sAPIService) =>
            h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, formatAvailable(row))
        },
        {
          prop: 'metadata.creationTimestamp', label: 'AGE', width: 120,
          formatter: (row: K8sAPIService) =>
            h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, formatAge(row.metadata?.creationTimestamp))
        },
        {
          prop: 'operation', label: '操作', width: 120, fixed: 'right',
          formatter: (row: K8sAPIService) =>
            h('div', { class: 'workloads-op-cell' }, [
              h(ElLink, {
                type: 'primary', underline: 'never', style: 'font-size:12px',
                onClick: () => void openYaml(row)
              }, () => '查看YAML')
            ])
        }
      ]
    }
  })

  function onRefresh() { refreshData() }
  function runSearch() {
    replaceSearchParams({ name: (searchForm.value.name ?? '').trim() || undefined })
    getData()
  }
  function forceSearch() { runSearch() }

  watch(() => route.query.cluster, (c) => { if (c) getData() }, { immediate: true })

  useSkipFirstActivatedRefresh(refreshData)
</script>

<style>
  .apiservices-page .icon-action {
    opacity: 0;
    transition: opacity 0.15s;
  }

  .apiservices-page .el-table__row:hover .icon-action {
    opacity: 1;
  }

  .apiservices-page .art-table .el-table {
    margin-top: 10px;
    font-size: 13px;
  }

  .apiservices-page .art-table .el-table th.el-table__cell {
    font-size: 13px;
  }

  .apiservices-page .workloads-op-cell {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 8px 10px;
    min-width: 0;
    justify-content: flex-end;
  }
</style>

<style scoped>
  .apiservices-page {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .apiservices-page :deep(.art-table-card) {
    flex: 1;
    min-height: 0;
  }

  .apiservices-page :deep(.art-table-card > .el-card__body) {
    padding-top: 12px;
  }

  .cluster-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 10px;
    margin-bottom: 10px;
    flex-shrink: 0;
    gap: 12px;
  }

  .cluster-toolbar__right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .cluster-toolbar__search {
    width: 250px;
    max-width: 100%;
  }

  .cluster-toolbar-search-btn {
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

  .cluster-toolbar-search-btn:hover {
    background: var(--art-gray-300);
  }

  .cluster-toolbar-search-btn:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 1px;
  }
</style>

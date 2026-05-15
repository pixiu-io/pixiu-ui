<template>
  <div class="services-page">
    <ElCard class="art-table-card">
      <ElTabs v-model="activeTab">
        <ElTabPane label="自定义资源" name="crd">
          <ArtTableHeader
            v-model:columns="columnChecks"
            :loading="loading"
            layout="size,fullscreen,columns,settings"
            style="margin-top: 15px"
            @refresh="onRefresh"
          >
            <template #left>
              <div class="workloads-toolbar">
                <ElButton v-ripple @click="openCreateYaml">新建</ElButton>
                <div class="workloads-toolbar__filters">
                  <ElInput
                    v-model="searchForm.name"
                    clearable
                    placeholder="请输入名称"
                    class="workloads-toolbar__search"
                    @keyup.enter="runSearch"
                    @clear="runSearch"
                  />
                  <div
                    class="workloads-toolbar-search-btn"
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
            :pagination-options="{ align: 'right', hideOnEmpty: false }"
            @pagination:size-change="handleSizeChange"
            @pagination:current-change="handleCurrentChange"
            @sort-change="onSortChange"
          >
            <template #empty>
              <div class="crds-table-empty">
                选择的该命名空间的列表为空，可以切换到其他命名空间
              </div>
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
      show-copy
      width="900px"
      :editor-height="480"
    />

    <K8sYamlDialog
      v-model="createYamlVisible"
      title="新建自定义资源"
      :yaml="createYamlText"
      :read-only="false"
      footer-mode="edit"
      confirm-text="确定"
      cancel-text="取消"
      show-copy
      width="900px"
      :editor-height="480"
      :submit-loading="createSubmitting"
      @save="onCreateYamlSave"
    />
  </div>
</template>

<script setup lang="ts">
  import { ElButton, ElCard, ElInput, ElLink, ElMessage, ElTabPane, ElTabs } from 'element-plus'
  import { CopyDocument } from '@element-plus/icons-vue'
  import yaml from 'js-yaml'
  import { h, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { useTable } from '@/hooks/core/useTable'
  import {
    fetchK8sCustomResourceDefinition,
    fetchK8sCustomResourceDefinitionList,
    type K8sCustomResourceDefinition
  } from '@/api/kubernetes/crd'
  import { formatNodeCreationTime } from '@/utils/kubernetes/nodeDisplay'
  import { createK8sResourceFromYaml } from '@/api/kubernetes/yamlCreate'
  import K8sYamlDialog from '@/components/kubernetes/k8s-yaml-dialog.vue'

  defineOptions({ name: 'ClusterDetailCrds' })

  const route = useRoute()
  const activeTab = ref('crd')
  const searchForm = ref<{ name?: string }>({})
  const yamlVisible = ref(false)
  const yamlText = ref('')
  const createYamlVisible = ref(false)
  const createYamlText = ref('')
  const createSubmitting = ref(false)
  const sortOrder = ref<'ascending' | 'descending' | null>(null)

  function openCreateYaml() {
    const cluster = String(route.query.cluster ?? '')
    if (!cluster) {
      ElMessage.warning('请先选择集群')
      return
    }
    createYamlText.value = ''
    createYamlVisible.value = true
  }

  async function onCreateYamlSave(text: string) {
    const cluster = String(route.query.cluster ?? '')
    if (!cluster) return
    createSubmitting.value = true
    try {
      await createK8sResourceFromYaml(cluster, text)
      ElMessage.success('创建成功')
      createYamlVisible.value = false
      onRefresh()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '创建失败')
    } finally {
      createSubmitting.value = false
    }
  }

  function renderNameCell(name: string) {
    return h('div', { style: 'display:flex;align-items:center;gap:8px' }, [
      h('span', { style: 'font-size:12px;color:var(--el-text-color-primary)' }, name),
      h(
        'span',
        {
          class: 'icon-action',
          style:
            'cursor:pointer;color:var(--el-text-color-secondary);display:inline-flex;align-items:center',
          title: '复制',
          onClick: (e: MouseEvent) => {
            e.stopPropagation()
            navigator.clipboard.writeText(name)
            ElMessage.success('已复制')
          }
        },
        [h(CopyDocument, { style: 'width:12px;height:12px' })]
      )
    ])
  }

  function formatShortNames(row: K8sCustomResourceDefinition): string {
    const sn = row.spec?.names?.shortNames
    if (!sn?.length) return '-'
    return sn.join(', ')
  }

  function formatLatestVersion(row: K8sCustomResourceDefinition): string {
    const group = row.spec?.group ?? ''
    const versions = row.spec?.versions ?? []
    if (!versions.length) return group || '-'
    const first = versions[0]?.name ?? ''
    return group && first ? `${group}/${first}` : first || group || '-'
  }

  function formatScope(scope: string | undefined): string {
    if (scope === 'Namespaced') return '命名空间'
    if (scope === 'Cluster') return '集群'
    return scope ?? '-'
  }

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
      immediate: false,
      apiFn: async (params: TableParams) => {
        const cluster = String(route.query.cluster ?? '')
        if (!cluster) {
          return {
            code: 200 as const,
            data: {
              records: [] as (K8sCustomResourceDefinition & { rowKey: string })[],
              total: 0,
              current: 1,
              size: params.size
            }
          }
        }
        const { items, total } = await fetchK8sCustomResourceDefinitionList(cluster, {
          page: params.current,
          limit: params.size,
          name: (params.name ?? '').trim() || undefined
        })
        let list = items.map((row, i) => ({
          ...row,
          rowKey: row.metadata?.uid ?? row.metadata?.name ?? `crd-${i}`
        }))
        if (sortOrder.value) {
          list = [...list].sort((a, b) => {
            const ta = a.metadata?.creationTimestamp ?? ''
            const tb = b.metadata?.creationTimestamp ?? ''
            return sortOrder.value === 'ascending' ? ta.localeCompare(tb) : tb.localeCompare(ta)
          })
        }
        return { code: 200 as const, data: { records: list, total, current: params.current, size: params.size } }
      },
      apiParams: { current: 1, size: 10, name: undefined },
      columnsFactory: () => [
        { type: 'selection', width: 30 },
        {
          prop: 'metadata.name',
          label: '资源名称',
          minWidth: 220,
          formatter: (row: K8sCustomResourceDefinition) =>
            renderNameCell(row.metadata?.name ?? '-')
        },
        {
          prop: 'spec.names.shortNames',
          label: '简写名称',
          width: 140,
          formatter: (row: K8sCustomResourceDefinition) =>
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-text-color-regular)' },
              formatShortNames(row)
            )
        },
        {
          prop: 'spec.names.kind',
          label: '类型',
          width: 160,
          formatter: (row: K8sCustomResourceDefinition) =>
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-text-color-regular)' },
              row.spec?.names?.kind ?? '-'
            )
        },
        {
          prop: 'spec.versions',
          label: '最新版本',
          minWidth: 200,
          showOverflowTooltip: true,
          formatter: (row: K8sCustomResourceDefinition) =>
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-text-color-regular)' },
              formatLatestVersion(row)
            )
        },
        {
          prop: 'spec.scope',
          label: '作用域',
          width: 100,
          formatter: (row: K8sCustomResourceDefinition) =>
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-text-color-regular)' },
              formatScope(row.spec?.scope)
            )
        },
        {
          prop: 'metadata.creationTimestamp',
          label: '创建时间',
          width: 168,
          sortable: 'custom',
          formatter: (row: K8sCustomResourceDefinition) =>
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-text-color-regular)' },
              formatNodeCreationTime(row.metadata?.creationTimestamp)
            )
        },
        {
          prop: 'operation',
          label: '操作',
          width: 120,
          fixed: 'right',
          formatter: (row: K8sCustomResourceDefinition) =>
            h('div', { style: 'display:flex;align-items:center;gap:12px' }, [
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () => void openYaml(row)
                },
                () => '查看YAML'
              )
            ])
        }
      ]
    }
  })

  async function openYaml(row: K8sCustomResourceDefinition) {
    const cluster = String(route.query.cluster ?? '')
    const name = row.metadata?.name
    if (!cluster || !name) return
    try {
      const obj = await fetchK8sCustomResourceDefinition(cluster, name)
      yamlText.value = yaml.dump(obj, { quotingType: '"' })
      yamlVisible.value = true
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '加载失败')
    }
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

  function onSortChange({ prop, order }: { prop: string; order: string | null }) {
    if (prop === 'metadata.creationTimestamp') {
      sortOrder.value = (order as 'ascending' | 'descending' | null) ?? null
      getData()
    }
  }

  watch(
    () => String(route.query.cluster ?? ''),
    (cluster) => {
      if (cluster) getData()
    },
    { immediate: true }
  )
</script>

<style>
  .services-page .icon-action {
    opacity: 0;
    transition: opacity 0.15s;
  }
  .services-page .el-table__row:hover .icon-action {
    opacity: 1;
  }
  .services-page .art-table .el-table {
    font-size: 13px;
  }
  .services-page .art-table .el-table th.el-table__cell {
    font-size: 13px;
  }
  .services-page .el-tabs__header {
    margin-top: -6px;
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

  .crds-table-empty {
    padding: 0 20px;
    line-height: 40px;
    font-size: 11px;
    color: var(--el-text-color-secondary);
    text-align: center;
  }
  .services-page :deep(.el-table__empty-block) {
    min-height: 40px;
  }
  .services-page :deep(.el-table__empty-text) {
    line-height: 40px;
    padding: 0;
  }
</style>

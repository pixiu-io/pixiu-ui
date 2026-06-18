<!-- 资源详情事件 Tab（与 Deployment 详情 workloads 事件样式一致） -->
<template>
  <div class="k8s-resource-events-pane">
    <ArtTableHeader
      v-model:columns="columnChecks"
      :loading="loading"
      layout="size,fullscreen,columns,settings"
      style="margin-top: 15px"
      @refresh="onRefresh"
    >
      <template #left>
        <div class="workloads-toolbar">
          <ElButton
            v-ripple
            :disabled="selectedRows.length === 0"
            @click="batchDelete"
          >
            批量删除
          </ElButton>
          <div class="workloads-toolbar__filters">
            <ElSelect
              v-model="searchForm.type"
              clearable
              placeholder="全部类型"
              class="workloads-toolbar__type"
              @change="runSearch"
              @clear="runSearch"
            >
              <ElOption label="Normal" value="Normal" />
              <ElOption label="Warning" value="Warning" />
              <ElOption label="Unknown" value="Unknown" />
            </ElSelect>
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
      :columns="visibleColumns"
      :pagination="pagination"
      :pagination-options="CLUSTER_TABLE_PAGINATION_OPTIONS"
      @selection-change="onSelectionChange"
      @pagination:size-change="handleSizeChange"
      @pagination:current-change="handleCurrentChange"
      @sort-change="onSortChange"
    >
      <template #empty>
        <ClusterTableEmpty />
      </template>
    </ArtTable>
  </div>
</template>

<script setup lang="ts">
  import { computed, h, ref, watch } from 'vue'
  import { ElButton, ElLink, ElMessage, ElMessageBox, ElOption, ElSelect, ElTag } from 'element-plus'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { deleteK8sEvent, fetchKubeRawEventList } from '@/api/kubernetes/events'
  import { formatNodeCreationTime } from '@/utils/kubernetes/nodeDisplay'
  import { createK8sEventMessageColumn } from '@/utils/kubernetes/eventDisplay'
  import { CLUSTER_TABLE_PAGINATION_OPTIONS } from '../constants/table'
  import ClusterTableEmpty from './cluster-table-empty.vue'

  defineOptions({ name: 'K8sResourceEventsPane' })

  const props = withDefaults(
    defineProps<{
      cluster: string
      namespace: string
      resourceName: string
      kind?: string
      active?: boolean
    }>(),
    { kind: 'Pod', active: false }
  )

  const searchForm = ref<{ type?: string }>({})
  const selectedRows = ref<any[]>([])
  const sortOrder = ref<'ascending' | 'descending' | null>(null)

  type EventParams = { current: number; size: number; type?: string }

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
      apiFn: async (params: EventParams) => {
        const cluster = props.cluster?.trim()
        const ns = props.namespace?.trim()
        const name = props.resourceName?.trim()
        if (!cluster || !ns || !name) {
          return {
            code: 200,
            data: { records: [] as any[], total: 0, current: params.current, size: params.size }
          }
        }

        const { items } = await fetchKubeRawEventList(cluster, {
          namespace: ns,
          name,
          kind: props.kind,
          namespaced: true,
          page: 1,
          limit: 200
        })

        const typeFilter = (params.type ?? '').trim()
        let filtered = (items as any[]).filter(
          (e) => !typeFilter || String(e.type ?? 'Unknown') === typeFilter
        )

        if (sortOrder.value) {
          filtered = [...filtered].sort((a, b) => {
            const ta = a.lastTimestamp ?? ''
            const tb = b.lastTimestamp ?? ''
            return sortOrder.value === 'ascending' ? ta.localeCompare(tb) : tb.localeCompare(ta)
          })
        }

        const total = filtered.length
        const start = (params.current - 1) * params.size
        let list = filtered.slice(start, start + params.size).map((e, i) => ({
          ...e,
          rowKey: e.metadata?.uid ?? `${e.reason ?? 'event'}-${start + i}`
        }))

        return {
          code: 200,
          data: { records: list, total, current: params.current, size: params.size }
        }
      },
      apiParams: { current: 1, size: 10, type: undefined },
      columnsFactory: () => [
        { type: 'selection', width: 30 },
        {
          prop: 'lastTimestamp',
          label: '最后出现时间',
          width: 170,
          sortable: 'custom',
          formatter: (row: any) =>
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-text-color-regular)' },
              formatNodeCreationTime(row.lastTimestamp)
            )
        },
        {
          prop: 'type',
          label: '类型',
          width: 100,
          formatter: (row: any) =>
            h(
              ElTag,
              {
                class:
                  row.type === 'Warning'
                    ? 'event-type-tag event-type-tag--warning'
                    : row.type === 'Normal'
                      ? 'event-type-tag event-type-tag--normal'
                      : 'event-type-tag',
                effect: 'dark',
                size: 'small'
              },
              () => row.type ?? 'Unknown'
            )
        },
        {
          prop: 'resource',
          label: '资源',
          minWidth: 120,
          showOverflowTooltip: true,
          formatter: (row: any) =>
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-text-color-regular)' },
              `${row.involvedObject?.kind ?? ''}/${row.involvedObject?.name ?? ''}` || '-'
            )
        },
        { prop: 'count', label: '出现次数', width: 100 },
        createK8sEventMessageColumn(),
        {
          prop: 'operation',
          label: '操作',
          width: 80,
          fixed: 'right',
          formatter: (row: any) =>
            h(
              ElLink,
              {
                type: 'primary',
                underline: 'never',
                style: 'font-size:12px',
                onClick: () => void deleteEvent(row)
              },
              () => '删除'
            )
        }
      ]
    }
  })

  const visibleColumns = computed(() => columns.value)

  function runSearch() {
    const type = (searchForm.value.type ?? '').trim() || undefined
    replaceSearchParams({ type })
    getData()
  }

  function forceSearch() {
    runSearch()
  }

  function onRefresh() {
    selectedRows.value = []
    refreshData()
  }

  function onSelectionChange(rows: any[]) {
    selectedRows.value = rows
  }

  function onSortChange({ prop, order }: { prop: string; order: string | null }) {
    if (prop === 'lastTimestamp') {
      sortOrder.value = (order as 'ascending' | 'descending' | null) ?? null
      getData()
    }
  }

  async function deleteEvent(row: any) {
    const cluster = props.cluster?.trim()
    const ns = row.metadata?.namespace ?? props.namespace
    const name = row.metadata?.name
    if (!cluster || !name) return
    try {
      await ElMessageBox.confirm('确定删除该事件吗？', '删除事件', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
      await deleteK8sEvent(cluster, ns, name)
      ElMessage.success('删除成功')
      onRefresh()
    } catch (e: unknown) {
      if (e === 'cancel') return
      ElMessage.error(e instanceof Error ? e.message : '删除失败')
    }
  }

  async function batchDelete() {
    if (!selectedRows.value.length) {
      ElMessage.warning('未选择待删除事件')
      return
    }
    try {
      await ElMessageBox.confirm(
        `确定批量删除 ${selectedRows.value.length} 条事件吗？`,
        '批量删除事件',
        {
          type: 'warning',
          confirmButtonText: '删除',
          cancelButtonText: '取消'
        }
      )
      const cluster = props.cluster?.trim()
      for (const ev of selectedRows.value) {
        const ns = ev.metadata?.namespace ?? props.namespace
        const name = ev.metadata?.name
        if (!name) continue
        await deleteK8sEvent(cluster!, ns, name)
      }
      ElMessage.success('批量删除事件成功')
      selectedRows.value = []
      onRefresh()
    } catch (e: unknown) {
      if (e === 'cancel') return
      ElMessage.error(e instanceof Error ? e.message : '删除失败')
    }
  }

  watch(
    () => [props.active, props.cluster, props.namespace, props.resourceName, props.kind] as const,
    ([active]) => {
      if (active) getData()
    },
    { immediate: true }
  )
</script>

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

  .workloads-toolbar__type {
    width: 220px;
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

  :deep(.event-type-tag.el-tag) {
    border: none;
    color: #fff;
  }

  :deep(.event-type-tag--normal.el-tag) {
    background-color: rgba(13, 185, 138, 0.14);
    color: #00c997;
  }

  :deep(.event-type-tag--warning.el-tag) {
    background-color: rgba(245, 158, 11, 0.18);
    color: #fbbf24;
  }
</style>

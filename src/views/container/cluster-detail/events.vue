<template>
  <div class="events-page">
    <div class="cluster-toolbar">
      <ElButton v-ripple :disabled="!selectedEvents.length" @click="batchDeleteEvents">
        批量删除
      </ElButton>
      <div class="cluster-toolbar__right">
        <ElSelect
          v-model="searchForm.type"
          clearable
          placeholder="全部类型"
          class="cluster-toolbar__search"
          @change="runSearch"
          @clear="runSearch"
        >
          <ElOption label="Normal" value="Normal" />
          <ElOption label="Warning" value="Warning" />
          <ElOption label="Unknown" value="Unknown" />
        </ElSelect>
        <div
          class="cluster-toolbar-search-btn"
          role="button"
          tabindex="0"
          title="搜索"
          @click="runSearch"
          @keyup.enter="runSearch"
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
        @selection-change="onSelectionChange"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      >
        <template #empty>
          <ClusterTableEmpty />
        </template>
      </ArtTable>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ElButton, ElLink, ElMessage, ElMessageBox, ElTag, ElSelect, ElOption } from 'element-plus'
  import { computed, h, ref, watch, inject } from 'vue'
import { CLUSTER_TABLE_PAGINATION_OPTIONS } from './constants/table'
import ClusterTableEmpty from './components/cluster-table-empty.vue'
  import { useRoute } from 'vue-router'
  import { useTable } from '@/hooks/core/useTable'
  import { useSkipFirstActivatedRefresh } from '@/hooks/core/useSkipFirstActivatedRefresh'
  import { useClusterDetailNamespaceRefresh } from '@/hooks/core/useClusterDetailNamespaceRefresh'
  import { deleteK8sEvent, fetchKubeRawEventList } from '@/api/kubernetes/events'
  import { PixiuApiError } from '@/api/container'
  import { formatNodeCreationTime } from '@/utils/kubernetes/nodeDisplay'
  import { createK8sEventMessageColumn } from '@/utils/kubernetes/eventDisplay'
  import { clusterDetailNamespaceKey } from './context'

  defineOptions({ name: 'ClusterDetailEvents' })

  interface K8sEventRow {
    metadata?: { name?: string; namespace?: string; uid?: string }
    lastTimestamp?: string
    type?: string
    involvedObject?: { kind?: string; name?: string }
    count?: number
    message?: string
    rowKey?: string
  }

  const route = useRoute()
  const searchForm = ref<{ type?: string }>({})
  const selectedEvents = ref<K8sEventRow[]>([])
  const eventCache = ref<{ cluster: string; items: K8sEventRow[] } | null>(null)

  const globalNs = inject(clusterDetailNamespaceKey)
  const selectedNamespace = computed(() => globalNs?.namespace.value ?? '')

  watch(
    () => String(route.query.cluster ?? ''),
    () => {
      eventCache.value = null
      selectedEvents.value = []
    }
  )

  type TableParams = { current: number; size: number; type?: string; namespace?: string }

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
        if (!cluster) {
          return {
            code: 200,
            data: { records: [] as K8sEventRow[], total: 0, current: 1, size: params.size }
          }
        }
        if (!eventCache.value || eventCache.value.cluster !== cluster) {
          const { items } = await fetchKubeRawEventList(cluster, {
            namespace: '',
            name: '',
            kind: '',
            namespaced: false,
            limit: 500
          })
          eventCache.value = {
            cluster,
            items: (items as K8sEventRow[]).map((ev, i) => ({
              ...ev,
              rowKey: ev.metadata?.uid || ev.metadata?.name || `event-${i}`
            }))
          }
        }
        let list = eventCache.value.items
        const type = (params.type ?? '').trim()
        if (type) {
          list = list.filter((ev) => (ev.type ?? 'Unknown') === type)
        }
        const ns = (params.namespace ?? '').trim()
        if (ns) {
          list = list.filter((ev) => ev.metadata?.namespace === ns)
        }
        const total = list.length
        const start = (params.current - 1) * params.size
        const records = list.slice(start, start + params.size)
        return {
          code: 200,
          data: { records, total, current: params.current, size: params.size }
        }
      },
      apiParams: { current: 1, size: 10, type: undefined, namespace: undefined },
      columnsFactory: () => [
        { type: 'selection', width: 30 },
        {
          prop: 'lastTimestamp',
          label: '最后出现时间',
          width: 170,
          formatter: (row: K8sEventRow) =>
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
          formatter: (row: K8sEventRow) => {
            const t = row.type || 'Unknown'
            const cls =
              t === 'Warning'
                ? 'event-type-tag event-type-tag--warning'
                : t === 'Normal'
                  ? 'event-type-tag event-type-tag--normal'
                  : 'event-type-tag'
            return h(ElTag, { class: cls, effect: 'dark', size: 'small' }, () => t)
          }
        },
        {
          prop: 'resource',
          label: '资源',
          minWidth: 120,
          showOverflowTooltip: true,
          formatter: (row: K8sEventRow) => {
            const kind = row.involvedObject?.kind ?? ''
            const name = row.involvedObject?.name ?? ''
            const text = kind && name ? `${kind}/${name}` : kind || name || '-'
            return h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, text)
          }
        },
        {
          prop: 'count',
          label: '出现次数',
          width: 100,
          formatter: (row: K8sEventRow) =>
            h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, String(row.count ?? 0))
        },
        createK8sEventMessageColumn<K8sEventRow>(),
        {
          prop: 'operation',
          label: '操作',
          width: 80,
          fixed: 'right',
          formatter: (row: K8sEventRow) =>
            h('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:nowrap' }, [
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () => void deleteSingleEvent(row)
                },
                () => '删除'
              )
            ])
        }
      ]
    }
  })

  function onSelectionChange(rows: K8sEventRow[]) {
    selectedEvents.value = rows
  }

  useClusterDetailNamespaceRefresh('events', () => {
    eventCache.value = null
    replaceSearchParams({ namespace: selectedNamespace.value || undefined })
    getData()
  })

  function runSearch() {
    const type = (searchForm.value.type ?? '').trim() || undefined
    replaceSearchParams({ type })
    getData()
  }

  function onRefresh() {
    eventCache.value = null
    selectedEvents.value = []
    refreshData()
  }

  useSkipFirstActivatedRefresh(onRefresh)

  async function deleteSingleEvent(row: K8sEventRow) {
    const cluster = String(route.query.cluster ?? '')
    const ns = row.metadata?.namespace ?? 'default'
    const nm = row.metadata?.name
    if (!cluster || !nm) return
    try {
      await ElMessageBox.confirm(`确定删除该事件吗？`, '删除事件', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
      await deleteK8sEvent(cluster, ns, nm)
      ElMessage.success('删除成功')
      onRefresh()
    } catch (e: unknown) {
      if (e === 'cancel') return
      if (e instanceof PixiuApiError && e.notified) return
      ElMessage.error(e instanceof Error ? e.message : '删除失败')
    }
  }

  async function batchDeleteEvents() {
    if (!selectedEvents.value.length) {
      ElMessage.warning('未选择待删除事件')
      return
    }
    try {
      await ElMessageBox.confirm(
        `确定批量删除 ${selectedEvents.value.length} 条事件吗？`,
        '批量删除事件',
        {
          type: 'warning',
          confirmButtonText: '删除',
          cancelButtonText: '取消'
        }
      )
      const cluster = String(route.query.cluster ?? '')
      for (const ev of selectedEvents.value) {
        const ns = ev.metadata?.namespace ?? 'default'
        const nm = ev.metadata?.name
        if (!nm) continue
        await deleteK8sEvent(cluster, ns, nm)
      }
      ElMessage.success('批量删除事件成功')
      onRefresh()
    } catch (e: unknown) {
      if (e === 'cancel') return
      if (e instanceof PixiuApiError && e.notified) return
      ElMessage.error(e instanceof Error ? e.message : '删除失败')
    }
  }
</script>

<style>
  .events-page .art-table .el-table {
    margin-top: 10px;
    font-size: 13px;
  }
  .events-page .art-table .el-table th.el-table__cell {
    font-size: 13px;
  }
</style>

<style scoped>
  .events-page {
    height: 100%;
    display: flex;
    flex-direction: column;
  }


  .events-page :deep(.art-table-card) {
    flex: 1;
    min-height: 0;
  }

  .events-page :deep(.art-table-card > .el-card__body) {
    padding-top: 4px;
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

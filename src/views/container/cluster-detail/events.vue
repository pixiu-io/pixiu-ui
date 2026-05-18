<template>
  <div class="events-page">
    <ElCard class="art-table-card">
      <ArtTableHeader
        v-model:columns="columnChecks"
        :loading="loading"
        layout="size,fullscreen,columns,settings"
        @refresh="onRefresh"
      >
        <template #left>
          <div class="events-toolbar">
            <ElButton type="danger" plain :disabled="!selectedEvents.length" @click="batchDeleteEvents">
              批量删除
            </ElButton>
            <div class="events-toolbar__filters">
              <ElSelect
                v-model="searchForm.type"
                clearable
                placeholder="全部类型"
                class="events-toolbar__type"
                @change="runSearch"
                @clear="runSearch"
              >
                <ElOption label="Normal" value="Normal" />
                <ElOption label="Warning" value="Warning" />
                <ElOption label="Unknown" value="Unknown" />
              </ElSelect>
              <div
                class="events-toolbar-search-btn"
                role="button"
                tabindex="0"
                title="搜索"
                @click="runSearch"
                @keyup.enter="runSearch"
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
  import { deleteK8sEvent, fetchKubeRawEventList } from '@/api/kubernetes/events'
  import { formatNodeCreationTime } from '@/utils/kubernetes/nodeDisplay'
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
          minWidth: 200,
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
        {
          prop: 'message',
          label: '内容',
          minWidth: 280,
          showOverflowTooltip: true,
          formatter: (row: K8sEventRow) =>
            h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, row.message ?? '-')
        },
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
                  style: 'font-size:12px;color:var(--el-text-color-regular)',
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

  watch(selectedNamespace, (ns) => {
    
    eventCache.value = null
    replaceSearchParams({ namespace: ns || undefined })
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
      ElMessage.error(e instanceof Error ? e.message : '删除失败')
    }
  }
</script>

<style>
  .events-page .art-table .el-table {
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

  .events-toolbar {
    display: flex;
    width: 100%;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .events-toolbar__filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-left: auto;
    margin-right: 8px;
  }

  .events-toolbar__ns-wrap {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .events-toolbar__ns-select {
    width: 160px;
  }

  .events-toolbar__ns-select :deep(.el-select__placeholder) {
    color: var(--el-text-color-regular);
    font-size: 13px;
  }

  .events-toolbar__type {
    width: 220px;
    max-width: 100%;
  }

  .events-toolbar__type :deep(.el-select__selected-item),
  .events-toolbar__type :deep(.el-select__placeholder) {
    font-size: 13px;
    font-weight: var(--el-menu-item-font-weight, 400);
    color: #C7C7D1;
  }

  .events-toolbar-search-btn {
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

  .events-toolbar-search-btn:hover {
    background: var(--art-gray-300);
  }

  .events-toolbar-search-btn:focus-visible {
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

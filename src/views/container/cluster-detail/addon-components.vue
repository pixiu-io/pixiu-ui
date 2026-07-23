<!-- 组件管理（演示数据，列表样式与命名空间页一致） -->
<template>
  <div class="addon-components-page">
    <div class="cluster-toolbar">
      <div />
      <div class="cluster-toolbar__right">
        <ElInput
          v-model="searchForm.name"
          clearable
          placeholder="请输入组件名称"
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
  </div>
</template>

<script setup lang="ts">
  import { ElInput, ElTag } from 'element-plus'
  import { h, ref, watch } from 'vue'
import { CLUSTER_TABLE_PAGINATION_OPTIONS } from './constants/table'
import ClusterTableEmpty from './components/cluster-table-empty.vue'
  import { useRoute } from 'vue-router'
  import { useTable } from '@/hooks/core/useTable'
  import { useSkipFirstActivatedRefresh } from '@/hooks/core/useSkipFirstActivatedRefresh'

  defineOptions({ name: 'ClusterDetailAddonComponents' })

  type AddonRow = {
    rowKey: string
    name: string
    version: string
    status: string
    note: string
  }

  const route = useRoute()
  const searchForm = ref<{ name?: string }>({})

  const ALL_ROWS: AddonRow[] = [
    { rowKey: 'coredns', name: 'CoreDNS', version: 'v1.11.1', status: 'Running', note: '集群 DNS' },
    {
      rowKey: 'kube-proxy',
      name: 'kube-proxy',
      version: 'v1.28.x',
      status: 'Running',
      note: '节点网络代理'
    },
    {
      rowKey: 'metrics-server',
      name: 'metrics-server',
      version: 'v0.7.x',
      status: 'Running',
      note: '资源度量'
    },
    {
      rowKey: 'ingress-nginx',
      name: 'ingress-nginx',
      version: 'v1.9.x',
      status: 'Running',
      note: 'Ingress 控制器（演示）'
    }
  ]

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
        if (!cluster) {
          return {
            code: 200 as const,
            data: {
              records: [] as AddonRow[],
              total: 0,
              current: 1,
              size: params.size
            }
          }
        }
        const q = (params.name ?? '').trim().toLowerCase()
        const filtered = q
          ? ALL_ROWS.filter((r) => r.name.toLowerCase().includes(q) || r.note.toLowerCase().includes(q))
          : ALL_ROWS
        const total = filtered.length
        const start = (params.current - 1) * params.size
        const records = filtered.slice(start, start + params.size)
        return { code: 200 as const, data: { records, total, current: params.current, size: params.size } }
      },
      apiParams: { current: 1, size: 10, name: undefined },
      columnsFactory: () => [
        {
          prop: 'name',
          label: '组件',
          minWidth: 200,
          formatter: (row: AddonRow) =>
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-text-color-primary)' },
              row.name ?? '-'
            )
        },
        {
          prop: 'version',
          label: '版本',
          width: 140,
          formatter: (row: AddonRow) =>
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-text-color-regular)' },
              row.version ?? '-'
            )
        },
        {
          prop: 'status',
          label: '状态',
          width: 110,
          formatter: (row: AddonRow) => {
            const ok = row.status === 'Running'
            return h(ElTag, { type: ok ? 'success' : 'warning', size: 'small' }, () => row.status ?? '-')
          }
        },
        {
          prop: 'note',
          label: '说明',
          minWidth: 220,
          showOverflowTooltip: true,
          formatter: (row: AddonRow) =>
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-text-color-regular)' },
              row.note ?? '-'
            )
        }
      ]
    }
  })

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

  watch(
    () => String(route.query.cluster ?? ''),
    (cluster) => {
      if (cluster) getData()
    }
  )

  useSkipFirstActivatedRefresh(refreshData)
</script>

<style>
  .addon-components-page .art-table .el-table {
    font-size: 13px;
  }
  .addon-components-page .art-table .el-table th.el-table__cell {
    font-size: 13px;
  }
</style>

<style scoped>
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

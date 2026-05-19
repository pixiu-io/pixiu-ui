<template>
  <div class="audit-page art-full-height">
    <!-- 过滤条 -->
    <ElCard class="mb-4 search-card">
      <ElForm :model="searchForm" inline class="search-form">
        <div class="search-form-left">
          <ElFormItem label="操作人">
            <ElInput
              v-model="searchForm.operator"
              placeholder="请输入操作人"
              clearable
              style="width: 160px"
              @keyup.enter="handleSearch"
            />
          </ElFormItem>
          <ElFormItem label="请求方式">
            <ElSelect
              v-model="searchForm.action"
              placeholder="全部"
              clearable
              style="width: 140px"
            >
              <ElOption label="创建 (POST)" value="POST" />
              <ElOption label="删除 (DELETE)" value="DELETE" />
              <ElOption label="更新 (PUT)" value="PUT" />
              <ElOption label="更新 (PATCH)" value="PATCH" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="集群">
            <ElSelect
              v-model="searchForm.cluster"
              placeholder="全部"
              clearable
              style="width: 160px"
              :loading="clustersLoading"
            >
              <ElOption
                v-for="c in clusterOptions"
                :key="c.value"
                :label="c.label"
                :value="c.value"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem v-show="showAdvanced" label="资源类型">
            <ElSelect
              v-model="searchForm.object_type"
              placeholder="全部"
              clearable
              style="width: 140px"
            >
              <ElOption label="集群" value="clusters" />
              <ElOption label="用户" value="users" />
              <ElOption label="租户" value="tenants" />
              <ElOption label="版本计划" value="plans" />
              <ElOption label="认证" value="auth" />
            </ElSelect>
          </ElFormItem>
        </div>
        <ElFormItem class="search-form-actions">
          <ElButton type="primary" @click="handleSearch" v-ripple>查询</ElButton>
          <ElButton @click="handleReset" v-ripple>重置</ElButton>
          <ElButton text class="search-form-toggle" @click="toggleAdvanced" v-ripple>
            {{ showAdvanced ? '收起' : '展开' }}
            <ElIcon class="search-form-toggle__icon">
              <ArrowUpBold v-if="showAdvanced" />
              <ArrowDownBold v-else />
            </ElIcon>
          </ElButton>
        </ElFormItem>
      </ElForm>
    </ElCard>

    <!-- 列表 -->
    <ElCard class="art-table-card">
      <ArtTableHeader :loading="loading" @refresh="refreshData" />
      <ArtTable
        row-key="id"
        :loading="loading"
        :data="data"
        :columns="columns"
        :pagination="pagination"
        :pagination-options="{ align: 'right' }"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ArrowDownBold, ArrowUpBold } from '@element-plus/icons-vue'
  import { ElTag, ElTooltip } from 'element-plus'
  import { useTable } from '@/hooks/core/useTable'
  import { fetchAuditList } from '@/api/audit'
  import type { AuditItem } from '@/api/audit'
  import { fetchClusterList } from '@/api/container'

  defineOptions({ name: 'Audit' })

  // 请求方式 → 显示配置
  const ACTION_CONFIG: Record<string, { label: string; type: 'primary' | 'danger' | 'warning' | 'info' }> = {
    POST: { label: '创建', type: 'primary' },
    DELETE: { label: '删除', type: 'danger' },
    PUT: { label: '更新', type: 'warning' },
    PATCH: { label: '更新', type: 'warning' },
  }

  // 操作状态 → 显示配置
  const STATUS_CONFIG: Record<number, { label: string; type: 'success' | 'danger' | 'info' }> = {
    0: { label: '失败', type: 'danger' },
    1: { label: '成功', type: 'success' },
    2: { label: '未知', type: 'info' },
  }

  // 资源类型 → 中文显示
  const OBJECT_TYPE_LABEL: Record<string, string> = {
    clusters: '集群',
    users: '用户',
    tenants: '租户',
    plans: '版本计划',
    auth: '认证',
    '*': '-',
  }

  /** 格式化 ISO 日期为 yyyy-MM-dd HH:mm:ss */
  function formatDate(iso: string): string {
    if (!iso) return '-'
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  const searchForm = ref({
    operator: '',
    action: '',
    object_type: '',
    cluster: '',
  })
  const showAdvanced = ref(false)

  const clusterOptions = ref<{ label: string; value: string }[]>([])
  const clustersLoading = ref(false)

  onMounted(async () => {
    clustersLoading.value = true
    try {
      const { items } = await fetchClusterList({ page: 1, limit: 500 })
      clusterOptions.value = items.map((c) => ({ label: c.aliasName || c.name, value: c.name }))
    } catch {
      // 集群列表加载失败时静默处理，不影响审计页面使用
    } finally {
      clustersLoading.value = false
    }
  })

  const {
    columns,
    data,
    loading,
    pagination,
    getData,
    replaceSearchParams,
    resetSearchParams,
    handleSizeChange,
    handleCurrentChange,
    refreshData,
  } = useTable({
    core: {
      apiFn: async (params: {
        current: number
        size: number
        operator?: string
        action?: string
        object_type?: string
        cluster?: string
      }) => {
        const { total, items } = await fetchAuditList({
          page: params.current,
          limit: params.size,
          operator: params.operator || undefined,
          action: params.action || undefined,
          object_type: params.object_type || undefined,
          cluster: params.cluster || undefined,
        })
        return {
          code: 200,
          data: { records: items, total, current: params.current, size: params.size },
        }
      },
      apiParams: { current: 1, size: 10 },
      columnsFactory: () => [
        {
          label: '操作人',
          width: 120,
          formatter: (row: AuditItem) => h('span', { style: 'font-size:12px' }, row.operator || '-'),
        },
        {
          prop: 'status',
          label: '状态',
          width: 80,
          formatter: (row: AuditItem) => {
            const cfg = STATUS_CONFIG[row.status] ?? { label: '未知', type: 'info' as const }
            return h(ElTag, { type: cfg.type, size: 'small' }, () => cfg.label)
          },
        },
        {
          prop: 'action',
          label: '请求方式',
          width: 90,
          formatter: (row: AuditItem) => {
            const cfg = ACTION_CONFIG[row.action] ?? { label: row.action || '-', type: 'info' as const }
            return h(ElTag, { type: cfg.type, size: 'small' }, () => cfg.label)
          },
        },
        {
          prop: 'cluster',
          label: '集群',
          width: 120,
          formatter: (row: AuditItem) =>
            h('span', { style: 'font-size:12px' }, row.cluster || '-'),
        },
        {
          prop: 'objectType',
          label: '资源类型',
          width: 100,
          formatter: (row: AuditItem) =>
            h('span', { style: 'font-size:12px' }, OBJECT_TYPE_LABEL[row.objectType] ?? (row.objectType || '-')),
        },
        {
          prop: 'path',
          label: '请求路径',
          minWidth: 220,
          showOverflowTooltip: true,
          formatter: (row: AuditItem) =>
            h(
              ElTooltip,
              { content: row.path, placement: 'top', showAfter: 300 },
              () => h('span', { style: 'font-size:12px;font-family:monospace' }, row.path || '-')
            ),
        },
        {
          prop: 'ip',
          label: 'IP 地址',
          width: 140,
          formatter: (row: AuditItem) =>
            h('span', { style: 'font-size:12px;font-family:monospace' }, row.ip || '-'),
        },
        {
          prop: 'duration',
          label: '耗时',
          width: 90,
          formatter: (row: AuditItem) =>
            h('span', { style: 'font-size:12px' }, `${row.duration} ms`),
        },
        {
          prop: 'gmtCreate',
          label: '操作时间',
          width: 160,
          sortable: true,
          showOverflowTooltip: true,
          formatter: (row: AuditItem) =>
            h('span', { style: 'font-size:12px' }, formatDate(row.gmtCreate)),
        },
      ],
    },
  })

  const selectedRows = ref<AuditItem[]>([])

  function handleSelectionChange(rows: AuditItem[]) {
    selectedRows.value = rows
  }

  function handleSearch() {
    replaceSearchParams({
      operator: searchForm.value.operator.trim() || undefined,
      action: searchForm.value.action || undefined,
      object_type: searchForm.value.object_type || undefined,
      cluster: searchForm.value.cluster || undefined,
    })
    getData()
  }

  function handleReset() {
    searchForm.value = { operator: '', action: '', object_type: '', cluster: '' }
    resetSearchParams()
  }

  function toggleAdvanced() {
    showAdvanced.value = !showAdvanced.value
    if (!showAdvanced.value) {
      searchForm.value.object_type = ''
      replaceSearchParams({ object_type: undefined })
      getData()
    }
  }
</script>

<style scoped>
  .search-card :deep(.el-card__body) {
    padding-bottom: 0;
  }

  .search-form {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .search-form-left {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
  }

  .search-form-actions {
    margin-left: auto;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .search-form-toggle {
    margin-left: 14px;
    padding-inline: 4px;
    line-height: 32px;
    color: var(--theme-color);
  }

  .search-form-toggle__icon {
    margin-left: 4px;
    font-size: 14px;
  }

  .search-form-toggle:hover {
    color: var(--el-color-primary);
  }

  .audit-page .art-table .el-table {
    font-size: 13px;
  }

  .audit-page .art-table .el-table th.el-table__cell {
    font-size: 13px;
  }
</style>

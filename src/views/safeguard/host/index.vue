<template>
  <div class="host-page art-full-height">
    <HostSearch
      v-model="searchForm"
      :plan-options="planOptions"
      @search="handleSearch"
      @reset="handleReset"
    />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElButton :disabled="!searchForm.planId" v-ripple @click="goEditDeploy(searchForm.planId!)">
            编辑部署节点
          </ElButton>
        </template>
      </ArtTableHeader>

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
  import { h, onActivated, onMounted, ref } from 'vue'
  import { CopyDocument } from '@element-plus/icons-vue'
  import { ElLink, ElMessage, ElTag } from 'element-plus'
  import ArtButtonMore, { type ButtonMoreItem } from '@/components/core/forms/art-button-more/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { fetchPlanList, fetchPlanNodes, type PlanNodeListItem } from '@/api/plan'
  import { useRouter } from 'vue-router'
  import HostSearch from './modules/host-search.vue'

  defineOptions({ name: 'SafeguardHost' })

  const router = useRouter()

  const searchForm = ref<{ planId?: number; hostName?: string }>({})

  const planOptions = ref<{ label: string; value: number }[]>([])
  function authTypeLabel(t?: string): string {
    if (t === 'password') return '密码'
    if (t === 'key') return '密钥'
    if (t === 'none') return '无'
    return t?.trim() ? String(t) : '—'
  }

  function authTagType(t?: string): 'success' | 'warning' | 'info' {
    if (t === 'password') return 'success'
    if (t === 'key') return 'warning'
    return 'info'
  }

  function goEditDeploy(planId: number) {
    if (!planId) return
    router.push({
      path: '/container/cluster/deploy',
      query: { planId: String(planId), mode: 'edit' }
    })
  }

  function hostMoreClick(item: ButtonMoreItem, row: PlanNodeListItem) {
    switch (item.key) {
      case 'copyName':
        void navigator.clipboard.writeText(row.name)
        ElMessage.success('已复制主机名称')
        break
      case 'copyIp':
        void navigator.clipboard.writeText(row.ip || '')
        ElMessage.success('已复制 IP')
        break
      default:
        break
    }
  }

  const {
    columns,
    columnChecks,
    data,
    loading,
    pagination,
    getData,
    replaceSearchParams,
    resetSearchParams,
    handleSizeChange,
    handleCurrentChange,
    refreshData
  } = useTable({
    core: {
      immediate: false,
      apiFn: async (params: {
        current: number
        size: number
        planId?: number | string
        hostName?: string
      }) => {
        const rawPid = params.planId
        const planId =
          rawPid === '' || rawPid === undefined || rawPid === null ? NaN : Number(rawPid)
        if (!Number.isFinite(planId) || planId <= 0) {
          return {
            code: 200,
            data: {
              records: [] as PlanNodeListItem[],
              total: 0,
              current: params.current,
              size: params.size
            }
          }
        }
        const list = await fetchPlanNodes(planId)
        const q = (params.hostName || '').trim().toLowerCase()
        let rows = list
        if (q) {
          rows = rows.filter(
            (r) => r.name.toLowerCase().includes(q) || (r.ip || '').toLowerCase().includes(q)
          )
        }
        const total = rows.length
        const start = (params.current - 1) * params.size
        const records = rows.slice(start, start + params.size)
        return {
          code: 200,
          data: { records, total, current: params.current, size: params.size }
        }
      },
      apiParams: {
        current: 1,
        size: 10,
        planId: undefined as number | undefined,
        hostName: undefined as string | undefined
      },
      columnsFactory: () => [
        {
          prop: 'name',
          label: '主机名称',
          minWidth: 200,
          formatter: (row: PlanNodeListItem) =>
            h('div', { style: 'line-height:1.8' }, [
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:14px',
                  onClick: () => goEditDeploy(row.plan_id)
                },
                () => row.name
              ),
              h(
                'div',
                {
                  style:
                    'display:flex;align-items:center;gap:4px;color:var(--el-text-color-secondary);font-size:12px'
                },
                [
                  h('span', `ID: ${row.id}`),
                  h(
                    'span',
                    {
                      class: 'icon-action',
                      style: 'cursor:pointer;display:inline-flex;align-items:center',
                      title: '复制 ID',
                      onClick: (e: MouseEvent) => {
                        e.stopPropagation()
                        void navigator.clipboard.writeText(String(row.id))
                        ElMessage.success('已复制')
                      }
                    },
                    [h(CopyDocument, { style: 'width:12px;height:12px' })]
                  )
                ]
              )
            ])
        },
        {
          prop: 'ip',
          label: 'IP',
          minWidth: 140,
          formatter: (row: PlanNodeListItem) =>
            h('span', { style: 'font-size:13px;font-family:var(--el-font-family-mono,monospace)' }, row.ip || '—')
        },
        {
          prop: 'auth',
          label: '认证类型',
          width: 120,
          formatter: (row: PlanNodeListItem) => {
            const t = row.auth?.type
            return h(
              ElTag,
              { type: authTagType(t), size: 'small' },
              () => authTypeLabel(t)
            )
          }
        },
        {
          prop: 'operation',
          label: '操作',
          width: 200,
          fixed: 'right',
          formatter: (row: PlanNodeListItem) =>
            h('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:nowrap' }, [
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () => goEditDeploy(row.plan_id)
                },
                () => '编辑部署'
              ),
              h(ArtButtonMore, {
                list: [
                  { key: 'copyName', label: '复制主机名称', icon: 'ri:file-copy-line' },
                  { key: 'copyIp', label: '复制 IP', icon: 'ri:links-line' }
                ],
                onClick: (item: ButtonMoreItem) => hostMoreClick(item, row)
              })
            ])
        }
      ]
    }
  })

  function handleSearch(params: typeof searchForm.value) {
    if (params.planId == null) {
      ElMessage.warning('请选择部署计划')
      return
    }
    replaceSearchParams({
      planId: params.planId,
      hostName: params.hostName
    })
    void getData()
  }

  function handleReset() {
    void resetSearchParams()
  }

  onMounted(async () => {
    try {
      const { list, total } = await fetchPlanList({ page: 1, limit: 500 })
      planOptions.value = list.map((p) => ({ label: p.name, value: p.id }))
      if (total > 500 && list.length === 500) {
        ElMessage.info('部署计划较多，下拉列表仅展示前 500 条，可搜索部署页查看全部')
      }
    } catch {
      planOptions.value = []
    }
  })

  onActivated(() => {
    void refreshData()
  })
</script>

<style>
  .host-page .icon-action {
    opacity: 0;
    transition: opacity 0.15s;
  }
  .host-page .el-table__row:hover .icon-action {
    opacity: 1;
  }
  .host-page .art-table .el-table {
    font-size: 13px;
  }
  .host-page .art-table .el-table th.el-table__cell {
    font-size: 13px;
  }
</style>

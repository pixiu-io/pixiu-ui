<template>
  <div class="hpa-page">
    <div class="cluster-toolbar">
      <ElButton v-ripple @click="goCreateHPA"
        >新建{{
          resourceTab === 'hpa' ? 'HPA' : resourceTab === 'cron' ? '定时 HPA' : ''
        }}</ElButton
      >
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
      <ElTabs v-model="resourceTab" class="hpa-tabs">
        <ElTabPane label="水平自动扩缩容" name="hpa">
          <ArtTable
            row-key="rowKey"
            :show-table-header="false"
            :loading="loading"
            :data="data"
            :columns="visibleColumns"
            :pagination="pagination"
            :pagination-options="CLUSTER_TABLE_PAGINATION_OPTIONS"
            @pagination:size-change="handleSizeChange"
            @pagination:current-change="handleCurrentChange"
          >
            <template #empty>
              <ClusterTableEmpty />
            </template>
          </ArtTable>
        </ElTabPane>

        <ElTabPane label="定时自动扩缩容" name="cron">
          <ArtTable
            row-key="rowKey"
            :show-table-header="false"
            :loading="cronLoading"
            :data="cronData"
            :columns="visibleCronColumns"
            :pagination="cronPagination"
            :pagination-options="CLUSTER_TABLE_PAGINATION_OPTIONS"
            @pagination:size-change="cronHandleSizeChange"
            @pagination:current-change="cronHandleCurrentChange"
          >
            <template #empty>
              <ClusterTableEmpty />
            </template>
          </ArtTable>
        </ElTabPane>
        <ElTabPane label="增强型自动扩缩容" name="ehpa" disabled>
          <div class="hpa-tab-placeholder">敬请期待</div>
        </ElTabPane>
      </ElTabs>
    </ElCard>

    <!-- ── 定时扩缩容执行历史弹窗 ── -->
    <ElDialog
      v-model="historyVisible"
      :title="`执行历史 - ${historyTitle}`"
      width="860px"
      class="cron-history-dialog"
    >
      <div v-loading="historyLoading" style="min-height: 120px">
        <ElTable :data="historyList" size="small" max-height="420">
          <ElTableColumn prop="job_name" label="定时任务" min-width="120" />
          <ElTableColumn label="计划时间" width="170">
            <template #default="{ row }">{{ formatNodeCreationTime(row.scheduled_time) }}</template>
          </ElTableColumn>
          <ElTableColumn label="副本变化" width="110">
            <template #default="{ row }"
              >{{ row.previous_replicas }} → {{ row.desired_replicas }}</template
            >
          </ElTableColumn>
          <ElTableColumn label="结果" width="90">
            <template #default="{ row }">
              <ElTag
                size="small"
                :type="
                  row.result === 'Succeed' ? 'success' : row.result === 'Failed' ? 'danger' : 'info'
                "
                >{{
                  row.result === 'Succeed' ? '成功' : row.result === 'Failed' ? '失败' : '跳过'
                }}</ElTag
              >
            </template>
          </ElTableColumn>
          <ElTableColumn prop="message" label="信息" min-width="200" show-overflow-tooltip />
        </ElTable>
        <div v-if="!historyLoading && !historyList.length" class="hpa-tab-placeholder"
          >暂无执行记录</div
        >
      </div>
    </ElDialog>

    <!-- ── HPA 执行历史（集群事件）弹窗 ── -->
    <ElDialog
      v-model="hpaEventsVisible"
      :title="`执行历史 - ${hpaEventsTitle}`"
      width="860px"
      class="cron-history-dialog"
    >
      <div v-loading="hpaEventsLoading" style="min-height: 120px">
        <ElTable :data="hpaEventsList" size="small" max-height="420">
          <ElTableColumn label="最近出现时间" width="170">
            <template #default="{ row }">{{ formatNodeCreationTime(row.lastTimestamp) }}</template>
          </ElTableColumn>
          <ElTableColumn label="类型" width="90">
            <template #default="{ row }">
              <ElTag
                size="small"
                :type="
                  row.type === 'Normal' ? 'success' : row.type === 'Warning' ? 'danger' : 'info'
                "
                >{{ row.type ?? 'Unknown' }}</ElTag
              >
            </template>
          </ElTableColumn>
          <ElTableColumn prop="reason" label="原因" width="160" show-overflow-tooltip />
          <ElTableColumn label="副本变化" width="110">
            <template #default="{ row }">{{
              row.replicasTo != null ? `${row.replicasFrom ?? '-'} → ${row.replicasTo}` : '-'
            }}</template>
          </ElTableColumn>
          <ElTableColumn prop="detail" label="信息" min-width="220" show-overflow-tooltip />
          <ElTableColumn prop="count" label="次数" width="70" />
        </ElTable>
        <div v-if="!hpaEventsLoading && !hpaEventsList.length" class="hpa-tab-placeholder"
          >暂无执行记录</div
        >
      </div>
    </ElDialog>

    <K8sYamlDialog
      v-model="yamlVisible"
      title="HPA YAML"
      :yaml="yamlText"
      footer-mode="edit"
      width="900px"
      :editor-height="520"
      :submit-loading="yamlSaving"
      @save="onYamlSave"
    />
  </div>
</template>

<script setup lang="ts">
  import {
    ElButton,
    ElCard,
    ElInput,
    ElMessage,
    ElMessageBox,
    ElPopover,
    ElTabPane,
    ElTabs,
    ElLink,
    ElDialog,
    ElTable,
    ElTableColumn,
    ElTag
  } from 'element-plus'
  import { notifyError } from '@/utils/sys/notify'
  import { CopyDocument } from '@element-plus/icons-vue'
  import { h, computed, inject, ref, watch } from 'vue'
  import { CLUSTER_TABLE_PAGINATION_OPTIONS } from './constants/table'
  import ClusterTableEmpty from './components/cluster-table-empty.vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useTable } from '@/hooks/core/useTable'
  import { useSkipFirstActivatedRefresh } from '@/hooks/core/useSkipFirstActivatedRefresh'
  import { useClusterDetailNamespaceRefresh } from '@/hooks/core/useClusterDetailNamespaceRefresh'
  import ArtButtonMore, {
    type ButtonMoreItem
  } from '@/components/core/forms/art-button-more/index.vue'
  import K8sYamlDialog from '@/components/kubernetes/k8s-yaml-dialog.vue'
  import { updateK8sResourceFromYaml } from '@/api/kubernetes/yamlCreate'
  import yaml from 'js-yaml'
  import {
    deleteK8sHpa,
    fetchK8sHpa,
    fetchK8sHpaList,
    HPA_INITIAL_REPLICAS_ANNOTATION,
    isK8sHpaPaused,
    setK8sHpaPaused,
    type K8sHorizontalPodAutoscaler,
    type K8sMetricSpec,
    type K8sMetricStatus
  } from '@/api/kubernetes/hpa'
  import {
    deleteCronHpa,
    fetchCronHpaHistories,
    fetchCronHpaList,
    setCronHpaStatus,
    type CronHpa,
    type CronHpaHistory
  } from '@/api/kubernetes/cronHpa'
  import { formatNodeCreationTime } from '@/utils/kubernetes/nodeDisplay'
  import { fetchKubeRawEventList } from '@/api/kubernetes/events'
  import { buildClusterRouteQuery } from '@/utils/navigation/cluster-query'
  import { clusterDetailNamespaceKey } from './context'

  defineOptions({ name: 'ClusterDetailAutoscaling' })

  /** HPA 执行历史对应的集群事件（仅取展示所需字段） */
  interface K8sEventItem {
    type?: string
    reason?: string
    message?: string
    count?: number
    lastTimestamp?: string
    /** 从 message 解析：本次伸缩目标副本数（"New size: N"） */
    replicasTo?: number
    /** 从合并时间线（HPA 事件 + 目标工作负载事件）推算：本次变更前的副本数 */
    replicasFrom?: number
    /** 从 message 解析：伸缩原因（"reason: xxx"），解析失败时为原始 message */
    detail?: string
  }

  const route = useRoute()
  const router = useRouter()
  const resourceTab = ref<'hpa' | 'cron' | 'ehpa'>('hpa')
  const searchForm = ref<{ name?: string }>({})
  const yamlVisible = ref(false)
  const yamlText = ref('')
  const yamlSaving = ref(false)

  // ── 定时扩缩容执行历史弹窗 ──
  const historyVisible = ref(false)
  const historyLoading = ref(false)
  const historyTitle = ref('')
  const historyList = ref<CronHpaHistory[]>([])

  // ── HPA 执行历史（集群事件）弹窗 ──
  const hpaEventsVisible = ref(false)
  const hpaEventsLoading = ref(false)
  const hpaEventsTitle = ref('')
  const hpaEventsList = ref<K8sEventItem[]>([])

  const globalNs = inject(clusterDetailNamespaceKey)
  const selectedNamespace = computed(() => globalNs?.namespace.value ?? '')

  function isSystemNamespace(ns: string): boolean {
    return ns === 'default' || ns.startsWith('kube-')
  }

  function renderNsCell(ns: string) {
    const isSystem = isSystemNamespace(ns)
    return h('div', { style: 'display:flex;align-items:center;gap:6px' }, [
      h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, ns),
      isSystem
        ? h(
            'span',
            {
              style:
                'font-size:11px;padding:0 4px;line-height:16px;border-radius:3px;background:var(--el-color-primary-light-9);color:var(--el-color-primary);border:1px solid var(--el-color-primary-light-7);flex-shrink:0'
            },
            '系统'
          )
        : null
    ])
  }

  function renderKvCell(lines: string[]) {
    const lineStyle =
      'box-sizing:border-box;width:100%;min-width:0;max-width:100%;font-size:12px;line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--el-text-color-regular)'
    const triggerStyle =
      'box-sizing:border-box;width:100%;min-width:0;max-width:100%;cursor:default'
    const moreStyle = 'font-size:12px;line-height:1.5;color:var(--el-text-color-placeholder)'
    if (!lines.length) return h('span', { style: lineStyle }, '-')
    const preview = lines.slice(0, 2)
    const hasMore = lines.length > 2
    const trigger = h('div', { style: triggerStyle }, [
      ...preview.map((t, i) => h('div', { key: `p${i}`, style: lineStyle }, t)),
      ...(hasMore ? [h('div', { key: 'more', style: moreStyle }, '...')] : [])
    ])
    const body = h(
      'div',
      { style: 'max-height:300px;overflow-x:hidden;overflow-y:auto;padding:4px 0' },
      lines.map((t, i) =>
        h(
          'div',
          {
            key: `f${i}`,
            style:
              'padding:2px 0;font-size:12px;line-height:1.5;color:var(--el-text-color-regular);word-break:break-all'
          },
          t
        )
      )
    )
    return h(
      ElPopover,
      {
        placement: 'top-start',
        width: 'auto',
        popperStyle: 'max-width:min(440px,90vw);padding:8px 12px;box-sizing:border-box',
        trigger: 'hover',
        showAfter: 200,
        teleported: true
      },
      { reference: () => trigger, default: () => body }
    )
  }

  function formatMetricTarget(m?: K8sMetricSpec): string {
    if (!m) return ''
    if (m.type === 'Resource' && m.resource?.name) {
      const t = m.resource.target
      if (t?.averageUtilization != null) return `${m.resource.name}:${t.averageUtilization}%`
      if (t?.averageValue) return `${m.resource.name}:${t.averageValue}`
      if (t?.value) return `${m.resource.name}:${t.value}`
    }
    if (m.type === 'Pods' && m.pods?.metric?.name) return `Pods:${m.pods.metric.name}`
    if (m.type === 'Object' && m.object?.metric?.name) return `Object:${m.object.metric.name}`
    if (m.type === 'External' && m.external?.metric?.name) return `Ext:${m.external.metric.name}`
    return m.type ?? ''
  }

  function formatTriggerSummary(row: K8sHorizontalPodAutoscaler): string {
    const metrics = row.spec?.metrics ?? []
    if (!metrics.length) return '-'
    return metrics.map(formatMetricTarget).filter(Boolean).join('；') || '-'
  }

  function findStatusMetric(
    currentMetrics: K8sMetricStatus[] | undefined,
    spec: K8sMetricSpec
  ): K8sMetricStatus | undefined {
    if (!currentMetrics?.length) return undefined
    const t = spec.type
    if (t === 'Resource' && spec.resource?.name) {
      return currentMetrics.find(
        (c) => c.type === 'Resource' && c.resource?.name === spec.resource?.name
      )
    }
    if (t === 'Pods' && spec.pods?.metric?.name) {
      return currentMetrics.find(
        (c) => c.type === 'Pods' && c.pods?.metric?.name === spec.pods!.metric!.name
      )
    }
    if (t === 'Object' && spec.object?.metric?.name) {
      return currentMetrics.find(
        (c) => c.type === 'Object' && c.object?.metric?.name === spec.object!.metric!.name
      )
    }
    if (t === 'External' && spec.external?.metric?.name) {
      return currentMetrics.find(
        (c) => c.type === 'External' && c.external?.metric?.name === spec.external!.metric!.name
      )
    }
    return undefined
  }

  function formatCurrentPart(spec: K8sMetricSpec, st?: K8sMetricStatus): string {
    const target = formatMetricTarget(spec)
    if (!st) return target ? `${target}（暂无采集）` : '-'
    if (spec.type === 'Resource' && st.resource?.current) {
      const name = spec.resource?.name ?? st.resource?.name ?? 'resource'
      const cur = st.resource.current
      let curStr = '-'
      if (cur.averageUtilization != null) curStr = `${cur.averageUtilization}%`
      else if (cur.averageValue) curStr = cur.averageValue
      const tgt = formatMetricTarget(spec).replace(`${name}:`, '') || '-'
      return `${name}:${curStr} / ${tgt}`
    }
    if (spec.type === 'Pods' && st.pods?.current?.averageValue) {
      return `Pods:${st.pods.current.averageValue}`
    }
    if (spec.type === 'Object' && st.object?.current?.value) {
      return `Object:${st.object.current.value}`
    }
    if (spec.type === 'External' && st.external?.current?.value) {
      return `Ext:${st.external.current.value}`
    }
    return formatMetricTarget(spec)
  }

  function formatCurrentUsage(row: K8sHorizontalPodAutoscaler): string {
    const specs = row.spec?.metrics ?? []
    const cms = row.status?.currentMetrics
    if (!specs.length) return '-'
    return specs.map((s) => formatCurrentPart(s, findStatusMetric(cms, s))).join('；') || '-'
  }

  function workloadDetailPath(kind?: string): string | null {
    const k = (kind ?? '').toLowerCase()
    if (k === 'deployment') return '/container/deployment-detail'
    if (k === 'statefulset') return '/container/statefulset-detail'
    if (k === 'daemonset') return '/container/daemonset-detail'
    if (k === 'job') return '/container/job-detail'
    if (k === 'cronjob') return '/container/cronjob-detail'
    return null
  }

  function openScaleTarget(cluster: string, ref?: { kind?: string; name?: string }, ns?: string) {
    const path = workloadDetailPath(ref?.kind)
    const name = ref?.name ?? ''
    const namespace = ns ?? ''
    if (!path || !name || !namespace) return
    router.push({ path, query: { cluster, namespace, name } })
  }

  type TableParams = { current: number; size: number; name?: string; namespace?: string }

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
            data: {
              records: [] as (K8sHorizontalPodAutoscaler & { rowKey?: string })[],
              total: 0,
              current: 1,
              size: params.size
            }
          }
        }
        const { items, total } = await fetchK8sHpaList(cluster, {
          page: params.current,
          limit: params.size,
          namespace: params.namespace || undefined,
          name: (params.name ?? '').trim() || undefined
        })
        const records = items.map((row, i) => ({
          ...row,
          rowKey: `${row.metadata?.namespace ?? 'default'}:${row.metadata?.name ?? `hpa-${i}`}`
        }))
        return {
          code: 200,
          data: { records, total, current: params.current, size: params.size }
        }
      },
      apiParams: { current: 1, size: 10, name: undefined, namespace: undefined },
      columnsFactory: () => [
        {
          prop: 'metadata.name',
          label: '名称',
          minWidth: 180,
          formatter: (row: K8sHorizontalPodAutoscaler) => {
            const name = row.metadata?.name ?? '-'
            return h('div', { style: 'display:flex;align-items:center;gap:8px' }, [
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap',
                  onClick: () => void viewYaml(row)
                },
                () => name
              ),
              h(
                'span',
                {
                  class: 'icon-action',
                  style:
                    'cursor:pointer;color:var(--el-text-color-secondary);display:inline-flex;align-items:center',
                  title: '复制',
                  onClick: (e: MouseEvent) => {
                    e.stopPropagation()
                    void navigator.clipboard.writeText(name)
                    ElMessage.success('已复制')
                  }
                },
                [h(CopyDocument, { style: 'width:12px;height:12px' })]
              )
            ])
          }
        },
        {
          prop: 'metadata.namespace',
          label: '命名空间',
          width: 160,
          formatter: (row: K8sHorizontalPodAutoscaler) =>
            renderNsCell(row.metadata?.namespace ?? '-')
        },
        {
          prop: 'metadata.labels',
          label: 'Labels',
          minWidth: 160,
          formatter: (row: K8sHorizontalPodAutoscaler) => {
            const labels = row.metadata?.labels ?? {}
            const lines = Object.entries(labels).map(([k, v]) => `${k}: ${v}`)
            return renderKvCell(lines)
          }
        },
        {
          prop: 'scaleTargetRef',
          label: '关联工作负载',
          minWidth: 200,
          formatter: (row: K8sHorizontalPodAutoscaler) => {
            const ref = row.spec?.scaleTargetRef
            const text = ref?.kind && ref?.name ? `${ref.kind}/${ref.name}` : '-'
            const cluster = String(route.query.cluster ?? '')
            const ns = row.metadata?.namespace ?? ''
            const path = workloadDetailPath(ref?.kind)
            if (!path || !ref?.name) {
              return h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, text)
            }
            return h(
              ElLink,
              {
                type: 'primary',
                underline: 'never',
                style: 'font-size:12px',
                onClick: () => openScaleTarget(cluster, ref, ns)
              },
              () => text
            )
          }
        },
        {
          prop: 'spec.metrics',
          label: '触发策略',
          minWidth: 200,
          formatter: (row: K8sHorizontalPodAutoscaler) =>
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-text-color-regular);white-space:nowrap' },
              formatTriggerSummary(row)
            )
        },
        {
          prop: 'status.currentMetrics',
          label: '当前使用量',
          minWidth: 220,
          formatter: (row: K8sHorizontalPodAutoscaler) =>
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-text-color-regular);line-height:1.5' },
              formatCurrentUsage(row)
            )
        },
        {
          prop: 'spec.minReplicas',
          label: '最小副本',
          width: 100,
          formatter: (row: K8sHorizontalPodAutoscaler) =>
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-text-color-regular)' },
              String(row.spec?.minReplicas ?? 1)
            )
        },
        {
          prop: 'spec.maxReplicas',
          label: '最大副本',
          width: 100,
          formatter: (row: K8sHorizontalPodAutoscaler) =>
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-text-color-regular)' },
              String(row.spec?.maxReplicas ?? '-')
            )
        },
        {
          prop: 'status.currentReplicas',
          label: '当前副本',
          width: 100,
          formatter: (row: K8sHorizontalPodAutoscaler) =>
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-text-color-regular)' },
              String(row.status?.currentReplicas ?? row.status?.desiredReplicas ?? '-')
            )
        },
        {
          prop: 'paused',
          label: '状态',
          width: 100,
          formatter: (row: K8sHorizontalPodAutoscaler) =>
            h(ElTag, { size: 'small', type: isK8sHpaPaused(row) ? 'info' : 'success' }, () =>
              isK8sHpaPaused(row) ? '已暂停' : '运行中'
            )
        },
        {
          prop: 'metadata.creationTimestamp',
          label: '创建时间',
          width: 170,
          formatter: (row: K8sHorizontalPodAutoscaler) =>
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
          formatter: (row: K8sHorizontalPodAutoscaler) =>
            h(
              'div',
              {
                style:
                  'display:flex;align-items:center;gap:8px;flex-wrap:nowrap;justify-content:flex-end'
              },
              [
                h(ArtButtonMore, {
                  list: [
                    { key: 'edit', label: '编辑', icon: 'ri:edit-line' },
                    { key: 'yaml', label: '查看YAML', icon: 'ri:file-code-line' },
                    { key: 'history', label: '执行历史', icon: 'ri:history-line' },
                    {
                      key: 'toggle',
                      label: isK8sHpaPaused(row) ? '恢复' : '暂停',
                      icon: isK8sHpaPaused(row) ? 'ri:play-line' : 'ri:pause-line'
                    },
                    { key: 'delete', label: '删除', icon: 'ri:delete-bin-4-line', color: '#409eff' }
                  ],
                  onClick: (item: ButtonMoreItem) => hpaMoreClick(item, row)
                })
              ]
            )
        }
      ]
    }
  })

  const visibleColumns = computed(() =>
    selectedNamespace.value
      ? columns.value.filter((c: { prop?: string }) => c.prop !== 'metadata.namespace')
      : columns.value
  )

  // ── 定时自动扩缩容（CronHPA）列表：规则存于后端数据库，独立于 K8s HPA 表格 ──
  function formatCronJobsSummary(row: CronHpa): string[] {
    return (row.jobs ?? []).map(
      (job) => `${job.schedule} → ${job.target_size} 副本${job.run_once ? '（仅一次）' : ''}`
    )
  }

  const {
    columns: cronColumns,
    data: cronData,
    loading: cronLoading,
    pagination: cronPagination,
    getData: cronGetData,
    replaceSearchParams: cronReplaceSearchParams,
    handleSizeChange: cronHandleSizeChange,
    handleCurrentChange: cronHandleCurrentChange,
    refreshData: cronRefreshData
  } = useTable({
    core: {
      immediate: true,
      apiFn: async (params: TableParams) => {
        const cluster = String(route.query.cluster ?? '')
        if (!cluster) {
          return {
            code: 200,
            data: {
              records: [] as (CronHpa & { rowKey?: string })[],
              total: 0,
              current: 1,
              size: params.size
            }
          }
        }
        const all = await fetchCronHpaList({
          cluster,
          namespace: params.namespace || undefined
        })
        const q = (params.name ?? '').trim().toLowerCase()
        const filtered = q ? all.filter((item) => item.name.toLowerCase().includes(q)) : all
        const start = ((params.current || 1) - 1) * (params.size || 10)
        const records = filtered
          .slice(start, start + (params.size || 10))
          .map((row) => ({ ...row, rowKey: String(row.id) }))
        return {
          code: 200,
          data: { records, total: filtered.length, current: params.current, size: params.size }
        }
      },
      apiParams: { current: 1, size: 10, name: undefined, namespace: undefined },
      columnsFactory: () => [
        {
          prop: 'name',
          label: '名称',
          minWidth: 160,
          formatter: (row: CronHpa) =>
            h(
              ElLink,
              {
                type: 'primary',
                underline: 'never',
                style: 'font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap',
                onClick: () => goEditCronHpa(row)
              },
              () => row.name ?? '-'
            )
        },
        {
          prop: 'namespace',
          label: '命名空间',
          width: 160,
          formatter: (row: CronHpa) => renderNsCell(row.namespace ?? '-')
        },
        {
          prop: 'target_name',
          label: '目标对象',
          minWidth: 200,
          formatter: (row: CronHpa) => {
            const cluster = String(route.query.cluster ?? '')
            const text = `${row.target_kind}/${row.target_name}`
            const path = workloadDetailPath(row.target_kind)
            if (!path) {
              return h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, text)
            }
            return h(
              ElLink,
              {
                type: 'primary',
                underline: 'never',
                style: 'font-size:12px',
                onClick: () =>
                  openScaleTarget(
                    cluster,
                    { kind: row.target_kind, name: row.target_name },
                    row.namespace
                  )
              },
              () => text
            )
          }
        },
        {
          prop: 'jobs',
          label: '定时策略',
          minWidth: 220,
          formatter: (row: CronHpa) => renderKvCell(formatCronJobsSummary(row))
        },
        {
          prop: 'exclude_dates',
          label: '排除日期',
          minWidth: 140,
          formatter: (row: CronHpa) =>
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-text-color-regular)' },
              row.exclude_dates?.length ? row.exclude_dates.join('；') : '-'
            )
        },
        {
          prop: 'status',
          label: '状态',
          width: 100,
          formatter: (row: CronHpa) =>
            h(ElTag, { size: 'small', type: row.status === 'active' ? 'success' : 'info' }, () =>
              row.status === 'active' ? '运行中' : '已暂停'
            )
        },
        {
          prop: 'create_user',
          label: '创建人',
          width: 110,
          formatter: (row: CronHpa) =>
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-text-color-regular)' },
              row.create_user || '-'
            )
        },
        {
          prop: 'gmt_create',
          label: '创建时间',
          width: 170,
          formatter: (row: CronHpa) =>
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-text-color-regular)' },
              formatNodeCreationTime(row.gmt_create)
            )
        },
        {
          prop: 'operation',
          label: '操作',
          width: 120,
          fixed: 'right',
          formatter: (row: CronHpa) =>
            h(
              'div',
              {
                style:
                  'display:flex;align-items:center;gap:8px;flex-wrap:nowrap;justify-content:flex-end'
              },
              [
                h(ArtButtonMore, {
                  list: [
                    { key: 'edit', label: '编辑', icon: 'ri:edit-line' },
                    { key: 'history', label: '执行历史', icon: 'ri:history-line' },
                    {
                      key: 'toggle',
                      label: row.status === 'active' ? '暂停' : '恢复',
                      icon: row.status === 'active' ? 'ri:pause-line' : 'ri:play-line'
                    },
                    { key: 'delete', label: '删除', icon: 'ri:delete-bin-4-line', color: '#409eff' }
                  ],
                  onClick: (item: ButtonMoreItem) => cronMoreClick(item, row)
                })
              ]
            )
        }
      ]
    }
  })

  const visibleCronColumns = computed(() =>
    selectedNamespace.value
      ? cronColumns.value.filter((c: { prop?: string }) => c.prop !== 'namespace')
      : cronColumns.value
  )

  useClusterDetailNamespaceRefresh('autoscaling', () => {
    const ns = selectedNamespace.value || undefined
    replaceSearchParams({ namespace: ns })
    cronReplaceSearchParams({ namespace: ns })
    getData()
    cronGetData()
  })

  watch(
    () => String(route.query.cluster ?? ''),
    () => {
      getData()
      cronGetData()
    }
  )

  function runSearch() {
    const name = (searchForm.value.name ?? '').trim() || undefined
    replaceSearchParams({ name })
    cronReplaceSearchParams({ name })
    getData()
    cronGetData()
  }

  function forceSearch() {
    runSearch()
  }

  function onRefresh() {
    refreshData()
    cronRefreshData()
  }

  useSkipFirstActivatedRefresh(() => {
    refreshData()
    cronRefreshData()
  })

  function goCreateHPA() {
    const ns = selectedNamespace.value
    if (resourceTab.value === 'hpa') {
      router.push({
        path: '/container/hpa-create',
        query: buildClusterRouteQuery(route, ns ? { namespace: ns } : undefined)
      })
    } else if (resourceTab.value === 'cron') {
      // 跳转到定时 HPA 创建页面
      router.push({
        path: '/container/cron-hpa-create',
        query: buildClusterRouteQuery(route, ns ? { namespace: ns } : undefined)
      })
    }
  }

  function goEditCronHpa(row: CronHpa) {
    router.push({
      path: '/container/cron-hpa-create',
      query: buildClusterRouteQuery(route, { id: String(row.id), namespace: row.namespace })
    })
  }

  async function openHistory(row: CronHpa) {
    historyTitle.value = row.name
    historyVisible.value = true
    historyLoading.value = true
    historyList.value = []
    try {
      historyList.value = await fetchCronHpaHistories(row.id, 200)
    } catch (e: unknown) {
      notifyError(e, '获取执行历史失败')
    } finally {
      historyLoading.value = false
    }
  }

  async function toggleCronHpaStatus(row: CronHpa) {
    const next = row.status === 'active' ? 'paused' : 'active'
    try {
      await setCronHpaStatus(row.id, next)
      ElMessage.success(next === 'paused' ? '已暂停' : '已恢复')
      cronRefreshData()
    } catch (e: unknown) {
      notifyError(e, '更新状态失败')
    }
  }

  async function removeCronHpa(row: CronHpa) {
    try {
      await ElMessageBox.confirm(
        `确定删除定时扩缩容规则「${row.name}」吗？删除后不再定时调整副本数，此操作不可恢复。`,
        '删除定时扩缩容规则',
        { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
      )
      await deleteCronHpa(row.id)
      ElMessage.success('删除成功')
      cronRefreshData()
    } catch (e: unknown) {
      if (e === 'cancel') return
      notifyError(e, '删除失败')
    }
  }

  function cronMoreClick(item: ButtonMoreItem, row: CronHpa) {
    if (item.key === 'edit') goEditCronHpa(row)
    if (item.key === 'history') void openHistory(row)
    if (item.key === 'toggle') void toggleCronHpaStatus(row)
    if (item.key === 'delete') void removeCronHpa(row)
  }

  async function viewYaml(row: K8sHorizontalPodAutoscaler) {
    const cluster = String(route.query.cluster ?? '')
    const ns = row.metadata?.namespace
    const name = row.metadata?.name
    if (!cluster || !ns || !name) return
    try {
      const obj = await fetchK8sHpa(cluster, ns, name)
      yamlText.value = yaml.dump(obj, { quotingType: '"' })
      yamlVisible.value = true
    } catch (e: unknown) {
      notifyError(e, '加载失败')
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
      notifyError(e, '保存失败')
    } finally {
      yamlSaving.value = false
    }
  }

  async function removeHpa(row: K8sHorizontalPodAutoscaler) {
    const cluster = String(route.query.cluster ?? '')
    const ns = row.metadata?.namespace
    const name = row.metadata?.name
    if (!cluster || !ns || !name) return
    try {
      await ElMessageBox.confirm(`确定删除 HPA「${name}」吗？此操作不可恢复。`, '删除 HPA', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
      await deleteK8sHpa(cluster, ns, name)
      ElMessage.success('删除成功')
      onRefresh()
    } catch (e: unknown) {
      if (e === 'cancel') return
      notifyError(e, '删除失败')
    }
  }

  function hpaMoreClick(item: ButtonMoreItem, row: K8sHorizontalPodAutoscaler) {
    if (item.key === 'edit') goEditHpa(row)
    if (item.key === 'yaml') void viewYaml(row)
    if (item.key === 'history') void openHpaEvents(row)
    if (item.key === 'toggle') void toggleHpaPaused(row)
    if (item.key === 'delete') void removeHpa(row)
  }

  /** 编辑：跳转创建页回填表单（名称/命名空间/目标工作负载不可改） */
  function goEditHpa(row: K8sHorizontalPodAutoscaler) {
    const ns = row.metadata?.namespace ?? ''
    const name = row.metadata?.name ?? ''
    if (!ns || !name) return
    router.push({
      path: '/container/hpa-create',
      query: buildClusterRouteQuery(route, { namespace: ns, name })
    })
  }

  /** 执行历史：原生 HPA 的伸缩动作记录在集群事件中（SuccessfulRescale 等） */
  async function openHpaEvents(row: K8sHorizontalPodAutoscaler) {
    const cluster = String(route.query.cluster ?? '')
    const ns = row.metadata?.namespace ?? ''
    const name = row.metadata?.name ?? ''
    if (!cluster || !ns || !name) return
    hpaEventsTitle.value = name
    hpaEventsVisible.value = true
    hpaEventsLoading.value = true
    hpaEventsList.value = []
    try {
      const targetRef = row.spec?.scaleTargetRef
      const [events, targetEvents] = await Promise.all([
        fetchKubeRawEventList(cluster, {
          namespace: ns,
          name,
          kind: 'HorizontalPodAutoscaler',
          namespaced: true,
          page: 1,
          limit: 200
        }),
        // 并行拉取目标工作负载事件（如 Deployment ScalingReplicaSet），
        // 用于推算最早一条伸缩事件的变更前副本数；失败不影响主列表
        targetRef?.kind && targetRef?.name
          ? fetchKubeRawEventList(cluster, {
              namespace: ns,
              name: targetRef.name,
              kind: targetRef.kind,
              namespaced: true,
              page: 1,
              limit: 200
            }).catch(() => ({ items: [], total: 0 }))
          : Promise.resolve({ items: [] as unknown[], total: 0 })
      ])
      hpaEventsList.value = parseHpaEvents(
        events.items as K8sEventItem[],
        targetEvents.items as K8sEventItem[],
        parseInitialReplicas(row)
      )
    } catch (e: unknown) {
      notifyError(e, '获取执行历史失败')
    } finally {
      hpaEventsLoading.value = false
    }
  }

  /** 读取创建时记录的初始副本数 annotation，缺失或非法返回 undefined */
  function parseInitialReplicas(row: K8sHorizontalPodAutoscaler): number | undefined {
    const raw = Number(row.metadata?.annotations?.[HPA_INITIAL_REPLICAS_ANNOTATION])
    return Number.isFinite(raw) && raw > 0 ? raw : undefined
  }

  /**
   * 解析 HPA 伸缩事件：message 形如 "New size: 5; reason: cpu resource utilization above target"。
   * HPA 事件本身只含变更后副本数，故合并目标工作负载的伸缩事件（如 Deployment
   * "Scaled up replica set x to 1"）构成副本数时间线推算变更前副本数；
   * 创建时记录的初始副本数 annotation 作为时间线起点兜底，最终倒序返回。
   */
  function parseHpaEvents(
    items: K8sEventItem[],
    targetItems: K8sEventItem[],
    initialReplicas?: number
  ): K8sEventItem[] {
    const asc = [...items].sort((a, b) =>
      (a.lastTimestamp ?? '').localeCompare(b.lastTimestamp ?? '')
    )
    // 时间线节点：ts + 变更后副本数；hpa 非空表示该节点为需展示的 HPA 事件。
    // 同一次伸缩的 HPA 与工作负载事件时间戳可能同秒，HPA 节点需先消费（读取动作前的副本数），
    // 故先推 HPA 节点再推工作负载节点，依赖稳定排序保证同秒顺序。
    const points: { ts: string; size: number; hpa?: K8sEventItem }[] = []
    for (const e of asc) {
      const size = /New size: (\d+)/.exec(e.message ?? '')?.[1]
      if (size) points.push({ ts: e.lastTimestamp ?? '', size: Number(size), hpa: e })
    }
    for (const e of targetItems) {
      const size = / to (\d+)\s*$/.exec(e.message ?? '')?.[1]
      if (size) points.push({ ts: e.lastTimestamp ?? '', size: Number(size) })
    }
    points.sort((a, b) => a.ts.localeCompare(b.ts))
    // prevSize 起点：创建时记录的初始副本数（即 HPA 接管时工作负载的副本数）
    let prevSize: number | undefined = initialReplicas
    for (const p of points) {
      if (p.hpa) {
        p.hpa.replicasTo = p.size
        p.hpa.replicasFrom = prevSize
      }
      prevSize = p.size
    }
    // 截取 "reason:" 之后的文本作为可读原因；无则回退原始 message
    for (const e of asc) {
      const reasonMatch = /reason:\s*(.+?)\s*;?\s*$/.exec(e.message ?? '')
      e.detail = reasonMatch ? reasonMatch[1] : (e.message ?? '')
    }
    return asc.reverse()
  }

  async function toggleHpaPaused(row: K8sHorizontalPodAutoscaler) {
    const cluster = String(route.query.cluster ?? '')
    const ns = row.metadata?.namespace
    const name = row.metadata?.name
    if (!cluster || !ns || !name) return
    const paused = isK8sHpaPaused(row)
    try {
      await ElMessageBox.confirm(
        paused
          ? '恢复后 HPA 将还原暂停前的 min/max，并继续按指标自动伸缩。'
          : '暂停会将 min/max 锁定为当前副本数，HPA 不再自动伸缩；恢复时还原原 min/max。确定暂停吗？',
        paused ? '恢复 HPA' : '暂停 HPA',
        { type: 'warning', confirmButtonText: '确定', cancelButtonText: '取消' }
      )
      await setK8sHpaPaused(cluster, ns, name, !paused)
      ElMessage.success(paused ? '已恢复' : '已暂停')
      refreshData()
    } catch (e: unknown) {
      if (e === 'cancel') return
      notifyError(e, paused ? '恢复失败' : '暂停失败')
    }
  }
</script>

<style>
  .hpa-page .icon-action {
    opacity: 0;
    transition: opacity 0.15s;
  }
  .hpa-page .el-table__row:hover .icon-action {
    opacity: 1;
  }
  .hpa-page .art-table .el-table {
    margin-top: 10px;
    font-size: 13px;
  }
  .hpa-page .art-table .el-table th.el-table__cell {
    font-size: 13px;
  }
</style>

<style scoped>
  .hpa-tabs :deep(.el-tabs__header) {
    margin: 0 0 4px;
    flex-shrink: 0;
  }

  .hpa-tabs :deep(.el-tabs__nav-wrap::after) {
    height: 1px;
    background-color: var(--el-border-color-lighter);
  }

  .hpa-tabs :deep(.el-tabs__item) {
    height: 40px;
    line-height: 40px;
    padding: 0 18px;
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-regular);
  }

  .hpa-tabs :deep(.el-tabs__item.is-active) {
    color: var(--el-color-primary);
    font-weight: 600;
  }

  .hpa-tabs :deep(.el-tabs__active-bar) {
    height: 2px;
    border-radius: 2px 2px 0 0;
  }

  .hpa-tab-placeholder {
    padding: 32px 12px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
    text-align: center;
  }

  .hpa-page {
    display: flex;
    flex-direction: column;
    min-height: 0;
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
  .hpa-page :deep(.art-table-card) {
    flex: 1;
    min-height: 0;
  }

  .hpa-page :deep(.art-table-card > .el-card__body) {
    padding-top: 8px;
  }
</style>

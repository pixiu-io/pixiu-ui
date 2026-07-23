<template>
  <div class="hpa-page">
    <div class="cluster-toolbar">
      <ElButton v-ripple @click="onCreateHpaHint">新建 HPA</ElButton>
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
        <ElTabPane label="HorizontalPodAutoscaler" name="hpa">

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

        <ElTabPane label="HorizontalPodCronscaler" name="cron" disabled>
          <div class="hpa-tab-placeholder">敬请期待</div>
        </ElTabPane>
        <ElTabPane label="EffectiveHorizontalPodAutoscaler" name="ehpa" disabled>
          <div class="hpa-tab-placeholder">敬请期待</div>
        </ElTabPane>
      </ElTabs>
    </ElCard>

    <K8sYamlDialog
      v-model="yamlVisible"
      title="HorizontalPodAutoscaler YAML"
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
    ElLink
  } from 'element-plus'
  import { CopyDocument } from '@element-plus/icons-vue'
  import { h, computed, inject, ref, watch } from 'vue'
import { CLUSTER_TABLE_PAGINATION_OPTIONS } from './constants/table'
import ClusterTableEmpty from './components/cluster-table-empty.vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useTable } from '@/hooks/core/useTable'
  import { useSkipFirstActivatedRefresh } from '@/hooks/core/useSkipFirstActivatedRefresh'
  import { useClusterDetailNamespaceRefresh } from '@/hooks/core/useClusterDetailNamespaceRefresh'
  import ArtButtonMore, { type ButtonMoreItem } from '@/components/core/forms/art-button-more/index.vue'
  import K8sYamlDialog from '@/components/kubernetes/k8s-yaml-dialog.vue'
  import { updateK8sResourceFromYaml } from '@/api/kubernetes/yamlCreate'
  import yaml from 'js-yaml'
  import {
    deleteK8sHpa,
    fetchK8sHpa,
    fetchK8sHpaList,
    type K8sHorizontalPodAutoscaler,
    type K8sMetricSpec,
    type K8sMetricStatus
  } from '@/api/kubernetes/hpa'
  import { formatNodeCreationTime } from '@/utils/kubernetes/nodeDisplay'
  import { clusterDetailNamespaceKey } from './context'

  defineOptions({ name: 'ClusterDetailAutoscaling' })

  const route = useRoute()
  const router = useRouter()
  const resourceTab = ref<'hpa' | 'cron' | 'ehpa'>('hpa')
  const searchForm = ref<{ name?: string }>({})
  const yamlVisible = ref(false)
  const yamlText = ref('')
  const yamlSaving = ref(false)

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
      ...(hasMore ? [h('div', { style: moreStyle }, '...')] : [])
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
      return currentMetrics.find((c) => c.type === 'Resource' && c.resource?.name === spec.resource?.name)
    }
    if (t === 'Pods' && spec.pods?.metric?.name) {
      return currentMetrics.find((c) => c.type === 'Pods' && c.pods?.metric?.name === spec.pods!.metric!.name)
    }
    if (t === 'Object' && spec.object?.metric?.name) {
      return currentMetrics.find((c) => c.type === 'Object' && c.object?.metric?.name === spec.object!.metric!.name)
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
            const cluster = String(route.query.cluster ?? '')
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
            h('span', { style: 'font-size:12px;color:var(--el-text-color-regular);white-space:nowrap' }, formatTriggerSummary(row))
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
            h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, String(row.spec?.minReplicas ?? 1))
        },
        {
          prop: 'spec.maxReplicas',
          label: '最大副本',
          width: 100,
          formatter: (row: K8sHorizontalPodAutoscaler) =>
            h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, String(row.spec?.maxReplicas ?? '-'))
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
            h('div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:nowrap;justify-content:flex-end' }, [
              h(ArtButtonMore, {
                list: [
                  { key: 'yaml', label: '查看YAML', icon: 'ri:file-code-line' },
                  { key: 'delete', label: '删除', icon: 'ri:delete-bin-4-line', color: '#409eff' }
                ],
                onClick: (item: ButtonMoreItem) => hpaMoreClick(item, row)
              })
            ])
        }
      ]
    }
  })

  const visibleColumns = computed(() =>
    selectedNamespace.value
      ? columns.value.filter((c: { prop?: string }) => c.prop !== 'metadata.namespace')
      : columns.value
  )

  useClusterDetailNamespaceRefresh('autoscaling', () => {
    replaceSearchParams({ namespace: selectedNamespace.value || undefined })
    getData()
  })

  watch(
    () => String(route.query.cluster ?? ''),
    () => {
      getData()
    }
  )

  function runSearch() {
    const name = (searchForm.value.name ?? '').trim() || undefined
    replaceSearchParams({ name })
    getData()
  }

  function onRefresh() {
    refreshData()
  }

  useSkipFirstActivatedRefresh(refreshData)

  function onCreateHpaHint() {
    ElMessage.info('请通过集群详情页右上角「YAML创建」提交 HorizontalPodAutoscaler 资源（API 版本 autoscaling/v2）。')
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

  async function removeHpa(row: K8sHorizontalPodAutoscaler) {
    const cluster = String(route.query.cluster ?? '')
    const ns = row.metadata?.namespace
    const name = row.metadata?.name
    if (!cluster || !ns || !name) return
    try {
      await ElMessageBox.confirm(`确定删除 HPA「${name}」吗？此操作不可恢复。`, '删除 HorizontalPodAutoscaler', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
      await deleteK8sHpa(cluster, ns, name)
      ElMessage.success('删除成功')
      onRefresh()
    } catch (e: unknown) {
      if (e === 'cancel') return
      ElMessage.error(e instanceof Error ? e.message : '删除失败')
    }
  }

  function hpaMoreClick(item: ButtonMoreItem, row: K8sHorizontalPodAutoscaler) {
    if (item.key === 'yaml') void viewYaml(row)
    if (item.key === 'delete') void removeHpa(row)
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

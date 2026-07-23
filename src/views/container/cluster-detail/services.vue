<template>
  <div class="services-page">
    <ElCard class="art-table-card">
      <ElTabs v-model="kind">
        <!-- ── Service Tab ── -->
        <ElTabPane label="Service" name="svc">
          <ArtTableHeader
            v-model:columns="svcColumnChecks"
            :loading="svcLoading"
            layout="size,fullscreen,columns,settings"
            style="margin-top: 15px"
            @refresh="onSvcRefresh"
          >
            <template #left>
              <div class="workloads-toolbar">
                <ElButton v-ripple @click="goCreateService">新建</ElButton>
                <div class="workloads-toolbar__filters">
                  <ElInput
                    v-model="svcSearchForm.name"
                    clearable
                    placeholder="请输入名称"
                    class="workloads-toolbar__search"
                    @keyup.enter="runSvcSearch"
                    @clear="runSvcSearch"
                  />
                  <div
                    class="workloads-toolbar-search-btn"
                    role="button"
                    tabindex="0"
                    title="搜索"
                    @click="forceSvcSearch"
                    @keyup.enter="forceSvcSearch"
                  >
                    <ArtSvgIcon icon="ri:search-line" class="text-g-700" />
                  </div>
                </div>
              </div>
            </template>
          </ArtTableHeader>

          <ArtTable
            row-key="rowKey"
            :loading="svcLoading"
            :data="svcData"
            :columns="svcVisibleColumns"
            :pagination="svcPagination"
            :pagination-options="CLUSTER_TABLE_PAGINATION_OPTIONS"
            @pagination:size-change="svcHandleSizeChange"
            @pagination:current-change="svcHandleCurrentChange"
            @sort-change="onSvcSortChange"
>
        <template #empty>
          <ClusterTableEmpty />
        </template>
          </ArtTable>
        </ElTabPane>

        <!-- ── Ingress Tab ── -->
        <ElTabPane label="Ingress" name="ing">
          <ArtTableHeader
            v-model:columns="ingColumnChecks"
            :loading="ingLoading"
            layout="size,fullscreen,columns,settings"
            style="margin-top: 15px"
            @refresh="onIngRefresh"
          >
            <template #left>
              <div class="workloads-toolbar">
                <ElButton v-ripple @click="goCreateIngress">新建</ElButton>
                <div class="workloads-toolbar__filters">
                  <ElInput
                    v-model="ingSearchForm.name"
                    clearable
                    placeholder="请输入名称"
                    class="workloads-toolbar__search"
                    @keyup.enter="runIngSearch"
                    @clear="runIngSearch"
                  />
                  <div
                    class="workloads-toolbar-search-btn"
                    role="button"
                    tabindex="0"
                    title="搜索"
                    @click="forceIngSearch"
                    @keyup.enter="forceIngSearch"
                  >
                    <ArtSvgIcon icon="ri:search-line" class="text-g-700" />
                  </div>
                </div>
              </div>
            </template>
          </ArtTableHeader>

          <ArtTable
            row-key="rowKey"
            :loading="ingLoading"
            :data="ingData"
            :columns="ingVisibleColumns"
            :pagination="ingPagination"
            :pagination-options="CLUSTER_TABLE_PAGINATION_OPTIONS"
            @pagination:size-change="ingHandleSizeChange"
            @pagination:current-change="ingHandleCurrentChange"
            @sort-change="onIngSortChange"
>
        <template #empty>
          <ClusterTableEmpty />
        </template>
          </ArtTable>
        </ElTabPane>
      </ElTabs>
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
  import {
    ElButton,
    ElCard,
    ElInput,
    ElLink,
    ElMessage,
    ElMessageBox,
    ElTabs,
    ElTabPane,
    ElTooltip
  } from 'element-plus'
  import { CopyDocument } from '@element-plus/icons-vue'
  import yaml from 'js-yaml'
  import { computed, h, inject, ref, watch } from 'vue'
import { CLUSTER_TABLE_PAGINATION_OPTIONS } from './constants/table'
import ClusterTableEmpty from './components/cluster-table-empty.vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useTable } from '@/hooks/core/useTable'
  import { useSkipFirstActivatedRefresh } from '@/hooks/core/useSkipFirstActivatedRefresh'
  import { useClusterDetailNamespaceRefresh } from '@/hooks/core/useClusterDetailNamespaceRefresh'
  import {
    fetchK8sServiceList,
    fetchK8sService,
    deleteK8sService,
    type K8sService
  } from '@/api/kubernetes/service'
  import {
    fetchK8sIngressList,
    fetchK8sIngress,
    deleteK8sIngress,
    type K8sIngress
  } from '@/api/kubernetes/ingress'
  import { formatNodeCreationTime } from '@/utils/kubernetes/nodeDisplay'
  import { clusterDetailNamespaceKey } from './context'
  import K8sYamlDialog from '@/components/kubernetes/k8s-yaml-dialog.vue'
  import { updateK8sResourceFromYaml } from '@/api/kubernetes/yamlCreate'

  defineOptions({ name: 'ClusterDetailServices' })

  const route = useRoute()
  const router = useRouter()
  const kind = ref((route.query.tab as string) === 'ing' ? 'ing' : 'svc')

  // ── Service tab state ──
  const svcSearchForm = ref<{ name?: string }>({})
  const svcSortOrder = ref<'ascending' | 'descending' | null>(null)

  // ── Ingress tab state ──
  const ingSearchForm = ref<{ name?: string }>({})
  const ingSortOrder = ref<'ascending' | 'descending' | null>(null)
  const globalNs = inject(clusterDetailNamespaceKey)
  const selectedNamespace = computed(() => globalNs?.namespace.value ?? '')

  function goCreateService() {
    const cluster = String(route.query.cluster ?? '')
    const ns = selectedNamespace.value
    router.push({
      path: '/container/service-create',
      query: { cluster, ...(ns ? { namespace: ns } : {}) }
    })
  }

  function goCreateIngress() {
    const cluster = String(route.query.cluster ?? '')
    const ns = selectedNamespace.value
    router.push({
      path: '/container/ingress-create',
      query: { cluster, ...(ns ? { namespace: ns } : {}) }
    })
  }

  // ── YAML dialog ──
  const yamlVisible = ref(false)
  const yamlText = ref('')
  const yamlSaving = ref(false)
  const currentYamlKind = ref<'svc' | 'ing'>('svc')

  // ── Shared helpers ──
  function renderNsCell(ns: string) {
    const isSystem = ns === 'default' || ns.startsWith('kube-')
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

  function formatSvcPorts(ports: any[]): string {
    if (!ports?.length) return '-'
    return ports
      .map((p: any) => {
        const proto = p.protocol ?? 'TCP'
        if (p.nodePort) return `${p.port}:${p.nodePort}/${proto}`
        return `${p.port}/${proto}`
      })
      .join(', ')
  }

  function renderIngressBackends(ingress: K8sIngress) {
    const tlsHosts = new Set<string>((ingress.spec?.tls ?? []).flatMap((t) => t.hosts ?? []))
    type LineMeta = { url: string; backend: string }
    const lines: LineMeta[] = []
    for (const rule of ingress.spec?.rules ?? []) {
      const proto = rule.host && tlsHosts.has(rule.host) ? 'https' : 'http'
      const host = rule.host ?? ''
      for (const p of rule.http?.paths ?? []) {
        const path = p.path ?? '/'
        const svcName = p.backend?.service?.name ?? ''
        const svcPort = p.backend?.service?.port?.number ?? p.backend?.service?.port?.name ?? ''
        lines.push({
          url: `${proto}://${host}${path}`,
          backend: svcName ? `-->${svcName}:${svcPort}` : ''
        })
      }
    }
    if (!lines.length) return h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, '-')

    const renderLine = (line: LineMeta) =>
      h(
        'span',
        { style: 'font-size:12px;display:inline-flex;align-items:center;flex-wrap:nowrap' },
        [
          h(
            'a',
            {
              href: line.url,
              target: '_blank',
              rel: 'noopener noreferrer',
              style: 'font-size:12px;color:var(--el-color-primary);text-decoration:none'
            },
            line.url
          ),
          line.backend
            ? h(
                'span',
                { style: 'font-size:12px;color:var(--el-text-color-primary)' },
                line.backend
              )
            : null
        ]
      )

    const children = [h('div', { style: 'display:block' }, [renderLine(lines[0])])]
    if (lines.length > 1) {
      const tooltipContent = h(
        'div',
        { style: 'padding:4px 0' },
        lines.map((l) => h('div', { style: 'line-height:1.8' }, [renderLine(l)]))
      )
      children.push(
        h(
          ElTooltip,
          { placement: 'top', effect: 'light' },
          {
            default: () =>
              h(
                'span',
                {
                  style:
                    'font-size:12px;display:block;color:var(--el-color-primary);cursor:pointer;text-decoration:underline'
                },
                `等${lines.length}条转发规则`
              ),
            content: () => tooltipContent
          }
        )
      )
    }
    return h('div', { style: 'line-height:1.8' }, children)
  }

  // ── Service useTable ──
  type SvcParams = { current: number; size: number; name?: string; namespace?: string }
  const {
    columns: svcColumns,
    columnChecks: svcColumnChecks,
    data: svcData,
    loading: svcLoading,
    pagination: svcPagination,
    getData: getSvcData,
    replaceSearchParams: replaceSvcSearchParams,
    handleSizeChange: svcHandleSizeChange,
    handleCurrentChange: svcHandleCurrentChange,
    refreshData: refreshSvcData
  } = useTable({
    core: {
      immediate: false,
      apiFn: async (params: SvcParams) => {
        const cluster = String(route.query.cluster ?? '')
        if (!cluster)
          return {
            code: 200,
            data: {
              records: [] as (K8sService & { rowKey: string })[],
              total: 0,
              current: 1,
              size: params.size
            }
          }
        // 拉取全部资源（不带 fieldSelector），本地模糊搜索
        const { items: allItems } = await fetchK8sServiceList(cluster, {
          page: 1,
          limit: 999999,
          namespace: selectedNamespace.value || undefined
        })
        // 本地模糊筛选
        const keyword = (params.name ?? '').trim().toLowerCase()
        const filtered = keyword
          ? allItems.filter((r) => (r.metadata?.name ?? '').toLowerCase().includes(keyword))
          : allItems
        // 本地分页
        const start = (params.current - 1) * params.size
        const end = start + params.size
        let list = filtered.slice(start, end).map((d, i) => ({
          ...d,
          rowKey: d.metadata?.uid ?? d.metadata?.name ?? `svc-${i}`
        }))
        if (svcSortOrder.value) {
          list = [...list].sort((a, b) => {
            const ta = a.metadata?.creationTimestamp ?? '',
              tb = b.metadata?.creationTimestamp ?? ''
            return svcSortOrder.value === 'ascending' ? ta.localeCompare(tb) : tb.localeCompare(ta)
          })
        }
        return {
          code: 200,
          data: { records: list, total: filtered.length, current: params.current, size: params.size }
        }
      },
      apiParams: { current: 1, size: 10, name: undefined, namespace: undefined },
      columnsFactory: () => [
        { type: 'selection', width: 30 },
        {
          prop: 'metadata.name',
          label: '名称',
          minWidth: 200,
          formatter: (row: K8sService) => renderNameCell(row.metadata?.name ?? '-')
        },
        {
          prop: 'spec.type',
          label: '类型',
          width: 130,
          formatter: (row: K8sService) =>
            h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, row.spec?.type ?? 'ClusterIP')
        },
        {
          prop: 'metadata.namespace',
          label: '命名空间',
          width: 160,
          formatter: (row: K8sService) => renderNsCell(row.metadata?.namespace ?? '-')
        },
        {
          prop: 'spec.clusterIP',
          label: 'Cluster IP',
          width: 150,
          formatter: (row: K8sService) => {
            const ip = row.spec?.clusterIP ?? '-'
            return h('div', { style: 'display:flex;align-items:center;gap:6px' }, [
              h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, ip),
              ip !== '-'
                ? h(
                    'span',
                    {
                      class: 'icon-action',
                      style:
                        'cursor:pointer;color:var(--el-text-color-secondary);display:inline-flex;align-items:center',
                      title: '复制',
                      onClick: (e: MouseEvent) => {
                        e.stopPropagation()
                        navigator.clipboard.writeText(ip)
                        ElMessage.success('已复制')
                      }
                    },
                    [h(CopyDocument, { style: 'width:12px;height:12px' })]
                  )
                : null
            ])
          }
        },
        {
          prop: 'spec.ports',
          label: '端口',
          minWidth: 180,
          formatter: (row: K8sService) =>
            h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, formatSvcPorts(row.spec?.ports as any))
        },
        {
          prop: 'metadata.creationTimestamp',
          label: '创建时间',
          width: 168,
          sortable: 'custom',
          formatter: (row: K8sService) =>
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-text-color-regular)' },
              formatNodeCreationTime(row.metadata?.creationTimestamp)
            )
        },
        {
          prop: 'operation',
          label: '操作',
          width: 160,
          fixed: 'right',
          formatter: (row: K8sService) =>
            h('div', { style: 'display:flex;align-items:center;gap:12px' }, [
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () =>
                    void openYamlDialog(
                      'svc',
                      row.metadata?.namespace ?? '',
                      row.metadata?.name ?? ''
                    )
                },
                () => '查看YAML'
              ),
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () =>
                    void deleteResource(
                      'svc',
                      row.metadata?.namespace ?? '',
                      row.metadata?.name ?? '',
                      onSvcRefresh
                    )
                },
                () => '删除'
              )
            ])
        }
      ]
    }
  })

  const svcVisibleColumns = computed(() =>
    svcColumns.value.filter((c: any) => !(selectedNamespace.value && c.prop === 'metadata.namespace'))
  )

  function runSvcSearch() {
    const name = (svcSearchForm.value.name ?? '').trim() || undefined
    replaceSvcSearchParams({ name, namespace: selectedNamespace.value || undefined })
    getSvcData()
  }
  function forceSvcSearch() {
    const name = (svcSearchForm.value.name ?? '').trim() || undefined
    replaceSvcSearchParams({ name, namespace: selectedNamespace.value || undefined })
    getSvcData()
  }
  function onSvcRefresh() {
    refreshSvcData()
  }
  function onSvcSortChange({ prop, order }: { prop: string; order: string | null }) {
    if (prop === 'metadata.creationTimestamp') {
      svcSortOrder.value = (order as 'ascending' | 'descending' | null) ?? null
      getSvcData()
    }
  }

  // ── Ingress useTable ──
  type IngParams = { current: number; size: number; name?: string; namespace?: string }
  const {
    columns: ingColumns,
    columnChecks: ingColumnChecks,
    data: ingData,
    loading: ingLoading,
    pagination: ingPagination,
    getData: getIngData,
    replaceSearchParams: replaceIngSearchParams,
    handleSizeChange: ingHandleSizeChange,
    handleCurrentChange: ingHandleCurrentChange,
    refreshData: refreshIngData
  } = useTable({
    core: {
      immediate: false,
      apiFn: async (params: IngParams) => {
        const cluster = String(route.query.cluster ?? '')
        if (!cluster)
          return {
            code: 200,
            data: {
              records: [] as (K8sIngress & { rowKey: string })[],
              total: 0,
              current: 1,
              size: params.size
            }
          }
        // 拉取全部资源（不带 fieldSelector），本地模糊搜索
        const { items: allItems } = await fetchK8sIngressList(cluster, {
          page: 1,
          limit: 999999,
          namespace: selectedNamespace.value || undefined
        })
        // 本地模糊筛选
        const keyword = (params.name ?? '').trim().toLowerCase()
        const filtered = keyword
          ? allItems.filter((r) => (r.metadata?.name ?? '').toLowerCase().includes(keyword))
          : allItems
        // 本地分页
        const start = (params.current - 1) * params.size
        const end = start + params.size
        let list = filtered.slice(start, end).map((d, i) => ({
          ...d,
          rowKey: d.metadata?.uid ?? d.metadata?.name ?? `ing-${i}`
        }))
        if (ingSortOrder.value) {
          list = [...list].sort((a, b) => {
            const ta = a.metadata?.creationTimestamp ?? '',
              tb = b.metadata?.creationTimestamp ?? ''
            return ingSortOrder.value === 'ascending' ? ta.localeCompare(tb) : tb.localeCompare(ta)
          })
        }
        return {
          code: 200,
          data: { records: list, total: filtered.length, current: params.current, size: params.size }
        }
      },
      apiParams: { current: 1, size: 10, name: undefined, namespace: undefined },
      columnsFactory: () => [
        { type: 'selection', width: 30 },
        {
          prop: 'metadata.name',
          label: '名称',
          minWidth: 120,
          formatter: (row: K8sIngress) => renderNameCell(row.metadata?.name ?? '-')
        },
        {
          prop: 'spec.ingressClassName',
          label: 'IngressClass',
          width: 160,
          formatter: (row: K8sIngress) =>
            h('span', { style: 'font-size:12px;' }, row.spec?.ingressClassName ?? '-')
        },
        {
          prop: 'metadata.namespace',
          label: '命名空间',
          width: 160,
          formatter: (row: K8sIngress) => renderNsCell(row.metadata?.namespace ?? '-')
        },
        {
          prop: 'spec.rules',
          label: '后端服务',
          minWidth: 320,
          formatter: (row: K8sIngress) => renderIngressBackends(row)
        },
        {
          prop: 'metadata.creationTimestamp',
          label: '创建时间',
          width: 168,
          sortable: 'custom',
          formatter: (row: K8sIngress) =>
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-text-color-regular)' },
              formatNodeCreationTime(row.metadata?.creationTimestamp)
            )
        },
        {
          prop: 'operation',
          label: '操作',
          width: 200,
          fixed: 'right',
          formatter: (row: K8sIngress) =>
            h('div', { style: 'display:flex;align-items:center;gap:12px' }, [
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () =>
                    router.push({
                      path: '/container/ingress-create',
                      query: {
                        cluster: String(route.query.cluster ?? ''),
                        namespace: row.metadata?.namespace ?? '',
                        name: row.metadata?.name ?? ''
                      }
                    })
                },
                () => '编辑'
              ),
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () =>
                    void openYamlDialog(
                      'ing',
                      row.metadata?.namespace ?? '',
                      row.metadata?.name ?? ''
                    )
                },
                () => '查看YAML'
              ),
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () =>
                    void deleteResource(
                      'ing',
                      row.metadata?.namespace ?? '',
                      row.metadata?.name ?? '',
                      onIngRefresh
                    )
                },
                () => '删除'
              )
            ])
        }
      ]
    }
  })

  const ingVisibleColumns = computed(() =>
    ingColumns.value.filter((c: any) => !(selectedNamespace.value && c.prop === 'metadata.namespace'))
  )

  function runIngSearch() {
    const name = (ingSearchForm.value.name ?? '').trim() || undefined
    replaceIngSearchParams({ name, namespace: selectedNamespace.value || undefined })
    getIngData()
  }
  function forceIngSearch() {
    const name = (ingSearchForm.value.name ?? '').trim() || undefined
    replaceIngSearchParams({ name, namespace: selectedNamespace.value || undefined })
    getIngData()
  }
  function onIngRefresh() {
    refreshIngData()
  }
  function onIngSortChange({ prop, order }: { prop: string; order: string | null }) {
    if (prop === 'metadata.creationTimestamp') {
      ingSortOrder.value = (order as 'ascending' | 'descending' | null) ?? null
      getIngData()
    }
  }

  // ── Shared YAML dialog ──
  async function openYamlDialog(resKind: 'svc' | 'ing', namespace: string, name: string) {
    const cluster = String(route.query.cluster ?? '')
    if (!cluster || !namespace || !name) return
    currentYamlKind.value = resKind
    try {
      let resource: unknown
      if (resKind === 'svc') resource = await fetchK8sService(cluster, namespace, name)
      else resource = await fetchK8sIngress(cluster, namespace, name)
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
      if (currentYamlKind.value === 'svc') getSvcData()
      else getIngData()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      yamlSaving.value = false
    }
  }

  // ── Shared delete ──
  async function deleteResource(
    resKind: 'svc' | 'ing',
    namespace: string,
    name: string,
    refresh: () => void
  ) {
    const cluster = String(route.query.cluster ?? '')
    if (!cluster || !namespace || !name) return
    try {
      await ElMessageBox.confirm(`确定删除 "${name}" 吗？`, '删除确认', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
      if (resKind === 'svc') await deleteK8sService(cluster, namespace, name)
      else await deleteK8sIngress(cluster, namespace, name)
      ElMessage.success('删除成功')
      refresh()
    } catch {
      // user cancel
    }
  }

  // ── Tab lazy loading ──
  watch(kind, (val) => {
    router.replace({ query: { ...route.query, tab: val } })
  })

  watch(
    [kind, () => String(route.query.cluster ?? '')],
    ([val, cluster]) => {
      if (!cluster) return
      if (val === 'svc') getSvcData()
      else if (val === 'ing') getIngData()
    },
    { immediate: true }
  )

  useClusterDetailNamespaceRefresh('services', () => {
    if (kind.value === 'svc') getSvcData()
    if (kind.value === 'ing') getIngData()
  })

  function refreshActiveServicesTab() {
    if (kind.value === 'svc') refreshSvcData()
    else refreshIngData()
  }

  useSkipFirstActivatedRefresh(refreshActiveServicesTab)
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
    margin: 0 0 4px;
  }
  .services-page .el-tabs__nav-wrap::after {
    height: 1px;
    background-color: var(--el-border-color-lighter);
  }
  .services-page .el-tabs__item {
    height: 40px;
    line-height: 40px;
    padding: 0 18px;
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-regular);
  }
  .services-page .el-tabs__item.is-active {
    color: var(--el-color-primary);
    font-weight: 600;
  }
  .services-page .el-tabs__active-bar {
    height: 2px;
    border-radius: 2px 2px 0 0;
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

  .workloads-toolbar__ns-select {
    width: 160px;
  }

  .workloads-toolbar__ns-select :deep(.el-select__placeholder) {
    color: var(--el-text-color-regular);
    font-size: 13px;
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

</style>

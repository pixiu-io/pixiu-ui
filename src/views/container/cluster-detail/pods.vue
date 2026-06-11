<template>
  <div class="pods-page">
    <ElCard class="art-table-card">
      <ArtTableHeader
        v-model:columns="columnChecks"
        :loading="loading"
        layout="size,fullscreen,columns,settings"
        @refresh="onRefresh"
      >
        <template #left>
          <div class="pods-toolbar">
            <ElButton v-ripple :disabled="!selectedPods.length" @click="batchDeletePods">
              销毁重建
            </ElButton>
            <div class="pods-toolbar__filters">
              <ElInput
                v-model="searchForm.name"
                clearable
                placeholder="请输入Pod名称"
                class="pods-toolbar__name"
                @keyup.enter="runSearch"
                @clear="runSearch"
              />
              <div
                class="pods-toolbar-search-btn"
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
        :columns="visibleColumns"
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

    <K8sYamlDialog
      v-model="yamlVisible"
      title="查看 YAML"
      :yaml="yamlText"
      footer-mode="edit"
      width="900px"
      :editor-height="520"
      :submit-loading="yamlSaving"
      @save="onPodYamlSave"
    />

    <ElDialog
      v-model="remoteLoginVisible"
      title="登录"
      width="520px"
      destroy-on-close
      align-center
      class="remote-login-dialog"
      header-class="remote-login-dialog-header"
      body-class="remote-login-dialog-body"
      @close="resetRemoteLogin"
    >
      <ElAlert
        type="info"
        :closable="false"
        show-icon
        class="quota-alert"
        description="基于 WebShell 提供登录容器的功能。"
      />
      <ElForm label-width="auto" class="remote-login-form">
        <ElFormItem label="容器名称" class="remote-login-form-item">
          <ElSelect v-model="remoteLogin.container" class="remote-login-select">
            <ElOption
              v-for="name in remoteLogin.containers"
              :key="name"
              :value="name"
              :label="name"
            />
          </ElSelect>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="remoteLoginVisible = false">取消</ElButton>
        <ElButton type="primary" @click="confirmRemoteLogin">确认</ElButton>
      </template>
    </ElDialog>

    <ElDrawer v-model="eventVisible" size="80%" destroy-on-close>
      <template #header>
        <span class="drawer-title">事件查询</span>
      </template>
      <ElAlert
        type="info"
        :closable="false"
        show-icon
        class="quota-alert"
        description="获取 Pod 相关事件（与 dashboard 一致）。"
      />
      <div class="event-toolbar">
        <ElButton type="primary" @click="loadEventList">查询</ElButton>
        <ElButton :disabled="!eventSelection.length" @click="batchDeleteEvents">批量删除</ElButton>
      </div>
      <ElTable
        v-loading="eventLoading"
        :data="eventRows"
        stripe
        class="mt-3"
        @selection-change="onEventSelectionChange"
      >
        <ElTableColumn type="selection" width="42" />
        <ElTableColumn label="最后出现时间" min-width="160">
          <template #default="{ row }">{{ formatNodeCreationTime(row.lastTimestamp) }}</template>
        </ElTableColumn>
        <ElTableColumn prop="type" label="级别" width="90" />
        <ElTableColumn label="资源类型" width="120">
          <template #default="{ row }">{{ row.involvedObject?.kind ?? '-' }}</template>
        </ElTableColumn>
        <ElTableColumn label="资源名称" min-width="140">
          <template #default="{ row }">{{ row.involvedObject?.name ?? '-' }}</template>
        </ElTableColumn>
        <ElTableColumn prop="count" label="出现次数" width="90" />
        <ElTableColumn prop="message" label="内容" min-width="220" show-overflow-tooltip />
      </ElTable>
      <div class="event-pagination">
        <ElPagination
          v-model:current-page="eventPage"
          v-model:page-size="eventPageSize"
          :total="eventTotal"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @current-change="loadEventList"
          @size-change="loadEventList"
        />
      </div>
    </ElDrawer>

    <PodRemoteWebshell ref="podRemoteWebshellRef" />

    <!-- 日志抽屉 -->
    <ElDrawer
      v-model="logDrawerVisible"
      direction="rtl"
      :size="logDrawerFullscreen ? '100%' : '60%'"
      destroy-on-close
      :show-close="false"
      class="pod-log-drawer"
      @close="closePodLogs"
    >
      <template #header>
        <div class="pod-log-drawer-header">
          <span class="pod-log-title">Pod 日志 - <span class="pod-log-pod-name">{{ logPod?.metadata?.name }}</span></span>
          <div class="pod-log-toolbar">
            <ElSelect v-model="logContainer" size="small" style="width:160px" placeholder="选择容器" @change="reconnectLogWs">
              <ElOption v-for="c in logContainers" :key="c" :value="c" :label="c" />
            </ElSelect>
            <ElSelect v-model="logTailLines" size="small" style="width:90px" @change="reconnectLogWs">
              <ElOption :value="100" label="100行" />
              <ElOption :value="200" label="200行" />
              <ElOption :value="500" label="500行" />
              <ElOption :value="1000" label="1000行" />
            </ElSelect>
            <button type="button" class="pod-log-icon-btn" title="刷新" @click.stop="reconnectLogWs">
              <ElIcon :size="18"><Refresh /></ElIcon>
            </button>
            <button type="button" class="pod-log-icon-btn" :title="logDrawerFullscreen ? '退出全屏' : '全屏'" @click.stop="logDrawerFullscreen = !logDrawerFullscreen">
              <ElIcon :size="18"><ScaleToOriginal v-if="logDrawerFullscreen" /><FullScreen v-else /></ElIcon>
            </button>
            <button type="button" class="pod-log-icon-btn" title="关闭" @click.stop="logDrawerVisible = false">
              <ElIcon :size="18"><Close /></ElIcon>
            </button>
          </div>
        </div>
      </template>
      <div class="pod-log-body">
        <ElTable :data="logRows" v-loading="logConnecting" class="pod-log-table">
          <ElTableColumn prop="line" label="日志内容" />
          <template #empty>
            <div style="color:var(--el-text-color-secondary);font-size:13px;padding:16px 0">暂无日志</div>
          </template>
        </ElTable>
      </div>
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import { ElAlert, ElButton, ElDialog, ElDrawer, ElIcon, ElInput, ElForm, ElFormItem, ElLink, ElMessage, ElMessageBox, ElOption, ElPagination, ElRadio, ElRadioGroup, ElSelect, ElTable, ElTableColumn, ElTag, ElTooltip } from 'element-plus'
  import ArtButtonMore, { type ButtonMoreItem } from '@/components/core/forms/art-button-more/index.vue'
  import { Close, CopyDocument, FullScreen, Loading, Refresh, ScaleToOriginal } from '@element-plus/icons-vue'
  import { h, nextTick, ref, computed, watch, inject } from 'vue'
import { CLUSTER_TABLE_PAGINATION_OPTIONS } from './constants/table'
import ClusterTableEmpty from './components/cluster-table-empty.vue'
  import { useRoute, useRouter } from 'vue-router'
  import { buildClusterRouteQuery } from '@/utils/navigation/cluster-query'
  import { useTable } from '@/hooks/core/useTable'
  import { useSkipFirstActivatedRefresh } from '@/hooks/core/useSkipFirstActivatedRefresh'
  import { useWatchAfterTableInit } from '@/hooks/core/useWatchAfterTableInit'
  import { deleteK8sEvent, fetchKubeRawEventList } from '@/api/kubernetes/events'
  import {
    deleteK8sPod,
    fetchK8sPod,
    fetchK8sPodList,
    type K8sPod
  } from '@/api/kubernetes/pod'
  import { PixiuApiError } from '@/api/container'
  import { formatNodeCreationTime } from '@/utils/kubernetes/nodeDisplay'
  import { clusterDetailNamespaceKey } from './context'
  import PodRemoteWebshell from './components/pod-remote-webshell.vue'
  import K8sYamlDialog from '@/components/kubernetes/k8s-yaml-dialog.vue'
  import { updateK8sResourceFromYaml } from '@/api/kubernetes/yamlCreate'
  import { resolvePixiuWsOrigin } from '@/utils/pixiu-ws-origin'
  import yaml from 'js-yaml'

  defineOptions({ name: 'ClusterDetailPods' })

  const route = useRoute()
  const router = useRouter()
  const searchForm = ref<{ name?: string }>({})
  const selectedPods = ref<K8sPod[]>([])

  const globalNs = inject(clusterDetailNamespaceKey)
  const selectedNamespace = computed(() => globalNs?.namespace.value ?? '')

  watch(
    () => String(route.query.cluster ?? ''),
    () => {
      selectedPods.value = []
    }
  )
  const yamlText = ref('')
  const yamlSaving = ref(false)
  const remoteLoginVisible = ref(false)
  const remoteLogin = ref<{
    pod: string
    namespace: string
    container: string
    containers: string[]
  }>({
    pod: '',
    namespace: '',
    container: '',
    containers: []
  })

  const yamlVisible = ref(false)
  const podRemoteWebshellRef = ref<InstanceType<typeof PodRemoteWebshell> | null>(null)

  function formatPodStatusText(row: K8sPod): string {
    return row.status?.phase || '未知'
  }

  function podStatusTagType(text: string): 'success' | 'warning' | 'info' | 'danger' {
    if (text === 'Running') return 'success'
    if (text === 'Pending') return 'warning'
    if (text === 'Failed') return 'danger'
    return 'info'
  }

  function formatRestartCount(row: K8sPod): number {
    return (row.status?.containerStatuses ?? []).reduce((sum, c) => sum + (c.restartCount ?? 0), 0)
  }

  function parseCpuMilli(val: string): number {
    if (val.endsWith('m')) return parseFloat(val)
    return parseFloat(val) * 1000
  }

  function formatCpuMilli(m: number): string {
    if (m >= 1000) return `${+(m / 1000).toFixed(2)}`
    return `${m}m`
  }

  function parseMemBytes(val: string): number {
    if (val.endsWith('Ki')) return parseFloat(val) * 1024
    if (val.endsWith('Mi')) return parseFloat(val) * 1024 ** 2
    if (val.endsWith('Gi')) return parseFloat(val) * 1024 ** 3
    if (val.endsWith('Ti')) return parseFloat(val) * 1024 ** 4
    if (val.endsWith('K') || val.endsWith('k')) return parseFloat(val) * 1000
    if (val.endsWith('M')) return parseFloat(val) * 1000 ** 2
    if (val.endsWith('G')) return parseFloat(val) * 1000 ** 3
    return parseFloat(val)
  }

  function formatMemBytes(b: number): string {
    if (b >= 1024 ** 3) return `${+(b / 1024 ** 3).toFixed(1)}Gi`
    if (b >= 1024 ** 2) return `${Math.round(b / 1024 ** 2)}Mi`
    if (b >= 1024) return `${Math.round(b / 1024)}Ki`
    return `${b}B`
  }

  function renderNsCell(ns?: string) {
    const namespace = ns || '-'
    const isSystem = namespace === 'default' || namespace.startsWith('kube-')
    return h('div', { style: 'display:flex;align-items:center;gap:6px' }, [
      h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, namespace),
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
            data: { records: [] as (K8sPod & { rowKey?: string })[], total: 0, current: 1, size: params.size }
          }
        }
        // 拉取全部 pod（不带 fieldSelector），本地模糊搜索
        const { items: allItems } = await fetchK8sPodList(cluster, {
          page: 1,
          limit: 999999,
          namespace: params.namespace || undefined
        })

        // 本地模糊筛选
        const keyword = (params.name ?? '').trim().toLowerCase()
        const filtered = keyword
          ? allItems.filter((p) => (p.metadata?.name ?? '').toLowerCase().includes(keyword))
          : allItems

        // 本地分页
        const start = (params.current - 1) * params.size
        const end = start + params.size
        const records = filtered.slice(start, end).map((row, i) => ({
          ...row,
          rowKey: `${row.metadata?.namespace ?? 'default'}:${row.metadata?.name ?? `r-${i}`}`
        }))
        return {
          code: 200,
          data: { records, total: filtered.length, current: params.current, size: params.size }
        }
      },
      apiParams: {
        current: 1,
        size: 10,
        name: undefined,
        namespace: selectedNamespace.value || undefined
      },
      columnsFactory: () => [
        { type: 'selection', width: 30 },
        {
          prop: 'metadata.name',
          label: '实例名称',
          minWidth: 200,
          formatter: (row: K8sPod) =>
            h('div', { style: 'display:flex;align-items:center;min-width:0;overflow:hidden' }, [
              h(
                ElTooltip,
                { content: row.metadata?.name ?? '', placement: 'top', showAfter: 300 },
                {
                  default: () =>
                    h(
                      ElLink,
                      {
                        type: 'primary',
                        underline: 'never',
                        style: 'font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block',
                        onClick: () => {
                          const ns = row.metadata?.namespace ?? ''
                          const name = row.metadata?.name ?? ''
                          router.push({
                            path: '/container/pod-detail',
                            query: buildClusterRouteQuery(route, { namespace: ns, pod: name })
                          })
                        }
                      },
                      () => row.metadata?.name ?? '-'
                    )
                }
              ),
              h(
                'span',
                {
                  class: 'icon-action',
                  style: 'flex-shrink:0;margin-left:10px;cursor:pointer;color:var(--el-text-color-secondary);display:inline-flex;align-items:center',
                  title: '复制',
                  onClick: (e: MouseEvent) => {
                    e.stopPropagation()
                    navigator.clipboard.writeText(row.metadata?.name ?? '')
                    ElMessage.success('已复制')
                  }
                },
                [h(CopyDocument, { style: 'width:12px;height:12px' })]
              )
            ])
        },
        {
          prop: 'status.phase',
          label: '状态',
          width: 110,
          formatter: (row: K8sPod) => {
            const text = formatPodStatusText(row)
            return h(ElTag, { type: podStatusTagType(text), size: 'small' }, () => text)
          }
        },
        {
          prop: 'ready',
          label: 'Ready',
          width: 100,
          formatter: (row: K8sPod) => {
            const statuses = row.status?.containerStatuses ?? []
            const total = statuses.length || (row.spec?.containers?.length ?? 0)
            const ready = statuses.filter((c) => c.ready).length
            const ok = total > 0 && ready === total
            const valueLine = h('div', { style: 'display:flex;align-items:center;gap:4px' }, [
              h(
                'span',
                { style: 'font-size:12px;color:var(--el-text-color-primary)' },
                `${ready} / ${total}`
              ),
              !ok
                ? h(
                    'span',
                    {
                      style: 'display:inline-flex;align-items:center;color:var(--el-color-primary);animation:spin-rotate 1s linear infinite'
                    },
                    [h(Loading, { style: 'width:13px;height:13px' })]
                  )
                : null
            ])
            if (ok) return valueLine
            return h('div', { style: 'line-height:1.4' }, [
              valueLine,
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:11px',
                  onClick: () => {
                    const ns = row.metadata?.namespace ?? ''
                    const name = row.metadata?.name ?? ''
                    router.push({
                      path: '/container/pod-detail',
                      query: buildClusterRouteQuery(route, { namespace: ns, pod: name, tab: 'events' })
                    })
                  }
                },
                () => '查看事件列表'
              )
            ])
          }
        },
        {
          prop: 'status.hostIP',
          label: '所在节点',
          minWidth: 190,
          formatter: (row: K8sPod) => {
            const hostname = row.spec?.nodeName ?? ''
            const ip = row.status?.hostIP ?? ''
            const lineStyle = 'display:flex;align-items:center;gap:4px'
            const textStyle = 'font-size:12px;color:var(--el-text-color-regular);white-space:nowrap'
            const subStyle = 'font-size:11px;color:var(--el-text-color-regular);white-space:nowrap'
            const copyIcon = (val: string) =>
              h(
                'span',
                {
                  class: 'icon-action',
                  style: 'cursor:pointer;color:var(--el-text-color-secondary);display:inline-flex;align-items:center;flex-shrink:0',
                  title: '复制',
                  onClick: (e: MouseEvent) => {
                    e.stopPropagation()
                    navigator.clipboard.writeText(val)
                    ElMessage.success('已复制')
                  }
                },
                [h(CopyDocument, { style: 'width:11px;height:11px' })]
              )
            return h('div', { style: 'line-height:1.8' }, [
              h('div', { style: lineStyle }, [
                h('span', { style: textStyle }, `节点: ${hostname || '-'}`),
                hostname ? copyIcon(hostname) : null
              ]),
              h('div', { style: lineStyle }, [
                h('span', { style: subStyle }, `IP: ${ip || '-'}`),
                ip ? copyIcon(ip) : null
              ])
            ])
          }
        },
        {
          prop: 'status.podIP',
          label: '实例IP',
          minWidth: 150,
          formatter: (row: K8sPod) => {
            const ip = row.status?.podIP ?? ''
            return h('div', { style: 'display:flex;align-items:center;gap:4px' }, [
              h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, ip || '-'),
              ip
                ? h(
                    'span',
                    {
                      class: 'icon-action',
                      style: 'cursor:pointer;color:var(--el-text-color-secondary);display:inline-flex;align-items:center;flex-shrink:0',
                      title: '复制',
                      onClick: (e: MouseEvent) => {
                        e.stopPropagation()
                        navigator.clipboard.writeText(ip)
                        ElMessage.success('已复制')
                      }
                    },
                    [h(CopyDocument, { style: 'width:11px;height:11px' })]
                  )
                : null
            ])
          }
        },
        {
          prop: 'metadata.namespace',
          label: '命名空间',
          minWidth: 120,
          showOverflowTooltip: true,
          formatter: (row: K8sPod) => renderNsCell(row.metadata?.namespace)
        },
        {
          prop: 'resources',
          label: 'Request/Limits',
          minWidth: 170,
          formatter: (row: K8sPod) => {
            const containers = row.spec?.containers ?? []
            let cpuReqM = 0, cpuLimM = 0, memReqB = 0, memLimB = 0
            let hasCpuReq = false, hasCpuLim = false, hasMemReq = false, hasMemLim = false
            for (const c of containers as any[]) {
              const cr = c.resources?.requests?.cpu
              const cl = c.resources?.limits?.cpu
              const mr = c.resources?.requests?.memory
              const ml = c.resources?.limits?.memory
              if (cr) { cpuReqM += parseCpuMilli(cr); hasCpuReq = true }
              if (cl) { cpuLimM += parseCpuMilli(cl); hasCpuLim = true }
              if (mr) { memReqB += parseMemBytes(mr); hasMemReq = true }
              if (ml) { memLimB += parseMemBytes(ml); hasMemLim = true }
            }
            const cpuReq = hasCpuReq ? formatCpuMilli(cpuReqM) : '无限制'
            const cpuLim = hasCpuLim ? formatCpuMilli(cpuLimM) : '无限制'
            const memReq = hasMemReq ? formatMemBytes(memReqB) : '无限制'
            const memLim = hasMemLim ? formatMemBytes(memLimB) : '无限制'
            const rowStyle = 'font-size:11px;color:var(--el-text-color-regular);white-space:nowrap'
            return h('div', { style: 'line-height:1.8' }, [
              h('div', { style: rowStyle }, `CPU: ${cpuReq} / ${cpuLim}`),
              h('div', { style: rowStyle }, `内存: ${memReq} / ${memLim}`)
            ])
          }
        },
        {
          prop: 'restartCount',
          label: '重启次数',
          width: 100,
          formatter: (row: K8sPod) => h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, String(formatRestartCount(row)))
        },
        {
          prop: 'metadata.creationTimestamp',
          label: '创建时间',
          width: 170,
          formatter: (row: K8sPod) =>
            h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, formatNodeCreationTime(row.metadata?.creationTimestamp))
        },
        {
          prop: 'operation',
          label: '操作',
          width: 118,
          fixed: 'right',
          formatter: (row: K8sPod) =>
            h('div', { style: 'display:flex;align-items:center;gap:6px;flex-wrap:nowrap' }, [
              h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px;line-height:1', disabled: row.status?.phase !== 'Running', onClick: () => openRemoteLoginDialog(row) }, () => '登录'),
              h(ElLink, { type: 'primary', underline: 'never', style: 'font-size:12px;line-height:1', onClick: () => openPodLogs(row) }, () => '日志'),
              h(ArtButtonMore, {
                list: [
                  { key: 'yaml', label: '查看YAML', icon: 'ri:file-code-line' },
                  { key: 'delete', label: '删除', icon: 'ri:delete-bin-4-line', color: '#409eff' }
                ],
                onClick: (item: ButtonMoreItem) => podMoreClick(item, row)
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

  useWatchAfterTableInit(
    selectedNamespace,
    (ns) => {
      replaceSearchParams({ namespace: ns || undefined })
      getData()
    },
    { immediate: true }
  )

  useSkipFirstActivatedRefresh(refreshData)

  function onSelectionChange(rows: K8sPod[]) {
    selectedPods.value = rows
  }

  async function batchDeletePods() {
    if (!selectedPods.value.length) {
      ElMessage.warning('未选择待删除 Pod')
      return
    }
    try {
      await ElMessageBox.confirm(
        `确定销毁重建 ${selectedPods.value.length} 个 Pod 吗？此操作不可恢复。`,
        '销毁重建 Pod',
        { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
      )
      const cluster = String(route.query.cluster ?? '')
      for (const pod of selectedPods.value) {
        const namespace = pod.metadata?.namespace
        const name = pod.metadata?.name
        if (!namespace || !name) continue
        await deleteK8sPod(cluster, namespace, name)
      }
      ElMessage.success('销毁重建成功')
      onRefresh()
    } catch (e: unknown) {
      if (e === 'cancel') return
      ElMessage.error(e instanceof Error ? e.message : '删除失败')
    }
  }

  function runSearch() {
    const name = (searchForm.value.name ?? '').trim() || undefined
    replaceSearchParams({ name, namespace: selectedNamespace.value || undefined })
    getData()
  }

  function onRefresh() {
    refreshData()
  }

  async function viewYaml(row: K8sPod) {
    const cluster = String(route.query.cluster ?? '')
    const namespace = row.metadata?.namespace
    const name = row.metadata?.name
    if (!cluster || !namespace || !name) return
    try {
      const pod = await fetchK8sPod(cluster, namespace, name)
      yamlText.value = yaml.dump(pod, { quotingType: '"' })
      yamlVisible.value = true
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '加载失败')
    }
  }

  function onPodYamlSave(text: string) {
    yamlText.value = text
    void savePodYaml()
  }

  async function savePodYaml() {
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

  async function removePod(row: K8sPod) {
    const cluster = String(route.query.cluster ?? '')
    const namespace = row.metadata?.namespace
    const name = row.metadata?.name
    if (!cluster || !namespace || !name) return
    try {
      await ElMessageBox.confirm(`确定删除 Pod「${name}」吗？此操作不可恢复。`, '删除Pod', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
      await deleteK8sPod(cluster, namespace, name)
      ElMessage.success('已删除')
      onRefresh()
    } catch (e: unknown) {
      if (e === 'cancel') return
      if (e instanceof PixiuApiError && e.notified) return
      ElMessage.error(e instanceof Error ? e.message : '删除失败')
    }
  }

  function podMoreClick(item: ButtonMoreItem, row: K8sPod) {
    switch (item.key) {
      case 'yaml':
        void viewYaml(row)
        break
      case 'delete':
        void removePod(row)
        break
    }
  }

  function resetRemoteLogin() {
    remoteLogin.value = {
      pod: '',
      namespace: '',
      container: '',
      containers: []
    }
  }

  function openRemoteLoginDialog(row: K8sPod) {
    if (row.status?.phase !== 'Running') {
      ElMessage.warning('Pod 未处于 Running 状态，无法远程登录')
      return
    }
    const pod = row.metadata?.name ?? ''
    const namespace = row.metadata?.namespace ?? ''
    const containers = (row.spec?.containers ?? []).map((c) => c.name ?? '').filter(Boolean)
    if (!pod || !namespace || !containers.length) {
      ElMessage.warning('容器信息不完整，无法登录')
      return
    }
    if (containers.length === 1) {
      loginPodWithAutoShell({ pod, namespace, container: containers[0] })
      return
    }
    remoteLogin.value = { pod, namespace, containers, container: containers[0] ?? '' }
    remoteLoginVisible.value = true
  }

  function confirmRemoteLogin() {
    const { pod, namespace, container } = remoteLogin.value
    if (!pod || !namespace || !container) {
      ElMessage.warning('请先选择容器')
      return
    }
    loginPodWithAutoShell({ pod, namespace, container })
  }

  function loginPodWithAutoShell(opts: { pod: string; namespace: string; container: string }) {
    const cluster = String(route.query.cluster ?? '')
    if (!cluster) return
    void podRemoteWebshellRef.value?.open({
      cluster,
      namespace: opts.namespace,
      pod: opts.pod,
      container: opts.container
    })
    remoteLoginVisible.value = false
    resetRemoteLogin()
  }

  interface K8sEventRow {
    metadata?: { name?: string; namespace?: string; uid?: string }
    lastTimestamp?: string
    type?: string
    involvedObject?: { kind?: string; name?: string }
    count?: number
    message?: string
  }

  const eventVisible = ref(false)
  const eventPod = ref<K8sPod | null>(null)
  const eventLoading = ref(false)
  const eventRows = ref<K8sEventRow[]>([])
  const eventPage = ref(1)
  const eventPageSize = ref(10)
  const eventSelection = ref<K8sEventRow[]>([])
  const eventTotal = ref(0)

  function onEventSelectionChange(rows: K8sEventRow[]) {
    eventSelection.value = rows
  }

  async function openEvents(row: K8sPod) {
    eventPod.value = row
    eventVisible.value = true
    eventPage.value = 1
    eventRows.value = []
    eventTotal.value = 0
    await loadEventList()
  }

  async function loadEventList() {
    const cluster = String(route.query.cluster ?? '')
    const row = eventPod.value
    const name = row?.metadata?.name
    const ns = row?.metadata?.namespace
    if (!name || !ns) return
    eventLoading.value = true
    try {
      const { items, total } = await fetchKubeRawEventList(cluster, {
        uid: row.metadata?.uid ?? '',
        namespace: ns,
        name,
        kind: 'Pod',
        namespaced: true,
        page: eventPage.value,
        limit: eventPageSize.value
      })
      eventRows.value = items as K8sEventRow[]
      eventTotal.value = total
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '加载事件失败')
      eventRows.value = []
      eventTotal.value = 0
    } finally {
      eventLoading.value = false
    }
  }

  async function batchDeleteEvents() {
    if (!eventSelection.value.length) {
      ElMessage.warning('未选择待删除事件')
      return
    }
    const cluster = String(route.query.cluster ?? '')
    try {
      for (const ev of eventSelection.value) {
        const ns = ev.metadata?.namespace ?? 'default'
        const nm = ev.metadata?.name
        if (!nm) continue
        await deleteK8sEvent(cluster, ns, nm)
      }
      ElMessage.success('已删除')
      await loadEventList()
    } catch (e: any) {
      if (e instanceof PixiuApiError && e.notified) return
      ElMessage.error(e instanceof Error ? e.message : '删除失败')
    }
  }

  // ========== Pod 日志 ==========
  const logDrawerVisible = ref(false)
  const logDrawerFullscreen = ref(false)
  const logConnecting = ref(false)
  const logPod = ref<K8sPod | null>(null)
  const logContainer = ref('')
  const logContainers = ref<string[]>([])
  const logTailLines = ref<number>(100)
  const logRows = ref<{ line: string }[]>([])
  let logSocket: WebSocket | null = null

  function buildLogWsUrl(): string {
    const cluster = String(route.query.cluster ?? '')
    const pod = logPod.value
    if (!cluster || !pod) return ''
    const ns = pod.metadata?.namespace ?? ''
    const name = pod.metadata?.name ?? ''
    const base = resolvePixiuWsOrigin()
    return (
      `${base}/pixiu/kubeproxy/clusters/${encodeURIComponent(cluster)}/namespaces/${encodeURIComponent(ns)}/pods/${encodeURIComponent(name)}/log` +
      `?container=${encodeURIComponent(logContainer.value)}&tailLines=${logTailLines.value}`
    )
  }

  function closeLogSocket() {
    if (logSocket) {
      logSocket.onopen = null
      logSocket.onmessage = null
      logSocket.onerror = null
      logSocket.onclose = null
      logSocket.close()
      logSocket = null
    }
  }

  function connectLogWs() {
    closeLogSocket()
    logRows.value = []
    logConnecting.value = true
    const url = buildLogWsUrl()
    if (!url) { logConnecting.value = false; return }
    const token = localStorage.getItem('pixiu-access-token')
    logSocket = token ? new WebSocket(url, [token]) : new WebSocket(url)

    logSocket.onopen = () => { logConnecting.value = false }

    logSocket.onmessage = (event) => {
      const text = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data as ArrayBuffer)
      const parts = text.split('\n')
      for (const p of parts) {
        if (p !== '') logRows.value.push({ line: p })
      }
    }

    logSocket.onerror = () => {
      logConnecting.value = false
      logRows.value.push({ line: '[连接出错]' })
    }

    logSocket.onclose = () => {
      logConnecting.value = false
    }
  }

  function reconnectLogWs() {
    connectLogWs()
  }

  function openPodLogs(row: K8sPod) {
    const ns = row.metadata?.namespace ?? ''
    const pod = row.metadata?.name ?? ''
    if (!ns || !pod) return
    router.push({
      path: '/container/pod-detail',
      query: buildClusterRouteQuery(route, { namespace: ns, pod, tab: 'logs' })
    })
  }

  function closePodLogs() {
    closeLogSocket()
    logRows.value = []
    logPod.value = null
    logDrawerFullscreen.value = false
  }

  watch(logDrawerFullscreen, () => {
    // no-op, fullscreen just resizes the drawer
  })
</script>

<style>
  @keyframes spin-rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .pods-page .icon-action {
    opacity: 0;
    transition: opacity 0.15s;
  }
  .pods-page .el-table__row:hover .icon-action {
    opacity: 1;
  }
  .pods-page .art-table .el-table {
    font-size: 13px;
  }
  .pods-page .art-table .el-table th.el-table__cell {
    font-size: 13px;
  }

  /* 日志抽屉 */
  .pod-log-drawer .el-drawer__header {
    padding: 12px 16px;
    margin-bottom: 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }
  .pod-log-drawer .el-drawer__body {
    padding: 0;
  }
</style>

<style scoped>
  .pods-toolbar {
    display: flex;
    width: 100%;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .pods-toolbar__filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-left: auto;
    margin-right: 8px;
  }

  .pods-toolbar__ns-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .pods-toolbar__ns-select {
    width: 160px;
  }

  .pods-toolbar__ns-select :deep(.el-select__placeholder) {
    color: var(--el-text-color-regular);
    font-size: 13px;
  }

  .pods-toolbar__name {
    width: 360px;
    max-width: 100%;
  }

  .pods-toolbar-search-btn {
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

  .pods-toolbar-search-btn:hover {
    background: var(--art-gray-300);
  }

  .pods-toolbar-search-btn:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 1px;
  }

  .remote-login-select {
    width: 100%;
  }

  .drawer-title {
    font-size: 16px;
    font-weight: 600;
  }

  .event-toolbar {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .event-pagination {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }

  .mb-4 {
    margin-bottom: 16px;
  }

  .mt-3 {
    margin-top: 12px;
  }

  /* 日志抽屉内部 */
  .pod-log-drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 12px;
  }
  .pod-log-title {
    font-size: 14px;
    font-weight: 500;
    flex-shrink: 0;
  }
  .pod-log-pod-name {
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 13px;
    color: var(--el-color-primary);
  }
  .pod-log-toolbar {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    margin-left: auto;
  }
  .pod-log-icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    color: var(--el-text-color-secondary);
    cursor: pointer;
    border-radius: 4px;
    transition: color 0.15s, background-color 0.15s;
  }
  .pod-log-icon-btn:hover {
    color: var(--el-color-primary);
    background-color: var(--el-color-primary-light-9);
  }
  .pod-log-body {
    flex: 1;
    min-height: 0;
    padding: 12px 16px;
    overflow: auto;
  }
  .pod-log-table {
    width: 100%;
  }

  .remote-login-form-item :deep(.el-form-item__label) {
    font-size: 13px;
  }
</style>

<style>
  .remote-login-dialog-header {
    padding: 10px 24px 0 !important;
    margin-bottom: 0 !important;
  }

  .remote-login-dialog-body {
    padding: 0 24px 12px !important;
  }
</style>

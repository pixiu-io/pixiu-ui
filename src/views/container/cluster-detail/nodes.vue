<!-- 节点管理：数据与操作对齐 dashboard node.vue，样式对齐 pixiu-ui 表格页 -->
<template>
  <div class="nodes-page">
    <ElCard class="art-table-card">
      <ArtTableHeader
        v-model:columns="columnChecks"
        :loading="loading"
        :show-search-bar="false"
        :layout="headerLayout"
        @search="runNodeSearch"
      >
        <template #left>
          <div class="node-toolbar">
            <ElButton v-ripple @click="openAddNodeDialog">添加节点</ElButton>
            <div class="node-toolbar__filters">
              <ElInput
                v-model="searchForm.name"
                clearable
                placeholder="请输入节点名"
                class="node-toolbar__name"
                @keyup.enter="runNodeSearch"
              />
            </div>
          </div>
        </template>
      </ArtTableHeader>

      <ArtTable
        row-key="rowKey"
        :loading="loading"
        :data="mergedData"
        :columns="columns"
        :pagination="effectivePagination"
        :pagination-options="CLUSTER_TABLE_PAGINATION_OPTIONS"
        @selection-change="handleNodeSelectionChange"
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
      @save="onNodeYamlSave"
    />

    <!-- 标签管理 -->
    <ElDialog
      v-model="labelVisible"
      title="标签管理"
      width="720px"
      destroy-on-close
      @close="resetLabelForm"
    >
      <ElAlert type="info" :closable="false" show-icon class="mb-3">
        附加到 Kubernetes 对象上的键值对，用于标识与筛选对象。
      </ElAlert>
      <div v-for="(item, index) in labelRows" :key="index" class="label-row">
        <ElInput v-model="item.key" placeholder="键" class="label-row__key" />
        <ElInput v-model="item.value" placeholder="值" class="label-row__val" />
        <ElButton text type="primary" @click="labelRows.splice(index, 1)">删除</ElButton>
      </div>
      <ElButton text type="primary" class="mt-2" @click="labelRows.push({ key: '', value: '' })"
        >+ 添加</ElButton
      >
      <template #footer>
        <ElButton @click="labelVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="labelSubmitting" @click="submitLabels">确认</ElButton>
      </template>
    </ElDialog>

    <!-- 清空节点 -->
    <ElDialog v-model="drainVisible" title="清空节点" width="520px" destroy-on-close>
      <ElAlert type="warning" :closable="false" show-icon>
        此操作将按当前后端能力与 dashboard 一致发起节点信息校验（与 dashboard drain 接口相同）。
      </ElAlert>
      <template #footer>
        <ElButton @click="drainVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="drainLoading" @click="confirmDrain">确认</ElButton>
      </template>
    </ElDialog>

    <!-- 监控 -->
    <ElDrawer v-model="monitorVisible" size="70%" destroy-on-close @closed="stopMonitorTimer">
      <template #header>
        <span class="drawer-title">资源监控</span>
      </template>
      <ElAlert type="info" :closable="false" show-icon class="mb-4"
        >查看 Node 的资源指标（与 dashboard 相同 metrics 接口）。</ElAlert
      >
      <div class="monitor-charts">
        <MetricChartPanel
          title="CPU 使用率（%）"
          :data="cpuChartData"
          :x-axis-data="cpuChartLabels"
          :is-empty="!cpuChartData.length"
          height="240px"
          plain
        />
        <MetricChartPanel
          title="内存使用量"
          :data="memChartData"
          :x-axis-data="memChartLabels"
          :is-empty="!memChartData.length"
          height="240px"
          plain
        />
      </div>
    </ElDrawer>

    <!-- 事件 -->
    <ElDrawer v-model="eventVisible" size="80%" destroy-on-close>
      <template #header>
        <span class="drawer-title">事件查询</span>
      </template>
      <ElAlert type="info" :closable="false" show-icon class="mb-4"
        >获取 Node 相关事件（与 dashboard 相同 events 接口）。</ElAlert
      >
      <div class="event-toolbar">
        <ElButton type="primary" @click="loadEventList">查询</ElButton>
        <ElButton :disabled="!eventSelection.length" @click="batchDeleteEvents">批量删除</ElButton>
      </div>
      <ElTable
        v-loading="eventLoading"
        :data="eventPageRows"
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
        />
      </div>
    </ElDrawer>

    <ElDialog
      v-model="addNodeDialogVisible"
      :title="editNodeIndex >= 0 ? '编辑节点' : '新增节点'"
      width="540px"
      align-center
      destroy-on-close
      @closed="resetAddNodeForm"
    >
      <div class="add-node-body">
        <div class="add-node-tip">
          <ElIcon class="add-node-tip__icon"><InfoFilled /></ElIcon>
          <span>Kubernetes 的节点选择，选择之后，可以根据实际情况调整。</span>
        </div>
        <ElForm
          ref="addNodeFormRef"
          :model="addNodeForm"
          :rules="addNodeRules"
          label-width="80px"
          label-position="right"
        >
          <ElFormItem label="节点名称" prop="name">
            <ElInput v-model="addNodeForm.name" placeholder="请输入节点名称" clearable />
          </ElFormItem>
          <ElFormItem label="角色" prop="roles">
            <ElCheckboxGroup v-model="addNodeForm.roles">
              <ElCheckbox value="master">master</ElCheckbox>
              <ElCheckbox value="node">node</ElCheckbox>
            </ElCheckboxGroup>
          </ElFormItem>
          <ElFormItem label="IP地址" prop="ip">
            <ElInput v-model="addNodeForm.ip" placeholder="请输入 IP 地址" clearable />
          </ElFormItem>
          <ElFormItem label="登陆方式">
            <ElRadioGroup v-model="addNodeForm.authType" class="add-node-auth-group">
              <ElRadioButton value="password">密码登陆</ElRadioButton>
              <ElRadioButton value="key">密钥登陆</ElRadioButton>
            </ElRadioGroup>
          </ElFormItem>
          <ElFormItem label="用户名">
            <span style="color: var(--el-text-color-regular)">root</span>
          </ElFormItem>
          <template v-if="addNodeForm.authType === 'password'">
            <ElFormItem label="密码" prop="password">
              <ElInput
                v-model="addNodeForm.password"
                type="password"
                placeholder="请输入密码"
                show-password
              />
            </ElFormItem>
          </template>
          <template v-else>
            <ElFormItem label="私钥" prop="privateKey">
              <ElInput
                v-model="addNodeForm.privateKey"
                type="textarea"
                :rows="5"
                placeholder="请粘贴 SSH 私钥内容（PEM 格式）"
              />
            </ElFormItem>
          </template>
        </ElForm>
      </div>
      <template #footer>
        <ElButton @click="addNodeDialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="submitAddNode">确定</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import MetricChartPanel from '@/components/container/metric-chart-panel.vue'
  import {
    ElAlert,
    ElButton,
    ElCheckbox,
    ElCheckboxGroup,
    ElDialog,
    ElDrawer,
    ElForm,
    ElFormItem,
    ElIcon,
    ElInput,
    ElLink,
    ElMessage,
    ElMessageBox,
    ElOption,
    ElPagination,
    ElPopover,
    ElRadioButton,
    ElRadioGroup,
    ElSelect,
    ElTable,
    ElTableColumn,
    ElTag
  } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'
  import ArtButtonMore, {
    type ButtonMoreItem
  } from '@/components/core/forms/art-button-more/index.vue'
  import { CopyDocument, InfoFilled } from '@element-plus/icons-vue'
  import { h, ref, computed, onUnmounted } from 'vue'
import { CLUSTER_TABLE_PAGINATION_OPTIONS } from './constants/table'
import ClusterTableEmpty from './components/cluster-table-empty.vue'
  import { useRoute, useRouter } from 'vue-router'
  import { buildClusterRouteQuery } from '@/utils/navigation/cluster-query'
  import { useTable } from '@/hooks/core/useTable'
  import {
    deleteK8sNode,
    drainK8sNodeFetch,
    fetchK8sNode,
    fetchK8sNodeList,
    patchK8sNode,
    type K8sNode
  } from '@/api/kubernetes/node'
  import { fetchClusterByName } from '@/api/container'
  import { deleteK8sEvent, fetchKubeRawEventList } from '@/api/kubernetes/events'
  import { fetchNodeUsageMetrics } from '@/api/kubernetes/metrics'
  import {
    formatContainerRuntime,
    formatKubeletVersion,
    formatNodeCreationTime,
    formatNodeInternalIp,
    formatNodeLabelLines,
    formatNodeTypeText,
    nodeStatusTagType
  } from '@/utils/kubernetes/nodeDisplay'
  import K8sYamlDialog from '@/components/kubernetes/k8s-yaml-dialog.vue'
  import { updateK8sResourceFromYaml } from '@/api/kubernetes/yamlCreate'
  import yaml from 'js-yaml'

  defineOptions({ name: 'ClusterDetailNodes' })
  const props = withDefaults(
    defineProps<{
      hideFullscreenTool?: boolean
      hideExtraColumns?: boolean
    }>(),
    {
      hideFullscreenTool: false,
      hideExtraColumns: false
    }
  )
  const hideExtraColumns = computed(() => props.hideExtraColumns)
  const headerLayout = computed(() =>
    props.hideFullscreenTool
      ? 'search,size,columns,settings'
      : 'search,size,fullscreen,columns,settings'
  )

  function formatNodeMemory(raw: string): string {
    const ki = parseInt(String(raw).replace(/[^0-9]/g, ''), 10)
    if (!ki) return raw
    if (ki >= 1024 * 1024) return `${+(ki / 1024 / 1024).toFixed(1)} Gi`
    if (ki >= 1024) return `${Math.round(ki / 1024)} Mi`
    return `${ki} Ki`
  }

  function formatNodeCpu(raw: string): string {
    if (!raw || raw === '-') return raw
    if (raw.endsWith('m')) {
      const m = parseInt(raw, 10)
      if (!isNaN(m)) return `${m} m`
      return raw
    }
    const n = Number(raw)
    if (!isNaN(n)) return `${n} 核`
    return raw
  }

  const route = useRoute()
  const router = useRouter()

  const searchForm = ref<{ name?: string }>({})

  const selectedNodeRows = ref<(K8sNode & { rowKey?: string })[]>([])

  function handleNodeSelectionChange(rows: (K8sNode & { rowKey?: string })[]) {
    selectedNodeRows.value = rows
  }

  type TableParams = { current: number; size: number; name?: string }

  function renderNodeLabelsCell(row: K8sNode) {
    const lines = formatNodeLabelLines(row)
    if (lines.length === 0) {
      return h(
        'span',
        {
          class: 'node-labels-empty',
          style: 'font-size:12px;color:var(--el-text-color-regular)'
        },
        '-'
      )
    }
    const preview = lines.slice(0, 2)
    const hasMore = lines.length > 2
    const triggerContent = h('div', { class: 'node-labels-cell-trigger' }, [
      ...preview.map((text, i) => h('div', { key: `p-${i}`, class: 'node-labels-line' }, text)),
      ...(hasMore
        ? [h('div', { key: 'more', class: 'node-labels-line node-labels-more' }, '...')]
        : [])
    ])
    const popoverBody = h(
      'div',
      { class: 'node-labels-popper-scroll' },
      lines.map((text, i) => h('div', { key: `f-${i}`, class: 'node-labels-popper-line' }, text))
    )
    return h(
      ElPopover,
      {
        placement: 'top-start',
        width: 440,
        trigger: 'hover',
        showAfter: 200,
        popperClass: 'node-labels-popper',
        teleported: true
      },
      {
        reference: () => triggerContent,
        default: () => popoverBody
      }
    )
  }

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
        if (!cluster)
          return {
            code: 200,
            data: {
              records: [] as (K8sNode & { rowKey?: string })[],
              total: 0,
              current: 1,
              size: params.size
            }
          }
        const { items, total } = await fetchK8sNodeList(cluster, {
          page: params.current,
          limit: params.size,
          name: (params.name ?? '').trim() || undefined
        })
        const list = items
        const records = list.map((n, i) => ({
          ...n,
          rowKey: n.metadata?.uid ?? n.metadata?.name ?? `node-${i}`
        }))
        return {
          code: 200,
          data: {
            records,
            total,
            current: params.current,
            size: params.size
          }
        }
      },
      apiParams: { current: 1, size: 10, name: undefined },
      columnsFactory: () => {
        const baseColumns: any[] = [
          { type: 'selection', width: 30 },
          {
            prop: 'metadata.name',
            label: '节点名称',
            minWidth: 200,
            formatter: (row: K8sNode & { rowKey?: string }) => {
              const name = row.metadata?.name ?? '-'
              const labels = row.metadata?.labels ?? {}
              const isControlPlane =
                'node-role.kubernetes.io/control-plane' in labels ||
                'node-role.kubernetes.io/master' in labels
              return h('div', { style: 'line-height:1.8' }, [
                h('div', { style: 'display:flex;align-items:center;gap:8px' }, [
                  h(
                    ElLink,
                    {
                      type: 'primary',
                      underline: 'never',
                      style: 'font-size:12px',
                      onClick: () =>
                        router.push({
                          path: '/container/node-detail',
                          query: buildClusterRouteQuery(route, { name })
                        })
                    },
                    () => name
                  ),
                  isControlPlane
                    ? h(
                        'span',
                        {
                          style:
                            'font-size:10px;padding:0 4px;line-height:16px;border-radius:3px;background:var(--el-color-success-light-9);color:var(--el-color-success);border:1px solid var(--el-color-success-light-7);flex-shrink:0'
                        },
                        '管控'
                      )
                    : null,
                  h(
                    'span',
                    {
                      class: 'icon-action',
                      title: '复制',
                      style:
                        'cursor:pointer;color:var(--el-text-color-secondary);display:inline-flex;align-items:center',
                      onClick: (e: MouseEvent) => {
                        e.stopPropagation()
                        const nm = row.metadata?.name
                        if (nm) {
                          void navigator.clipboard.writeText(nm)
                          ElMessage.success('已复制')
                        }
                      }
                    },
                    [h(CopyDocument, { style: 'width:12px;height:12px' })]
                  )
                ])
              ])
            }
          }
        ]

        const statusColumn: any = {
          prop: 'status',
          label: '状态',
          width: 100,
          formatter: (row: K8sNode) => {
            const conditions = row.status?.conditions ?? []
            const ready = conditions.find((c: any) => c.type === 'Ready')
            const isReady = ready?.status === 'True'
            const isUnschedulable = row.spec?.unschedulable
            if (isUnschedulable) {
              return h(ElTag, { type: 'warning', size: 'small' }, () => '禁止调度')
            }
            return isReady
              ? h(ElTag, { type: 'success', size: 'small' }, () => '运行中')
              : h(ElTag, { type: 'danger', size: 'small' }, () => '已停止')
          }
        }

        const compactColumns: any[] = [
          {
            prop: 'role',
            label: '角色',
            minWidth: 120,
            formatter: (row: K8sNode) => {
              const labels = row.metadata?.labels ?? {}
              const roles: string[] = []
              if (
                'node-role.kubernetes.io/control-plane' in labels ||
                'node-role.kubernetes.io/master' in labels
              ) {
                roles.push('master')
              }
              if ('node-role.kubernetes.io/node' in labels || roles.length === 0) {
                roles.push('node')
              }
              return h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }, [
                ...roles.map((r) =>
                  h(ElTag, { size: 'small', type: r === 'master' ? 'primary' : 'info' }, () => r)
                )
              ])
            }
          },
          {
            prop: 'ip',
            label: 'IP地址',
            minWidth: 150,
            formatter: (row: K8sNode) => {
              const internalIp =
                row.status?.addresses?.find((a) => a.type === 'InternalIP')?.address ?? '-'
              return h('span', internalIp)
            }
          },
          {
            prop: 'authType',
            label: '认证方式',
            minWidth: 100,
            formatter: () => '-'
          }
        ]

        const extraColumns: any[] = [
          {
            prop: 'runtime',
            label: '运行时',
            minWidth: 160,
            showOverflowTooltip: true,
            formatter: (row: K8sNode) =>
              h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, formatContainerRuntime(row))
          },
          {
            prop: 'os',
            label: '操作系统',
            minWidth: 160,
            showOverflowTooltip: true,
            formatter: (row: K8sNode) => {
              const os = row.status?.nodeInfo?.osImage ?? '-'
              return h('span', { style: 'font-size:12px;color:var(--el-text-color-regular)' }, os)
            }
          },
          {
            prop: 'resource',
            label: '节点规格',
            minWidth: 140,
            formatter: (row: K8sNode) => {
              const cpuRaw = row.status?.allocatable?.cpu ?? row.status?.capacity?.cpu ?? '-'
              const cpu = formatNodeCpu(cpuRaw)
              const memRaw = row.status?.allocatable?.memory ?? row.status?.capacity?.memory ?? ''
              const mem = memRaw ? formatNodeMemory(memRaw) : '-'
              const s = 'font-size:11px;white-space:nowrap'
              return h('div', { style: 'line-height:1.8' }, [
                h('div', { style: s }, `CPU: ${cpu}`),
                h('div', { style: s }, `内存: ${mem}`)
              ])
            }
          },
          {
            prop: 'metadata.labels',
            label: 'Labels',
            minWidth: 160,
            formatter: (row: K8sNode) => renderNodeLabelsCell(row)
          }
        ]

        const createdColumn = {
          prop: 'created',
          label: '创建时间',
          width: 168,
          formatter: (row: K8sNode) =>
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-text-color-regular)' },
              formatNodeCreationTime(row.metadata?.creationTimestamp)
            )
        }

        const tailColumns: any[] = [
          ...(hideExtraColumns.value ? [] : [createdColumn]),
          {
            prop: 'operation',
            label: '操作',
            width: 180,
            fixed: 'right',
            formatter: (row: any) => {
              if (row._local) {
                return h('div', { style: 'display:flex;align-items:center;gap:12px' }, [
                  h(
                    ElLink,
                    {
                      type: 'primary',
                      underline: 'never',
                      style: 'font-size:12px',
                      onClick: () => openEditNodeDialog(row._localIndex)
                    },
                    () => '编辑'
                  ),
                  h(
                    ElLink,
                    {
                      type: 'danger',
                      underline: 'never',
                      style: 'font-size:12px',
                      onClick: () => deleteLocalNode(row._localIndex)
                    },
                    () => '删除'
                  )
                ])
              }
              return h(
                'div',
                { style: 'display:flex;align-items:center;gap:12px;flex-wrap:nowrap' },
                [
                  h(
                    ElLink,
                    {
                      type: 'primary',
                      underline: 'never',
                      style: 'font-size:12px',
                      onClick: () => nodeMoreClick({ key: 'labels', label: '' }, row)
                    },
                    () => '标签管理'
                  ),
                  h(
                    ElLink,
                    {
                      type: 'primary',
                      underline: 'never',
                      style: 'font-size:12px',
                      onClick: () => nodeMoreClick({ key: 'schedule', label: '' }, row)
                    },
                    () => (row.spec?.unschedulable ? '开启调度' : '禁止调度')
                  ),
                  h(ArtButtonMore, {
                    list: [
                      { key: 'yaml', label: '查看YAML', icon: 'ri:file-code-line' },
                      { key: 'drain', label: '清空节点', icon: 'ri:logout-box-r-line' },
                      {
                        key: 'delete',
                        label: '删除',
                        icon: 'ri:delete-bin-4-line',
                        color: '#409eff'
                      }
                    ],
                    onClick: (item: ButtonMoreItem) => nodeMoreClick(item, row)
                  })
                ]
              )
            }
          }
        ]

        return [
          ...baseColumns,
          statusColumn,
          ...(hideExtraColumns.value ? compactColumns : extraColumns),
          ...tailColumns
        ]
      }
    }
  })

  function runNodeSearch() {
    const raw = searchForm.value
    const name = (raw.name ?? '').trim() || undefined
    replaceSearchParams({ name })
    getData()
  }

  function onRefresh() {
    refreshData()
  }

  // -- YAML --
  const addNodeDialogVisible = ref(false)
  const editNodeIndex = ref(-1)

  interface LocalNode {
    name: string
    roles: string[]
    ip: string
    authType: string
    user: string
    password: string
    privateKey: string
  }

  const localNodes = ref<LocalNode[]>([])

  // pagination 是 readonly，不能直接修改 total；用 computed 合并本地节点数量
  const effectivePagination = computed(() => ({
    ...pagination,
    total: pagination.total + localNodes.value.length
  }))

  const mergedData = computed(() => [
    ...localNodes.value.map((n, i) => ({
      ...n,
      _local: true,
      _localIndex: i,
      rowKey: `local-${i}-${n.name}`
    })),
    ...data.value
  ])

  const addNodeFormRef = ref<FormInstance>()
  const addNodeForm = ref<LocalNode>({
    name: '',
    roles: ['master'],
    ip: '',
    authType: 'password',
    user: 'root',
    password: '',
    privateKey: ''
  })

  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/
  const addNodeRules: FormRules = {
    name: [{ required: true, message: '请输入节点名称', trigger: 'blur' }],
    roles: [
      {
        validator: (_r: any, val: string[], cb: any) => {
          val && val.length > 0 ? cb() : cb(new Error('请至少选择一个角色'))
        },
        trigger: 'change'
      }
    ],
    ip: [
      { required: true, message: '请输入 IP 地址', trigger: 'blur' },
      {
        validator: (_r: any, val: string, cb: any) => {
          ipPattern.test(val) ? cb() : cb(new Error('请输入有效的 IP 地址'))
        },
        trigger: 'blur'
      }
    ],
    password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
    privateKey: [{ required: true, message: '请粘贴私钥内容', trigger: 'blur' }]
  }

  async function openAddNodeDialog() {
    const clusterName = String(route.query.cluster ?? '').trim()
    if (!clusterName) {
      ElMessage.warning('未获取到集群信息')
      return
    }

    try {
      const cluster = await fetchClusterByName(clusterName)
      const clusterType = cluster?.clusterType

      if (clusterType === 0) {
        ElMessage.warning('非自建集群不支持添加节点')
        return
      }

      if (clusterType === 1) {
        ElMessage.info('功能开发中，敬请期待')
        return
      }

      ElMessage.warning('未识别的集群类型，暂不支持添加节点')
    } catch (error) {
      console.error('[Nodes] 获取集群类型失败:', error)
      ElMessage.error('获取集群类型失败，请稍后重试')
    }
  }

  function openEditNodeDialog(index: number) {
    editNodeIndex.value = index
    const node = localNodes.value[index]
    addNodeForm.value = { ...node }
    addNodeDialogVisible.value = true
  }

  function deleteLocalNode(index: number) {
    localNodes.value.splice(index, 1)
  }

  function resetAddNodeForm() {
    addNodeForm.value = {
      name: '',
      roles: ['master'],
      ip: '',
      authType: 'password',
      user: 'root',
      password: '',
      privateKey: ''
    }
    addNodeFormRef.value?.clearValidate()
  }

  async function submitAddNode() {
    const valid = await addNodeFormRef.value
      ?.validate()
      .then(() => true)
      .catch(() => false)
    if (!valid) return
    const node: LocalNode = { ...addNodeForm.value }
    if (editNodeIndex.value >= 0) {
      localNodes.value.splice(editNodeIndex.value, 1, node)
    } else {
      localNodes.value.push(node)
    }
    addNodeDialogVisible.value = false
  }

  const yamlVisible = ref(false)
  const yamlText = ref('')
  const yamlSaving = ref(false)

  async function viewYaml(row: K8sNode) {
    const cluster = String(route.query.cluster ?? '')
    try {
      const node = await fetchK8sNode(cluster, row.metadata!.name)
      yamlText.value = yaml.dump(node, { quotingType: '"' })
      yamlVisible.value = true
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '加载失败')
    }
  }

  function onNodeYamlSave(text: string) {
    yamlText.value = text
    void saveNodeYaml()
  }

  async function saveNodeYaml() {
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

  // -- 标签 --
  const labelVisible = ref(false)
  const labelNodeName = ref('')
  const labelRows = ref<{ key: string; value: string }[]>([])
  const labelSubmitting = ref(false)

  function resetLabelForm() {
    labelNodeName.value = ''
    labelRows.value = []
  }

  async function openLabelDialog(row: K8sNode) {
    const cluster = String(route.query.cluster ?? '')
    const name = row.metadata!.name
    labelNodeName.value = name
    try {
      const node = await fetchK8sNode(cluster, name)
      const labels = node.metadata?.labels ?? {}
      labelRows.value = Object.keys(labels).map((k) => ({ key: k, value: String(labels[k] ?? '') }))
      if (labelRows.value.length === 0) labelRows.value.push({ key: '', value: '' })
      labelVisible.value = true
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '加载失败')
    }
  }

  async function submitLabels() {
    const cluster = String(route.query.cluster ?? '')
    const name = labelNodeName.value
    labelSubmitting.value = true
    try {
      const node = await fetchK8sNode(cluster, name)
      const newLabels: Record<string, string | null> = {}
      for (const item of labelRows.value) {
        if (item.key.trim()) newLabels[item.key.trim()] = item.value
      }
      const oldLabels = node.metadata?.labels ?? {}
      for (const key of Object.keys(oldLabels)) {
        if (!(key in newLabels)) newLabels[key] = null
      }
      await patchK8sNode(cluster, name, { metadata: { labels: newLabels } })
      ElMessage.success('已更新')
      labelVisible.value = false
      onRefresh()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '更新失败')
    } finally {
      labelSubmitting.value = false
    }
  }

  // -- 调度 --
  async function toggleSchedule(row: K8sNode) {
    const cluster = String(route.query.cluster ?? '')
    const name = row.metadata!.name
    try {
      await patchK8sNode(cluster, name, {
        spec: { unschedulable: !row.spec?.unschedulable }
      })
      ElMessage.success('已更新')
      onRefresh()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '操作失败')
    }
  }

  // -- 清空节点（dashboard：GET node） --
  const drainVisible = ref(false)
  const drainName = ref('')
  const drainLoading = ref(false)

  function openDrain(row: K8sNode) {
    drainName.value = row.metadata!.name
    drainVisible.value = true
  }

  async function confirmDrain() {
    const cluster = String(route.query.cluster ?? '')
    drainLoading.value = true
    try {
      await drainK8sNodeFetch(cluster, drainName.value)
      ElMessage.success('已请求')
      drainVisible.value = false
      onRefresh()
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '操作失败')
    } finally {
      drainLoading.value = false
    }
  }

  // -- 删除节点 --
  async function deleteNode(row: K8sNode) {
    const name = row.metadata!.name
    try {
      await ElMessageBox.confirm(`确定删除节点「${name}」吗？此操作不可恢复。`, '删除节点', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
      const cluster = String(route.query.cluster ?? '')
      await deleteK8sNode(cluster, name)
      ElMessage.success('已删除')
      onRefresh()
    } catch (e: unknown) {
      if (e === 'cancel') return
      ElMessage.error(e instanceof Error ? e.message : '删除失败')
    }
  }

  function nodeMoreClick(item: ButtonMoreItem, row: K8sNode) {
    switch (item.key) {
      case 'yaml':
        void viewYaml(row)
        break
      case 'labels':
        void openLabelDialog(row)
        break
      case 'schedule':
        void toggleSchedule(row)
        break
      case 'drain':
        openDrain(row)
        break
      case 'delete':
        void deleteNode(row)
        break
    }
  }

  // -- 监控 --
  const monitorVisible = ref(false)
  let monitorTimer: ReturnType<typeof setInterval> | null = null
  const monitorNode = ref<K8sNode | null>(null)
  const cpuChartData = ref<number[]>([])
  const cpuChartLabels = ref<string[]>([])
  const memChartData = ref<number[]>([])
  const memChartLabels = ref<string[]>([])

  function parseCpuPoints(
    points: Array<{ timestamp: string; value: number }> | undefined,
    totalMillicores: number
  ) {
    if (!points?.length || !totalMillicores) return { labels: [] as string[], data: [] as number[] }
    const labels: string[] = []
    const data: number[] = []
    for (const p of points) {
      const d = new Date(p.timestamp)
      labels.push(
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
      )
      data.push(Number(((p.value / totalMillicores) * 100).toFixed(2)))
    }
    return { labels, data }
  }

  function parseMemPoints(points: Array<{ timestamp: string; value: number }> | undefined) {
    if (!points?.length) return { labels: [] as string[], data: [] as number[] }
    const labels: string[] = []
    const data: number[] = []
    for (const p of points) {
      const d = new Date(p.timestamp)
      labels.push(
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
      )
      data.push(p.value)
    }
    return { labels, data }
  }

  async function loadMonitorCharts(row: K8sNode) {
    const cluster = String(route.query.cluster ?? '')
    const nodeName = row.metadata!.name
    const cpuStr = row.status?.capacity?.cpu ?? '1'
    const totalCpuMillic = cpuStr.endsWith('m') ? parseInt(cpuStr, 10) : parseInt(cpuStr, 10) * 1000
    const memStr = row.status?.capacity?.memory ?? '0'
    const totalMemKi = parseInt(String(memStr).replace(/[^0-9]/g, ''), 10) || 1

    try {
      const cpuRes = await fetchNodeUsageMetrics(cluster, nodeName, 'cpu', 'usage')
      const pts = cpuRes.items?.[0]?.metricPoints
      const c = parseCpuPoints(pts, totalCpuMillic || 1000)
      cpuChartLabels.value = c.labels
      cpuChartData.value = c.data
    } catch {
      cpuChartLabels.value = []
      cpuChartData.value = []
    }

    try {
      const memRes = await fetchNodeUsageMetrics(cluster, nodeName, 'memory', 'usage')
      const pts = memRes.items?.[0]?.metricPoints
      const m = parseMemPoints(pts)
      memChartLabels.value = m.labels
      memChartData.value = m.data.map((v) => v / 1024 / 1024)
    } catch {
      memChartLabels.value = []
      memChartData.value = []
    }
    void totalMemKi
  }

  async function openMonitor(row: K8sNode) {
    monitorNode.value = row
    monitorVisible.value = true
    await loadMonitorCharts(row)
    stopMonitorTimer()
    monitorTimer = setInterval(() => {
      if (monitorNode.value) void loadMonitorCharts(monitorNode.value)
    }, 3000)
  }

  function stopMonitorTimer() {
    if (monitorTimer) {
      clearInterval(monitorTimer)
      monitorTimer = null
    }
  }

  onUnmounted(stopMonitorTimer)

  // -- 事件 --
  interface K8sEventRow {
    metadata?: { name?: string; namespace?: string; uid?: string }
    lastTimestamp?: string
    type?: string
    involvedObject?: { kind?: string; name?: string }
    count?: number
    message?: string
  }

  const eventVisible = ref(false)
  const eventNode = ref<K8sNode | null>(null)
  const eventLoading = ref(false)
  const eventAll = ref<K8sEventRow[]>([])
  const eventPage = ref(1)
  const eventPageSize = ref(10)
  const eventSelection = ref<K8sEventRow[]>([])

  function onEventSelectionChange(rows: K8sEventRow[]) {
    eventSelection.value = rows
  }

  const eventTotal = computed(() => eventAll.value.length)
  const eventPageRows = computed(() => {
    const start = (eventPage.value - 1) * eventPageSize.value
    return eventAll.value.slice(start, start + eventPageSize.value)
  })

  async function openEvents(row: K8sNode) {
    eventNode.value = row
    eventVisible.value = true
    eventPage.value = 1
    eventAll.value = []
    await loadEventList()
  }

  async function loadEventList() {
    const cluster = String(route.query.cluster ?? '')
    const row = eventNode.value
    if (!row?.metadata?.name) return
    eventLoading.value = true
    try {
      const items = await fetchKubeRawEventList(cluster, {
        uid: row.metadata.uid ?? '',
        namespace: '',
        name: row.metadata.name,
        kind: 'Node',
        namespaced: false,
        limit: 500
      })
      eventAll.value = items as unknown as K8sEventRow[]
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '加载事件失败')
      eventAll.value = []
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
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '删除失败')
    }
  }
</script>

<style scoped>
  .node-name-cell {
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
  }

  .node-toolbar {
    display: flex;
    width: 100%;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .node-toolbar__filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }

  /* 右上第一个工具按钮（搜索）与左侧筛选区拉开距离 */
  .nodes-page :deep(#art-table-header > .flex-c > .button:first-child) {
    margin-left: 8px !important;
  }

  /* 整体表头上移，左右图标一起对齐 */
  .nodes-page :deep(#art-table-header) {
    margin-top: 0px;
  }

  .node-toolbar__name {
    width: 250px;
    max-width: 100%;
  }

  .label-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }

  .label-row__key {
    flex: 1;
    max-width: 300px;
  }

  .label-row__val {
    flex: 1;
    max-width: 300px;
  }

  .drawer-title {
    font-size: 16px;
    font-weight: 600;
  }

  .monitor-charts {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .monitor-chart-title {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--el-text-color-primary);
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

  .mb-3 {
    margin-bottom: 12px;
  }

  .mb-4 {
    margin-bottom: 16px;
  }

  .mt-2 {
    margin-top: 8px;
  }

  .mt-3 {
    margin-top: 12px;
  }
</style>

<!-- 与集群列表名称列一致：复制图标默认隐藏，鼠标悬停在该行时显示（需穿透表格单元格渲染） -->
<style>
  .nodes-page .icon-action {
    opacity: 0;
    transition: opacity 0.15s;
  }

  .nodes-page .el-table__row:hover .icon-action {
    opacity: 1;
  }

  .nodes-page .art-table .el-table {
    font-size: 13px;
  }

  .nodes-page .art-table .el-table th.el-table__cell {
    font-size: 13px;
  }

  .nodes-page .node-labels-cell-trigger {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    cursor: default;
  }

  .nodes-page .node-labels-line {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    font-size: 12px;
    line-height: 1.5;
    color: var(--el-text-color-regular);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .nodes-page .node-labels-more {
    color: var(--el-text-color-placeholder);
  }
</style>

<!-- Labels 列 Popover 挂载到 body，需非 scoped -->
<style lang="css">
  .node-labels-popper.el-popover {
    max-width: min(440px, 90vw);
    padding: 8px 12px;
    box-sizing: border-box;
  }

  .node-labels-popper .node-labels-popper-scroll {
    max-height: min(360px, 50vh);
    overflow-x: hidden;
    overflow-y: auto;
  }

  .node-labels-popper .node-labels-popper-line {
    padding: 2px 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--el-text-color-regular);
    word-break: break-all;
  }
</style>

<style scoped>
  .add-node-body {
    padding: 0 16px;
  }

  .add-node-tip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    margin-top: -20px;
    margin-bottom: 20px;
    background-color: var(--el-color-primary-light-9);
    border-radius: 6px;
    font-size: 13px;
    color: var(--el-color-primary);
    line-height: 1.5;
  }

  .add-node-tip__icon {
    flex-shrink: 0;
    font-size: 16px;
    color: var(--el-color-primary);
  }

  .add-node-auth-group {
    display: flex;
    gap: 0;
  }
</style>

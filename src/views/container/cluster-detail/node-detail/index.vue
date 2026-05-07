<template>
  <div class="nd">
    <ElCard class="nd-card nd-card--overview" v-loading="loading">
      <div class="nd-hd">
        <ElButton :icon="ArrowLeft" text @click="goBack">返回</ElButton>
        <el-divider direction="vertical" class="nd-vdv nd-vdv--cluster" />
        <span class="nd-title">
          <span class="nd-title__kind">资源类型:</span>
          <span class="nd-title__value">Node</span>
        </span>
        <ElTag :type="statusTagType" effect="light" class="nd-title-status">
          {{ statusText }}
        </ElTag>
        <el-divider direction="vertical" class="nd-vdv" />
        <div class="nd-cluster-wrap">
          <span class="nd-cluster-label">集群:</span>
          <span class="nd-cluster-value">{{ clusterAlias }}</span>
        </div>
        <div class="nd-hd-actions">
          <ElButton v-ripple @click="openSshLoginDialog">远程登录</ElButton>
          <ElButton v-ripple @click="yamlVisible = true">查看YAML</ElButton>
          <ArtButtonMore
            :list="[
              { key: 'labels', label: '标签管理', icon: 'ri:price-tag-3-line' },
              {
                key: 'schedule',
                label: node?.spec?.unschedulable ? '开启调度' : '禁止调度',
                icon: 'ri:compass-3-line'
              },
              { key: 'delete', label: '删除', icon: 'ri:delete-bin-4-line', color: '#f56c6c' }
            ]"
            @click="onMoreClick"
          />
        </div>
      </div>

      <div class="nd-section-title">基本信息</div>
      <template v-if="!loading && node">
        <div class="nd-info-grid">
          <div class="nd-info-cell">
            <span class="nd-k">节点名称</span>
            <span class="nd-v nd-v--with-tag">
              <span>{{ node.metadata.name }}</span>
              <ElTag size="small" :type="nodeTypeTagType" effect="light">{{ nodeTypeTagText }}</ElTag>
            </span>
          </div>
          <div class="nd-info-cell"><span class="nd-k">操作系统</span><span class="nd-v">{{ node.status?.nodeInfo?.osImage || '—' }}</span></div>
          <div class="nd-info-cell"><span class="nd-k">创建时间</span><span class="nd-v">{{ formatNodeCreationTime(node.metadata.creationTimestamp) }}</span></div>
          <div class="nd-info-cell"><span class="nd-k">运行状态</span><span class="nd-v">{{ runningStatusText }}</span></div>
          <div class="nd-info-cell"><span class="nd-k">容器运行时</span><span class="nd-v">{{ formatContainerRuntime(node) }}</span></div>
          <div class="nd-info-cell"><span class="nd-k">kubelet版本</span><span class="nd-v">{{ formatKubeletVersion(node) }}</span></div>
          <div class="nd-info-cell"><span class="nd-k">PodCIDRs</span><span class="nd-v">{{ podCidrsText }}</span></div>
          <div class="nd-info-cell"><span class="nd-k">内核版本</span><span class="nd-v">{{ kernelVersionText }}</span></div>
          <div class="nd-info-cell"><span class="nd-k">IP地址</span><span class="nd-v">{{ formatNodeInternalIp(node) }}</span></div>
          <div class="nd-info-cell">
            <span class="nd-k">标签</span>
            <div class="nd-tag-group">
              <template v-if="visibleLabelEntries.length">
                <el-tag
                  v-for="item in visibleLabelEntries"
                  :key="item.key"
                  size="small"
                  type="primary"
                  effect="plain"
                  class="nd-mono-tag"
                >
                  {{ item.key }}:{{ item.value }}
                </el-tag>
                <el-button
                  v-if="hasMoreLabels"
                  link
                  type="primary"
                  class="nd-more-btn"
                  @click="showAllLabels = !showAllLabels"
                >
                  {{ showAllLabels ? '收起' : '更多' }}
                </el-button>
              </template>
              <span v-else class="nd-empty">—</span>
            </div>
          </div>
          <div class="nd-info-cell">
            <span class="nd-k">注释</span>
            <div class="nd-tag-group">
              <template v-if="visibleAnnotationEntries.length">
                <el-tag
                  v-for="item in visibleAnnotationEntries"
                  :key="item.key"
                  size="small"
                  type="primary"
                  effect="plain"
                  class="nd-mono-tag"
                >
                  {{ item.key }}:{{ item.value }}
                </el-tag>
                <el-button
                  v-if="hasMoreAnnotations"
                  link
                  type="primary"
                  class="nd-more-btn"
                  @click="showAllAnnotations = !showAllAnnotations"
                >
                  {{ showAllAnnotations ? '收起' : '更多' }}
                </el-button>
              </template>
              <span v-else class="nd-empty">—</span>
            </div>
          </div>
        </div>
      </template>
    </ElCard>

    <div class="nd-workloads-copy">
      <ClusterDetailWorkloads
        deploy-tab-label="容器组"
        deploy-data-mode="pod"
        :deploy-node-name="name"
        :show-deploy-create="false"
        sts-tab-label="访问方式"
        ds-tab-label="日志"
        job-tab-label="事件"
        cj-tab-label="版本记录"
        :show-sts-tab="false"
        :show-ds-tab="false"
        :show-cj-tab="false"
        :show-node-status-tab="true"
        :show-node-resource-tab="true"
        :show-node-metrics-tab="true"
        sts-data-mode="services"
        ds-data-mode="logs"
        job-data-mode="events"
        cj-data-mode="history"
        :mirror-resource-name="name"
        mirror-event-kind="Node"
        :mirror-event-namespaced="false"
        :node-status-rows="conditionRows"
        :node-resource="nodeResource"
        :node-resource-rows="nodeResourceRows"
        :node-metrics="nodeMetrics"
      />
    </div>

    <!-- SSH 登录凭证对话框 -->
    <ElDialog v-model="sshLoginVisible" title="节点远程登录" width="440px" destroy-on-close @close="resetSshLogin">
      <ElAlert
        type="info"
        :closable="false"
        show-icon
        class="nd-ssh-alert"
        description="通过 SSH 连接到节点宿主机，执行命令操作。"
      />
      <ElForm :model="sshForm" label-width="80px" class="nd-ssh-form">
        <ElFormItem label="主机地址">
          <ElInput v-model="sshForm.host" placeholder="节点 IP" />
        </ElFormItem>
        <ElFormItem label="端口">
          <ElInput v-model.number="sshForm.port" placeholder="22" type="number" />
        </ElFormItem>
        <ElFormItem label="用户名">
          <ElInput v-model="sshForm.user" placeholder="root" />
        </ElFormItem>
        <ElFormItem label="密码">
          <ElInput v-model="sshForm.password" type="password" show-password placeholder="请输入密码" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="sshLoginVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="sshConnecting" @click="confirmSshLogin">连接</ElButton>
      </template>
    </ElDialog>

    <!-- SSH 终端抽屉 -->
    <ElDrawer
      v-model="sshDrawerVisible"
      title="节点远程登录"
      direction="rtl"
      :size="sshDrawerFullscreen ? '100%' : '60%'"
      destroy-on-close
      :show-close="false"
      :trap-focus="false"
      class="nd-ssh-drawer"
    >
      <template #header>
        <div class="nd-ssh-drawer-header-inner">
          <span class="nd-ssh-drawer-title">
            节点远程登录 —
            <span class="nd-ssh-drawer-host">{{ sshForm.user }}@{{ sshForm.host }}:{{ sshForm.port }}</span>
          </span>
          <div class="nd-ssh-header-toolbar">
            <button
              type="button"
              tabindex="-1"
              class="nd-ssh-header-icon-btn"
              title="重新连接"
              :disabled="sshConnecting"
              @click.stop="reconnectSsh"
              @keydown.enter.prevent.stop
              @keydown.space.prevent.stop
            >
              <ElIcon :size="20">
                <Refresh />
              </ElIcon>
            </button>
            <button
              type="button"
              tabindex="-1"
              class="nd-ssh-header-icon-btn"
              :title="sshDrawerFullscreen ? '退出全屏' : '全屏'"
              @click.stop="sshDrawerFullscreen = !sshDrawerFullscreen"
              @keydown.enter.prevent.stop
              @keydown.space.prevent.stop
            >
              <ElIcon :size="20">
                <ScaleToOriginal v-if="sshDrawerFullscreen" />
                <FullScreen v-else />
              </ElIcon>
            </button>
            <button
              type="button"
              tabindex="-1"
              class="nd-ssh-header-icon-btn"
              title="关闭"
              @click.stop="dismissSshDrawer"
              @keydown.enter.prevent.stop
              @keydown.space.prevent.stop
            >
              <ElIcon :size="20">
                <Close />
              </ElIcon>
            </button>
          </div>
        </div>
      </template>
      <div class="nd-ssh-terminal-wrap">
        <div ref="sshXtermHostRef" class="nd-ssh-xterm-host" tabindex="-1" @click="focusTerm" />
      </div>
    </ElDrawer>

    <ElDialog v-model="yamlVisible" title="查看 YAML" width="760px">
      <ElInput v-model="yamlText" type="textarea" :rows="24" readonly />
      <template #footer>
        <ElButton @click="yamlVisible = false">关闭</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="labelVisible" title="标签管理" width="720px" @close="resetLabelForm">
      <div v-for="(item, index) in labelRows" :key="index" class="label-row">
        <ElInput v-model="item.key" placeholder="键" class="label-row__key" />
        <ElInput v-model="item.value" placeholder="值" class="label-row__val" />
        <ElButton text type="danger" @click="labelRows.splice(index, 1)">删除</ElButton>
      </div>
      <ElButton text type="primary" class="mt-2" @click="labelRows.push({ key: '', value: '' })"
        >+ 添加</ElButton
      >
      <template #footer>
        <ElButton @click="labelVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="labelSubmitting" @click="submitLabels">确认</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ArrowLeft, Close, FullScreen, Refresh, ScaleToOriginal } from '@element-plus/icons-vue'
  import { ElIcon, ElInput, ElMessage, ElMessageBox, ElTag } from 'element-plus'
  import { computed, inject, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import YAML from 'js-yaml'
  import ArtButtonMore, { type ButtonMoreItem } from '@/components/core/forms/art-button-more/index.vue'
  import ClusterDetailWorkloads from '../workloads.vue'
  import { clusterDetailContextKey } from '../context'
  import {
    fetchK8sNode,
    patchK8sNode,
    deleteK8sNode,
    type K8sNode
  } from '@/api/kubernetes/node'
  import { fetchNodeUsageMetrics } from '@/api/kubernetes/metrics'
  import { kubeProxyAxios } from '@/api/kubeProxy'
  import { resolvePixiuWsOrigin } from '@/utils/pixiu-ws-origin'
  import { FitAddon } from '@xterm/addon-fit'
  import { Terminal, type ITheme } from '@xterm/xterm'
  import '@xterm/xterm/css/xterm.css'
  import {
    formatContainerRuntime,
    formatKubeletVersion,
    formatNodeCreationTime,
    formatNodeInternalIp,
    formatNodeStatusText,
    nodeStatusTagType
  } from '@/utils/kubernetes/nodeDisplay'

  const route = useRoute()
  const router = useRouter()
  const cluster = computed(() => String(route.query.cluster ?? ''))
  const name = computed(() => String(route.query.name ?? ''))
  const clusterDetailCtx = inject(clusterDetailContextKey, undefined)
  const clusterAlias = computed(() => clusterDetailCtx?.value?.aliasName || cluster.value)

  const loading = ref(true)
  const node = ref<K8sNode | null>(null)
  const statusText = computed(() => (node.value ? formatNodeStatusText(node.value) : '未知'))
  const statusTagType = computed(() => nodeStatusTagType(statusText.value))
  const runningStatusText = computed(() => {
    if (!node.value?.status?.conditions?.length) return 'Unknown'
    const ready = node.value.status.conditions.find((c) => c.type === 'Ready')
    if (!ready) return 'Unknown'
    return ready.status === 'True' ? 'Running' : 'NotReady'
  })
  const podCidrsText = computed(() => {
    const values = node.value?.spec?.podCIDRs?.filter(Boolean) ?? []
    if (values.length) return values.join(', ')
    return node.value?.spec?.podCIDR || '—'
  })
  const kernelVersionText = computed(() => node.value?.status?.nodeInfo?.kernelVersion || '—')
  const nodeRole = computed(() => {
    const labels = node.value?.metadata?.labels ?? {}
    if ('node-role.kubernetes.io/control-plane' in labels || 'node-role.kubernetes.io/master' in labels)
      return '管控'
    return '工作节点'
  })
  const nodeTypeTagText = computed(() => (nodeRole.value === '管控' ? '管控节点' : '工作节点'))
  const nodeTypeTagType = computed(() => (nodeRole.value === '管控' ? 'danger' : 'success'))
  const showAllLabels = ref(false)
  const showAllAnnotations = ref(false)
  const labelEntries = computed(() =>
    Object.entries((node.value?.metadata?.labels ?? {}) as Record<string, string>).map(
      ([key, value]) => ({ key, value })
    )
  )
  const annotationEntries = computed(() =>
    Object.entries((node.value?.metadata?.annotations ?? {}) as Record<string, string>).map(
      ([key, value]) => ({ key, value })
    )
  )
  const hasMoreLabels = computed(() => labelEntries.value.length > 3)
  const hasMoreAnnotations = computed(() => annotationEntries.value.length > 3)
  const visibleLabelEntries = computed(() =>
    showAllLabels.value || !hasMoreLabels.value ? labelEntries.value : labelEntries.value.slice(0, 2)
  )
  const visibleAnnotationEntries = computed(() =>
    showAllAnnotations.value || !hasMoreAnnotations.value
      ? annotationEntries.value
      : annotationEntries.value.slice(0, 2)
  )

  const yamlVisible = ref(false)
  const yamlText = ref('')
  const labelVisible = ref(false)
  const labelRows = ref<{ key: string; value: string }[]>([])
  const labelSubmitting = ref(false)
  const metricsLoading = ref(false)
  const cpuUsageMillicores = ref(0)
  const memoryUsageBytes = ref(0)
  const allocatedResourceMap = ref<Record<string, { req: number; lim: number; total: number }>>({})

  const conditionRows = computed(() => {
    const rows = (node.value?.status?.conditions ?? []) as Array<{
      type?: string
      status?: string
      lastHeartbeatTime?: string
      lastTransitionTime?: string
      reason?: string
      message?: string
    }>
    return rows.map((r) => ({
      type: r.type || '—',
      status: r.status || '—',
      lastHeartbeatTime: formatDateTime(r.lastHeartbeatTime),
      lastTransitionTime: formatDateTime(r.lastTransitionTime),
      reason: r.reason || '—',
      message: r.message || '—'
    }))
  })

  function formatDateTime(ts?: string): string {
    if (!ts) return '—'
    const d = new Date(ts)
    if (Number.isNaN(d.getTime())) return ts
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  function parseCpuToMillicores(raw: string): number {
    if (!raw) return 0
    if (raw.endsWith('n')) return Math.round(parseFloat(raw) / 1000000)
    if (raw.endsWith('u')) return Math.round(parseFloat(raw) / 1000)
    if (raw.endsWith('m')) return Math.round(parseFloat(raw))
    const n = Number(raw)
    return Number.isFinite(n) ? Math.round(n * 1000) : 0
  }

  function parseMemoryToBytes(raw: string): number {
    if (!raw) return 0
    const m = String(raw).match(/^([\d.]+)([a-zA-Z]+)?$/)
    if (!m) return 0
    const n = parseFloat(m[1] || '0')
    const u = (m[2] || '').toLowerCase()
    const map: Record<string, number> = {
      ki: 1024,
      mi: 1024 ** 2,
      gi: 1024 ** 3,
      ti: 1024 ** 4,
      pi: 1024 ** 5,
      k: 1000,
      m: 1000 ** 2,
      g: 1000 ** 3,
      t: 1000 ** 4
    }
    return Math.round(n * (map[u] || 1))
  }

  function formatMillicores(v: number): string {
    if (!v) return '0m'
    return v >= 1000 ? `${(v / 1000).toFixed(2)} Core` : `${v}m`
  }

  function formatBytes(v: number): string {
    if (!v) return '0 B'
    if (v >= 1024 ** 3) return `${(v / 1024 ** 3).toFixed(2)} Gi`
    if (v >= 1024 ** 2) return `${(v / 1024 ** 2).toFixed(2)} Mi`
    if (v >= 1024) return `${(v / 1024).toFixed(2)} Ki`
    return `${v} B`
  }

  const cpuAllocatableMillicores = computed(() =>
    parseCpuToMillicores(String(node.value?.status?.allocatable?.cpu ?? '0'))
  )
  const memoryAllocatableBytes = computed(() =>
    parseMemoryToBytes(String(node.value?.status?.allocatable?.memory ?? '0'))
  )
  const cpuUsagePercent = computed(() => {
    const total = cpuAllocatableMillicores.value
    if (!total) return 0
    return Math.min(100, Number(((cpuUsageMillicores.value / total) * 100).toFixed(2)))
  })
  const memoryUsagePercent = computed(() => {
    const total = memoryAllocatableBytes.value
    if (!total) return 0
    return Math.min(100, Number(((memoryUsageBytes.value / total) * 100).toFixed(2)))
  })
  const cpuUsageText = computed(() => formatMillicores(cpuUsageMillicores.value))
  const memoryUsageText = computed(() => formatBytes(memoryUsageBytes.value))
  const cpuUsageAllocText = computed(
    () =>
      `${formatMillicores(cpuUsageMillicores.value)} / ${formatMillicores(
        cpuAllocatableMillicores.value
      )} (${cpuUsagePercent.value}%)`
  )
  const memoryUsageAllocText = computed(
    () =>
      `${formatBytes(memoryUsageBytes.value)} / ${formatBytes(memoryAllocatableBytes.value)} (${memoryUsagePercent.value}%)`
  )
  const nodeResource = computed(() => ({
    cpuPercent: cpuUsagePercent.value,
    memoryPercent: memoryUsagePercent.value,
    cpuRequested: formatMillicores(cpuUsageMillicores.value),
    cpuTotal: formatMillicores(cpuAllocatableMillicores.value),
    memoryRequested: formatBytes(memoryUsageBytes.value),
    memoryTotal: formatBytes(memoryAllocatableBytes.value)
  }))
  const nodeResourceRows = computed(() => {
    const map = allocatedResourceMap.value
    return [
      { key: 'cpu', name: 'cpu', formatter: formatMillicores },
      { key: 'memory', name: 'memory', formatter: formatBytes },
      { key: 'ephemeral-storage', name: 'ephemeral-storage', formatter: formatBytes },
      { key: 'hugepages-1Gi', name: 'hugepages-1Gi', formatter: formatBytes },
      { key: 'hugepages-2Mi', name: 'hugepages-2Mi', formatter: formatBytes }
    ].map((item) => {
      const row = map[item.key] ?? { req: 0, lim: 0, total: 0 }
      const reqPct = row.total > 0 ? Number(((row.req / row.total) * 100).toFixed(0)) : 0
      const limPct = row.total > 0 ? Number(((row.lim / row.total) * 100).toFixed(0)) : 0
      return {
        resource: item.name,
        requestText: `${item.formatter(row.req)} (${reqPct}%)`,
        limitText: `${item.formatter(row.lim)} (${limPct}%)`,
        requestPercent: reqPct,
        limitPercent: limPct
      }
    })
  })
  const nodeMetrics = computed(() => ({
    cpuUsageText: cpuUsageText.value,
    memoryUsageText: memoryUsageText.value,
    cpuUsageAllocText: cpuUsageAllocText.value,
    memoryUsageAllocText: memoryUsageAllocText.value,
    cpuUsagePercent: cpuUsagePercent.value,
    memoryUsagePercent: memoryUsagePercent.value
  }))

  async function loadMetrics() {
    if (!node.value?.metadata?.name) return
    metricsLoading.value = true
    try {
      const [cpuRes, memRes] = await Promise.all([
        fetchNodeUsageMetrics(cluster.value, node.value.metadata.name, 'cpu', 'usage').catch(
          () => ({ items: [] as any[] })
        ),
        fetchNodeUsageMetrics(cluster.value, node.value.metadata.name, 'memory', 'usage').catch(
          () => ({ items: [] as any[] })
        )
      ])
      const cpuPoints = cpuRes.items?.[0]?.metricPoints ?? []
      const memPoints = memRes.items?.[0]?.metricPoints ?? []
      const latestCpu = cpuPoints.length ? cpuPoints[cpuPoints.length - 1]?.value ?? 0 : 0
      const latestMem = memPoints.length ? memPoints[memPoints.length - 1]?.value ?? 0 : 0
      cpuUsageMillicores.value = Number(latestCpu) || 0
      memoryUsageBytes.value = Number(latestMem) || 0
    } finally {
      metricsLoading.value = false
    }
  }

  async function loadAllocatedResources() {
    if (!node.value?.metadata?.name) return
    const clusterName = cluster.value
    const nodeName = node.value.metadata.name
    try {
      const { data } = await kubeProxyAxios.get<{ items?: any[] }>(
        `/pixiu/proxy/${encodeURIComponent(clusterName)}/api/v1/pods`,
        { params: { fieldSelector: `spec.nodeName=${nodeName}`, limit: 1000 } }
      )
      const pods = data.items ?? []
      const summary: Record<string, { req: number; lim: number; total: number }> = {}
      const allocatable = node.value.status?.allocatable ?? {}
      const resourceKeys = ['cpu', 'memory', 'ephemeral-storage', 'hugepages-1Gi', 'hugepages-2Mi']
      for (const r of resourceKeys) {
        const raw = String((allocatable as Record<string, string | undefined>)[r] ?? '0')
        const total = r === 'cpu' ? parseCpuToMillicores(raw) : parseMemoryToBytes(raw)
        summary[r] = { req: 0, lim: 0, total }
      }
      for (const pod of pods) {
        const containers = pod?.spec?.containers ?? []
        for (const container of containers) {
          const requests = container?.resources?.requests ?? {}
          const limits = container?.resources?.limits ?? {}
          for (const r of resourceKeys) {
            const reqRaw = String((requests as Record<string, string | undefined>)[r] ?? '')
            const limRaw = String((limits as Record<string, string | undefined>)[r] ?? '')
            if (reqRaw) {
              summary[r].req += r === 'cpu' ? parseCpuToMillicores(reqRaw) : parseMemoryToBytes(reqRaw)
            }
            if (limRaw) {
              summary[r].lim += r === 'cpu' ? parseCpuToMillicores(limRaw) : parseMemoryToBytes(limRaw)
            }
          }
        }
      }
      allocatedResourceMap.value = summary
    } catch {
      allocatedResourceMap.value = {}
    }
  }

  async function loadNode() {
    loading.value = true
    try {
      node.value = await fetchK8sNode(cluster.value, name.value)
      yamlText.value = YAML.dump(node.value)
    } catch (e: any) {
      ElMessage.error(e.message || '加载节点失败')
    } finally {
      loading.value = false
      showAllLabels.value = false
      showAllAnnotations.value = false
    }
  }

  function resetLabelForm() {
    labelRows.value = []
  }
  function openLabelDialog() {
    const labels = node.value?.metadata?.labels ?? {}
    labelRows.value = Object.keys(labels).map((k) => ({ key: k, value: String(labels[k]) }))
    if (!labelRows.value.length) labelRows.value.push({ key: '', value: '' })
    labelVisible.value = true
  }
  async function submitLabels() {
    if (!node.value) return
    labelSubmitting.value = true
    try {
      const newLabels: Record<string, string | null> = {}
      for (const item of labelRows.value) {
        if (item.key.trim()) newLabels[item.key.trim()] = item.value
      }
      const oldLabels = node.value.metadata.labels ?? {}
      for (const key of Object.keys(oldLabels)) {
        if (!(key in newLabels)) newLabels[key] = null
      }
      await patchK8sNode(cluster.value, node.value.metadata.name, { metadata: { labels: newLabels } })
      ElMessage.success('标签更新成功')
      labelVisible.value = false
      await loadNode()
    } catch (e: any) {
      ElMessage.error(e.message || '更新失败')
    } finally {
      labelSubmitting.value = false
    }
  }

  async function toggleSchedule() {
    if (!node.value) return
    try {
      await patchK8sNode(cluster.value, node.value.metadata.name, {
        spec: { unschedulable: !node.value.spec?.unschedulable }
      })
      ElMessage.success('调度状态已更新')
      await loadNode()
    } catch (e: any) {
      ElMessage.error(e.message || '操作失败')
    }
  }

  async function deleteNodeConfirm() {
    if (!node.value) return
    try {
      await ElMessageBox.confirm(`确定删除节点 "${node.value.metadata.name}" 吗？`, '删除节点', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
      await deleteK8sNode(cluster.value, node.value.metadata.name)
      ElMessage.success('删除成功')
      goBack()
    } catch {
      // cancel
    }
  }

  function onMoreClick(item: ButtonMoreItem) {
    if (item.key === 'delete') void deleteNodeConfirm()
    if (item.key === 'labels') openLabelDialog()
    if (item.key === 'schedule') void toggleSchedule()
  }

  function goBack() {
    router.push({ path: '/container/nodes', query: { cluster: cluster.value } })
  }

  // ========== SSH 远程登录 ==========
  const sshLoginVisible = ref(false)
  const sshDrawerVisible = ref(false)
  const sshDrawerFullscreen = ref(false)
  const sshConnecting = ref(false)
  const sshXtermHostRef = ref<HTMLElement | null>(null)
  let sshSocket: WebSocket | null = null
  let sshIdleTimer: ReturnType<typeof setTimeout> | null = null
  const SSH_IDLE_TIMEOUT = 10 * 60 * 1000 // 10 分钟无操作自动断开

  /** 接近 macOS Terminal + zsh/Oh My Zsh 常见配色：黑底、绿/青/红等 ANSI 16 色 */
  const zshLikeTerminalTheme: ITheme = {
    background: '#000000',
    foreground: '#eeeeee',
    cursor: '#eeeeee',
    cursorAccent: '#000000',
    selectionBackground: 'rgba(255, 255, 255, 0.22)',
    black: '#000000',
    red: '#cc5555',
    green: '#66bb6a',
    yellow: '#c9c94d',
    blue: '#6d9eeb',
    magenta: '#ad85d7',
    cyan: '#4dd0e1',
    white: '#d3d7cf',
    brightBlack: '#555753',
    brightRed: '#ef5350',
    brightGreen: '#8ae234',
    brightYellow: '#ffea5f',
    brightBlue: '#729fcf',
    brightMagenta: '#c891ff',
    brightCyan: '#34e2e2',
    brightWhite: '#ffffff'
  }

  let xterm: Terminal | null = null
  let xtermFit: FitAddon | null = null
  let sshXtermResizeObserver: ResizeObserver | null = null
  let sshXtermFitRaf = 0
  /** 用于识别用户输入的 exit/logout 行，便于主动关 WS（服务端 Read 循环依赖客户端关闭） */
  let sshExitLineBuf = ''
  let sshExitDisconnectTimer: ReturnType<typeof setTimeout> | null = null

  function clearSshExitDisconnectTimer() {
    if (sshExitDisconnectTimer) {
      clearTimeout(sshExitDisconnectTimer)
      sshExitDisconnectTimer = null
    }
  }

  function onSshLocalInputForExitDetect(data: string) {
    if (!sshSocket || sshSocket.readyState !== WebSocket.OPEN) return
    sshExitLineBuf += data
    if (sshExitLineBuf.length > 2048) sshExitLineBuf = sshExitLineBuf.slice(-1024)
    for (;;) {
      const ix = sshExitLineBuf.search(/[\r\n]/)
      if (ix < 0) break
      const line = sshExitLineBuf.slice(0, ix).replace(/\r/g, '').trim()
      sshExitLineBuf = sshExitLineBuf.slice(ix + 1)
      if (/^(exit|logout)(\s|$)/i.test(line)) {
        clearSshExitDisconnectTimer()
        sshExitDisconnectTimer = setTimeout(() => {
          sshExitDisconnectTimer = null
          if (sshSocket && sshSocket.readyState === WebSocket.OPEN) closeSshSocket()
        }, 250)
        break
      }
    }
  }

  function scheduleFitXtermAndResizeSsh() {
    if (sshXtermFitRaf) cancelAnimationFrame(sshXtermFitRaf)
    sshXtermFitRaf = requestAnimationFrame(() => {
      sshXtermFitRaf = 0
      fitXtermAndResizeSsh()
    })
  }

  function onWindowResizeForSshXterm() {
    if (!sshDrawerVisible.value || !sshSocket || sshSocket.readyState !== WebSocket.OPEN) return
    scheduleFitXtermAndResizeSsh()
  }

  function detachSshXtermResizeHandling() {
    if (sshXtermResizeObserver) {
      sshXtermResizeObserver.disconnect()
      sshXtermResizeObserver = null
    }
    window.removeEventListener('resize', onWindowResizeForSshXterm)
  }

  function attachSshXtermResizeHandling() {
    detachSshXtermResizeHandling()
    window.addEventListener('resize', onWindowResizeForSshXterm, { passive: true })
    const el = sshXtermHostRef.value
    if (el && typeof ResizeObserver !== 'undefined') {
      sshXtermResizeObserver = new ResizeObserver(() => {
        scheduleFitXtermAndResizeSsh()
      })
      sshXtermResizeObserver.observe(el)
    }
  }

  const sshForm = ref({ host: '', port: 22, user: 'root', password: '' })

  function openSshLoginDialog() {
    const ip = node.value
      ? (node.value.status?.addresses ?? []).find(
          (a: { type: string; address: string }) => a.type === 'InternalIP'
        )?.address ?? ''
      : ''
    sshForm.value = { host: ip, port: 22, user: 'root', password: '' }
    sshLoginVisible.value = true
  }

  function resetSshLogin() {
    sshConnecting.value = false
  }

  function disposeXterm() {
    clearSshExitDisconnectTimer()
    detachSshXtermResizeHandling()
    if (sshXtermFitRaf) {
      cancelAnimationFrame(sshXtermFitRaf)
      sshXtermFitRaf = 0
    }
    try {
      xterm?.dispose()
    } catch {
      // ignore
    }
    xterm = null
    xtermFit = null
  }

  function initXterm() {
    const host = sshXtermHostRef.value
    if (!host) return
    disposeXterm()
    xterm = new Terminal({
      cursorBlink: true,
      fontFamily: "'JetBrains Mono', Menlo, Monaco, Consolas, 'Source Code Pro', monospace",
      fontSize: 13,
      lineHeight: 1.05,
      theme: zshLikeTerminalTheme,
      scrollback: 8000
    })
    xtermFit = new FitAddon()
    xterm.loadAddon(xtermFit)
    xterm.open(host)
    xtermFit.fit()
    attachSshXtermResizeHandling()
    xterm.onData((data) => {
      resetIdleTimer()
      sendSshData(data)
      onSshLocalInputForExitDetect(data)
    })
  }

  function fitXtermAndResizeSsh() {
    if (!xterm || !xtermFit || !sshSocket || sshSocket.readyState !== WebSocket.OPEN) return
    try {
      xtermFit.fit()
    } catch {
      // ignore
    }
    sendSshResize(xterm.cols, xterm.rows)
  }

  function writeXtermSystemLine(message: string, color: 'yellow' | 'red' = 'yellow') {
    if (!xterm) return
    const code = color === 'red' ? '\x1b[31m' : '\x1b[33m'
    xterm.writeln(`${code}${message.replace(/\r?\n/g, '')}\x1b[0m`)
  }

  function buildSshWsUrl(): string {
    const base = resolvePixiuWsOrigin()
    const f = sshForm.value
    return (
      `${base}/pixiu/kubeproxy/nodes/ws` +
      `?host=${encodeURIComponent(f.host)}` +
      `&port=${f.port || 22}` +
      `&user=${encodeURIComponent(f.user)}` +
      `&password=${encodeURIComponent(f.password)}`
    )
  }

  function resetIdleTimer() {
    if (sshIdleTimer) clearTimeout(sshIdleTimer)
    sshIdleTimer = setTimeout(() => {
      writeXtermSystemLine('[连接因长时间无操作已自动断开]')
      closeSshSocket()
    }, SSH_IDLE_TIMEOUT)
  }

  function clearIdleTimer() {
    if (sshIdleTimer) {
      clearTimeout(sshIdleTimer)
      sshIdleTimer = null
    }
  }

  function sendSshData(text: string) {
    if (!sshSocket || sshSocket.readyState !== WebSocket.OPEN) return
    const encoded = btoa(unescape(encodeURIComponent(text)))
    const msg = '1' + encoded
    const buf = new Uint8Array(msg.length)
    for (let i = 0; i < msg.length; i++) buf[i] = msg.charCodeAt(i)
    sshSocket.send(buf.buffer)
  }

  function sendSshResize(cols: number, rows: number) {
    if (!sshSocket || sshSocket.readyState !== WebSocket.OPEN) return
    const json = JSON.stringify({ Columns: cols, Rows: rows })
    const encoded = btoa(json)
    const msg = '2' + encoded
    const buf = new Uint8Array(msg.length)
    for (let i = 0; i < msg.length; i++) buf[i] = msg.charCodeAt(i)
    sshSocket.send(buf.buffer)
  }

  function connectSsh(options?: { keepLog?: boolean }) {
    closeSshSocket()
    if (!options?.keepLog) {
      disposeXterm()
    } else if (xterm) {
      writeXtermSystemLine('[正在重新连接...]')
    }
    const url = buildSshWsUrl()
    const token = localStorage.getItem('pixiu-access-token')
    sshSocket = token ? new WebSocket(url, [token]) : new WebSocket(url)
    sshSocket.binaryType = 'arraybuffer'

    sshSocket.onopen = () => {
      sshConnecting.value = false
      resetIdleTimer()
      const mountXterm = () => {
        if (!sshXtermHostRef.value) {
          requestAnimationFrame(mountXterm)
          return
        }
        if (!xterm) initXterm()
        fitXtermAndResizeSsh()
        // 抽屉动画结束后宿主宽度才稳定，再 fit 一次并同步 PTY，避免 ls 列数偏少、右侧留白
        nextTick(() => {
          requestAnimationFrame(() => {
            scheduleFitXtermAndResizeSsh()
          })
        })
        xterm?.focus()
      }
      nextTick(() => {
        mountXterm()
      })
    }

    sshSocket.onmessage = (event) => {
      let text: string
      if (event.data instanceof ArrayBuffer) {
        text = new TextDecoder().decode(event.data)
      } else {
        text = String(event.data)
      }
      resetIdleTimer()
      xterm?.write(text)
      nextTick(() => focusTermIfHeaderStoleFocus())
    }

    sshSocket.onerror = () => {
      sshConnecting.value = false
      clearIdleTimer()
      writeXtermSystemLine('[连接出错，请检查主机地址、端口和凭证]', 'red')
    }

    sshSocket.onclose = () => {
      sshConnecting.value = false
      clearIdleTimer()
      writeXtermSystemLine('[连接已断开]')
    }
  }

  function reconnectSsh() {
    if (sshConnecting.value) return
    if (!sshForm.value.host || !sshForm.value.user) {
      ElMessage.warning('缺少主机或用户名，请关闭后重新填写')
      return
    }
    sshConnecting.value = true
    connectSsh({ keepLog: true })
  }

  async function confirmSshLogin() {
    if (!sshForm.value.host) {
      ElMessage.warning('请输入主机地址')
      return
    }
    if (!sshForm.value.user) {
      ElMessage.warning('请输入用户名')
      return
    }
    sshConnecting.value = true
    sshLoginVisible.value = false
    sshDrawerVisible.value = true
    await nextTick()
    connectSsh()
  }

  function focusTerm() {
    xterm?.focus()
  }

  /** 焦点被抽屉头部工具栏抢走时（如焦点陷阱/重绘），把键盘焦点拉回终端，避免 Enter 触发「重新连接」 */
  function focusTermIfHeaderStoleFocus() {
    const host = sshXtermHostRef.value
    if (!sshDrawerVisible.value || !host) return
    const ae = document.activeElement
    if (!ae || !(ae instanceof HTMLElement)) return
    const drawer = host.closest('.el-drawer')
    if (!drawer || !drawer.contains(ae)) return
    const header = drawer.querySelector('.el-drawer__header')
    if (header?.contains(ae)) {
      xterm?.focus()
    }
  }

  function closeSshSocket() {
    clearSshExitDisconnectTimer()
    sshExitLineBuf = ''
    clearIdleTimer()
    if (sshSocket) {
      sshSocket.onopen = null
      sshSocket.onclose = null
      sshSocket.onerror = null
      sshSocket.onmessage = null
      sshSocket.close()
      sshSocket = null
    }
  }

  function closeSshDrawer() {
    closeSshSocket()
    disposeXterm()
    sshDrawerFullscreen.value = false
  }

  function dismissSshDrawer() {
    sshDrawerVisible.value = false
  }

  watch(
    [sshDrawerFullscreen, sshDrawerVisible],
    () => {
      if (!sshDrawerVisible.value) {
        closeSshDrawer()
        return
      }
      if (!sshSocket || sshSocket.readyState !== WebSocket.OPEN) return
      nextTick(() => {
        if (!sshSocket || sshSocket.readyState !== WebSocket.OPEN) return
        scheduleFitXtermAndResizeSsh()
      })
    },
    { flush: 'post' }
  )

  onBeforeUnmount(() => {
    closeSshSocket()
    disposeXterm()
  })

  onMounted(async () => {
    await loadNode()
    await loadMetrics()
    await loadAllocatedResources()
  })
</script>

<style scoped>
  .nd {
    display: flex;
    flex-direction: column;
    gap: 15px;
    min-height: 100%;
  }
  .nd-card {
    border-radius: 8px;
    border: 1px solid var(--el-border-color-lighter) !important;
  }
  .nd-card :deep(.el-card__body) {
    padding: 0;
  }
  .nd-card--overview :deep(.el-card__body) {
    padding-top: 15px;
  }
  .nd-hd {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 0 14px;
    height: 46px;
    min-width: 0;
  }
  .nd-vdv {
    margin: 0 8px;
    height: 18px;
    flex-shrink: 0;
  }
  .nd-vdv--cluster {
    margin: 0 15px;
  }
  .nd-title {
    display: inline-flex;
    align-items: center;
    gap: 15px;
    margin-left: 4px;
    font-size: 14px;
    color: #c7c7d1;
  }
  .nd-title__value {
    color: var(--el-color-primary);
  }
  .nd-title-status {
    margin-left: 20px;
  }
  .nd-cluster-wrap {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }
  .nd-cluster-label {
    font-size: 14px;
    color: #c7c7d1;
  }
  .nd-cluster-value {
    font-size: 13px;
    color: var(--el-text-color-primary);
  }
  .nd-hd-actions {
    margin-left: auto;
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .nd-section-title {
    padding: 4px 14px 2px 45px;
    font-size: 14px;
    font-weight: 500;
    color: #c7c7d1;
  }
  .nd-info-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    padding: 6px 10px 10px 40px;
    column-gap: 12px;
    row-gap: 2px;
  }
  .nd-info-cell {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 6px 10px;
    min-width: 0;
  }
  .nd-k {
    width: 78px;
    flex-shrink: 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.7;
  }
  .nd-v {
    flex: 1;
    font-size: 13px;
    color: var(--el-text-color-primary);
    line-height: 1.7;
    word-break: break-all;
    min-width: 0;
  }
  .nd-v--with-tag {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .nd-tag-group {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 6px 8px;
    min-height: 24px;
    align-items: center;
  }
  .nd-mono-tag {
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 12px;
  }
  .nd-more-btn {
    height: 24px;
    padding: 0 2px;
    font-size: 12px;
  }
  .nd-empty {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
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
  .mt-2 {
    margin-top: 8px;
  }
  .nd-workloads-copy {
    margin-top: -8px;
  }
  .nd-ssh-alert {
    margin-bottom: 16px;
  }
  .nd-ssh-form {
    padding-top: 4px;
  }
  .nd-ssh-drawer-header-inner {
    display: flex;
    align-items: center;
    width: 100%;
    min-width: 0;
    gap: 8px;
  }
  .nd-ssh-drawer-title {
    font-size: 14px;
    font-weight: 500;
    flex: 1;
    min-width: 0;
  }
  .nd-ssh-header-toolbar {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    gap: 0;
  }
  .nd-ssh-drawer-host {
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 13px;
    color: var(--el-color-primary);
  }
  .nd-ssh-terminal-wrap {
    flex: 1;
    min-height: 0;
    min-width: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
  }
  .nd-ssh-xterm-host {
    flex: 1;
    min-height: 0;
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
    padding: 8px 12px 12px;
    background: #000000;
    border-radius: 6px;
    outline: none;
    cursor: text;
  }
  .nd-ssh-xterm-host:focus-within {
    box-shadow: 0 0 0 2px var(--el-color-primary-light-5);
  }
  .nd-ssh-xterm-host :deep(.xterm) {
    width: 100%;
    height: 100%;
  }
  .nd-ssh-xterm-host :deep(.xterm-screen) {
    width: 100%;
  }
  .nd-ssh-xterm-host :deep(.xterm-viewport) {
    overflow-y: auto !important;
  }
</style>

<style>
  .nd-ssh-drawer .el-drawer__header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 0;
    padding-bottom: 12px;
  }

  /* 刷新 / 全屏 / 关闭：统一点击区域与图标尺寸（关闭为自定义按钮，与另两个同一 toolbar 间距） */
  .nd-ssh-drawer .el-drawer__header .nd-ssh-header-icon-btn {
    box-sizing: border-box;
    width: 36px;
    height: 36px;
    margin: 0;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    border-radius: var(--el-border-radius-small);
    color: var(--el-text-color-secondary);
    cursor: pointer;
    line-height: 1;
    flex-shrink: 0;
  }

  .nd-ssh-drawer .el-drawer__header .nd-ssh-header-icon-btn:hover:not(:disabled) {
    color: var(--el-color-primary);
    background-color: var(--el-fill-color-light);
  }

  .nd-ssh-drawer .el-drawer__header .nd-ssh-header-icon-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .nd-ssh-drawer .el-drawer__header .nd-ssh-header-icon-btn .el-icon,
  .nd-ssh-drawer .el-drawer__header .nd-ssh-header-icon-btn svg {
    width: 20px;
    height: 20px;
    font-size: 20px;
  }

  .nd-ssh-drawer .el-drawer__body {
    padding: 4px 16px 16px;
    display: flex;
    flex-direction: column;
  }
</style>

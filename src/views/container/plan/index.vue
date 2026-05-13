<template>
  <div class="plan-page art-full-height">
    <!-- 搜索栏 -->
    <ElCard class="art-search-card">
      <div class="search-bar">
        <span class="search-label">部署名称</span>
        <ElInput
          v-model="searchName"
          placeholder="请输入部署名称"
          clearable
          style="width: 240px"
          @keyup.enter="handleSearch"
        />
        <span class="search-label status-label">状态</span>
        <ElSelect
          v-model="searchStatus"
          placeholder="全部"
          clearable
          style="width: 200px"
          @change="handleSearch"
        >
          <ElOption label="未开始" value="未开始" />
          <ElOption label="运行中" value="运行中" />
          <ElOption label="已成功" value="已成功" />
          <ElOption label="已失败" value="已失败" />
        </ElSelect>
        <ElButton @click="handleReset">重置</ElButton>
        <ElButton type="primary" @click="handleSearch">查询</ElButton>
      </div>
    </ElCard>

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElButton v-ripple @click="goToCreate">新增部署</ElButton>
        </template>
      </ArtTableHeader>

      <ArtTable
        row-key="id"
        :loading="loading"
        :data="filteredData"
        :columns="columns"
        :pagination="pagination"
        :pagination-options="{ align: 'right' }"
        @selection-change="handleSelectionChange"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />
    </ElCard>

    <!-- 任务进度抽屉 -->
    <ElDrawer
      v-model="taskDrawerVisible"
      title="部署进度"
      size="48%"
      :destroy-on-close="true"
      class="plan-task-drawer"
      @open="handleTaskDrawerOpen"
      @close="handleTaskDrawerClose"
    >
      <div class="task-drawer">
        <ElAlert
          title="获取部署计划的部署情况"
          type="info"
          :closable="false"
          show-icon
          effect="light"
          class="task-alert"
        />
        <ElTable
          :data="tasks"
          :border="false"
          :stripe="false"
          size="small"
          style="margin-top: 12px"
          :header-cell-style="{ background: 'transparent' }"
        >
          <ElTableColumn label="名称" prop="name" min-width="160" />
          <ElTableColumn label="状态" width="130">
            <template #default="{ row }">
              <div class="task-status">
                <ElIcon
                  v-if="row.status === '运行中'"
                  class="is-loading"
                  color="var(--el-color-primary)"
                >
                  <Loading />
                </ElIcon>
                <ElIcon v-else-if="row.status === '已成功'" color="var(--el-color-success)">
                  <SuccessFilled />
                </ElIcon>
                <ElIcon v-else-if="row.status === '已失败'" color="var(--el-color-danger)">
                  <CircleCloseFilled />
                </ElIcon>
                <ElIcon v-else color="var(--el-text-color-placeholder)">
                  <RemoveFilled />
                </ElIcon>
                <span>{{ row.status }}</span>
              </div>
            </template>
          </ElTableColumn>
          <ElTableColumn label="开始时间" prop="gmt_create" min-width="160">
            <template #default="{ row }">{{ formatDate(row.gmt_create) }}</template>
          </ElTableColumn>
          <ElTableColumn label="结束时间" prop="gmt_modified" min-width="160">
            <template #default="{ row }">
              {{
                row.status === '运行中' || row.status === '未开始'
                  ? '-'
                  : formatDate(row.gmt_modified)
              }}
            </template>
          </ElTableColumn>
          <ElTableColumn label="操作" width="88" fixed="right" align="center">
            <template #default="{ row }">
              <ElLink
                type="primary"
                underline="never"
                :style="taskLogLinkStyle(row)"
                @click="onTaskLogClick(row)"
              >
                日志
              </ElLink>
            </template>
          </ElTableColumn>
        </ElTable>
        <div v-if="tasks.length === 0 && !tasksLoading" class="task-empty">暂无部署任务</div>
      </div>
    </ElDrawer>

    <!-- 日志流抽屉 -->
    <ElDrawer
      v-model="logDialogVisible"
      :title="`日志查询 — ${logTask?.name || ''}`"
      size="48%"
      destroy-on-close
      class="task-log-drawer"
      @close="stopLogStream"
    >
      <div ref="logPanelRef" class="log-panel">
        <pre
          v-for="(line, i) in logLines"
          :key="i"
          :class="['log-line', getLogLineClass(line)]"
          v-html="renderAnsiLine(line)"
        />
        <div v-if="logLines.length === 0 && !logStreaming" class="log-empty">暂无日志</div>
        <div v-if="logStreaming" class="log-cursor">▌</div>
      </div>
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import { ElIcon, ElLink, ElMessage, ElMessageBox, ElOption, ElSelect, ElTag } from 'element-plus'
  import {
    SuccessFilled,
    CircleCloseFilled,
    Loading,
    RemoveFilled,
    CopyDocument
  } from '@element-plus/icons-vue'
  import ArtButtonMore, {
    type ButtonMoreItem
  } from '@/components/core/forms/art-button-more/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { useRouter } from 'vue-router'
  import {
    fetchPlanList,
    fetchDeletePlan,
    fetchStartPlan,
    fetchPlanTasks,
    fetchDestroyPlan
  } from '@/api/plan'
  import { confirmDestroyPlan } from '../utils/destroy-plan-dialog'
  import type { PlanItemFormatted, PlanTask } from '@/api/plan'

  defineOptions({ name: 'Plan' })

  const router = useRouter()

  function formatDate(iso: string): string {
    if (!iso) return '-'
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  function isTaskLogDisabled(row: PlanTask): boolean {
    return row.status === '未开始'
  }

  function taskLogLinkStyle(row: PlanTask): string {
    const base = 'font-size:12px'
    if (isTaskLogDisabled(row)) {
      return `${base};cursor:not-allowed;color:var(--el-text-color-disabled)`
    }
    return base
  }

  function onTaskLogClick(row: PlanTask) {
    if (isTaskLogDisabled(row)) return
    logTask.value = row
    logLines.value = []
    logDialogVisible.value = true
    void startLogStream(currentPlan.value!.id, row.id)
  }

  // ---- 日志流 ----
  const logDialogVisible = ref(false)
  const logTask = ref<PlanTask | null>(null)
  const logLines = ref<string[]>([])
  const logStreaming = ref(false)
  const logAbortController = ref<AbortController | null>(null)
  const logPanelRef = ref<HTMLElement | null>(null)

  function scrollLogToBottom() {
    if (logPanelRef.value) {
      logPanelRef.value.scrollTop = logPanelRef.value.scrollHeight
    }
  }

  async function startLogStream(planId: number, taskId: number) {
    const token = localStorage.getItem('pixiu-access-token') || ''
    const ctrl = new AbortController()
    logAbortController.value = ctrl
    logStreaming.value = true
    try {
      const res = await fetch(`/pixiu/plans/${planId}/tasks/${taskId}/logs`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: ctrl.signal
      })
      if (!res.ok || !res.body) {
        logLines.value.push(`[错误] HTTP ${res.status}`)
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let firstChunk = true
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        // 首块：检查是否为业务错误 JSON（含 No such container）
        if (firstChunk) {
          firstChunk = false
          try {
            const parsed = JSON.parse(buf.trim())
            if (parsed?.code !== 200 && String(parsed?.message).includes('No such container')) {
              const fallback = logTask.value?.message?.trim()
              logLines.value.push(fallback || '暂无日志')
              return
            }
          } catch {
            /* 不是 JSON，正常流式日志 */
          }
        }
        const parts = buf.split('\n')
        buf = parts.pop() ?? ''
        for (const line of parts) {
          logLines.value.push(line)
        }
        await nextTick()
        scrollLogToBottom()
      }
      if (buf) logLines.value.push(buf)
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        logLines.value.push(`[错误] ${e?.message || '连接断开'}`)
      }
    } finally {
      logStreaming.value = false
      logAbortController.value = null
      await nextTick()
      scrollLogToBottom()
    }
  }

  function stopLogStream() {
    logAbortController.value?.abort()
    logAbortController.value = null
    logStreaming.value = false
  }

  function getLogLineClass(line: string): string {
    const text = line.toLowerCase()
    if (text.includes('[error]') || text.includes('failed') || text.includes('fatal')) {
      return 'log-line--error'
    }
    if (text.includes('[warning]') || text.includes('warn')) {
      return 'log-line--warn'
    }
    if (text.includes('ok:') || text.startsWith('ok') || text.includes('success')) {
      return 'log-line--success'
    }
    if (text.includes('task ') || text.startsWith('play ') || text.startsWith('recap')) {
      return 'log-line--title'
    }
    return ''
  }

  const ansiCodeRegex = /\u001b\[([0-9;]*)m/g

  function escapeHtml(input: string): string {
    return input
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
  }

  function ansiCodeToClass(code: number): string | null {
    const fgClassMap: Record<number, string> = {
      30: 'ansi-fg-black',
      31: 'ansi-fg-red',
      32: 'ansi-fg-green',
      33: 'ansi-fg-yellow',
      34: 'ansi-fg-blue',
      35: 'ansi-fg-magenta',
      36: 'ansi-fg-cyan',
      37: 'ansi-fg-white',
      90: 'ansi-fg-bright-black',
      91: 'ansi-fg-bright-red',
      92: 'ansi-fg-bright-green',
      93: 'ansi-fg-bright-yellow',
      94: 'ansi-fg-bright-blue',
      95: 'ansi-fg-bright-magenta',
      96: 'ansi-fg-bright-cyan',
      97: 'ansi-fg-bright-white'
    }
    return fgClassMap[code] || null
  }

  function renderAnsiLine(line: string): string {
    let lastIndex = 0
    let html = ''
    let currentClass = ''

    ansiCodeRegex.lastIndex = 0
    let match = ansiCodeRegex.exec(line)

    while (match) {
      const textChunk = line.slice(lastIndex, match.index)
      if (textChunk) {
        const escaped = escapeHtml(textChunk)
        html += currentClass ? `<span class="${currentClass}">${escaped}</span>` : escaped
      }

      const codes = match[1]
        .split(';')
        .map((n) => Number(n))
        .filter((n) => !Number.isNaN(n))

      for (const code of codes) {
        if (code === 0) {
          currentClass = ''
          continue
        }
        if (code === 1) {
          currentClass = currentClass ? `${currentClass} ansi-bold` : 'ansi-bold'
          continue
        }
        const fgClass = ansiCodeToClass(code)
        if (fgClass) {
          const tokens = currentClass
            .split(' ')
            .filter((item) => item && !item.startsWith('ansi-fg-'))
          tokens.push(fgClass)
          currentClass = tokens.join(' ')
        }
      }

      lastIndex = ansiCodeRegex.lastIndex
      match = ansiCodeRegex.exec(line)
    }

    const tail = line.slice(lastIndex)
    if (tail) {
      const escapedTail = escapeHtml(tail)
      html += currentClass ? `<span class="${currentClass}">${escapedTail}</span>` : escapedTail
    }

    return html || '&nbsp;'
  }

  // 搜索
  const searchName = ref('')
  const searchStatus = ref('')
  const appliedSearch = ref('')
  const appliedStatus = ref('')
  const selectedRows = ref<PlanItemFormatted[]>([])

  // 任务进度抽屉
  const taskDrawerVisible = ref(false)
  const currentPlan = ref<PlanItemFormatted | null>(null)
  const tasks = ref<PlanTask[]>([])
  const tasksLoading = ref(false)
  const taskPollingTimer = ref<ReturnType<typeof setInterval> | null>(null)

  const {
    columns,
    columnChecks,
    data,
    loading,
    pagination,
    getData,
    handleSizeChange,
    handleCurrentChange,
    refreshData
  } = useTable({
    core: {
      apiFn: async (params: { current: number; size: number }) => {
        const { list, total } = await fetchPlanList({
          page: params.current,
          limit: params.size,
          nameSelector: appliedSearch.value || undefined,
          step: appliedStatus.value || undefined
        })
        return {
          code: 200,
          data: { records: list, total, current: params.current, size: params.size }
        }
      },
      apiParams: { current: 1, size: 10 },
      columnsFactory: () => [
        { type: 'selection', width: 30 },
        {
          prop: 'name',
          label: '名称',
          minWidth: 150,
          showOverflowTooltip: true,
          formatter: (row: PlanItemFormatted) =>
            h('div', { style: 'display:flex;align-items:center;gap:6px' }, [
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () => goToDetail(row)
                },
                () => row.name
              ),
              h(
                'span',
                {
                  class: 'plan-icon-action',
                  style:
                    'cursor:pointer;color:var(--el-text-color-secondary);display:inline-flex;align-items:center',
                  title: '复制名称',
                  onClick: (e: MouseEvent) => {
                    e.stopPropagation()
                    navigator.clipboard.writeText(row.name)
                    ElMessage.success('已复制')
                  }
                },
                [h(CopyDocument, { style: 'width:12px;height:12px' })]
              )
            ])
        },
        {
          prop: 'step',
          label: '状态',
          width: 100,
          formatter: (row: PlanItemFormatted) => {
            const map: Record<string, { type: 'info' | 'primary' | 'success' | 'danger' }> = {
              未开始: { type: 'info' },
              运行中: { type: 'primary' },
              已成功: { type: 'success' },
              已失败: { type: 'danger' }
            }
            const cfg = map[row.step] ?? { type: 'info' as const }
            return h(ElTag, { type: cfg.type }, () => row.step)
          }
        },
        {
          prop: 'kubernetesVersion',
          label: 'Kubernetes 版本',
          width: 200,
          formatter: (row: PlanItemFormatted) =>
            h('span', { style: 'font-size:12px' }, row.kubernetesVersion || '-')
        },
        {
          prop: 'nodeCount',
          label: '节点数',
          width: 110,
          formatter: (row: PlanItemFormatted) =>
            h('span', { style: 'font-size:12px' }, String(row.nodeCount))
        },
        {
          prop: 'createTime',
          label: '创建时间',
          sortable: true,
          width: 176,
          showOverflowTooltip: true,
          formatter: (row: PlanItemFormatted) =>
            h('span', { style: 'font-size:12px' }, row.createTime)
        },
        {
          prop: 'description',
          label: '描述',
          minWidth: 200,
          showOverflowTooltip: true,
          formatter: (row: PlanItemFormatted) =>
            h(
              'span',
              { style: 'font-size:12px;color:var(--el-text-color-secondary)' },
              row.description || '-'
            )
        },
        {
          prop: 'operation',
          label: '操作',
          width: 190,
          fixed: 'right',
          formatter: (row: PlanItemFormatted) =>
            h('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:nowrap' }, [
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () => startPlan(row)
                },
                () => '开始部署'
              ),
              h(
                ElLink,
                {
                  type: 'primary',
                  underline: 'never',
                  style: 'font-size:12px',
                  onClick: () => openTaskDrawer(row)
                },
                () => '查看进度'
              ),
              h(ArtButtonMore, {
                list: [
                  { key: 'copy', label: '拷贝', icon: 'ri:file-copy-2-line' },
                  { key: 'edit', label: '编辑', icon: 'ri:edit-2-line' },
                  { key: 'destroy', label: '销毁', icon: 'ri:delete-back-2-line' },
                  { key: 'delete', label: '删除', icon: 'ri:delete-bin-line' }
                ],
                onClick: (item: ButtonMoreItem) => {
                  if (item.key === 'copy') {
                    goToCopy(row)
                    return
                  }
                  if (item.key === 'edit') {
                    goToEdit(row)
                    return
                  }
                  if (item.key === 'destroy') {
                    void destroyPlan(row.id, row.name)
                    return
                  }
                  if (item.key === 'delete') deletePlan(row)
                }
              })
            ])
        }
      ]
    }
  })

  // 前端过滤
  const filteredData = computed(() => {
    return data.value.filter((item) => {
      const nameMatch =
        !appliedSearch.value || item.name.toLowerCase().includes(appliedSearch.value.toLowerCase())
      const statusMatch = !appliedStatus.value || item.step === appliedStatus.value
      return nameMatch && statusMatch
    })
  })

  function handleSearch() {
    appliedSearch.value = searchName.value
    appliedStatus.value = searchStatus.value
    refreshData()
  }

  function handleReset() {
    searchName.value = ''
    searchStatus.value = ''
    appliedSearch.value = ''
    appliedStatus.value = ''
    refreshData()
  }

  function goToCreate() {
    router.push('/container/cluster/deploy')
  }

  function goToDetail(row: PlanItemFormatted) {
    router.push({ path: '/container/cluster/deploy', query: { planId: String(row.id) } })
  }

  function goToEdit(row: PlanItemFormatted) {
    router.push({
      path: '/container/cluster/deploy',
      query: { planId: String(row.id), mode: 'edit' }
    })
  }

  function goToCopy(row: PlanItemFormatted) {
    router.push({
      path: '/container/cluster/deploy',
      query: { planId: String(row.id), mode: 'copy' }
    })
  }

  async function startPlan(row: PlanItemFormatted) {
    try {
      await ElMessageBox.confirm(`确定要启动计划 "${row.name}" 的部署任务吗？`, '开始部署', {
        confirmButtonText: '启动',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
    try {
      await fetchStartPlan(row.id)
      ElMessage.success(`计划 "${row.name}" 启动成功`)
      refreshData()
    } catch (e: any) {
      ElMessage.error(e?.message || '启动失败')
    }
  }

  async function deletePlan(row: PlanItemFormatted) {
    try {
      await ElMessageBox.confirm(`确定要删除计划 "${row.name}" 吗？`, '删除计划', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      await fetchDeletePlan(row.id)
      ElMessage.success('删除成功')
      refreshData()
    } catch {}
  }

  async function destroyPlan(planId: number, planName: string) {
    const restart = await confirmDestroyPlan(planName)
    if (restart === null) return
    try {
      await fetchDestroyPlan(planId, restart)
      ElMessage.success('销毁任务已提交')
      refreshData()
    } catch {}
  }

  function openTaskDrawer(row: PlanItemFormatted) {
    currentPlan.value = row
    tasks.value = []
    taskDrawerVisible.value = true
  }

  function startTaskPolling() {
    stopTaskPolling()
    taskPollingTimer.value = setInterval(() => {
      void loadTasks(true)
    }, 5000)
  }

  function stopTaskPolling() {
    if (!taskPollingTimer.value) return
    clearInterval(taskPollingTimer.value)
    taskPollingTimer.value = null
  }

  function handleTaskDrawerOpen() {
    void loadTasks(true)
    startTaskPolling()
  }

  function handleTaskDrawerClose() {
    stopTaskPolling()
  }

  async function loadTasks(silent: boolean = false) {
    if (!currentPlan.value) return
    if (!silent) {
      tasksLoading.value = true
    }
    try {
      tasks.value = await fetchPlanTasks(currentPlan.value.id)
    } catch (e: any) {
      ElMessage.error(e.message || '获取任务列表失败')
    } finally {
      if (!silent) {
        tasksLoading.value = false
      }
    }
  }

  function handleSelectionChange(rows: PlanItemFormatted[]) {
    selectedRows.value = rows
  }

  onActivated(() => {
    refreshData()
  })

  onBeforeUnmount(() => {
    stopTaskPolling()
    stopLogStream()
  })
</script>

<style>
  .plan-page .plan-icon-action {
    opacity: 0;
    transition: opacity 0.15s;
  }
  .plan-page .el-table__row:hover .plan-icon-action {
    opacity: 1;
  }
  .plan-page .art-table .el-table {
    font-size: 13px;
  }
  .plan-page .art-table .el-table th.el-table__cell {
    font-size: 13px;
  }

  .destroy-plan-dialog .el-message-box__message {
    padding-top: 2px;
  }
  .task-log-dialog .el-message-box__message {
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 60vh;
    overflow: auto;
    text-align: left;
  }
  .task-log-drawer .el-drawer__body {
    padding: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .task-log-drawer .el-drawer__header {
    margin-bottom: 20px;
  }
</style>

<style scoped>
  .search-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .search-label {
    font-size: 14px;
    color: var(--el-text-color-regular);
    white-space: nowrap;
  }

  .status-label {
    margin-left: 30px;
  }

  .task-drawer {
    padding: 4px 0;
    overflow: hidden;
  }

  .task-alert {
    margin-top: 0px;
    margin-bottom: 12px;
  }

  .task-status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }

  .task-empty {
    text-align: center;
    padding: 40px 0;
    color: var(--el-text-color-placeholder);
    font-size: 13px;
  }

  .plan-task-drawer :deep(.el-drawer__body) {
    overflow: auto;
  }

  .plan-task-drawer :deep(.el-table__header-wrapper th.el-table__cell) {
    font-size: 13px;
  }

  .plan-task-drawer :deep(.el-drawer.rtl) {
    height: 82vh;
    margin-top: 9vh;
  }

  .log-panel {
    background:
      radial-gradient(circle at top right, rgb(101 144 255 / 16%) 0%, rgb(101 144 255 / 0%) 50%),
      radial-gradient(circle at left bottom, rgb(80 215 255 / 10%) 0%, rgb(80 215 255 / 0%) 40%),
      linear-gradient(180deg, #0f1727 0%, #0a1220 100%);
    color: #dbe7ff;
    font-family:
      'JetBrains Mono', 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
      monospace;
    font-size: 12px;
    line-height: 1.72;
    letter-spacing: 0.15px;
    padding: 30px 16px 16px 20px;
    flex: 1;
    overflow-y: auto;
    border-top: 1px solid rgb(255 255 255 / 10%);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 4%),
      inset 0 0 0 1px rgb(255 255 255 / 3%),
      inset 0 -24px 40px rgb(0 0 0 / 18%);
    text-rendering: optimizelegibility;
    -webkit-font-smoothing: antialiased;
  }

  .log-line {
    margin: 0;
    padding: 1px 8px;
    white-space: pre-wrap;
    word-break: break-all;
    border-radius: 4px;
    color: #dbe7ff;
  }

  .log-line:nth-child(2n) {
    color: #c6d6ff;
  }

  .log-line:hover {
    background: rgb(115 147 255 / 12%);
  }

  .log-line--title {
    color: #8bd5ff;
    font-weight: 600;
  }

  .log-line--success {
    color: #8ee7a8;
  }

  .log-line--warn {
    color: #f5d089;
  }

  .log-line--error {
    color: #ff9ea7;
  }

  .log-line :deep(.ansi-bold) {
    font-weight: 700;
  }

  .log-line :deep(.ansi-fg-black) {
    color: #667390;
  }
  .log-line :deep(.ansi-fg-red) {
    color: #ff8a93;
  }
  .log-line :deep(.ansi-fg-green) {
    color: #82e8a0;
  }
  .log-line :deep(.ansi-fg-yellow) {
    color: #f8d078;
  }
  .log-line :deep(.ansi-fg-blue) {
    color: #82aaff;
  }
  .log-line :deep(.ansi-fg-magenta) {
    color: #d7a8ff;
  }
  .log-line :deep(.ansi-fg-cyan) {
    color: #7fe7ff;
  }
  .log-line :deep(.ansi-fg-white) {
    color: #dbe7ff;
  }
  .log-line :deep(.ansi-fg-bright-black) {
    color: #8fa1c5;
  }
  .log-line :deep(.ansi-fg-bright-red) {
    color: #ff9ea7;
  }
  .log-line :deep(.ansi-fg-bright-green) {
    color: #93f0ae;
  }
  .log-line :deep(.ansi-fg-bright-yellow) {
    color: #ffe08a;
  }
  .log-line :deep(.ansi-fg-bright-blue) {
    color: #96b8ff;
  }
  .log-line :deep(.ansi-fg-bright-magenta) {
    color: #e0b9ff;
  }
  .log-line :deep(.ansi-fg-bright-cyan) {
    color: #96eeff;
  }
  .log-line :deep(.ansi-fg-bright-white) {
    color: #f2f7ff;
  }

  .log-empty {
    color: #8ea4d6;
    font-size: 13px;
    text-align: center;
    padding-top: 200px;
  }

  .log-cursor {
    display: inline-block;
    color: var(--el-color-primary);
    animation: blink 1s step-end infinite;
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
  }
</style>

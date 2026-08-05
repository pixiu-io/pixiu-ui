<!-- Pod 文件浏览：左目录树 + 右文件表（文件多时可纵向滚动） -->
<template>
  <div class="k8s-pod-files-pane">
    <div class="pod-files-toolbar">
      <div class="pod-files-toolbar__left">
        <span class="pod-files-label">容器</span>
        <ElSelect
          v-model="selectedContainer"
          class="pod-files-container-select"
          placeholder="请选择容器"
          :disabled="!containerOptions.length || !isRunning"
        >
          <ElOption v-for="c in containerOptions" :key="c" :label="c" :value="c" />
        </ElSelect>
        <span class="pod-files-path-text">{{ currentPath }}</span>
      </div>
      <div class="pod-files-toolbar__right">
        <div
          :class="[
            'pod-files-icon-btn',
            { 'is-spinning': loading, 'is-disabled': !canBrowse }
          ]"
          role="button"
          tabindex="0"
          title="刷新"
          @click="canBrowse && refreshCurrent()"
          @keyup.enter="canBrowse && refreshCurrent()"
        >
          <ArtSvgIcon icon="ri:refresh-line" class="text-g-700" />
        </div>
        <div
          :class="['pod-files-icon-btn', { 'is-disabled': !canBrowse || uploading }]"
          role="button"
          tabindex="0"
          title="上传文件到当前目录"
          @click="triggerUpload"
          @keyup.enter="triggerUpload"
        >
          <ArtSvgIcon
            :icon="uploading ? 'ri:loader-4-line' : 'ri:upload-2-line'"
            :class="['text-g-700', { 'is-spinning-icon': uploading }]"
          />
        </div>
        <div
          :class="[
            'pod-files-icon-btn',
            { 'is-disabled': !selectedDownloadable || !!downloadingPath }
          ]"
          role="button"
          tabindex="0"
          title="下载选中文件"
          @click="downloadSelected"
          @keyup.enter="downloadSelected"
        >
          <ArtSvgIcon
            :icon="downloadingPath ? 'ri:loader-4-line' : 'ri:download-2-line'"
            :class="['text-g-700', { 'is-spinning-icon': !!downloadingPath }]"
          />
        </div>
        <input
          ref="fileInputRef"
          type="file"
          class="pod-files-upload-input"
          @change="onUploadFileChange"
        />
      </div>
    </div>

    <ElAlert
      v-if="!isRunning"
      type="warning"
      :closable="false"
      show-icon
      class="pod-files-alert"
      title="仅 Running 状态的 Pod 支持文件浏览"
    />
    <ElAlert
      v-else-if="errorMessage"
      type="error"
      :closable="false"
      show-icon
      class="pod-files-alert"
      :title="errorMessage"
    />

    <div ref="bodyRef" class="pod-files-body">
      <div class="pod-files-tree-pane" :style="{ width: `${treeWidth}px` }">
        <ElTree
          :key="`${selectedContainer}-${treeReloadKey}`"
          ref="treeRef"
          class="pod-files-tree"
          node-key="path"
          highlight-current
          :props="treeProps"
          :load="loadTreeNode"
          lazy
          :expand-on-click-node="false"
          :current-node-key="currentPath"
          @node-click="onTreeNodeClick"
        >
          <template #default="{ data }">
            <span class="pod-files-tree-node">
              <ArtSvgIcon icon="ri:folder-fill" class="pod-files-tree-node__icon" />
              <span class="pod-files-tree-node__label">{{ data.label }}</span>
            </span>
          </template>
        </ElTree>
      </div>

      <div
        class="pod-files-resizer"
        title="拖动调整宽度"
        @mousedown="onResizeStart"
      />

      <div class="pod-files-table-pane">
        <ElTable
          v-loading="loading"
          :data="tableRows"
          class="pod-files-table"
          height="100%"
          :fit="false"
          :show-header="true"
          :border="false"
          highlight-current-row
          empty-text="暂无数据"
          @row-click="onRowClick"
          @row-dblclick="onRowDblClick"
        >
          <ElTableColumn
            label="文件名"
            width="260"
            show-overflow-tooltip
            sortable
            :sort-method="sortByName"
          >
            <template #default="{ row }">
              <div
                class="pod-files-name"
                :class="{ 'is-dir': row.isParent || row.type === 'dir' }"
                @click.stop="onNameClick(row)"
              >
                <ArtSvgIcon :icon="rowIcon(row)" class="pod-files-name__icon" :class="rowIconClass(row)" />
                <span>{{ row.name }}</span>
              </div>
            </template>
          </ElTableColumn>
          <ElTableColumn label="大小" width="120" align="right">
            <template #default="{ row }">
              <span class="pod-files-cell">{{ formatSize(row) }}</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="类型" width="110" align="center">
            <template #default="{ row }">
              <span class="pod-files-cell">{{ formatType(row) }}</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="修改时间" width="180" align="center">
            <template #default="{ row }">
              <span class="pod-files-cell">{{ row.modTime ? formatTime(row.modTime) : '-' }}</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="权限" width="130" align="center">
            <template #default="{ row }">
              <span class="pod-files-cell">{{ row.isParent ? '-' : row.mode || '-' }}</span>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { fetchK8sPod, type K8sPod } from '@/api/kubernetes/pod'
  import {
    downloadPodFile,
    fetchPodFileList,
    uploadPodFile,
    type PodFileEntry
  } from '@/api/kubernetes/pod-files'

  defineOptions({ name: 'K8sPodFilesPane' })

  const props = withDefaults(
    defineProps<{
      cluster: string
      namespace: string
      podName: string
      active?: boolean
      phase?: string
    }>(),
    { active: false, phase: '' }
  )

  type FileRow = PodFileEntry & { isParent?: boolean }
  type TreeNode = {
    path: string
    label: string
    isLeaf?: boolean
  }

  const treeRef = ref<{ setCurrentKey: (key: string) => void } | null>(null)
  const bodyRef = ref<HTMLElement | null>(null)
  const TREE_WIDTH_MIN = 140
  const TREE_WIDTH_MAX = 420
  const treeWidth = ref(200)
  let resizing = false
  let resizeStartX = 0
  let resizeStartWidth = 200

  const pod = ref<K8sPod | null>(null)
  const selectedContainer = ref('')
  const currentPath = ref('/')
  const items = ref<PodFileEntry[]>([])
  const selectedRow = ref<FileRow | null>(null)
  const loading = ref(false)
  const errorMessage = ref('')
  const downloadingPath = ref('')
  const uploading = ref(false)
  const fileInputRef = ref<HTMLInputElement | null>(null)
  const treeReloadKey = ref(0)
  let loadedOnce = false

  const treeProps = {
    label: 'label',
    children: 'children',
    isLeaf: 'isLeaf'
  }

  const isRunning = computed(() => (props.phase || pod.value?.status?.phase) === 'Running')

  const containerOptions = computed(() =>
    (pod.value?.spec?.containers ?? []).map((c) => c.name ?? '').filter(Boolean)
  )

  const canBrowse = computed(
    () =>
      !!props.cluster &&
      !!props.namespace &&
      !!props.podName &&
      !!selectedContainer.value &&
      isRunning.value
  )

  const selectedDownloadable = computed(() => {
    const row = selectedRow.value
    return !!row && canDownload(row)
  })

  const tableRows = computed<FileRow[]>(() => {
    const rows: FileRow[] = []
    if (currentPath.value !== '/') {
      rows.push({ name: '..', type: 'dir', size: 0, isParent: true })
    }
    rows.push(...items.value)
    return rows
  })

  function joinPath(base: string, name: string): string {
    if (base === '/') return `/${name}`
    return `${base.replace(/\/$/, '')}/${name}`
  }

  function parentPath(p: string): string {
    if (p === '/' || !p) return '/'
    const parts = p.split('/').filter(Boolean)
    parts.pop()
    return parts.length ? `/${parts.join('/')}` : '/'
  }

  function rowFullPath(row: FileRow): string {
    if (row.isParent) return parentPath(currentPath.value)
    return joinPath(currentPath.value, row.name)
  }

  function rowIcon(row: FileRow): string {
    if (row.isParent) return 'ri:folder-shared-line'
    if (row.type === 'dir') return 'ri:folder-fill'
    if (row.type === 'link') return 'ri:link'
    return 'ri:file-text-line'
  }

  function rowIconClass(row: FileRow): string {
    if (row.isParent || row.type === 'dir') return 'is-folder'
    if (row.type === 'link') return 'is-link'
    return 'is-file'
  }

  function canDownload(row: FileRow): boolean {
    return !row.isParent && (row.type === 'file' || row.type === 'link' || row.type === 'dir')
  }

  function formatType(row: FileRow): string {
    if (row.isParent) return '-'
    if (row.type === 'dir') return '文件夹'
    if (row.type === 'file') return '文件'
    if (row.type === 'link') return '软链接'
    return '其他'
  }

  function formatSize(row: FileRow): string {
    if (row.isParent || row.type === 'dir') return '-'
    const n = Number(row.size) || 0
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
    return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`
  }

  function formatTime(iso: string): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  function sortByName(a: FileRow, b: FileRow): number {
    if (a.isParent) return -1
    if (b.isParent) return 1
    return a.name.localeCompare(b.name)
  }

  async function ensurePod() {
    if (!props.cluster || !props.namespace || !props.podName) {
      pod.value = null
      selectedContainer.value = ''
      return
    }
    try {
      const p = await fetchK8sPod(props.cluster, props.namespace, props.podName)
      pod.value = p
      if (!selectedContainer.value || !containerOptions.value.includes(selectedContainer.value)) {
        selectedContainer.value = containerOptions.value[0] ?? ''
      }
    } catch {
      pod.value = null
      selectedContainer.value = ''
    }
  }

  async function listDir(path: string): Promise<PodFileEntry[]> {
    const res = await fetchPodFileList({
      cluster: props.cluster,
      namespace: props.namespace,
      pod: props.podName,
      container: selectedContainer.value,
      path
    })
    return res.items
  }

  async function loadFiles(path = currentPath.value) {
    if (!canBrowse.value) {
      items.value = []
      return
    }
    loading.value = true
    errorMessage.value = ''
    selectedRow.value = null
    try {
      const res = await fetchPodFileList({
        cluster: props.cluster,
        namespace: props.namespace,
        pod: props.podName,
        container: selectedContainer.value,
        path
      })
      currentPath.value = res.path || path
      items.value = res.items
      await nextTick()
      treeRef.value?.setCurrentKey(currentPath.value)
    } catch (e) {
      items.value = []
      errorMessage.value = e instanceof Error ? e.message : '获取文件列表失败'
    } finally {
      loading.value = false
    }
  }

  async function loadTreeNode(node: { level: number; data: TreeNode }, resolve: (data: TreeNode[]) => void) {
    if (!canBrowse.value) {
      resolve([])
      return
    }
    try {
      if (node.level === 0) {
        resolve([{ path: '/', label: '/', isLeaf: false }])
        return
      }
      const dirPath = node.data.path || '/'
      const entries = await listDir(dirPath)
      const children = entries
        .filter((item) => item.type === 'dir')
        .map((item) => ({
          path: joinPath(dirPath, item.name),
          label: item.name,
          isLeaf: false
        }))
      resolve(children)
    } catch {
      resolve([])
    }
  }

  function onTreeNodeClick(data: TreeNode) {
    if (!data?.path) return
    void goToPath(data.path)
  }

  function goToPath(path: string) {
    const next = path || '/'
    if (next === currentPath.value) {
      void loadFiles(next)
      return
    }
    currentPath.value = next
    void loadFiles(next)
  }

  function refreshCurrent() {
    treeReloadKey.value++
    void loadFiles(currentPath.value)
  }

  function onRowClick(row: FileRow) {
    selectedRow.value = row
  }

  function onNameClick(row: FileRow) {
    selectedRow.value = row
    if (row.isParent || row.type === 'dir') {
      goToPath(rowFullPath(row))
    }
  }

  function onRowDblClick(row: FileRow) {
    onNameClick(row)
  }

  async function onDownload(row: FileRow) {
    if (!canDownload(row) || !canBrowse.value) return
    const fullPath = rowFullPath(row)
    downloadingPath.value = fullPath
    try {
      await downloadPodFile({
        cluster: props.cluster,
        namespace: props.namespace,
        pod: props.podName,
        container: selectedContainer.value,
        path: fullPath,
        filename: row.type === 'dir' ? `${row.name}.tar` : row.name
      })
      ElMessage.success(row.type === 'dir' ? '开始下载文件夹' : '开始下载')
    } catch (e) {
      ElMessage.error(e instanceof Error ? e.message : '下载失败')
    } finally {
      downloadingPath.value = ''
    }
  }

  function downloadSelected() {
    if (!selectedDownloadable.value || downloadingPath.value) return
    if (selectedRow.value) void onDownload(selectedRow.value)
  }

  function triggerUpload() {
    if (!canBrowse.value || uploading.value) return
    fileInputRef.value?.click()
  }

  async function onUploadFileChange(ev: Event) {
    const input = ev.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file || !canBrowse.value) return

    uploading.value = true
    try {
      await uploadPodFile({
        cluster: props.cluster,
        namespace: props.namespace,
        pod: props.podName,
        container: selectedContainer.value,
        path: currentPath.value,
        file
      })
      ElMessage.success(`已上传 ${file.name}`)
      refreshCurrent()
    } catch (e) {
      ElMessage.error(e instanceof Error ? e.message : '上传失败')
    } finally {
      uploading.value = false
    }
  }

  function clampTreeWidth(width: number): number {
    const bodyWidth = bodyRef.value?.clientWidth ?? 800
    const maxByBody = Math.max(TREE_WIDTH_MIN, bodyWidth - 320)
    const max = Math.min(TREE_WIDTH_MAX, maxByBody)
    return Math.min(max, Math.max(TREE_WIDTH_MIN, width))
  }

  function onResizeMove(e: MouseEvent) {
    if (!resizing) return
    const delta = e.clientX - resizeStartX
    treeWidth.value = clampTreeWidth(resizeStartWidth + delta)
  }

  function onResizeEnd() {
    if (!resizing) return
    resizing = false
    document.body.classList.remove('pod-files-resizing')
    window.removeEventListener('mousemove', onResizeMove)
    window.removeEventListener('mouseup', onResizeEnd)
  }

  function onResizeStart(e: MouseEvent) {
    e.preventDefault()
    resizing = true
    resizeStartX = e.clientX
    resizeStartWidth = treeWidth.value
    document.body.classList.add('pod-files-resizing')
    window.addEventListener('mousemove', onResizeMove)
    window.addEventListener('mouseup', onResizeEnd)
  }

  onBeforeUnmount(() => {
    onResizeEnd()
  })

  watch(
    () => [props.active, props.cluster, props.namespace, props.podName] as const,
    async ([active]) => {
      if (!active) return
      await ensurePod()
      if (!loadedOnce) {
        currentPath.value = '/'
        loadedOnce = true
      }
      if (canBrowse.value) await loadFiles('/')
    },
    { immediate: true }
  )

  watch(selectedContainer, (c, prev) => {
    if (!props.active || !c || c === prev) return
    currentPath.value = '/'
    treeReloadKey.value++
    void loadFiles('/')
  })

  watch(treeReloadKey, async () => {
    // force remount lazy tree by clearing and reloading root via key on wrapper if needed
    await nextTick()
  })
</script>

<style scoped>
  .k8s-pod-files-pane {
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 560px;
    min-height: 480px;
    margin-top: 8px;
  }

  .pod-files-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-shrink: 0;
    padding: 8px 10px;
    background: var(--el-fill-color-blank);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
  }

  .pod-files-toolbar__left,
  .pod-files-toolbar__right {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .pod-files-icon-btn {
    display: flex;
    width: 24px;
    height: 24px;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--el-text-color-secondary);
    border-radius: 4px;
    transition: background-color 0.15s ease;
    flex-shrink: 0;
  }

  .pod-files-icon-btn:hover:not(.is-disabled) {
    background: color-mix(in srgb, var(--art-gray-300) 45%, transparent);
  }

  .pod-files-icon-btn.is-disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .pod-files-icon-btn.is-spinning :deep(svg),
  .pod-files-icon-btn.is-spinning :deep(.i-svg),
  .pod-files-icon-btn :deep(.is-spinning-icon),
  .pod-files-icon-btn :deep(.is-spinning-icon svg),
  .pod-files-icon-btn :deep(.is-spinning-icon .i-svg) {
    animation: pod-files-icon-spin 0.9s linear infinite;
    transform-origin: center;
  }

  @keyframes pod-files-icon-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .pod-files-label {
    font-size: 12px;
    color: var(--el-text-color-regular);
    flex-shrink: 0;
  }

  .pod-files-container-select {
    width: 180px;
  }

  .pod-files-path-text {
    font-size: 12px;
    color: var(--el-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pod-files-alert {
    flex-shrink: 0;
  }

  .pod-files-body {
    flex: 1;
    min-height: 0;
    display: flex;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
    overflow: hidden;
    background: var(--el-bg-color);
  }

  .pod-files-tree-pane {
    flex-shrink: 0;
    border-right: none;
    overflow: auto;
    padding: 8px 4px;
    background: var(--el-fill-color-light);
    scrollbar-width: thin;
    scrollbar-color: transparent transparent;
  }

  .pod-files-tree-pane:hover {
    scrollbar-color: rgba(144, 147, 153, 0.45) transparent;
  }

  .pod-files-tree-pane::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  .pod-files-tree-pane::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 3px;
  }

  .pod-files-tree-pane:hover::-webkit-scrollbar-thumb {
    background: rgba(144, 147, 153, 0.45);
  }

  .pod-files-tree-pane::-webkit-scrollbar-track {
    background: transparent;
  }

  .pod-files-resizer {
    width: 4px;
    flex-shrink: 0;
    cursor: col-resize;
    background: var(--el-border-color-lighter);
    position: relative;
    z-index: 2;
    transition: background-color 0.15s;
  }

  .pod-files-resizer:hover,
  .pod-files-resizer:active {
    background: var(--el-color-primary-light-5);
  }

  .pod-files-resizer::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: -3px;
    right: -3px;
  }

  .pod-files-table-pane {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .pod-files-tree {
    background: transparent;
    font-size: 12px;
    color: var(--el-text-color-primary);
    --el-tree-node-hover-bg-color: var(--el-fill-color);
    --el-tree-text-color: var(--el-text-color-primary);
    --el-tree-expand-icon-color: var(--el-text-color-secondary);
  }

  .pod-files-tree :deep(.el-tree-node__content) {
    height: 30px;
    border-radius: 4px;
    background: transparent;
  }

  .pod-files-tree :deep(.el-tree-node__content:hover) {
    background: var(--el-fill-color);
  }

  .pod-files-tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
  }

  .pod-files-tree :deep(.el-tree-node__expand-icon) {
    color: var(--el-text-color-secondary);
  }

  .pod-files-tree :deep(.el-tree-node__expand-icon.is-leaf) {
    color: transparent;
  }

  .pod-files-tree-node {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    color: inherit;
  }

  .pod-files-tree-node__icon {
    color: var(--el-color-warning);
    font-size: 15px;
    flex-shrink: 0;
  }

  .pod-files-tree-node__label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: inherit;
  }

  .pod-files-table {
    width: 100%;
    --el-table-row-height: 36px;
    --el-table-border-color: transparent;
  }

  .pod-files-table :deep(.el-table__inner-wrapper::before),
  .pod-files-table :deep(.el-table__border-left-patch),
  .pod-files-table :deep(.el-table__body tr td.el-table__cell),
  .pod-files-table :deep(.el-table__header tr th.el-table__cell) {
    border-bottom: none !important;
  }

  .pod-files-table :deep(.el-table__header-wrapper) {
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  /* 与集群列表单元格一致：12px，行高更紧凑 */
  .pod-files-table :deep(.el-table__cell) {
    font-size: 12px;
    color: var(--el-text-color-primary);
    padding: 4px 8px !important;
  }

  .pod-files-table :deep(.el-table__header .el-table__cell) {
    font-size: 12px;
    color: var(--el-text-color-regular);
    font-weight: 500;
    padding: 6px 8px !important;
  }

  .pod-files-table :deep(.el-table__row) {
    height: 36px;
  }

  .pod-files-table :deep(.el-table__body tr) {
    cursor: pointer;
  }

  .pod-files-table :deep(.el-table__body .el-table__cell .cell) {
    line-height: 20px;
    padding: 0;
  }

  .pod-files-table :deep(.el-table__header .el-table__cell .cell) {
    line-height: 20px;
    padding: 0;
  }

  .pod-files-table :deep(.el-table__body-wrapper) {
    overflow-y: auto !important;
    scrollbar-width: thin;
    scrollbar-color: transparent transparent;
  }

  .pod-files-table-pane:hover :deep(.el-table__body-wrapper) {
    scrollbar-color: rgba(144, 147, 153, 0.45) transparent;
  }

  .pod-files-table :deep(.el-table__body-wrapper::-webkit-scrollbar) {
    width: 6px;
    height: 6px;
  }

  .pod-files-table :deep(.el-table__body-wrapper::-webkit-scrollbar-thumb) {
    background: transparent;
    border-radius: 3px;
  }

  .pod-files-table-pane:hover :deep(.el-table__body-wrapper::-webkit-scrollbar-thumb) {
    background: rgba(144, 147, 153, 0.45);
  }

  .pod-files-table :deep(.el-table__body-wrapper::-webkit-scrollbar-track) {
    background: transparent;
  }

  .pod-files-cell {
    font-size: 12px;
    color: var(--el-text-color-primary);
    line-height: 20px;
  }

  .pod-files-upload-input {
    display: none;
  }

  .pod-files-action {
    font-size: 12px;
    height: auto;
    padding: 0;
  }

  .pod-files-name {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--el-text-color-primary);
    line-height: 20px;
    cursor: default;
  }

  .pod-files-name.is-dir {
    cursor: pointer;
    color: var(--el-color-primary);
  }

  .pod-files-name__icon {
    font-size: 15px;
    flex-shrink: 0;
  }

  .pod-files-name__icon.is-folder {
    color: #e6a23c;
  }

  .pod-files-name__icon.is-link {
    color: var(--el-color-primary);
  }

  .pod-files-name__icon.is-file {
    color: var(--el-text-color-secondary);
  }

  .pod-files-op-placeholder {
    color: var(--el-text-color-placeholder);
  }
</style>

<style>
  body.pod-files-resizing {
    cursor: col-resize !important;
    user-select: none !important;
  }

  body.pod-files-resizing * {
    cursor: col-resize !important;
    user-select: none !important;
  }
</style>

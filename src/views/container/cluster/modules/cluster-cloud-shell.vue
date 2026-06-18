<template>
  <Teleport to="#app-main" v-if="visible">
    <div
      class="cluster-cloud-shell-anchor"
      :style="anchorStyle"
    >
      <section class="cluster-cloud-shell-sheet" :style="sheetStyle">
        <div
          class="cluster-cloud-shell-resize-handle"
          title="拖拽调整高度"
          @mousedown.prevent="startResize"
        />
        <header class="cluster-cloud-shell-tabbar">
          <div class="cluster-cloud-shell-tabs">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              type="button"
              class="cluster-cloud-shell-tab"
              :class="{ 'is-active': tab.id === activeTabId }"
              @click="switchTab(tab.id)"
            >
              <span class="cluster-cloud-shell-tab-label">
                Kubectl:
                <span class="cluster-cloud-shell-tab-cluster">{{ tab?.clusterAlias || '' }}</span>
              </span>
              <span
                class="cluster-cloud-shell-tab-close"
                title="关闭"
                @click.stop="closeTab(tab.id)"
              >
                <ElIcon :size="14"><Close /></ElIcon>
              </span>
            </button>
          </div>
        </header>
        <div
          v-for="tab in tabs"
          v-show="tab.id === activeTabId"
          :key="tab.id"
          class="cluster-cloud-shell-body"
        >
          <div
            :ref="(el) => registerXtermHost(tab.id, el as HTMLElement | null)"
            class="cluster-cloud-shell-xterm"
            tabindex="-1"
            @click="focusActiveTab"
          />
        </div>
        <footer class="cluster-cloud-shell-footer">
          <ElButton
            type="primary"
            class="cluster-cloud-shell-footer-btn"
            :style="footerBtnStyle"
            :loading="activeTab?.connecting"
            :disabled="activeTab?.connecting"
            v-ripple
            @click="reconnectActive"
          >
            {{ footerConnectLabel }}
          </ElButton>
          <span
            class="cluster-cloud-shell-footer-status"
            :class="{
              'is-connected': activeTab?.connected && !activeTab?.connecting,
              'is-connecting': activeTab?.connecting
            }"
            >{{ footerStatusText }}</span
          >
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
  import { Close } from '@element-plus/icons-vue'
  import { ElButton, ElIcon, ElMessage } from 'element-plus'
  import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
  import { storeToRefs } from 'pinia'
  import { useSettingStore } from '@/store/modules/setting'
  import { resolvePixiuWsOrigin } from '@/utils/pixiu-ws-origin'
  import { FitAddon } from '@xterm/addon-fit'
  import { Terminal, type ITheme } from '@xterm/xterm'
  import '@xterm/xterm/css/xterm.css'

  defineOptions({ name: 'ClusterCloudShell' })

  interface CloudShellOpenOpts {
    clusterName: string
    clusterAlias?: string
    clusterId: number
    userId: number
  }

  interface CloudShellTab {
    id: string
    clusterName: string
    clusterAlias: string
    clusterId: number
    userId: number
    connecting: boolean
    connected: boolean
  }

  interface TabRuntime {
    ws: WebSocket | null
    xterm: Terminal | null
    fitAddon: FitAddon | null
    resizeObserver: ResizeObserver | null
    hostEl: HTMLElement | null
  }

  const visible = ref(false)
  const tabs = ref<CloudShellTab[]>([])
  const activeTabId = ref('')
  const panelRect = ref({ left: 0, top: 0, width: 0, height: 0 })
  const sheetHeight = ref(320)

  const MIN_SHEET_HEIGHT = 160
  const MAX_SHEET_HEIGHT_RATIO = 0.88
  const DEFAULT_SHEET_HEIGHT = 320

  let tabSeq = 0
  const tabRuntimes = new Map<string, TabRuntime>()
  let layoutResizeObserver: ResizeObserver | null = null

  const activeTab = computed(() => tabs.value.find((t) => t.id === activeTabId.value) ?? null)

  const footerConnectLabel = computed(() => {
    const tab = activeTab.value
    if (!tab || tab.connecting) return '连接'
    return tab.connected ? '重连' : '连接'
  })

  const footerStatusText = computed(() => {
    const tab = activeTab.value
    if (!tab) return ''
    if (tab.connecting) return '正在连接...'
    if (tab.connected) return '已连接'
    return '已断开'
  })

  const footerBtnStyle = {
    height: '30px',
    minHeight: '24px',
    padding: '0 14px',
    fontSize: '12px',
    lineHeight: '1'
  } as const

  const settingStore = useSettingStore()
  const { isDark } = storeToRefs(settingStore)

  const TERMINAL_THEME_DARK: ITheme = {
    background: '#0f0f0f',
    foreground: '#d4d4d4',
    cursor: '#d4d4d4'
  }

  const TERMINAL_THEME_LIGHT: ITheme = {
    background: '#f5f5f5',
    foreground: '#303133',
    cursor: '#303133'
  }

  function getTerminalTheme(): ITheme {
    if (typeof document !== 'undefined' && !document.documentElement.classList.contains('dark')) {
      return TERMINAL_THEME_LIGHT
    }
    return TERMINAL_THEME_DARK
  }

  function applyTerminalThemeToAll() {
    const theme = getTerminalTheme()
    for (const tab of tabs.value) {
      const rt = tabRuntimes.get(tab.id)
      if (!rt?.xterm) continue
      rt.xterm.options.theme = theme
    }
  }

  const anchorStyle = computed(() => {
    const { left, width } = panelRect.value
    return {
      left: `${left}px`,
      width: `${width}px`,
      height: `${sheetHeight.value}px`,
      bottom: '0px'
    }
  })

  const sheetStyle = computed(() => ({
    height: `${sheetHeight.value}px`
  }))

  function createRuntime(): TabRuntime {
    return { ws: null, xterm: null, fitAddon: null, resizeObserver: null, hostEl: null }
  }

  function getRuntime(tabId: string): TabRuntime {
    let rt = tabRuntimes.get(tabId)
    if (!rt) {
      rt = createRuntime()
      tabRuntimes.set(tabId, rt)
    }
    return rt
  }

  function syncPanelRect() {
    const main = document.getElementById('app-main')
    if (!main) return
    const rect = main.getBoundingClientRect()
    panelRect.value = {
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    }
    const maxH = Math.round(rect.height * MAX_SHEET_HEIGHT_RATIO)
    if (sheetHeight.value > maxH) sheetHeight.value = maxH
  }

  function bindLayoutResizeObserver() {
    layoutResizeObserver?.disconnect()
    if (typeof ResizeObserver === 'undefined') return
    layoutResizeObserver = new ResizeObserver(() => {
      syncPanelRect()
      nextTick(() => fitActiveTab())
    })
    const main = document.getElementById('app-main')
    const sidebar = document.getElementById('app-sidebar')
    if (main) layoutResizeObserver.observe(main)
    if (sidebar) layoutResizeObserver.observe(sidebar)
  }

  function unbindLayoutResizeObserver() {
    layoutResizeObserver?.disconnect()
    layoutResizeObserver = null
  }

  function onWindowResize() {
    if (!visible.value) return
    syncPanelRect()
    nextTick(() => fitActiveTab())
  }

  function buildWsUrl(tab: CloudShellTab): string {
    const base = resolvePixiuWsOrigin()
    return (
      `${base}/pixiu/kubeproxy/clusters/ws` +
      `?cluster_name=${encodeURIComponent(tab.clusterName)}` +
      `&cluster_id=${encodeURIComponent(String(tab.clusterId))}` +
      `&user_id=${encodeURIComponent(String(tab.userId))}`
    )
  }

  function registerXtermHost(tabId: string, el: any) {
    if (!tabId) return
    const rt = getRuntime(tabId)
    rt.hostEl = el as HTMLElement | null
  }

  function initXterm(tab: CloudShellTab) {
    if (!tab || !tab.id) return
    const rt = getRuntime(tab.id)
    const host = rt.hostEl
    if (!host) return
    disposeXterm(tab.id)
    const xterm = new Terminal({
      cursorBlink: true,
      fontFamily: "'JetBrains Mono', Menlo, Monaco, Consolas, monospace",
      fontSize: 12,
      lineHeight: 1.2,
      theme: getTerminalTheme(),
      scrollback: 8000
    })
    const fitAddon = new FitAddon()
    xterm.loadAddon(fitAddon)
    xterm.open(host)
    fitAddon.fit()
    xterm.onData((data) => {
      if (!rt.ws || rt.ws.readyState !== WebSocket.OPEN) return
      rt.ws.send(JSON.stringify({ operation: 'stdin', data }))
    })
    rt.xterm = xterm
    rt.fitAddon = fitAddon
    if (typeof ResizeObserver !== 'undefined') {
      rt.resizeObserver = new ResizeObserver(() => fitTab(tab.id))
      rt.resizeObserver.observe(host)
    }
  }

  function fitTab(tabId: string) {
    if (!tabId) return
    const tab = tabs.value.find((t) => t.id === tabId)
    const rt = tabRuntimes.get(tabId)
    if (!tab || !rt?.xterm || !rt.fitAddon || !rt.ws || rt.ws.readyState !== WebSocket.OPEN) return
    rt.fitAddon.fit()
    rt.ws.send(JSON.stringify({ operation: 'resize', cols: rt.xterm.cols, rows: rt.xterm.rows }))
  }

  function fitActiveTab() {
    if (activeTabId.value) fitTab(activeTabId.value)
  }

  function closeSocket(tabId: string) {
    if (!tabId) return
    const rt = tabRuntimes.get(tabId)
    if (!rt?.ws) return
    rt.ws.onopen = null
    rt.ws.onclose = null
    rt.ws.onerror = null
    rt.ws.onmessage = null
    rt.ws.close()
    rt.ws = null
  }

  function disposeXterm(tabId: string) {
    if (!tabId) return
    const rt = tabRuntimes.get(tabId)
    if (!rt) return
    if (rt.resizeObserver) {
      rt.resizeObserver.disconnect()
      rt.resizeObserver = null
    }
    rt.xterm?.dispose()
    rt.xterm = null
    rt.fitAddon = null
  }

  function disposeTab(tabId: string) {
    if (!tabId) return
    closeSocket(tabId)
    disposeXterm(tabId)
    tabRuntimes.delete(tabId)
  }

  function findTab(tabId: string): CloudShellTab | undefined {
    return tabs.value.find((t) => t.id === tabId)
  }

  function setTabConnectionState(
    tabId: string,
    state: Partial<Pick<CloudShellTab, 'connecting' | 'connected'>>
  ) {
    const tab = findTab(tabId)
    if (!tab) return
    if (state.connecting !== undefined) tab.connecting = state.connecting
    if (state.connected !== undefined) tab.connected = state.connected
  }

  function connectTab(tab: CloudShellTab) {
    if (!tab || !tab.id) return
    const tabId = tab.id
    closeSocket(tabId)
    setTabConnectionState(tabId, { connecting: true, connected: false })
    const url = buildWsUrl(tab)
    if (!url) {
      setTabConnectionState(tabId, { connecting: false })
      ElMessage.warning('CloudShell 会话参数不完整')
      return
    }
    const token = localStorage.getItem('pixiu-access-token')
    const ws = token ? new WebSocket(url, [token]) : new WebSocket(url)
    const rt = getRuntime(tabId)
    rt.ws = ws

    ws.onopen = () => {
      setTabConnectionState(tabId, { connecting: false, connected: true })
      const currentTab = findTab(tabId)
      if (!currentTab) return
      nextTick(() => {
        initXterm(currentTab)
        if (tabId === activeTabId.value) {
          syncPanelRect()
          fitTab(tabId)
          rt.xterm?.focus()
        }
      })
    }
    ws.onmessage = (event) => {
      const text = typeof event.data === 'string' ? event.data : String(event.data)
      try {
        const msg = JSON.parse(text) as { operation?: string; data?: string }
        if ((msg.operation === 'stdout' || msg.operation === 'stderr') && msg.data) {
          rt.xterm?.write(String(msg.data))
        }
      } catch {
        rt.xterm?.write(text)
      }
    }
    ws.onerror = () => {
      setTabConnectionState(tabId, { connecting: false, connected: false })
      const currentTab = findTab(tabId)
      ElMessage.error(`CloudShell 连接出错 (${currentTab?.clusterAlias || ''})`)
    }
    ws.onclose = () => {
      setTabConnectionState(tabId, { connecting: false, connected: false })
      rt.xterm?.writeln('\x1b[33m[连接已断开]\x1b[0m')
    }
  }

  function createTab(opts: CloudShellOpenOpts): CloudShellTab {
    if (!opts) {
      opts = { clusterName: '', clusterId: 0, userId: 0 }
    }
    return {
      id: `cs-${++tabSeq}`,
      clusterName: opts.clusterName || '',
      clusterAlias: opts.clusterAlias || opts.clusterName || '',
      clusterId: opts.clusterId || 0,
      userId: opts.userId || 0,
      connecting: true,
      connected: false
    }
  }

  function open(opts: CloudShellOpenOpts) {
    if (!opts) return
    const existing = tabs.value.find((t) => t.clusterId === opts.clusterId)
    if (existing) {
      activeTabId.value = existing.id
      visible.value = true
      nextTick(() => {
        syncPanelRect()
        bindLayoutResizeObserver()
        focusActiveTab()
      })
      return
    }

    const tab = createTab(opts)
    tabs.value.push(tab)
    activeTabId.value = tab.id
    visible.value = true
    nextTick(() => {
      syncPanelRect()
      bindLayoutResizeObserver()
      connectTab(tab)
    })
  }
  defineExpose({ open })

  function switchTab(tabId: string) {
    if (!tabId || activeTabId.value === tabId) return
    activeTabId.value = tabId
    const tab = tabs.value.find((t) => t.id === tabId)
    if (!tab) return
    nextTick(() => {
      const rt = getRuntime(tabId)
      if (!rt.xterm && rt.ws?.readyState === WebSocket.OPEN) {
        initXterm(tab)
      }
      fitTab(tabId)
      rt.xterm?.focus()
    })
  }

  function closeTab(tabId: string) {
    if (!tabId) return
    const idx = tabs.value.findIndex((t) => t.id === tabId)
    if (idx < 0) return
    disposeTab(tabId)
    tabs.value.splice(idx, 1)
    if (!tabs.value.length) {
      visible.value = false
      return
    }
    if (activeTabId.value === tabId) {
      const next = tabs.value[Math.min(idx, tabs.value.length - 1)]
      if (next) {
        activeTabId.value = next.id
        nextTick(() => focusActiveTab())
      }
    }
  }

  function reconnectActive() {
    const tab = activeTab.value
    if (!tab || !tab.id || tab.connecting) return
    connectTab(tab)
  }

  function focusActiveTab() {
    if (!activeTabId.value) return
    const rt = tabRuntimes.get(activeTabId.value)
    rt?.xterm?.focus()
  }

  function startResize(e: MouseEvent) {
    const startY = e.clientY
    const startH = sheetHeight.value
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev: MouseEvent) => {
      const maxH = Math.max(
        MIN_SHEET_HEIGHT,
        Math.round(panelRect.value.height * MAX_SHEET_HEIGHT_RATIO)
      )
      const next = Math.min(maxH, Math.max(MIN_SHEET_HEIGHT, startH + (startY - ev.clientY)))
      sheetHeight.value = next
      fitActiveTab()
    }
    const onUp = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  function cleanupAll() {
    for (const tab of tabs.value) disposeTab(tab.id)
    tabs.value = []
    activeTabId.value = ''
    unbindLayoutResizeObserver()
    sheetHeight.value = DEFAULT_SHEET_HEIGHT
  }

  watch(visible, (open) => {
    if (!open) {
      cleanupAll()
      return
    }
    nextTick(() => {
      syncPanelRect()
      fitActiveTab()
    })
  })

  watch(isDark, () => {
    nextTick(() => applyTerminalThemeToAll())
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', onWindowResize)
    cleanupAll()
  })

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', onWindowResize)
  }
</script>

<style>
  /* 仅占底部高度，不遮挡上方页面操作 */
  .cluster-cloud-shell-anchor {
    position: fixed;
    z-index: 1200;
    pointer-events: none;
    --cluster-cloud-shell-terminal-bg: #0f0f0f;
  }

  html:not(.dark) .cluster-cloud-shell-anchor {
    --cluster-cloud-shell-terminal-bg: #f5f5f5;
  }

  .cluster-cloud-shell-sheet {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--el-bg-color);
    border-top: 1px solid var(--el-border-color-lighter);
    box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.12);
    pointer-events: auto;
    min-height: 0;
  }

  .cluster-cloud-shell-resize-handle {
    position: absolute;
    top: -4px;
    left: 0;
    right: 0;
    height: 8px;
    cursor: ns-resize;
    z-index: 2;
  }

  .cluster-cloud-shell-resize-handle:hover {
    background: linear-gradient(
      to bottom,
      transparent,
      color-mix(in srgb, var(--el-color-primary) 35%, transparent)
    );
  }

  .cluster-cloud-shell-tabbar {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 4px 0 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
    background: var(--el-fill-color-blank);
    box-sizing: border-box;
    flex-shrink: 0;
  }

  .cluster-cloud-shell-tabs {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: thin;
  }

  .cluster-cloud-shell-tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 280px;
    height: 36px;
    padding: 0 8px 0 10px;
    border: none;
    border-right: 1px solid var(--el-border-color-lighter);
    background: transparent;
    color: var(--el-text-color-regular);
    font-size: 13px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .cluster-cloud-shell-tab.is-active {
    background: var(--el-bg-color);
    color: var(--el-text-color-primary);
    font-weight: 500;
  }

  .cluster-cloud-shell-tab-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
  }

  .cluster-cloud-shell-tab-cluster {
    margin-left: 4px;
    font-family: 'JetBrains Mono', Consolas, monospace;
    color: var(--el-color-primary);
  }

  .cluster-cloud-shell-tab.is-active .cluster-cloud-shell-tab-cluster {
    color: var(--el-color-primary);
  }

  .cluster-cloud-shell-tab-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    color: var(--el-text-color-secondary);
    flex-shrink: 0;
  }

  .cluster-cloud-shell-tab-close:hover {
    color: var(--el-color-primary);
    background: var(--el-fill-color-light);
  }

  .cluster-cloud-shell-footer {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
    min-height: 44px;
    padding: 8px 12px;
    border-top: 1px solid var(--el-border-color-lighter);
    background: var(--el-fill-color-blank);
    box-sizing: border-box;
  }

  .cluster-cloud-shell-footer .cluster-cloud-shell-footer-btn.el-button.el-button--primary {
    height: 24px !important;
    min-height: 24px !important;
    padding: 0 14px !important;
    font-size: 12px !important;
    line-height: 1 !important;
  }

  .cluster-cloud-shell-footer .cluster-cloud-shell-footer-btn.el-button > span {
    font-size: 12px !important;
  }

  .cluster-cloud-shell-footer-status {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.4;
  }

  .cluster-cloud-shell-footer-status.is-connected {
    color: var(--el-color-success);
  }

  .cluster-cloud-shell-footer-status.is-connecting {
    color: var(--el-color-warning);
  }

  .cluster-cloud-shell-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--cluster-cloud-shell-terminal-bg);
  }

  .cluster-cloud-shell-xterm {
    flex: 1;
    min-height: 0;
    width: 100%;
    box-sizing: border-box;
    margin: 0;
    padding: 4px 8px 8px 10px;
    border-radius: 0;
    background: var(--cluster-cloud-shell-terminal-bg);
    outline: none;
    overflow: hidden;
    cursor: text;
  }

  .cluster-cloud-shell-xterm .xterm {
    width: 100%;
    height: 100%;
    padding: 0;
    background-color: var(--cluster-cloud-shell-terminal-bg);
  }

  .cluster-cloud-shell-xterm .xterm-screen {
    background-color: var(--cluster-cloud-shell-terminal-bg);
  }

  .cluster-cloud-shell-xterm .xterm-viewport {
    overflow-y: auto !important;
    background-color: var(--cluster-cloud-shell-terminal-bg) !important;
  }
</style>

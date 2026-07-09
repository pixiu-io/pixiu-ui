<template>
  <Teleport to="#app-main" v-if="visible">
    <div class="pod-shell-anchor" :style="anchorStyle">
      <section class="pod-shell-sheet" :style="sheetStyle">
        <div
          v-if="!isMaximized"
          class="pod-shell-resize-handle"
          title="拖拽调整高度"
          @mousedown.prevent="startResize"
        />
        <header class="pod-shell-tabbar">
          <div class="pod-shell-tabs">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              type="button"
              class="pod-shell-tab"
              :class="{ 'is-active': tab.id === activeTabId }"
              @click="switchTab(tab.id)"
            >
              <span class="pod-shell-tab-label">
                PodShell:
                <span class="pod-shell-tab-target">{{ tab.targetLabel }}</span>
              </span>
              <span class="pod-shell-tab-close" title="关闭" @click.stop="closeTab(tab.id)">
                <ElIcon :size="14"><Close /></ElIcon>
              </span>
            </button>
          </div>
          <div class="pod-shell-window-actions">
            <button type="button" class="pod-shell-window-btn" title="最小化" @click.stop="minimizePodShell">
              <ElIcon :size="14"><Minus /></ElIcon>
            </button>
            <button
              type="button"
              class="pod-shell-window-btn"
              :title="isMaximized ? '还原' : '最大化'"
              @click.stop="toggleMaximizePodShell"
            >
              <ElIcon :size="14">
                <ScaleToOriginal v-if="isMaximized" />
                <FullScreen v-else />
              </ElIcon>
            </button>
            <button
              type="button"
              class="pod-shell-window-btn pod-shell-window-btn--close"
              title="关闭"
              @click.stop="closePodShell"
            >
              <ElIcon :size="14"><Close /></ElIcon>
            </button>
          </div>
        </header>
        <div
          v-for="tab in tabs"
          v-show="tab.id === activeTabId"
          :key="tab.id"
          class="pod-shell-body"
        >
          <div
            :ref="(el) => registerXtermHost(tab.id, el as HTMLElement | null)"
            class="pod-shell-xterm"
            tabindex="-1"
            @click="focusActiveTab"
          />
        </div>
        <footer class="pod-shell-footer">
          <ElButton
            type="primary"
            class="pod-shell-footer-btn"
            :style="footerBtnStyle"
            :loading="activeTab?.connecting"
            :disabled="activeTab?.connecting"
            v-ripple
            @click="reconnectActive"
          >
            {{ footerConnectLabel }}
          </ElButton>
          <span
            class="pod-shell-footer-status"
            :class="{
              'is-connected': activeTab?.connected && !activeTab?.connecting,
              'is-connecting': activeTab?.connecting
            }"
          >{{ footerStatusText }}</span>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
  import { Close, FullScreen, Minus, ScaleToOriginal } from '@element-plus/icons-vue'
  import { ElButton, ElIcon, ElMessage } from 'element-plus'
  import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
  import { storeToRefs } from 'pinia'
  import { useSettingStore } from '@/store/modules/setting'
  import { resolvePixiuWsOrigin } from '@/utils/pixiu-ws-origin'
  import { FitAddon } from '@xterm/addon-fit'
  import { Terminal, type ITheme } from '@xterm/xterm'
  import '@xterm/xterm/css/xterm.css'

  defineOptions({ name: 'PodRemoteWebshell' })

  interface PodWebshellOpenOpts {
    cluster: string
    namespace: string
    pod: string
    container: string
    command?: string
  }

  interface PodShellTab {
    id: string
    cluster: string
    namespace: string
    pod: string
    container: string
    command: string
    allowShFallback: boolean
    targetLabel: string
    connecting: boolean
    connected: boolean
  }

  interface TabRuntime {
    ws: WebSocket | null
    xterm: Terminal | null
    fitAddon: FitAddon | null
    resizeObserver: ResizeObserver | null
    hostEl: HTMLElement | null
    idleTimer: ReturnType<typeof setTimeout> | null
    bashToShFallbackDone: boolean
    suppressNextSocketCloseMessage: boolean
    fitRaf: number
  }

  const EXEC_FAIL_RE =
    /exec pod command failed|OCI runtime exec|unable to start container process|stat\s+["']?\/bin\/(ba)?sh["']?\s*[:：]\s*no such file|exec:\s*["']\/bin\/(ba)?sh["']/i

  const IDLE_TIMEOUT = 10 * 60 * 1000
  const MIN_SHEET_HEIGHT = 160
  const DEFAULT_SHEET_HEIGHT_RATIO = 0.48
  const DEFAULT_SHEET_HEIGHT = 420

  const visible = ref(false)
  const tabs = ref<PodShellTab[]>([])
  const activeTabId = ref('')
  const panelRect = ref({ left: 0, top: 0, width: 0, height: 0 })
  const sheetHeight = ref(DEFAULT_SHEET_HEIGHT)
  const isMaximized = ref(false)
  const sheetHeightBeforeMaximize = ref(DEFAULT_SHEET_HEIGHT)

  let tabSeq = 0
  const tabRuntimes = new Map<string, TabRuntime>()
  let layoutResizeObserver: ResizeObserver | null = null

  const settingStore = useSettingStore()
  const { isDark } = storeToRefs(settingStore)

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

  const TERMINAL_THEME_DARK: ITheme = {
    background: '#0f0f0f',
    foreground: '#d4d4d4',
    cursor: '#d4d4d4',
    selectionBackground: 'rgba(255, 255, 255, 0.25)',
    selectionForeground: '#ffffff'
  }

  const TERMINAL_THEME_LIGHT: ITheme = {
    background: '#eceff1',
    foreground: '#5f6368',
    cursor: '#5f6368',
    selectionBackground: 'rgba(64, 158, 255, 0.28)',
    selectionForeground: '#3c4043',
    black: '#5f6368',
    red: '#e53935',
    green: '#43a047',
    yellow: '#fb8c00',
    blue: '#1e88e5',
    magenta: '#8e24aa',
    cyan: '#00acc1',
    white: '#eceff1',
    brightBlack: '#80868b',
    brightRed: '#ef5350',
    brightGreen: '#66bb6a',
    brightYellow: '#ffa726',
    brightBlue: '#42a5f5',
    brightMagenta: '#ab47bc',
    brightCyan: '#26c6da',
    brightWhite: '#5f6368'
  }

  function getTerminalTheme(): ITheme {
    if (typeof document !== 'undefined' && !document.documentElement.classList.contains('dark')) {
      return TERMINAL_THEME_LIGHT
    }
    return TERMINAL_THEME_DARK
  }

  /** 参考 CloudShell，连接成功后展示欢迎语 */
  function writeWelcomeBanner(xterm: Terminal) {
    const reset = '\x1b[0m'
    const hint = '\x1b[36m'
    xterm.writeln('Welcome to Pixiu Pod Shell!')
    xterm.writeln(`${hint}Type commands to interact with your container${reset}`)
    xterm.writeln('')
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
    return {
      ws: null,
      xterm: null,
      fitAddon: null,
      resizeObserver: null,
      hostEl: null,
      idleTimer: null,
      bashToShFallbackDone: false,
      suppressNextSocketCloseMessage: false,
      fitRaf: 0
    }
  }

  function getRuntime(tabId: string): TabRuntime {
    let rt = tabRuntimes.get(tabId)
    if (!rt) {
      rt = createRuntime()
      tabRuntimes.set(tabId, rt)
    }
    return rt
  }

  function buildTargetLabel(tab: Pick<PodShellTab, 'namespace' | 'pod' | 'container'>) {
    return `${tab.namespace}/${tab.pod}@${tab.container}`
  }

  function buildTabKey(opts: PodWebshellOpenOpts) {
    return `${opts.cluster}/${opts.namespace}/${opts.pod}@${opts.container}`
  }

  function createTabFromOpts(opts: PodWebshellOpenOpts): PodShellTab {
    const explicit = (opts.command ?? '').trim()
    const command = explicit || '/bin/bash'
    const tab: PodShellTab = {
      id: `ps-${++tabSeq}`,
      cluster: opts.cluster,
      namespace: opts.namespace,
      pod: opts.pod,
      container: opts.container,
      command,
      allowShFallback: !explicit,
      targetLabel: '',
      connecting: true,
      connected: false
    }
    tab.targetLabel = buildTargetLabel(tab)
    return tab
  }

  function findTab(tabId: string) {
    return tabs.value.find((t) => t.id === tabId)
  }

  function setTabConnectionState(
    tabId: string,
    state: Partial<Pick<PodShellTab, 'connecting' | 'connected'>>
  ) {
    const tab = findTab(tabId)
    if (!tab) return
    if (state.connecting !== undefined) tab.connecting = state.connecting
    if (state.connected !== undefined) tab.connected = state.connected
  }

  function registerXtermHost(tabId: string, el: HTMLElement | null) {
    if (!tabId) return
    getRuntime(tabId).hostEl = el
  }

  function getMaxSheetHeight(): number {
    if (typeof window === 'undefined') return DEFAULT_SHEET_HEIGHT
    const header = document.getElementById('app-header')
    if (header) {
      const maxH = Math.round(window.innerHeight - header.getBoundingClientRect().bottom)
      return Math.max(MIN_SHEET_HEIGHT, maxH)
    }
    const main = document.getElementById('app-main')
    if (main) {
      const maxH = Math.round(main.getBoundingClientRect().height)
      return Math.max(MIN_SHEET_HEIGHT, maxH)
    }
    return DEFAULT_SHEET_HEIGHT
  }

  function resolveDefaultSheetHeight(): number {
    const mainHeight = panelRect.value.height
    if (!mainHeight) return DEFAULT_SHEET_HEIGHT
    const maxH = getMaxSheetHeight()
    const preferred = Math.round(mainHeight * DEFAULT_SHEET_HEIGHT_RATIO)
    return Math.min(maxH, Math.max(MIN_SHEET_HEIGHT, preferred))
  }

  function applyDefaultSheetHeight() {
    syncPanelRect()
    sheetHeight.value = resolveDefaultSheetHeight()
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
    const maxH = getMaxSheetHeight()
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

  function buildWsUrl(tab: PodShellTab): string {
    const base = resolvePixiuWsOrigin()
    return (
      `${base}/pixiu/kubeproxy/pods/ws` +
      `?cluster=${encodeURIComponent(tab.cluster)}` +
      `&namespace=${encodeURIComponent(tab.namespace)}` +
      `&pod=${encodeURIComponent(tab.pod)}` +
      `&container=${encodeURIComponent(tab.container)}` +
      `&command=${encodeURIComponent(tab.command)}`
    )
  }

  function writeSystemLine(tabId: string, message: string, color: 'yellow' | 'red' = 'yellow') {
    const rt = tabRuntimes.get(tabId)
    if (!rt?.xterm) return
    const code = color === 'red' ? '\x1b[31m' : '\x1b[33m'
    rt.xterm.writeln(`${code}${message.replace(/\r?\n/g, '')}\x1b[0m`)
  }

  function clearIdleTimer(rt: TabRuntime) {
    if (rt.idleTimer) {
      clearTimeout(rt.idleTimer)
      rt.idleTimer = null
    }
  }

  function resetIdleTimer(tabId: string) {
    const rt = getRuntime(tabId)
    clearIdleTimer(rt)
    rt.idleTimer = setTimeout(() => {
      writeSystemLine(tabId, '[连接因长时间无操作已自动断开]')
      closeSocket(tabId)
    }, IDLE_TIMEOUT)
  }

  function sendStdin(tabId: string, text: string) {
    const rt = tabRuntimes.get(tabId)
    if (!rt?.ws || rt.ws.readyState !== WebSocket.OPEN) return
    resetIdleTimer(tabId)
    rt.ws.send(JSON.stringify({ operation: 'stdin', data: text }))
  }

  function sendResize(tabId: string, cols: number, rows: number) {
    const rt = tabRuntimes.get(tabId)
    if (!rt?.ws || rt.ws.readyState !== WebSocket.OPEN) return
    rt.ws.send(JSON.stringify({ operation: 'resize', cols, rows }))
  }

  function scheduleFit(tabId: string) {
    const rt = getRuntime(tabId)
    if (rt.fitRaf) cancelAnimationFrame(rt.fitRaf)
    rt.fitRaf = requestAnimationFrame(() => {
      rt.fitRaf = 0
      fitTab(tabId)
    })
  }

  function fitTab(tabId: string) {
    const rt = tabRuntimes.get(tabId)
    if (!rt?.xterm || !rt.fitAddon || !rt.ws || rt.ws.readyState !== WebSocket.OPEN) return
    try {
      rt.fitAddon.fit()
    } catch {
      /* ignore */
    }
    sendResize(tabId, rt.xterm.cols, rt.xterm.rows)
  }

  function fitActiveTab() {
    if (activeTabId.value) fitTab(activeTabId.value)
  }

  function disposeXterm(tabId: string) {
    const rt = tabRuntimes.get(tabId)
    if (!rt) return
    if (rt.resizeObserver) {
      rt.resizeObserver.disconnect()
      rt.resizeObserver = null
    }
    if (rt.fitRaf) {
      cancelAnimationFrame(rt.fitRaf)
      rt.fitRaf = 0
    }
    try {
      rt.xterm?.dispose()
    } catch {
      /* ignore */
    }
    rt.xterm = null
    rt.fitAddon = null
  }

  function closeSocket(tabId: string) {
    const rt = tabRuntimes.get(tabId)
    if (!rt) return
    clearIdleTimer(rt)
    if (!rt.ws) return
    rt.ws.onopen = null
    rt.ws.onclose = null
    rt.ws.onerror = null
    rt.ws.onmessage = null
    rt.ws.close()
    rt.ws = null
  }

  function disposeTab(tabId: string) {
    if (!tabId) return
    closeSocket(tabId)
    disposeXterm(tabId)
    tabRuntimes.delete(tabId)
  }

  function initXterm(tab: PodShellTab) {
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
    writeWelcomeBanner(xterm)
    fitAddon.fit()
    xterm.onData((data) => sendStdin(tab.id, data))
    rt.xterm = xterm
    rt.fitAddon = fitAddon
    if (typeof ResizeObserver !== 'undefined') {
      rt.resizeObserver = new ResizeObserver(() => scheduleFit(tab.id))
      rt.resizeObserver.observe(host)
    }
  }

  function parseWsText(raw: unknown): string {
    if (typeof raw === 'string') return raw
    if (raw instanceof ArrayBuffer) return new TextDecoder().decode(raw)
    return String(raw)
  }

  function trySwitchToShAfterBashFailure(tab: PodShellTab, rt: TabRuntime): boolean {
    if (rt.bashToShFallbackDone || !tab.allowShFallback || tab.command !== '/bin/bash') return false
    rt.bashToShFallbackDone = true
    tab.command = '/bin/sh'
    tab.allowShFallback = false
    rt.suppressNextSocketCloseMessage = true
    closeSocket(tab.id)
    setTabConnectionState(tab.id, { connecting: true, connected: false })
    connectTab(tab, { keepLog: true })
    return true
  }

  function connectTab(tab: PodShellTab, options?: { keepLog?: boolean }) {
    const tabId = tab.id
    const rt = getRuntime(tabId)
    closeSocket(tabId)
    if (!options?.keepLog) {
      disposeXterm(tabId)
      rt.bashToShFallbackDone = false
      rt.suppressNextSocketCloseMessage = false
    }
    setTabConnectionState(tabId, { connecting: true, connected: false })

    const url = buildWsUrl(tab)
    if (!url) {
      setTabConnectionState(tabId, { connecting: false })
      if (rt.xterm) writeSystemLine(tabId, '[会话参数不完整]', 'red')
      else ElMessage.warning('会话参数不完整')
      return
    }

    const token = localStorage.getItem('pixiu-access-token')
    const ws = token ? new WebSocket(url, [token]) : new WebSocket(url)
    rt.ws = ws

    ws.onopen = () => {
      setTabConnectionState(tabId, { connecting: false, connected: true })
      resetIdleTimer(tabId)
      const currentTab = findTab(tabId)
      if (!currentTab) return
      const mount = () => {
        const runtime = getRuntime(tabId)
        if (!runtime.hostEl) {
          requestAnimationFrame(mount)
          return
        }
        if (!runtime.xterm) initXterm(currentTab)
        if (tabId === activeTabId.value) {
          syncPanelRect()
          fitTab(tabId)
          runtime.xterm?.focus()
        }
      }
      nextTick(() => mount())
    }

    ws.onmessage = (event) => {
      const str = parseWsText(event.data)
      resetIdleTimer(tabId)
      const currentTab = findTab(tabId)
      if (!currentTab) return
      try {
        const msg = JSON.parse(str) as { operation?: string; data?: string }
        const op = msg.operation
        const data = msg.data != null ? String(msg.data) : ''
        if ((op === 'stdout' || op === 'stderr') && data) {
          if (EXEC_FAIL_RE.test(data) && trySwitchToShAfterBashFailure(currentTab, rt)) return
          rt.xterm?.write(data)
        }
      } catch {
        if (EXEC_FAIL_RE.test(str) && trySwitchToShAfterBashFailure(currentTab, rt)) return
        rt.xterm?.write(str)
      }
    }

    ws.onerror = () => {
      const currentTab = findTab(tabId)
      if (currentTab && trySwitchToShAfterBashFailure(currentTab, rt)) return
      setTabConnectionState(tabId, { connecting: false, connected: false })
      clearIdleTimer(rt)
      if (rt.xterm) writeSystemLine(tabId, '[连接出错，请检查集群、命名空间与容器是否可用]', 'red')
      else ElMessage.error('连接出错')
    }

    ws.onclose = () => {
      if (rt.suppressNextSocketCloseMessage) {
        rt.suppressNextSocketCloseMessage = false
        return
      }
      setTabConnectionState(tabId, { connecting: false, connected: false })
      clearIdleTimer(rt)
      if (rt.xterm) writeSystemLine(tabId, '[连接已断开]')
    }
  }

  function open(opts: PodWebshellOpenOpts) {
    const key = buildTabKey(opts)
    const existing = tabs.value.find(
      (t) => buildTabKey(t) === key
    )
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

    if (!tabs.value.length) {
      applyDefaultSheetHeight()
    }

    const tab = createTabFromOpts(opts)
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
    const tab = findTab(tabId)
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
    if (!tab || tab.connecting) return
    connectTab(tab, { keepLog: true })
  }

  function focusActiveTab() {
    if (!activeTabId.value) return
    tabRuntimes.get(activeTabId.value)?.xterm?.focus()
  }

  function closePodShell() {
    visible.value = false
  }

  function minimizePodShell() {
    visible.value = false
  }

  function toggleMaximizePodShell() {
    if (isMaximized.value) {
      sheetHeight.value = sheetHeightBeforeMaximize.value
      isMaximized.value = false
      nextTick(() => fitActiveTab())
      return
    }
    sheetHeightBeforeMaximize.value = sheetHeight.value
    syncPanelRect()
    sheetHeight.value = getMaxSheetHeight()
    isMaximized.value = true
    nextTick(() => fitActiveTab())
  }

  function startResize(e: MouseEvent) {
    const startY = e.clientY
    const startH = sheetHeight.value
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev: MouseEvent) => {
      isMaximized.value = false
      const maxH = getMaxSheetHeight()
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
    isMaximized.value = false
    applyDefaultSheetHeight()
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
  .pod-shell-anchor {
    position: fixed;
    z-index: 1200;
    pointer-events: none;
    --pod-shell-terminal-bg: #0f0f0f;
  }

  html:not(.dark) .pod-shell-anchor {
    --pod-shell-terminal-bg: #eceff1;
  }

  .pod-shell-sheet {
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

  .pod-shell-resize-handle {
    position: absolute;
    top: -4px;
    left: 0;
    right: 0;
    height: 8px;
    cursor: ns-resize;
    z-index: 2;
  }

  .pod-shell-resize-handle:hover {
    background: linear-gradient(
      to bottom,
      transparent,
      color-mix(in srgb, var(--el-color-primary) 35%, transparent)
    );
  }

  .pod-shell-tabbar {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 32px;
    padding: 0 2px 0 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
    background: var(--el-fill-color-blank);
    box-sizing: border-box;
    flex-shrink: 0;
  }

  .pod-shell-window-actions {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    height: 32px;
    padding-right: 4px;
    border-left: 1px solid var(--el-border-color-lighter);
  }

  .pod-shell-window-btn {
    box-sizing: border-box;
    width: 28px;
    height: 28px;
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
  }

  .pod-shell-window-btn:hover {
    color: var(--el-text-color-primary);
    background-color: var(--el-fill-color-light);
  }

  .pod-shell-window-btn--close:hover {
    color: var(--el-color-danger);
    background-color: var(--el-color-danger-light-9);
  }

  .pod-shell-tabs {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: thin;
  }

  .pod-shell-tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 280px;
    height: 30px;
    padding: 0 8px 0 10px;
    border: none;
    border-right: 1px solid var(--el-border-color-lighter);
    background: transparent;
    color: var(--el-text-color-regular);
    font-size: 13px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .pod-shell-tab.is-active {
    background: var(--el-bg-color);
    color: var(--el-text-color-primary);
    font-weight: 500;
  }

  .pod-shell-tab-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
  }

  .pod-shell-tab-target {
    margin-left: 4px;
    font-family: 'JetBrains Mono', Consolas, monospace;
    color: var(--el-color-primary);
  }

  .pod-shell-tab.is-active .pod-shell-tab-target {
    color: var(--el-color-primary);
  }

  .pod-shell-tab-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    color: var(--el-text-color-secondary);
    flex-shrink: 0;
  }

  .pod-shell-tab-close:hover {
    color: var(--el-color-primary);
    background: var(--el-fill-color-light);
  }

  .pod-shell-footer {
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

  .pod-shell-footer .pod-shell-footer-btn.el-button.el-button--primary {
    height: 24px !important;
    min-height: 24px !important;
    padding: 0 14px !important;
    font-size: 12px !important;
    line-height: 1 !important;
  }

  .pod-shell-footer .pod-shell-footer-btn.el-button > span {
    font-size: 12px !important;
  }

  .pod-shell-footer-status {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.4;
  }

  .pod-shell-footer-status.is-connected {
    color: var(--el-color-success);
  }

  .pod-shell-footer-status.is-connecting {
    color: var(--el-color-warning);
  }

  .pod-shell-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--pod-shell-terminal-bg);
  }

  .pod-shell-xterm {
    flex: 1;
    min-height: 0;
    width: 100%;
    box-sizing: border-box;
    margin: 0;
    padding: 4px 8px 8px 10px;
    border-radius: 0;
    background: var(--pod-shell-terminal-bg);
    outline: none;
    overflow: hidden;
    cursor: text;
  }

  .pod-shell-xterm .xterm {
    width: 100%;
    height: 100%;
    padding: 0;
    background-color: var(--pod-shell-terminal-bg);
  }

  .pod-shell-xterm .xterm-screen {
    background-color: var(--pod-shell-terminal-bg);
  }

  .pod-shell-xterm .xterm-viewport {
    overflow-y: auto !important;
    background-color: var(--pod-shell-terminal-bg) !important;
  }

  html:not(.dark) .pod-shell-xterm ::selection {
    background-color: rgba(64, 158, 255, 0.28);
    color: #3c4043;
  }
</style>

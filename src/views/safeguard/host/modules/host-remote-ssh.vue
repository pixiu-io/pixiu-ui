<!-- Web SSH：仅传 host，服务端按 IP 查 nodes 表取凭证。主机管理 / 集群节点详情共用。 -->
<template>
  <Teleport to="#app-main" v-if="visible">
    <div class="host-shell-anchor" :style="anchorStyle">
      <section class="host-shell-sheet" :style="sheetStyle">
        <div
          v-if="!isMaximized"
          class="host-shell-resize-handle"
          title="拖拽调整高度"
          @mousedown.prevent="startResize"
        />
        <header class="host-shell-tabbar">
          <div class="host-shell-tabs">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              type="button"
              class="host-shell-tab"
              :class="{ 'is-active': tab.id === activeTabId }"
              @click="switchTab(tab.id)"
            >
              <span class="host-shell-tab-label">
                HostShell:
                <span class="host-shell-tab-host">{{ tab.host }}</span>
              </span>
              <span class="host-shell-tab-close" title="关闭" @click.stop="closeTab(tab.id)">
                <ElIcon :size="14"><Close /></ElIcon>
              </span>
            </button>
          </div>
          <div class="host-shell-window-actions">
            <button type="button" class="host-shell-window-btn" title="最小化" @click.stop="minimizeHostShell">
              <ElIcon :size="14"><Minus /></ElIcon>
            </button>
            <button
              type="button"
              class="host-shell-window-btn"
              :title="isMaximized ? '还原' : '最大化'"
              @click.stop="toggleMaximizeHostShell"
            >
              <ElIcon :size="14">
                <ScaleToOriginal v-if="isMaximized" />
                <FullScreen v-else />
              </ElIcon>
            </button>
            <button
              type="button"
              class="host-shell-window-btn host-shell-window-btn--close"
              title="关闭"
              @click.stop="closeHostShell"
            >
              <ElIcon :size="14"><Close /></ElIcon>
            </button>
          </div>
        </header>
        <div
          v-for="tab in tabs"
          v-show="tab.id === activeTabId"
          :key="tab.id"
          class="host-shell-body"
        >
          <div
            :ref="(el) => registerXtermHost(tab.id, el as HTMLElement | null)"
            class="host-shell-xterm"
            tabindex="-1"
            @click="focusActiveTab"
          />
        </div>
        <footer class="host-shell-footer">
          <ElButton
            type="primary"
            class="host-shell-footer-btn"
            :style="footerBtnStyle"
            :loading="activeTab?.connecting"
            :disabled="activeTab?.connecting"
            v-ripple
            @click="reconnectActive"
          >
            {{ footerConnectLabel }}
          </ElButton>
          <span
            class="host-shell-footer-status"
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
  import { ElButton, ElIcon, ElMessage, ElMessageBox } from 'element-plus'
  import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
  import { storeToRefs } from 'pinia'
  import { useSettingStore } from '@/store/modules/setting'
  import { resolvePixiuWsOrigin } from '@/utils/pixiu-ws-origin'
  import { FitAddon } from '@xterm/addon-fit'
  import { Terminal, type ITheme } from '@xterm/xterm'
  import '@xterm/xterm/css/xterm.css'
  import type { PixiuNodeItem } from '@/api/node'

  defineOptions({ name: 'HostRemoteSsh' })

  interface HostShellTab {
    id: string
    host: string
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
    exitLineBuf: string
    exitDisconnectTimer: ReturnType<typeof setTimeout> | null
    fitRaf: number
  }

  const SSH_IDLE_TIMEOUT = 10 * 60 * 1000
  const MIN_SHEET_HEIGHT = 160
  const DEFAULT_SHEET_HEIGHT_RATIO = 0.48
  const DEFAULT_SHEET_HEIGHT = 420

  const visible = ref(false)
  const tabs = ref<HostShellTab[]>([])
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

  function writeWelcomeBanner(xterm: Terminal) {
    const reset = '\x1b[0m'
    const hint = '\x1b[36m'
    xterm.writeln('Welcome to Pixiu Host Shell!')
    xterm.writeln(`${hint}Type commands to interact with your remote host${reset}`)
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
      exitLineBuf: '',
      exitDisconnectTimer: null,
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

  function findTab(tabId: string) {
    return tabs.value.find((t) => t.id === tabId)
  }

  function setTabConnectionState(
    tabId: string,
    state: Partial<Pick<HostShellTab, 'connecting' | 'connected'>>
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

  function buildWsUrl(host: string): string {
    const base = resolvePixiuWsOrigin()
    return `${base}/pixiu/kubeproxy/nodes/ws?host=${encodeURIComponent(host)}`
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
    }, SSH_IDLE_TIMEOUT)
  }

  function clearExitDisconnectTimer(rt: TabRuntime) {
    if (rt.exitDisconnectTimer) {
      clearTimeout(rt.exitDisconnectTimer)
      rt.exitDisconnectTimer = null
    }
  }

  function onLocalInputForExitDetect(tabId: string, data: string) {
    const rt = getRuntime(tabId)
    if (!rt.ws || rt.ws.readyState !== WebSocket.OPEN) return
    rt.exitLineBuf += data
    if (rt.exitLineBuf.length > 2048) rt.exitLineBuf = rt.exitLineBuf.slice(-1024)
    for (;;) {
      const ix = rt.exitLineBuf.search(/[\r\n]/)
      if (ix < 0) break
      const line = rt.exitLineBuf.slice(0, ix).replace(/\r/g, '').trim()
      rt.exitLineBuf = rt.exitLineBuf.slice(ix + 1)
      if (/^(exit|logout)(\s|$)/i.test(line)) {
        clearExitDisconnectTimer(rt)
        rt.exitDisconnectTimer = setTimeout(() => {
          rt.exitDisconnectTimer = null
          if (rt.ws && rt.ws.readyState === WebSocket.OPEN) closeSocket(tabId)
        }, 250)
        break
      }
    }
  }

  function sendSshData(tabId: string, text: string) {
    const rt = tabRuntimes.get(tabId)
    if (!rt?.ws || rt.ws.readyState !== WebSocket.OPEN) return
    resetIdleTimer(tabId)
    const encoded = btoa(unescape(encodeURIComponent(text)))
    const msg = '1' + encoded
    const buf = new Uint8Array(msg.length)
    for (let i = 0; i < msg.length; i++) buf[i] = msg.charCodeAt(i)
    rt.ws.send(buf.buffer)
  }

  function sendSshResize(tabId: string, cols: number, rows: number) {
    const rt = tabRuntimes.get(tabId)
    if (!rt?.ws || rt.ws.readyState !== WebSocket.OPEN) return
    const json = JSON.stringify({ Columns: cols, Rows: rows })
    const encoded = btoa(json)
    const msg = '2' + encoded
    const buf = new Uint8Array(msg.length)
    for (let i = 0; i < msg.length; i++) buf[i] = msg.charCodeAt(i)
    rt.ws.send(buf.buffer)
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
    sendSshResize(tabId, rt.xterm.cols, rt.xterm.rows)
  }

  function fitActiveTab() {
    if (activeTabId.value) fitTab(activeTabId.value)
  }

  function disposeXterm(tabId: string) {
    const rt = tabRuntimes.get(tabId)
    if (!rt) return
    clearExitDisconnectTimer(rt)
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
    rt.exitLineBuf = ''
  }

  function closeSocket(tabId: string) {
    const rt = tabRuntimes.get(tabId)
    if (!rt) return
    clearExitDisconnectTimer(rt)
    rt.exitLineBuf = ''
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

  function initXterm(tab: HostShellTab) {
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
    xterm.onData((data) => {
      sendSshData(tab.id, data)
      onLocalInputForExitDetect(tab.id, data)
    })
    rt.xterm = xterm
    rt.fitAddon = fitAddon
    if (typeof ResizeObserver !== 'undefined') {
      rt.resizeObserver = new ResizeObserver(() => scheduleFit(tab.id))
      rt.resizeObserver.observe(host)
    }
  }

  function connectTab(tab: HostShellTab, options?: { keepLog?: boolean }) {
    const tabId = tab.id
    const rt = getRuntime(tabId)
    closeSocket(tabId)
    if (!options?.keepLog) {
      disposeXterm(tabId)
    } else if (rt.xterm) {
      writeSystemLine(tabId, '[正在重新连接...]')
    }
    setTabConnectionState(tabId, { connecting: true, connected: false })

    const url = buildWsUrl(tab.host)
    const token = localStorage.getItem('pixiu-access-token')
    const ws = token ? new WebSocket(url, [token]) : new WebSocket(url)
    ws.binaryType = 'arraybuffer'
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
      let text: string
      if (event.data instanceof ArrayBuffer) {
        text = new TextDecoder().decode(event.data)
      } else {
        text = String(event.data)
      }
      resetIdleTimer(tabId)
      rt.xterm?.write(text)
    }

    ws.onerror = () => {
      setTabConnectionState(tabId, { connecting: false, connected: false })
      clearIdleTimer(rt)
      writeSystemLine(tabId, '[连接出错，请确认主机已在平台注册且认证信息正确]', 'red')
    }

    ws.onclose = () => {
      setTabConnectionState(tabId, { connecting: false, connected: false })
      clearIdleTimer(rt)
      writeSystemLine(tabId, '[连接已断开]')
    }
  }

  function createTab(host: string): HostShellTab {
    return {
      id: `hs-${++tabSeq}`,
      host,
      connecting: true,
      connected: false
    }
  }

  function openHostSession(host: string) {
    const existing = tabs.value.find((t) => t.host === host)
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

    const tab = createTab(host)
    tabs.value.push(tab)
    activeTabId.value = tab.id
    visible.value = true
    nextTick(() => {
      syncPanelRect()
      bindLayoutResizeObserver()
      connectTab(tab)
    })
  }

  function startSessionForHost(ip: string) {
    const existing = tabs.value.find((t) => t.host === ip)
    if (existing) {
      openHostSession(ip)
      return
    }
    void ElMessageBox.confirm('远程登陆主机会通过 IP 查询登录权限，请确认？', '远程登录', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
      .then(() => openHostSession(ip))
      .catch(() => {})
  }

  function open(row: PixiuNodeItem) {
    const ip = (row.ip || '').trim()
    if (!ip) {
      ElMessage.warning('该主机暂无 IP，无法远程登录')
      return
    }
    startSessionForHost(ip)
  }

  function openByIp(ip: string) {
    const trimmed = (ip || '').trim()
    if (!trimmed) {
      ElMessage.warning('暂无 IP，无法远程登录')
      return
    }
    startSessionForHost(trimmed)
  }

  defineExpose({ open, openByIp })

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

  function closeHostShell() {
    visible.value = false
  }

  function minimizeHostShell() {
    visible.value = false
  }

  function toggleMaximizeHostShell() {
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
  .host-shell-anchor {
    position: fixed;
    z-index: 1200;
    pointer-events: none;
    --host-shell-terminal-bg: #0f0f0f;
  }

  html:not(.dark) .host-shell-anchor {
    --host-shell-terminal-bg: #eceff1;
  }

  .host-shell-sheet {
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

  .host-shell-resize-handle {
    position: absolute;
    top: -4px;
    left: 0;
    right: 0;
    height: 8px;
    cursor: ns-resize;
    z-index: 2;
  }

  .host-shell-resize-handle:hover {
    background: linear-gradient(
      to bottom,
      transparent,
      color-mix(in srgb, var(--el-color-primary) 35%, transparent)
    );
  }

  .host-shell-tabbar {
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

  .host-shell-window-actions {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    height: 32px;
    padding-right: 4px;
    border-left: 1px solid var(--el-border-color-lighter);
  }

  .host-shell-window-btn {
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

  .host-shell-window-btn:hover {
    color: var(--el-text-color-primary);
    background-color: var(--el-fill-color-light);
  }

  .host-shell-window-btn--close:hover {
    color: var(--el-color-danger);
    background-color: var(--el-color-danger-light-9);
  }

  .host-shell-tabs {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: thin;
  }

  .host-shell-tab {
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

  .host-shell-tab.is-active {
    background: var(--el-bg-color);
    color: var(--el-text-color-primary);
    font-weight: 500;
  }

  .host-shell-tab-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
  }

  .host-shell-tab-host {
    margin-left: 4px;
    font-family: 'JetBrains Mono', Consolas, monospace;
    color: var(--el-color-primary);
  }

  .host-shell-tab.is-active .host-shell-tab-host {
    color: var(--el-color-primary);
  }

  .host-shell-tab-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    color: var(--el-text-color-secondary);
    flex-shrink: 0;
  }

  .host-shell-tab-close:hover {
    color: var(--el-color-primary);
    background: var(--el-fill-color-light);
  }

  .host-shell-footer {
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

  .host-shell-footer .host-shell-footer-btn.el-button.el-button--primary {
    height: 24px !important;
    min-height: 24px !important;
    padding: 0 14px !important;
    font-size: 12px !important;
    line-height: 1 !important;
  }

  .host-shell-footer .host-shell-footer-btn.el-button > span {
    font-size: 12px !important;
  }

  .host-shell-footer-status {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.4;
  }

  .host-shell-footer-status.is-connected {
    color: var(--el-color-success);
  }

  .host-shell-footer-status.is-connecting {
    color: var(--el-color-warning);
  }

  .host-shell-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--host-shell-terminal-bg);
  }

  .host-shell-xterm {
    flex: 1;
    min-height: 0;
    width: 100%;
    box-sizing: border-box;
    margin: 0;
    padding: 4px 8px 8px 10px;
    border-radius: 0;
    background: var(--host-shell-terminal-bg);
    outline: none;
    overflow: hidden;
    cursor: text;
  }

  .host-shell-xterm .xterm {
    width: 100%;
    height: 100%;
    padding: 0;
    background-color: var(--host-shell-terminal-bg);
  }

  .host-shell-xterm .xterm-screen {
    background-color: var(--host-shell-terminal-bg);
  }

  .host-shell-xterm .xterm-viewport {
    overflow-y: auto !important;
    background-color: var(--host-shell-terminal-bg) !important;
  }

  html:not(.dark) .host-shell-xterm ::selection {
    background-color: rgba(64, 158, 255, 0.28);
    color: #3c4043;
  }
</style>

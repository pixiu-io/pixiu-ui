<!-- Pod exec WebShell：与主机远程登录（host-remote-ssh）同一套抽屉与终端样式，协议为 Pixiu TerminalMessage JSON。 -->
<template>
  <ElDrawer
    v-model="sshDrawerVisible"
    title="Pod 远程登录"
    direction="rtl"
    :size="sshDrawerFullscreen ? '100%' : '60%'"
    destroy-on-close
    :show-close="false"
    :trap-focus="false"
    class="host-ssh-drawer"
  >
    <template #header>
      <div class="host-ssh-drawer-header-inner">
        <span class="host-ssh-drawer-title">
          Pod 远程登录 —
          <span class="host-ssh-drawer-host">{{ targetLine }}</span>
        </span>
        <div class="host-ssh-header-toolbar">
          <button
            type="button"
            tabindex="-1"
            class="host-ssh-header-icon-btn"
            title="重新连接"
            :disabled="sshConnecting"
            @click.stop="reconnectWs"
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
            class="host-ssh-header-icon-btn"
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
            class="host-ssh-header-icon-btn"
            title="关闭"
            @click.stop="dismissDrawer"
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
    <div class="host-ssh-terminal-wrap">
      <div ref="xtermHostRef" class="host-ssh-xterm-host" tabindex="-1" @click="focusTerm" />
    </div>
  </ElDrawer>
</template>

<script setup lang="ts">
  import { Close, FullScreen, Refresh, ScaleToOriginal } from '@element-plus/icons-vue'
  import { ElIcon, ElMessage } from 'element-plus'
  import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
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
    /** 默认 /bin/bash，与 kube exec 一致 */
    command?: string
  }

  const sshDrawerVisible = ref(false)
  const sshDrawerFullscreen = ref(false)
  const sshConnecting = ref(false)
  const xtermHostRef = ref<HTMLElement | null>(null)

  const session = ref<{
    cluster: string
    namespace: string
    pod: string
    container: string
    command: string
  } | null>(null)

  const targetLine = computed(() => {
    const s = session.value
    if (!s) return ''
    return `${s.container} @ ${s.pod} / ${s.namespace}`
  })

  let podSocket: WebSocket | null = null
  let idleTimer: ReturnType<typeof setTimeout> | null = null
  const IDLE_TIMEOUT = 10 * 60 * 1000

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
  let resizeObserver: ResizeObserver | null = null
  let fitRaf = 0

  function open(opts: PodWebshellOpenOpts) {
    const cmd = (opts.command ?? '/bin/bash').trim() || '/bin/bash'
    session.value = {
      cluster: opts.cluster,
      namespace: opts.namespace,
      pod: opts.pod,
      container: opts.container,
      command: cmd
    }
    sshConnecting.value = true
    sshDrawerVisible.value = true
    nextTick(() => {
      connectWs()
    })
  }

  defineExpose({ open })

  function scheduleFit() {
    if (fitRaf) cancelAnimationFrame(fitRaf)
    fitRaf = requestAnimationFrame(() => {
      fitRaf = 0
      fitXtermAndResize()
    })
  }

  function onWindowResize() {
    if (!sshDrawerVisible.value || !podSocket || podSocket.readyState !== WebSocket.OPEN) return
    scheduleFit()
  }

  function detachResize() {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    window.removeEventListener('resize', onWindowResize)
  }

  function attachResize() {
    detachResize()
    window.addEventListener('resize', onWindowResize, { passive: true })
    const el = xtermHostRef.value
    if (el && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        scheduleFit()
      })
      resizeObserver.observe(el)
    }
  }

  function disposeXterm() {
    detachResize()
    if (fitRaf) {
      cancelAnimationFrame(fitRaf)
      fitRaf = 0
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
    const host = xtermHostRef.value
    if (!host) return
    disposeXterm()
    xterm = new Terminal({
      cursorBlink: true,
      fontFamily: "'JetBrains Mono', Menlo, Monaco, Consolas, 'Source Code Pro', monospace",
      fontSize: 13,
      lineHeight: 1.15,
      theme: zshLikeTerminalTheme,
      scrollback: 8000
    })
    xtermFit = new FitAddon()
    xterm.loadAddon(xtermFit)
    xterm.open(host)
    xtermFit.fit()
    attachResize()
    xterm.onData((data) => {
      resetIdleTimer()
      sendStdin(data)
    })
  }

  function fitXtermAndResize() {
    if (!xterm || !xtermFit || !podSocket || podSocket.readyState !== WebSocket.OPEN) return
    try {
      xtermFit.fit()
    } catch {
      // ignore
    }
    sendResize(xterm.cols, xterm.rows)
  }

  function writeSystemLine(message: string, color: 'yellow' | 'red' = 'yellow') {
    if (!xterm) return
    const code = color === 'red' ? '\x1b[31m' : '\x1b[33m'
    xterm.writeln(`${code}${message.replace(/\r?\n/g, '')}\x1b[0m`)
  }

  function buildWsUrl(): string {
    const base = resolvePixiuWsOrigin()
    const s = session.value
    if (!s) return ''
    return (
      `${base}/pixiu/kubeproxy/ws` +
      `?cluster=${encodeURIComponent(s.cluster)}` +
      `&namespace=${encodeURIComponent(s.namespace)}` +
      `&pod=${encodeURIComponent(s.pod)}` +
      `&container=${encodeURIComponent(s.container)}` +
      `&command=${encodeURIComponent(s.command)}`
    )
  }

  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      writeSystemLine('[连接因长时间无操作已自动断开]')
      closeSocket()
    }, IDLE_TIMEOUT)
  }

  function clearIdleTimer() {
    if (idleTimer) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
  }

  function sendStdin(text: string) {
    if (!podSocket || podSocket.readyState !== WebSocket.OPEN) return
    podSocket.send(JSON.stringify({ operation: 'stdin', data: text }))
  }

  function sendResize(cols: number, rows: number) {
    if (!podSocket || podSocket.readyState !== WebSocket.OPEN) return
    podSocket.send(JSON.stringify({ operation: 'resize', cols, rows }))
  }

  function parseWsText(raw: unknown): string {
    if (typeof raw === 'string') return raw
    if (raw instanceof ArrayBuffer) return new TextDecoder().decode(raw)
    return String(raw)
  }

  function connectWs(options?: { keepLog?: boolean }) {
    closeSocket()
    if (!options?.keepLog) {
      disposeXterm()
    } else if (xterm) {
      writeSystemLine('[正在重新连接...]')
    }
    const url = buildWsUrl()
    if (!url) {
      sshConnecting.value = false
      ElMessage.warning('会话参数不完整')
      return
    }
    const token = localStorage.getItem('pixiu-access-token')
    podSocket = token ? new WebSocket(url, [token]) : new WebSocket(url)

    podSocket.onopen = () => {
      sshConnecting.value = false
      resetIdleTimer()
      const mount = () => {
        if (!xtermHostRef.value) {
          requestAnimationFrame(mount)
          return
        }
        if (!xterm) initXterm()
        fitXtermAndResize()
        nextTick(() => {
          requestAnimationFrame(() => {
            scheduleFit()
          })
        })
        xterm?.focus()
      }
      nextTick(() => {
        mount()
      })
    }

    podSocket.onmessage = (event) => {
      const str = parseWsText(event.data)
      resetIdleTimer()
      try {
        const msg = JSON.parse(str) as { operation?: string; data?: string }
        if (msg.operation === 'stdout' && msg.data != null) {
          xterm?.write(msg.data)
        } else if (msg.operation === 'stderr' && msg.data != null) {
          xterm?.write(msg.data)
        }
      } catch {
        xterm?.write(str)
      }
      nextTick(() => focusTermIfHeaderStoleFocus())
    }

    podSocket.onerror = () => {
      sshConnecting.value = false
      clearIdleTimer()
      writeSystemLine('[连接出错，请检查集群、命名空间与容器是否可用]', 'red')
    }

    podSocket.onclose = () => {
      sshConnecting.value = false
      clearIdleTimer()
      writeSystemLine('[连接已断开]')
    }
  }

  function reconnectWs() {
    if (sshConnecting.value) return
    if (!session.value?.cluster || !session.value.namespace || !session.value.pod || !session.value.container) {
      ElMessage.warning('会话已失效，请关闭后重新打开')
      return
    }
    sshConnecting.value = true
    connectWs({ keepLog: true })
  }

  function focusTerm() {
    xterm?.focus()
  }

  function focusTermIfHeaderStoleFocus() {
    const host = xtermHostRef.value
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

  function closeSocket() {
    clearIdleTimer()
    if (podSocket) {
      podSocket.onopen = null
      podSocket.onclose = null
      podSocket.onerror = null
      podSocket.onmessage = null
      podSocket.close()
      podSocket = null
    }
  }

  function closeDrawerCleanup() {
    closeSocket()
    disposeXterm()
    sshDrawerFullscreen.value = false
    session.value = null
  }

  function dismissDrawer() {
    sshDrawerVisible.value = false
  }

  watch(
    [sshDrawerFullscreen, sshDrawerVisible],
    () => {
      if (!sshDrawerVisible.value) {
        closeDrawerCleanup()
        return
      }
      if (!podSocket || podSocket.readyState !== WebSocket.OPEN) return
      nextTick(() => {
        if (!podSocket || podSocket.readyState !== WebSocket.OPEN) return
        scheduleFit()
      })
    },
    { flush: 'post' }
  )

  onBeforeUnmount(() => {
    closeDrawerCleanup()
  })
</script>

<style scoped>
  .host-ssh-drawer-header-inner {
    display: flex;
    align-items: center;
    width: 100%;
    min-width: 0;
    gap: 8px;
  }
  .host-ssh-drawer-title {
    font-size: 14px;
    font-weight: 500;
    flex: 1;
    min-width: 0;
  }
  .host-ssh-header-toolbar {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    gap: 0;
  }
  .host-ssh-drawer-host {
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 13px;
    color: var(--el-color-primary);
  }
  .host-ssh-terminal-wrap {
    flex: 1;
    min-height: 0;
    min-width: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
  }
  .host-ssh-xterm-host {
    flex: 1;
    min-height: 0;
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
    padding: 8px 12px 24px;
    background: #000000;
    border-radius: 6px;
    outline: none;
    cursor: text;
    overflow: hidden;
  }
  .host-ssh-xterm-host:focus-within {
    box-shadow: 0 0 0 2px var(--el-color-primary-light-5);
  }
  .host-ssh-xterm-host :deep(.xterm) {
    width: 100%;
    height: 100%;
  }
  .host-ssh-xterm-host :deep(.xterm-screen) {
    width: 100%;
  }
  .host-ssh-xterm-host :deep(.xterm-viewport) {
    overflow-y: auto !important;
    margin-bottom: 2px;
  }
</style>

<style>
  .host-ssh-drawer .el-drawer__header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 0;
    padding-bottom: 12px;
  }

  .host-ssh-drawer .el-drawer__header .host-ssh-header-icon-btn {
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

  .host-ssh-drawer .el-drawer__header .host-ssh-header-icon-btn:hover:not(:disabled) {
    color: var(--el-color-primary);
    background-color: var(--el-fill-color-light);
  }

  .host-ssh-drawer .el-drawer__header .host-ssh-header-icon-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .host-ssh-drawer .el-drawer__header .host-ssh-header-icon-btn .el-icon,
  .host-ssh-drawer .el-drawer__header .host-ssh-header-icon-btn svg {
    width: 20px;
    height: 20px;
    font-size: 20px;
  }

  .host-ssh-drawer .el-drawer__body {
    padding: 4px 16px 20px;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
</style>

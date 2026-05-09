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
      <div ref="sshXtermHostRef" class="host-ssh-xterm-host" tabindex="-1" @click="focusTerm" />
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
    /** 不传则先连 /bin/bash，失败后在抽屉内自动改试 /bin/sh */
    command?: string
  }

  /** exec 失败类输出（仅匹配 K8s/OCI 运行时层的 exec 报错，不匹配 shell 内部命令输出） */
  const EXEC_FAIL_RE =
    /exec pod command failed|OCI runtime exec|unable to start container process|stat\s+["']?\/bin\/(ba)?sh["']?\s*[:：]\s*no such file|exec:\s*["']\/bin\/(ba)?sh["']/i

  /** 是否已做过「bash → sh」的一次切换，避免循环 */
  let bashToShFallbackDone = false
  /** close 用于切换 shell 时不刷「连接已断开」 */
  let suppressNextSocketCloseMessage = false

  const sshDrawerVisible = ref(false)
  const sshDrawerFullscreen = ref(false)
  const sshConnecting = ref(false)
  const sshXtermHostRef = ref<HTMLElement | null>(null)

  const session = ref<{
    cluster: string
    namespace: string
    pod: string
    container: string
    command: string
    /** 为 true 时允许在首连 bash 失败后再试 /bin/sh */
    allowShFallback?: boolean
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
    const explicit = (opts.command ?? '').trim()
    bashToShFallbackDone = false
    if (explicit) {
      session.value = {
        cluster: opts.cluster,
        namespace: opts.namespace,
        pod: opts.pod,
        container: opts.container,
        command: explicit,
        allowShFallback: false
      }
    } else {
      session.value = {
        cluster: opts.cluster,
        namespace: opts.namespace,
        pod: opts.pod,
        container: opts.container,
        command: '/bin/bash',
        allowShFallback: true
      }
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
    const el = sshXtermHostRef.value
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
    const host = sshXtermHostRef.value
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

  function trySwitchToShAfterBashFailure(source: 'exec' | 'ws'): boolean {
    const s = session.value
    if (!s || bashToShFallbackDone || !s.allowShFallback || s.command !== '/bin/bash') return false
    bashToShFallbackDone = true
    session.value = {
      ...s,
      command: '/bin/sh',
      allowShFallback: false
    }
    const msg =
      source === 'exec'
        ? '[/bin/bash 无法启动，正在尝试 /bin/sh…]'
        : '[/bin/bash 连接异常，正在尝试 /bin/sh…]'
    if (xterm) writeSystemLine(msg, 'yellow')
    suppressNextSocketCloseMessage = true
    closeSocket()
    sshConnecting.value = true
    connectWs({ keepLog: true })
    return true
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
      if (xterm) writeSystemLine('[会话参数不完整]', 'red')
      else ElMessage.warning('会话参数不完整')
      return
    }
    const token = localStorage.getItem('pixiu-access-token')
    podSocket = token ? new WebSocket(url, [token]) : new WebSocket(url)

    podSocket.onopen = () => {
      sshConnecting.value = false
      resetIdleTimer()
      const mount = () => {
        if (!sshXtermHostRef.value) {
          requestAnimationFrame(mount)
          return
        }
        if (!xterm) initXterm()
        const s = session.value
        if (s?.allowShFallback && s.command === '/bin/bash' && !options?.keepLog) {
          writeSystemLine('[正在连接 Shell…]')
        }
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
        const op = msg.operation
        const data = msg.data != null ? String(msg.data) : ''
        if ((op === 'stdout' || op === 'stderr') && data) {
          if (EXEC_FAIL_RE.test(data) && trySwitchToShAfterBashFailure('exec')) return
          xterm?.write(data)
        }
      } catch {
        if (EXEC_FAIL_RE.test(str) && trySwitchToShAfterBashFailure('exec')) return
        xterm?.write(str)
      }
      nextTick(() => focusTermIfHeaderStoleFocus())
    }

    podSocket.onerror = () => {
      if (trySwitchToShAfterBashFailure('ws')) return
      sshConnecting.value = false
      clearIdleTimer()
      if (xterm) writeSystemLine('[连接出错，请检查集群、命名空间与容器是否可用]', 'red')
      else ElMessage.error('连接出错')
    }

    podSocket.onclose = () => {
      if (suppressNextSocketCloseMessage) {
        suppressNextSocketCloseMessage = false
        return
      }
      sshConnecting.value = false
      clearIdleTimer()
      if (xterm) writeSystemLine('[连接已断开]')
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
    bashToShFallbackDone = false
    suppressNextSocketCloseMessage = false
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

<style>
  @import '@/styles/host-ssh-drawer.css';
</style>

<!-- Web SSH：仅传 host，服务端按 IP 查 nodes 表取凭证。主机管理 / 集群节点详情共用。 -->
<template>
  <ElDrawer
    v-model="sshDrawerVisible"
    title="主机远程登录"
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
          主机远程登录 —
          <span class="host-ssh-drawer-host">{{ sshForm.host }}</span>
        </span>
        <div class="host-ssh-header-toolbar">
          <button
            type="button"
            tabindex="-1"
            class="host-ssh-header-icon-btn"
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
    <div class="host-ssh-terminal-wrap">
      <div ref="sshXtermHostRef" class="host-ssh-xterm-host" tabindex="-1" @click="focusSshTerm" />
    </div>
  </ElDrawer>
</template>

<script setup lang="ts">
  import { Close, FullScreen, Refresh, ScaleToOriginal } from '@element-plus/icons-vue'
  import { ElIcon, ElMessage, ElMessageBox } from 'element-plus'
  import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
  import { resolvePixiuWsOrigin } from '@/utils/pixiu-ws-origin'
  import { FitAddon } from '@xterm/addon-fit'
  import { Terminal, type ITheme } from '@xterm/xterm'
  import '@xterm/xterm/css/xterm.css'
  import type { PixiuNodeItem } from '@/api/node'

  defineOptions({ name: 'HostRemoteSsh' })

  const sshDrawerVisible = ref(false)
  const sshDrawerFullscreen = ref(false)
  const sshConnecting = ref(false)
  const sshXtermHostRef = ref<HTMLElement | null>(null)
  let sshSocket: WebSocket | null = null
  let sshIdleTimer: ReturnType<typeof setTimeout> | null = null
  const SSH_IDLE_TIMEOUT = 10 * 60 * 1000

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
  let sshExitLineBuf = ''
  let sshExitDisconnectTimer: ReturnType<typeof setTimeout> | null = null

  const sshForm = ref({ host: '' })

  function startSessionForHost(ip: string) {
    void ElMessageBox.confirm('远程登陆主机会通过 IP 查询登录权限，请确认？', '远程登录', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
      .then(async () => {
        sshForm.value = { host: ip }
        sshConnecting.value = true
        sshDrawerVisible.value = true
        await nextTick()
        connectSsh()
      })
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

  /** 集群节点详情等：仅已知节点 IP 时与主机管理同一套确认 + WS（仅 host） */
  function openByIp(ip: string) {
    const trimmed = (ip || '').trim()
    if (!trimmed) {
      ElMessage.warning('暂无 IP，无法远程登录')
      return
    }
    startSessionForHost(trimmed)
  }

  defineExpose({ open, openByIp })

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
      lineHeight: 1.15,
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
    return `${base}/pixiu/kubeproxy/nodes/ws?host=${encodeURIComponent(f.host)}`
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
      writeXtermSystemLine('[连接出错，请确认主机已在平台注册且认证信息正确]', 'red')
    }

    sshSocket.onclose = () => {
      sshConnecting.value = false
      clearIdleTimer()
      writeXtermSystemLine('[连接已断开]')
    }
  }

  function reconnectSsh() {
    if (sshConnecting.value) return
    if (!sshForm.value.host) {
      ElMessage.warning('缺少主机地址')
      return
    }
    sshConnecting.value = true
    connectSsh({ keepLog: true })
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
</script>

<style>
  @import '@/styles/host-ssh-drawer.css';
</style>

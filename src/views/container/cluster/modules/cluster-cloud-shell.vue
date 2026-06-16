<template>
  <ElDrawer
    v-model="visible"
    title="CloudShell"
    direction="rtl"
    :size="fullscreen ? '100%' : '60%'"
    destroy-on-close
    :show-close="false"
    :trap-focus="false"
    class="host-ssh-drawer"
  >
    <template #header>
      <div class="host-ssh-drawer-header-inner">
        <span class="host-ssh-drawer-title">
          CloudShell -
          <span class="host-ssh-drawer-host">{{ titleLine }}</span>
        </span>
        <div class="host-ssh-header-toolbar">
          <button
            type="button"
            tabindex="-1"
            class="host-ssh-header-icon-btn"
            title="重新连接"
            :disabled="connecting"
            @click.stop="reconnect"
          >
            <ElIcon :size="20"><Refresh /></ElIcon>
          </button>
          <button
            type="button"
            tabindex="-1"
            class="host-ssh-header-icon-btn"
            :title="fullscreen ? '退出全屏' : '全屏'"
            @click.stop="fullscreen = !fullscreen"
          >
            <ElIcon :size="20">
              <ScaleToOriginal v-if="fullscreen" />
              <FullScreen v-else />
            </ElIcon>
          </button>
          <button
            type="button"
            tabindex="-1"
            class="host-ssh-header-icon-btn"
            title="关闭"
            @click.stop="visible = false"
          >
            <ElIcon :size="20"><Close /></ElIcon>
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

  defineOptions({ name: 'ClusterCloudShell' })

  interface CloudShellOpenOpts {
    clusterName: string
    clusterId: number
    userId: number
  }

  const visible = ref(false)
  const fullscreen = ref(false)
  const connecting = ref(false)
  const xtermHostRef = ref<HTMLElement | null>(null)
  const session = ref<CloudShellOpenOpts | null>(null)

  const titleLine = computed(() => {
    const s = session.value
    if (!s) return ''
    return `${s.clusterName} (ID: ${s.clusterId})`
  })

  let ws: WebSocket | null = null
  let xterm: Terminal | null = null
  let fitAddon: FitAddon | null = null
  let resizeObserver: ResizeObserver | null = null

  const theme: ITheme = {
    background: '#000000',
    foreground: '#eeeeee',
    cursor: '#eeeeee'
  }

  function open(opts: CloudShellOpenOpts) {
    session.value = opts
    visible.value = true
    connecting.value = true
    nextTick(() => connect())
  }
  defineExpose({ open })

  function buildWsUrl(): string {
    const s = session.value
    if (!s) return ''
    const base = resolvePixiuWsOrigin()
    return (
      `${base}/pixiu/kubeproxy/clusters/ws` +
      `?cluster_name=${encodeURIComponent(s.clusterName)}` +
      `&cluster_id=${encodeURIComponent(String(s.clusterId))}` +
      `&user_id=${encodeURIComponent(String(s.userId))}`
    )
  }

  function initXterm() {
    const host = xtermHostRef.value
    if (!host) return
    disposeXterm()
    xterm = new Terminal({
      cursorBlink: true,
      fontFamily: "'JetBrains Mono', Menlo, Monaco, Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.15,
      theme,
      scrollback: 8000
    })
    fitAddon = new FitAddon()
    xterm.loadAddon(fitAddon)
    xterm.open(host)
    fitAddon.fit()
    xterm.onData((data) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      ws.send(JSON.stringify({ operation: 'stdin', data }))
    })
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => fitAndResize())
      resizeObserver.observe(host)
    }
  }

  function fitAndResize() {
    if (!xterm || !fitAddon || !ws || ws.readyState !== WebSocket.OPEN) return
    fitAddon.fit()
    ws.send(JSON.stringify({ operation: 'resize', cols: xterm.cols, rows: xterm.rows }))
  }

  function connect() {
    closeSocket()
    const url = buildWsUrl()
    if (!url) {
      connecting.value = false
      ElMessage.warning('CloudShell 会话参数不完整')
      return
    }
    const token = localStorage.getItem('pixiu-access-token')
    ws = token ? new WebSocket(url, [token]) : new WebSocket(url)

    ws.onopen = () => {
      connecting.value = false
      nextTick(() => {
        if (!xterm) initXterm()
        fitAndResize()
        xterm?.focus()
      })
    }
    ws.onmessage = (event) => {
      const text = typeof event.data === 'string' ? event.data : String(event.data)
      try {
        const msg = JSON.parse(text) as { operation?: string; data?: string }
        if ((msg.operation === 'stdout' || msg.operation === 'stderr') && msg.data) {
          xterm?.write(String(msg.data))
        }
      } catch {
        xterm?.write(text)
      }
    }
    ws.onerror = () => {
      connecting.value = false
      ElMessage.error('CloudShell 连接出错')
    }
    ws.onclose = () => {
      connecting.value = false
      xterm?.writeln('\x1b[33m[连接已断开]\x1b[0m')
    }
  }

  function reconnect() {
    if (connecting.value) return
    connecting.value = true
    connect()
  }

  function focusTerm() {
    xterm?.focus()
  }

  function closeSocket() {
    if (!ws) return
    ws.onopen = null
    ws.onclose = null
    ws.onerror = null
    ws.onmessage = null
    ws.close()
    ws = null
  }

  function disposeXterm() {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    xterm?.dispose()
    xterm = null
    fitAddon = null
  }

  watch([fullscreen, visible], () => {
    if (!visible.value) {
      closeSocket()
      disposeXterm()
      fullscreen.value = false
      session.value = null
      return
    }
    nextTick(() => fitAndResize())
  })

  onBeforeUnmount(() => {
    closeSocket()
    disposeXterm()
  })
</script>

<style>
  @import '@/styles/host-ssh-drawer.css';
</style>

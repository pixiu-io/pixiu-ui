<!-- K8s 日志输出框：行号 + 复制 / 全屏 / 换行 / 下载 -->
<template>
  <div
    ref="rootRef"
    class="k8s-log-output"
    :class="{ 'k8s-log-output--fullscreen': isFullscreen, 'k8s-log-output--wrap': wordWrap }"
  >
    <div class="k8s-log-output__actions">
      <ElButton link type="primary" :disabled="!lines.length" @click="copyLogs">复制</ElButton>
      <ElButton link type="primary" @click="toggleFullscreen">
        {{ isFullscreen ? '退出全屏' : '全屏' }}
      </ElButton>
      <ElCheckbox v-model="wordWrap" class="k8s-log-output__wrap-check">换行</ElCheckbox>
      <ElButton link type="primary" :disabled="!lines.length" title="下载" @click="downloadLogs">
        <ElIcon :size="16"><Download /></ElIcon>
      </ElButton>
    </div>

    <div v-if="loading" class="k8s-log-output__body k8s-log-output__body--empty">
      <ElIcon class="is-loading"><Loading /></ElIcon>
      <span>加载日志…</span>
    </div>
    <div v-else-if="!lines.length" class="k8s-log-output__body k8s-log-output__body--empty">
      {{ emptyText }}
    </div>
    <div v-else ref="scrollRef" class="k8s-log-output__body">
      <div v-for="(line, idx) in lines" :key="idx" class="k8s-log-output__line">
        <span class="k8s-log-output__ln">{{ idx + 1 }}</span>
        <span class="k8s-log-output__text">{{ line }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Download, Loading } from '@element-plus/icons-vue'
  import { ElMessage } from 'element-plus'

  const props = withDefaults(
    defineProps<{
      lines?: string[]
      loading?: boolean
      emptyText?: string
      downloadName?: string
    }>(),
    {
      lines: () => [],
      loading: false,
      emptyText: '暂无日志',
      downloadName: 'pod.log'
    }
  )

  const rootRef = ref<HTMLElement | null>(null)
  const scrollRef = ref<HTMLElement | null>(null)
  const wordWrap = ref(true)
  const isFullscreen = ref(false)

  const logText = computed(() => props.lines.join('\n'))

  async function copyLogs() {
    if (!props.lines.length) return
    try {
      await navigator.clipboard.writeText(logText.value)
      ElMessage.success('已复制')
    } catch {
      ElMessage.error('复制失败')
    }
  }

  function downloadLogs() {
    if (!props.lines.length) return
    const blob = new Blob([logText.value], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = props.downloadName || 'pod.log'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function toggleFullscreen() {
    const el = rootRef.value
    if (!el) return
    if (!isFullscreen.value) {
      try {
        await el.requestFullscreen()
        isFullscreen.value = true
      } catch {
        isFullscreen.value = true
      }
    } else {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen()
      }
      isFullscreen.value = false
    }
  }

  function onFullscreenChange() {
    if (!document.fullscreenElement) {
      isFullscreen.value = false
    }
  }

  onMounted(() => {
    document.addEventListener('fullscreenchange', onFullscreenChange)
  })

  onUnmounted(() => {
    document.removeEventListener('fullscreenchange', onFullscreenChange)
    if (document.fullscreenElement === rootRef.value) {
      void document.exitFullscreen()
    }
  })

  watch(
    () => props.lines.length,
    () => {
      nextTick(() => {
        if (scrollRef.value) scrollRef.value.scrollTop = scrollRef.value.scrollHeight
      })
    }
  )
</script>

<style scoped>
  .k8s-log-output {
    display: flex;
    flex-direction: column;
    min-height: 420px;
    border: 1px solid var(--el-border-color);
    border-radius: 4px;
    background: #2d3035;
    overflow: hidden;
  }

  .k8s-log-output--fullscreen {
    position: fixed;
    inset: 0;
    z-index: 3000;
    min-height: 100vh;
    border-radius: 0;
    border: none;
  }

  .k8s-log-output__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px 2px;
    flex-shrink: 0;
    padding: 4px 8px;
    background: #383c42;
    border-bottom: 1px solid #4d5259;
  }

  .k8s-log-output__actions :deep(.el-button.is-link) {
    color: #4ea1ff;
    font-size: 12px;
    padding: 2px 4px;
    margin-left: 0;
  }

  .k8s-log-output__wrap-check {
    margin-left: 4px;
  }

  .k8s-log-output__wrap-check :deep(.el-checkbox__label) {
    color: #d8d8d8;
    font-size: 12px;
  }

  .k8s-log-output__wrap-check :deep(.el-checkbox__inner) {
    background: transparent;
    border-color: #8a8f96;
  }

  .k8s-log-output__body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 8px 0;
    font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
    font-size: 12px;
    line-height: 1.6;
  }

  .k8s-log-output__body--empty {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: #9aa0a8;
    font-size: 12px;
    font-family: inherit;
  }

  .k8s-log-output__line {
    display: flex;
    align-items: flex-start;
    min-height: 1.6em;
    padding: 0 12px 0 0;
  }

  .k8s-log-output__ln {
    flex-shrink: 0;
    width: 48px;
    padding: 0 12px 0 16px;
    text-align: right;
    color: #9aa0a8;
    user-select: none;
  }

  .k8s-log-output__text {
    flex: 1;
    min-width: 0;
    color: #e2e4e8;
    white-space: pre;
    word-break: normal;
  }

  .k8s-log-output--wrap .k8s-log-output__text {
    white-space: pre-wrap;
    word-break: break-all;
  }
</style>

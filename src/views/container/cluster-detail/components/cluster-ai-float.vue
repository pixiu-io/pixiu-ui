<template>
  <div
    ref="rootRef"
    class="cluster-ai-float"
    :class="{ 'is-dragging': dragging }"
    :style="containerStyle"
  >
    <button
      v-if="!panelVisible"
      type="button"
      class="cluster-ai-float__trigger"
      title="Pixiu 智能助手"
      @pointerdown="onTriggerPointerDown"
      @click="onTriggerClick"
    >
      <span class="cluster-ai-float__trigger-inner">
        <ArtSvgIcon icon="ri:robot-2-line" class="cluster-ai-float__trigger-icon" />
      </span>
      <span v-if="messages.length" class="cluster-ai-float__badge">{{ messages.length }}</span>
    </button>

    <div v-else class="cluster-ai-float__panel">
      <div class="cluster-ai-float__header" @pointerdown="onHeaderPointerDown">
        <div class="cluster-ai-float__header-brand">
          <span class="cluster-ai-float__header-avatar">
            <ArtSvgIcon icon="ri:robot-2-line" />
          </span>
          <div class="cluster-ai-float__title">Pixiu 智能助手</div>
        </div>
        <div class="cluster-ai-float__header-actions">
          <button
            type="button"
            class="cluster-ai-float__icon-btn"
            title="新建对话"
            @click="startNewConversation"
          >
            <ElIcon :size="16"><Plus /></ElIcon>
          </button>
          <button type="button" class="cluster-ai-float__icon-btn" title="最小化" @click="minimizePanel">
            <ElIcon :size="16"><Minus /></ElIcon>
          </button>
          <button type="button" class="cluster-ai-float__icon-btn" title="关闭" @click="minimizePanel">
            <ElIcon :size="16"><Close /></ElIcon>
          </button>
        </div>
      </div>

      <div ref="messageBodyRef" class="cluster-ai-float__messages">
        <div v-if="messages.length === 0" class="cluster-ai-float__welcome">
          <div class="cluster-ai-float__hero">
            <div class="cluster-ai-float__hero-avatar">
              <ArtSvgIcon icon="ri:robot-2-line" />
            </div>
            <div class="cluster-ai-float__hero-text">
              <div class="cluster-ai-float__hero-greeting">您好，欢迎使用</div>
              <div class="cluster-ai-float__hero-title">Pixiu 智能助手</div>
            </div>
          </div>

          <div class="cluster-ai-float__intro-card">
            <div class="cluster-ai-float__intro-icon">🔍</div>
            <div class="cluster-ai-float__intro-title">围绕指定资源进行智能答疑与排查</div>
            <div class="cluster-ai-float__intro-desc">
              已自动关联集群
              <span class="cluster-ai-float__intro-cluster">
                {{ clusterAliasName || clusterName || '-' }}
              </span>
              。你可以直接提问 Pod 异常、资源状态、事件日志等问题。
            </div>
          </div>
        </div>

        <template v-else>
          <div
            v-for="item in messages"
            :key="item.id"
            class="cluster-ai-float__message"
            :class="`cluster-ai-float__message--${item.role}`"
          >
            <div class="cluster-ai-float__message-role">
              {{ item.role === 'user' ? '我' : 'Pixiu 智能助手' }}
            </div>

            <div
              v-if="item.role === 'assistant' && item.traceItems.length"
              class="cluster-ai-float__trace"
            >
              <button
                type="button"
                class="cluster-ai-float__trace-toggle"
                @click="toggleTrace(item.id)"
              >
                <ElIcon :size="14">
                  <component :is="item.traceExpanded ? ArrowDown : ArrowRight" />
                </ElIcon>
                <span>工具链调用</span>
                <span class="cluster-ai-float__trace-count">{{ item.traceItems.length }}</span>
              </button>

              <div v-if="item.traceExpanded" class="cluster-ai-float__trace-list">
                <div
                  v-for="trace in item.traceItems"
                  :key="trace.id"
                  class="cluster-ai-float__trace-item"
                >
                  <div class="cluster-ai-float__trace-head">
                    <span class="cluster-ai-float__trace-label">{{ trace.label }}</span>
                    <span class="cluster-ai-float__trace-time">{{ trace.time }}</span>
                  </div>
                  <div class="cluster-ai-float__trace-message">{{ trace.message }}</div>
                  <pre v-if="trace.detail" class="cluster-ai-float__trace-detail">{{
                    trace.detail
                  }}</pre>
                </div>
              </div>
            </div>

            <pre v-if="item.text.trim()" class="cluster-ai-float__message-text">{{ item.text }}</pre>
          </div>

          <div v-if="loading" class="cluster-ai-float__typing">Pixiu 正在回复...</div>
        </template>
      </div>

      <div v-if="errorText" class="cluster-ai-float__error">{{ errorText }}</div>

      <div class="cluster-ai-float__composer">
        <div class="cluster-ai-float__input-wrap">
          <ElInput
            v-model="inputText"
            type="textarea"
            :rows="3"
            resize="none"
            placeholder="请输入要咨询的问题"
            @keydown.enter.exact.prevent="sendMessage"
          />
          <button
            type="button"
            class="cluster-ai-float__send-btn"
            title="发送"
            :disabled="!canSend"
            @click="sendMessage"
          >
            <ElIcon :size="18"><Promotion /></ElIcon>
          </button>
        </div>

        <div class="cluster-ai-float__footer-bar">
          <div class="cluster-ai-float__mode-group">
            <span class="cluster-ai-float__mode is-active">
              <ArtSvgIcon icon="ri:sparkling-2-line" class="cluster-ai-float__mode-icon" />
              Agent
            </span>
            <span class="cluster-ai-float__mode is-disabled" title="即将支持">Chat</span>
          </div>
        </div>

        <div class="cluster-ai-float__disclaimer">
          内容由 AI 生成，仅供参考，您据此所作判断及操作均由您自行承担责任。
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ElIcon, ElInput } from 'element-plus'
  import {
    ArrowDown,
    ArrowRight,
    Close,
    Minus,
    Plus,
    Promotion
  } from '@element-plus/icons-vue'
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { respondAIStream, type AIStreamEvent } from '@/api/ai'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'

  interface TraceItem {
    id: number
    label: string
    message: string
    detail: string
    time: string
  }

  interface MessageItem {
    id: number
    role: 'user' | 'assistant'
    text: string
    traceExpanded: boolean
    traceItems: TraceItem[]
  }

  const props = defineProps<{
    clusterName: string
    clusterAliasName?: string
  }>()

  const panelVisible = ref(false)
  const loading = ref(false)
  const errorText = ref('')
  const inputText = ref('')
  const conversationId = ref(0)
  const messages = ref<MessageItem[]>([])
  const messageBodyRef = ref<HTMLElement | null>(null)
  const rootRef = ref<HTMLElement | null>(null)

  const VIEWPORT_MARGIN = 12
  const DRAG_THRESHOLD = 4
  const LEGACY_POSITION_STORAGE_KEY = 'pixiu-ai-float-position'

  const position = ref<{ x: number; y: number } | null>(null)
  const dragging = ref(false)
  let dragMoved = false
  let dragStartX = 0
  let dragStartY = 0
  let dragOriginX = 0
  let dragOriginY = 0
  let activePointerId: number | null = null

  const containerStyle = computed(() => {
    if (!position.value) return undefined
    return {
      left: `${position.value.x}px`,
      top: `${position.value.y}px`,
      right: 'auto',
      bottom: 'auto'
    }
  })

  function getWidgetSize() {
    const el = rootRef.value
    if (!el) {
      return panelVisible.value
        ? { width: 420, height: 640 }
        : { width: 52, height: 52 }
    }
    const rect = el.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  }

  function clampPosition(x: number, y: number) {
    const { width, height } = getWidgetSize()
    const maxX = Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN)
    const maxY = Math.max(VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN)
    return {
      x: Math.min(Math.max(x, VIEWPORT_MARGIN), maxX),
      y: Math.min(Math.max(y, VIEWPORT_MARGIN), maxY)
    }
  }

  function ensurePositionFromRect() {
    const el = rootRef.value
    if (!el || position.value) return
    const rect = el.getBoundingClientRect()
    position.value = clampPosition(rect.left, rect.top)
  }

  function beginDragTracking(clientX: number, clientY: number, pointerId: number) {
    dragging.value = false
    dragMoved = false
    dragStartX = clientX
    dragStartY = clientY
    activePointerId = pointerId
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
  }

  function onPointerMove(event: PointerEvent) {
    if (activePointerId !== event.pointerId) return

    const dx = event.clientX - dragStartX
    const dy = event.clientY - dragStartY

    if (!dragging.value) {
      if (Math.abs(dx) <= DRAG_THRESHOLD && Math.abs(dy) <= DRAG_THRESHOLD) return
      ensurePositionFromRect()
      if (!position.value) return
      dragging.value = true
      dragMoved = true
      dragOriginX = position.value.x
      dragOriginY = position.value.y
      document.body.style.userSelect = 'none'
    }

    position.value = clampPosition(dragOriginX + dx, dragOriginY + dy)
  }

  function stopDrag() {
    activePointerId = null
    dragging.value = false
    document.body.style.userSelect = ''
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
  }

  function onPointerUp(event: PointerEvent) {
    if (activePointerId !== event.pointerId) return
    stopDrag()
  }

  function onTriggerPointerDown(event: PointerEvent) {
    if (event.button !== 0 || panelVisible.value) return
    beginDragTracking(event.clientX, event.clientY, event.pointerId)
  }

  function onHeaderPointerDown(event: PointerEvent) {
    if (event.button !== 0 || !panelVisible.value) return
    const target = event.target as HTMLElement
    if (target.closest('.cluster-ai-float__icon-btn')) return
    beginDragTracking(event.clientX, event.clientY, event.pointerId)
  }

  function onTriggerClick() {
    if (dragMoved) return
    openPanel()
  }

  function fitPositionToViewport() {
    if (!position.value) return
    position.value = clampPosition(position.value.x, position.value.y)
  }

  onMounted(() => {
    localStorage.removeItem(LEGACY_POSITION_STORAGE_KEY)
    void nextTick(() => fitPositionToViewport())
    window.addEventListener('resize', fitPositionToViewport)
  })

  onBeforeUnmount(() => {
    stopDrag()
    window.removeEventListener('resize', fitPositionToViewport)
  })

  let messageId = 0
  let traceId = 0
  let streamingAssistantId: number | null = null
  let abortController: AbortController | null = null

  const canSend = computed(() => !!props.clusterName && !!inputText.value.trim() && !loading.value)

  watch(
    () => props.clusterName,
    () => {
      resetConversation()
    }
  )

  function openPanel() {
    panelVisible.value = true
    if (position.value) {
      void nextTick(() => fitPositionToViewport())
    }
    scrollToBottom()
  }

  function minimizePanel() {
    panelVisible.value = false
    position.value = null
  }

  function startNewConversation() {
    resetConversation()
  }

  function resetConversation() {
    abortController?.abort()
    abortController = null
    loading.value = false
    errorText.value = ''
    inputText.value = ''
    conversationId.value = 0
    messages.value = []
    messageId = 0
    traceId = 0
    streamingAssistantId = null
  }

  function scrollToBottom() {
    void nextTick(() => {
      const el = messageBodyRef.value
      if (!el) return
      el.scrollTop = el.scrollHeight
    })
  }

  function appendMessage(role: 'user' | 'assistant', text = ''): number {
    const id = ++messageId
    messages.value.push({
      id,
      role,
      text,
      traceExpanded: false,
      traceItems: []
    })
    scrollToBottom()
    return id
  }

  function ensureAssistantMessage() {
    if (streamingAssistantId !== null) return streamingAssistantId
    streamingAssistantId = appendMessage('assistant', '')
    return streamingAssistantId
  }

  function updateAssistantText(delta: string) {
    const id = ensureAssistantMessage()
    const target = messages.value.find((item) => item.id === id)
    if (!target) return
    target.text += delta
    scrollToBottom()
  }

  function toggleTrace(id: number) {
    const target = messages.value.find((item) => item.id === id)
    if (!target || target.role !== 'assistant') return
    target.traceExpanded = !target.traceExpanded
    scrollToBottom()
  }

  function getNowTime() {
    const now = new Date()
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  }

  function appendAssistantTrace(label: string, message: string, detail = '') {
    const id = ensureAssistantMessage()
    const target = messages.value.find((item) => item.id === id)
    if (!target) return
    target.traceItems.push({
      id: ++traceId,
      label,
      message,
      detail,
      time: getNowTime()
    })
    scrollToBottom()
  }

  function buildClusterScopedInput(question: string) {
    return [
      '这是一个连续对话场景，请强依赖会话上下文理解用户当前意图，不要把每条短句都当成全新问题。',
      '如果用户后续只说“删除”、“继续”、“确认”、“执行”、“好的”这类短句，优先视为对上一轮已明确目标的继续操作，不要丢失上下文。',
      '如果上一轮已经明确了资源范围、命名空间、资源类型和执行目标，本轮不要重复要求用户再描述一次。',
      '对于删除、重启、扩缩容、修改配置这类变更操作：只要用户已经明确授权，就直接执行，不要重复确认；只有目标范围仍不明确时才追问。',
      '如果用户要删除“Pod 和他们的控制器”，应把控制器理解为 Deployment、StatefulSet、DaemonSet、Job、CronJob、ReplicaSet，并结合上下文判断是否全部删除。',
      '执行类请求优先输出：已执行或未执行、执行结果、剩余对象、下一步建议。不要输出空泛巡检内容。',
      '查询类请求请用中文简洁回答，优先短句，不要长篇大论，不要大段 Markdown。',
      '默认按这个格式输出：结论、异常、建议。每部分尽量 1 到 3 条，整条回复尽量控制在 8 行以内。',
      '如果没有明显异常，就直接说正常项和建议关注点，不要展开大段巡检报告。',
      `当前集群名称: ${props.clusterName}`,
      props.clusterAliasName ? `当前集群别名: ${props.clusterAliasName}` : '',
      `用户问题: ${question}`
    ]
      .filter(Boolean)
      .join('\n')
  }

  function parseToolArgs(toolArgs?: string) {
    if (!toolArgs) return ''

    try {
      const parsed = JSON.parse(toolArgs) as { cluster?: string; args?: string[] | string }
      const args = Array.isArray(parsed.args)
        ? parsed.args.join(' ')
        : typeof parsed.args === 'string'
          ? parsed.args
          : ''
      const cluster = parsed.cluster ? `集群 ${parsed.cluster}` : '当前集群'
      return args ? `${cluster} 执行: ${args}` : cluster
    } catch {
      return toolArgs
    }
  }

  function formatStatusMessage(event: AIStreamEvent) {
    const statusMap: Record<string, string> = {
      started: '已开始处理请求',
      accepted: '请求已被接收',
      model: 'AI 正在分析问题',
      completed: 'AI 回复完成',
      warning: '已生成回复，但有部分信息未完整保存',
      failed: '处理失败'
    }

    if (event.stage && statusMap[event.stage]) return statusMap[event.stage]
    return '状态已更新'
  }

  function formatToolStartMessage(event: AIStreamEvent) {
    if (event.tool_name === 'k8s') {
      return '正在调用 Kubernetes 工具排查'
    }
    if (event.tool_name) {
      return `正在调用工具 ${event.tool_name}`
    }
    return '正在调用工具排查'
  }

  function formatToolResultMessage(event: AIStreamEvent) {
    if (event.tool_name === 'k8s') {
      return 'Kubernetes 工具已返回结果'
    }
    if (event.tool_name) {
      return `工具 ${event.tool_name} 已返回结果`
    }
    return '工具执行完成'
  }

  function handleStreamEvent(event: AIStreamEvent) {
    switch (event.type) {
      case 'status':
        appendAssistantTrace('状态', formatStatusMessage(event))
        break
      case 'delta':
        updateAssistantText(event.delta || '')
        break
      case 'tool_start':
        appendAssistantTrace(
          '排查中',
          formatToolStartMessage(event),
          parseToolArgs(event.tool_args)
        )
        break
      case 'tool_result':
        appendAssistantTrace('工具结果', formatToolResultMessage(event), event.tool_output || '')
        break
      case 'complete': {
        if (event.text) {
          const target = messages.value.find((item) => item.id === streamingAssistantId)
          if (target && !target.text.trim()) {
            target.text = event.text
            scrollToBottom()
          }
        }
        appendAssistantTrace('完成', 'AI 回复完成')
        streamingAssistantId = null
        break
      }
      case 'error':
        errorText.value = event.message || 'AI 对话失败'
        appendAssistantTrace('失败', '请求失败', errorText.value)
        streamingAssistantId = null
        break
    }
  }

  async function sendMessage() {
    const question = inputText.value.trim()
    if (!question || !props.clusterName || loading.value) return

    errorText.value = ''
    appendMessage('user', question)
    inputText.value = ''

    abortController?.abort()
    const controller = new AbortController()
    abortController = controller
    loading.value = true
    streamingAssistantId = null

    try {
      const result = await respondAIStream(
        {
          conversation_id: conversationId.value || undefined,
          input: buildClusterScopedInput(question)
        },
        {
          signal: controller.signal,
          onEvent: handleStreamEvent
        }
      )

      conversationId.value = result?.conversation_id || 0
      const lastAssistantMessage = [...messages.value]
        .reverse()
        .find((item) => item.role === 'assistant')

      if (!lastAssistantMessage) {
        appendMessage('assistant', result?.text?.trim() || 'AI 未返回内容')
      } else if (!lastAssistantMessage.text.trim()) {
        lastAssistantMessage.text = result?.text?.trim() || 'AI 未返回内容'
        scrollToBottom()
      }
    } catch (error: unknown) {
      if (controller.signal.aborted) return
      const message = error instanceof Error ? error.message : 'AI 对话失败'
      errorText.value = message
      updateAssistantText(`请求失败：${message}`)
    } finally {
      if (abortController === controller) {
        abortController = null
      }
      streamingAssistantId = null
      loading.value = false
    }
  }
</script>

<style scoped>
  .cluster-ai-float {
    --ai-brand: #1677ff;
    --ai-brand-hover: #4096ff;
    --ai-brand-active: #0958d9;
    --ai-brand-soft: #e6f4ff;
    --ai-brand-border: #91caff;
    --ai-brand-shadow: rgb(22 119 255 / 18%);
    --ai-panel-bg: #fff;
    --ai-surface-bg: #fafafa;
    --ai-muted-bg: #f5f7fa;
    --ai-shadow: 0 8px 24px rgb(0 0 0 / 12%);

    position: fixed;
    right: 20px;
    bottom: 60px;
    z-index: 30;
  }

  .cluster-ai-float.is-dragging {
    z-index: 40;
  }

  .cluster-ai-float.is-dragging .cluster-ai-float__trigger-inner,
  .cluster-ai-float.is-dragging .cluster-ai-float__header {
    cursor: grabbing;
  }

  .cluster-ai-float__trigger {
    position: relative;
    display: inline-flex;
    padding: 0;
    border: none;
    background: transparent;
    cursor: grab;
    touch-action: none;
  }

  .cluster-ai-float__trigger-inner {
    display: inline-flex;
    width: 52px;
    height: 52px;
    align-items: center;
    justify-content: center;
    border: 1px solid rgb(22 119 255 / 12%);
    border-radius: 50%;
    background: #fff;
    color: var(--ai-brand);
    box-shadow: 0 6px 20px var(--ai-brand-shadow);
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease,
      border-color 0.2s ease;
  }

  .cluster-ai-float__trigger:hover .cluster-ai-float__trigger-inner {
    border-color: var(--ai-brand-border);
    box-shadow: 0 8px 24px rgb(22 119 255 / 24%);
    transform: translateY(-2px);
  }

  .cluster-ai-float__trigger-icon {
    font-size: 26px;
  }

  .cluster-ai-float__badge {
    position: absolute;
    top: -2px;
    right: -2px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border: 1px solid #fff;
    border-radius: 999px;
    background: var(--ai-brand);
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    line-height: 16px;
    text-align: center;
    box-shadow: 0 2px 8px rgb(22 119 255 / 28%);
  }

  .cluster-ai-float__panel {
    display: flex;
    width: min(420px, calc(100vw - 32px));
    height: min(640px, calc(100vh - 80px));
    flex-direction: column;
    overflow: hidden;
    border: 1px solid #e8e8e8;
    border-radius: 8px;
    background: var(--ai-panel-bg);
    box-shadow: var(--ai-shadow);
  }

  .cluster-ai-float__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border-bottom: none;
    background: linear-gradient(90deg, var(--ai-brand) 0%, var(--ai-brand-hover) 100%);
    cursor: grab;
    touch-action: none;
    user-select: none;
  }

  .cluster-ai-float__header-brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .cluster-ai-float__header-avatar {
    display: inline-flex;
    width: 28px;
    height: 28px;
    flex: none;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgb(255 255 255 / 18%);
    color: #fff;
    font-size: 16px;
  }

  .cluster-ai-float__title {
    font-size: 15px;
    font-weight: 600;
    color: #fff;
    letter-spacing: 0.2px;
  }

  .cluster-ai-float__header-actions {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }

  .cluster-ai-float__icon-btn {
    display: inline-flex;
    width: 28px;
    height: 28px;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: rgb(255 255 255 / 88%);
    cursor: pointer;
    transition:
      background 0.2s ease,
      color 0.2s ease;
  }

  .cluster-ai-float__icon-btn:hover {
    background: rgb(255 255 255 / 16%);
    color: #fff;
  }

  .cluster-ai-float__messages {
    min-height: 0;
    flex: 1;
    overflow: auto;
    padding: 16px;
    background: var(--ai-muted-bg);
  }

  .cluster-ai-float__welcome {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .cluster-ai-float__hero {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border: 1px solid #f0f0f0;
    border-radius: 8px;
    background: #fff;
  }

  .cluster-ai-float__hero-avatar {
    display: inline-flex;
    width: 48px;
    height: 48px;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--ai-brand-soft);
    color: var(--ai-brand);
    font-size: 26px;
    flex: none;
  }

  .cluster-ai-float__hero-greeting {
    font-size: 13px;
    color: #8c8c8c;
  }

  .cluster-ai-float__hero-title {
    margin-top: 4px;
    font-size: 20px;
    font-weight: 600;
    line-height: 1.3;
    color: #262626;
  }

  .cluster-ai-float__intro-card {
    padding: 14px 16px;
    border: 1px solid var(--ai-brand-border);
    border-radius: 8px;
    background: var(--ai-brand-soft);
  }

  .cluster-ai-float__intro-icon {
    font-size: 18px;
    line-height: 1;
  }

  .cluster-ai-float__intro-title {
    margin-top: 8px;
    font-size: 14px;
    font-weight: 600;
    color: #262626;
  }

  .cluster-ai-float__intro-desc {
    margin-top: 6px;
    font-size: 12px;
    line-height: 1.7;
    color: #595959;
  }

  .cluster-ai-float__intro-cluster {
    color: var(--ai-brand);
    font-weight: 600;
  }

  .cluster-ai-float__message + .cluster-ai-float__message {
    margin-top: 12px;
  }

  .cluster-ai-float__message-role {
    margin-bottom: 4px;
    font-size: 12px;
    font-weight: 500;
    color: #8c8c8c;
  }

  .cluster-ai-float__message-text {
    margin: 0;
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 13px;
    line-height: 1.7;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .cluster-ai-float__message--assistant .cluster-ai-float__message-text {
    background: #fff;
    border: 1px solid #f0f0f0;
    color: #262626;
  }

  .cluster-ai-float__message--user .cluster-ai-float__message-text {
    background: var(--ai-brand-soft);
    border: 1px solid var(--ai-brand-border);
    color: #262626;
  }

  .cluster-ai-float__trace {
    margin-top: 4px;
  }

  .cluster-ai-float__trace-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0;
    border: none;
    background: transparent;
    color: #8c8c8c;
    font-size: 12px;
    cursor: pointer;
  }

  .cluster-ai-float__trace-toggle:hover {
    color: var(--ai-brand);
  }

  .cluster-ai-float__trace-count {
    min-width: 18px;
    padding: 0 6px;
    border-radius: 10px;
    background: #f0f0f0;
    color: #595959;
    line-height: 18px;
    text-align: center;
  }

  .cluster-ai-float__trace-list {
    display: flex;
    margin-top: 8px;
    flex-direction: column;
    gap: 8px;
  }

  .cluster-ai-float__trace-item {
    padding: 8px 10px;
    border: 1px solid #f0f0f0;
    border-radius: 6px;
    background: #fff;
  }

  .cluster-ai-float__trace-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .cluster-ai-float__trace-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--ai-brand);
  }

  .cluster-ai-float__trace-time {
    font-size: 12px;
    color: #8c8c8c;
  }

  .cluster-ai-float__trace-message {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.6;
    color: #262626;
  }

  .cluster-ai-float__trace-detail {
    margin: 6px 0 0;
    padding: 8px 10px;
    border-radius: 4px;
    background: #fafafa;
    color: #595959;
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .cluster-ai-float__typing {
    margin-top: 10px;
    font-size: 12px;
    color: var(--ai-brand);
  }

  .cluster-ai-float__error {
    padding: 10px 16px 0;
    font-size: 12px;
    color: #ff4d4f;
  }

  .cluster-ai-float__composer {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px 10px;
    border-top: 1px solid #f0f0f0;
    background: #fff;
  }

  .cluster-ai-float__input-wrap {
    position: relative;
  }

  .cluster-ai-float__input-wrap :deep(.el-textarea__inner) {
    min-height: 88px !important;
    padding: 10px 48px 10px 12px;
    border: 1px solid #d9d9d9;
    border-radius: 6px;
    font-size: 13px;
    line-height: 1.6;
    background: #fff;
    color: #262626;
    box-shadow: none;
    transition: border-color 0.2s ease;
  }

  .cluster-ai-float__input-wrap :deep(.el-textarea__inner:focus) {
    border-color: var(--ai-brand);
    box-shadow: 0 0 0 2px rgb(22 119 255 / 10%);
  }

  .cluster-ai-float__input-wrap :deep(.el-textarea__inner::placeholder) {
    color: #bfbfbf;
  }

  .cluster-ai-float__send-btn {
    position: absolute;
    right: 8px;
    bottom: 8px;
    display: inline-flex;
    width: 32px;
    height: 32px;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 6px;
    background: var(--ai-brand);
    color: #fff;
    cursor: pointer;
    transition:
      background 0.2s ease,
      opacity 0.2s ease;
  }

  .cluster-ai-float__send-btn:hover:not(:disabled) {
    background: var(--ai-brand-hover);
  }

  .cluster-ai-float__send-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .cluster-ai-float__footer-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .cluster-ai-float__mode-group {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px;
    border-radius: 6px;
    background: #f5f5f5;
  }

  .cluster-ai-float__mode {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 26px;
    padding: 0 10px;
    border-radius: 4px;
    font-size: 12px;
    line-height: 26px;
  }

  .cluster-ai-float__mode.is-active {
    background: #fff;
    color: var(--ai-brand);
    font-weight: 600;
    box-shadow: 0 1px 2px rgb(0 0 0 / 6%);
  }

  .cluster-ai-float__mode.is-disabled {
    background: transparent;
    color: #bfbfbf;
    cursor: not-allowed;
  }

  .cluster-ai-float__mode-icon {
    font-size: 14px;
  }

  .cluster-ai-float__disclaimer {
    font-size: 11px;
    line-height: 1.6;
    color: #bfbfbf;
    text-align: center;
  }

  :global(html.dark) .cluster-ai-float {
    --ai-brand: #4096ff;
    --ai-brand-hover: #69b1ff;
    --ai-brand-active: #1677ff;
    --ai-brand-soft: rgb(22 119 255 / 12%);
    --ai-brand-border: rgb(22 119 255 / 28%);
    --ai-brand-shadow: rgb(0 0 0 / 32%);
    --ai-panel-bg: var(--el-bg-color);
    --ai-surface-bg: var(--el-fill-color-blank);
    --ai-muted-bg: var(--el-fill-color-light);
    --ai-shadow: 0 8px 24px rgb(0 0 0 / 36%);
  }

  :global(html.dark) .cluster-ai-float__trigger-inner {
    border-color: rgb(64 150 255 / 24%);
    background: var(--el-bg-color);
    color: var(--ai-brand);
  }

  :global(html.dark) .cluster-ai-float__panel {
    border-color: var(--el-border-color);
  }

  :global(html.dark) .cluster-ai-float__hero {
    border-color: var(--el-border-color-lighter);
    background: var(--el-bg-color);
  }

  :global(html.dark) .cluster-ai-float__hero-title {
    color: var(--el-text-color-primary);
  }

  :global(html.dark) .cluster-ai-float__hero-greeting,
  :global(html.dark) .cluster-ai-float__intro-desc,
  :global(html.dark) .cluster-ai-float__message-role,
  :global(html.dark) .cluster-ai-float__trace-toggle,
  :global(html.dark) .cluster-ai-float__trace-time {
    color: var(--el-text-color-secondary);
  }

  :global(html.dark) .cluster-ai-float__intro-title,
  :global(html.dark) .cluster-ai-float__message-text,
  :global(html.dark) .cluster-ai-float__trace-message {
    color: var(--el-text-color-primary);
  }

  :global(html.dark) .cluster-ai-float__message--assistant .cluster-ai-float__message-text,
  :global(html.dark) .cluster-ai-float__trace-item {
    background: var(--el-bg-color);
    border-color: var(--el-border-color-lighter);
  }

  :global(html.dark) .cluster-ai-float__composer {
    border-top-color: var(--el-border-color-lighter);
    background: var(--el-bg-color);
  }

  :global(html.dark) .cluster-ai-float__input-wrap :deep(.el-textarea__inner) {
    border-color: var(--el-border-color);
    background: var(--el-fill-color-blank);
    color: var(--el-text-color-primary);
  }

  :global(html.dark) .cluster-ai-float__mode-group {
    background: var(--el-fill-color);
  }

  :global(html.dark) .cluster-ai-float__mode.is-active {
    background: var(--el-bg-color);
  }

  :global(html.dark) .cluster-ai-float__disclaimer {
    color: var(--el-text-color-placeholder);
  }
</style>

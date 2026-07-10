<template>
  <div class="cluster-ai-float">
    <button
      v-if="!panelVisible"
      type="button"
      class="cluster-ai-float__trigger"
      title="AI 助手"
      @click="openPanel"
    >
      <ElIcon :size="22"><ChatDotRound /></ElIcon>
      <span v-if="messages.length" class="cluster-ai-float__badge">{{ messages.length }}</span>
    </button>

    <div v-else class="cluster-ai-float__panel">
      <div class="cluster-ai-float__header">
        <div class="cluster-ai-float__title-wrap">
          <div class="cluster-ai-float__title">AI 助手</div>
          <div class="cluster-ai-float__subtitle">{{ clusterAliasName || clusterName || '-' }}</div>
        </div>
        <button type="button" class="cluster-ai-float__close" title="最小化" @click="minimizePanel">
          <ElIcon :size="16"><Minus /></ElIcon>
        </button>
      </div>

      <div ref="messageBodyRef" class="cluster-ai-float__messages">
        <div v-if="messages.length === 0" class="cluster-ai-float__empty">
          直接提问当前集群的问题，发送时会自动拼接当前集群名称。
        </div>

        <div
          v-for="item in messages"
          :key="item.id"
          class="cluster-ai-float__message"
          :class="`cluster-ai-float__message--${item.role}`"
        >
          <div class="cluster-ai-float__message-role">
            {{ item.role === 'user' ? '我' : 'AI' }}
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

        <div v-if="loading" class="cluster-ai-float__typing">AI 正在回复...</div>
      </div>

      <div v-if="errorText" class="cluster-ai-float__error">{{ errorText }}</div>

      <div class="cluster-ai-float__composer">
        <ElInput
          v-model="inputText"
          type="textarea"
          :rows="3"
          resize="none"
          placeholder="请输入要咨询的问题"
          @keydown.enter.exact.prevent="sendMessage"
        />
        <div class="cluster-ai-float__actions">
          <ElButton type="primary" :loading="loading" :disabled="!canSend" @click="sendMessage">
            发送
          </ElButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ElButton, ElIcon, ElInput } from 'element-plus'
  import { ArrowDown, ArrowRight, ChatDotRound, Minus } from '@element-plus/icons-vue'
  import { computed, nextTick, ref, watch } from 'vue'
  import { respondAIStream, type AIStreamEvent } from '@/api/ai'

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
    scrollToBottom()
  }

  function minimizePanel() {
    panelVisible.value = false
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
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 30;
  }

  .cluster-ai-float__trigger {
    position: relative;
    display: inline-flex;
    width: 56px;
    height: 56px;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 999px;
    background: var(--el-color-primary);
    color: #fff;
    cursor: pointer;
    box-shadow: 0 12px 30px rgb(0 0 0 / 18%);
  }

  .cluster-ai-float__badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: #fff;
    color: var(--el-color-primary);
    font-size: 11px;
    font-weight: 700;
    line-height: 18px;
    text-align: center;
    box-shadow: 0 6px 16px rgb(0 0 0 / 12%);
  }

  .cluster-ai-float__panel {
    display: flex;
    width: min(380px, calc(100vw - 32px));
    height: min(620px, calc(100vh - 110px));
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    background: var(--el-bg-color);
    box-shadow: 0 14px 40px rgb(0 0 0 / 16%);
  }

  .cluster-ai-float__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 14px 12px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .cluster-ai-float__title {
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .cluster-ai-float__subtitle {
    margin-top: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    word-break: break-word;
  }

  .cluster-ai-float__close {
    display: inline-flex;
    width: 28px;
    height: 28px;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--el-text-color-secondary);
    cursor: pointer;
  }

  .cluster-ai-float__messages {
    min-height: 0;
    flex: 1;
    overflow: auto;
    padding: 14px;
    background: var(--el-fill-color-light);
  }

  .cluster-ai-float__empty {
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-secondary);
  }

  .cluster-ai-float__message + .cluster-ai-float__message {
    margin-top: 12px;
  }

  .cluster-ai-float__message-role {
    margin-bottom: 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
  }

  .cluster-ai-float__message-text {
    margin: 8px 0 0;
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 13px;
    line-height: 1.7;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .cluster-ai-float__message--assistant .cluster-ai-float__message-text {
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
  }

  .cluster-ai-float__message--user .cluster-ai-float__message-text {
    margin-top: 0;
    background: var(--el-color-primary-light-9);
    border: 1px solid var(--el-color-primary-light-7);
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
    color: var(--el-text-color-secondary);
    font-size: 12px;
    cursor: pointer;
  }

  .cluster-ai-float__trace-count {
    min-width: 18px;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--el-fill-color);
    color: var(--el-text-color-regular);
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
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    background: var(--el-bg-color);
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
    color: var(--el-color-primary);
  }

  .cluster-ai-float__trace-time {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .cluster-ai-float__trace-message {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--el-text-color-primary);
  }

  .cluster-ai-float__trace-detail {
    margin: 6px 0 0;
    padding: 8px 10px;
    border-radius: 6px;
    background: var(--el-fill-color-light);
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .cluster-ai-float__typing {
    margin-top: 10px;
    font-size: 12px;
    color: var(--el-color-primary);
  }

  .cluster-ai-float__error {
    padding: 10px 14px 0;
    font-size: 12px;
    color: var(--el-color-danger);
  }

  .cluster-ai-float__composer {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border-top: 1px solid var(--el-border-color-lighter);
    background: var(--el-bg-color);
  }

  .cluster-ai-float__actions {
    display: flex;
    justify-content: flex-end;
  }
</style>

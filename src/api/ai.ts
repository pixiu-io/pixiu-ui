export interface AIRespondRequest {
  conversation_id?: number
  provider?: string
  model?: string
  input: string
}

export interface AIRespondResponse {
  conversation_id: number
  response_id: string
  text: string
  model: string
  raw?: unknown
}

export interface AIStreamEvent {
  type: 'status' | 'delta' | 'tool_start' | 'tool_result' | 'complete' | 'error'
  stage?: string
  message?: string
  delta?: string
  text?: string
  model?: string
  tool_name?: string
  tool_call_id?: string
  tool_args?: string
  tool_output?: string
  conversation_id?: number
  response_id?: string
  raw?: unknown
}

export interface AIRespondStreamOptions {
  signal?: AbortSignal
  onEvent?: (event: AIStreamEvent) => void
}

export async function respondAIStream(
  params: AIRespondRequest,
  options: AIRespondStreamOptions = {}
): Promise<AIRespondResponse | null> {
  const token = localStorage.getItem('pixiu-access-token') || ''
  const response = await fetch('/pixiu/ai/respond/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(params),
    signal: options.signal
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || 'AI 流式分析请求失败')
  }
  if (!response.body) {
    throw new Error('AI 流式分析响应为空')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let finalResult: AIRespondResponse | null = null

  const handleBlock = (block: string) => {
    const payload = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n')

    if (!payload) return
    const event = JSON.parse(payload) as AIStreamEvent
    options.onEvent?.(event)

    if (event.type === 'error') {
      throw new Error(event.message || 'AI 分析失败')
    }
    if (event.type === 'complete') {
      finalResult = {
        conversation_id: event.conversation_id || 0,
        response_id: event.response_id || '',
        text: event.text || '',
        model: event.model || '',
        raw: event.raw
      }
    }
  }

  while (true) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })

    let splitIndex = buffer.indexOf('\n\n')
    while (splitIndex >= 0) {
      const block = buffer.slice(0, splitIndex).trim()
      buffer = buffer.slice(splitIndex + 2)
      if (block) handleBlock(block)
      splitIndex = buffer.indexOf('\n\n')
    }

    if (done) {
      const rest = buffer.trim()
      if (rest) handleBlock(rest)
      break
    }
  }

  return finalResult
}

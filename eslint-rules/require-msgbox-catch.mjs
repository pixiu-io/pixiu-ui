/**
 * @fileoverview 强制 ElMessageBox.confirm/prompt/alert/msgbox 的返回 Promise 必须被妥善处理。
 *
 * 背景：Element Plus 的 ElMessageBox 在用户点「取消/ESC/关闭」时会以字符串 'cancel' reject。
 * 若写成 `ElMessageBox.confirm(...).then(...)`（缺 .catch）或完全悬空，
 * 会产生未捕获 Promise 拒绝，控制台出现 `[PromiseError] cancel` / `Uncaught (in promise) cancel`。
 *
 * 允许的写法：
 * - `await ElMessageBox.confirm(...)`（通常配合 try/catch）
 * - `ElMessageBox.confirm(...).catch(...)` / `.then(...).catch(...)` / `.finally(...)`
 *
 * 禁止的写法：
 * - `ElMessageBox.confirm(...)`（悬空，未处理）
 * - `ElMessageBox.confirm(...).then(...)`（以 .then 结尾，取消时会 reject）
 */

const METHODS = new Set(['confirm', 'prompt', 'alert', 'msgbox'])

/** 判断调用是否形如 ElMessageBox.confirm(...) 等 */
function isElMessageBoxCall(node) {
  const callee = node.callee
  if (!callee || callee.type !== 'MemberExpression' || callee.computed) return false
  const object = callee.object
  const property = callee.property
  return (
    object &&
    object.type === 'Identifier' &&
    object.name === 'ElMessageBox' &&
    property &&
    property.type === 'Identifier' &&
    METHODS.has(property.name)
  )
}

/**
 * 沿 AST 向上追踪该 Promise 的消费方式。
 * 返回 { kind: 'ok' } 或 { kind: 'report' } / { kind: 'floating' }。
 */
function getHandling(node) {
  let prev = node
  let lastMethod = null

  while (prev && prev.parent) {
    const parent = prev.parent

    // 链式方法访问：X.then / X.catch / X.finally
    if (parent.type === 'MemberExpression' && parent.object === prev && !parent.computed) {
      lastMethod = parent.property.name
      prev = parent
      continue
    }
    // 方法调用：X.then(...) —— 上移到整个 CallExpression
    if (parent.type === 'CallExpression' && parent.callee === prev) {
      prev = parent
      continue
    }
    // await 消费：视为已处理
    if (parent.type === 'AwaitExpression') {
      return { kind: 'ok' }
    }
    // 语句级结尾：看最后一个链式方法
    if (parent.type === 'ExpressionStatement') {
      if (lastMethod === 'catch' || lastMethod === 'finally') return { kind: 'ok' }
      if (lastMethod === 'then') return { kind: 'report' }
      return { kind: 'floating' }
    }
    // 其他上下文（赋值/return/作为参数等）无法可靠跟踪，不报
    return { kind: 'ok' }
  }

  return { kind: 'ok' }
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'ElMessageBox 的返回值必须链式 .catch()/.finally() 或用 await 处理，避免用户取消时产生未捕获拒绝',
      recommended: false
    },
    messages: {
      requireCatch:
        'ElMessageBox.{{method}} 的 Promise 必须链式 .catch()/.finally() 或用 await + try/catch 处理，避免用户取消时产生未捕获拒绝'
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isElMessageBoxCall(node)) return
        const handling = getHandling(node)
        if (handling.kind === 'report' || handling.kind === 'floating') {
          context.report({
            node,
            messageId: 'requireCatch',
            data: { method: node.callee.property.name }
          })
        }
      }
    }
  }
}

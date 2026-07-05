import { h, type VNode } from 'vue'
import type { ColumnOption } from '@/types'

export const K8S_EVENT_MESSAGE_CELL_CLASS = 'k8s-event-message-cell'

/** K8s 事件内容单元格：长文本换行展示，不省略 */
export function renderK8sEventMessage(message?: string | null): VNode {
  return h(
    'div',
    { class: 'k8s-event-message' },
    message?.trim() ? message : '-'
  )
}

/** ArtTable / useTable 事件「内容」列配置 */
export function createK8sEventMessageColumn<T extends { message?: string }>(
  overrides: Partial<ColumnOption<T>> = {}
): ColumnOption<T> {
  return {
    prop: 'message',
    label: '内容',
    minWidth: 280,
    className: K8S_EVENT_MESSAGE_CELL_CLASS,
    showOverflowTooltip: false,
    formatter: (row: T) => renderK8sEventMessage(row.message),
    ...overrides
  }
}

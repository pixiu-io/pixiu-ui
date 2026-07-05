import { ElCheckbox, ElIcon, ElMessageBox } from 'element-plus'
import { WarningFilled } from '@element-plus/icons-vue'
import { h, ref } from 'vue'

/**
 * Opens destroy confirmation dialog and returns restart flag.
 * Returns null when user cancels.
 */
export async function confirmDestroyPlan(
  planName: string,
  options?: {
    title?: string
    messageBuilder?: (name: string) => string
  }
): Promise<boolean | null> {
  const restart = ref(false)
  const title = options?.title ?? '销毁部署'
  const message =
    options?.messageBuilder?.(planName) ?? `确定要销毁部署计划 "${planName}" 吗？`

  try {
    await ElMessageBox({
      title,
      message: () =>
        h('div', { style: 'display:flex;flex-direction:column;gap:12px' }, [
          h('div', { style: 'display:flex;align-items:center;gap:8px' }, [
            h(
              ElIcon,
              {
                color: 'var(--el-color-warning)',
                size: 24,
                style: 'flex-shrink:0;'
              },
              () => h(WarningFilled)
            ),
            h('span', message)
          ]),
          h(
            ElCheckbox,
            {
              modelValue: restart.value,
              'onUpdate:modelValue': (value: any) => {
                restart.value = value
              }
            },
            () => '重启服务器'
          ),
          h(
            'div',
            {
              style:
                'color:var(--el-color-danger);font-size:12px;line-height:1.5;margin-top:-6px;padding-left:22px;'
            },
            '勾选重启服务器时，销毁完成之后会自动重启服务器'
          )
        ]),
      showCancelButton: true,
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      customClass: 'destroy-plan-dialog'
    })
    return restart.value
  } catch {
    return null
  }
}

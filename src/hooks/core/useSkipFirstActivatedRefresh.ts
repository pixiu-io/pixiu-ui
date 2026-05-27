import { onActivated } from 'vue'

/**
 * KeepAlive 页面再次激活时刷新列表；首次激活跳过（useTable immediate 已拉数）。
 */
export function useSkipFirstActivatedRefresh(refresh: () => void | Promise<void>) {
  let isFirstActivation = true
  onActivated(() => {
    if (isFirstActivation) {
      isFirstActivation = false
      return
    }
    void refresh()
  })
}

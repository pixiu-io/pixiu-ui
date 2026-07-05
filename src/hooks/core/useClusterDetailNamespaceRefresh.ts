import { inject, watch } from 'vue'
import {
  clusterDetailActiveMenuKey,
  clusterDetailNamespaceKey
} from '@/views/container/cluster-detail/context'

export function useClusterDetailActiveMenuKey() {
  return inject(clusterDetailActiveMenuKey, undefined)
}

/**
 * 仅在当前集群详情子菜单为激活页时响应顶栏命名空间切换。
 * KeepAlive 缓存的其它页面不应重复发起列表请求。
 */
export function useClusterDetailNamespaceRefresh(
  menuKey: string,
  refresh: () => void | Promise<void>
) {
  const activeMenuKey = useClusterDetailActiveMenuKey()
  const globalNs = inject(clusterDetailNamespaceKey, null)

  if (!globalNs) return

  watch(
    () => globalNs.namespace.value,
    () => {
      if (activeMenuKey?.value !== menuKey) return
      void refresh()
    }
  )
}

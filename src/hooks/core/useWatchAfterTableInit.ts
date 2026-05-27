import { watch, type WatchCallback, type WatchOptions, type WatchSource } from 'vue'

/**
 * 与 useTable({ immediate: true }) 同挂载拉数时，跳过 watch 的首次 immediate 回调，避免重复请求。
 */
export function useWatchAfterTableInit<T>(
  source: WatchSource<T>,
  cb: WatchCallback<T>,
  options?: WatchOptions
) {
  let skipInitial = Boolean(options?.immediate)
  return watch(
    source,
    (value, oldValue, onCleanup) => {
      if (skipInitial) {
        skipInitial = false
        return
      }
      cb(value, oldValue, onCleanup)
    },
    options
  )
}

/**
 * 工作标签页状态管理模块
 *
 * 提供多标签页功能的完整状态管理
 *
 * ## 主要功能
 *
 * - 标签页打开和关闭
 * - 标签页固定和取消固定
 * - 批量关闭（左侧、右侧、其他、全部）
 * - 标签页缓存管理（KeepAlive）
 * - 标签页标题自定义
 * - 标签页路由验证
 * - 动态路由参数处理
 *
 * ## 使用场景
 *
 * - 多标签页导航
 * - 页面缓存控制
 * - 标签页右键菜单
 * - 固定常用页面
 * - 批量关闭标签
 *
 * ## 核心特性
 *
 * - 智能标签页复用（同路由名称复用）
 * - 固定标签页保护（不可关闭）
 * - KeepAlive 缓存排除管理
 * - 路由有效性验证
 * - 首页自动保留
 *
 * ## 持久化
 * - 使用 localStorage 存储
 * - 存储键：sys-v{version}-worktab
 * - 刷新页面保持标签状态
 *
 * @module store/modules/worktab
 * @author Pixiu Cloud Team
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { router } from '@/router'
import { LocationQueryRaw, Router } from 'vue-router'
import { WorkTab } from '@/types'
import { useCommon } from '@/hooks/core/useCommon'

/** 从 query 取 cluster 参数（单值） */
function getClusterQueryValue(query: LocationQueryRaw | undefined): string | undefined {
  if (!query) return undefined
  const raw = query.cluster
  const v = Array.isArray(raw) ? raw[0] : raw
  if (v === null || v === undefined) return undefined
  const s = String(v).trim()
  return s || undefined
}

/** 集群详情子页 path（与 router modules/container 一致，不含 query） */
const CLUSTER_DETAIL_SUBPATH_RE =
  /^\/container\/(overview|nodes|namespaces|workloads|pods|services|config|storage|autoscaling|auth|addon-components|crds|apiservices|appstore|alert|logs|events|prometheus)(\/|$)/

function isClusterDetailSubPath(path: string | undefined): boolean {
  if (!path) return false
  return CLUSTER_DETAIL_SUBPATH_RE.test(path.split('?')[0])
}

interface WorktabState {
  current: Partial<WorkTab>
  opened: WorkTab[]
  keepAliveExclude: string[]
}

/**
 * 工作台标签页管理 Store
 */
export const useWorktabStore = defineStore(
  'worktabStore',
  () => {
    // 状态定义
    const current = ref<Partial<WorkTab>>({})
    const opened = ref<WorkTab[]>([])
    const keepAliveExclude = ref<string[]>([])

    // 计算属性
    const hasOpenedTabs = computed(() => opened.value.length > 0)
    const hasMultipleTabs = computed(() => opened.value.length > 1)
    const currentTabIndex = computed(() =>
      current.value.path ? opened.value.findIndex((tab) => tab.path === current.value.path) : -1
    )

    /**
     * 查找标签页索引
     */
    const findTabIndex = (path: string): number => {
      return opened.value.findIndex((tab) => tab.path === path)
    }

    /**
     * 获取标签页
     */
    const getTab = (path: string): WorkTab | undefined => {
      return opened.value.find((tab) => tab.path === path)
    }

    /**
     * 检查标签页是否可关闭
     */
    const isTabClosable = (tab: WorkTab): boolean => {
      return !tab.fixedTab
    }

    /**
     * 安全的路由跳转
     */
    const safeRouterPush = (tab: Partial<WorkTab>): void => {
      if (!tab.path) {
        console.warn('尝试跳转到无效路径的标签页')
        return
      }

      try {
        router.push({
          path: tab.path,
          query: tab.query as LocationQueryRaw
        })
      } catch (error) {
        console.error('路由跳转失败:', error)
      }
    }

    /**
     * 打开或激活一个选项卡
     */
    const openTab = (tab: WorkTab): void => {
      if (!tab.path) {
        console.warn('尝试打开无效的标签页')
        return
      }

      // 从 keepAlive 排除列表中移除
      if (tab.name) {
        removeKeepAliveExclude(tab.name)
      }

      // 优先按 tabGroup 查找（同组路由复用同一标签页）
      let existingIndex = -1
      if (tab.tabGroup === 'clusterDetail') {
        const clusterKey = getClusterQueryValue(tab.query as LocationQueryRaw | undefined)
        existingIndex = opened.value.findIndex((t) => {
          if (t.tabGroup === 'clusterDetail') {
            if (!clusterKey) return !getClusterQueryValue(t.query as LocationQueryRaw | undefined)
            return getClusterQueryValue(t.query as LocationQueryRaw | undefined) === clusterKey
          }
          // 持久化旧数据可能缺少 tabGroup：同集群 + 详情子路径，并入同一标签避免重复「集群详情」
          if (!t.tabGroup && clusterKey) {
            return (
              getClusterQueryValue(t.query as LocationQueryRaw | undefined) === clusterKey &&
              isClusterDetailSubPath(t.path)
            )
          }
          return false
        })
      } else if (tab.tabGroup) {
        existingIndex = opened.value.findIndex((t) => t.tabGroup === tab.tabGroup)
      }

      // 再根据路由名称查找（应对动态路由参数导致的多开问题），找不到再根据路径查找
      if (existingIndex === -1 && tab.name) {
        existingIndex = opened.value.findIndex((t) => t.name === tab.name)
      }
      if (existingIndex === -1) {
        existingIndex = findTabIndex(tab.path)
      }

      if (existingIndex === -1) {
        // 新增标签页
        const insertIndex = tab.fixedTab ? findFixedTabInsertIndex() : opened.value.length
        const newTab = { ...tab }

        if (tab.fixedTab) {
          opened.value.splice(insertIndex, 0, newTab)
        } else {
          opened.value.push(newTab)
        }

        current.value = newTab
      } else {
        // 更新现有标签页（当动态路由参数或查询变更时，复用同一标签）
        const existingTab = opened.value[existingIndex]

        opened.value[existingIndex] = {
          ...existingTab,
          path: tab.path,
          params: tab.params,
          query: tab.query,
          title: tab.title || existingTab.title,
          fixedTab: tab.fixedTab ?? existingTab.fixedTab,
          keepAlive: tab.keepAlive ?? existingTab.keepAlive,
          name: tab.name || existingTab.name,
          icon: tab.icon || existingTab.icon,
          tabGroup: tab.tabGroup ?? existingTab.tabGroup
        }

        current.value = opened.value[existingIndex]
      }

      // 集群详情：若历史数据里已存在多个同 cluster 的「集群详情」标签，只保留当前这一条
      if (tab.tabGroup === 'clusterDetail') {
        const clusterKey = getClusterQueryValue(tab.query as LocationQueryRaw | undefined)
        const keepPath = current.value.path
        if (keepPath && clusterKey) {
          const dupes = opened.value.filter((t) => {
            if (t.path === keepPath) return false
            const tk = getClusterQueryValue(t.query as LocationQueryRaw | undefined)
            if (tk !== clusterKey) return false
            return t.tabGroup === 'clusterDetail' || (!t.tabGroup && isClusterDetailSubPath(t.path))
          })
          if (dupes.length) {
            markTabsToRemove(dupes)
            const rm = new Set(dupes.map((t) => t.path))
            opened.value = opened.value.filter((t) => !rm.has(t.path))
          }
        }
      }
    }

    /**
     * 查找固定标签页的插入位置
     */
    const findFixedTabInsertIndex = (): number => {
      let insertIndex = 0
      for (let i = 0; i < opened.value.length; i++) {
        if (opened.value[i].fixedTab) {
          insertIndex = i + 1
        } else {
          break
        }
      }
      return insertIndex
    }

    /**
     * 关闭指定的选项卡
     */
    const removeTab = (path: string): void => {
      const targetTab = getTab(path)
      const targetIndex = findTabIndex(path)

      if (targetIndex === -1) {
        console.warn(`尝试关闭不存在的标签页: ${path}`)
        return
      }

      if (targetTab && !isTabClosable(targetTab)) {
        console.warn(`尝试关闭固定标签页: ${path}`)
        return
      }

      // 从标签页列表中移除
      opened.value.splice(targetIndex, 1)

      // 处理缓存排除
      if (targetTab?.name) {
        addKeepAliveExclude(targetTab)
      }

      const { homePath } = useCommon()

      // 如果关闭后无标签页，跳转首页
      if (!hasOpenedTabs.value) {
        if (path !== homePath.value) {
          current.value = {}
          safeRouterPush({ path: homePath.value })
        }
        return
      }

      // 如果关闭的是当前激活标签，需要激活其他标签
      if (current.value.path === path) {
        const newIndex = targetIndex >= opened.value.length ? opened.value.length - 1 : targetIndex
        current.value = opened.value[newIndex]
        safeRouterPush(current.value)
      }
    }

    /**
     * 关闭左侧选项卡
     */
    const removeLeft = (path: string): void => {
      const targetIndex = findTabIndex(path)

      if (targetIndex === -1) {
        console.warn(`尝试关闭左侧标签页，但目标标签页不存在: ${path}`)
        return
      }

      // 获取左侧可关闭的标签页
      const leftTabs = opened.value.slice(0, targetIndex)
      const closableLeftTabs = leftTabs.filter(isTabClosable)

      if (closableLeftTabs.length === 0) {
        console.warn('左侧没有可关闭的标签页')
        return
      }

      // 标记为缓存排除
      markTabsToRemove(closableLeftTabs)

      // 移除左侧可关闭的标签页
      opened.value = opened.value.filter(
        (tab, index) => index >= targetIndex || !isTabClosable(tab)
      )

      // 确保当前标签是激活状态
      const targetTab = getTab(path)
      if (targetTab) {
        current.value = targetTab
      }
    }

    /**
     * 关闭右侧选项卡
     */
    const removeRight = (path: string): void => {
      const targetIndex = findTabIndex(path)

      if (targetIndex === -1) {
        console.warn(`尝试关闭右侧标签页，但目标标签页不存在: ${path}`)
        return
      }

      // 获取右侧可关闭的标签页
      const rightTabs = opened.value.slice(targetIndex + 1)
      const closableRightTabs = rightTabs.filter(isTabClosable)

      if (closableRightTabs.length === 0) {
        console.warn('右侧没有可关闭的标签页')
        return
      }

      // 标记为缓存排除
      markTabsToRemove(closableRightTabs)

      // 移除右侧可关闭的标签页
      opened.value = opened.value.filter(
        (tab, index) => index <= targetIndex || !isTabClosable(tab)
      )

      // 确保当前标签是激活状态
      const targetTab = getTab(path)
      if (targetTab) {
        current.value = targetTab
      }
    }

    /**
     * 关闭其他选项卡
     */
    const removeOthers = (path: string): void => {
      const targetTab = getTab(path)

      if (!targetTab) {
        console.warn(`尝试关闭其他标签页，但目标标签页不存在: ${path}`)
        return
      }

      // 获取其他可关闭的标签页
      const otherTabs = opened.value.filter((tab) => tab.path !== path)
      const closableTabs = otherTabs.filter(isTabClosable)

      if (closableTabs.length === 0) {
        console.warn('没有其他可关闭的标签页')
        return
      }

      // 标记为缓存排除
      markTabsToRemove(closableTabs)

      // 只保留当前标签和固定标签
      opened.value = opened.value.filter((tab) => tab.path === path || !isTabClosable(tab))

      // 确保当前标签是激活状态
      current.value = targetTab
    }

    /**
     * 关闭所有可关闭的标签页
     */
    const removeAll = (): void => {
      const { homePath } = useCommon()
      const hasFixedTabs = opened.value.some((tab) => tab.fixedTab)

      // 获取可关闭的标签页
      const closableTabs = opened.value.filter((tab) => {
        if (!isTabClosable(tab)) return false
        // 如果有固定标签，则所有可关闭的都可以关闭；否则保留首页
        return hasFixedTabs || tab.path !== homePath.value
      })

      if (closableTabs.length === 0) {
        console.warn('没有可关闭的标签页')
        return
      }

      // 标记为缓存排除
      markTabsToRemove(closableTabs)

      // 保留不可关闭的标签页和首页（当没有固定标签时）
      opened.value = opened.value.filter((tab) => {
        return !isTabClosable(tab) || (!hasFixedTabs && tab.path === homePath.value)
      })

      // 处理激活状态
      if (!hasOpenedTabs.value) {
        current.value = {}
        safeRouterPush({ path: homePath.value })
        return
      }

      // 选择激活的标签页：优先首页，其次第一个可用标签
      const homeTab = opened.value.find((tab) => tab.path === homePath.value)
      const targetTab = homeTab || opened.value[0]

      current.value = targetTab
      safeRouterPush(targetTab)
    }

    /**
     * 将指定选项卡添加到 keepAlive 排除列表中
     */
    const addKeepAliveExclude = (tab: WorkTab): void => {
      if (!tab.keepAlive || !tab.name) return

      if (!keepAliveExclude.value.includes(tab.name)) {
        keepAliveExclude.value.push(tab.name)
      }
    }

    /**
     * 从 keepAlive 排除列表中移除指定组件名称
     */
    const removeKeepAliveExclude = (name: string): void => {
      if (!name) return

      keepAliveExclude.value = keepAliveExclude.value.filter((item) => item !== name)
    }

    /**
     * 将传入的一组选项卡的组件名称标记为排除缓存
     */
    const markTabsToRemove = (tabs: WorkTab[]): void => {
      tabs.forEach((tab) => {
        if (tab.name) {
          addKeepAliveExclude(tab)
        }
      })
    }

    /**
     * 切换指定标签页的固定状态
     */
    const toggleFixedTab = (path: string): void => {
      const targetIndex = findTabIndex(path)

      if (targetIndex === -1) {
        console.warn(`尝试切换不存在标签页的固定状态: ${path}`)
        return
      }

      const tab = { ...opened.value[targetIndex] }
      tab.fixedTab = !tab.fixedTab

      // 移除原位置
      opened.value.splice(targetIndex, 1)

      if (tab.fixedTab) {
        // 固定标签插入到所有固定标签的末尾
        const firstNonFixedIndex = opened.value.findIndex((t) => !t.fixedTab)
        const insertIndex = firstNonFixedIndex === -1 ? opened.value.length : firstNonFixedIndex
        opened.value.splice(insertIndex, 0, tab)
      } else {
        // 非固定标签插入到所有固定标签后
        const fixedCount = opened.value.filter((t) => t.fixedTab).length
        opened.value.splice(fixedCount, 0, tab)
      }

      // 更新当前标签引用
      if (current.value.path === path) {
        current.value = tab
      }
    }

    /**
     * 验证工作台标签页的路由有效性
     */
    const validateWorktabs = (routerInstance: Router): void => {
      try {
        // 动态路由校验：优先使用路由 name 判断有效性；否则用 resolve 匹配参数化路径
        const isTabRouteValid = (tab: Partial<WorkTab>): boolean => {
          try {
            if (tab.name) {
              const routes = routerInstance.getRoutes()
              if (routes.some((r) => r.name === tab.name)) return true
            }
            if (tab.path) {
              const resolved = routerInstance.resolve({
                path: tab.path,
                query: (tab.query as LocationQueryRaw) || undefined
              })
              return resolved.matched.length > 0
            }
            return false
          } catch {
            return false
          }
        }

        // 过滤出有效的标签页
        const validTabs = opened.value.filter((tab) => isTabRouteValid(tab))

        if (validTabs.length !== opened.value.length) {
          console.warn('发现无效的标签页路由，已自动清理')
          opened.value = validTabs
        }

        // 验证当前激活标签的有效性
        const isCurrentValid = current.value && isTabRouteValid(current.value)

        if (!isCurrentValid && validTabs.length > 0) {
          console.warn('当前激活标签无效，已自动切换')
          current.value = validTabs[0]
        } else if (!isCurrentValid) {
          current.value = {}
        }
      } catch (error) {
        console.error('验证工作台标签页失败:', error)
      }
    }

    /**
     * 清空所有状态（用于登出等场景）
     */
    const clearAll = (): void => {
      current.value = {}
      opened.value = []
      keepAliveExclude.value = []
    }

    /**
     * 获取状态快照（用于持久化存储）
     */
    const getStateSnapshot = (): WorktabState => {
      return {
        current: { ...current.value },
        opened: [...opened.value],
        keepAliveExclude: [...keepAliveExclude.value]
      }
    }

    /**
     * 获取标签页标题
     */
    const getTabTitle = (path: string): WorkTab | undefined => {
      const tab = getTab(path)
      return tab
    }

    /**
     * 更新标签页标题
     */
    const updateTabTitle = (path: string, title: string): void => {
      const tab = getTab(path)
      if (tab) {
        tab.customTitle = title
      }
    }

    /**
     * 重置标签页标题
     */
    const resetTabTitle = (path: string): void => {
      const tab = getTab(path)
      if (tab) {
        tab.customTitle = ''
      }
    }

    /**
     * 关闭所有「集群上下文」标签（详情子页、带 cluster 的创建/详情全屏页、新建集群向导等）。
     * 在回到集群列表 /container/cluster 时调用，避免集群内切换资源后标签栏堆叠无效项。
     */
    const removeClusterContextTabs = (): void => {
      const toRemove = opened.value.filter((tab) => {
        if (!isTabClosable(tab)) return false
        if (tab.path === '/container/cluster') return false
        if (tab.tabGroup === 'clusterDetail') return true
        if (getClusterQueryValue(tab.query as LocationQueryRaw | undefined)) return true
        if (tab.path.startsWith('/container/cluster/deploy')) return true
        return false
      })
      if (!toRemove.length) return

      markTabsToRemove(toRemove)
      const removePaths = new Set(toRemove.map((t) => t.path))
      opened.value = opened.value.filter((t) => !removePaths.has(t.path))

      if (current.value.path && removePaths.has(current.value.path)) {
        const clusterListTab = opened.value.find((t) => t.path === '/container/cluster')
        current.value = clusterListTab ?? opened.value[0] ?? {}
      }
    }

    return {
      // 状态
      current,
      opened,
      keepAliveExclude,

      // 计算属性
      hasOpenedTabs,
      hasMultipleTabs,
      currentTabIndex,

      // 方法
      openTab,
      removeTab,
      removeLeft,
      removeRight,
      removeOthers,
      removeAll,
      toggleFixedTab,
      validateWorktabs,
      clearAll,
      getStateSnapshot,

      // 工具方法
      findTabIndex,
      getTab,
      isTabClosable,
      addKeepAliveExclude,
      removeKeepAliveExclude,
      markTabsToRemove,
      getTabTitle,
      updateTabTitle,
      resetTabTitle,
      removeClusterContextTabs
    }
  },
  {
    persist: {
      key: 'worktab',
      storage: localStorage
    }
  }
)

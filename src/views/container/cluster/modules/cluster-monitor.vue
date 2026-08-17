<template>
  <ElDrawer
    v-model="visible"
    direction="rtl"
    size="950px"
    :destroy-on-close="true"
    :show-close="false"
    class="cluster-monitor-drawer"
  >
    <template #header>
      <div class="cluster-monitor-drawer-header">
        <span class="cluster-monitor-drawer-title">{{ cluster?.clusterName }}</span>
        <div class="cluster-monitor-drawer-actions">
          <ElButton
            text
            circle
            class="cluster-monitor-drawer-icon-btn"
            title="刷新"
            :loading="monitorRef?.metricsInitialLoading"
            @click="monitorRef?.refresh()"
          >
            <ElIcon :size="16"><Refresh /></ElIcon>
          </ElButton>
          <ElButton
            text
            circle
            class="cluster-monitor-drawer-icon-btn"
            title="关闭"
            @click="closeDrawer"
          >
            <ElIcon :size="16"><Close /></ElIcon>
          </ElButton>
        </div>
      </div>
    </template>
    <ClusterMonitorMetrics ref="monitorRef" :cluster-name="clusterName" />
  </ElDrawer>
</template>

<script setup lang="ts">
  import { Close, Refresh } from '@element-plus/icons-vue'
  import ClusterMonitorMetrics from './cluster-monitor-metrics.vue'

  interface ClusterItem {
    id: number
    name: string
    clusterName: string
  }

  interface Props {
    modelValue: boolean
    cluster: ClusterItem | null
  }
  interface Emits {
    (e: 'update:modelValue', val: boolean): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const visible = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
  })

  const clusterName = computed(() => props.cluster?.name ?? '')

  const monitorRef = ref<InstanceType<typeof ClusterMonitorMetrics> | null>(null)

  function closeDrawer() {
    visible.value = false
  }
</script>

<style scoped>
  .cluster-monitor-drawer {
    font-size: 12px;
  }

  .cluster-monitor-drawer :deep(.el-drawer__header) {
    margin-bottom: 0;
    padding: 8px 20px 0;
  }

  .cluster-monitor-drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: 24px;
    padding-right: 4px;
  }

  .cluster-monitor-drawer-title {
    font-size: 14px;
    font-weight: 500;
    line-height: 1;
    color: var(--el-text-color-primary);
  }

  .cluster-monitor-drawer-actions {
    display: flex;
    align-items: center;
    gap: 0;
  }

  .cluster-monitor-drawer-actions
    .cluster-monitor-drawer-icon-btn
    + .cluster-monitor-drawer-icon-btn {
    margin-left: -4px;
  }

  .cluster-monitor-drawer-icon-btn {
    width: 28px;
    height: 28px;
    padding: 0;
    color: var(--el-text-color-regular);
  }

  .cluster-monitor-drawer-icon-btn:hover {
    color: var(--el-text-color-primary);
  }

  .cluster-monitor-drawer :deep(.el-drawer) {
    display: flex;
    flex-direction: column;
  }

  .cluster-monitor-drawer :deep(.el-drawer__body) {
    flex: 1;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 0 20px 16px;
  }
</style>

<style>
  /* 窗口小于抽屉固定宽度时，抽屉收缩到可视区域，图表随之自适应 */
  .cluster-monitor-drawer.el-drawer {
    max-width: 100vw;
  }
  /* ElDrawer 挂载到 body，需全局样式确保标题与工具栏间距生效 */
  .cluster-monitor-drawer.el-drawer .el-drawer__header {
    margin-bottom: 0 !important;
    padding: 8px 20px 0 !important;
  }

  .cluster-monitor-drawer.el-drawer .el-drawer__body {
    padding: 0 20px 16px !important;
  }
</style>

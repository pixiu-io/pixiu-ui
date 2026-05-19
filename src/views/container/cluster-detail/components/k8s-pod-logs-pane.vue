<!-- Pod / Workload 日志 Tab（与 Deployment 详情 workloads 日志样式一致） -->
<template>
  <div class="k8s-pod-logs-pane">
    <div class="workloads-log-toolbar">
      <div class="workloads-log-row">
        <span class="workloads-log-label">容器选项</span>
        <ElSelect v-model="logContainer" class="workloads-log-select" placeholder="请选择">
          <ElOption v-for="c in logContainerOptions" :key="c" :label="c" :value="c" />
        </ElSelect>
        <div
          :class="['workloads-log-refresh-icon', { 'is-spinning': refreshing }]"
          role="button"
          tabindex="0"
          title="刷新"
          @click="loadPods"
          @keyup.enter="loadPods"
        >
          <ArtSvgIcon icon="ri:refresh-line" class="text-g-700" />
        </div>
      </div>
      <div class="workloads-log-row">
        <span class="workloads-log-label">选择行数</span>
        <ElSelect v-model="tailLines" class="workloads-log-lines">
          <ElOption :value="10" label="10" />
          <ElOption :value="25" label="25" />
          <ElOption :value="50" label="50" />
          <ElOption :value="100" label="100" />
        </ElSelect>
        <span class="workloads-log-suffix">行</span>
      </div>
      <div class="workloads-log-actions">
        <ElRadioGroup v-model="logMode" class="sc-radio-group sc-radio-group--fit">
          <ElRadioButton value="realtime">实时日志</ElRadioButton>
          <ElRadioButton value="history">历史日志</ElRadioButton>
        </ElRadioGroup>
        <div class="workloads-log-search">
          <ElInput v-model="keyword" placeholder="名称搜索关键字" clearable />
          <ElButton type="primary" :loading="loading" @click="fetchLogs">查询</ElButton>
        </div>
      </div>
    </div>

    <div class="workloads-log-content-label">日志内容</div>
    <K8sLogOutput
      :lines="logLines"
      :loading="loading"
      :download-name="downloadName"
      empty-text="暂无日志"
    />
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { ElMessage } from 'element-plus'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import K8sLogOutput from '@/components/kubernetes/k8s-log-output.vue'
  import { fetchK8sPod } from '@/api/kubernetes/pod'
  import type { K8sPod } from '@/api/kubernetes/pod'
  import { kubeProxyAxios } from '@/api/kubeProxy'

  defineOptions({ name: 'K8sPodLogsPane' })

  const props = withDefaults(
    defineProps<{
      cluster: string
      namespace: string
      podName: string
      active?: boolean
    }>(),
    { active: false }
  )

  const podName = computed(() => props.podName?.trim() ?? '')

  const currentPod = ref<K8sPod | null>(null)
  const logContainer = ref('')
  const tailLines = ref(10)
  const keyword = ref('')
  const logMode = ref<'history' | 'realtime'>('realtime')
  const loading = ref(false)
  const refreshing = ref(false)
  const logLines = ref<string[]>([])

  const downloadName = computed(
    () => `${podName.value || 'pod'}-${logContainer.value || 'container'}.log`
  )

  const logContainerOptions = computed(() =>
    (currentPod.value?.spec?.containers ?? []).map((c) => c.name ?? '').filter(Boolean)
  )

  async function loadPods() {
    if (!props.cluster || !props.namespace || !podName.value) {
      currentPod.value = null
      logContainer.value = ''
      return
    }

    refreshing.value = true
    try {
      const pod = await fetchK8sPod(props.cluster, props.namespace, podName.value)
      currentPod.value = pod
      if (!logContainer.value || !logContainerOptions.value.includes(logContainer.value)) {
        logContainer.value = logContainerOptions.value[0] ?? ''
      }
    } catch {
      currentPod.value = null
      logContainer.value = ''
    } finally {
      refreshing.value = false
    }
  }

  function parseLogError(e: unknown): string {
    let errorMessage = '获取日志失败'
    if (typeof e === 'object' && e !== null) {
      const maybeAxios = e as { message?: string; response?: { data?: unknown } }
      const responseData = maybeAxios.response?.data
      if (typeof responseData === 'string') {
        try {
          const parsed = JSON.parse(responseData) as { message?: string }
          errorMessage = parsed.message || responseData || maybeAxios.message || errorMessage
        } catch {
          errorMessage = responseData || maybeAxios.message || errorMessage
        }
      } else if (typeof responseData === 'object' && responseData !== null) {
        const payload = responseData as { message?: string }
        errorMessage = payload.message || maybeAxios.message || errorMessage
      } else if (maybeAxios.message) {
        errorMessage = maybeAxios.message
      }
    } else if (typeof e === 'string') {
      errorMessage = e
    }
    return errorMessage
  }

  async function fetchLogs() {
    if (!props.cluster || !props.namespace || !podName.value || !logContainer.value) {
      ElMessage.warning('请先选择容器')
      return
    }
    loading.value = true
    try {
      const url = `/pixiu/proxy/${encodeURIComponent(props.cluster)}/api/v1/namespaces/${encodeURIComponent(props.namespace)}/pods/${encodeURIComponent(podName.value)}/log`
      const { data } = await kubeProxyAxios.get<string>(url, {
        params: {
          container: logContainer.value,
          tailLines: tailLines.value,
          follow: false,
          previous: logMode.value === 'history'
        },
        responseType: 'text'
      })
      const kw = keyword.value.trim()
      logLines.value = String(data || '')
        .split('\n')
        .filter((line) => line.length > 0)
        .filter((line) => !kw || line.includes(kw))
    } catch (e: unknown) {
      logLines.value = []
      ElMessage.error(parseLogError(e))
    } finally {
      loading.value = false
    }
  }

  watch(
    () => [props.active, props.cluster, props.namespace, props.podName] as const,
    ([active]) => {
      if (active) void loadPods()
    },
    { immediate: true }
  )
</script>

<style scoped>
  .workloads-log-toolbar {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 10px;
  }

  .workloads-log-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .workloads-log-label {
    width: 68px;
    font-size: 13px;
    color: var(--el-text-color-primary);
    flex-shrink: 0;
  }

  .workloads-log-select {
    width: 210px;
  }

  .workloads-log-lines {
    width: 90px;
  }

  .workloads-log-suffix {
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  .workloads-log-refresh-icon {
    display: flex;
    width: 24px;
    height: 24px;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--el-text-color-secondary);
    border-radius: 4px;
    transition: background-color 0.15s ease;
  }

  .workloads-log-refresh-icon:hover {
    background: color-mix(in srgb, var(--art-gray-300) 45%, transparent);
  }

  .workloads-log-refresh-icon.is-spinning :deep(svg),
  .workloads-log-refresh-icon.is-spinning :deep(.i-svg) {
    animation: k8s-pod-logs-refresh-spin 0.9s linear infinite;
    transform-origin: center;
  }

  @keyframes k8s-pod-logs-refresh-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .workloads-log-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .workloads-log-search {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 320px;
  }

  .workloads-log-search :deep(.el-input) {
    flex: 1;
  }

  .workloads-log-content-label {
    margin: 10px 0 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-primary);
  }
</style>

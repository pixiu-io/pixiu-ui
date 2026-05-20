<template>
  <ElDialog
    v-model="visibleInner"
    width="900px"
    align-center
    destroy-on-close
    class="k8s-yaml-dialog"
    @closed="onClosed"
  >
    <template #header>
      <div class="k8s-yaml-dialog__header-content">
        <span class="k8s-yaml-dialog__title">YAML 创建资源</span>
      </div>
    </template>
    <div
      ref="editorShellRef"
      class="k8s-yaml-dialog__editor-shell"
      :class="{ 'k8s-yaml-dialog__editor-shell--fullscreen': editorFullscreen }"
    >
      <div class="k8s-yaml-dialog__editor-actions">
        <ElButton link type="primary" @click="copyAll">复制</ElButton>
        <ElButton link type="primary" @click="toggleEditorFullscreen">
          {{ editorFullscreen ? '退出全屏' : '全屏' }}
        </ElButton>
        <ElCheckbox v-model="wordWrap" class="k8s-yaml-dialog__wrap-check">换行</ElCheckbox>
        <ElButton
          link
          type="primary"
          title="下载"
          class="k8s-yaml-dialog__download-btn"
          @click="downloadYaml"
        >
          <ElIcon :size="16"><Download /></ElIcon>
        </ElButton>
      </div>
      <div class="k8s-yaml-dialog__editor-body">
        <K8sMonacoEditor
          v-model="yamlText"
          :read-only="false"
          :height="480"
          :font-size="12"
          :fill-height="editorFullscreen"
          :word-wrap="wordWrap"
        />
      </div>
    </div>
    <template #footer>
      <div class="k8s-yaml-dialog__footer">
        <ElButton @click="visibleInner = false">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="onConfirm">确定</ElButton>
      </div>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { Download } from '@element-plus/icons-vue'
  import { ElButton, ElCheckbox, ElDialog, ElIcon, ElMessage } from 'element-plus'
  import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
  import { createK8sResourceFromYaml } from '@/api/kubernetes/yamlCreate'
  import K8sMonacoEditor from '@/components/kubernetes/k8s-monaco-editor.vue'

  const props = defineProps<{
    visible: boolean
    /** 集群内部名称，与 route.query.cluster 一致 */
    cluster: string
  }>()

  const emit = defineEmits<{
    (e: 'update:visible', v: boolean): void
    (e: 'success'): void
  }>()

  const visibleInner = computed({
    get: () => props.visible,
    set: (v) => emit('update:visible', v)
  })

  const yamlText = ref('')
  const submitting = ref(false)

  /** 对齐 pod 日志区 K8sLogOutput：默认开启换行 */
  const wordWrap = ref(true)
  const editorShellRef = ref<HTMLElement | null>(null)
  const editorFullscreen = ref(false)

  watch(
    () => props.visible,
    (v) => {
      if (v) yamlText.value = ''
    }
  )

  function onClosed() {
    yamlText.value = ''
    wordWrap.value = true
    void exitEditorFullscreenIfNeeded()
  }

  async function copyAll() {
    if (!yamlText.value) {
      ElMessage.warning('暂无内容')
      return
    }
    try {
      await navigator.clipboard.writeText(yamlText.value)
      ElMessage.success('已复制')
    } catch {
      ElMessage.error('复制失败')
    }
  }

  function downloadYaml() {
    if (!yamlText.value) {
      ElMessage.warning('暂无内容')
      return
    }
    const blob = new Blob([yamlText.value], { type: 'text/yaml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `resource-create-${props.cluster?.trim() || 'cluster'}.yaml`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function exitEditorFullscreenIfNeeded() {
    if (document.fullscreenElement === editorShellRef.value) {
      await document.exitFullscreen()
    }
    editorFullscreen.value = false
  }

  async function toggleEditorFullscreen() {
    const el = editorShellRef.value
    if (!el) return
    if (!editorFullscreen.value) {
      try {
        await el.requestFullscreen()
        editorFullscreen.value = true
        await nextTick()
      } catch {
        editorFullscreen.value = true
        await nextTick()
      }
    } else {
      await exitEditorFullscreenIfNeeded()
    }
  }

  function onFullscreenChange() {
    if (!document.fullscreenElement) {
      editorFullscreen.value = false
    } else if (document.fullscreenElement === editorShellRef.value) {
      editorFullscreen.value = true
    }
  }

  onMounted(() => {
    document.addEventListener('fullscreenchange', onFullscreenChange)
  })

  onUnmounted(async () => {
    document.removeEventListener('fullscreenchange', onFullscreenChange)
    await exitEditorFullscreenIfNeeded()
  })

  async function onConfirm() {
    const cluster = props.cluster?.trim()
    if (!cluster) {
      ElMessage.warning('未选择集群')
      return
    }
    submitting.value = true
    try {
      await createK8sResourceFromYaml(cluster, yamlText.value)
      ElMessage.success('创建成功')
      visibleInner.value = false
      emit('success')
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '创建失败')
    } finally {
      submitting.value = false
    }
  }
</script>

<style scoped lang="scss">
  .k8s-yaml-dialog__header-content {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-right: 28px;
  }

  .k8s-yaml-dialog__title {
    font-size: 16px;
    font-weight: 600;
    line-height: 1;
    color: var(--el-text-color-primary);
  }

  :deep(.el-dialog__footer) {
    justify-content: center !important;
  }

  .k8s-yaml-dialog__footer {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    width: 100%;
  }

  .k8s-yaml-dialog__editor-shell {
    display: flex;
    flex-direction: column;
    min-height: 480px;
    border: 1px solid var(--el-border-color);
    border-radius: 4px;
    overflow: hidden;
    background: #2d3035;
  }

  .k8s-yaml-dialog__editor-shell--fullscreen {
    position: fixed;
    inset: 0;
    z-index: 3000;
    min-height: 100vh;
    border-radius: 0;
    border: none;
    background: #2d3035;
  }

  /** 对齐 k8s-log-output.vue 的工具条 */
  .k8s-yaml-dialog__editor-actions {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: flex-end;
    gap: 4px 2px;
    padding: 4px 8px;
    background: #383c42;
    border-bottom: 1px solid #4d5259;
  }

  .k8s-yaml-dialog__editor-actions :deep(.el-button.is-link) {
    color: #4ea1ff;
    font-size: 12px;
    padding: 2px 4px;
    margin-left: 0;
  }

  .k8s-yaml-dialog__download-btn {
    margin-left: 2px !important;
  }

  .k8s-yaml-dialog__download-btn.is-link:not(.is-disabled) :deep(.el-icon) {
    color: #4ea1ff;
  }

  .k8s-yaml-dialog__wrap-check {
    margin-left: 4px;
  }

  .k8s-yaml-dialog__wrap-check :deep(.el-checkbox__label) {
    color: #d8d8d8;
    font-size: 12px;
  }

  .k8s-yaml-dialog__wrap-check :deep(.el-checkbox__inner) {
    background: transparent;
    border-color: #8a8f96;
  }

  .k8s-yaml-dialog__editor-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .k8s-yaml-dialog__editor-body :deep(.k8s-monaco-editor) {
    border: none;
    border-radius: 0;
  }
</style>

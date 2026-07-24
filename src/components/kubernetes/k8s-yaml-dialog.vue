<template>
  <ElDialog
    v-model="visible"
    :width="width"
    align-center
    destroy-on-close
    class="k8s-yaml-dialog"
    :close-on-click-modal="false"
    @closed="onClosed"
  >
    <template #header>
      <div class="k8s-yaml-dialog__header-content">
        <span class="k8s-yaml-dialog__title">{{ title }}</span>
      </div>
    </template>
    <div
      ref="editorShellRef"
      class="k8s-yaml-dialog__editor-shell"
      :class="{ 'k8s-yaml-dialog__editor-shell--fullscreen': editorFullscreen }"
    >
      <div class="k8s-yaml-dialog__editor-actions">
        <ElButton v-if="footerMode === 'edit' && !isEditing" link type="primary" @click="startEdit"
          >编辑</ElButton
        >
        <ElButton v-if="footerMode === 'edit' && isEditing" link type="primary" @click="cancelEdit"
          >退出编辑</ElButton
        >
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
          v-if="visible"
          v-model="innerYaml"
          :read-only="editorReadOnly"
          :height="editorHeight"
          :font-size="12"
          :fill-height="editorFullscreen"
          :word-wrap="wordWrap"
        />
      </div>
    </div>
    <template #footer>
      <div class="k8s-yaml-dialog__footer">
        <template v-if="footerMode === 'edit' && isEditing">
          <ElButton @click="cancelEdit">{{ cancelText }}</ElButton>
          <ElButton type="primary" :loading="submitLoading" @click="onSave">{{
            confirmText
          }}</ElButton>
        </template>
        <template v-else-if="footerMode !== 'edit'">
          <ElButton class="k8s-yaml-dialog__btn-close" @click="close">{{ closeText }}</ElButton>
          <ElButton type="primary" :loading="submitLoading" @click="onDashboardConfirm">{{
            confirmText
          }}</ElButton>
        </template>
      </div>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { Download } from '@element-plus/icons-vue'
  import { ElButton, ElCheckbox, ElDialog, ElIcon, ElMessage } from 'element-plus'
  import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
  import K8sMonacoEditor from './k8s-monaco-editor.vue'

  const props = withDefaults(
    defineProps<{
      modelValue: boolean
      yaml: string
      title?: string
      readOnly?: boolean
      width?: string
      editorHeight?: number
      /** dashboard：关闭 + 确认（与旧版 dashboard 一致）；edit：取消 + 确定 */
      footerMode?: 'dashboard' | 'edit'
      confirmText?: string
      closeText?: string
      cancelText?: string
      showCopy?: boolean
      submitLoading?: boolean
    }>(),
    {
      title: '查看Yaml',
      readOnly: true,
      width: '900px',
      editorHeight: 480,
      footerMode: 'dashboard',
      confirmText: '确认',
      closeText: '关闭',
      cancelText: '取消',
      showCopy: false,
      submitLoading: false
    }
  )

  const emit = defineEmits<{
    'update:modelValue': [boolean]
    save: [string]
  }>()

  const innerYaml = ref(props.yaml)
  const wordWrap = ref(true)
  const editorShellRef = ref<HTMLElement | null>(null)
  const editorFullscreen = ref(false)
  const isEditing = ref(false)
  const editBackupYaml = ref('')

  const editorReadOnly = computed(() => {
    if (props.footerMode === 'edit') {
      return !isEditing.value
    }
    return props.readOnly
  })

  watch(
    () => [props.modelValue, props.yaml] as const,
    ([open, y], [prevOpen]) => {
      if (open) {
        innerYaml.value = y
        if (!prevOpen) {
          isEditing.value = false
        }
      }
    }
  )

  const visible = computed({
    get: () => props.modelValue,
    set: (v: boolean) => emit('update:modelValue', v)
  })

  function close() {
    emit('update:modelValue', false)
  }

  function onDashboardConfirm() {
    emit('update:modelValue', false)
  }

  function onSave() {
    emit('save', innerYaml.value)
  }

  function startEdit() {
    editBackupYaml.value = innerYaml.value
    isEditing.value = true
    ElMessage.success('已进入编辑模式')
  }

  function cancelEdit() {
    innerYaml.value = editBackupYaml.value
    isEditing.value = false
    ElMessage.info('已退出编辑模式')
  }

  function onClosed() {
    wordWrap.value = true
    isEditing.value = false
    void exitEditorFullscreenIfNeeded()
  }

  async function copyAll() {
    if (!innerYaml.value) {
      ElMessage.warning('暂无内容')
      return
    }
    try {
      await navigator.clipboard.writeText(innerYaml.value)
      ElMessage.success('已复制')
    } catch {
      ElMessage.error('复制失败')
    }
  }

  function downloadYaml() {
    if (!innerYaml.value) {
      ElMessage.warning('暂无内容')
      return
    }
    const blob = new Blob([innerYaml.value], { type: 'text/yaml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'resource.yaml'
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

<style lang="scss">
  .k8s-yaml-dialog.el-dialog {
    margin-top: 6vh;
  }

  /* 标题与 YAML 编辑框间距收紧 10px */
  .k8s-yaml-dialog .el-dialog__header {
    padding-bottom: calc(var(--el-dialog-padding-primary, 16px) - 10px);
  }

  .k8s-yaml-dialog .el-dialog__body {
    padding-top: 8px;
    padding-bottom: 4px;
  }

  .k8s-yaml-dialog .el-dialog__footer {
    justify-content: center;
    /* 编辑框与取消/确认按钮间距收紧 10px */
    padding-top: calc(var(--el-dialog-padding-primary, 16px) - 10px);
  }
</style>

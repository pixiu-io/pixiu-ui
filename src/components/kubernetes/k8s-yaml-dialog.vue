<template>
  <ElDialog
    v-model="visible"
    :title="title"
    :width="width"
    destroy-on-close
    align-center
    class="k8s-yaml-dialog"
    :close-on-click-modal="false"
  >
    <div class="k8s-yaml-dialog__editor-wrap">
      <K8sMonacoEditor
        v-if="visible"
        v-model="innerYaml"
        :read-only="readOnly"
        :height="editorHeight"
      />
    </div>
    <template #footer>
      <div class="k8s-yaml-dialog__footer">
        <ElButton v-if="showCopy" @click="copyAll">复制</ElButton>
        <template v-if="footerMode === 'edit'">
          <ElButton @click="close">{{ cancelText }}</ElButton>
          <ElButton type="primary" :loading="submitLoading" @click="onSave">{{ confirmText }}</ElButton>
        </template>
        <template v-else>
          <ElButton class="k8s-yaml-dialog__btn-close" @click="close">{{ closeText }}</ElButton>
          <ElButton type="primary" :loading="submitLoading" @click="onDashboardConfirm">{{ confirmText }}</ElButton>
        </template>
      </div>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { ElButton, ElDialog, ElMessage } from 'element-plus'
  import { computed, ref, watch } from 'vue'
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

  watch(
    () => [props.modelValue, props.yaml] as const,
    ([open, y]) => {
      if (open) innerYaml.value = y
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

  function copyAll() {
    if (!innerYaml.value) return
    void navigator.clipboard.writeText(innerYaml.value)
    ElMessage.success('已复制')
  }
</script>

<style scoped lang="scss">
  .k8s-yaml-dialog__editor-wrap {
    margin: 0 -4px;
  }

  .k8s-yaml-dialog__footer {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    justify-content: center;
  }
</style>

<style lang="scss">
  .k8s-yaml-dialog.el-dialog {
    margin-top: 6vh;
  }

  .k8s-yaml-dialog .el-dialog__body {
    padding-top: 8px;
    padding-bottom: 4px;
  }
</style>

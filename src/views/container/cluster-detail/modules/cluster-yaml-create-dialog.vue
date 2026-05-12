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
        <ElButton class="k8s-yaml-dialog__copy-btn" @click="copyAll">复制</ElButton>
      </div>
    </template>
    <div class="k8s-yaml-dialog__editor-wrap">
      <K8sMonacoEditor v-model="yamlText" :read-only="false" :height="480" />
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
  import { ElButton, ElDialog, ElMessage } from 'element-plus'
  import { computed, ref, watch } from 'vue'
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

  watch(
    () => props.visible,
    (v) => {
      if (v) yamlText.value = ''
    }
  )

  function onClosed() {
    yamlText.value = ''
  }

  function copyAll() {
    if (!yamlText.value) return
    void navigator.clipboard.writeText(yamlText.value)
    ElMessage.success('已复制')
  }

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
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding-right: 28px;
  }

  .k8s-yaml-dialog__title {
    font-size: 16px;
    font-weight: 600;
    line-height: 1;
    color: var(--el-text-color-primary);
  }

  .k8s-yaml-dialog__copy-btn {
    margin-top: 5px;
    margin-bottom: -25px;
    width: 85px;
  }
</style>

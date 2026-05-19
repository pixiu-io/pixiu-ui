<!-- Workload 镜像列表：查看与 PATCH 更新容器镜像（对齐 dashboard deployment 镜像管理） -->
<template>
  <ElDialog
    :model-value="modelValue"
    title="镜像列表"
    width="700px"
    align-center
    destroy-on-close
    class="workload-image-dialog"
    @update:model-value="emit('update:modelValue', $event)"
    @closed="onClosed"
  >
    <ElTable
      v-loading="loading"
      :data="imageRows"
      stripe
      size="small"
      class="workload-image-dialog__table"
      empty-text="暂无容器镜像"
    >
      <ElTableColumn label="容器名称" prop="name" width="200">
        <template #default="{ row }">
          <div class="workload-image-dialog__name-cell">
            <span class="workload-image-dialog__name-text">{{ row.name }}</span>
            <ElTag v-if="row.init" size="small" type="danger" class="workload-image-dialog__init-tag">
              Init
            </ElTag>
          </div>
        </template>
      </ElTableColumn>
      <ElTableColumn label="镜像" min-width="360">
        <template #default="{ row }">
          <div v-if="!row.editing" class="workload-image-dialog__image-cell">
            <span class="workload-image-dialog__image-value">
              <span class="workload-image-dialog__image-text">{{ row.image }}</span>
              <ElButton
                link
                type="primary"
                class="workload-image-dialog__edit-btn"
                title="编辑"
                :disabled="patching"
                @click.stop="startEdit(row)"
              >
                <ArtSvgIcon icon="ri:edit-line" class="workload-image-dialog__edit-icon" />
              </ElButton>
            </span>
          </div>
          <div v-else class="workload-image-dialog__edit-cell">
            <ElInput
              v-model="row.newImage"
              class="workload-image-dialog__image-input"
              placeholder="请输入完整镜像地址"
              clearable
              @keyup.enter="confirmEdit(row)"
            />
            <div class="workload-image-dialog__edit-actions">
              <span
                class="workload-image-dialog__action-text"
                :class="{ 'is-disabled': patching }"
                @click.stop="!patching && confirmEdit(row)"
              >
                确认
              </span>
              <span
                class="workload-image-dialog__action-text"
                :class="{ 'is-disabled': patching }"
                @click.stop="!patching && cancelEdit(row)"
              >
                取消
              </span>
            </div>
          </div>
        </template>
      </ElTableColumn>
    </ElTable>

    <template #footer>
      <ElButton @click="emit('update:modelValue', false)">关闭</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { fetchK8sDeployment, patchK8sDeployment } from '@/api/kubernetes/deployment'
  import { fetchK8sDaemonSet, patchK8sDaemonSet } from '@/api/kubernetes/daemonset'
  import { fetchK8sStatefulSet, patchK8sStatefulSet } from '@/api/kubernetes/statefulset'

  export type WorkloadImageKind = 'deploy' | 'sts' | 'ds'

  interface ImageRow {
    name: string
    image: string
    init: boolean
    editing: boolean
    newImage: string
  }

  const props = defineProps<{
    modelValue: boolean
    cluster: string
    namespace: string
    name: string
    kind: WorkloadImageKind
  }>()

  const emit = defineEmits<{
    'update:modelValue': [boolean]
    updated: []
  }>()

  const loading = ref(false)
  const patching = ref(false)
  const imageRows = ref<ImageRow[]>([])

  function extractContainers(spec: { containers?: Array<{ name?: string; image?: string }>; initContainers?: Array<{ name?: string; image?: string }> } | undefined): ImageRow[] {
    const rows: ImageRow[] = []
    for (const c of spec?.containers ?? []) {
      if (!c.name) continue
      rows.push({
        name: c.name,
        image: c.image ?? '',
        init: false,
        editing: false,
        newImage: ''
      })
    }
    for (const c of spec?.initContainers ?? []) {
      if (!c.name) continue
      rows.push({
        name: c.name,
        image: c.image ?? '',
        init: true,
        editing: false,
        newImage: ''
      })
    }
    return rows
  }

  async function loadImages() {
    const { cluster, namespace, name, kind } = props
    if (!cluster || !namespace || !name) {
      imageRows.value = []
      return
    }
    loading.value = true
    try {
      if (kind === 'deploy') {
        const deploy = await fetchK8sDeployment(cluster, namespace, name)
        imageRows.value = extractContainers(deploy.spec?.template?.spec)
      } else if (kind === 'sts') {
        const sts = await fetchK8sStatefulSet(cluster, namespace, name)
        imageRows.value = extractContainers(sts.spec?.template?.spec)
      } else {
        const ds = await fetchK8sDaemonSet(cluster, namespace, name)
        imageRows.value = extractContainers(ds.spec?.template?.spec)
      }
    } catch (e: unknown) {
      imageRows.value = []
      ElMessage.error(e instanceof Error ? e.message : '加载镜像列表失败')
    } finally {
      loading.value = false
    }
  }

  function buildImagePatch(row: ImageRow) {
    const containerKey = row.init ? 'initContainers' : 'containers'
    return {
      spec: {
        template: {
          spec: {
            [`$setElementOrder/${containerKey}`]: [{ name: row.name }],
            [containerKey]: [{ name: row.name, image: row.newImage.trim() }]
          }
        }
      }
    }
  }

  async function patchWorkload(patch: object) {
    const { cluster, namespace, name, kind } = props
    if (kind === 'deploy') {
      await patchK8sDeployment(cluster, namespace, name, patch)
    } else if (kind === 'sts') {
      await patchK8sStatefulSet(cluster, namespace, name, patch)
    } else {
      await patchK8sDaemonSet(cluster, namespace, name, patch)
    }
  }

  function closeAllEditing(except?: ImageRow) {
    for (const r of imageRows.value) {
      if (except && r === except) continue
      r.editing = false
      r.newImage = ''
    }
  }

  function startEdit(row: ImageRow) {
    closeAllEditing(row)
    row.newImage = row.image
    row.editing = true
  }

  function cancelEdit(row: ImageRow) {
    row.editing = false
    row.newImage = ''
  }

  async function confirmEdit(row: ImageRow) {
    if (!row.newImage.trim()) {
      ElMessage.warning('新的镜像名称为必选项')
      return
    }
    patching.value = true
    try {
      await patchWorkload(buildImagePatch(row))
      row.image = row.newImage.trim()
      row.editing = false
      row.newImage = ''
      ElMessage.success('镜像更新成功')
      emit('updated')
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '镜像更新失败')
    } finally {
      patching.value = false
    }
  }

  function onClosed() {
    imageRows.value = []
    patching.value = false
  }

  watch(
    () => [props.modelValue, props.cluster, props.namespace, props.name, props.kind] as const,
    ([visible]) => {
      if (visible) void loadImages()
    }
  )
</script>

<style scoped>
  .workload-image-dialog__table {
    width: 100%;
  }

  .workload-image-dialog__name-cell {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .workload-image-dialog__name-text {
    font-size: 13px;
    line-height: 1.5;
    word-break: break-all;
  }

  .workload-image-dialog__init-tag {
    flex-shrink: 0;
  }

  .workload-image-dialog__image-cell {
    max-width: 100%;
    overflow-x: auto;
  }

  .workload-image-dialog__image-value {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
  }

  .workload-image-dialog__image-text {
    flex-shrink: 0;
    font-size: 12px;
    white-space: nowrap;
    line-height: 1.4;
    color: var(--el-text-color-primary);
  }

  .workload-image-dialog__edit-btn {
    flex-shrink: 0;
    padding: 0 2px;
    height: auto;
  }

  .workload-image-dialog__edit-icon {
    font-size: 14px;
    color: inherit;
  }

  /* 暗黑模式：避免继承表格文字色导致编辑图标对比度不足 */
  html.dark .workload-image-dialog__edit-btn:not(.is-disabled) {
    color: var(--el-color-primary);
  }

  html.dark .workload-image-dialog__edit-btn:not(.is-disabled):hover,
  html.dark .workload-image-dialog__edit-btn:not(.is-disabled):focus {
    color: var(--el-color-primary-light-3);
  }

  .workload-image-dialog__edit-cell {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-width: 0;
  }

  .workload-image-dialog__image-input {
    flex: 1;
    min-width: 0;
  }

  .workload-image-dialog__image-input :deep(.el-input__inner) {
    font-size: 12px;
  }

  .workload-image-dialog__edit-actions {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
  }

  .workload-image-dialog__action-text {
    font-size: 12px;
    color: var(--el-color-primary);
    cursor: pointer;
    user-select: none;
    line-height: 1;
  }

  .workload-image-dialog__action-text:hover:not(.is-disabled) {
    opacity: 0.85;
  }

  .workload-image-dialog__action-text.is-disabled {
    color: var(--el-text-color-disabled);
    cursor: not-allowed;
  }
</style>

<style>
  .workload-image-dialog.el-dialog .el-dialog__body {
    padding-top: 12px;
    padding-bottom: 8px;
  }

  .workload-image-dialog.el-dialog .el-dialog__footer {
    padding-top: 8px;
  }

</style>

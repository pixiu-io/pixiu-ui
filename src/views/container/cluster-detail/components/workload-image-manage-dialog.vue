<!-- Workload 镜像列表：查看与 PATCH 更新容器镜像（对齐 dashboard deployment 镜像管理） -->
<template>
  <ElDialog
    :model-value="modelValue"
    title="镜像列表"
    width="800px"
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
      class="workload-image-dialog__table"
      empty-text="暂无容器镜像"
    >
      <ElTableColumn label="容器名称" prop="name" width="180">
        <template #default="{ row }">
          <div class="workload-image-dialog__name-cell">
            <span class="workload-image-dialog__name-text">{{ row.name }}</span>
            <ElTag v-if="row.init" size="small" type="danger" class="workload-image-dialog__init-tag">
              Init
            </ElTag>
          </div>
        </template>
      </ElTableColumn>
      <ElTableColumn label="镜像" min-width="440">
        <template #default="{ row }">
          <div v-if="!row.editing" class="workload-image-dialog__image-cell">
            <span class="workload-image-dialog__image-value">
              <span class="workload-image-dialog__image-text">{{ row.image }}</span>
              <ElButton
                link
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
            <ElPopover
              v-model:visible="row.editing"
              placement="top-end"
              :width="100"
              trigger="manual"
              popper-class="workload-image-dialog__edit-popover"
              @hide="onPopoverHide(row)"
            >
              <template #reference>
                <span class="workload-image-dialog__popover-anchor" aria-hidden="true" />
              </template>
              <div class="workload-image-dialog__edit-actions">
                <span
                  class="workload-image-dialog__action-text"
                  :class="{ 'is-disabled': patching }"
                  @click="!patching && confirmEdit(row)"
                >
                  确认
                </span>
                <span
                  class="workload-image-dialog__action-text"
                  :class="{ 'is-disabled': patching }"
                  @click="!patching && cancelEdit(row)"
                >
                  取消
                </span>
              </div>
            </ElPopover>
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

  function onPopoverHide(row: ImageRow) {
    if (!patching.value) {
      row.editing = false
      row.newImage = ''
    }
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
  }

  .workload-image-dialog__image-value {
    display: inline-flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 4px;
    max-width: 100%;
    overflow-x: auto;
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
    color: #000;
  }

  .workload-image-dialog__edit-btn:hover,
  .workload-image-dialog__edit-btn:focus {
    color: #333;
  }

  .workload-image-dialog__edit-btn.is-disabled {
    color: var(--el-text-color-disabled);
  }

  .workload-image-dialog__edit-icon {
    font-size: 14px;
    color: inherit;
  }

  .workload-image-dialog__edit-cell {
    position: relative;
    width: 100%;
    padding-right: 8px;
  }

  .workload-image-dialog__image-input {
    width: 100%;
  }

  .workload-image-dialog__image-input :deep(.el-input__inner) {
    font-size: 12px;
  }

  .workload-image-dialog__popover-anchor {
    position: absolute;
    top: 0;
    right: 0;
    width: 1px;
    height: 1px;
    pointer-events: none;
  }

  .workload-image-dialog__edit-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
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
  .workload-image-dialog__edit-popover.el-popover.el-popper {
    padding: 8px 10px;
    min-width: auto;
  }
</style>

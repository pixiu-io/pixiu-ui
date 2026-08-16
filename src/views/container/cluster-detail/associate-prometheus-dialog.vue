<template>
  <ElDialog
    v-model="visible"
    title="关联 Prometheus 实例"
    width="460px"
    append-to-body
    align-center
    class="associate-prometheus-dialog"
    @open="handleOpen"
    @closed="handleClosed"
  >
    <ElForm label-width="78px" label-position="left" class="associate-prometheus-dialog__form">
      <ElFormItem label="选择实例">
        <div class="associate-prometheus-dialog__select-row">
          <ElSelect
            v-model="selectedInstanceId"
            class="associate-prometheus-dialog__instance"
            placeholder="请选择 Prometheus 实例"
            filterable
            :loading="instanceLoading"
          >
            <ElOption
              v-for="item in instances"
              :key="item.id"
              :label="`${item.name}（${item.clusterName}）`"
              :value="item.id"
            />
          </ElSelect>
        </div>

        <p class="associate-prometheus-dialog__hint">
          如现有"实例"不符合您的要求，可以去控制台
          <ElLink type="primary" @click="goCreate">新建实例</ElLink>
        </p>
      </ElFormItem>
    </ElForm>

    <template #footer>
      <ElButton @click="visible = false">取消</ElButton>
      <ElButton
        type="primary"
        :disabled="selectedInstanceId === undefined"
        :loading="submitting"
        @click="handleConfirm"
      >
        确认
      </ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import { computed, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import {
    fetchCreateDatasource,
    fetchDatasourceList,
    resolveDatasourceUrl,
    type CreateDatasourcePayload,
    type DatasourceItem
  } from '@/api/datasource'

  defineOptions({ name: 'AssociatePrometheusDialog' })

  const props = defineProps<{
    modelValue: boolean
    clusterName: string
  }>()

  const emit = defineEmits<{
    (e: 'update:modelValue', val: boolean): void
    (e: 'associated'): void
  }>()

  const router = useRouter()

  const visible = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
  })

  const instances = ref<DatasourceItem[]>([])
  const instanceLoading = ref(false)
  const selectedInstanceId = ref<number>()
  const submitting = ref(false)
  const currentClusterNames = ref<Set<string>>(new Set())

  async function loadInstances() {
    instanceLoading.value = true
    try {
      const { items } = await fetchDatasourceList({ type: 1, subType: 'prometheus' })
      instances.value = items.filter((item) => item.type === 1 && item.subType === 'prometheus')
      currentClusterNames.value = new Set(
        items.filter((item) => item.clusterName === props.clusterName).map((item) => item.name)
      )
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '获取实例列表失败')
    } finally {
      instanceLoading.value = false
    }
  }

  function handleOpen() {
    selectedInstanceId.value = undefined
    void loadInstances()
  }

  function handleClosed() {
    selectedInstanceId.value = undefined
    submitting.value = false
  }

  function resolveName(item: DatasourceItem): string {
    return currentClusterNames.value.has(item.name) ? `${item.name}-副本` : item.name
  }

  async function handleConfirm() {
    const selected = instances.value.find((item) => item.id === selectedInstanceId.value)
    if (!selected) return

    submitting.value = true
    try {
      const payload: CreateDatasourcePayload = {
        clusterName: props.clusterName,
        name: resolveName(selected),
        type: 1,
        subType: 'prometheus',
        url: resolveDatasourceUrl(selected),
        external: selected.external,
        config: {
          headers: selected.config.headers,
          log: selected.config.log,
          alert: selected.config.alert
        },
        isDefault: true
      }
      await fetchCreateDatasource(payload)
      ElMessage.success('关联成功')
      emit('associated')
      visible.value = false
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '关联失败')
    } finally {
      submitting.value = false
    }
  }

  function goCreate() {
    visible.value = false
    router.push('/monitor/datasource')
  }
</script>

<style scoped lang="scss">
  .associate-prometheus-dialog {
    :deep(.el-dialog__header) {
      padding: 16px 20px 8px;
      margin: 0;
    }

    :deep(.el-dialog__title) {
      font-size: 16px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }

    :deep(.el-dialog__body) {
      padding: 12px 20px 8px;
    }

    :deep(.el-dialog__footer) {
      padding: 12px 20px 16px;
    }
  }

  .associate-prometheus-dialog__form {
    padding-left: 24px;
    font-size: 12px;

    :deep(.el-form-item__label) {
      font-size: 12px;
      color: var(--el-text-color-regular);
    }

    :deep(.el-input__wrapper),
    :deep(.el-select__wrapper) {
      min-height: 32px;
      border-radius: 4px;
    }

    :deep(.el-input__inner),
    :deep(.el-select__placeholder),
    :deep(.el-select__selected-item) {
      font-size: 12px;
    }
  }

  .associate-prometheus-dialog__select-row {
    display: flex;
    gap: 8px;
    align-items: center;
    width: 100%;
  }

  .associate-prometheus-dialog__instance {
    flex: 0 0 300px;
  }

  .associate-prometheus-dialog__hint {
    margin: 8px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--el-text-color-secondary);

    :deep(.el-link) {
      font-size: 12px;
      vertical-align: baseline;
    }
  }
</style>

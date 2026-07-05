<template>
  <ElDialog
    v-model="visible"
    :title="mode === 'install' ? '部署 Helm 应用' : '升级 Helm 应用'"
    width="640px"
    destroy-on-close
    class="helm-form-dialog helm-form-dialog--release"
    @close="emit('close')"
  >
    <ElForm label-position="top" class="helm-form-dialog__form">
      <ElFormItem label="Release 名称" required>
        <ElInput v-model="form.name" :disabled="mode === 'upgrade'" placeholder="例如 my-nginx" />
      </ElFormItem>
      <ElRow :gutter="16">
        <ElCol :span="12">
          <ElFormItem label="Chart" required>
            <ElInput v-model="form.chart" placeholder="repo/chart 或 chart 名" />
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="Chart 版本" required>
            <ElInput v-model="form.version" placeholder="例如 15.2.0" />
          </ElFormItem>
        </ElCol>
      </ElRow>
      <ElFormItem label="Values (YAML)">
        <ElInput
          v-model="valuesText"
          type="textarea"
          :rows="8"
          placeholder="可选，例如：&#10;replicaCount: 2"
        />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click="visible = false">取消</ElButton>
      <ElButton type="primary" :loading="submitting" @click="emit('submit')">
        {{ mode === 'install' ? '部署' : '升级' }}
      </ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  defineProps<{
    mode: 'install' | 'upgrade'
    submitting: boolean
  }>()

  const visible = defineModel<boolean>('visible', { required: true })
  const form = defineModel<{ name: string; chart: string; version: string }>('form', { required: true })
  const valuesText = defineModel<string>('valuesText', { required: true })

  const emit = defineEmits<{ close: []; submit: [] }>()
</script>

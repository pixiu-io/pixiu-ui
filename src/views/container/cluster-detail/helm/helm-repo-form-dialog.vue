<template>
  <ElDialog
    v-model="visible"
    :title="form.id ? '编辑 Chart 仓库' : '添加 Chart 仓库'"
    width="560px"
    destroy-on-close
    class="helm-form-dialog helm-form-dialog--repo"
    @close="emit('close')"
  >
    <ElForm label-position="top" class="helm-form-dialog__form">
      <ElFormItem label="仓库名称" required>
        <ElInput v-model="form.name" placeholder="例如 bitnami" />
      </ElFormItem>
      <ElFormItem label="仓库 URL" required>
        <ElInput v-model="form.url" placeholder="https://charts.example.com" />
      </ElFormItem>
      <ElRow :gutter="16">
        <ElCol :span="12">
          <ElFormItem label="用户名">
            <ElInput v-model="form.username" placeholder="可选" />
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="密码">
            <ElInput v-model="form.password" type="password" show-password placeholder="可选" />
          </ElFormItem>
        </ElCol>
      </ElRow>
    </ElForm>
    <template #footer>
      <ElButton @click="visible = false">取消</ElButton>
      <ElButton type="primary" :loading="submitting" @click="emit('submit')">保存</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  defineProps<{ submitting: boolean }>()

  const visible = defineModel<boolean>('visible', { required: true })
  const form = defineModel<{
    id: number
    name: string
    url: string
    username: string
    password: string
    resource_version: number
  }>('form', { required: true })

  const emit = defineEmits<{ close: []; submit: [] }>()
</script>

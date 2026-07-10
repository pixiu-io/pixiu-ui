<!-- 配置告警 -->
<template>
  <ElCard shadow="never">
    <template #header>
      <span class="page-hd">配置告警-开发中</span>
    </template>
    <ElForm label-width="80px" class="form-block">
      <ElFormItem label="告警渠道">
        <ElCheckboxGroup v-model="channels">
          <ElCheckbox value="email">邮件</ElCheckbox>
          <ElCheckbox value="wecom">企业微信</ElCheckbox>
          <ElCheckbox value="hook">Webhook</ElCheckbox>
        </ElCheckboxGroup>
      </ElFormItem>
      <ElFormItem label="说明">
        <ElInput type="textarea" :rows="3" placeholder="告警规则与通知渠道（演示，待对接后端）" />
      </ElFormItem>
    </ElForm>
  </ElCard>
</template>

<script setup lang="ts">
  import { ref } from 'vue'

  defineOptions({ name: 'AlertConfig' })

  const channels = ref<string[]>(['email'])
</script>

<style scoped>
  .page-hd {
    font-size: 15px;
    font-weight: 600;
  }

  .form-block {
    max-width: 500px;
    font-size: 12px;
  }

  .form-block :deep(.el-checkbox__label) {
    font-size: 12px;
  }

  .form-block :deep(.el-textarea__inner) {
    font-size: 12px;
  }

  .form-block :deep(.el-form-item__label) {
    font-size: 12px;
  }
</style>

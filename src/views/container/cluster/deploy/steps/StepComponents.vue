<template>
  <div class="step-components">
    <div class="component-card">
      <div class="component-info">
        <div class="component-name">Prometheus 监控</div>
        <div class="component-desc">
          安装 Prometheus 监控服务，自动收集集群、节点和容器的指标数据，配合 Grafana
          可视化大盘使用。
        </div>
      </div>
      <ElSwitch
        :model-value="form.enablePrometheus"
        :disabled="readOnly"
        inline-prompt
        active-text="开"
        inactive-text="关"
        @update:model-value="emit('update:form', { ...form, enablePrometheus: $event as boolean })"
      />
    </div>

    <ElDivider />

    <div class="component-card">
      <div class="component-info">
        <div class="component-name">日志服务</div>
        <div class="component-desc">
          安装日志采集服务（Loki / Filebeat），统一管理容器日志，支持日志检索与告警配置。
        </div>
      </div>
      <ElSwitch
        :model-value="form.enableLogging"
        :disabled="readOnly"
        inline-prompt
        active-text="开"
        inactive-text="关"
        @update:model-value="emit('update:form', { ...form, enableLogging: $event as boolean })"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { DeployClusterForm } from './StepBasic.vue'

  defineOptions({ name: 'StepComponents' })

  const props = withDefaults(defineProps<{ form: DeployClusterForm; readOnly?: boolean }>(), {
    readOnly: false
  })
  const emit = defineEmits<{ 'update:form': [DeployClusterForm] }>()
  const readOnly = computed(() => props.readOnly)

  async function validate(): Promise<boolean> {
    return true
  }

  defineExpose({ validate })
</script>

<style scoped>
  .step-components {
    max-width: 680px;
    padding-top: 8px;
  }

  .component-card {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 0;
  }

  .component-info {
    flex: 1;
  }

  .component-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin-bottom: 6px;
  }

  .component-desc {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    line-height: 1.6;
  }
</style>

<template>
  <div class="step-confirm">
    <section class="confirm-panel">
      <div class="panel-header">
        <div class="panel-title-wrap">
          <h3 class="panel-title">集群信息</h3>
          <span class="panel-subtitle">核对基础参数和版本信息</span>
        </div>
        <ElButton v-if="!readOnly" link type="primary" @click="emit('go-step', 0)">编辑</ElButton>
      </div>
      <div class="kv-grid">
        <div class="kv-item">
          <div class="kv-label">集群名称</div>
          <div class="kv-value">{{ form.name || '-' }}</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">Kubernetes 版本</div>
          <div class="kv-value">
            <ElTag size="small" type="primary">{{ form.kubernetesVersion || '-' }}</ElTag>
          </div>
        </div>
        <div class="kv-item">
          <div class="kv-label">容器运行时</div>
          <div class="kv-value">{{ form.runtime || '-' }}</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">操作系统</div>
          <div class="kv-value">{{ form.osImage || '-' }}</div>
        </div>
        <div class="kv-item kv-item--full">
          <div class="kv-label">描述</div>
          <div class="kv-value">{{ form.description || '-' }}</div>
        </div>
      </div>
    </section>

    <section class="confirm-panel">
      <div class="panel-header">
        <div class="panel-title-wrap">
          <h3 class="panel-title">网络配置</h3>
          <span class="panel-subtitle">确认网卡与网络段配置</span>
        </div>
        <ElButton v-if="!readOnly" link type="primary" @click="emit('go-step', 0)">编辑</ElButton>
      </div>
      <div class="kv-grid">
        <div class="kv-item">
          <div class="kv-label">节点网口</div>
          <div class="kv-value">{{ form.networkInterface || '-' }}</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">容器网络插件</div>
          <div class="kv-value">{{ form.cni || '-' }}</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">容器网络</div>
          <div class="kv-value mono">{{ form.podNetwork || '-' }}</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">Service IP 段</div>
          <div class="kv-value mono">{{ form.serviceNetwork || '-' }}</div>
        </div>
      </div>
    </section>

    <section class="confirm-panel">
      <div class="panel-header">
        <div class="panel-title-wrap">
          <h3 class="panel-title">高级配置</h3>
          <span class="panel-subtitle">高可用与接入参数</span>
        </div>
        <ElButton v-if="!readOnly" link type="primary" @click="emit('go-step', 1)">编辑</ElButton>
      </div>
      <div class="kv-grid">
        <div class="kv-item">
          <div class="kv-label">高可用 Kubernetes</div>
          <div class="kv-value">
            <ElTag :type="form.highAvailability ? 'success' : 'info'" size="small">
              {{ form.highAvailability ? '启用' : '关闭' }}
            </ElTag>
          </div>
        </div>
        <div class="kv-item">
          <div class="kv-label">自建 LoadBalance</div>
          <div class="kv-value">
            <ElTag :type="form.selfLoadBalance ? 'success' : 'info'" size="small">
              {{ form.selfLoadBalance ? '启用' : '关闭' }}
            </ElTag>
          </div>
        </div>
        <div class="kv-item" v-if="form.selfLoadBalance">
          <div class="kv-label">Keepalived Virtual Router ID</div>
          <div class="kv-value">{{ form.keepalivedVirtualRouterId || '-' }}</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">ApiServer 地址</div>
          <div class="kv-value">{{ form.apiServerAddress || '-' }}</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">监听端口</div>
          <div class="kv-value">{{ form.apiServerPort || 6443 }}</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">Kube-proxy 模式</div>
          <div class="kv-value">{{ form.kubeProxyMode || '-' }}</div>
        </div>
        <div class="kv-item">
          <div class="kv-label">自建 NFS</div>
          <div class="kv-value">
            <ElTag :type="form.nfsEnabled ? 'success' : 'info'" size="small">
              {{ form.nfsEnabled ? '启用' : '关闭' }}
            </ElTag>
          </div>
        </div>
        <template v-if="form.nfsEnabled">
          <div class="kv-item">
            <div class="kv-label">NFS 存储名称</div>
            <div class="kv-value">{{ form.nfsStorageClassName || '-' }}</div>
          </div>
          <div class="kv-item">
            <div class="kv-label">NFS 存储地址</div>
            <div class="kv-value mono">{{ form.nfsStorageDataDir || '-' }}</div>
          </div>
        </template>
        <div class="kv-item">
          <div class="kv-label">Metrics Server</div>
          <div class="kv-value">
            <ElTag :type="form.metricsServer ? 'success' : 'info'" size="small">
              {{ form.metricsServer ? '启用' : '关闭' }}
            </ElTag>
          </div>
        </div>
        <div class="kv-item">
          <div class="kv-label">Nginx Ingress</div>
          <div class="kv-value">
            <ElTag :type="form.ingressNginx ? 'success' : 'info'" size="small">
              {{ form.ingressNginx ? '启用' : '关闭' }}
            </ElTag>
          </div>
        </div>
      </div>
    </section>
    <section class="confirm-panel">
      <div class="panel-header">
        <div class="panel-title-wrap">
          <h3 class="panel-title">节点信息</h3>
          <span class="panel-subtitle">确认节点列表与认证配置</span>
        </div>
        <ElButton v-if="!readOnly" link type="primary" @click="emit('go-step', 2)">编辑</ElButton>
      </div>
      <div v-if="form.nodes.length === 0" class="nodes-empty-tip">暂无节点</div>
      <ElTable v-else :data="form.nodes" stripe size="small" class="confirm-nodes-table">
        <ElTableColumn label="节点名称" prop="name" min-width="120" />
        <ElTableColumn label="角色" min-width="120">
          <template #default="{ row }">
            <ElTag
              v-for="r in row.role"
              :key="r"
              :type="r === 'master' ? 'primary' : r === 'storage' ? 'warning' : 'info'"
              size="small"
              style="margin-right: 4px"
              >{{ r }}</ElTag
            >
          </template>
        </ElTableColumn>
        <ElTableColumn label="IP 地址" prop="ip" min-width="140" />
        <ElTableColumn label="认证方式" min-width="90">
          <template #default="{ row }">
            {{ row.authType === 'password' ? '密码' : '密钥' }}
          </template>
        </ElTableColumn>
        <ElTableColumn label="用户名" min-width="80">
          <template #default>root</template>
        </ElTableColumn>
      </ElTable>
    </section>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import type { DeployClusterForm } from './StepBasic.vue'

  defineOptions({ name: 'StepConfirm' })

  const props = withDefaults(defineProps<{ form: DeployClusterForm; readOnly?: boolean }>(), {
    readOnly: false
  })
  const emit = defineEmits<{
    'update:form': [DeployClusterForm]
    'go-step': [number]
  }>()
  const readOnly = computed(() => props.readOnly)

  async function validate(): Promise<boolean> {
    const masterCount = props.form.nodes.filter((n) => n.role.includes('master')).length
    if (masterCount > 1 && !props.form.highAvailability) {
      ElMessage.error('master 节点已超过 1 台, 必须开启高可用')
      return false
    }
    return true
  }

  defineExpose({ validate })
</script>

<style scoped>
  .step-confirm {
    width: 100%;
    display: grid;
    gap: 14px;
  }

  .confirm-panel {
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    background: var(--el-bg-color);
    padding: 14px 16px;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    padding-bottom: 10px;
    border-bottom: 1px dashed var(--el-border-color-lighter);
  }

  .panel-title-wrap {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .panel-title {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .panel-subtitle {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .kv-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 18px;
  }

  .kv-item {
    min-width: 0;
  }

  .kv-item--full {
    grid-column: 1 / -1;
  }

  .kv-label {
    margin-bottom: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .kv-value {
    font-size: 13px;
    color: var(--el-text-color-primary);
    line-height: 1.45;
    word-break: break-all;
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }
  .nodes-empty-tip {
    font-size: 13px;
    color: var(--el-text-color-placeholder);
    padding: 12px 0;
  }

  .confirm-nodes-table {
    width: 100%;
  }
</style>

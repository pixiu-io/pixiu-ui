<template>
  <div class="plan-detail-layout art-full-height">
    <header class="plan-detail-header">
      <div class="plan-detail-header__left">
        <ElButton :icon="ArrowLeft" text @click="goBack">返回</ElButton>
        <ElDivider direction="vertical" />
        <span class="plan-detail-name-label">部署名称：</span>
        <span class="plan-detail-name">{{ detail.name || '-' }}</span>
        <ElTag :type="statusTag.type" effect="light" class="plan-detail-status">
          {{ statusTag.text }}
        </ElTag>
      </div>
      <div class="plan-detail-header__right">
        <ElButton v-ripple :disabled="!planId" @click="goEdit">编辑</ElButton>
      </div>
    </header>

    <div class="plan-detail-body">
      <aside class="plan-detail-sider">
        <ElMenu
          :default-active="activeMenuKey"
          :default-openeds="['group-info', 'group-nodes']"
          class="plan-detail-menu"
          @select="onMenuSelect"
        >
          <ElSubMenu index="group-info">
            <template #title>
              <span>集群信息</span>
            </template>
            <ElMenuItem index="basic">基础配置</ElMenuItem>
            <ElMenuItem index="network">网络配置</ElMenuItem>
            <ElMenuItem index="clusterConfig">集群配置</ElMenuItem>
          </ElSubMenu>

          <ElSubMenu index="group-nodes">
            <template #title>
              <span>节点管理</span>
            </template>
            <ElMenuItem index="nodes">已添加节点列表</ElMenuItem>
          </ElSubMenu>
        </ElMenu>
      </aside>

      <main class="plan-detail-main">
        <ElSkeleton :loading="loading" animated :rows="8">
          <template #default>
            <ElCard v-if="activeMenuKey === 'basic'" class="section-card">
              <template #header><span class="section-title">基础配置</span></template>
              <div class="kv-grid">
                <div class="kv-item">
                  <span class="kv-label">集群名称</span>
                  <span class="kv-value">{{ detail.name || '-' }}</span>
                </div>
                <div class="kv-item">
                  <span class="kv-label">Kubernetes 版本</span>
                  <span class="kv-value">{{ detail.config?.kubernetes?.kubernetes_version || '-' }}</span>
                </div>
                <div class="kv-item">
                  <span class="kv-label">容器运行时</span>
                  <span class="kv-value">{{ detail.config?.runtime?.runtime || '-' }}</span>
                </div>
                <div class="kv-item">
                  <span class="kv-label">操作系统镜像</span>
                  <span class="kv-value">{{ detail.config?.os_image || '-' }}</span>
                </div>
                <div class="kv-item kv-item--full">
                  <span class="kv-label">描述</span>
                  <span class="kv-value">{{ detail.description || '-' }}</span>
                </div>
              </div>
            </ElCard>

            <ElCard v-else-if="activeMenuKey === 'network'" class="section-card">
              <template #header><span class="section-title">网络配置</span></template>
              <div class="kv-grid">
                <div class="kv-item">
                  <span class="kv-label">节点网口</span>
                  <span class="kv-value">{{ detail.config?.network?.network_interface || '-' }}</span>
                </div>
                <div class="kv-item">
                  <span class="kv-label">CNI 插件</span>
                  <span class="kv-value">{{ detail.config?.network?.cni || '-' }}</span>
                </div>
                <div class="kv-item">
                  <span class="kv-label">容器网络</span>
                  <span class="kv-value">{{ detail.config?.network?.pod_network || '-' }}</span>
                </div>
                <div class="kv-item">
                  <span class="kv-label">Service 网络</span>
                  <span class="kv-value">{{ detail.config?.network?.service_network || '-' }}</span>
                </div>
                <div class="kv-item">
                  <span class="kv-label">ApiServer 地址</span>
                  <span class="kv-value">{{ (detail as any).config?.network?.api_server_address || '-' }}</span>
                </div>
                <div class="kv-item">
                  <span class="kv-label">ApiServer 端口</span>
                  <span class="kv-value">{{ (detail as any).config?.network?.api_server_port ?? '-' }}</span>
                </div>
              </div>
            </ElCard>

            <ElCard v-else-if="activeMenuKey === 'clusterConfig'" class="section-card">
              <template #header><span class="section-title">集群配置</span></template>
              <div class="kv-grid">
                <div class="kv-item">
                  <span class="kv-label">高可用 Kubernetes</span>
                  <span class="kv-value">{{ (detail as any).config?.kubernetes?.high_availability ? '启用' : '关闭' }}</span>
                </div>
                <div class="kv-item">
                  <span class="kv-label">自建 LoadBalance</span>
                  <span class="kv-value">{{ (detail as any).config?.network?.self_load_balance ? '启用' : '关闭' }}</span>
                </div>
                <div class="kv-item">
                  <span class="kv-label">Kube-proxy 模式</span>
                  <span class="kv-value">{{ (detail as any).config?.network?.kube_proxy_mode || 'iptables' }}</span>
                </div>
                <div class="kv-item">
                  <span class="kv-label">Prometheus</span>
                  <span class="kv-value">{{ detail.config?.component?.prometheus?.enabled ? '启用' : '关闭' }}</span>
                </div>
                <div class="kv-item">
                  <span class="kv-label">日志组件</span>
                  <span class="kv-value">{{ detail.config?.component?.logging?.enabled ? '启用' : '关闭' }}</span>
                </div>
              </div>
            </ElCard>

            <ElCard v-else class="section-card">
              <template #header><span class="section-title">已添加节点列表</span></template>
              <ElTable :data="detail.nodes || []" :border="false" stripe>
                <ElTableColumn label="节点名称" prop="name" min-width="180" />
                <ElTableColumn label="角色" min-width="160">
                  <template #default="{ row }">
                    <ElTag
                      v-for="role in row.role || []"
                      :key="role"
                      :type="role === 'master' ? 'warning' : 'success'"
                      size="small"
                      class="role-tag"
                    >
                      {{ role }}
                    </ElTag>
                  </template>
                </ElTableColumn>
                <ElTableColumn label="IP 地址" prop="ip" min-width="180" />
                <ElTableColumn label="容器运行时" prop="cri" min-width="120" />
                <ElTableColumn label="认证方式" min-width="110">
                  <template #default="{ row }">{{ row.auth?.type === 'key' ? '密钥' : '密码' }}</template>
                </ElTableColumn>
                <ElTableColumn label="用户名" min-width="100">
                  <template #default="{ row }">{{ row.auth?.password?.user || 'root' }}</template>
                </ElTableColumn>
              </ElTable>
              <div v-if="!detail.nodes?.length" class="empty-nodes">暂无已添加节点</div>
            </ElCard>
          </template>
        </ElSkeleton>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ArrowLeft } from '@element-plus/icons-vue'
  import { useRoute, useRouter } from 'vue-router'
  import { fetchPlanList, fetchPlanWithResources, type PlanItemFormatted, type PlanResourcesDetail } from '@/api/plan'

  defineOptions({ name: 'PlanDetail' })

  const route = useRoute()
  const router = useRouter()
  const loading = ref(false)
  const activeMenuKey = ref('basic')
  const detail = ref<PlanResourcesDetail>({
    id: 0,
    name: '',
    description: '',
    config: {},
    nodes: []
  })
  const planStatusMap = ref<Record<number, string>>({})

  const planId = computed(() => Number(route.query.planId ?? 0))

  const statusTag = computed(() => {
    const step = planStatusMap.value[planId.value] || '未开始'
    if (step === '运行中') return { type: 'primary' as const, text: step }
    if (step === '已成功') return { type: 'success' as const, text: step }
    if (step === '已失败') return { type: 'danger' as const, text: step }
    return { type: 'info' as const, text: step }
  })

  async function loadPlanStatus(planIdValue: number) {
    try {
      const { list } = await fetchPlanList({ page: 1, limit: 200 })
      const mapped = list.reduce<Record<number, string>>((acc, item: PlanItemFormatted) => {
        acc[item.id] = item.step
        return acc
      }, {})
      planStatusMap.value = mapped
      if (!planStatusMap.value[planIdValue]) {
        planStatusMap.value[planIdValue] = '未开始'
      }
    } catch {
      planStatusMap.value[planIdValue] = '未开始'
    }
  }

  async function loadDetail() {
    if (!planId.value) {
      ElMessage.warning('缺少部署计划 ID')
      router.push('/container/plan')
      return
    }
    loading.value = true
    try {
      const [planDetail] = await Promise.all([fetchPlanWithResources(planId.value), loadPlanStatus(planId.value)])
      detail.value = planDetail
    } catch (e: unknown) {
      const err = e as Error
      ElMessage.error(err.message || '加载部署详情失败')
      router.push('/container/plan')
    } finally {
      loading.value = false
    }
  }

  function onMenuSelect(index: string) {
    if (index.startsWith('group-')) return
    activeMenuKey.value = index
  }

  function goBack() {
    router.push('/container/plan')
  }

  function goEdit() {
    if (!planId.value) return
    router.push({
      path: '/container/cluster/deploy',
      query: { planId: String(planId.value), mode: 'edit' }
    })
  }

  onMounted(() => {
    void loadDetail()
  })
</script>

<style scoped>
  .plan-detail-layout {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    margin: -4px -4px 0;
  }

  .plan-detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 4px 0 14px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .plan-detail-header__left {
    display: flex;
    align-items: center;
    gap: 4px 8px;
    flex-wrap: wrap;
    min-width: 0;
  }

  .plan-detail-header__right {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .plan-detail-name-label {
    font-size: 14px;
    color: #c7c7d1;
    flex-shrink: 0;
  }

  .plan-detail-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--el-color-primary);
    max-width: 420px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .plan-detail-status {
    margin-left: 2px;
  }

  .plan-detail-body {
    display: flex;
    flex: 1;
    min-height: 0;
    padding-top: 12px;
  }

  .plan-detail-sider {
    width: 220px;
    flex-shrink: 0;
    padding-right: 4px;
    border-right: 1px solid var(--el-border-color-lighter);
  }

  .plan-detail-menu {
    border-right: none;
    --el-menu-bg-color: transparent;
  }

  .plan-detail-menu :deep(.el-sub-menu__title),
  .plan-detail-menu :deep(.el-menu-item) {
    height: 40px;
    line-height: 40px;
  }

  .plan-detail-main {
    flex: 1;
    min-width: 0;
    padding-left: 16px;
    overflow: auto;
  }

  .section-card {
    border-radius: 10px;
  }

  .section-title {
    font-size: 14px;
    font-weight: 600;
  }

  .kv-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(280px, 1fr));
    gap: 14px;
  }

  .kv-item {
    padding: 12px 14px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    background: var(--el-fill-color-light);
    min-height: 74px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
  }

  .kv-item--full {
    grid-column: 1 / -1;
  }

  .kv-label {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .kv-value {
    font-size: 14px;
    color: var(--el-text-color-primary);
    line-height: 1.5;
    word-break: break-word;
  }

  .role-tag {
    margin-right: 4px;
  }

  .empty-nodes {
    text-align: center;
    color: var(--el-text-color-placeholder);
    padding: 16px 0 4px;
    font-size: 13px;
  }
</style>

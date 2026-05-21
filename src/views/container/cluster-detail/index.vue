<template>
  <div class="cluster-detail-page art-full-height">
    <!-- 顶部操作栏 -->
    <div class="detail-header">
      <div class="header-left">
        <ElButton :icon="ArrowLeft" text @click="router.back()">返回</ElButton>
        <ElDivider direction="vertical" />
        <span class="cluster-name">{{ cluster.clusterName }}</span>
        <ElTag :type="statusConfig.type" class="ml-3">{{ statusConfig.text }}</ElTag>
      </div>
    </div>

    <!-- 基础信息卡片 -->
    <div class="info-cards">
      <div v-for="card in infoCards" :key="card.label" class="info-card">
        <span class="info-label">{{ card.label }}</span>
        <span class="info-value">{{ card.value }}</span>
      </div>
    </div>

    <!-- 节点列表 -->
    <ElCard class="art-table-card mt-4">
      <template #header>
        <span class="card-title">节点列表</span>
      </template>
      <ElTable :data="nodes" stripe>
        <ElTableColumn prop="name" label="节点名称" />
        <ElTableColumn prop="role" label="角色" width="100">
          <template #default="{ row }">
            <ElTag :type="row.role === 'Master' ? 'primary' : 'info'" size="small">
              {{ row.role }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="status" label="状态" width="100">
          <template #default="{ row }">
            <ElTag :type="row.status === 'Ready' ? 'success' : 'danger'" size="small">
              {{ row.status }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="ip" label="IP 地址" />
        <ElTableColumn prop="os" label="操作系统" />
        <ElTableColumn prop="cpu" label="CPU（核）" width="110" />
        <ElTableColumn prop="memory" label="内存（GB）" width="110" />
        <ElTableColumn prop="joinTime" label="加入时间" />
      </ElTable>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ArrowLeft } from '@element-plus/icons-vue'
  import { useRouter, useRoute } from 'vue-router'

  defineOptions({ name: 'ClusterDetail' })

  const router = useRouter()
  const route = useRoute()
  const id = Number(route.params.id)

  const STATUS_CONFIG = {
    running: { type: 'success' as const, text: '运行中' },
    error: { type: 'danger' as const, text: '异常' },
    stopped: { type: 'info' as const, text: '已停止' }
  }

  // 根据 id mock 集群数据
  const cluster = {
    id,
    clusterName: `pixiu-cls-${String(id).padStart(2, '0')}`,
    version: ['v1.28.0', 'v1.27.3', 'v1.26.5'][id % 3],
    status: (['running', 'running', 'error', 'stopped'][id % 4] as keyof typeof STATUS_CONFIG),
    nodeCount: (id % 5) + 1,
    region: ['华北-北京', '华东-上海', '华南-广州'][id % 3],
    createTime: '2026-04-18 13:26:04'
  }

  const statusConfig = STATUS_CONFIG[cluster.status]

  const infoCards = [
    { label: 'Kubernetes 版本', value: cluster.version },
    { label: '节点数', value: cluster.nodeCount },
    { label: '所在地域', value: cluster.region },
    { label: '创建时间', value: cluster.createTime }
  ]

  // mock 节点列表
  const nodes = Array.from({ length: cluster.nodeCount }, (_, i) => ({
    name: `node-${String(i + 1).padStart(2, '0')}.${cluster.clusterName}`,
    role: i === 0 ? 'Master' : 'Worker',
    status: i === 1 && cluster.status === 'error' ? 'NotReady' : 'Ready',
    ip: `192.168.${id}.${10 + i}`,
    os: 'Ubuntu 22.04',
    cpu: [4, 8, 16][i % 3],
    memory: [8, 16, 32][i % 3],
    joinTime: '2026-04-18 13:26:04'
  }))
</script>

<style scoped>
  .detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0 16px;
  }

  .header-left {
    display: flex;
    align-items: center;
  }

  .cluster-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .info-cards {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }

  .info-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 16px 20px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
  }

  .info-label {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .info-value {
    font-size: 15px;
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .card-title {
    font-size: 14px;
    font-weight: 600;
  }
</style>

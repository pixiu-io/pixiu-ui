<template>
  <div class="appstore-page">
    <div class="appstore-header">
      <h1 class="appstore-title">应用商店</h1>
      <p class="appstore-subtitle">一键部署和管理云原生组件，快速构建可观测、高可用的 Kubernetes 平台</p>
    </div>

    <div class="appstore-toolbar">
      <ElSelect v-model="filterCategory" placeholder="全部分类" clearable class="appstore-filter" @change="onSearch">
        <ElOption label="全部分类" value="" />
        <ElOption v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
      </ElSelect>
      <ElInput
        v-model="searchKeyword"
        placeholder="搜索组件名称或描述"
        clearable
        class="appstore-search"
        @input="onSearch"
      >
        <template #prefix>
          <ElIcon><Search /></ElIcon>
        </template>
      </ElInput>
    </div>

    <div class="appstore-grid">
      <ElCard
        v-for="app in filteredApps"
        :key="app.name"
        class="appstore-card"
        shadow="hover"
      >
        <div class="app-card__header">
          <div class="app-card__icon" :style="{ background: app.color }">
            <ArtSvgIcon :icon="app.icon" style="font-size: 28px; color: #fff" />
          </div>
          <div class="app-card__meta">
            <span class="app-card__name">{{ app.displayName }}</span>
            <span class="app-card__version">{{ app.version }}</span>
          </div>
        </div>
        <div class="app-card__body">
          <p class="app-card__desc">{{ app.description }}</p>
          <div class="app-card__tags">
            <ElTag size="small" type="info">{{ app.category }}</ElTag>
            <ElTag v-if="app.installed" size="small" type="success">已安装</ElTag>
          </div>
        </div>
        <div class="app-card__footer">
          <ElLink
            type="primary"
            :underline="false"
            :disabled="app.installed"
            style="font-size: 12px"
            @click="onInstall(app)"
          >
            {{ app.installed ? '已安装' : '安装' }}
          </ElLink>
          <ElLink type="primary" :underline="false" style="font-size: 12px" @click="onDetail(app)">详情</ElLink>
        </div>
      </ElCard>
    </div>

    <div v-if="filteredApps.length === 0" class="appstore-empty">
      <ArtSvgIcon icon="ri:store-2-line" style="font-size: 48px; color: var(--el-text-color-placeholder)" />
      <p>未找到匹配的应用</p>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import { Search } from '@element-plus/icons-vue'
  import { computed, ref } from 'vue'

  defineOptions({ name: 'Appstore' })

  interface AppItem {
    name: string
    displayName: string
    icon: string
    color: string
    description: string
    version: string
    category: string
    installed: boolean
  }

  const searchKeyword = ref('')
  const filterCategory = ref('')

  const categories = ['可观测性', '服务网格', 'CI/CD', '存储', '网络', '安全', '镜像仓库']

  const apps = ref<AppItem[]>([
    {
      name: 'prometheus',
      displayName: 'Prometheus',
      icon: 'simple-icons:prometheus',
      color: '#E6522C',
      description: '开源监控和告警工具包，用于记录时序数据并支持多维数据模型与灵活查询',
      version: 'v2.52.0',
      category: '可观测性',
      installed: false
    },
    {
      name: 'grafana',
      displayName: 'Grafana',
      icon: 'simple-icons:grafana',
      color: '#F46800',
      description: '领先的可视化及分析平台，支持 Prometheus、Loki 等多种数据源',
      version: 'v10.4.0',
      category: '可观测性',
      installed: false
    },
    {
      name: 'loki',
      displayName: 'Grafana Loki',
      icon: 'simple-icons:grafana',
      color: '#FFA500',
      description: '受 Prometheus 启发的水平可扩展、高可用日志聚合系统',
      version: 'v2.9.0',
      category: '可观测性',
      installed: false
    },
    {
      name: 'metrics-server',
      displayName: 'Metrics Server',
      icon: 'simple-icons:kubernetes',
      color: '#326CE5',
      description: 'K8s 集群资源指标数据采集组件，为 HPA 自动伸缩与 kubectl top 提供 CPU/内存数据',
      version: 'v0.7.0',
      category: '可观测性',
      installed: false
    },
    {
      name: 'nginx-ingress',
      displayName: 'Nginx Ingress',
      icon: 'simple-icons:nginx',
      color: '#009639',
      description: '基于 Nginx 的 K8s Ingress 控制器，提供七层负载均衡与流量管理',
      version: 'v1.10.0',
      category: '网络',
      installed: false
    },
    {
      name: 'istio',
      displayName: 'Istio',
      icon: 'simple-icons:istio',
      color: '#466BB0',
      description: '领先的服务网格平台，提供流量管理、安全、可观测性等微服务治理能力',
      version: 'v1.22.0',
      category: '服务网格',
      installed: false
    }
  ])

  const filteredApps = computed(() => {
    let list = apps.value
    const kw = searchKeyword.value.trim().toLowerCase()
    if (kw) {
      list = list.filter(
        (a) =>
          a.displayName.toLowerCase().includes(kw) ||
          a.name.toLowerCase().includes(kw) ||
          a.description.toLowerCase().includes(kw)
      )
    }
    if (filterCategory.value) {
      list = list.filter((a) => a.category === filterCategory.value)
    }
    return list
  })

  function onSearch() {}

  const comingSoonTip = '功能还在开发中，敬请期待'

  function onInstall(_app: AppItem) {
    ElMessage.info(comingSoonTip)
  }

  function onDetail(_app: AppItem) {
    ElMessage.info(comingSoonTip)
  }
</script>

<style scoped>
  .appstore-page {
    padding: 10px 25px;
    width: 100%;
    box-sizing: border-box;
  }

  .appstore-header {
    margin-bottom: 24px;
  }

  .appstore-title {
    margin: 0 0 8px;
    font-size: 22px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .appstore-subtitle {
    margin: 0;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .appstore-toolbar {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
  }

  .appstore-search {
    width: 360px;
    max-width: 100%;
  }

  .appstore-filter {
    width: 160px;
  }

  .appstore-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }

  .appstore-card {
    display: flex;
    flex-direction: column;
    border-radius: 10px;
    transition: transform 0.15s, box-shadow 0.15s;
  }

  .appstore-card:hover {
    transform: translateY(-2px);
  }

  .appstore-card :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    flex: 1;
    padding: 20px 20px 12px;
  }

  .app-card__header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 14px;
  }

  .app-card__icon {
    width: 52px;
    height: 52px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .app-card__meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .app-card__name {
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .app-card__version {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .app-card__body {
    flex: 1;
    margin-bottom: 14px;
  }

  .app-card__desc {
    margin: 0 0 10px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--el-text-color-secondary);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .app-card__tags {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .app-card__footer {
    display: flex;
    gap: 10px;
    padding-top: 6px;
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .appstore-empty {
    text-align: center;
    padding: 80px 20px;
    color: var(--el-text-color-placeholder);
    font-size: 14px;
  }
</style>

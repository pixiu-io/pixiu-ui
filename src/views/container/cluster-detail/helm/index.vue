<template>
  <div class="helm-dashboard">
    <header class="helm-dashboard__header">
      <div class="helm-dashboard__title">
        <div class="helm-dashboard__logo">
          <ArtSvgIcon icon="simple-icons:helm" />
        </div>
        <div>
          <h2>Helm 应用中心</h2>
          <p>
            管理已安装 Chart 与仓库
            <template v-if="selectedNamespace"> · 命名空间 {{ selectedNamespace }}</template>
          </p>
        </div>
      </div>
    </header>

    <div class="helm-stats">
      <div class="helm-stat-card">
        <span class="helm-stat-card__label">已安装应用</span>
        <strong class="helm-stat-card__value">{{ releaseStats.total }}</strong>
      </div>
      <div class="helm-stat-card is-success">
        <span class="helm-stat-card__label">运行中</span>
        <strong class="helm-stat-card__value">{{ releaseStats.deployed }}</strong>
      </div>
      <div class="helm-stat-card is-warning">
        <span class="helm-stat-card__label">待处理</span>
        <strong class="helm-stat-card__value">{{ releaseStats.pending }}</strong>
      </div>
      <div class="helm-stat-card is-danger">
        <span class="helm-stat-card__label">失败</span>
        <strong class="helm-stat-card__value">{{ releaseStats.failed }}</strong>
      </div>
      <div class="helm-stat-card is-info">
        <span class="helm-stat-card__label">Chart 仓库</span>
        <strong class="helm-stat-card__value">{{ filteredRepos.length }}</strong>
      </div>
    </div>

    <div class="helm-dashboard__sections">
      <ElCard class="helm-dashboard__tabs-card" shadow="never">
        <div class="helm-view-switch">
          <button
            type="button"
            class="helm-view-switch__btn"
            :class="{ 'is-active': activeView === 'releases' }"
            @click="activeView = 'releases'"
          >
            <ArtSvgIcon icon="ri:apps-2-line" />
            已安装应用
          </button>
          <button
            type="button"
            class="helm-view-switch__btn"
            :class="{ 'is-active': activeView === 'repos' }"
            @click="activeView = 'repos'"
          >
            <ArtSvgIcon icon="ri:archive-2-line" />
            Chart 仓库
          </button>
        </div>
      </ElCard>

      <ElCard class="helm-dashboard__content" shadow="never">
        <HelmReleasePanel
        v-if="activeView === 'releases'"
        v-model:search="releaseSearch"
        v-model:layout="releaseLayout"
        :loading="releaseLoading"
        :namespace="selectedNamespace"
        :releases="filteredReleases"
        @install="openInstallDialog"
        @open-detail="openReleaseDetail"
        @upgrade="openUpgradeDialog"
        @history="openHistoryDialog"
        @uninstall="confirmUninstall"
      />
      <HelmRepoPanel
        v-else
        v-model:search="repoSearch"
        v-model:selected-repo-id="selectedRepoId"
        :loading="repoLoading"
        :repos="filteredRepos"
        :selected-repo="selectedRepo"
        @create="openRepoDialog()"
        @edit="openRepoDialog"
        @delete="confirmDeleteRepo"
      />
      </ElCard>
    </div>

    <HelmReleaseFormDialog
      v-model:visible="releaseFormVisible"
      v-model:form="releaseForm"
      v-model:values-text="releaseFormValuesText"
      :mode="releaseFormMode"
      :submitting="releaseFormSubmitting"
      @close="resetReleaseForm"
      @submit="submitReleaseForm"
    />

    <HelmRepoFormDialog
      v-model:visible="repoFormVisible"
      v-model:form="repoForm"
      :submitting="repoFormSubmitting"
      @close="resetRepoForm"
      @submit="submitRepoForm"
    />

    <HelmReleaseDrawer
      v-model:visible="detailVisible"
      :release="detailRelease"
      :history-loading="historyLoading"
      :history-rows="historyRows"
      @upgrade="openUpgradeDialog"
      @uninstall="confirmUninstall"
      @rollback="confirmRollback"
    />

    <ElDialog v-model="historyVisible" title="修订历史" width="720px" destroy-on-close>
      <ElTable v-loading="historyLoading" :data="historyRows" size="small">
        <ElTableColumn label="版本" prop="version" width="80" />
        <ElTableColumn label="状态" width="120">
          <template #default="{ row }">
            <ElTag :type="releaseStatusMeta(row.info?.status).type" size="small" effect="light">
              {{ row.info?.status || '-' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="Chart" min-width="180">
          <template #default="{ row }">{{ formatChartLabel(row.chart) }}</template>
        </ElTableColumn>
        <ElTableColumn label="更新时间" min-width="160">
          <template #default="{ row }">{{ formatHelmTime(row.info?.last_deployed) }}</template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" style="font-size: 12px" @click="confirmRollback(row)">回滚</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import HelmReleaseDrawer from './helm-release-drawer.vue'
  import HelmReleaseFormDialog from './helm-release-form-dialog.vue'
  import HelmReleasePanel from './helm-release-panel.vue'
  import HelmRepoFormDialog from './helm-repo-form-dialog.vue'
  import HelmRepoPanel from './helm-repo-panel.vue'
  import { formatChartLabel, formatHelmTime, releaseStatusMeta, type HelmReleaseLayout } from './shared'
  import { useHelmPage } from './useHelmPage'

  defineOptions({ name: 'ClusterDetailHelm' })

  const releaseLayout = ref<HelmReleaseLayout>('grid')

  const {
    activeView,
    selectedNamespace,
    releaseLoading,
    releaseSearch,
    filteredReleases,
    releaseStats,
    repoLoading,
    repoSearch,
    filteredRepos,
    selectedRepo,
    selectedRepoId,
    releaseFormVisible,
    releaseFormMode,
    releaseFormSubmitting,
    releaseForm,
    releaseFormValuesText,
    historyVisible,
    historyLoading,
    historyRows,
    detailRelease,
    detailVisible,
    repoFormVisible,
    repoFormSubmitting,
    repoForm,
    openInstallDialog,
    openUpgradeDialog,
    resetReleaseForm,
    submitReleaseForm,
    confirmUninstall,
    openReleaseDetail,
    openHistoryDialog,
    confirmRollback,
    openRepoDialog,
    resetRepoForm,
    submitRepoForm,
    confirmDeleteRepo
  } = useHelmPage()
</script>

<style lang="scss" src="./helm-theme.scss"></style>

<style scoped>
  .helm-dashboard {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .helm-dashboard__sections {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .helm-dashboard__tabs-card,
  .helm-dashboard__content {
    flex: 0 0 auto;
    border: 1px solid var(--helm-border);
    border-radius: calc(var(--custom-radius) / 2 + 2px);
    background: var(--helm-surface);
  }

  .helm-dashboard__tabs-card :deep(.el-card__body),
  .helm-dashboard__content :deep(.el-card__body) {
    height: auto;
    overflow: visible;
  }

  .helm-dashboard__tabs-card :deep(.el-card__body) {
    padding: 12px 16px;
  }

  .helm-dashboard__content :deep(.el-card__body) {
    padding: 16px 16px 28px;
  }

  .helm-dashboard__header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .helm-dashboard__title {
    display: flex;
    gap: 14px;
    align-items: center;
  }

  .helm-dashboard__logo {
    display: flex;
    width: 48px;
    height: 48px;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    background: var(--helm-brand-bg);
    color: var(--helm-brand-fg);
    font-size: 24px;
  }

  .helm-dashboard__title h2 {
    margin: 0 0 4px;
    font-size: 20px;
    font-weight: 600;
  }

  .helm-dashboard__title p {
    margin: 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }

  .helm-stats {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 12px;
  }

  .helm-stat-card {
    padding: 14px 16px;
    border: 1px solid var(--helm-border);
    border-radius: 12px;
    background: var(--helm-surface);
  }

  .helm-stat-card__label {
    display: block;
    margin-bottom: 8px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .helm-stat-card__value {
    color: var(--el-text-color-primary);
    font-size: 18px;
    font-weight: 600;
    line-height: 1;
  }

  .helm-stat-card.is-success .helm-stat-card__value {
    color: var(--el-color-success);
  }

  .helm-stat-card.is-warning .helm-stat-card__value {
    color: var(--el-color-warning);
  }

  .helm-stat-card.is-danger .helm-stat-card__value {
    color: var(--el-color-danger);
  }

  .helm-stat-card.is-info .helm-stat-card__value {
    color: var(--el-color-primary);
  }

  .helm-view-switch {
    display: inline-flex;
    padding: 4px;
    border: 1px solid var(--helm-border);
    border-radius: 12px;
    background: var(--helm-switch-bg);
  }

  .helm-view-switch__btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--el-text-color-secondary);
    cursor: pointer;
    font-size: 13px;
    transition:
      background-color 0.15s ease,
      color 0.15s ease;
  }

  .helm-view-switch__btn.is-active {
    background: var(--helm-surface);
    box-shadow: var(--helm-switch-active-shadow);
    color: var(--el-color-primary);
    font-weight: 600;
  }

  @media (max-width: 1100px) {
    .helm-stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 640px) {
    .helm-stats {
      grid-template-columns: 1fr;
    }

    .helm-view-switch {
      width: 100%;
    }

    .helm-view-switch__btn {
      flex: 1;
      justify-content: center;
    }
  }

  .helm-dashboard :deep(.el-dialog .el-table) {
    font-size: 12px;
  }

  .helm-dashboard :deep(.el-dialog .el-button--link) {
    font-size: 12px;
  }
</style>

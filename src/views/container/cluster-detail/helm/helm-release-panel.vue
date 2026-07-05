<template>
  <section class="helm-release-panel">
    <div class="helm-panel-toolbar">
      <div class="helm-panel-toolbar__left">
        <ElButton type="primary" @click="emit('install')">
          部署应用
        </ElButton>
      </div>
      <div class="helm-panel-toolbar__right">
        <ElInput
          v-model="search"
          clearable
          placeholder="搜索 Release 名称"
          class="helm-panel-toolbar__search"
        >
          <template #prefix>
            <ArtSvgIcon icon="ri:search-line" />
          </template>
        </ElInput>
        <ElButtonGroup class="helm-layout-toggle">
          <ElButton
            :type="layout === 'grid' ? 'primary' : 'default'"
            plain
            @click="layout = 'grid'"
          >
            <ArtSvgIcon icon="ri:layout-grid-line" />
          </ElButton>
          <ElButton
            :type="layout === 'table' ? 'primary' : 'default'"
            plain
            @click="layout = 'table'"
          >
            <ArtSvgIcon icon="ri:list-check-2" />
          </ElButton>
        </ElButtonGroup>
      </div>
    </div>

    <ElAlert
      v-if="!namespace"
      type="warning"
      show-icon
      :closable="false"
      title="请先在顶部选择命名空间，再查看或部署 Helm 应用。"
      class="helm-panel-alert"
    />

    <div v-loading="loading" class="helm-release-panel__body">
      <template v-if="layout === 'grid'">
        <div v-if="releases.length" class="helm-release-grid">
          <article
            v-for="row in releases"
            :key="row.name"
            class="helm-release-card"
            @click="emit('open-detail', row)"
          >
            <div class="helm-release-card__head">
              <div class="helm-release-card__icon">
                <ArtSvgIcon icon="simple-icons:helm" />
              </div>
              <div class="helm-release-card__title-wrap">
                <h4 class="helm-release-card__title" :title="row.name">{{ row.name }}</h4>
                <span class="helm-release-card__rev">Rev {{ row.version ?? '-' }}</span>
              </div>
              <ElDropdown trigger="click" @click.stop>
                <ElButton text class="helm-release-card__menu">
                  <ArtSvgIcon icon="ri:more-2-fill" />
                </ElButton>
                <template #dropdown>
                  <ElDropdownMenu>
                    <ElDropdownItem @click="emit('open-detail', row)">查看详情</ElDropdownItem>
                    <ElDropdownItem @click="emit('upgrade', row)">升级</ElDropdownItem>
                    <ElDropdownItem @click="emit('history', row)">修订历史</ElDropdownItem>
                    <ElDropdownItem divided @click="emit('uninstall', row)">卸载</ElDropdownItem>
                  </ElDropdownMenu>
                </template>
              </ElDropdown>
            </div>

            <div class="helm-release-card__status">
              <span class="helm-status-dot" :class="releaseStatusMeta(row.info?.status).dot" />
              <span>{{ releaseStatusMeta(row.info?.status).label }}</span>
            </div>

            <div class="helm-release-card__facts">
              <div class="helm-release-card__fact">
                <span>Chart</span>
                <strong>{{ formatChartLabel(row.chart) }}</strong>
              </div>
              <div class="helm-release-card__fact">
                <span>App</span>
                <strong>{{ row.chart?.metadata?.appVersion ?? '-' }}</strong>
              </div>
            </div>

            <div class="helm-release-card__footer">
              <span>{{ formatHelmTime(row.info?.last_deployed) }}</span>
              <div class="helm-release-card__actions" @click.stop>
                <ElButton link type="primary" @click="emit('upgrade', row)">升级</ElButton>
                <ElButton link type="primary" @click="emit('uninstall', row)">卸载</ElButton>
              </div>
            </div>
          </article>
        </div>
        <ElEmpty v-else description="当前命名空间暂无 Helm 应用" :image-size="64" class="helm-release-empty" />
      </template>

      <template v-else>
        <ElTable
          v-if="releases.length"
          :data="releases"
          row-key="name"
          class="helm-release-table"
        >
          <ElTableColumn label="应用" min-width="180">
            <template #default="{ row }">
              <button type="button" class="helm-table-link" @click="emit('open-detail', row)">
                {{ row.name }}
              </button>
            </template>
          </ElTableColumn>
          <ElTableColumn label="状态" width="120">
            <template #default="{ row }">
              <ElTag :type="releaseStatusMeta(row.info?.status).type" size="small" effect="light">
                {{ releaseStatusMeta(row.info?.status).label }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="Chart" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ formatChartLabel(row.chart) }}</template>
          </ElTableColumn>
          <ElTableColumn label="修订" width="72" prop="version" />
          <ElTableColumn label="更新时间" width="170">
            <template #default="{ row }">{{ formatHelmTime(row.info?.last_deployed) }}</template>
          </ElTableColumn>
          <ElTableColumn label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <ElButton link type="primary" @click="emit('upgrade', row)">升级</ElButton>
              <ElButton link type="primary" @click="emit('history', row)">历史</ElButton>
              <ElButton link type="primary" @click="emit('uninstall', row)">卸载</ElButton>
            </template>
          </ElTableColumn>
        </ElTable>
        <ElEmpty v-else description="当前命名空间暂无 Helm 应用" :image-size="64" class="helm-release-empty" />
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import type { HelmReleaseItem } from '@/api/helm'
  import { formatChartLabel, formatHelmTime, releaseStatusMeta, type HelmReleaseLayout } from './shared'

  defineProps<{
    loading: boolean
    namespace: string
    releases: HelmReleaseItem[]
  }>()

  const search = defineModel<string>('search', { required: true })
  const layout = defineModel<HelmReleaseLayout>('layout', { required: true })

  const emit = defineEmits<{
    install: []
    'open-detail': [row: HelmReleaseItem]
    upgrade: [row: HelmReleaseItem]
    history: [row: HelmReleaseItem]
    uninstall: [row: HelmReleaseItem]
  }>()
</script>

<style scoped>
  .helm-release-panel__body {
    min-height: 0;
  }

  .helm-release-empty {
    --el-empty-padding: 12px 0 8px;
    --el-empty-description-margin-top: 8px;
    --el-empty-bottom-margin-top: 12px;
  }

  .helm-release-empty :deep(.el-empty__description p) {
    font-size: 12px;
    line-height: 1.5;
  }

  .helm-panel-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  .helm-panel-toolbar__left,
  .helm-panel-toolbar__right {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }

  .helm-panel-toolbar__search {
    width: 260px;
    max-width: 100%;
  }

  .helm-panel-alert {
    margin-bottom: 16px;
  }

  .helm-release-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 14px;
  }

  .helm-release-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border: 1px solid var(--helm-border);
    border-radius: 14px;
    background: var(--helm-surface);
    cursor: pointer;
    transition:
      border-color 0.18s ease,
      box-shadow 0.18s ease,
      transform 0.18s ease;
  }

  .helm-release-card:hover {
    border-color: var(--helm-card-hover-border);
    box-shadow: var(--helm-card-hover-shadow);
    transform: translateY(-1px);
  }

  .helm-release-card__head {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .helm-release-card__icon {
    display: flex;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background: var(--helm-brand-bg);
    color: var(--helm-brand-fg);
    font-size: 20px;
  }

  .helm-release-card__title-wrap {
    min-width: 0;
    flex: 1;
  }

  .helm-release-card__title {
    margin: 0;
    overflow: hidden;
    color: var(--el-text-color-primary);
    font-size: 15px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .helm-release-card__rev {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .helm-release-card__menu {
    padding: 4px;
  }

  .helm-release-card__status {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--el-text-color-regular);
    font-size: 12px;
  }

  .helm-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--el-border-color);
  }

  .helm-status-dot.is-success {
    background: var(--el-color-success);
  }

  .helm-status-dot.is-danger {
    background: var(--el-color-danger);
  }

  .helm-status-dot.is-warning {
    background: var(--el-color-warning);
  }

  .helm-status-dot.is-muted {
    background: var(--el-text-color-placeholder);
  }

  .helm-release-card__facts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .helm-release-card__fact {
    padding: 10px;
    border-radius: 10px;
    background: var(--helm-surface-muted);
  }

  .helm-release-card__fact span {
    display: block;
    margin-bottom: 4px;
    color: var(--el-text-color-secondary);
    font-size: 11px;
  }

  .helm-release-card__fact strong {
    display: block;
    overflow: hidden;
    color: var(--el-text-color-primary);
    font-size: 12px;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .helm-release-card__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-top: 4px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .helm-release-card__actions {
    display: flex;
    gap: 4px;
  }

  .helm-table-link {
    padding: 0;
    border: 0;
    background: none;
    color: var(--el-color-primary);
    cursor: pointer;
    font-size: 13px;
  }

  .helm-release-table :deep(.el-table__cell) {
    font-size: 12px;
  }
</style>

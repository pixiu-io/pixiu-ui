<template>
  <section class="helm-repo-panel">
    <div class="helm-repo-layout">
      <aside class="helm-repo-sidebar">
        <div class="helm-repo-sidebar__head">
          <span>Chart 仓库</span>
          <ElButton type="primary" link class="helm-repo-sidebar__add" @click="emit('create')">
            <ArtSvgIcon icon="ri:add-line" />
            添加
          </ElButton>
        </div>
        <ElInput
          v-model="search"
          clearable
          placeholder="搜索仓库"
          class="helm-repo-sidebar__search"
        >
          <template #prefix>
            <ArtSvgIcon icon="ri:search-line" />
          </template>
        </ElInput>
        <ElSkeleton :loading="loading" animated :rows="5">
          <div v-if="repos.length" class="helm-repo-list">
            <button
              v-for="repo in repos"
              :key="repo.id"
              type="button"
              class="helm-repo-list__item"
              :class="{ 'is-active': repo.id === selectedRepoId }"
              @click="selectedRepoId = repo.id"
            >
              <ArtSvgIcon icon="ri:archive-2-line" class="helm-repo-list__icon" />
              <div class="helm-repo-list__meta">
                <strong>{{ repo.name }}</strong>
                <span>{{ repo.url }}</span>
              </div>
            </button>
          </div>
          <ElEmpty v-else description="暂无 Chart 仓库" :image-size="56" class="helm-repo-empty">
            <ElButton type="primary" @click="emit('create')">添加第一个仓库</ElButton>
          </ElEmpty>
        </ElSkeleton>
      </aside>

      <main
        v-loading="loading"
        class="helm-repo-main"
        :class="{ 'helm-repo-main--empty': !selectedRepo }"
      >
        <template v-if="selectedRepo">
          <div class="helm-repo-main__hero">
            <div class="helm-repo-main__icon">
              <ArtSvgIcon icon="ri:archive-2-line" />
            </div>
            <div>
              <h3>{{ selectedRepo.name }}</h3>
              <p>{{ selectedRepo.url }}</p>
            </div>
            <div class="helm-repo-main__actions">
              <ElButton type="primary" link class="helm-repo-main__action" @click="emit('edit', selectedRepo)">
                编辑
              </ElButton>
              <ElButton type="danger" link class="helm-repo-main__action" @click="emit('delete', selectedRepo)">
                删除
              </ElButton>
            </div>
          </div>

          <div class="helm-repo-main__grid">
            <div class="helm-kv">
              <span class="helm-kv__label">用户名</span>
              <span class="helm-kv__value">{{ selectedRepo.username || '-' }}</span>
            </div>
            <div class="helm-kv">
              <span class="helm-kv__label">创建时间</span>
              <span class="helm-kv__value">{{ formatHelmTime(selectedRepo.gmt_create) }}</span>
            </div>
            <div class="helm-kv">
              <span class="helm-kv__label">更新时间</span>
              <span class="helm-kv__value">{{ formatHelmTime(selectedRepo.gmt_modified) }}</span>
            </div>
            <div class="helm-kv">
              <span class="helm-kv__label">资源版本</span>
              <span class="helm-kv__value">{{ selectedRepo.resource_version }}</span>
            </div>
          </div>

          <ElAlert
            type="info"
            show-icon
            :closable="false"
            class="helm-repo-main__alert"
            title="仓库浏览与 Chart 安装向导"
            description="当前版本支持仓库管理与 Release 部署。后续可在此区域扩展 Chart 浏览与可视化 Values 表单"
          />
        </template>
        <ElEmpty v-else description="请选择左侧仓库查看详情" :image-size="60" class="helm-repo-empty helm-repo-empty--main" />
      </main>
    </div>
  </section>
</template>

<script setup lang="ts">
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import type { HelmRepository } from '@/api/helm'
  import { formatHelmTime } from './shared'

  defineProps<{
    loading: boolean
    search: string
    repos: HelmRepository[]
    selectedRepo: HelmRepository | null
  }>()

  const search = defineModel<string>('search', { required: true })
  const selectedRepoId = defineModel<number | null>('selectedRepoId', { required: true })

  const emit = defineEmits<{
    create: []
    edit: [row: HelmRepository]
    delete: [row: HelmRepository]
  }>()
</script>

<style scoped>
  .helm-repo-layout {
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr);
    gap: 16px;
    min-height: 0;
    align-items: stretch;
  }

  .helm-repo-sidebar,
  .helm-repo-main {
    border: 1px solid var(--helm-border);
    border-radius: 14px;
    background: var(--helm-surface);
  }

  .helm-repo-sidebar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 12px 12px;
  }

  .helm-repo-sidebar__search {
    margin-top: -2px;
  }

  .helm-repo-sidebar__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 14px;
    font-weight: 600;
  }

  .helm-repo-sidebar__add {
    height: auto;
    padding: 0;
    font-size: 12px;
  }

  .helm-repo-sidebar__add :deep(.el-icon),
  .helm-repo-sidebar__add :deep(svg) {
    font-size: 12px;
  }

  .helm-repo-empty {
    --el-empty-padding: 8px 0 4px;
    --el-empty-description-margin-top: 6px;
    --el-empty-bottom-margin-top: 8px;
  }

  .helm-repo-empty :deep(.el-empty__description p) {
    font-size: 12px;
    line-height: 1.5;
  }

  .helm-repo-empty--main {
    --el-empty-padding: 12px 0 8px;
  }

  .helm-repo-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 520px;
    overflow: auto;
  }

  .helm-repo-list__item {
    display: flex;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    border: 1px solid transparent;
    border-radius: 10px;
    background: var(--helm-surface-muted);
    cursor: pointer;
    text-align: left;
    transition:
      border-color 0.15s ease,
      background-color 0.15s ease;
  }

  .helm-repo-list__item:hover,
  .helm-repo-list__item.is-active {
    border-color: var(--helm-list-active-border);
    background: var(--helm-list-active-bg);
  }

  .helm-repo-list__icon {
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--el-color-primary);
    font-size: 18px;
  }

  .helm-repo-list__meta {
    min-width: 0;
  }

  .helm-repo-list__meta strong {
    display: block;
    overflow: hidden;
    color: var(--el-text-color-primary);
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .helm-repo-list__meta span {
    display: block;
    overflow: hidden;
    color: var(--el-text-color-secondary);
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .helm-repo-main {
    padding: 18px;
    min-height: 100%;
  }

  .helm-repo-main--empty {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .helm-repo-main--empty .helm-repo-empty--main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    --el-empty-padding: 0;
  }

  .helm-repo-main__hero {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    margin-bottom: 18px;
  }

  .helm-repo-main__icon {
    display: flex;
    width: 48px;
    height: 48px;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background: var(--helm-brand-soft-bg);
    color: var(--el-color-primary);
    font-size: 22px;
  }

  .helm-repo-main__hero h3 {
    margin: 0 0 6px;
    font-size: 18px;
  }

  .helm-repo-main__hero p {
    margin: 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    word-break: break-all;
  }

  .helm-repo-main__actions {
    display: flex;
    gap: 2px;
    margin-left: auto;
  }

  .helm-repo-main__action {
    height: auto;
    padding: 0;
    font-size: 12px;
  }

  .helm-repo-main__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }

  .helm-kv {
    padding: 12px;
    border: 1px solid var(--helm-border);
    border-radius: 10px;
  }

  .helm-kv__label {
    display: block;
    margin-bottom: 4px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .helm-kv__value {
    color: var(--el-text-color-primary);
    font-size: 13px;
    word-break: break-all;
  }

  .helm-repo-main__alert :deep(.el-alert__title) {
    font-size: 12px;
    line-height: 1.5;
  }

  .helm-repo-main__alert :deep(.el-alert__description) {
    font-size: 12px;
    line-height: 1.6;
  }

  @media (max-width: 960px) {
    .helm-repo-layout {
      grid-template-columns: 1fr;
    }
  }
</style>

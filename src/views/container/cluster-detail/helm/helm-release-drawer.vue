<template>
  <ElDrawer
    v-model="visible"
    size="50%"
    destroy-on-close
    class="helm-release-drawer"
    :title="release?.name ?? 'Release 详情'"
  >
    <template v-if="release">
      <div class="helm-release-drawer__hero">
        <div class="helm-release-drawer__tags">
          <ElTag :type="statusMeta.type" size="small" effect="light">{{ statusMeta.label }}</ElTag>
          <ElTag type="info" size="small" effect="plain">Rev {{ release.version ?? '-' }}</ElTag>
        </div>
      </div>

      <div class="helm-release-drawer__grid">
        <div class="helm-kv">
          <span class="helm-kv__label">Chart</span>
          <span class="helm-kv__value">{{ chartLabel }}</span>
        </div>
        <div class="helm-kv">
          <span class="helm-kv__label">App 版本</span>
          <span class="helm-kv__value">{{ release.chart?.metadata?.appVersion ?? '-' }}</span>
        </div>
        <div class="helm-kv">
          <span class="helm-kv__label">首次部署</span>
          <span class="helm-kv__value">{{ formatHelmTime(release.info?.first_deployed) }}</span>
        </div>
        <div class="helm-kv">
          <span class="helm-kv__label">最近更新</span>
          <span class="helm-kv__value">{{ formatHelmTime(release.info?.last_deployed) }}</span>
        </div>
      </div>

      <div class="helm-release-drawer__actions">
        <ElButton link type="primary" style="font-size: 12px" @click="emit('upgrade', release)">升级</ElButton>
        <ElButton link type="primary" style="font-size: 12px" @click="emit('uninstall', release)">卸载</ElButton>
      </div>

      <div class="helm-release-drawer__section">
        <div class="helm-release-drawer__section-title">修订历史</div>
        <ElSkeleton :loading="historyLoading" animated :rows="4">
          <div v-if="historyRows.length" class="helm-timeline">
            <div
              v-for="row in historyRows"
              :key="`${row.name}-${row.version}`"
              class="helm-timeline__item"
              :class="{ 'is-current': row.version === release.version }"
            >
              <div class="helm-timeline__dot" />
              <div class="helm-timeline__body">
                <div class="helm-timeline__head">
                  <span class="helm-timeline__rev">Rev {{ row.version ?? '-' }}</span>
                  <ElTag
                    :type="releaseStatusMeta(row.info?.status).type"
                    size="small"
                    effect="light"
                  >
                    {{ row.info?.status || '-' }}
                  </ElTag>
                </div>
                <div class="helm-timeline__chart">{{ formatChartLabel(row.chart) }}</div>
                <div class="helm-timeline__time">{{ formatHelmTime(row.info?.last_deployed) }}</div>
                <ElButton
                  v-if="row.version !== release.version"
                  link
                  type="primary"
                  class="helm-timeline__rollback"
                  @click="emit('rollback', row)"
                >
                  回滚到此版本
                </ElButton>
              </div>
            </div>
          </div>
          <ElEmpty v-else description="暂无修订历史" :image-size="72" />
        </ElSkeleton>
      </div>
    </template>
  </ElDrawer>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import type { HelmReleaseItem } from '@/api/helm'
  import { formatChartLabel, formatHelmTime, releaseStatusMeta } from './shared'

  const props = defineProps<{
    release: HelmReleaseItem | null
    historyLoading: boolean
    historyRows: HelmReleaseItem[]
  }>()

  const visible = defineModel<boolean>('visible', { required: true })

  const emit = defineEmits<{
    upgrade: [row: HelmReleaseItem]
    uninstall: [row: HelmReleaseItem]
    rollback: [row: HelmReleaseItem]
  }>()

  const statusMeta = computed(() => releaseStatusMeta(props.release?.info?.status))
  const chartLabel = computed(() => formatChartLabel(props.release?.chart))
</script>

<style lang="scss">
  .helm-release-drawer.el-drawer {
    .el-drawer__header {
      margin-bottom: 0 !important;
      padding: 12px 20px 0 !important;
    }

    .el-drawer__title {
      margin: 0;
      line-height: 1.4;
    }

    .el-drawer__body {
      padding: 23px 20px 20px !important;
    }
  }
</style>

<style scoped>
  .helm-release-drawer__hero {
    margin: 0 0 18px;
  }

  .helm-release-drawer__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .helm-release-drawer__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 18px;
  }

  .helm-kv {
    padding: 12px;
    border: 1px solid var(--helm-border);
    border-radius: 10px;
    background: var(--helm-surface-blank);
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

  .helm-release-drawer__actions {
    display: flex;
    gap: 0;
    margin-bottom: 22px;
  }

  .helm-release-drawer__section-title {
    margin-bottom: 14px;
    font-size: 14px;
    font-weight: 600;
  }

  .helm-timeline {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .helm-timeline__item {
    display: flex;
    gap: 12px;
    padding-bottom: 18px;
  }

  .helm-timeline__item.is-current .helm-timeline__dot {
    background: var(--el-color-primary);
    box-shadow: 0 0 0 4px var(--helm-timeline-glow);
  }

  .helm-timeline__dot {
    flex-shrink: 0;
    width: 10px;
    height: 10px;
    margin-top: 6px;
    border-radius: 50%;
    background: var(--el-border-color);
  }

  .helm-timeline__body {
    flex: 1;
    min-width: 0;
    padding-bottom: 2px;
    border-bottom: 1px dashed var(--helm-border);
  }

  .helm-timeline__head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .helm-timeline__rev {
    font-size: 13px;
    font-weight: 600;
  }

  .helm-timeline__chart,
  .helm-timeline__time {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    line-height: 1.6;
  }

  .helm-timeline__rollback {
    margin-top: 4px;
    padding-left: 0;
    font-size: 12px;
  }
</style>

<template>
  <div class="prometheus-dashboard__onboarding">
    <div class="prometheus-onboarding__inner">
      <section class="prometheus-onboarding__hero">
        <div class="prometheus-onboarding__hero-content">
          <h1 class="prometheus-onboarding__hero-title">Prometheus，打造容器监控最佳方案</h1>
          <!-- prettier-ignore -->
          <p class="prometheus-onboarding__hero-desc">Prometheus 数据模型与集群内采集服务，为云原生用户提供开箱即用的容器监控运维能力，提供免搭建的高效运维能力，减少开发运维成本，提供100多个免费的基本指标供使用。</p>
          <ul class="prometheus-onboarding__hero-points">
            <li
              ><ElIcon><Check /></ElIcon>数据模型兼容开源 Prometheus，
              预设监控大盘，提供一百多个免费的容器基础指标。</li
            >
            <li
              ><ElIcon><Check /></ElIcon>秒级采集 毫秒级查询</li
            >
            <li
              ><ElIcon><Check /></ElIcon
              >开箱即用，一键采集监控数据，并提供丰富的组件监控能力，支持快速安装</li
            >
          </ul>
          <div class="prometheus-onboarding__hero-actions">
            <ElButton type="primary" @click="emit('associate')">
              {{ actionText }}
            </ElButton>
          </div>
        </div>
      </section>

      <section class="prometheus-onboarding__body">
        <div class="prometheus-onboarding__features">
          <div class="prometheus-onboarding__feature-card">
            <ElIcon><Monitor /></ElIcon>
            <div>
              <h3>容器预设监控大盘</h3>
              <p>针对主流业务场景，提供多套开箱即用的容器监控大盘</p>
            </div>
          </div>
          <div class="prometheus-onboarding__feature-card">
            <ElIcon><Connection /></ElIcon>
            <div>
              <h3>Prometheus 集成中心</h3>
              <p>支持按场景灵活集成多种上报链路，实现业务全链路一体化监控</p>
            </div>
          </div>
          <div class="prometheus-onboarding__feature-card">
            <ElIcon><Bell /></ElIcon>
            <div>
              <h3>Prometheus 灵活告警</h3>
              <p>基于告警通道，灵活配置告警策略，及时感知业务异常</p>
            </div>
          </div>
        </div>

        <div class="prometheus-onboarding__mockup">
          <div class="prometheus-onboarding__mockup-header">
            <span>容器服务 · 监控视图</span>
            <span class="prometheus-onboarding__mockup-controls"><i /><i /><i /></span>
          </div>
          <div class="prometheus-onboarding__mockup-stats">
            <div class="prometheus-onboarding__mockup-stat">
              <span class="prometheus-onboarding__mockup-stat-label">CPU 使用率</span>
              <span class="prometheus-onboarding__mockup-stat-value"
                >42<span class="prometheus-onboarding__mockup-stat-unit">%</span></span
              >
            </div>
            <div class="prometheus-onboarding__mockup-stat">
              <span class="prometheus-onboarding__mockup-stat-label">内存使用</span>
              <span class="prometheus-onboarding__mockup-stat-value"
                >3.8<span class="prometheus-onboarding__mockup-stat-unit">Gi</span></span
              >
            </div>
            <div class="prometheus-onboarding__mockup-stat">
              <span class="prometheus-onboarding__mockup-stat-label">网络吞吐</span>
              <span class="prometheus-onboarding__mockup-stat-value"
                >1.2<span class="prometheus-onboarding__mockup-stat-unit">Mbps</span></span
              >
            </div>
          </div>
          <div class="prometheus-onboarding__mockup-chart">
            <div class="prometheus-onboarding__mockup-bars">
              <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
            </div>
            <svg class="prometheus-onboarding__mockup-line" viewBox="0 0 300 60">
              <polygon
                points="0,50 25,42 50,46 75,30 100,36 125,22 150,28 175,16 200,24 225,12 250,20 275,14 300,8 300,60 0,60"
              />
              <polyline
                points="0,50 25,42 50,46 75,30 100,36 125,22 150,28 175,16 200,24 225,12 250,20 275,14 300,8"
              />
            </svg>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Bell, Check, Connection, Monitor } from '@element-plus/icons-vue'

  withDefaults(
    defineProps<{
      actionText?: string
    }>(),
    {
      actionText: '关联已有 Prometheus 实例'
    }
  )

  const emit = defineEmits<{ associate: [] }>()
</script>

<style scoped lang="scss">
  .prometheus-dashboard__onboarding {
    flex: 1;
    min-height: 0;
    padding: 20px;
    overflow: auto;
  }

  .prometheus-onboarding__inner {
    width: 100%;
  }

  .prometheus-onboarding__hero {
    position: relative;
    display: flex;
    gap: 36px;
    align-items: center;
    justify-content: space-between;
    padding: 32px 48px 40px;
    overflow: hidden;
    background:
      radial-gradient(720px 320px at 88% 20%, var(--el-color-primary-light-8), transparent 65%),
      linear-gradient(
        120deg,
        var(--el-color-primary-light-9),
        var(--el-color-primary-light-8) 60%,
        var(--el-color-primary-light-9)
      );
    border: 1px solid var(--el-color-primary-light-7);
    border-radius: 10px;
  }

  .prometheus-onboarding__hero-content {
    position: relative;
    z-index: 1;
    max-width: 640px;
  }

  .prometheus-onboarding__hero-title {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    line-height: 1.35;
    color: var(--el-text-color-primary);
  }

  .prometheus-onboarding__hero-desc {
    margin: 12px 0 0;
    font-size: 12px;
    line-height: 1.7;
    color: var(--el-text-color-regular);
  }

  .prometheus-onboarding__hero-points {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0;
    margin: 20px 0 0;
    list-style: none;
  }

  .prometheus-onboarding__hero-points li {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .prometheus-onboarding__hero-points .el-icon {
    flex: 0 0 auto;
    font-size: 15px;
    color: #2e9b62;
  }

  .prometheus-onboarding__hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 20px;
    margin-bottom: -10px;
  }

  .prometheus-onboarding__hero-actions .el-button {
    font-size: 12px;
  }

  .prometheus-onboarding__body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
    gap: 24px;
    margin-top: 18px;
  }

  .prometheus-onboarding__features {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .prometheus-onboarding__feature-card {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    padding: 20px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .prometheus-onboarding__feature-card:hover {
    border-color: var(--el-color-primary-light-5);
    box-shadow: 0 6px 18px rgb(31 45 61 / 8%);
  }

  .prometheus-onboarding__feature-card .el-icon {
    display: inline-flex;
    flex: 0 0 42px;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    font-size: 20px;
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
    border-radius: 8px;
  }

  .prometheus-onboarding__feature-card h3 {
    margin: 2px 0 0;
    font-size: 14px;
    font-weight: 650;
    color: var(--el-text-color-primary);
  }

  .prometheus-onboarding__feature-card p {
    margin: 6px 0 0;
    font-size: 12px;
    line-height: 1.6;
    color: var(--el-text-color-secondary);
  }

  .prometheus-onboarding__mockup {
    display: flex;
    flex-direction: column;
    padding: 20px 22px 22px;
    background: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .prometheus-onboarding__mockup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 14px;
    margin-bottom: 16px;
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    border-bottom: 1px dashed var(--el-border-color-lighter);
  }

  .prometheus-onboarding__mockup-controls {
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }

  .prometheus-onboarding__mockup-controls i {
    width: 6px;
    height: 6px;
    background: var(--el-color-primary-light-5);
    border-radius: 50%;
  }

  .prometheus-onboarding__mockup-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }

  .prometheus-onboarding__mockup-stat {
    padding: 12px 14px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
  }

  .prometheus-onboarding__mockup-stat-label {
    display: block;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .prometheus-onboarding__mockup-stat-value {
    display: block;
    margin-top: 6px;
    font-size: 12px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--el-color-primary);
  }

  .prometheus-onboarding__mockup-stat-unit {
    margin-left: 2px;
    font-size: 12px;
    font-weight: 500;
    color: var(--el-text-color-secondary);
  }

  .prometheus-onboarding__mockup-stat:nth-child(2) .prometheus-onboarding__mockup-stat-value {
    color: #2e9b62;
  }

  .prometheus-onboarding__mockup-stat:nth-child(3) .prometheus-onboarding__mockup-stat-value {
    color: #d99a2b;
  }

  .prometheus-onboarding__mockup-chart {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: flex-end;
    min-height: 150px;
    padding: 16px 16px 8px;
    background:
      repeating-linear-gradient(
        180deg,
        transparent 0 23px,
        var(--el-border-color-extra-light) 23px 24px
      ),
      var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
  }

  .prometheus-onboarding__mockup-bars {
    display: flex;
    gap: 6px;
    align-items: flex-end;
    height: 64px;
  }

  .prometheus-onboarding__mockup-bars i {
    flex: 1 1 0;
    background: linear-gradient(
      180deg,
      var(--el-color-primary-light-4),
      var(--el-color-primary-light-7)
    );
    border-radius: 2px 2px 0 0;
  }

  .prometheus-onboarding__mockup-bars i:nth-child(3n + 1) {
    height: 46%;
  }

  .prometheus-onboarding__mockup-bars i:nth-child(3n + 2) {
    height: 68%;
  }

  .prometheus-onboarding__mockup-bars i:nth-child(3n) {
    height: 32%;
  }

  .prometheus-onboarding__mockup-line {
    display: block;
    width: 100%;
    height: 52px;
    margin-top: 14px;
  }

  .prometheus-onboarding__mockup-line polyline {
    fill: none;
    stroke: var(--el-color-primary);
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2;
  }

  .prometheus-onboarding__mockup-line polygon {
    opacity: 0.45;
    fill: var(--el-color-primary-light-8);
  }

  @media (width <= 768px) {
    .prometheus-dashboard__onboarding {
      padding: 20px 16px 32px;
    }

    .prometheus-onboarding__hero {
      flex-direction: column;
      gap: 24px;
      align-items: flex-start;
      padding: 28px 24px;
    }

    .prometheus-onboarding__body {
      grid-template-columns: 1fr;
    }
  }
</style>

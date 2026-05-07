<!-- 主机管理：布局与交互参考 ui-template 运维管理 / 服务器管理 -->
<template>
  <div class="host-page art-full-height">
    <div class="host-grid">
      <ElCard
        v-for="item in hostList"
        :key="item.name"
        class="host-card"
        shadow="hover"
        :body-style="{ padding: '0' }"
      >
        <template #header>
          <div class="host-card__head">
            <span class="host-card__name">{{ item.name }}</span>
            <span class="host-card__ip">{{ item.ip }}</span>
          </div>
        </template>
        <div class="host-card__body">
          <div class="host-card__aside">
            <div class="host-card__figure">
              <ElIcon :size="88" class="host-card__figure-icon">
                <Monitor />
              </ElIcon>
            </div>
            <div class="host-card__actions">
              <ElButtonGroup>
                <ElButton type="primary" size="default" @click="stubPower('开机', item.name)">
                  开机
                </ElButton>
                <ElButton type="danger" size="default" @click="stubPower('关机', item.name)">
                  关机
                </ElButton>
                <ElButton type="warning" size="default" @click="stubPower('重启', item.name)">
                  重启
                </ElButton>
              </ElButtonGroup>
            </div>
          </div>
          <div class="host-card__metrics">
            <div class="host-card__metric">
              <p class="host-card__metric-label">CPU</p>
              <ElProgress :percentage="item.cpu" :text-inside="true" :stroke-width="17" />
            </div>
            <div class="host-card__metric">
              <p class="host-card__metric-label">RAM</p>
              <ElProgress
                :percentage="item.memory"
                status="success"
                :text-inside="true"
                :stroke-width="17"
              />
            </div>
            <div class="host-card__metric">
              <p class="host-card__metric-label">SWAP</p>
              <ElProgress
                :percentage="item.swap"
                status="warning"
                :text-inside="true"
                :stroke-width="17"
              />
            </div>
            <div class="host-card__metric">
              <p class="host-card__metric-label">DISK</p>
              <ElProgress
                :percentage="item.disk"
                status="success"
                :text-inside="true"
                :stroke-width="17"
              />
            </div>
          </div>
        </div>
      </ElCard>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Monitor } from '@element-plus/icons-vue'
  import { ElMessage } from 'element-plus'

  defineOptions({ name: 'SafeguardHost' })

  interface HostInfo {
    name: string
    ip: string
    cpu: number
    memory: number
    swap: number
    disk: number
  }

  const UPDATE_INTERVAL = 3000

  const hostList = reactive<HostInfo[]>([
    { name: '开发主机', ip: '192.168.1.100', cpu: 85, memory: 65, swap: 45, disk: 92 },
    { name: '测试主机', ip: '192.168.1.101', cpu: 32, memory: 78, swap: 90, disk: 45 },
    { name: '预发布主机', ip: '192.168.1.102', cpu: 95, memory: 42, swap: 67, disk: 88 },
    { name: '线上主机', ip: '192.168.1.103', cpu: 58, memory: 93, swap: 25, disk: 73 }
  ])

  function generateRandomValue(min = 0, max = 100): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  function updateHostMetrics(): void {
    hostList.forEach((host) => {
      host.cpu = generateRandomValue()
      host.memory = generateRandomValue()
      host.swap = generateRandomValue()
      host.disk = generateRandomValue()
    })
  }

  function stubPower(action: string, hostName: string) {
    ElMessage.info(`演示：${action} — ${hostName}`)
  }

  let timer: number | null = null

  onMounted(() => {
    timer = window.setInterval(updateHostMetrics, UPDATE_INTERVAL)
  })

  onUnmounted(() => {
    if (timer !== null) {
      window.clearInterval(timer)
      timer = null
    }
  })
</script>

<style scoped>
  .host-page {
    padding-bottom: 20px;
  }

  .host-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    width: 100%;
  }

  .host-card {
    flex: 1 1 calc(50% - 10px);
    min-width: 280px;
    max-width: calc(50% - 10px);
    box-sizing: border-box;
  }

  @media (max-width: 1024px) {
    .host-card {
      flex: 1 1 100%;
      max-width: 100%;
    }
  }

  .host-card__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .host-card__name {
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .host-card__ip {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    font-family: var(--el-font-family-mono, ui-monospace, monospace);
  }

  .host-card__body {
    display: flex;
    align-items: stretch;
    padding: 24px 28px 28px;
    gap: 24px;
  }

  @media (max-width: 768px) {
    .host-card__body {
      flex-direction: column;
      align-items: center;
      padding: 20px;
    }
  }

  .host-card__aside {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
  }

  .host-card__figure {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
  }

  .host-card__figure-icon {
    color: var(--el-color-primary);
    opacity: 0.9;
  }

  .host-card__actions {
    display: flex;
    justify-content: center;
    margin-top: 4px;
  }

  .host-card__metrics {
    flex: 1;
    min-width: 0;
    margin-top: 4px;
  }

  @media (max-width: 768px) {
    .host-card__metrics {
      width: 100%;
      margin-top: 16px;
    }
  }

  .host-card__metric {
    margin-bottom: 14px;
  }

  .host-card__metric:last-child {
    margin-bottom: 0;
  }

  .host-card__metric-label {
    margin: 0 0 6px;
    font-size: 13px;
    color: var(--el-text-color-regular);
  }
</style>

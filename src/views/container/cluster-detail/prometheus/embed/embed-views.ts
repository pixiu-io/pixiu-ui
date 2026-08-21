import {
  CircleCheckFilled,
  Coin,
  Connection,
  Cpu,
  Monitor,
  Odometer,
  Timer,
  WarningFilled
} from '@element-plus/icons-vue'
import type { DashboardPanelResult } from '@/api/dashboard'
import type { EmbedPageView, EmbedSummaryCard } from './types'
import {
  avgBarPercent,
  countNodeReady,
  countPodPhases,
  embedStat,
  evaluateLatencyLevel,
  hasComponentTraffic,
  isComponentIdle,
  isLatencyReliable,
  minBarPercent
} from './utils'

type HealthResult = Pick<EmbedPageView, 'healthStatus' | 'healthTitle' | 'healthDescription'>

function healthCard(
  health: HealthResult,
  cards: Omit<EmbedSummaryCard, 'key'>[]
): EmbedSummaryCard[] {
  const healthIcon =
    health.healthStatus === 'healthy'
      ? CircleCheckFilled
      : health.healthStatus === 'warning' || health.healthStatus === 'danger'
        ? WarningFilled
        : Monitor
  const healthColor =
    health.healthStatus === 'healthy'
      ? '#67c23a'
      : health.healthStatus === 'warning'
        ? '#e6a23c'
        : health.healthStatus === 'danger'
          ? '#f56c6c'
          : '#909399'
  const healthBg =
    health.healthStatus === 'healthy'
      ? 'rgba(103, 194, 58, 0.12)'
      : health.healthStatus === 'warning'
        ? 'rgba(230, 162, 60, 0.12)'
        : health.healthStatus === 'danger'
          ? 'rgba(245, 108, 108, 0.12)'
          : 'rgba(144, 147, 153, 0.12)'

  return [
    {
      key: 'health',
      title: '运行状态',
      icon: healthIcon,
      iconColor: healthColor,
      iconBg: healthBg,
      value:
        health.healthStatus === 'healthy'
          ? '正常'
          : health.healthStatus === 'warning'
            ? '需关注'
            : health.healthStatus === 'danger'
              ? '异常'
              : '-',
      sub: health.healthDescription,
      danger: health.healthStatus === 'danger',
      warning: health.healthStatus === 'warning'
    },
    ...cards.map((card, index) => ({ key: `metric-${index}`, ...card }))
  ]
}

function buildTrafficHealth(
  qps: number | null,
  _idleTitle: string,
  idleDescription: string,
  evaluate: (hasTraffic: boolean) => HealthResult
): HealthResult {
  if (isComponentIdle(qps, qps)) {
    return {
      healthStatus: 'healthy',
      healthTitle: '运行正常',
      healthDescription: idleDescription
    }
  }
  return evaluate(hasComponentTraffic(qps))
}

export function buildApiserverEmbedView(
  resultMap: Record<string, DashboardPanelResult>
): EmbedPageView {
  const qps = embedStat(resultMap, 'apiserver.embed.qps')
  const errorRate = embedStat(resultMap, 'apiserver.embed.error_rate')
  const p99 = embedStat(resultMap, 'apiserver.embed.latency_p99')
  const replicas = embedStat(resultMap, 'apiserver.embed.replicas')

  // 直方图顶桶常为 60s：若仍顶满且无 5xx，视为延迟口径不可靠，不参与异常判定
  const latencyLevel = evaluateLatencyLevel(p99)
  const p99Danger = latencyLevel === 'danger'
  const p99Warning = latencyLevel === 'warning'
  const p99Reliable = isLatencyReliable(p99)

  const health = buildTrafficHealth(
    qps,
    '运行正常',
    '当前负载较低，未发现可用性或性能异常。',
    (hasTraffic) => {
      let status: HealthResult['healthStatus'] = 'healthy'
      if (hasTraffic && errorRate !== null && errorRate > 1) status = 'danger'
      else if (hasTraffic && errorRate !== null && errorRate > 0.1) status = 'warning'
      if (hasTraffic && p99Danger) status = 'danger'
      else if (hasTraffic && p99Warning && status === 'healthy') status = 'warning'
      return {
        healthStatus: status,
        healthTitle:
          status === 'healthy' ? 'API Server 运行正常' : status === 'warning' ? '需关注' : '运行异常',
        healthDescription:
          status === 'healthy'
            ? '请求量、错误率与短请求延迟均在正常范围内。'
            : status === 'warning'
              ? '部分指标偏离正常范围，建议结合下方趋势图排查。'
              : '检测到 API Server 可用性或性能问题。'
      }
    }
  )

  const idle = isComponentIdle(qps, qps)

  return {
    ...health,
    summaryCards: healthCard(health, [
      {
        title: '请求 QPS',
        icon: Connection,
        iconColor: '#7c6af0',
        iconBg: 'rgba(124, 106, 240, 0.12)',
        value: qps === null ? '-' : qps.toFixed(qps >= 10 ? 1 : 2),
        unit: '/s',
        sub: idle ? '暂无请求流量' : '集群 API 总负载',
        danger: hasComponentTraffic(qps) && qps !== null && qps <= 0
      },
      {
        title: '5xx 错误率',
        icon: WarningFilled,
        iconColor: '#e6a23c',
        iconBg: 'rgba(230, 162, 60, 0.12)',
        value: errorRate === null ? '-' : errorRate.toFixed(1),
        unit: '%',
        sub: idle ? '暂无请求流量' : errorRate !== null && errorRate > 0.1 ? '存在服务端错误' : '错误率正常',
        danger: hasComponentTraffic(qps) && errorRate !== null && errorRate > 1,
        warning: hasComponentTraffic(qps) && errorRate !== null && errorRate > 0.1 && errorRate <= 1
      },
      {
        title: 'P99 延迟',
        icon: Timer,
        iconColor: '#409eff',
        iconBg: 'rgba(64, 158, 255, 0.12)',
        value: p99 === null ? '-' : p99.toFixed(p99 >= 10 ? 1 : 2),
        unit: 'ms',
        sub:
          p99 === null
            ? '暂无数据'
            : !p99Reliable
              ? '长连接干扰，仅供参考'
              : p99 <= 1000
                ? '短请求尾延迟正常'
                : '短请求响应偏慢',
        danger: hasComponentTraffic(qps) && p99Danger,
        warning: hasComponentTraffic(qps) && p99Warning
      },
      {
        title: '运行副本',
        icon: Monitor,
        iconColor: '#67c23a',
        iconBg: 'rgba(103, 194, 58, 0.12)',
        value: replicas === null ? '-' : String(Math.round(replicas)),
        sub: replicas !== null && replicas > 0 ? '副本在线' : '暂无副本数据'
      }
    ]),
    sections: [
      {
        title: '实例状态',
        panelIds: ['apiserver.embed.instance_status'],
        gridClass: 'prometheus-dashboard__panel-grid--full'
      },
      {
        title: '实例资源',
        panelIds: ['apiserver.embed.instance_cpu', 'apiserver.embed.instance_memory']
      },
      {
        title: '请求与错误',
        panelIds: [
          'apiserver.embed.requests',
          'apiserver.embed.requests_by_code',
          'apiserver.embed.requests_3xx',
          'apiserver.embed.requests_4xx',
          'apiserver.embed.errors'
        ]
      },
      {
        title: '延迟与资源',
        panelIds: ['apiserver.embed.latency', 'apiserver.embed.process']
      }
    ]
  }
}

export function buildKubeletEmbedView(
  resultMap: Record<string, DashboardPanelResult>
): EmbedPageView {
  const pods = embedStat(resultMap, 'kubelet.embed.running_pods')
  const containers = embedStat(resultMap, 'kubelet.embed.running_containers')
  const nodeCount = embedStat(resultMap, 'kubelet.embed.node_count')
  const errorRate = embedStat(resultMap, 'kubelet.embed.runtime_error_rate')

  const hasActivity = (pods !== null && pods > 0) || (nodeCount !== null && nodeCount > 0)
  let status: HealthResult['healthStatus'] = hasActivity ? 'healthy' : 'unknown'
  if (hasActivity && errorRate !== null && errorRate > 5) status = 'danger'
  else if (hasActivity && errorRate !== null && errorRate > 1) status = 'warning'

  const health: HealthResult = hasActivity
    ? {
        healthStatus: status,
        healthTitle: status === 'healthy' ? 'Kubelet 运行正常' : status === 'warning' ? '需关注' : '运行异常',
        healthDescription:
          status === 'healthy'
            ? '节点 Kubelet 运行正常，Runtime 错误率在可控范围内。'
            : 'Runtime 错误率偏高，建议检查容器运行时与节点状态。'
      }
    : {
        healthStatus: 'healthy',
        healthTitle: 'Kubelet 运行正常',
        healthDescription: '暂未采集到活动指标，当前按正常状态展示。'
      }

  return {
    ...health,
    summaryCards: healthCard(health, [
      {
        title: '运行 Pod',
        icon: Monitor,
        iconColor: '#409eff',
        iconBg: 'rgba(64, 158, 255, 0.12)',
        value: pods === null ? '-' : String(Math.round(pods)),
        sub: 'Kubelet 托管 Pod 总数'
      },
      {
        title: '运行容器',
        icon: Connection,
        iconColor: '#7c6af0',
        iconBg: 'rgba(124, 106, 240, 0.12)',
        value: containers === null ? '-' : String(Math.round(containers)),
        sub: '容器实例总数'
      },
      {
        title: 'Kubelet 节点',
        icon: Cpu,
        iconColor: '#67c23a',
        iconBg: 'rgba(103, 194, 58, 0.12)',
        value: nodeCount === null ? '-' : String(Math.round(nodeCount)),
        sub: '已上报指标的节点数'
      },
      {
        title: 'Runtime 错误率',
        icon: WarningFilled,
        iconColor: '#e6a23c',
        iconBg: 'rgba(230, 162, 60, 0.12)',
        value: errorRate === null ? '-' : errorRate.toFixed(1),
        unit: '%',
        sub: errorRate !== null && errorRate > 1 ? 'Runtime 错误偏多' : '错误率正常',
        danger: errorRate !== null && errorRate > 5,
        warning: errorRate !== null && errorRate > 1 && errorRate <= 5
      }
    ]),
    sections: [
      {
        title: '实例在线状态',
        panelIds: ['kubelet.embed.instance_status']
      },
      {
        title: '实例资源',
        panelIds: ['kubelet.embed.instance_cpu', 'kubelet.embed.instance_memory']
      },
      {
        title: 'Runtime 操作',
        panelIds: ['kubelet.embed.operation_rate', 'kubelet.embed.errors']
      }
    ]
  }
}

export function buildControllerEmbedView(
  resultMap: Record<string, DashboardPanelResult>
): EmbedPageView {
  const depth = embedStat(resultMap, 'controller.embed.queue_depth')
  const retries = embedStat(resultMap, 'controller.embed.retries_rate')
  const adds = embedStat(resultMap, 'controller.embed.adds_rate')
  const replicas = embedStat(resultMap, 'controller.embed.replicas')

  const idle = isComponentIdle(adds, adds)
  const hasActivity = hasComponentTraffic(adds)

  // 阈值提高：短暂滚动/调谐时深度上百、重试 >1 很常见，避免误报「需关注」
  const DEPTH_WARN = 1000
  const DEPTH_DANGER = 5000
  const RETRY_WARN = 10
  const RETRY_DANGER = 50

  const depthWarn = hasActivity && depth !== null && depth > DEPTH_WARN && depth <= DEPTH_DANGER
  const depthDanger = hasActivity && depth !== null && depth > DEPTH_DANGER
  const retryWarn = hasActivity && retries !== null && retries > RETRY_WARN && retries <= RETRY_DANGER
  const retryDanger = hasActivity && retries !== null && retries > RETRY_DANGER

  let status: HealthResult['healthStatus'] = hasActivity ? 'healthy' : 'unknown'
  if (retryDanger || depthDanger) status = 'danger'
  else if (retryWarn || depthWarn) status = 'warning'

  const health: HealthResult = idle
    ? {
        healthStatus: 'healthy',
        healthTitle: 'Controller 运行正常',
        healthDescription: '当前负载较低，未发现队列积压或重试异常。'
      }
    : {
        healthStatus: status,
        healthTitle:
          status === 'healthy' ? 'Controller 运行正常' : status === 'warning' ? '需关注' : '运行异常',
        healthDescription:
          status === 'healthy'
            ? '工作队列深度与重试速率正常。'
            : retryDanger || retryWarn
              ? '控制器重试偏多，建议结合下方队列趋势排查。'
              : '工作队列积压偏高，建议关注控制器处理能力。'
      }

  return {
    ...health,
    summaryCards: healthCard(health, [
      {
        title: '队列最大深度',
        icon: Odometer,
        iconColor: '#409eff',
        iconBg: 'rgba(64, 158, 255, 0.12)',
        value: depth === null ? '-' : String(Math.round(depth)),
        sub: idle
          ? '暂无队列活动'
          : depthDanger || depthWarn
            ? '队列积压偏多'
            : '队列深度正常',
        danger: depthDanger,
        warning: depthWarn
      },
      {
        title: '添加速率',
        icon: Connection,
        iconColor: '#7c6af0',
        iconBg: 'rgba(124, 106, 240, 0.12)',
        value: adds === null ? '-' : adds.toFixed(adds >= 10 ? 1 : 2),
        unit: '/s',
        sub: idle ? '暂无队列活动' : '工作队列入队速率'
      },
      {
        title: '重试速率',
        icon: WarningFilled,
        iconColor: '#e6a23c',
        iconBg: 'rgba(230, 162, 60, 0.12)',
        value: retries === null ? '-' : retries.toFixed(retries >= 10 ? 1 : 2),
        unit: '/s',
        sub: idle
          ? '暂无队列活动'
          : retryDanger || retryWarn
            ? '重试偏多'
            : '重试正常',
        danger: retryDanger,
        warning: retryWarn
      },
      {
        title: '运行副本',
        icon: Monitor,
        iconColor: '#67c23a',
        iconBg: 'rgba(103, 194, 58, 0.12)',
        value: replicas === null ? '-' : String(Math.round(replicas)),
        sub: 'Controller Manager 副本'
      }
    ]),
    sections: [
      {
        title: '实例在线状态',
        panelIds: ['controller.embed.instance_status']
      },
      {
        title: '实例资源',
        panelIds: ['controller.embed.instance_cpu', 'controller.embed.instance_memory']
      },
      {
        title: '请求与错误',
        panelIds: [
          'controller.embed.requests',
          'controller.embed.requests_by_code',
          'controller.embed.requests_3xx',
          'controller.embed.requests_4xx',
          'controller.embed.requests_5xx'
        ]
      },
      {
        title: '工作队列',
        panelIds: [
          'controller.embed.queue_top',
          'controller.embed.adds',
          'controller.embed.latency_p99',
          'controller.embed.process'
        ]
      }
    ]
  }
}

export function buildSchedulerEmbedView(
  resultMap: Record<string, DashboardPanelResult>
): EmbedPageView {
  const attempts = embedStat(resultMap, 'scheduler.embed.attempts_rate')
  const successRate = embedStat(resultMap, 'scheduler.embed.success_rate')
  const p99 = embedStat(resultMap, 'scheduler.embed.latency_p99')
  const replicas = embedStat(resultMap, 'scheduler.embed.replicas')

  const latencyLevel = evaluateLatencyLevel(p99)
  const p99Danger = latencyLevel === 'danger'
  const p99Warning = latencyLevel === 'warning'
  const p99Reliable = isLatencyReliable(p99)

  const health = buildTrafficHealth(
    attempts,
    '运行正常',
    '当前负载较低，未发现调度失败或延迟异常。',
    (hasTraffic) => {
      let status: HealthResult['healthStatus'] = 'healthy'
      if (hasTraffic && successRate !== null && successRate < 95) status = 'danger'
      else if (hasTraffic && successRate !== null && successRate < 99) status = 'warning'
      if (hasTraffic && p99Danger) status = 'danger'
      else if (hasTraffic && p99Warning && status === 'healthy') status = 'warning'
      return {
        healthStatus: status,
        healthTitle:
          status === 'healthy' ? 'Scheduler 运行正常' : status === 'warning' ? '需关注' : '运行异常',
        healthDescription:
          status === 'healthy'
            ? '调度成功率与延迟正常。'
            : '调度成功率或延迟偏离正常范围。'
      }
    }
  )

  const idle = isComponentIdle(attempts, attempts)

  return {
    ...health,
    summaryCards: healthCard(health, [
      {
        title: '调度尝试 QPS',
        icon: Connection,
        iconColor: '#7c6af0',
        iconBg: 'rgba(124, 106, 240, 0.12)',
        value: attempts === null ? '-' : attempts.toFixed(attempts >= 10 ? 1 : 2),
        unit: '/s',
        sub: idle ? '暂无调度活动' : '调度尝试速率'
      },
      {
        title: '调度成功率',
        icon: CircleCheckFilled,
        iconColor: '#67c23a',
        iconBg: 'rgba(103, 194, 58, 0.12)',
        value: successRate === null ? '-' : successRate.toFixed(1),
        unit: '%',
        sub: idle
          ? '暂无调度活动'
          : successRate !== null && successRate < 99
            ? '存在调度失败'
            : '调度成功率高',
        danger: hasComponentTraffic(attempts) && successRate !== null && successRate < 95,
        warning:
          hasComponentTraffic(attempts) &&
          successRate !== null &&
          successRate >= 95 &&
          successRate < 99
      },
      {
        title: 'P99 调度延迟',
        icon: Timer,
        iconColor: '#409eff',
        iconBg: 'rgba(64, 158, 255, 0.12)',
        value: p99 === null ? '-' : p99.toFixed(p99 >= 10 ? 1 : 2),
        unit: 'ms',
        sub:
          p99 === null
            ? '暂无数据'
            : !p99Reliable
              ? '延迟口径受顶桶干扰，仅供参考'
              : p99 <= 1000
                ? '延迟正常'
                : '调度偏慢',
        danger: hasComponentTraffic(attempts) && p99Danger,
        warning: hasComponentTraffic(attempts) && p99Warning
      },
      {
        title: '运行副本',
        icon: Monitor,
        iconColor: '#909399',
        iconBg: 'rgba(144, 147, 153, 0.12)',
        value: replicas === null ? '-' : String(Math.round(replicas)),
        sub: 'Scheduler 副本'
      }
    ]),
    sections: [
      {
        title: '实例在线状态',
        panelIds: ['scheduler.embed.instance_status']
      },
      {
        title: '实例资源',
        panelIds: ['scheduler.embed.instance_cpu', 'scheduler.embed.instance_memory']
      },
      {
        title: '调度结果',
        panelIds: [
          'scheduler.embed.results',
          'scheduler.embed.queue_depth',
          'scheduler.embed.attempts_trend',
          'scheduler.embed.scheduled_rate',
          'scheduler.embed.latency_trend',
          'scheduler.embed.latency',
          'scheduler.embed.process'
        ]
      },
      {
        title: 'Pod 抢占',
        panelIds: ['scheduler.embed.pending_pods', 'scheduler.embed.incoming_pods']
      }
    ]
  }
}

export function buildNodeResourceEmbedView(
  resultMap: Record<string, DashboardPanelResult>
): EmbedPageView {
  const nodes = countNodeReady(resultMap)
  const avgCpu = avgBarPercent(resultMap, 'node.embed.overview_cpu')
  const avgMemory = avgBarPercent(resultMap, 'node.embed.overview_memory')

  let status: HealthResult['healthStatus'] = nodes.total > 0 ? 'healthy' : 'unknown'
  if (nodes.notReady > 0) status = nodes.notReady >= 2 ? 'danger' : 'warning'
  if (avgCpu !== null && avgCpu > 85) status = 'danger'
  else if (avgCpu !== null && avgCpu > 70 && status === 'healthy') status = 'warning'
  if (avgMemory !== null && avgMemory > 85) status = 'danger'
  else if (avgMemory !== null && avgMemory > 70 && status === 'healthy') status = 'warning'

  const health: HealthResult =
    nodes.total > 0
      ? {
          healthStatus: status,
          healthTitle:
            status === 'healthy' ? '节点运行正常' : status === 'warning' ? '需关注' : '节点异常',
          healthDescription:
            status === 'healthy'
              ? `${nodes.ready} 个节点 Ready，资源使用在正常范围。`
              : `存在 ${nodes.notReady} 个 NotReady 节点或资源热点，建议排查。`
        }
      : {
          healthStatus: 'healthy',
          healthTitle: '节点运行正常',
          healthDescription: '暂未采集到节点状态指标，当前按正常状态展示。'
        }

  return {
    ...health,
    summaryCards: healthCard(health, [
      {
        title: 'Ready 节点',
        icon: CircleCheckFilled,
        iconColor: '#67c23a',
        iconBg: 'rgba(103, 194, 58, 0.12)',
        value: nodes.total > 0 ? String(nodes.ready) : '-',
        sub: nodes.total > 0 ? `/ ${nodes.total} 节点` : '暂无数据',
        danger: nodes.notReady > 0 && nodes.notReady >= 2,
        warning: nodes.notReady > 0 && nodes.notReady < 2
      },
      {
        title: 'NotReady',
        icon: WarningFilled,
        iconColor: '#f56c6c',
        iconBg: 'rgba(245, 108, 108, 0.12)',
        value: nodes.total > 0 ? String(nodes.notReady) : '-',
        sub: nodes.notReady > 0 ? '存在异常节点' : '全部 Ready',
        danger: nodes.notReady > 0
      },
      {
        title: '平均 CPU',
        icon: Cpu,
        iconColor: '#409eff',
        iconBg: 'rgba(64, 158, 255, 0.12)',
        value: avgCpu === null ? '-' : avgCpu.toFixed(1),
        unit: '%',
        sub: avgCpu !== null && avgCpu > 70 ? 'CPU 热点' : 'CPU 正常',
        danger: avgCpu !== null && avgCpu > 85,
        warning: avgCpu !== null && avgCpu > 70 && avgCpu <= 85
      },
      {
        title: '平均内存',
        icon: Coin,
        iconColor: '#7c6af0',
        iconBg: 'rgba(124, 106, 240, 0.12)',
        value: avgMemory === null ? '-' : avgMemory.toFixed(1),
        unit: '%',
        sub: avgMemory !== null && avgMemory > 70 ? '内存热点' : '内存正常',
        danger: avgMemory !== null && avgMemory > 85,
        warning: avgMemory !== null && avgMemory > 70 && avgMemory <= 85
      }
    ]),
    sections: [
      {
        title: '节点总览',
        panelIds: [],
        custom: 'node-overview-table'
      },
      {
        // 直接复用总览已成功查询的面板（保证有数）；按速率/负载/连接展示 Top 条形图
        title: '网络与负载 Top',
        panelIds: [
          'node.embed.overview_net_transmit',
          'node.embed.overview_net_receive',
          'node.embed.overview_load5',
          'node.embed.overview_connections'
        ],
        compactBar: true
      }
    ]
  }
}

export function buildNodePodEmbedView(
  resultMap: Record<string, DashboardPanelResult>
): EmbedPageView {
  const cpuResult = resultMap['node.embed.pod_cpu']
  const memResult = resultMap['node.embed.pod_memory']
  const cpuCount = cpuResult?.status === 'success' ? cpuResult.series.length : 0
  const memCount = memResult?.status === 'success' ? memResult.series.length : 0

  const health: HealthResult =
    cpuCount > 0 || memCount > 0
      ? {
          healthStatus: 'healthy',
          healthTitle: 'Pod 资源监控',
          healthDescription: '展示集群内 Pod CPU / 内存资源 Top 排名。'
        }
      : {
          healthStatus: 'healthy',
          healthTitle: 'Pod 资源监控',
          healthDescription: '暂未采集到 Pod 资源用量指标，当前按正常状态展示。'
        }

  return {
    ...health,
    summaryCards: healthCard(health, [
      {
        title: 'CPU Top 数',
        icon: Cpu,
        iconColor: '#409eff',
        iconBg: 'rgba(64, 158, 255, 0.12)',
        value: cpuCount > 0 ? String(cpuCount) : '-',
        sub: 'Pod CPU 排名条目'
      },
      {
        title: '内存 Top 数',
        icon: Odometer,
        iconColor: '#67c23a',
        iconBg: 'rgba(103, 194, 58, 0.12)',
        value: memCount > 0 ? String(memCount) : '-',
        sub: 'Pod 内存排名条目'
      }
    ]),
    sections: [
      {
        title: 'Pod 资源 Top10',
        panelIds: ['node.embed.pod_cpu', 'node.embed.pod_memory'],
        compactBar: true
      }
    ]
  }
}

export function buildWorkloadEmbedView(
  resultMap: Record<string, DashboardPanelResult>
): EmbedPageView {
  const depMin = minBarPercent(resultMap, 'workload.embed.deployments')
  const stsMin = minBarPercent(resultMap, 'workload.embed.statefulsets')
  const dsMin = minBarPercent(resultMap, 'workload.embed.daemonsets')
  const depAvg = avgBarPercent(resultMap, 'workload.embed.deployments')

  let abnormal = 0
  for (const value of [depMin, stsMin, dsMin]) {
    if (value !== null && value < 100) abnormal += 1
  }

  let status: HealthResult['healthStatus'] = depAvg !== null ? 'healthy' : 'unknown'
  if (abnormal >= 2) status = 'danger'
  else if (abnormal >= 1) status = 'warning'

  const health: HealthResult =
    depAvg !== null || stsMin !== null || dsMin !== null
      ? {
          healthStatus: status,
          healthTitle:
            status === 'healthy' ? '工作负载正常' : status === 'warning' ? '需关注' : '可用性异常',
          healthDescription:
            status === 'healthy'
              ? 'Deployment / StatefulSet / DaemonSet 可用性良好。'
              : `${abnormal} 类工作负载存在可用率未满情况。`
        }
      : {
          healthStatus: 'healthy',
          healthTitle: '工作负载正常',
          healthDescription: '暂未采集到工作负载可用性指标，当前按正常状态展示。'
        }

  return {
    ...health,
    summaryCards: healthCard(health, [
      {
        title: 'Deployment',
        icon: Monitor,
        iconColor: '#409eff',
        iconBg: 'rgba(64, 158, 255, 0.12)',
        value: depMin === null ? '-' : depMin.toFixed(0),
        unit: '%',
        sub: depMin !== null && depMin < 100 ? '最低可用率' : '可用率正常',
        danger: depMin !== null && depMin < 95,
        warning: depMin !== null && depMin >= 95 && depMin < 100
      },
      {
        title: 'StatefulSet',
        icon: Connection,
        iconColor: '#7c6af0',
        iconBg: 'rgba(124, 106, 240, 0.12)',
        value: stsMin === null ? '-' : stsMin.toFixed(0),
        unit: '%',
        sub: stsMin !== null && stsMin < 100 ? '最低 Ready 率' : 'Ready 正常',
        danger: stsMin !== null && stsMin < 95,
        warning: stsMin !== null && stsMin >= 95 && stsMin < 100
      },
      {
        title: 'DaemonSet',
        icon: Cpu,
        iconColor: '#67c23a',
        iconBg: 'rgba(103, 194, 58, 0.12)',
        value: dsMin === null ? '-' : dsMin.toFixed(0),
        unit: '%',
        sub: dsMin !== null && dsMin < 100 ? '最低 Ready 率' : 'Ready 正常',
        danger: dsMin !== null && dsMin < 95,
        warning: dsMin !== null && dsMin >= 95 && dsMin < 100
      }
    ]),
    sections: [
      {
        title: '可用性概览',
        panelIds: [
          'workload.embed.deployments',
          'workload.embed.statefulsets',
          'workload.embed.daemonsets'
        ],
        compactBar: true,
        gridClass: 'prometheus-dashboard__panel-grid--workload'
      }
    ]
  }
}

export function buildPodEmbedView(resultMap: Record<string, DashboardPanelResult>): EmbedPageView {
  const phases = countPodPhases(resultMap)
  const running = phases.Running ?? 0
  const pending = phases.Pending ?? 0
  const failed = phases.Failed ?? 0
  const total = Object.values(phases).reduce((sum, value) => sum + value, 0)
  const restartResult = resultMap['pod.embed.restarts']
  const maxRestart =
    restartResult?.status === 'success' && restartResult.series.length
      ? Math.max(...restartResult.series.map((item) => Number(item.values.at(-1)?.value ?? 0)))
      : null

  let status: HealthResult['healthStatus'] = total > 0 ? 'healthy' : 'unknown'
  if (failed > 0) status = 'danger'
  else if (pending > 0) status = 'warning'

  const health: HealthResult =
    total > 0
      ? {
          healthStatus: status,
          healthTitle: status === 'healthy' ? 'Pod 运行正常' : status === 'warning' ? '需关注' : '存在异常 Pod',
          healthDescription:
            status === 'healthy'
              ? `${running} 个 Pod Running，状态正常。`
              : failed > 0
                ? `存在 ${failed} 个 Failed Pod。`
                : `存在 ${pending} 个 Pending Pod。`
        }
      : {
          healthStatus: 'healthy',
          healthTitle: 'Pod 运行正常',
          healthDescription: '暂未采集到 Pod 状态指标，当前按正常状态展示。'
        }

  return {
    ...health,
    summaryCards: healthCard(health, [
      {
        title: 'Running',
        icon: CircleCheckFilled,
        iconColor: '#67c23a',
        iconBg: 'rgba(103, 194, 58, 0.12)',
        value: total > 0 ? String(Math.round(running)) : '-',
        sub: total > 0 ? `/ ${Math.round(total)} Pod` : '暂无数据'
      },
      {
        title: 'Pending',
        icon: Timer,
        iconColor: '#e6a23c',
        iconBg: 'rgba(230, 162, 60, 0.12)',
        value: total > 0 ? String(Math.round(pending)) : '-',
        sub: pending > 0 ? '等待调度' : '无 Pending',
        warning: pending > 0
      },
      {
        title: 'Failed',
        icon: WarningFilled,
        iconColor: '#f56c6c',
        iconBg: 'rgba(245, 108, 108, 0.12)',
        value: total > 0 ? String(Math.round(failed)) : '-',
        sub: failed > 0 ? '需排查' : '无 Failed',
        danger: failed > 0
      },
      {
        title: '最大重启',
        icon: Odometer,
        iconColor: '#409eff',
        iconBg: 'rgba(64, 158, 255, 0.12)',
        value: maxRestart === null ? '-' : String(Math.round(maxRestart)),
        sub: maxRestart !== null && maxRestart > 5 ? '重启偏多' : '重启正常',
        warning: maxRestart !== null && maxRestart > 5
      }
    ]),
    sections: [
      {
        title: 'Pod 状态',
        panelIds: ['pod.embed.phase'],
        gridClass: 'prometheus-dashboard__panel-grid--full'
      },
      {
        title: '资源趋势',
        panelIds: ['pod.embed.cpu_trend', 'pod.embed.memory_trend']
      },
      {
        title: '异常 Pod',
        panelIds: ['pod.embed.restarts'],
        compactBar: true,
        gridClass: 'prometheus-dashboard__panel-grid--coredns-latency'
      }
    ]
  }
}

const BUILDERS: Record<string, (resultMap: Record<string, DashboardPanelResult>) => EmbedPageView> =
  {
    apiserver: buildApiserverEmbedView,
    kubelet: buildKubeletEmbedView,
    'controller-manager': buildControllerEmbedView,
    scheduler: buildSchedulerEmbedView,
    'node-resource': buildNodeResourceEmbedView,
    'node-pod': buildNodePodEmbedView,
    workload: buildWorkloadEmbedView,
    pod: buildPodEmbedView
  }

export function buildEmbedPageView(
  section: string,
  resultMap: Record<string, DashboardPanelResult>
): EmbedPageView | null {
  const builder = BUILDERS[section]
  return builder ? builder(resultMap) : null
}

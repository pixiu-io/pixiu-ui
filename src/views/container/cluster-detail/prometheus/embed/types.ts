import type { Component } from 'vue'

export type EmbedHealthStatus = 'healthy' | 'warning' | 'danger' | 'unknown'

export type EmbedSummaryCard = {
  key: string
  title: string
  icon: Component
  iconColor: string
  iconBg: string
  value: string
  unit?: string
  sub: string
  danger?: boolean
  warning?: boolean
}

export type EmbedChartSection = {
  title: string
  panelIds: string[]
  compactBar?: boolean
  gridClass?: string
  /** 自定义块：节点总览表（不渲染 DashboardPanel） */
  custom?: 'node-overview-table'
}

export type EmbedPageView = {
  healthStatus: EmbedHealthStatus
  healthTitle: string
  healthDescription: string
  summaryCards: EmbedSummaryCard[]
  sections: EmbedChartSection[]
}

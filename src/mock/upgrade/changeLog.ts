interface UpgradeLog {
  version: string // 版本号
  title: string // 更新标题
  date: string // 更新日期
  detail?: string[] // 更新内容
  requireReLogin?: boolean // 是否需要重新登录
  remark?: string // 备注
}

export const upgradeLogList = ref<UpgradeLog[]>([
  {
    version: 'v2.0.1',
    title: '前端重构和体验优化',
    date: '2026-06-1',
    detail: [
      '优化：前端体验优化',
      '修复：已知问题'
    ]
  },
])

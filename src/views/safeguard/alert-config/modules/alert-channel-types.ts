import type { AlertChannelType } from '@/api/alert'
import wecomIcon from '@/assets/images/svg/wecom.svg'

export interface AlertChannelTypeOption {
  value: AlertChannelType
  label: string
  icon?: string
  image?: string
  color: string
  disabled?: boolean
}

export const alertChannelTypeOptions: AlertChannelTypeOption[] = [
  { value: 1, label: '邮件', icon: 'mdi:email-outline', color: '#409EFF', disabled: true },
  { value: 2, label: '钉钉', icon: 'ant-design:dingtalk-outlined', color: '#0089FF' },
  { value: 3, label: '企业微信', image: wecomIcon, color: '#0082EF', disabled: true },
  { value: 4, label: 'Webhook', icon: 'mdi:webhook', color: '#6366F1', disabled: true }
]

export function getAlertChannelTypeOption(type: AlertChannelType) {
  return alertChannelTypeOptions.find((item) => item.value === type)
}

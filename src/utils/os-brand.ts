/** 操作系统家族本地 logo（无法用 Iconify 表达的品牌图） */
import centosLogo from '@/assets/images/os/centos.svg'
import kylinLogo from '@/assets/images/os/kylin.png'
import openEulerLogo from '@/assets/images/os/openeuler.svg'

export const OS_LOGO_SRC: Record<string, string> = {
  CentOS: centosLogo,
  Kylin: kylinLogo,
  OpenEuler: openEulerLogo
}

export function osLogoSrc(os: string): string | undefined {
  return OS_LOGO_SRC[os]
}

<!-- 登录页面 -->
<template>
  <div class="flex w-full h-screen">
    <LoginLeftView />

    <div class="relative flex-1">
      <AuthTopBar />

      <div class="auth-right-wrap">
        <div class="form">
          <h3 class="title">{{ $t('login.title') }}</h3>
          <p class="sub-title">{{ $t('login.subTitle') }}</p>
          <ElForm
            ref="formRef"
            :model="formData"
            :rules="rules"
            :key="formKey"
            @submit.prevent="handleSubmit"
            style="margin-top: 25px"
          >
            <ElFormItem prop="username">
              <ElInput
                class="custom-height"
                :placeholder="$t('login.placeholder.username')"
                v-model.trim="formData.username"
              />
            </ElFormItem>
            <ElFormItem prop="password">
              <ElInput
                class="custom-height"
                :placeholder="$t('login.placeholder.password')"
                v-model.trim="formData.password"
                type="password"
                autocomplete="off"
                show-password
              />
            </ElFormItem>

            <div class="flex-cb mt-6 text-sm">
              <ElCheckbox v-model="formData.rememberPassword">{{
                $t('login.rememberPwd')
              }}</ElCheckbox>
              <RouterLink class="text-theme" :to="{ name: 'ForgetPassword' }">{{
                $t('login.forgetPwd')
              }}</RouterLink>
            </div>

            <div style="margin-top: 30px">
              <ElButton
                class="w-full custom-height"
                type="primary"
                native-type="button"
                @click="handleSubmit"
                :loading="loading"
                v-ripple
              >
                {{ $t('login.btnText') }}
              </ElButton>
            </div>

            <div class="mt-5 text-sm text-gray-600">
              <span>{{ $t('login.noAccount') }}</span>
              <RouterLink class="text-theme" :to="{ name: 'Register' }">{{
                $t('login.register')
              }}</RouterLink>
            </div>
          </ElForm>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import AppConfig from '@/config'
  import { useUserStore } from '@/store/modules/user'
  import { usePermissionStore } from '@/store/modules/permission'
  import { useI18n } from 'vue-i18n'
  import { HttpError } from '@/utils/http/error'
  import { fetchLogin } from '@/api/auth'
  import { resetRouteInitState } from '@/router/guards/beforeEach'
  import { resolveLoginRedirect } from '@/utils/navigation/login-redirect'
  import { ElNotification, ElMessage, type FormInstance, type FormRules } from 'element-plus'
  import { notifyError } from '@/utils/sys/notify'

  defineOptions({ name: 'Login' })

  const { t, locale } = useI18n()
  const formKey = ref(0)

  // 监听语言切换，重置表单
  watch(locale, () => {
    formKey.value++
  })

  const userStore = useUserStore()
  const router = useRouter()
  const route = useRoute()

  const systemName = AppConfig.systemInfo.name
  const formRef = ref<FormInstance>()

  const formData = reactive({
    username: '',
    password: '',
    rememberPassword: true
  })

  const rules = computed<FormRules>(() => ({
    username: [{ required: true, message: t('login.placeholder.username'), trigger: 'blur' }],
    password: [{ required: true, message: t('login.placeholder.password'), trigger: 'blur' }]
  }))

  const loading = ref(false)
  let loginSuccessTimer: ReturnType<typeof setTimeout> | null = null

  function clearLoginSuccessNotice() {
    if (loginSuccessTimer !== null) {
      clearTimeout(loginSuccessTimer)
      loginSuccessTimer = null
    }
  }

  // 登录
  const handleSubmit = async () => {
    if (!formRef.value || loading.value) return

    clearLoginSuccessNotice()

    let loginApplied = false

    try {
      // 表单验证
      const valid = await formRef.value.validate()
      if (!valid) return

      loading.value = true

      // 登录请求
      const { username, password } = formData

      const { token, user_id, user_name, role } = await fetchLogin({
        name: username,
        password
      })

      // 验证token
      if (!token) {
        throw new Error('Login failed - no token received')
      }

      // 存储 token 和登录状态
      userStore.setToken(token)
      loginApplied = true

      // 设置用户信息
      const roleMap: Record<number, string> = { 0: 'R_SUPER', 1: 'R_ADMIN', 2: 'R_USER' }
      userStore.setUserInfo({
        userId: user_id,
        userName: user_name,
        roles: [roleMap[role] ?? 'R_USER'],
        buttons: [],
        email: ''
      })

      // 拉取当前用户 API / 资源作用域，驱动菜单与资源可见性
      const permissionStore = usePermissionStore()
      await permissionStore.loadPermissions()
      userStore.setUserInfo({
        ...userStore.info,
        userId: user_id,
        userName: user_name,
        roles: [roleMap[role] ?? 'R_USER'],
        buttons: permissionStore.buttons,
        email: ''
      } as Api.Auth.UserInfo)

      userStore.setLoginStatus(true)

      // 重置动态路由状态，避免沿用上次的失败标记；跳转首页或合法 redirect
      resetRouteInitState()
      await router.replace(resolveLoginRedirect(route.query.redirect))

      // 仅在登录与跳转都成功后再提示
      showLoginSuccessNotice()
    } catch (error) {
      clearLoginSuccessNotice()
      if (loginApplied) {
        userStore.setLoginStatus(false)
        userStore.setToken('')
      }
      if (error instanceof HttpError) {
        notifyError(error, '登录失败，请稍后重试')
      } else {
        ElMessage.error('登录失败，请稍后重试')
        console.error('[Login] Unexpected error:', error)
      }
    } finally {
      loading.value = false
    }
  }

  // 登录成功提示
  const showLoginSuccessNotice = () => {
    clearLoginSuccessNotice()
    loginSuccessTimer = setTimeout(() => {
      loginSuccessTimer = null
      ElNotification({
        title: t('login.success.title'),
        type: 'success',
        duration: 2500,
        zIndex: 10000,
        message: `${t('login.success.message')}, ${systemName}!`
      })
    }, 300)
  }

  onBeforeUnmount(() => {
    clearLoginSuccessNotice()
  })
</script>

<style scoped>
  @import './style.css';
</style>

<style lang="scss" scoped>
  :deep(.el-select__wrapper) {
    height: 40px !important;
  }
</style>

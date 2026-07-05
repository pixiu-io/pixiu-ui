<!-- 个人中心页面 -->
<template>
  <div class="w-full h-full p-0 bg-transparent border-none shadow-none">
    <div class="relative flex-b mt-2.5 max-md:block max-md:mt-1">
      <div class="w-112 mr-5 max-md:w-full max-md:mr-0">
        <div class="art-card-sm relative p-9 pb-6 overflow-hidden text-center">
          <img class="absolute top-0 left-0 w-full h-50 object-cover" src="@imgs/user/bg.webp" />
          <img class="user-center-avatar relative z-10 w-20 h-20 mt-30 mx-auto object-cover border-2 border-white rounded-full" :src="defaultAvatar" alt="avatar" />
          <h2 class="mt-5 text-xl font-normal">{{ userStore.getUserInfo?.userName || '-' }}</h2>
          <p class="mt-5 text-sm">{{ greeting }}</p>

          <div class="w-75 mx-auto mt-7.5 text-left">
            <div class="mt-2.5">
              <ArtSvgIcon icon="ri:mail-line" class="text-g-700" />
              <span class="ml-2 text-sm">{{ form.email || '-' }}</span>
            </div>
            <div class="mt-2.5">
              <ArtSvgIcon icon="ri:user-3-line" class="text-g-700" />
              <span class="ml-2 text-sm">{{ roleText }}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="flex-1 overflow-hidden max-md:w-full max-md:mt-3.5">
        <!-- 基本设置 -->
        <div class="art-card-sm">
          <h1 class="p-4 text-xl font-normal border-b border-g-300">基本设置</h1>
          <ElForm
            ref="ruleFormRef"
            :model="form"
            :rules="rules"
            class="box-border p-5 [&>.el-row_.el-form-item]:w-[calc(50%-10px)] [&>.el-row_.el-input]:w-full [&>.el-row_.el-select]:w-full"
            label-width="86px"
            label-position="top"
          >
            <ElRow>
              <ElFormItem label="用户名" prop="userName">
                <ElInput v-model="form.userName" disabled />
              </ElFormItem>
              <ElFormItem label="状态" prop="status" class="ml-5">
                <ElInput :model-value="statusText" disabled />
              </ElFormItem>
            </ElRow>
            <ElRow>
              <ElFormItem label="手机号" prop="phone">
                <ElInput v-model="form.phone" :disabled="!isEdit" placeholder="请输入手机号" />
              </ElFormItem>
              <ElFormItem label="邮箱" prop="email" class="ml-5">
                <ElInput v-model="form.email" :disabled="!isEdit" />
              </ElFormItem>
            </ElRow>
            <ElFormItem label="描述" prop="description">
              <ElInput type="textarea" :rows="4" v-model="form.description" :disabled="!isEdit" placeholder="请输入个人描述" />
            </ElFormItem>
            <div class="flex-c justify-end [&_.el-button]:!w-27.5">
              <ElButton type="primary" class="w-22.5" v-ripple :loading="saving" @click="onSave">
                {{ isEdit ? '保存' : '编辑' }}
              </ElButton>
            </div>
          </ElForm>
        </div>

        <!-- 更改密码 -->
        <div class="art-card-sm my-5">
          <h1 class="p-4 text-xl font-normal border-b border-g-300">更改密码</h1>
          <ElForm ref="pwdFormRef" :model="pwdForm" :rules="pwdRules" class="box-border p-5" label-width="86px" label-position="top">
            <ElFormItem label="当前密码" prop="currentPassword">
              <ElInput
                v-model="pwdForm.currentPassword"
                type="password"
                :disabled="!isEditPwd"
                show-password
                placeholder="请输入当前密码"
                autocomplete="current-password"
              />
            </ElFormItem>
            <ElFormItem label="新密码" prop="newPassword">
              <ElInput
                v-model="pwdForm.newPassword"
                type="password"
                :disabled="!isEditPwd"
                show-password
                placeholder="至少8位，含大小写字母和数字"
                autocomplete="new-password"
              />
            </ElFormItem>
            <ElFormItem label="确认新密码" prop="confirmPassword">
              <ElInput v-model="pwdForm.confirmPassword" type="password" :disabled="!isEditPwd" show-password placeholder="请再次输入新密码" />
            </ElFormItem>
            <div class="flex-c justify-end [&_.el-button]:!w-27.5">
              <ElButton type="primary" class="w-22.5" v-ripple :loading="savingPwd" @click="onSavePwd">
                {{ isEditPwd ? '保存' : '编辑' }}
              </ElButton>
            </div>
          </ElForm>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useUserStore } from '@/store/modules/user'
  import type { FormInstance, FormRules } from 'element-plus'
  import defaultAvatar from '@imgs/user/default-avatar.svg'
  import { ElMessage } from 'element-plus'
  import { PixiuApiError } from '@/api/container'
  import {
    fetchUpdateUser,
    fetchChangePassword,
    fetchGetUserById,
    type PixiuUserProfile
  } from '@/api/system-manage'

  /** 展示接口错误（拦截器已提示过的不再重复弹出） */
  function showRequestError(e: unknown, fallback: string) {
    if (e instanceof PixiuApiError && e.notified) return
    ElMessage.error(e instanceof Error ? e.message : fallback)
  }

  defineOptions({ name: 'UserCenter' })

  const userStore = useUserStore()
  const userInfo = computed(() => userStore.getUserInfo)

  const isEdit = ref(false)
  const isEditPwd = ref(false)
  const saving = ref(false)
  const savingPwd = ref(false)
  const ruleFormRef = ref<FormInstance>()
  const pwdFormRef = ref<FormInstance>()
  const userResourceVersion = ref(0)
  const userRole = ref<number | undefined>(undefined)
  const userStatus = ref<number | undefined>(undefined)

  const greeting = computed(() => {
    const h = new Date().getHours()
    if (h >= 6 && h < 9) return '早上好'
    if (h >= 9 && h < 11) return '上午好'
    if (h >= 11 && h < 13) return '中午好'
    if (h >= 13 && h < 18) return '下午好'
    if (h >= 18 && h < 24) return '晚上好'
    return '很晚了，早点睡'
  })

  const roleText = computed(() => {
    if (userRole.value === 0) return '超级管理员'
    if (userRole.value === 1) return '管理员'
    return '普通用户'
  })

  const statusText = computed(() => {
    if (userStatus.value === 0) return '正常'
    if (userStatus.value === 1) return '禁用'
    return '未知'
  })

  const form = reactive({ userName: '', phone: '', email: '', description: '' })
  const pwdForm = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })

  const rules = reactive<FormRules>({
    email: [{ type: 'email', message: '请输入有效邮箱', trigger: 'blur' }],
    phone: [{ pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号格式', trigger: 'blur' }]
  })

  const pwdRules = reactive<FormRules>({
    currentPassword: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
    newPassword: [
      { required: true, message: '请输入新密码', trigger: 'blur' },
      { min: 6, message: '密码至少6位', trigger: 'blur' },
      { pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, message: '需包含大小写字母和数字', trigger: 'blur' }
    ],
    confirmPassword: [
      { required: true, message: '请确认新密码', trigger: 'blur' },
      { validator: (_r, val, cb) => { if (val !== pwdForm.newPassword) cb(new Error('两次密码不一致')); else cb() }, trigger: 'blur' }
    ]
  })

  function applyUserProfile(profile: PixiuUserProfile) {
    form.userName = profile.userName
    form.phone = profile.userPhone
    form.email = profile.userEmail
    form.description = profile.description
    userResourceVersion.value = profile.resourceVersion
    userRole.value = profile.role
    userStatus.value = profile.status
  }

  function syncUserStore(profile: PixiuUserProfile) {
    const current = userStore.getUserInfo
    const roleMap: Record<number, string> = { 0: 'R_SUPER', 1: 'R_ADMIN', 2: 'R_USER' }
    userStore.setUserInfo({
      ...current,
      userId: profile.id,
      userName: profile.userName,
      email: profile.userEmail,
      roles: [roleMap[profile.role] ?? 'R_USER'],
      buttons: current?.buttons ?? []
    } as Api.Auth.UserInfo)
  }

  async function loadUserInfo() {
    const u = userStore.getUserInfo
    if (!u?.userId) return
    try {
      const profile = await fetchGetUserById(Number(u.userId))
      applyUserProfile(profile)
      syncUserStore(profile)
    } catch {
      form.userName = u.userName || ''
      form.email = u.email || ''
    }
  }

  onMounted(() => { void loadUserInfo() })

  watch(userInfo, (info) => {
    if (info) {
      form.userName = info.userName || ''
      form.email = info.email || ''
    }
  }, { immediate: true })

  async function onSave() {
    if (isEdit.value) {
      if (!ruleFormRef.value) return
      try { await ruleFormRef.value.validate() } catch { return }
      saving.value = true
      try {
        const u = userStore.getUserInfo
        if (u?.userId) {
          await fetchUpdateUser({
            id: Number(u.userId),
            resourceVersion: userResourceVersion.value,
            phone: form.phone,
            email: form.email
          })
          await loadUserInfo()
        }
        ElMessage.success('保存成功')
        isEdit.value = false
      } catch (e: unknown) {
        showRequestError(e, '保存失败')
      }
      finally { saving.value = false }
    } else { isEdit.value = true }
  }

  async function onSavePwd() {
    if (isEditPwd.value) {
      if (!pwdFormRef.value) return
      try {
        await pwdFormRef.value.validate()
      } catch {
        return
      }
      const u = userStore.getUserInfo
      if (!u?.userId) {
        ElMessage.error('未获取到用户信息')
        return
      }
      savingPwd.value = true
      try {
        await fetchChangePassword({
          userId: Number(u.userId),
          currentPassword: pwdForm.currentPassword,
          newPassword: pwdForm.newPassword,
          resourceVersion: userResourceVersion.value
        })
        pwdForm.currentPassword = ''
        pwdForm.newPassword = ''
        pwdForm.confirmPassword = ''
        isEditPwd.value = false
        ElMessage.success('密码修改成功，请重新登录')
        userStore.logOut()
      } catch (e: unknown) {
        showRequestError(e, '修改密码失败')
      } finally {
        savingPwd.value = false
      }
    } else {
      isEditPwd.value = true
    }
  }
</script>

<style scoped>
  .user-center-avatar { box-shadow: 0 0 0 1px rgb(37 99 235 / 18%); }
</style>

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
        </div>
      </div>
      <div class="flex-1 overflow-hidden max-md:w-full max-md:mt-3.5">
        <!-- 基本设置 -->
        <div class="art-card-sm">
          <h1 class="p-4 text-xl font-normal border-b border-g-300">基本设置</h1>
          <ElForm ref="ruleFormRef" :model="form" :rules="rules" class="box-border p-5" label-width="86px" label-position="top">
            <ElRow>
              <ElFormItem label="用户名" prop="userName">
                <ElInput v-model="form.userName" disabled />
              </ElFormItem>
              <ElFormItem label="邮箱" prop="email" class="ml-5">
                <ElInput v-model="form.email" :disabled="!isEdit" />
              </ElFormItem>
            </ElRow>
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
            <ElFormItem label="当前密码" prop="old">
              <ElInput v-model="pwdForm.old" type="password" :disabled="!isEditPwd" show-password placeholder="请输入当前密码" />
            </ElFormItem>
            <ElFormItem label="新密码" prop="newPassword">
              <ElInput v-model="pwdForm.newPassword" type="password" :disabled="!isEditPwd" show-password placeholder="至少8位，含大小写字母和数字" />
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
  import { fetchUpdateUser, fetchChangePassword } from '@/api/system-manage'

  defineOptions({ name: 'UserCenter' })

  const userStore = useUserStore()
  const userInfo = computed(() => userStore.getUserInfo)

  const isEdit = ref(false)
  const isEditPwd = ref(false)
  const saving = ref(false)
  const savingPwd = ref(false)
  const ruleFormRef = ref<FormInstance>()
  const pwdFormRef = ref<FormInstance>()

  const greeting = computed(() => {
    const h = new Date().getHours()
    if (h >= 6 && h < 9) return '早上好'
    if (h >= 9 && h < 11) return '上午好'
    if (h >= 11 && h < 13) return '中午好'
    if (h >= 13 && h < 18) return '下午好'
    if (h >= 18 && h < 24) return '晚上好'
    return '很晚了，早点睡'
  })

  const form = reactive({ userName: '', email: '' })
  const pwdForm = reactive({ old: '', newPassword: '', confirmPassword: '' })

  const rules = reactive<FormRules>({
    email: [{ type: 'email', message: '请输入有效邮箱', trigger: 'blur' }]
  })

  const pwdRules = reactive<FormRules>({
    old: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
    newPassword: [
      { required: true, message: '请输入新密码', trigger: 'blur' },
      { min: 8, message: '密码至少8位', trigger: 'blur' },
      { pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, message: '需包含大小写字母和数字', trigger: 'blur' }
    ],
    confirmPassword: [
      { required: true, message: '请确认新密码', trigger: 'blur' },
      { validator: (_r, val, cb) => { if (val !== pwdForm.newPassword) cb(new Error('两次密码不一致')); else cb() }, trigger: 'blur' }
    ]
  })

  watch(userInfo, (info) => { if (info) { form.userName = info.userName || ''; form.email = info.email || '' } }, { immediate: true })

  async function onSave() {
    if (isEdit.value) {
      if (!ruleFormRef.value) return
      try { await ruleFormRef.value.validate() } catch { return }
      saving.value = true
      try {
        const u = userStore.getUserInfo
        if (u?.userId) await fetchUpdateUser({ id: Number(u.userId), resourceVersion: (u as any).resourceVersion ?? 0, email: form.email })
        userStore.setUserInfo({ ...userStore.getUserInfo, email: form.email } as Api.Auth.UserInfo)
        ElMessage.success('保存成功')
        isEdit.value = false
      } catch (e: unknown) { ElMessage.error(e instanceof Error ? e.message : '保存失败') }
      finally { saving.value = false }
    } else { isEdit.value = true }
  }

  async function onSavePwd() {
    if (isEditPwd.value) {
      if (!pwdFormRef.value) return
      try { await pwdFormRef.value.validate() } catch { return }
      savingPwd.value = true
      try {
        const u = userStore.getUserInfo
        if (!u?.userId) { ElMessage.error('未获取到用户信息'); return }
        await fetchChangePassword({ userId: Number(u.userId), old: pwdForm.old, new: pwdForm.newPassword })
        ElMessage.success('密码修改成功，请重新登录')
        pwdForm.old = ''; pwdForm.newPassword = ''; pwdForm.confirmPassword = ''
        isEditPwd.value = false
        userStore.logOut()
      } catch (e: unknown) { ElMessage.error(e instanceof Error ? e.message : '修改失败') }
      finally { savingPwd.value = false }
    } else { isEditPwd.value = true }
  }
</script>

<style scoped>
  .user-center-avatar { box-shadow: 0 0 0 1px rgb(37 99 235 / 18%); }
</style>

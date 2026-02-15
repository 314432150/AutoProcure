<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import client, { unwrap } from '../api/client'
import { useAuthStore } from '../stores/auth'

const LAST_USERNAME_KEY = 'auth_last_username'
const LAST_PASSWORD_KEY = 'auth_last_password'
const REMEMBER_KEY = 'auth_remember'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({
  username: '',
  password: '',
})
const rememberMe = ref(localStorage.getItem(REMEMBER_KEY) === '1')
const loading = ref(false)

/** 提交登录表单并写入会话信息 */
const onSubmit = async () => {
  if (loading.value) return
  loading.value = true
  try {
    const resp = await client.post('/api/auth/login', form, { suppressError: true })
    const data = unwrap(resp)
    auth.setSession(data.token, data.user_info, rememberMe.value)
    localStorage.setItem(LAST_USERNAME_KEY, form.username)
    localStorage.setItem(LAST_PASSWORD_KEY, form.password)
    localStorage.setItem(REMEMBER_KEY, rememberMe.value ? '1' : '0')
    ElMessage.success('登录成功')
    router.push('/plans')
  } catch (error) {
    const payload = error?.response?.data
    const message = payload?.message || payload?.detail || error?.message || '登录失败'
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  form.username = localStorage.getItem(LAST_USERNAME_KEY) || ''
  form.password = localStorage.getItem(LAST_PASSWORD_KEY) || ''
})
</script>

<template>
  <!-- 组件说明：登录页面，负责账号认证与进入系统 -->
  <div class="login">
    <div class="login-card">
      <div class="login-head">
        <div class="login-mark">采购台</div>
        <div>
          <h1>自动采购</h1>
          <p>集中管理采购、规则与计划</p>
        </div>
      </div>
      <el-form label-position="top" class="login-form">
        <el-form-item label="账号">
          <el-input v-model="form.username" placeholder="请输入账号" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="请输入密码"
            @keyup.enter="onSubmit"
          />
        </el-form-item>
        <el-checkbox v-model="rememberMe">保持登录</el-checkbox>
        <el-button type="primary" size="large" :loading="loading" @click="onSubmit">登录</el-button>
      </el-form>
    </div>
    <div class="mobile-info-line">稳定 + 高效 + 可追溯</div>
    <div class="login-panel">
      <div class="panel-inner">
        <h2>今日任务</h2>
        <ul>
          <li>更新物料与单价</li>
          <li>检查品类采购规则</li>
          <li>生成月度采购清单</li>
        </ul>
        <div class="panel-chip">稳定 + 高效 + 可追溯</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
}

.login-card {
  padding: 64px 80px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: var(--card);
}

.login-head {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-bottom: 32px;
}

.login-mark {
  width: 60px;
  height: 60px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  background: linear-gradient(145deg, #ffd56a, #ff8f52);
  font-weight: 700;
  color: #2a1f0f;
}

.login-card h1 {
  margin: 0;
  font-size: 28px;
}

.login-card p {
  margin: 6px 0 0;
  color: var(--muted);
}

.login-form {
  display: grid;
  gap: 18px;
  max-width: 360px;
}

.login-panel {
  background: radial-gradient(circle at top left, rgba(255, 212, 120, 0.6), transparent 55%),
    linear-gradient(145deg, #1c1c1a, #2e2b26);
  color: #f8f6f0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
}

.panel-inner {
  max-width: 360px;
}

.panel-inner h2 {
  font-size: 22px;
  margin-bottom: 12px;
}

.panel-inner ul {
  padding-left: 20px;
  line-height: 1.8;
  color: #e5e1d6;
}

.panel-chip {
  margin-top: 24px;
  display: inline-block;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  font-size: 12px;
}

.mobile-task {
  display: none;
}

.mobile-info-line {
  display: none;
}

@media (max-width: 960px) {
  .login {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100dvh;
    padding: 16px 16px calc(64px + env(safe-area-inset-bottom));
    position: relative;
    overflow: hidden;
    background:
      radial-gradient(120% 88% at 4% 6%, rgba(171, 143, 78, 0.72) 0%, rgba(171, 143, 78, 0.38) 35%, rgba(171, 143, 78, 0.12) 62%, rgba(171, 143, 78, 0) 76%),
      linear-gradient(165deg, #2a2a29 0%, #232321 55%, #1f1f1e 100%);
  }

  .login-card {
    width: min(100%, 560px);
    padding: 22px 20px 18px;
    justify-content: flex-start;
    align-self: auto;
    min-height: 0;
    height: fit-content;
    border-radius: 18px;
    background:
      linear-gradient(135deg, rgba(255, 248, 238, 0.96), rgba(255, 244, 228, 0.94)),
      var(--card);
    border: 1px solid rgba(201, 164, 74, 0.22);
    box-shadow: var(--shadow-md);
    backdrop-filter: blur(2px);
  }

  .login-head {
    margin-bottom: 18px;
  }

  .login-card h1 {
    font-size: 24px;
  }

  .login-mark {
    box-shadow: 0 8px 18px rgba(120, 72, 32, 0.14);
  }

  .login-form {
    max-width: 100%;
    gap: 12px;
  }

  .login-form .el-button {
    width: 100%;
  }

  .mobile-info-line {
    display: inline-flex;
    position: fixed;
    left: 50%;
    bottom: calc(20px + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    z-index: 20;
    max-width: calc(100vw - 28px);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 11px;
    letter-spacing: 0.2px;
    color: rgba(247, 241, 230, 0.96);
    background:
      radial-gradient(circle at 14% 25%, rgba(214, 178, 96, 0.26), rgba(214, 178, 96, 0) 60%),
      linear-gradient(135deg, rgba(73, 63, 44, 0.88), rgba(47, 43, 37, 0.86));
    border: 1px solid rgba(210, 174, 95, 0.42);
    box-shadow: 0 4px 10px rgba(15, 14, 13, 0.35), inset 0 1px 0 rgba(233, 203, 136, 0.32);
    backdrop-filter: blur(3px);
    pointer-events: none;
  }

  .login-panel {
    display: none;
  }
}
</style>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import client, { unwrap } from '../api/client'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({
  username: 'admin',
  password: 'admin123',
})
const loading = ref(false)

/** 提交登录表单并写入会话信息 */
const onSubmit = async () => {
  if (loading.value) return
  loading.value = true
  try {
    const resp = await client.post('/api/auth/login', form)
    const data = unwrap(resp)
    auth.setSession(data.token, data.user_info)
    ElMessage.success('登录成功')
    router.push('/products')
  } catch (error) {
    const payload = error?.response?.data
    const message = payload?.message || payload?.detail || error?.message || '登录失败'
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}
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
        <el-button type="primary" size="large" :loading="loading" @click="onSubmit">登录</el-button>
      </el-form>
    </div>
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

@media (max-width: 960px) {
  .login {
    grid-template-columns: 1fr;
  }
  .login-panel {
    min-height: 240px;
  }
}
</style>

<script setup>
import { Menu } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { ElMessageBox } from 'element-plus'

defineProps({
  showMenuButton: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['toggle-menu'])

const router = useRouter()
const auth = useAuthStore()

/** 退出登录并跳转到登录页 */
const onLogout = async () => {
  await ElMessageBox.confirm('确定要退出登录吗？', '退出登录', {
    confirmButtonText: '退出',
    cancelButtonText: '取消',
    type: 'warning',
  })
  auth.clearSession()
  router.push('/login')
}
</script>

<template>
  <!-- 组件说明：顶部栏，展示品牌与当前用户操作 -->
  <header class="topbar">
    <div class="topbar-left">
      <el-button
        v-if="showMenuButton"
        class="menu-toggle"
        circle
        plain
        @click="emit('toggle-menu')"
      >
        <el-icon><Menu /></el-icon>
      </el-button>
      <div class="brand-row">
      <h1 class="brand">采购自动化管理</h1>
      <slot name="extra-actions" />
      </div>
    </div>
    <div class="topbar-actions">
      <div class="user-badge">
        <strong class="user-name">{{ auth.user?.full_name || '管理员' }}</strong>
      </div>
      <el-button type="primary" plain @click="onLogout">退出</el-button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 18px 24px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(212, 181, 110, 0.16), rgba(196, 0, 0, 0.06));
  border: 1px solid rgba(212, 181, 110, 0.2);
  box-shadow: var(--shadow-md);
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.menu-toggle {
  flex: 0 0 auto;
}

.brand {
  margin: 0;
  font-size: 22px;
  letter-spacing: 0.5px;
}

.brand-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-sub {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--muted);
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-badge {
  background: var(--chip);
  padding: 6px 12px;
  border-radius: 999px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.user-label {
  font-size: 11px;
  color: var(--muted);
}

.user-name {
  font-size: 14px;
  color: var(--ink);
}

@media (max-width: 1180px) {
  .topbar {
    padding: 14px 16px;
    gap: 12px;
  }

  .brand {
    font-size: 18px;
  }

  .topbar-actions {
    gap: 10px;
  }

  .user-badge {
    padding: 4px 10px;
  }
}

@media (max-width: 768px) {
  .topbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .topbar-left {
    width: 100%;
  }

  .brand-row {
    min-width: 0;
    flex-wrap: wrap;
  }

  .topbar-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>

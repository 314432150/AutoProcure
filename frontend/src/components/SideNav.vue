<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

defineProps({
  mobile: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['select'])

const route = useRoute()
const router = useRouter()

const menuItems = [
  { name: '计划生成', path: '/plans', desc: '月度采购清单' },
  { name: '产品库', path: '/products', desc: '基础物料与单价' },
  { name: '品类库', path: '/categories', desc: '品类维护与作废' },
  { name: '工作日', path: '/workdays', desc: '法定工作日查询' },
  { name: '用户信息', path: '/user', desc: '账号资料' },
]

/** 切换左侧导航并跳转路由 */
const onSelect = (path) => {
  router.push(path)
  emit('select', path)
}

const activeMenu = computed(() => {
  if (route.path.startsWith('/plans/')) {
    return '/plans'
  }
  return route.path
})
</script>

<template>
  <!-- 组件说明：侧边导航栏，用于切换业务模块 -->
  <aside class="sidenav" :class="{ 'sidenav--mobile': mobile }">
    <div class="sidenav-head">
      <div class="sidenav-badge">采</div>
      <div>
        <div class="sidenav-title">采购指挥台</div>
        <div class="sidenav-sub">核心流程概览</div>
      </div>
    </div>
    <el-menu class="sidenav-menu" :default-active="activeMenu" @select="onSelect">
      <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path">
        <div class="menu-row">
          <span class="menu-name">{{ item.name }}</span>
          <span class="menu-desc">{{ item.desc }}</span>
        </div>
      </el-menu-item>
    </el-menu>
  </aside>
</template>

<style scoped>
.sidenav {
  background: var(--card);
  border-radius: 20px;
  padding: 20px 16px;
  border: 1px solid rgba(201, 164, 74, 0.18);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
  position: sticky;
  top: 24px;
  align-self: start;
  overflow: auto;
}

.sidenav--mobile {
  position: static;
  top: auto;
  height: auto;
  min-height: 100%;
  border-radius: 14px;
}

.sidenav-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 8px;
}

.sidenav-badge {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: linear-gradient(145deg, var(--gold), var(--accent));
  display: grid;
  place-items: center;
  color: #2b1d12;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.sidenav-title {
  font-weight: 600;
  font-size: 16px;
}

.sidenav-sub {
  font-size: 12px;
  color: var(--muted);
  margin-top: 4px;
}

.sidenav-menu {
  border: none;
  background: transparent;
}

.sidenav-menu :deep(.el-menu-item) {
  height: auto;
  line-height: 1.2;
  padding: 10px 12px;
  border-radius: 12px;
  margin: 4px 0;
  align-items: flex-start;
}

.sidenav-menu :deep(.el-menu-item.is-active) {
  background: rgba(196, 0, 0, 0.12);
  color: var(--ink);
}

.sidenav-menu :deep(.el-menu-item:hover) {
  background: rgba(196, 0, 0, 0.08);
}

.sidenav-menu :deep(.el-menu-item .el-menu-item__content) {
  height: auto;
  line-height: 1.2;
  padding: 0;
}

.menu-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.menu-name {
  font-weight: 600;
}

.menu-desc {
  font-size: 12px;
  color: var(--muted);
}
</style>

<script setup>
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import SideNav from '../components/SideNav.vue'
import TopBar from '../components/TopBar.vue'
import { useTabsStore } from '../stores/tabs'

const route = useRoute()
const router = useRouter()
const tabsStore = useTabsStore()

const tabPanes = computed(() => tabsStore.tabs)
const cachedNames = computed(() => tabsStore.cachedNames)
const activeTab = computed({
  get: () => tabsStore.activePath || route.fullPath,
  set: (value) => tabsStore.setActive(value),
})

const resolveTitle = (routeInfo) => {
  if (routeInfo.name === 'PlanDetail' && routeInfo.params?.date) {
    const dateText = String(routeInfo.params.date)
    const shortDate = dateText.length >= 5 ? dateText.slice(5) : dateText
    return `计划 ${shortDate}`
  }
  return routeInfo.meta?.title || routeInfo.name || routeInfo.path
}

const resolveCacheName = (routeInfo) => {
  const matched = routeInfo.matched?.[routeInfo.matched.length - 1]
  const component = matched?.components?.default
  return component?.name || component?.__name || routeInfo.name
}

const syncTabFromRoute = () => {
  if (route.meta?.public) return
  tabsStore.addTab({
    path: route.fullPath,
    name: resolveCacheName(route),
    title: resolveTitle(route),
    closable: route.fullPath !== '/plans',
  })
}

const onTabClick = (tab) => {
  if (tab?.props?.name && tab.props.name !== route.fullPath) {
    router.push(tab.props.name)
  }
}

const onTabRemove = async (targetPath) => {
  if (!targetPath) return
  if (tabsStore.isDirty(targetPath)) {
    try {
      await ElMessageBox.confirm(
        '该页面存在未保存数据，关闭将丢失。是否继续？',
        '未保存数据',
        { type: 'warning', confirmButtonText: '继续关闭', cancelButtonText: '取消' },
      )
    } catch {
      return
    }
  }
  tabsStore.markClosing(targetPath)
  const idx = tabsStore.tabs.findIndex((item) => item.path === targetPath)
  tabsStore.removeTab(targetPath)
  if (route.fullPath === targetPath) {
    const next = tabsStore.tabs[idx - 1] || tabsStore.tabs[idx] || tabsStore.tabs[0]
    if (next?.path) {
      router.push(next.path)
    }
  }
  setTimeout(() => {
    tabsStore.clearClosing(targetPath)
  }, 0)
}


watch(
  () => route.fullPath,
  () => {
    syncTabFromRoute()
  },
  { immediate: true },
)
</script>

<template>
  <!-- 组件说明：后台布局，包含侧边栏、顶部栏与内容区 -->
  <div class="layout">
    <SideNav />
    <div class="layout-main">
      <TopBar />
      <div class="layout-tabs">
        <el-tabs
          v-model="activeTab"
          type="card"
          closable
          @tab-click="onTabClick"
          @tab-remove="onTabRemove"
        >
          <el-tab-pane
            v-for="item in tabPanes"
            :key="item.path"
            :name="item.path"
            :closable="item.closable !== false"
          >
            <template #label>
              <span class="tab-label">
                <span
                  class="tab-dirty"
                  :class="{ 'tab-dirty--on': tabsStore.isDirty(item.path) }"
                ></span>
                <span class="tab-text">{{ item.title }}</span>
              </span>
            </template>
          </el-tab-pane>
        </el-tabs>
      </div>
      <main class="layout-content">
        <router-view v-slot="{ Component, route: viewRoute }">
          <keep-alive :include="cachedNames">
            <component :is="Component" :key="viewRoute.fullPath" />
          </keep-alive>
        </router-view>
      </main>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 24px;
  padding: 24px;
  align-items: start;
  height: 100vh;
  overflow: hidden;
}

.layout-main {
  display: grid;
  grid-template-rows: auto auto 1fr;
  gap: 16px;
  min-height: 0;
  height: 100%;
}

.layout-tabs {
  padding: 0 4px;
}

.layout-tabs :deep(.el-tabs__header) {
  margin: 0;
  border: none;
}

.layout-tabs :deep(.el-tabs__nav-scroll) {
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
}

.layout-tabs :deep(.el-tabs__nav-scroll::-webkit-scrollbar) {
  height: 6px;
}

.layout-tabs :deep(.el-tabs__nav-scroll::-webkit-scrollbar-thumb) {
  background: rgba(201, 164, 74, 0.35);
  border-radius: 999px;
}

.layout-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.layout-tabs :deep(.el-tabs__nav-wrap) {
  position: relative;
}

.layout-tabs :deep(.el-tabs__nav-wrap)::before,
.layout-tabs :deep(.el-tabs__nav-wrap)::after {
  content: '';
  position: absolute;
  top: 8px;
  bottom: 8px;
  width: 18px;
  pointer-events: none;
  z-index: 2;
}

.layout-tabs :deep(.el-tabs__nav-wrap)::before {
  left: 2px;
  background: linear-gradient(90deg, rgba(255, 244, 228, 0.95), rgba(255, 244, 228, 0));
}

.layout-tabs :deep(.el-tabs__nav-wrap)::after {
  right: 2px;
  background: linear-gradient(270deg, rgba(255, 244, 228, 0.95), rgba(255, 244, 228, 0));
}

.layout-tabs :deep(.el-tabs__nav) {
  border: none;
  gap: 8px;
  padding: 6px;
  background: rgba(255, 255, 255, 0.65);
  border-radius: 14px;
  box-shadow: inset 0 0 0 1px rgba(201, 164, 74, 0.18);
}

.layout-tabs :deep(.el-tabs__item) {
  height: 32px;
  line-height: 32px;
  padding: 0 12px;
  border: none;
  border-radius: 999px;
  color: var(--muted);
  font-weight: 600;
  transition: all 0.2s ease;
}

.layout-tabs :deep(.el-tabs__item:hover) {
  color: var(--ink);
  background: rgba(196, 0, 0, 0.08);
}

.layout-tabs :deep(.el-tabs__item.is-active) {
  color: #3a1a10;
  background: linear-gradient(135deg, #fff1dc 0%, #ffd8b5 100%);
  box-shadow: 0 6px 14px rgba(120, 72, 32, 0.15);
}

.layout-tabs :deep(.el-tabs__item .el-icon) {
  margin-left: 6px;
}

.layout-tabs :deep(.el-tabs__item .el-icon svg) {
  color: inherit;
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tab-text {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-dirty {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: transparent;
  box-shadow: none;
}

.tab-dirty--on {
  background: #e24a37;
  box-shadow: 0 0 0 2px rgba(226, 74, 55, 0.15);
}

.layout-tabs :deep(.el-tabs__item .el-icon.is-icon-close) {
  opacity: 0;
  transition: opacity 0.2s ease;
}

.layout-tabs :deep(.el-tabs__item:hover .el-icon.is-icon-close),
.layout-tabs :deep(.el-tabs__item.is-active .el-icon.is-icon-close) {
  opacity: 1;
}

.layout-content {
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
  display: flex;
  flex-direction: column;
}

@media (max-width: 1100px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>

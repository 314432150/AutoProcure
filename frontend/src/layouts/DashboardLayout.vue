<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import SideNav from '../components/SideNav.vue'
import TopBar from '../components/TopBar.vue'
import { useTabsStore } from '../stores/tabs'

const route = useRoute()
const router = useRouter()
const tabsStore = useTabsStore()
const ONBOARDING_DONE_KEY = 'autoprocure:onboarding:done:v1'
const MOBILE_BREAKPOINT = 1180

const guideVisible = ref(false)
const guideStep = ref(0)
const navDrawerOpen = ref(false)
const isMobile = ref(false)
const mobileTabsRef = ref(null)
const guideSteps = [
  {
    title: '先完善品类库',
    desc: '先在“品类库”建立可用品类，后续产品与计划会基于这些品类组织数据。',
    actionLabel: '去品类库',
    targetPath: '/categories',
  },
  {
    title: '再维护产品库',
    desc: '在“产品库”维护物料基础数据、单价与计量单位，支持新增与批量导入。',
    actionLabel: '去产品库',
    targetPath: '/products',
  },
  {
    title: '生成采购计划',
    desc: '进入“计划生成”选择月份后，系统会结合工作日自动安排计划；“工作日”页面主要用于查询确认。',
    actionLabel: '去计划生成',
    targetPath: '/plans',
  },
  {
    title: '引导完成',
    desc: '后续可通过顶部用户名旁的“新手引导”按钮随时重新查看这份引导。',
    actionLabel: '开始使用',
    targetPath: '/plans',
  },
]

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

const onMobileTabClick = (path) => {
  if (!path || path === route.fullPath) return
  router.push(path)
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

const scrollMobileActiveTabIntoView = () => {
  if (!isMobile.value) return
  nextTick(() => {
    const container = mobileTabsRef.value
    if (!container) return
    const active = container.querySelector('.mobile-tab-chip.is-active')
    if (!active || typeof active.scrollIntoView !== 'function') return
    active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  })
}

const openGuide = () => {
  guideStep.value = 0
  guideVisible.value = true
}

const updateViewportMode = () => {
  const viewportWidth = Math.round(window.visualViewport?.width || window.innerWidth)
  isMobile.value = viewportWidth <= MOBILE_BREAKPOINT
  if (!isMobile.value) {
    navDrawerOpen.value = false
  }
}

const onToggleMenu = () => {
  navDrawerOpen.value = !navDrawerOpen.value
}

const onSideNavSelect = () => {
  if (isMobile.value) {
    navDrawerOpen.value = false
  }
}

const finishGuide = () => {
  localStorage.setItem(ONBOARDING_DONE_KEY, '1')
  guideVisible.value = false
}

const openStepTarget = () => {
  const target = guideSteps[guideStep.value]?.targetPath
  if (target && target !== route.path) {
    router.push(target)
  }
  if (guideStep.value >= guideSteps.length - 1) {
    finishGuide()
  }
}

const nextGuideStep = () => {
  if (guideStep.value >= guideSteps.length - 1) {
    finishGuide()
    return
  }
  guideStep.value += 1
}

onMounted(() => {
  updateViewportMode()
  requestAnimationFrame(updateViewportMode)
  setTimeout(updateViewportMode, 0)
  window.addEventListener('resize', updateViewportMode)
  window.addEventListener('orientationchange', updateViewportMode)
  window.visualViewport?.addEventListener('resize', updateViewportMode)
  const isBot = Boolean(navigator.webdriver)
  const hasDone = localStorage.getItem(ONBOARDING_DONE_KEY) === '1'
  if (!isBot && !hasDone) {
    guideVisible.value = true
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewportMode)
  window.removeEventListener('orientationchange', updateViewportMode)
  window.visualViewport?.removeEventListener('resize', updateViewportMode)
})


watch(
  () => route.fullPath,
  () => {
    if (isMobile.value) {
      navDrawerOpen.value = false
    }
    syncTabFromRoute()
  },
  { immediate: true },
)

watch(
  () => [isMobile.value, route.fullPath, tabPanes.value.length],
  () => {
    scrollMobileActiveTabIntoView()
  },
)
</script>

<template>
  <!-- 组件说明：后台布局，包含侧边栏、顶部栏与内容区 -->
  <div class="layout" :class="{ 'layout--mobile': isMobile }">
    <SideNav v-if="!isMobile" />
    <el-drawer
      v-else
      v-model="navDrawerOpen"
      direction="ltr"
      size="280px"
      :with-header="false"
      class="layout-nav-drawer"
    >
      <SideNav mobile @select="onSideNavSelect" />
    </el-drawer>
    <div class="layout-main">
      <TopBar :show-menu-button="isMobile" @toggle-menu="onToggleMenu">
        <template #extra-actions>
          <el-button class="guide-entry" type="primary" @click="openGuide">新手引导</el-button>
        </template>
      </TopBar>
      <div class="layout-tabs">
        <el-tabs
          v-if="!isMobile"
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
        <div v-else ref="mobileTabsRef" class="mobile-tabs-strip">
          <button
            v-for="item in tabPanes"
            :key="item.path"
            type="button"
            class="mobile-tab-chip"
            :class="{ 'is-active': item.path === route.fullPath }"
            @click="onMobileTabClick(item.path)"
          >
            <span class="tab-dirty" :class="{ 'tab-dirty--on': tabsStore.isDirty(item.path) }"></span>
            <span class="tab-text">{{ item.title }}</span>
            <span
              v-if="item.closable !== false && item.path === route.fullPath"
              class="mobile-tab-close"
              @click.stop="onTabRemove(item.path)"
            >
              x
            </span>
          </button>
        </div>
      </div>
      <main class="layout-content">
        <router-view v-slot="{ Component, route: viewRoute }">
          <keep-alive :include="cachedNames">
            <component :is="Component" :key="viewRoute.fullPath" />
          </keep-alive>
        </router-view>
      </main>
    </div>
    <el-dialog
      v-model="guideVisible"
      :width="isMobile ? '92vw' : '560px'"
      align-center
      :close-on-click-modal="false"
      title="系统使用引导"
    >
      <div class="guide-body">
        <el-steps :active="guideStep" finish-status="success" simple>
          <el-step v-for="(item, idx) in guideSteps" :key="item.title" :title="`步骤 ${idx + 1}`" />
        </el-steps>
        <section class="guide-card">
          <h3>{{ guideSteps[guideStep].title }}</h3>
          <p>{{ guideSteps[guideStep].desc }}</p>
        </section>
      </div>
      <template #footer>
        <div class="guide-footer">
          <el-button @click="guideVisible = false">稍后再看</el-button>
          <el-button @click="openStepTarget">{{ guideSteps[guideStep].actionLabel }}</el-button>
          <el-button type="primary" @click="nextGuideStep">
            {{ guideStep >= guideSteps.length - 1 ? '完成引导' : '下一步' }}
          </el-button>
        </div>
      </template>
    </el-dialog>
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
  min-width: 0;
}

.layout-nav-drawer :deep(.el-drawer__body) {
  padding: 10px;
}

.layout-main {
  display: grid;
  grid-template-rows: auto auto 1fr;
  gap: 16px;
  min-height: 0;
  min-width: 0;
  height: 100%;
}

.layout-tabs {
  padding: 0 4px;
  min-width: 0;
  overflow: hidden;
}

.mobile-tabs-strip {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 4px 2px 8px;
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
}

.mobile-tabs-strip::-webkit-scrollbar {
  height: 4px;
}

.mobile-tab-chip {
  border: 1px solid rgba(201, 164, 74, 0.2);
  background: rgba(255, 255, 255, 0.78);
  color: var(--muted);
  border-radius: 999px;
  height: 34px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  scroll-snap-align: center;
  flex: 0 0 auto;
  max-width: 180px;
  cursor: pointer;
}

.mobile-tab-chip.is-active {
  color: #3a1a10;
  background: linear-gradient(135deg, #fff1dc 0%, #ffd8b5 100%);
  border-color: rgba(201, 164, 74, 0.45);
}

.mobile-tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  font-size: 12px;
  color: inherit;
  opacity: 0.85;
}

.layout-tabs :deep(.el-tabs) {
  min-width: 0;
}

.layout-tabs :deep(.el-tabs__header) {
  margin: 0;
  border: none;
  overflow: hidden;
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
  overflow: hidden;
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
  max-width: 120px;
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
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
  display: flex;
  flex-direction: column;
}

.guide-entry {
  border-radius: 999px;
}

.guide-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.guide-card {
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid rgba(201, 164, 74, 0.24);
  background: linear-gradient(145deg, rgba(255, 249, 240, 0.96), rgba(255, 238, 217, 0.9));
}

.guide-card h3 {
  margin: 0;
  font-size: 18px;
}

.guide-card p {
  margin: 10px 0 0;
  color: var(--muted);
}

.guide-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 1100px) {
  .layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 1180px) {
  .layout {
    padding: 12px;
    gap: 12px;
    height: 100dvh;
  }

  .layout-main {
    gap: 10px;
  }

  .layout-content {
    padding-right: 0;
  }

  .guide-footer {
    justify-content: stretch;
    flex-wrap: wrap;
  }
}
</style>

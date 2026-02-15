// 组件说明：路由配置与鉴权守卫
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

import DashboardLayout from '../layouts/DashboardLayout.vue'
import LoginView from '../views/LoginView.vue'
import ProductsView from '../views/ProductsView.vue'
import CategoriesView from '../views/CategoriesView.vue'
import PlansView from '../views/PlansView.vue'
import PlanDetailView from '../views/PlanDetailView.vue'
import WorkdaysView from '../views/WorkdaysView.vue'
import UserView from '../views/UserView.vue'
import NotFoundView from '../views/NotFoundView.vue'

const routes = [
  { path: '/login', component: LoginView, meta: { public: true } },
  {
    path: '/',
    component: DashboardLayout,
    children: [
      { path: '', redirect: '/plans' },
      { path: 'products', name: 'Products', component: ProductsView, meta: { title: '产品库', keepAlive: true } },
      { path: 'categories', name: 'Categories', component: CategoriesView, meta: { title: '品类库', keepAlive: true } },
      { path: 'plans', name: 'Plans', component: PlansView, meta: { title: '计划生成', keepAlive: true } },
      { path: 'plans/:date', name: 'PlanDetail', component: PlanDetailView, meta: { title: '计划详情', keepAlive: true } },
      { path: 'workdays', name: 'Workdays', component: WorkdaysView, meta: { title: '工作日', keepAlive: true } },
      { path: 'user', name: 'User', component: UserView, meta: { title: '用户信息', keepAlive: true } },
    ]
  },
  { path: '/:pathMatch(.*)*', component: NotFoundView, meta: { public: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

/** 注册路由守卫，未登录跳转到登录页 */
export const setupRouterGuards = (pinia) => {
  router.beforeEach((to) => {
    const auth = useAuthStore(pinia)
    if (to.path === '/login' && auth.isAuthed) {
      return { path: '/plans' }
    }
    if (to.meta.public) {
      return true
    }
    if (!auth.isAuthed) {
      return { path: '/login' }
    }
    return true
  })
}

export default router

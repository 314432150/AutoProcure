// 组件说明：认证状态管理，负责保存与清理登录信息
import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('auth_token') || '',
    user: JSON.parse(localStorage.getItem('auth_user') || 'null'),
  }),
  getters: {
    isAuthed: (state) => Boolean(state.token),
  },
  actions: {
    /** 写入登录令牌与用户信息到本地存储 */
    setSession(token, user) {
      this.token = token
      this.user = user
      localStorage.setItem('auth_token', token)
      localStorage.setItem('auth_user', JSON.stringify(user))
    },
    /** 清理登录信息并移除本地存储 */
    clearSession() {
      this.token = ''
      this.user = null
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
    },
  },
})

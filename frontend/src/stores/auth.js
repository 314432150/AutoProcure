// 组件说明：认证状态管理，负责保存与清理登录信息
import { defineStore } from 'pinia'

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'
const REMEMBER_KEY = 'auth_remember'
const readRemember = () => localStorage.getItem(REMEMBER_KEY) === '1'

const readToken = () => sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || ''

const readUser = () => {
  const raw = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY)
  return JSON.parse(raw || 'null')
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: readToken(),
    user: readUser(),
  }),
  getters: {
    isAuthed: (state) => Boolean(state.token),
  },
  actions: {
    /** 写入登录令牌与用户信息到本地存储 */
    setSession(token, user, remember = readRemember()) {
      this.token = token
      this.user = user
      const target = remember ? localStorage : sessionStorage
      const other = remember ? sessionStorage : localStorage
      target.setItem(TOKEN_KEY, token)
      target.setItem(USER_KEY, JSON.stringify(user))
      other.removeItem(TOKEN_KEY)
      other.removeItem(USER_KEY)
      localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0')
    },
    /** 清理登录信息并移除本地存储 */
    clearSession() {
      this.token = ''
      this.user = null
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      sessionStorage.removeItem(TOKEN_KEY)
      sessionStorage.removeItem(USER_KEY)
    },
  },
})

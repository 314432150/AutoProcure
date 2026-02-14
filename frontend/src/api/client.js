// 组件说明：前端 HTTP 客户端封装，统一注入令牌与错误处理
import axios from 'axios'
import { ElMessage } from 'element-plus'

const apiBase = import.meta.env.VITE_API_BASE || ''

const client = axios.create({
  baseURL: apiBase,
  timeout: 15000,
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem("auth_token")
      localStorage.removeItem("auth_user")
      if (window.location.pathname !== "/login") {
        window.location.href = "/login"
      }
      return Promise.reject(error)
    }
    if (error?.config?.suppressError) {
      return Promise.reject(error)
    }
    const payload = error?.response?.data
    const message = payload?.message || error.message || '请求失败'
    ElMessage.error(message)
    return Promise.reject(error)
  }
)

/** 解析统一响应结构并在失败时抛出错误 */
export const unwrap = (response) => {
  const payload = response?.data
  if (!payload || typeof payload.code !== 'number') {
    return payload
  }
  if (payload.code !== 2000) {
    const err = new Error(payload.message || '请求失败')
    err.payload = payload
    throw err
  }
  return payload.data
}

export default client

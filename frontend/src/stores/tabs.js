// 组件说明：可关闭多标签页状态管理
import { defineStore } from 'pinia'

export const useTabsStore = defineStore('tabs', {
  state: () => ({
    tabs: [],
    activePath: '',
    dirtyMap: {},
    cachedNames: [],
    closingPath: '',
  }),
  getters: {
    isDirty: (state) => (path) => Boolean(state.dirtyMap[path]),
  },
  actions: {
    setActive(path) {
      this.activePath = path
    },
    setDirty(path, dirty) {
      if (!path) return
      if (dirty) {
        this.dirtyMap[path] = true
      } else {
        delete this.dirtyMap[path]
      }
    },
    addTab(tab) {
      if (!tab?.path) return
      const exists = this.tabs.find((item) => item.path === tab.path)
      if (!exists) {
        this.tabs.push(tab)
      } else {
        exists.title = tab.title || exists.title
        exists.closable = tab.closable ?? exists.closable
        exists.name = tab.name || exists.name
      }
      this.activePath = tab.path
      if (tab.name && !this.cachedNames.includes(tab.name)) {
        this.cachedNames.push(tab.name)
      }
    },
    removeTab(path) {
      const target = this.tabs.find((item) => item.path === path)
      this.tabs = this.tabs.filter((item) => item.path !== path)
      if (this.activePath === path) {
        this.activePath = this.tabs.length ? this.tabs[this.tabs.length - 1].path : ''
      }
      delete this.dirtyMap[path]
      if (target?.name) {
        this.cachedNames = this.cachedNames.filter((name) => name !== target.name)
      }
    },
    markClosing(path) {
      this.closingPath = path || ''
    },
    clearClosing(path) {
      if (!path || this.closingPath === path) {
        this.closingPath = ''
      }
    },
  },
})

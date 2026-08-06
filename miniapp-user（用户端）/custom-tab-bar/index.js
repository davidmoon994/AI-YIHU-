const API_BASE = 'https://yihu.nnrike.ink'

Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '首页', iconKey: 'user-home', emoji: '🏠' },
      { pagePath: '/pages/ai/ai', text: 'AI问诊', iconKey: 'user-ai', emoji: '🤖' },
      { pagePath: '/pages/service/service', text: '服务', iconKey: 'user-service', emoji: '📋' },
      { pagePath: '/pages/mine/mine', text: '我的', iconKey: 'user-mine', emoji: '👤' }
    ]
  },

  lifetimes: {
    attached() {
      this.updateIcons()
    }
  },

  pageLifetimes: {
    show() {
      this.updateIcons()
    }
  },

  methods: {
    switchTab(e) {
      const idx = e.currentTarget.dataset.idx
      const item = this.data.list[idx]
      wx.switchTab({ url: item.pagePath })
    },

    updateIcons() {
      const app = getApp()
      const icons = app.globalData.icons || {}
      const list = this.data.list.map(item => ({
        ...item,
        iconNormal: icons[item.iconKey + '-normal'] ? API_BASE + icons[item.iconKey + '-normal'] : '',
        iconActive: icons[item.iconKey + '-active'] ? API_BASE + icons[item.iconKey + '-active'] : ''
      }))
      this.setData({ list })
    }
  }
})

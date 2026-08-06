const API_BASE = 'https://yihu.nnrike.ink'

Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages  home/home', text: '首页', iconKey: 'escort-home', emoji: '🏠' },
      { pagePath: '/pages  order/order', text: '接单', iconKey: 'escort-order', emoji: '📋' },
      { pagePath: '/pages  task/task', text: '任务', iconKey: 'escort-task', emoji: '✅' },
      { pagePath: '/pages  wallet/wallet', text: '钱包', iconKey: 'escort-wallet', emoji: '💰' }
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

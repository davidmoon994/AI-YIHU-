Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages  home/home', text: '首页', icon: '🏠' },
      { pagePath: '/pages  order/order', text: '接单', icon: '📋' },
      { pagePath: '/pages  task/task', text: '任务', icon: '✅' },
      { pagePath: '/pages  wallet/wallet', text: '钱包', icon: '💰' }
    ]
  },

  methods: {
    switchTab(e) {
      const idx = e.currentTarget.dataset.idx
      const item = this.data.list[idx]
      wx.switchTab({ url: item.pagePath })
    }
  }
})

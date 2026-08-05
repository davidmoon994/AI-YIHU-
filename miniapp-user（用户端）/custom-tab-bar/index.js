Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '首页', icon: '🏠' },
      { pagePath: '/pages/ai/ai', text: 'AI问诊', icon: '🤖' },
      { pagePath: '/pages/service/service', text: '服务', icon: '📋' },
      { pagePath: '/pages/mine/mine', text: '我的', icon: '👤' }
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

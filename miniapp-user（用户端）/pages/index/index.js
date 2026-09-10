const app = getApp()

Page({
  data: {
    isLogin: false,
    profile: null,

    // 家庭服务入口
    serviceEntries: [
      { type: 'medical_escort', icon: '🏥', label: '就医陪诊', desc: '专业人员陪同就医' },
      { type: 'elderly_care', icon: '👴', label: '老人陪护', desc: '陪伴照护更安心' },
      { type: 'child_care', icon: '🧒', label: '儿童托管', desc: '专业看护更放心' },
      { type: 'pet_care', icon: '🐾', label: '宠物托管', desc: '贴心照料您的爱宠' }
    ],

    // 近期订单
    recentOrders: [],
    hasActiveOrder: false,

    // 未读消息
    unreadCount: 0
  },

  onLoad() {
    this.autoLogin()
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    if (app.isLoggedIn()) {
      this.setData({ isLogin: true })
      this.loadProfile()
      this.loadRecentOrders()
      this.loadUnreadCount()
    }
  },

  onPullDownRefresh() {
    Promise.all([
      this.loadProfile(),
      this.loadRecentOrders(),
      this.loadUnreadCount()
    ]).then(() => wx.stopPullDownRefresh())
  },

  async autoLogin() {
    if (app.isLoggedIn()) {
      this.setData({ isLogin: true })
      this.loadProfile()
      this.loadRecentOrders()
    } else {
      try {
        await app.wxLogin()
        this.setData({ isLogin: true })
        this.loadProfile()
        this.loadRecentOrders()
      } catch (e) {
        console.error('autoLogin error', e)
      }
    }
  },

  async loadProfile() {
    try {
      const profile = await app.request({ url: '/user/profile' })
      this.setData({ profile })
    } catch (e) {
      console.error('loadProfile error', e)
    }
  },

  async loadRecentOrders() {
    try {
      const result = await app.request({
        url: '/order/list',
        data: { page: 1, pageSize: 3 }
      })
      const orders = result.list || []
      const activeStatuses = ['pending', 'paid', 'dispatching', 'assigned', 'accepted', 'arrived', 'serving']
      const hasActive = orders.some(o => activeStatuses.includes(o.order_status))
      this.setData({ recentOrders: orders, hasActiveOrder: hasActive })
    } catch (e) {
      console.error('loadRecentOrders error', e)
    }
  },

  async loadUnreadCount() {
    try {
      const result = await app.request({ url: '/message/list', data: { page: 1, pageSize: 1 } })
      this.setData({ unreadCount: result.total || 0 })
    } catch (e) {
      console.error('loadUnreadCount error', e)
    }
  },

  // 跳转服务页 - 预设服务类型
  goService(e) {
    const type = e.currentTarget.dataset.type || 'medical_escort'
    wx.navigateTo({ url: '/pages/service-detail/service-detail?type=' + encodeURIComponent(type) })
  },

  // 跳转AI问诊
  goAI() {
    wx.switchTab({ url: '/pages/ai/ai' })
  },

  // 跳转我的订单
  goOrders() {
    wx.switchTab({ url: '/pages/mine/mine' })
  },

  // 手动登录
  goLogin() {
    app.wxLogin().then(() => {
      this.setData({ isLogin: true })
      this.loadProfile()
      this.loadRecentOrders()
    }).catch(() => {
      wx.showToast({ title: '登录失败', icon: 'none' })
    })
  }
})

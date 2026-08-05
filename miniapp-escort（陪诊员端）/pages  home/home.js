const app = getApp()

Page({
  data: {
    online: false,
    profile: null,
    todayOrders: 0,
    todayIncome: 0,
    currentOrder: null,
    loading: false
  },

  onLoad() {
    if (!app.isLoggedIn()) {
      wx.showModal({
        title: '未登录',
        content: '请先登录后再使用',
        showCancel: false
      })
      return
    }
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    if (app.isLoggedIn()) {
      this.loadDashboard()
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadDashboard().then(() => wx.stopPullDownRefresh())
  },

  async loadDashboard() {
    this.setData({ loading: true })
    try {
      const data = await app.request({ url: '/escort/dashboard' })
      const profile = data.profile || {}
      this.setData({
        profile,
        todayOrders: data.todayOrders || 0,
        online: profile.status === 'online'
      })

      // 加载当前进行中的订单
      const orders = await app.request({ url: '/escort/orders/current' })
      if (orders && orders.length > 0) {
        this.setData({ currentOrder: orders[0] })
      } else {
        this.setData({ currentOrder: null })
      }
    } catch (e) {
      console.error('loadDashboard error', e)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 切换在线/离线状态
  async toggleOnline(e) {
    const newStatus = e.detail.value ? 'online' : 'offline'
    try {
      await app.request({
        url: '/escort/status',
        method: 'POST',
        data: { status: newStatus }
      })
      this.setData({ online: e.detail.value })
      wx.showToast({
        title: e.detail.value ? '已上线接单' : '已离线',
        icon: 'success'
      })
    } catch (err) {
      // 失败时恢复开关状态
      this.setData({ online: !e.detail.value })
    }
  },

  // 导航到接单列表
  goOrders() {
    wx.switchTab({ url: '/pages  order/order' })
  },

  // 导航到学习中心
  goLearn() {
    wx.navigateTo({ url: '/pages  learn/learn' })
  },

  // 导航到钱包
  goWallet() {
    wx.switchTab({ url: '/pages  wallet/wallet' })
  },

  // 上报位置（按钮触发或定时器）
  async reportLocation() {
    wx.getLocation({
      type: 'wgs84',
      success: async (res) => {
        try {
          await app.request({
            url: '/escort/location',
            method: 'POST',
            data: { latitude: res.latitude, longitude: res.longitude }
          })
          wx.showToast({ title: '位置已更新', icon: 'success' })
        } catch (e) {
          console.error('位置上报失败', e)
        }
      },
      fail() {
        wx.showToast({ title: '获取位置失败', icon: 'none' })
      }
    })
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录？',
      success: (res) => {
        if (res.confirm) {
          app.clearToken()
          wx.reLaunch({ url: '/pages  home/home' })
        }
      }
    })
  }
})

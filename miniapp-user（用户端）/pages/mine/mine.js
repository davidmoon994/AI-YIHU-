const app = getApp()

Page({
  data: {
    // 用户信息
    profile: null,
    isLogin: false,

    // 订单
    orders: [],
    orderStatus: '',   // 空=全部
    orderPage: 1,
    orderTotal: 0,
    orderLoading: false,
    hasMore: true,

    // 当前 Tab
    currentTab: 'orders', // orders | messages

    // 消息
    messages: [],
    msgPage: 1,
    msgTotal: 0,
    unreadCount: 0,

    // 状态映射
    statusMap: {
      pending: '待支付',
      paid: '已支付',
      dispatching: '派单中',
      assigned: '已指派',
      accepted: '已接单',
      arrived: '已到达',
      serving: '服务中',
      completed: '已完成',
      cancelled: '已取消',
      refund: '退款中',
      closed: '已关闭'
    },

    // 订单详情弹窗
    showDetail: false,
    orderDetail: null,
    detailLoading: false
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 })
    }
    this.checkLogin()
  },

  async checkLogin() {
    if (app.isLoggedIn()) {
      this.setData({ isLogin: true })
      this.loadProfile()
      this.loadOrders()
    } else {
      this.setData({ isLogin: false })
      // 尝试自动登录
      const ok = await app.ensureLogin()
      if (ok) {
        this.setData({ isLogin: true })
        this.loadProfile()
        this.loadOrders()
      }
    }
  },

  // ========== 用户信息 ==========
  async loadProfile() {
    try {
      const profile = await app.request({ url: '/user/profile' })
      this.setData({ profile })
      app.globalData.userInfo = profile
      wx.setStorageSync('user_info', profile)
    } catch (e) {
      console.error('loadProfile error', e)
    }
  },

  // ========== 订单列表 ==========
  async loadOrders(append = false) {
    if (this.data.orderLoading) return
    this.setData({ orderLoading: true })

    try {
      const params = {
        page: append ? this.data.orderPage + 1 : 1,
        pageSize: 10
      }
      if (this.data.orderStatus) {
        params.status = this.data.orderStatus
      }

      const result = await app.request({ url: '/order/list', data: params })
      const list = result.list || []
      const total = result.total || 0

      this.setData({
        orders: append ? this.data.orders.concat(list) : list,
        orderPage: params.page,
        orderTotal: total,
        hasMore: (params.page * 10) < total,
        orderLoading: false
      })
    } catch (e) {
      this.setData({ orderLoading: false })
      console.error('loadOrders error', e)
    }
  },

  // 状态筛选
  filterOrders(e) {
    const status = e.currentTarget.dataset.status || ''
    this.setData({ orderStatus: status, orders: [], orderPage: 1 })
    this.loadOrders()
  },

  // 加载更多
  loadMore() {
    if (this.data.hasMore && !this.data.orderLoading) {
      this.loadOrders(true)
    }
  },

  onPullDownRefresh() {
    this.loadOrders().then(() => wx.stopPullDownRefresh())
  },

  // ========== 订单详情 ==========
  async viewOrderDetail(e) {
    const orderId = e.currentTarget.dataset.id
    this.setData({ showDetail: true, detailLoading: true, orderDetail: null })

    try {
      const detail = await app.request({ url: '/order/detail', data: { orderId } })
      this.setData({ orderDetail: detail, detailLoading: false })
    } catch (e) {
      this.setData({ showDetail: false, detailLoading: false })
    }
  },

  closeDetail() {
    this.setData({ showDetail: false, orderDetail: null })
  },

  // ========== 订单操作 ==========
  cancelOrder(e) {
    const orderId = e.currentTarget.dataset.id
    wx.showModal({
      title: '取消订单',
      content: '确定要取消该订单吗？',
      editable: true,
      placeholderText: '请输入取消原因（选填）',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await app.request({
            url: '/order/cancel',
            method: 'POST',
            data: { orderId, reason: res.content || '' }
          })
          wx.showToast({ title: '订单已取消', icon: 'success' })
          this.loadOrders()
          this.setData({ showDetail: false })
        } catch (e) {
          console.error('cancelOrder error', e)
        }
      }
    })
  },

  async payOrder(e) {
    const orderId = e.currentTarget.dataset.id
    try {
      const payParams = await app.request({
        url: '/pay/create',
        method: 'POST',
        data: { orderId }
      })
      wx.requestPayment({
        ...payParams,
        success: () => {
          wx.showToast({ title: '支付成功', icon: 'success' })
          this.loadOrders()
          this.setData({ showDetail: false })
        },
        fail: () => {
          wx.showToast({ title: '支付取消', icon: 'none' })
        }
      })
    } catch (e) {
      console.error('payOrder error', e)
    }
  },

  async reorder(e) {
    const orderId = e.currentTarget.dataset.id
    try {
      await app.request({
        url: '/order/reorder',
        method: 'POST',
        data: { orderId }
      })
      wx.showToast({ title: '已重新下单', icon: 'success' })
      this.loadOrders()
    } catch (e) {
      console.error('reorder error', e)
    }
  },

  async deleteOrder(e) {
    const orderId = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除订单',
      content: '确定删除该订单吗？删除后不可恢复。',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await app.request({
            url: '/order/delete',
            method: 'DELETE',
            data: { orderId }
          })
          wx.showToast({ title: '已删除', icon: 'success' })
          this.loadOrders()
          this.setData({ showDetail: false })
        } catch (e) {
          console.error('deleteOrder error', e)
        }
      }
    })
  },

  async requestRefund(e) {
    const orderId = e.currentTarget.dataset.id
    wx.showModal({
      title: '申请退款',
      content: '确定要申请退款吗？',
      editable: true,
      placeholderText: '请输入退款原因',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await app.request({
            url: '/pay/refund',
            method: 'POST',
            data: { orderId, reason: res.content || '' }
          })
          wx.showToast({ title: '退款申请已提交', icon: 'success' })
          this.loadOrders()
          this.setData({ showDetail: false })
        } catch (e) {
          console.error('requestRefund error', e)
        }
      }
    })
  },

  // ========== 消息 ==========
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ currentTab: tab })
    if (tab === 'messages' && this.data.messages.length === 0) {
      this.loadMessages()
    }
  },

  async loadMessages() {
    try {
      const result = await app.request({
        url: '/message/list',
        data: { page: 1, pageSize: 20 }
      })
      const list = result.list || []
      const unread = list.filter(m => !m.is_read).length
      this.setData({ messages: list, msgTotal: result.total || 0, unreadCount: unread })
    } catch (e) {
      console.error('loadMessages error', e)
    }
  },

  async readAllMessages() {
    try {
      await app.request({ url: '/message/read/all', method: 'POST' })
      wx.showToast({ title: '全部已读', icon: 'success' })
      this.loadMessages()
    } catch (e) {
      console.error('readAll error', e)
    }
  },

  async deleteMessage(e) {
    const messageId = e.currentTarget.dataset.id
    try {
      await app.request({
        url: '/message/delete',
        method: 'DELETE',
        data: { messageId }
      })
      wx.showToast({ title: '已删除', icon: 'success' })
      this.loadMessages()
    } catch (e) {
      console.error('deleteMessage error', e)
    }
  },

  // ========== 其他 ==========
  goLogin() {
    app.wxLogin().then(() => {
      this.setData({ isLogin: true })
      this.loadProfile()
      this.loadOrders()
    }).catch(() => {
      wx.showToast({ title: '登录失败', icon: 'none' })
    })
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.clearToken()
          this.setData({ isLogin: false, profile: null, orders: [], messages: [] })
        }
      }
    })
  }
})

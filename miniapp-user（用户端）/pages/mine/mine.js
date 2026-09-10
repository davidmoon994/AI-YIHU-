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

    // 服务类型映射：仅用于前端展示，不改变现有 API 或数据库字段
    serviceTypeMap: {
      medical_escort: { label: '就医陪诊', icon: '🏥' },
      escort: { label: '就医陪诊', icon: '🏥' },
      elderly_care: { label: '老人陪护', icon: '👴' },
      child_care: { label: '儿童托管', icon: '🧒' },
      pet_care: { label: '宠物托管', icon: '🐾' },
      register: { label: '代办服务', icon: '📋' },
      pickup: { label: '接送服务', icon: '🚗' },
      planning: { label: '服务规划', icon: '📝' }
    },

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
    detailLoading: false,
    orderTimeline: []
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
      const rawList = result.list || []
      const list = await Promise.all(rawList.map(async order => {
        const normalized = this.normalizeOrder(order)
        try { const r = await app.request({ url: "/rating/detail", data: { orderId: order.id } }); normalized.hasRated = !!r.hasRated } catch (e) { normalized.hasRated = false }
        return normalized
      }))
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

  // 统一订单展示字段，兼容旧陪诊订单与新的家庭服务订单
  normalizeOrder(order) {
    const service = this.data.serviceTypeMap[order.service_type] || this.data.serviceTypeMap[order.serviceType] || { label: order.service_type || order.serviceType || '家庭服务', icon: '🏠' }
    const patient = order.patientName || order.patient_name || order.patient || ''
    const address = order.addressText || order.address_text || order.detailAddress || ''
    return {
      ...order,
      serviceLabel: service.label,
      serviceIcon: service.icon,
      serviceObjectLabel: order.serviceObjectLabel || order.object_label || '服务对象',
      serviceObjectName: order.serviceObjectName || order.object_name || patient || '未填写',
      serviceLocation: order.serviceLocation || order.location || address || '待确认'
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
    this.setData({ showDetail: true, detailLoading: true, orderDetail: null, orderTimeline: [] })

    try {
      const detail = await app.request({ url: '/order/detail', data: { orderId } })
      const normalized = this.normalizeOrder(detail)
      try { const rating = await app.request({ url: "/rating/detail", data: { orderId } }); normalized.hasRated = !!rating.hasRated; normalized.rating = rating.rating } catch (e) { normalized.hasRated = false }
      let orderTimeline = []
      try { const timeline = await app.request({ url: '/order/timeline', data: { orderId } }); orderTimeline = timeline.timeline || [] } catch (e) { console.error('timeline error', e) }
      this.setData({ orderDetail: normalized, orderTimeline, detailLoading: false })
    } catch (e) {
      this.setData({ showDetail: false, detailLoading: false })
    }
  },

  closeDetail() {
    this.setData({ showDetail: false, orderDetail: null, orderTimeline: [] })
  },

  // ========== 服务评价 ==========
  rateOrder(e) {
    const orderId = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/rating/rating?orderId=${orderId}` })
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

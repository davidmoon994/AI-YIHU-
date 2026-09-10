const app = getApp()

Page({
  data: {
    activeTab: 'waiting',
    waitingOrders: [],
    currentOrders: [],
    loading: false
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    if (app.isLoggedIn()) this.loadOrders()
    else app.goLogin()
  },

  onPullDownRefresh() {
    this.loadOrders().then(() => wx.stopPullDownRefresh())
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
  },

  async loadOrders() {
    if (app.isLoggedIn() == false) return
    this.setData({ loading: true })
    try {
      const [waiting, current] = await Promise.all([
        app.request({ url: '/escort/orders/waiting' }),
        app.request({ url: '/escort/orders/current' })
      ])

      // 为每个待接订单获取派单记录ID
      const waitingWithDispatch = await Promise.all(
        (waiting || []).map(async (order) => {
          try {
            const records = await app.request({
              url: '/dispatch/list',
              data: { orderId: order.id }
            })
            const pendingRecord = (records || []).find(
              r => r.response_status === 'pending' && r.dispatch_status === 'pushing'
            )
            return { ...order, dispatchRecordId: pendingRecord ? pendingRecord.id : null }
          } catch (e) {
            return { ...order, dispatchRecordId: null }
          }
        })
      )

      this.setData({
        waitingOrders: waitingWithDispatch,
        currentOrders: current || []
      })
    } catch (e) {
      console.error('loadOrders error', e)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 接单
  async acceptOrder(e) {
    if (app.isLoggedIn() == false) return
    const { id, recordid } = e.currentTarget.dataset
    if (!recordid) {
      wx.showToast({ title: '派单记录异常', icon: 'none' })
      return
    }

    wx.showModal({
      title: '确认接单',
      content: '确定接受此订单？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await app.request({
            url: '/escort/accept',
            method: 'POST',
            data: { dispatchRecordId: recordid }
          })
          wx.showToast({ title: '接单成功', icon: 'success' })
          this.loadOrders()
        } catch (e) {
          console.error('accept error', e)
        }
      }
    })
  },

  // 拒单
  async rejectOrder(e) {
    if (app.isLoggedIn() == false) return
    const { recordid } = e.currentTarget.dataset
    if (!recordid) return

    wx.showModal({
      title: '确认拒单',
      content: '拒绝后系统将重新派单给其他服务人员',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await app.request({
            url: '/escort/reject',
            method: 'POST',
            data: { dispatchRecordId: recordid }
          })
          wx.showToast({ title: '已拒绝', icon: 'success' })
          this.loadOrders()
        } catch (e) {
          console.error('reject error', e)
        }
      }
    })
  },

  // 格式化服务类型
  formatServiceType(type) {
    const map = { medical_escort: '就医陪诊', elderly_care: '老人陪护', child_care: '儿童托管', childcare: '儿童托管', pet_care: '宠物托管', escort: '陪诊', register: '代挂号', pickup: '接送', planning: 'AI规划' }
    return map[type] || type
  }
})

const app = getApp()

Page({
  data: {
    orders: [],
    loading: false
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    this.loadTasks()
  },

  onPullDownRefresh() {
    this.loadTasks().then(() => wx.stopPullDownRefresh())
  },

  async loadTasks() {
    this.setData({ loading: true })
    try {
      const orders = await app.request({ url: '/escort/orders/current' })
      this.setData({ orders: orders || [] })
    } catch (e) {
      console.error('loadTasks error', e)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 到达
  async arrive(e) {
    const orderId = e.currentTarget.dataset.id
    try {
      await app.request({
        url: '/escort/arrive',
        method: 'POST',
        data: { orderId }
      })
      wx.showToast({ title: '已标记到达', icon: 'success' })
      this.loadTasks()
    } catch (e) {
      console.error('arrive error', e)
    }
  },

  // 开始服务
  async startService(e) {
    const orderId = e.currentTarget.dataset.id
    wx.showModal({
      title: '开始服务',
      content: '确认开始为该订单提供服务？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await app.request({
            url: '/escort/start',
            method: 'POST',
            data: { orderId }
          })
          wx.showToast({ title: '服务已开始', icon: 'success' })
          this.loadTasks()
        } catch (e) {
          console.error('start error', e)
        }
      }
    })
  },

  // 完成服务
  async finishService(e) {
    const orderId = e.currentTarget.dataset.id
    wx.showModal({
      title: '完成服务',
      content: '确认服务已完成？建议上传服务照片作为凭证。',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await app.request({
            url: '/escort/finish',
            method: 'POST',
            data: { orderId }
          })
          wx.showToast({ title: '服务已完成', icon: 'success' })
          this.loadTasks()
        } catch (e) {
          console.error('finish error', e)
        }
      }
    })
  },

  // 上传服务照片
  async uploadPhoto(e) {
    const orderId = e.currentTarget.dataset.id
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0]
        wx.showLoading({ title: '上传中...' })
        wx.uploadFile({
          url: `${app.globalData.apiBase}/escort/upload`,
          filePath: tempFilePath,
          name: 'file',
          header: {
            'Authorization': `Bearer ${app.globalData.token}`
          },
          success: async (uploadRes) => {
            try {
              const data = JSON.parse(uploadRes.data)
              if (data.code === 0) {
                await app.request({
                  url: '/escort/finish',
                  method: 'POST',
                  data: { orderId, images: data.data.path }
                })
                wx.showToast({ title: '已完成并上传', icon: 'success' })
                this.loadTasks()
              } else {
                wx.showToast({ title: data.message || '上传失败', icon: 'none' })
              }
            } catch (err) {
              wx.showToast({ title: '解析失败', icon: 'none' })
            }
          },
          fail: () => {
            wx.showToast({ title: '上传失败', icon: 'none' })
          },
          complete: () => {
            wx.hideLoading()
          }
        })
      }
    })
  },

  // 获取状态按钮文字
  getStatusActions(status) {
    const map = {
      assigned: ['到达'],
      arrived: ['开始服务'],
      serving: ['完成服务', '上传照片']
    }
    return map[status] || []
  }
})

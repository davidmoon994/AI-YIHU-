const app = getApp()

Page({
  data: {
    totalIncome: 0,
    orderCount: 0,
    monthIncome: 0,
    monthOrderCount: 0,
    grossIncome: 0,
    platformFee: 0,
    settlementList: [],
    startDate: '',
    endDate: ''
  },

  onLoad() {
    // 默认查本月
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    this.setData({ startDate: monthStart, endDate: monthEnd })
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 })
    }
    this.loadIncome()
    this.loadTotalIncome()
  },

  async loadIncome() {
    try {
      const data = await app.request({
        url: '/escort/income',
        data: { startDate: this.data.startDate, endDate: this.data.endDate }
      })
      this.setData({
        monthIncome: data.totalIncome || 0,
        monthOrderCount: data.orderCount || 0,
        grossIncome: data.grossIncome || 0,
        platformFee: data.platformFee || 0,
        settlementList: data.list || []
      })
    } catch (e) {
      console.error('loadIncome error', e)
    }
  },

  async loadTotalIncome() {
    try {
      const data = await app.request({ url: '/escort/income', data: {} })
      this.setData({
        totalIncome: data.totalIncome || 0,
        orderCount: data.orderCount || 0,
        grossIncome: data.grossIncome || 0,
        platformFee: data.platformFee || 0
      })
    } catch (e) {
      console.error('loadTotalIncome error', e)
    }
  },

  onStartDateChange(e) {
    this.setData({ startDate: e.detail.value })
    this.loadIncome()
  },

  onEndDateChange(e) {
    this.setData({ endDate: e.detail.value })
    this.loadIncome()
  }
})

// 全局配置与工具函数
const API_BASE = 'https://your-server.com/api/v1'

App({
  globalData: {
    apiBase: API_BASE,
    token: ''
  },

  onLaunch() {
    // 从缓存恢复 token
    const token = wx.getStorageSync('escort_token')
    if (token) {
      this.globalData.token = token
    }
  },

  /**
   * 封装统一请求方法，自动携带 Authorization
   */
  request(options) {
    const { url, method = 'GET', data = {}, header = {} } = options
    return new Promise((resolve, reject) => {
      wx.request({
        url: url.startsWith('http') ? url : `${API_BASE}${url}`,
        method,
        data,
        header: {
          'Content-Type': 'application/json',
          'Authorization': this.globalData.token ? `Bearer ${this.globalData.token}` : '',
          ...header
        },
        success(res) {
          if (res.statusCode === 401) {
            wx.removeStorageSync('escort_token')
            wx.redirectTo({ url: '/pages  login/login' })
            return reject(new Error('登录已过期'))
          }
          if (res.data && res.data.code === 0) {
            resolve(res.data.data)
          } else {
            const msg = (res.data && res.data.message) || '请求失败'
            wx.showToast({ title: msg, icon: 'none' })
            reject(new Error(msg))
          }
        },
        fail(err) {
          wx.showToast({ title: '网络错误', icon: 'none' })
          reject(err)
        }
      })
    })
  },

  /**
   * 保存登录态
   */
  setToken(token) {
    this.globalData.token = token
    wx.setStorageSync('escort_token', token)
  },

  /**
   * 清除登录态
   */
  clearToken() {
    this.globalData.token = ''
    wx.removeStorageSync('escort_token')
  },

  isLoggedIn() {
    return !!this.globalData.token
  }
})

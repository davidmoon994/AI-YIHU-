// 全局配置与工具函数
const API_BASE = 'https://your-server.com/api/v1'

App({
  globalData: {
    apiBase: API_BASE,
    token: '',
    userInfo: null
  },

  onLaunch() {
    const token = wx.getStorageSync('user_token')
    if (token) {
      this.globalData.token = token
    }
    const userInfo = wx.getStorageSync('user_info')
    if (userInfo) {
      this.globalData.userInfo = userInfo
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
            wx.removeStorageSync('user_token')
            wx.removeStorageSync('user_info')
            // 跳回首页触发重新登录
            wx.switchTab({ url: '/pages/index/index' })
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
   * 微信登录
   */
  async wxLogin() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: async (loginRes) => {
          if (!loginRes.code) {
            wx.showToast({ title: '微信登录失败', icon: 'none' })
            return reject(new Error('wx.login failed'))
          }
          try {
            const data = await this.request({
              url: '/auth/login',
              method: 'POST',
              data: { code: loginRes.code }
            })
            this.setToken(data.token)
            if (data.user) {
              this.globalData.userInfo = data.user
              wx.setStorageSync('user_info', data.user)
            }
            resolve(data)
          } catch (e) {
            reject(e)
          }
        },
        fail: reject
      })
    })
  },

  /**
   * 确保已登录，未登录则自动登录
   */
  async ensureLogin() {
    if (this.isLoggedIn()) return true
    try {
      await this.wxLogin()
      return true
    } catch (e) {
      return false
    }
  },

  setToken(token) {
    this.globalData.token = token
    wx.setStorageSync('user_token', token)
  },

  clearToken() {
    this.globalData.token = ''
    this.globalData.userInfo = null
    wx.removeStorageSync('user_token')
    wx.removeStorageSync('user_info')
  },

  isLoggedIn() {
    return !!this.globalData.token
  }
})

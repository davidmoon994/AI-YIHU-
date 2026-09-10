const app = getApp()

Page({
  data: { phone: '', password: '', loading: false },
  onPhoneInput(e) { this.setData({ phone: e.detail.value }) },
  onPasswordInput(e) { this.setData({ password: e.detail.value }) },
  async submit() {
    const phone = (this.data.phone || '').trim()
    const password = this.data.password || ''
    if (!phone || !password) { wx.showToast({ title: '请输入手机号和密码', icon: 'none' }); return }
    if (this.data.loading) return
    this.setData({ loading: true })
    try {
      const result = await app.request({ url: '/escort/login', method: 'POST', data: { phone, password } })
      app.setToken(result.token)
      if (result.escort) wx.setStorageSync('escort_info', result.escort)
      wx.reLaunch({ url: '/pages/home/home' })
    } catch (e) {}
    finally { this.setData({ loading: false }) }
  }
})

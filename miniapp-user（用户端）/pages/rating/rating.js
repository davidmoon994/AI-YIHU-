const app = getApp()

const SERVICE_MAP = {
  medical_escort: '就医陪诊', escort: '就医陪诊', elderly_care: '老人陪护',
  child_care: '儿童托管', pet_care: '宠物托管'
}

Page({
  data: { orderId: '', serviceLabel: '家庭服务', score: 5, stars: [1,2,3,4,5], content: '', anonymous: false, submitting: false, hasRated: false },
  onLoad(options) {
    this.setData({ orderId: options.orderId || '' })
    this.loadRating()
  },
  async loadRating() {
    if (!this.data.orderId) return
    try {
      const result = await app.request({ url: '/rating/detail', data: { orderId: this.data.orderId } })
      this.setData({ serviceLabel: SERVICE_MAP[result.serviceType] || '家庭服务', hasRated: !!result.hasRated, score: result.rating?.score || 5, content: result.rating?.content || '', anonymous: !!result.rating?.anonymous })
    } catch (e) { console.error('loadRating error', e) }
  },
  chooseScore(e) { this.setData({ score: Number(e.currentTarget.dataset.score) }) },
  onContentInput(e) { this.setData({ content: e.detail.value }) },
  toggleAnonymous() { this.setData({ anonymous: !this.data.anonymous }) },
  async submit() {
    if (this.data.hasRated || this.data.submitting) return
    this.setData({ submitting: true })
    try {
      await app.request({ url: '/rating/create', method: 'POST', data: { orderId: this.data.orderId, score: this.data.score, content: this.data.content, anonymous: this.data.anonymous } })
      wx.showToast({ title: '评价成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 700)
    } catch (e) { console.error('submit rating error', e) }
    finally { this.setData({ submitting: false }) }
  }
})

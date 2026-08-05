const app = getApp()

Page({
  data: {
    courses: [],
    loading: false,
    showDetail: false,
    currentCourse: null
  },

  onLoad() {
    this.loadCourses()
  },

  onPullDownRefresh() {
    this.loadCourses().then(() => wx.stopPullDownRefresh())
  },

  async loadCourses() {
    this.setData({ loading: true })
    try {
      const list = await app.request({ url: '/escort/learning/list' })
      this.setData({ courses: list || [] })
    } catch (e) {
      console.error('loadCourses error', e)
    } finally {
      this.setData({ loading: false })
    }
  },

  async viewDetail(e) {
    const courseId = e.currentTarget.dataset.id
    try {
      const course = await app.request({
        url: '/escort/learning/detail',
        data: { courseId }
      })
      this.setData({ currentCourse: course, showDetail: true })
    } catch (e) {
      console.error('viewDetail error', e)
    }
  },

  closeDetail() {
    this.setData({ showDetail: false, currentCourse: null })
  },

  async finishCourse(e) {
    const courseId = e.currentTarget.dataset.id
    try {
      await app.request({
        url: '/escort/learning/finish',
        method: 'POST',
        data: { courseId }
      })
      wx.showToast({ title: '已完成学习', icon: 'success' })
      this.setData({ showDetail: false })
      this.loadCourses()
    } catch (e) {
      console.error('finishCourse error', e)
    }
  }
})

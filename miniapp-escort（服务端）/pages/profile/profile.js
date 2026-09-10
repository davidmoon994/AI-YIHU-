const app = getApp()

const SERVICE_OPTIONS = [
  { value: 'medical_escort', label: '就医陪诊', icon: '🏥' },
  { value: 'elderly_care', label: '老人陪护', icon: '👴' },
  { value: 'child_care', label: '儿童托管', icon: '🧒' },
  { value: 'pet_care', label: '宠物托管', icon: '🐾' }
]

Page({
  data: {
    profile: {},
    bio: '',
    experienceYears: 0,
    serviceArea: '',
    serviceOptions: [],
    selectedSkills: [],
    loading: false,
    saving: false
  },

  onLoad() {
    if (!app.isLoggedIn()) {
      app.goLogin()
      return
    }
    this.setData({ serviceOptions: SERVICE_OPTIONS })
    this.loadProfile()
  },

  async loadProfile() {
    this.setData({ loading: true })
    try {
      const data = await app.request({ url: '/escort/profile' })
      const selectedSkills = Array.isArray(data.skills) ? data.skills.map(item => item.service_type) : []
      this.setData({
        profile: data.profile || {},
        bio: data.profile?.bio || '',
        experienceYears: Number(data.profile?.experience_years || 0),
        serviceArea: data.profile?.service_area || '',
        selectedSkills
      })
    } catch (e) {
      console.error('loadProfile error', e)
    } finally {
      this.setData({ loading: false })
    }
  },

  onBioInput(e) {
    this.setData({ bio: e.detail.value })
  },

  onExperienceInput(e) {
    const value = Number(e.detail.value || 0)
    this.setData({ experienceYears: Math.max(0, Math.min(50, value)) })
  },

  onAreaInput(e) {
    this.setData({ serviceArea: e.detail.value })
  },

  toggleSkill(e) {
    const value = e.currentTarget.dataset.value
    const selected = [...this.data.selectedSkills]
    const index = selected.indexOf(value)
    if (index >= 0) selected.splice(index, 1)
    else selected.push(value)
    this.setData({ selectedSkills: selected })
  },

  getSkillStatus(value) {
    const item = (this.data.profile.skills || []).find(skill => skill.service_type === value)
    return item ? item.approval_status : 'none'
  },

  async save() {
    if (this.data.saving) return
    if (!this.data.selectedSkills.length) {
      wx.showToast({ title: '请至少选择一项服务能力', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    try {
      await app.request({
        url: '/escort/profile',
        method: 'PUT',
        data: {
          bio: this.data.bio.trim(),
          experienceYears: Number(this.data.experienceYears || 0),
          serviceArea: this.data.serviceArea.trim()
        }
      })

      await app.request({
        url: '/escort/skills',
        method: 'PUT',
        data: { skills: this.data.selectedSkills }
      })

      wx.showToast({ title: '资料已保存', icon: 'success' })
      setTimeout(() => this.loadProfile(), 500)
    } catch (e) {
      console.error('save profile error', e)
    } finally {
      this.setData({ saving: false })
    }
  }
})

const app = getApp()

Page({
  data: {
    // 服务类型选项
    serviceTypes: [
      { value: 'escort', label: '陪诊服务', icon: '🏥', desc: '专人陪同就医', price: '199元起' },
      { value: 'register', label: '代挂号', icon: '📋', desc: '专家号代办', price: '99元起' },
      { value: 'pickup', label: '接送服务', icon: '🚗', desc: '就医接送', price: '50元起' },
      { value: 'planning', label: '就医规划', icon: '📝', desc: 'AI定制方案', price: '29元起' }
    ],
    selectedType: 'escort',

    // 就诊人
    patients: [],
    selectedPatient: null,
    showPatientPicker: false,
    showPatientForm: false,
    newPatient: { name: '', phone: '', idCard: '', relation: 'self', gender: 'male' },

    // 地址
    addresses: [],
    selectedAddress: null,
    showAddressPicker: false,
    showAddressForm: false,
    newAddress: { receiverName: '', receiverPhone: '', province: '', city: '', district: '', detailAddress: '' },

    // 预约时间
    appointmentDate: '',
    appointmentTime: '',
    minDate: '',

    // 备注
    remark: '',

    // 提交
    submitting: false,
    step: 1  // 1=选服务 2=选就诊人 3=选地址时间 4=确认
  },

  onLoad() {
    // 设置最小日期为今天
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    this.setData({ minDate: `${y}-${m}-${d}` })
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    this.loadData()
  },

  async loadData() {
    if (!(await app.ensureLogin())) return
    this.loadPatients()
    this.loadAddresses()
  },

  // ========== 就诊人管理 ==========
  async loadPatients() {
    try {
      const list = await app.request({ url: '/patient/list' })
      this.setData({ patients: list || [] })
    } catch (e) {
      console.error('loadPatients error', e)
    }
  },

  openPatientPicker() {
    this.setData({ showPatientPicker: true })
  },

  selectPatient(e) {
    const idx = e.currentTarget.dataset.idx
    this.setData({
      selectedPatient: this.data.patients[idx],
      showPatientPicker: false
    })
  },

  openPatientForm() {
    this.setData({ showPatientPicker: false, showPatientForm: true })
  },

  onPatientInput(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail ? e.detail.value : e.currentTarget.dataset.value
    this.setData({ [`newPatient.${field}`]: value })
  },

  async savePatient() {
    const { name, phone } = this.data.newPatient
    if (!name) return wx.showToast({ title: '请输入姓名', icon: 'none' })
    try {
      const result = await app.request({
        url: '/patient/create',
        method: 'POST',
        data: this.data.newPatient
      })
      wx.showToast({ title: '添加成功', icon: 'success' })
      this.setData({
        showPatientForm: false,
        selectedPatient: result,
        newPatient: { name: '', phone: '', idCard: '', relation: 'self', gender: 'male' }
      })
      this.loadPatients()
    } catch (e) {
      console.error('savePatient error', e)
    }
  },

  closeOverlay() {
    this.setData({ showPatientPicker: false, showPatientForm: false, showAddressPicker: false, showAddressForm: false })
  },

  // ========== 地址管理 ==========
  async loadAddresses() {
    try {
      const list = await app.request({ url: '/address/list' })
      this.setData({ addresses: list || [] })
    } catch (e) {
      console.error('loadAddresses error', e)
    }
  },

  openAddressPicker() {
    this.setData({ showAddressPicker: true })
  },

  selectAddress(e) {
    const idx = e.currentTarget.dataset.idx
    this.setData({
      selectedAddress: this.data.addresses[idx],
      showAddressPicker: false
    })
  },

  openAddressForm() {
    this.setData({ showAddressPicker: false, showAddressForm: true })
  },

  onAddressInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`newAddress.${field}`]: e.detail.value })
  },

  async saveAddress() {
    const { receiverName, receiverPhone, province, city, district, detailAddress } = this.data.newAddress
    if (!receiverName || !receiverPhone || !detailAddress) {
      return wx.showToast({ title: '请填写完整信息', icon: 'none' })
    }
    try {
      const result = await app.request({
        url: '/address/create',
        method: 'POST',
        data: this.data.newAddress
      })
      wx.showToast({ title: '添加成功', icon: 'success' })
      this.setData({
        showAddressForm: false,
        selectedAddress: result,
        newAddress: { receiverName: '', receiverPhone: '', province: '', city: '', district: '', detailAddress: '' }
      })
      this.loadAddresses()
    } catch (e) {
      console.error('saveAddress error', e)
    }
  },

  // ========== 服务类型选择 ==========
  selectServiceType(e) {
    this.setData({ selectedType: e.currentTarget.dataset.value })
  },

  // ========== 时间选择 ==========
  onDateChange(e) {
    this.setData({ appointmentDate: e.detail.value })
  },

  onTimeChange(e) {
    this.setData({ appointmentTime: e.detail.value })
  },

  // ========== 备注 ==========
  onRemarkInput(e) {
    this.setData({ remark: e.detail.value })
  },

  // ========== 步骤导航 ==========
  nextStep() {
    const { step, selectedPatient, selectedAddress, appointmentDate, appointmentTime } = this.data
    if (step === 1) {
      this.setData({ step: 2 })
    } else if (step === 2) {
      if (!selectedPatient) return wx.showToast({ title: '请选择就诊人', icon: 'none' })
      this.setData({ step: 3 })
    } else if (step === 3) {
      if (!selectedAddress) return wx.showToast({ title: '请选择地址', icon: 'none' })
      if (!appointmentDate || !appointmentTime) return wx.showToast({ title: '请选择预约时间', icon: 'none' })
      this.setData({ step: 4 })
    }
  },

  prevStep() {
    if (this.data.step > 1) {
      this.setData({ step: this.data.step - 1 })
    }
  },

  // ========== 提交订单 ==========
  async submitOrder() {
    const { selectedType, selectedPatient, selectedAddress, appointmentDate, appointmentTime, remark } = this.data
    this.setData({ submitting: true })

    try {
      const orderData = {
        serviceType: selectedType,
        patientId: selectedPatient.id,
        addressId: selectedAddress.id,
        appointmentTime: `${appointmentDate} ${appointmentTime}:00`,
        remark: remark
      }

      const result = await app.request({
        url: '/order/create',
        method: 'POST',
        data: orderData
      })

      wx.showToast({ title: '下单成功', icon: 'success' })

      // 询问是否立即支付
      wx.showModal({
        title: '下单成功',
        content: '是否立即支付？',
        confirmText: '去支付',
        cancelText: '稍后支付',
        success: (res) => {
          if (res.confirm && result.id) {
            this.payOrder(result.id)
          } else {
            // 跳转我的订单
            wx.switchTab({ url: '/pages/mine/mine' })
          }
        }
      })
    } catch (e) {
      console.error('submitOrder error', e)
    } finally {
      this.setData({ submitting: false })
    }
  },

  // 支付
  async payOrder(orderId) {
    try {
      const payParams = await app.request({
        url: '/pay/create',
        method: 'POST',
        data: { orderId }
      })

      // 调用微信支付
      wx.requestPayment({
        ...payParams,
        success() {
          wx.showToast({ title: '支付成功', icon: 'success' })
          wx.switchTab({ url: '/pages/mine/mine' })
        },
        fail() {
          wx.showToast({ title: '支付取消', icon: 'none' })
        }
      })
    } catch (e) {
      wx.showToast({ title: '支付发起失败', icon: 'none' })
    }
  },

  // 获取当前服务类型对象
  getCurrentType() {
    return this.data.serviceTypes.find(t => t.value === this.data.selectedType) || {}
  }
})

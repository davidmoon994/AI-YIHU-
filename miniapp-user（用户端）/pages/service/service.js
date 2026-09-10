const app = getApp()

const SERVICE_FORMS = {
  medical_escort: [
    { key: 'hospitalName', label: '医院名称', placeholder: '例如：市第一人民医院', required: true },
    { key: 'departmentName', label: '科室', placeholder: '例如：心内科', required: false },
    { key: 'serviceNeed', label: '服务需求', placeholder: '挂号、检查、取药、陪同等', required: true },
    { key: 'mobility', label: '行动情况', placeholder: '可独立行动 / 需搀扶 / 轮椅等', required: false }
  ],
  elderly_care: [
    { key: 'age', label: '老人年龄', placeholder: '例如：72岁', required: true },
    { key: 'careNeed', label: '陪护内容', placeholder: '陪伴、生活照料、外出陪同等', required: true },
    { key: 'healthCondition', label: '身体情况', placeholder: '请简要说明健康与行动情况', required: true },
    { key: 'specialAttention', label: '特殊注意事项', placeholder: '用药、饮食、禁忌等（选填）', required: false }
  ],
  child_care: [
    { key: 'age', label: '儿童年龄', placeholder: '例如：6岁', required: true },
    { key: 'careNeed', label: '托管需求', placeholder: '临时看护、接送、陪伴等', required: true },
    { key: 'guardianInfo', label: '监护人信息', placeholder: '姓名与联系电话', required: true },
    { key: 'specialAttention', label: '饮食/过敏/注意事项', placeholder: '请详细说明（选填）', required: false }
  ],
  pet_care: [
    { key: 'petType', label: '宠物种类/品种', placeholder: '例如：猫 / 金毛', required: true },
    { key: 'petAge', label: '宠物年龄', placeholder: '例如：3岁', required: true },
    { key: 'careNeed', label: '照料需求', placeholder: '喂养、遛宠、临时托管等', required: true },
    { key: 'feedingHabit', label: '喂食与习性', placeholder: '喂食时间、性格、禁忌等', required: true }
  ]
}

Page({
  data: {
    serviceTypes: [
      { value: 'medical_escort', label: '就医陪诊', icon: '🏥', desc: '专业人员陪同就医、检查与取药', price: '199元起' },
      { value: 'elderly_care', label: '老人陪护', icon: '👴', desc: '日常陪伴与照护服务', price: '199元起' },
      { value: 'child_care', label: '儿童托管', icon: '🧒', desc: '规范看护与临时托管', price: '159元起' },
      { value: 'pet_care', label: '宠物托管', icon: '🐾', desc: '喂养、陪伴与基础照料', price: '99元起' }
    ],
    selectedType: 'medical_escort', currentServiceLabel: '就医陪诊', currentSubjectLabel: '服务对象', subjectPlaceholder: '姓名',
    serviceFields: SERVICE_FORMS.medical_escort, serviceExtra: {},
    patients: [], selectedPatient: null, showPatientForm: false,
    newPatient: { name: '', phone: '', idCard: '', relation: 'self', gender: 'male' },
    addresses: [], selectedAddress: null, showAddressForm: false,
    newAddress: { receiverName: '', receiverPhone: '', province: '', city: '', district: '', detailAddress: '' },
    appointmentDate: '', appointmentTime: '', minDate: '', remark: '', submitting: false, step: 1
  },

  onLoad() {
    const now = new Date(); const y = now.getFullYear(); const m = String(now.getMonth()+1).padStart(2,'0'); const d = String(now.getDate()).padStart(2,'0')
    this.setData({ minDate: `${y}-${m}-${d}` })
    const savedType = wx.getStorageSync('selectedServiceType'); wx.removeStorageSync('selectedServiceType')
    if (savedType) this.selectServiceType({ currentTarget:{dataset:{value:savedType}} })
  },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) this.getTabBar().setData({ selected: 2 })
    const savedType = wx.getStorageSync('selectedServiceType'); wx.removeStorageSync('selectedServiceType')
    if (savedType) { this.selectServiceType({ currentTarget:{dataset:{value:savedType}} }); this.setData({step:1}) }
    this.loadData()
  },
  async loadData() { if (!(await app.ensureLogin())) return; this.loadPatients(); this.loadAddresses() },
  async loadPatients() { try { const list=await app.request({url:'/patient/list'}); this.setData({patients:list||[]}) } catch(e){console.error(e)} },
  async loadAddresses() { try { const list=await app.request({url:'/address/list'}); this.setData({addresses:list||[]}) } catch(e){console.error(e)} },

  selectServiceType(e) {
    const value=e.currentTarget.dataset.value; const item=this.data.serviceTypes.find(x=>x.value===value)||{}
    this.setData({ selectedType:value, currentServiceLabel:item.label||'', serviceFields:SERVICE_FORMS[value]||[], serviceExtra:{}, selectedPatient:null })
  },
  selectPatient(e) { this.setData({selectedPatient:this.data.patients[e.currentTarget.dataset.idx]}) },
  openPatientForm(){ this.setData({showPatientForm:true}) },
  onPatientInput(e){ const field=e.currentTarget.dataset.field; const value=e.detail ? e.detail.value : e.currentTarget.dataset.value; this.setData({[`newPatient.${field}`]:value}) },
  async savePatient(){
    const {name}=this.data.newPatient; if(!name) return wx.showToast({title:'请输入服务对象姓名',icon:'none'})
    try { const result=await app.request({url:'/patient/create',method:'POST',data:this.data.newPatient}); this.setData({showPatientForm:false,selectedPatient:result,newPatient:{name:'',phone:'',idCard:'',relation:'self',gender:'male'}}); this.loadPatients() } catch(e){console.error(e)}
  },
  selectAddress(e){ this.setData({selectedAddress:this.data.addresses[e.currentTarget.dataset.idx]}) },
  openAddressForm(){ this.setData({showAddressForm:true}) },
  onAddressInput(e){ this.setData({[`newAddress.${e.currentTarget.dataset.field}`]:e.detail.value}) },
  async saveAddress(){
    const a=this.data.newAddress; if(!a.receiverName||!a.receiverPhone||!a.detailAddress) return wx.showToast({title:'请填写联系人、电话和详细地址',icon:'none'})
    try { const result=await app.request({url:'/address/create',method:'POST',data:a}); this.setData({showAddressForm:false,selectedAddress:result,newAddress:{receiverName:'',receiverPhone:'',province:'',city:'',district:'',detailAddress:''}}); this.loadAddresses() } catch(e){console.error(e)}
  },
  onExtraInput(e){ this.setData({[`serviceExtra.${e.currentTarget.dataset.key}`]:e.detail.value}) },
  onDateChange(e){this.setData({appointmentDate:e.detail.value})}, onTimeChange(e){this.setData({appointmentTime:e.detail.value})}, onRemarkInput(e){this.setData({remark:e.detail.value})},
  nextStep(){
    const {step,selectedPatient,serviceFields,serviceExtra,selectedAddress,appointmentDate,appointmentTime}=this.data
    if(step===1) return this.setData({step:2})
    if(step===2){ if(!selectedPatient) return wx.showToast({title:'请选择服务对象',icon:'none'}); return this.setData({step:3}) }
    if(step===3){ const missing=serviceFields.find(f=>f.required&&!serviceExtra[f.key]); if(missing) return wx.showToast({title:`请填写${missing.label}`,icon:'none'}); return this.setData({step:4}) }
    if(step===4){ if(!selectedAddress) return wx.showToast({title:'请选择服务地址',icon:'none'}); if(!appointmentDate||!appointmentTime) return wx.showToast({title:'请选择预约时间',icon:'none'}); return this.setData({step:5}) }
  },
  prevStep(){if(this.data.step>1)this.setData({step:this.data.step-1})}, closeOverlay(){this.setData({showPatientForm:false,showAddressForm:false})},
  async submitOrder(){
    if(this.data.submitting)return; this.setData({submitting:true})
    const d=this.data; const detail={serviceType:d.selectedType,serviceName:d.currentServiceLabel,serviceDetails:d.serviceExtra,userRemark:d.remark}
    try {
      const result=await app.request({url:'/order/create',method:'POST',data:{serviceType:d.selectedType,patientId:d.selectedPatient.id,addressId:d.selectedAddress.id,appointmentTime:`${d.appointmentDate} ${d.appointmentTime}:00`,hospitalName:d.serviceExtra.hospitalName||null,departmentName:d.serviceExtra.departmentName||null,remark:JSON.stringify(detail)}})
      wx.showModal({title:'预约提交成功',content:`订单号：${result.orderNo||''}\n服务人员将尽快为您安排服务。`,showCancel:false,success:()=>wx.switchTab({url:'/pages/mine/mine'})})
    } catch(e){console.error(e)} finally {this.setData({submitting:false})}
  }
})

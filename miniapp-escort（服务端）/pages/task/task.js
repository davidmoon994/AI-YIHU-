const app = getApp()

const FLOW_MAP = {
  medical_escort: { icon:'🏥', label:'就医陪诊', steps:['确认服务','到达医院','开始陪诊','完成服务'], arrive:'确认到达医院', start:'开始陪诊', finish:'完成陪诊' },
  escort: { icon:'🏥', label:'就医陪诊', steps:['确认服务','到达医院','开始陪诊','完成服务'], arrive:'确认到达医院', start:'开始陪诊', finish:'完成陪诊' },
  elderly_care: { icon:'👴', label:'老人陪护', steps:['确认服务','到达地点','开始陪护','完成陪护'], arrive:'确认到达服务地点', start:'开始陪护', finish:'完成陪护' },
  child_care: { icon:'🧒', label:'儿童托管', steps:['确认服务','确认交接','开始托管','完成交接'], arrive:'确认儿童交接', start:'开始托管', finish:'确认完成交接' },
  pet_care: { icon:'🐾', label:'宠物托管', steps:['确认服务','确认接收','开始照料','完成交接'], arrive:'确认接收宠物', start:'开始照料', finish:'确认完成交接' }
}

Page({
  data:{ orders:[], loading:false },
  onShow(){
    if (typeof this.getTabBar === 'function' && this.getTabBar()) this.getTabBar().setData({ selected:2 })
    if (app.isLoggedIn()) this.loadTasks(); else app.goLogin()
  },
  onPullDownRefresh(){
    if (!app.isLoggedIn()) return wx.stopPullDownRefresh()
    this.loadTasks().then(()=>wx.stopPullDownRefresh())
  },
  async loadTasks(){
    if (!app.isLoggedIn()) return
    this.setData({loading:true})
    try{
      const orders=await app.request({url:'/escort/orders/current'})
      const enriched=await Promise.all((orders||[]).map(async o=>{try{return await app.request({url:'/escort/order/detail',data:{orderId:o.id}})}catch(e){return o}}))
      this.setData({orders:enriched.map(o=>this.normalizeTask(o))})
    }catch(e){ console.error('loadTasks error',e) }finally{ this.setData({loading:false}) }
  },
  normalizeTask(order){
    const key=order.service_type||order.serviceType||'medical_escort'
    const flow=FLOW_MAP[key]||{icon:'🏠',label:'家庭服务',steps:['确认服务','到达地点','开始服务','完成服务'],arrive:'确认到达',start:'开始服务',finish:'完成服务'}
    const status=order.order_status||order.status
    const activeIndex=status==='assigned'?0:status==='arrived'?1:status==='serving'?2:status==='completed'?3:0
    const confirmations=order.serviceConfirmations||[]
    const hasPre=confirmations.some(x=>x.confirm_stage==='pre_service')
    const hasHandover=confirmations.some(x=>x.confirm_stage==='handover_complete')
    const preText=hasPre?'服务前已确认':'服务前确认'
    const handoverRequired=['child_care','pet_care'].includes(key)
    return {...order, serviceIcon:flow.icon, serviceLabel:flow.label, flowSteps:flow.steps, activeIndex,
      arriveText:flow.arrive,startText:flow.start,finishText:flow.finish,
      objectName:order.object_name||order.patient_name||order.patientName||'待确认',
      objectPhone:order.object_phone||order.patient_phone||'',
      locationText:order.service_address||order.location||order.hospital_name||order.hospital||'待确认',
      hasPreConfirm:hasPre,hasHandoverConfirm:hasHandover,preConfirmText:preText,
      handoverRequired,handoverText:hasHandover?'交接已确认':'完成交接确认'}
  },
  async confirmStage(e){
    if (!app.isLoggedIn()) return
    const orderId=e.currentTarget.dataset.id
    const stage=e.currentTarget.dataset.stage
    const item=this.data.orders.find(o=>String(o.id)===String(orderId))||{}
    const key=item.service_type||item.serviceType||'medical_escort'
    const lists={
      medical_escort:['已核对医院/科室','已核对服务对象及联系电话','已确认陪诊需求及行动情况'],
      elderly_care:['已核对老人身份及联系电话','已了解陪护需求和身体情况','已确认特殊注意事项'],
      child_care:['已核对儿童及监护人信息','已完成儿童现场交接确认','已确认托管需求及注意事项'],
      pet_care:['已核对宠物品种及年龄','已完成宠物现场接收确认','已确认照料、喂食及习性要求']
    }
    const handover={
      child_care:['已将儿童安全、物品及状态向监护人说明','已完成儿童交接'],
      pet_care:['已将宠物状态、物品及注意事项向主人说明','已完成宠物交接']
    }
    const checklist=stage==='handover_complete'?(handover[key]||['已完成服务交接']):(lists[key]||['已核对服务对象','已核对服务地点和时间','已确认服务要求'])
    const title=stage==='handover_complete'?'完成交接确认':'服务前确认'
    wx.showModal({title,content:checklist.map((x,i)=>`${i+1}. ${x}`).join('\n')+'\n\n确认以上事项均已完成？',success:async r=>{
      if(!r.confirm)return
      try{await app.request({url:'/escort/confirm',method:'POST',data:{orderId,stage,checklist}});wx.showToast({title:'确认已记录',icon:'success'});this.loadTasks()}catch(err){console.error(err)}
    }})
  },
  async arrive(e){
    if (!app.isLoggedIn()) return
    const orderId=e.currentTarget.dataset.id
    const item=this.data.orders.find(o=>String(o.id)===String(orderId))||{}
    wx.showModal({title:item.arriveText||'确认到达',content:'确认已到达本次服务地点/交接地点？',success:async r=>{
      if(!r.confirm)return
      try{await app.request({url:'/escort/arrive',method:'POST',data:{orderId}});wx.showToast({title:'状态已更新',icon:'success'});this.loadTasks()}catch(err){console.error(err)}
    }})
  },
  async startService(e){
    if (!app.isLoggedIn()) return
    const orderId=e.currentTarget.dataset.id
    const item=this.data.orders.find(o=>String(o.id)===String(orderId))||{}
    wx.showModal({title:item.startText||'开始服务',content:'确认开始本次服务？',success:async r=>{
      if(!r.confirm)return
      try{await app.request({url:'/escort/start',method:'POST',data:{orderId}});wx.showToast({title:'服务已开始',icon:'success'});this.loadTasks()}catch(err){console.error(err)}
    }})
  },
  async finishService(e){
    if (!app.isLoggedIn()) return
    const orderId=e.currentTarget.dataset.id
    const item=this.data.orders.find(o=>String(o.id)===String(orderId))||{}
    wx.showModal({title:item.finishText||'完成服务',content:'请确认服务/交接已经完成。',success:async r=>{
      if(!r.confirm)return
      try{await app.request({url:'/escort/finish',method:'POST',data:{orderId}});wx.showToast({title:'服务已完成',icon:'success'});this.loadTasks()}catch(err){console.error(err)}
    }})
  },
  async uploadPhoto(e){
    if (!app.isLoggedIn()) return
    const orderId=e.currentTarget.dataset.id
    wx.chooseImage({count:1,sizeType:['compressed'],sourceType:['album','camera'],success:r=>{
      wx.showLoading({title:'上传中...'})
      wx.uploadFile({url:`${app.globalData.apiBase}/escort/upload`,filePath:r.tempFilePaths[0],name:'file',header:{Authorization:`Bearer ${app.globalData.token}`},success:async u=>{
        try{const data=JSON.parse(u.data);if(data.code===0){await app.request({url:'/escort/finish',method:'POST',data:{orderId,images:data.data.path}});wx.showToast({title:'已完成并上传',icon:'success'});this.loadTasks()}else wx.showToast({title:data.message||'上传失败',icon:'none'})}catch(err){wx.showToast({title:'上传结果解析失败',icon:'none'})}
      },fail:()=>wx.showToast({title:'上传失败',icon:'none'}),complete:()=>wx.hideLoading()})
    }})
  }
})

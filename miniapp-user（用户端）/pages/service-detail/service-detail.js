const SERVICES = {
  "medical_escort": {
    "icon": "🏥",
    "name": "就医陪诊",
    "slogan": "就医路上有人陪，流程更省心",
    "intro": "面向需要就医协助的人群，提供预约当天的陪同、流程指引与就医事务协助，让家属更安心。",
    "items": [
      "医院与院内路线指引",
      "挂号、取号与流程协助",
      "检查检验陪同",
      "取药与就医事务协助"
    ],
    "prepare": [
      "就诊人基本信息",
      "医院、科室或预约信息",
      "预计服务时间",
      "行动能力及特殊需求"
    ],
    "notice": "服务人员不提供诊断、处方或医疗决定。",
    "type": "medical_escort"
  },
  "elderly_care": {
    "icon": "👴",
    "name": "老人陪护",
    "slogan": "有人陪伴，有人照护，家人更放心",
    "intro": "为老人提供日常陪伴、生活协助与外出陪同等家庭服务，根据实际需求灵活预约。",
    "items": [
      "日常陪伴与聊天",
      "外出陪同",
      "生活事务协助",
      "家属需求沟通"
    ],
    "prepare": [
      "老人年龄与基本情况",
      "服务地点",
      "服务时间与时长",
      "需要重点关注的事项"
    ],
    "notice": "涉及医疗护理的专业服务需由具备相应资质人员提供。",
    "type": "elderly_care"
  },
  "child_care": {
    "icon": "🧒",
    "name": "儿童托管",
    "slogan": "临时照看更有安排，家长更安心",
    "intro": "针对家庭临时看护需求，提供预约式儿童照看与陪伴服务，帮助家长解决短时照护安排。",
    "items": [
      "临时陪伴与看护",
      "学习与活动陪伴",
      "饮食与作息提醒",
      "家长授权事项执行"
    ],
    "prepare": [
      "儿童年龄",
      "服务地点与时间",
      "饮食及过敏信息",
      "监护人联系方式"
    ],
    "notice": "服务需在合法、安全及明确监护授权范围内进行。",
    "type": "child_care"
  },
  "pet_care": {
    "icon": "🐾",
    "name": "宠物托管",
    "slogan": "主人暂时不在，也有人照顾它",
    "intro": "为家庭宠物提供预约式照料服务，包括喂食、陪伴、基础清洁与按要求照顾。",
    "items": [
      "按要求喂食饮水",
      "日常陪伴",
      "基础清洁照料",
      "按约定进行遛宠或活动"
    ],
    "prepare": [
      "宠物种类与品种",
      "宠物性格与习惯",
      "喂食与特殊要求",
      "服务时间与地点"
    ],
    "notice": "请提前说明宠物攻击性、疾病或其他特殊情况。",
    "type": "pet_care"
  }
}

Page({
  data:{ service:null, steps:['提交需求','确认时间地点','匹配服务人员','按约提供服务'] },
  onLoad(options){ const type=decodeURIComponent(options.type||'medical_escort'); this.setData({service:SERVICES[type]||SERVICES.medical_escort}) },
  goOrder(){ const type=this.data.service.type; wx.setStorageSync('selectedServiceType', type); wx.switchTab({url:'/pages/service/service'}) }
})

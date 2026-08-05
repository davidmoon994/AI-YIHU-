const app = getApp()

Page({
  data: {
    messages: [],           // 聊天记录 [{role:'user'|'ai', content:''}]
    inputText: '',          // 输入框文字
    sending: false,         // 发送中
    quickActions: [
      { label: '症状分析', icon: '🩺', type: 'chat', hint: '请描述您的症状，我来帮您初步分析' },
      { label: '科室推荐', icon: '🏥', type: 'department', hint: '请描述您的不适，我帮您推荐合适的科室' },
      { label: '就医规划', icon: '📋', type: 'planning', hint: '请告诉我您的就医需求，我帮您规划流程' },
      { label: '检查指引', icon: '🔬', type: 'check', hint: '请告诉我您要做的检查类型' }
    ],
    showQuickPanel: true,   // 显示快捷面板
    scrollToView: ''
  },

  onLoad() {
    this.addAiMessage('您好！我是AI健康助手，可以帮您进行症状分析、科室推荐、就医规划和检查指引。请问有什么可以帮您的？')
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
  },

  // 输入变化
  onInput(e) {
    this.setData({ inputText: e.detail.value })
  },

  // 发送消息
  async sendMsg() {
    const text = this.data.inputText.trim()
    if (!text || this.data.sending) return

    if (!(await app.ensureLogin())) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    this.addUserMessage(text)
    this.setData({ inputText: '', sending: true, showQuickPanel: false })

    try {
      const result = await app.request({
        url: '/ai/chat',
        method: 'POST',
        data: { message: text }
      })
      this.addAiMessage(result.reply || result.message || JSON.stringify(result))
    } catch (e) {
      this.addAiMessage('抱歉，请求出错了，请稍后再试。')
    } finally {
      this.setData({ sending: false })
      this.scrollToBottom()
    }
  },

  // 快捷操作
  async onQuickAction(e) {
    const { type, hint, label } = e.currentTarget.dataset
    this.setData({ showQuickPanel: false })

    if (!(await app.ensureLogin())) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    this.addUserMessage(label)
    this.setData({ sending: true })

    try {
      let result
      if (type === 'department') {
        // 先让用户描述
        this.addAiMessage('请描述您的不适症状，我将为您推荐合适的科室。\n\n您也可以直接点击下方输入框详细描述。')
        this.setData({ sending: false })
        this._nextAction = 'department'
        return
      } else if (type === 'planning') {
        this.addAiMessage('请描述您的就医需求（如：想挂某某医院某某科、需要做哪些检查等），我帮您规划就医流程。')
        this.setData({ sending: false })
        this._nextAction = 'planning'
        return
      } else if (type === 'check') {
        this.addAiMessage('请告诉我您想了解的检查类型（如：血常规、CT、核磁共振等），我为您提供检查指引。')
        this.setData({ sending: false })
        this._nextAction = 'check'
        return
      } else {
        result = await app.request({
          url: '/ai/chat',
          method: 'POST',
          data: { message: hint }
        })
      }
      this.addAiMessage(result.reply || result.message || JSON.stringify(result))
    } catch (e) {
      this.addAiMessage('抱歉，请求出错了，请稍后再试。')
    } finally {
      this.setData({ sending: false })
      this.scrollToBottom()
    }
  },

  // 智能发送 - 根据上下文路由到不同API
  async smartSend() {
    const text = this.data.inputText.trim()
    if (!text || this.data.sending) return

    if (!(await app.ensureLogin())) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    this.addUserMessage(text)
    this.setData({ inputText: '', sending: true })

    try {
      let url = '/ai/chat'
      let data = { message: text }

      if (this._nextAction === 'department') {
        url = '/ai/department'
        data = { description: text }
        this._nextAction = null
      } else if (this._nextAction === 'planning') {
        url = '/ai/planning'
        data = { description: text }
        this._nextAction = null
      } else if (this._nextAction === 'check') {
        url = '/ai/check'
        data = { checkType: text }
        this._nextAction = null
      }

      const result = await app.request({ url, method: 'POST', data })
      const content = result.reply || result.plan || result.department || result.message || JSON.stringify(result)
      this.addAiMessage(content)
    } catch (e) {
      this.addAiMessage('抱歉，请求出错了，请稍后再试。')
    } finally {
      this.setData({ sending: false })
      this.scrollToBottom()
    }
  },

  // 清空对话
  clearChat() {
    this.setData({
      messages: [],
      showQuickPanel: true,
      _nextAction: null
    })
    this.addAiMessage('对话已清空。请问有什么可以帮您的？')
  },

  // 辅助方法
  addUserMessage(text) {
    const messages = this.data.messages.concat([{ role: 'user', content: text }])
    this.setData({ messages })
    this.scrollToBottom()
  },

  addAiMessage(text) {
    const messages = this.data.messages.concat([{ role: 'ai', content: text }])
    this.setData({ messages })
    this.scrollToBottom()
  },

  scrollToBottom() {
    const len = this.data.messages.length
    if (len > 0) {
      this.setData({ scrollToView: `msg-${len - 1}` })
    }
  },

  // 复制AI回答
  copyAiReply(e) {
    const content = e.currentTarget.dataset.content
    wx.setClipboardData({ data: content })
  }
})

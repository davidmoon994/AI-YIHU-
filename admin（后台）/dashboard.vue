<template>
  <div class="dashboard">
    <h2>家庭服务平台运营总览</h2>

    <!-- 核心数据卡片 -->
    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-label">今日订单</div>
            <div class="stat-value">{{ data.todayOrders }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-label">今日收入</div>
            <div class="stat-value income">¥{{ data.todayIncome }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-label">在线服务人员</div>
            <div class="stat-value">{{ data.onlineEscorts }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-label">本月订单</div>
            <div class="stat-value">{{ data.monthOrders }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 扩展统计 -->
    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="8">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-label">累计总收入</div>
            <div class="stat-value income">¥{{ stats.totalIncome || 0 }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-label">累计总订单</div>
            <div class="stat-value">{{ stats.totalOrders || 0 }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-label">服务人员平均评分</div>
            <div class="stat-value">{{ escortStats.avgRating ? Number(escortStats.avgRating).toFixed(2) : '-' }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表区域 -->
    <el-row :gutter="20">
      <el-col :span="14">
        <el-card>
          <div slot="header"><b>订单趋势（近7日）</b></div>
          <div ref="orderChart" style="height: 320px;"></div>
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card>
          <div slot="header"><b>订单状态分布</b></div>
          <div ref="statusChart" style="height: 320px;"></div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import axios from 'axios'
import * as echarts from 'echarts'

const API_BASE = '/api/v1/admin'

export default {
  name: 'Dashboard',
  data() {
    return {
      data: {
        todayOrders: 0,
        todayIncome: 0,
        onlineEscorts: 0,
        monthOrders: 0
      },
      stats: { totalIncome: 0, totalOrders: 0 },
      escortStats: { avgRating: 0 },
      orderChartInstance: null,
      statusChartInstance: null
    }
  },
  async mounted() {
    await Promise.all([this.loadDashboard(), this.loadStats(), this.loadEscortStats()])
    this.initOrderChart()
    this.initStatusChart()
    window.addEventListener('resize', this.handleResize)
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.handleResize)
    if (this.orderChartInstance) this.orderChartInstance.dispose()
    if (this.statusChartInstance) this.statusChartInstance.dispose()
  },
  methods: {
    async loadDashboard() {
      try {
        const res = await axios.get(`${API_BASE}/dashboard`)
        this.data = res.data.data || {}
      } catch (e) {
        console.error('加载Dashboard失败', e)
      }
    },

    async loadStats() {
      try {
        const res = await axios.get(`${API_BASE}/statistics/payment`)
        this.stats = res.data.data || {}
      } catch (e) {
        console.error('加载统计失败', e)
      }
    },

    async loadEscortStats() {
      try {
        const res = await axios.get(`${API_BASE}/statistics/escort`)
        this.escortStats = res.data.data || {}
      } catch (e) {
        console.error('加载服务人员统计失败', e)
      }
    },

    initOrderChart() {
      if (!this.$refs.orderChart) return
      this.orderChartInstance = echarts.init(this.$refs.orderChart)

      // 生成近7天日期
      const days = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        days.push(`${d.getMonth() + 1}/${d.getDate()}`)
      }

      this.orderChartInstance.setOption({
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: days },
        yAxis: { type: 'value', name: '订单数' },
        series: [{
          name: '订单数',
          type: 'line',
          smooth: true,
          data: days.map(() => Math.floor(Math.random() * 20 + 5)),
          areaStyle: { opacity: 0.15 },
          itemStyle: { color: '#1677ff' }
        }],
        grid: { left: 50, right: 20, bottom: 30, top: 30 }
      })
    },

    initStatusChart() {
      if (!this.$refs.statusChart) return
      this.statusChartInstance = echarts.init(this.$refs.statusChart)

      this.statusChartInstance.setOption({
        tooltip: { trigger: 'item' },
        legend: { bottom: 0 },
        series: [{
          type: 'pie',
          radius: ['40%', '65%'],
          label: { show: true, formatter: '{b}: {c}' },
          data: [
            { value: 12, name: '待支付' },
            { value: 8, name: '派单中' },
            { value: 15, name: '已指派' },
            { value: 5, name: '服务中' },
            { value: 60, name: '已完成' },
            { value: 3, name: '已取消' }
          ]
        }]
      })
    },

    handleResize() {
      if (this.orderChartInstance) this.orderChartInstance.resize()
      if (this.statusChartInstance) this.statusChartInstance.resize()
    }
  }
}
</script>

<style scoped>
.dashboard { padding: 20px; }
.stat-card { text-align: center; padding: 10px 0; }
.stat-label { font-size: 14px; color: #909399; margin-bottom: 8px; }
.stat-value { font-size: 28px; font-weight: bold; color: #303133; }
.stat-value.income { color: #ff4d4f; }
</style>

<template>
  <div class="orders-page">
    <h2>订单管理</h2>

    <!-- 筛选栏 -->
    <el-row :gutter="16" style="margin-bottom: 16px;">
      <el-col :span="5">
        <el-input v-model="searchOrderNo" placeholder="搜索订单号" clearable @clear="loadList" @keyup.enter.native="loadList">
          <el-button slot="append" icon="el-icon-search" @click="loadList"></el-button>
        </el-input>
      </el-col>
      <el-col :span="4">
        <el-select v-model="filterStatus" placeholder="订单状态" clearable @change="loadList">
          <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
      </el-col>
      <el-col :span="4">
        <el-button type="primary" @click="loadList">刷新</el-button>
      </el-col>
    </el-row>

    <!-- 订单列表 -->
    <el-table :data="filteredBySearch" border stripe v-loading="loading" style="width: 100%;">
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="order_no" label="订单号" width="150" />
      <el-table-column prop="service_type" label="服务类型" width="90">
        <template slot-scope="{ row }">{{ serviceTypeMap[row.service_type] || row.service_type }}</template>
      </el-table-column>
      <el-table-column prop="hospital_name" label="医院" width="130" show-overflow-tooltip />
      <el-table-column prop="patient_name" label="就诊人" width="80" />
      <el-table-column label="金额" width="90">
        <template slot-scope="{ row }">¥{{ row.payable_amount }}</template>
      </el-table-column>
      <el-table-column label="支付状态" width="90">
        <template slot-scope="{ row }">
          <el-tag :type="payStatusType(row.payment_status)" size="small">{{ row.payment_status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="订单状态" width="100">
        <template slot-scope="{ row }">
          <el-tag :type="orderStatusType(row.order_status)" size="small">{{ statusLabel(row.order_status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="escort_id" label="陪诊员ID" width="90">
        <template slot-scope="{ row }">{{ row.escort_id || '-' }}</template>
      </el-table-column>
      <el-table-column label="预约时间" width="150">
        <template slot-scope="{ row }">{{ row.appointment_time || '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" min-width="260" fixed="right">
        <template slot-scope="{ row }">
          <el-button size="mini" @click="viewDetail(row)">详情</el-button>
          <el-button
            size="mini" type="warning"
            v-if="['dispatching','assigned'].includes(row.order_status)"
            @click="showManualDispatch(row)"
          >人工派单</el-button>
          <el-button
            size="mini" type="danger"
            v-if="['pending','dispatching','assigned'].includes(row.order_status)"
            @click="cancelOrder(row)"
          >取消</el-button>
          <el-button
            size="mini" type="info"
            v-if="row.payment_status === 'SUCCESS' && row.order_status !== 'completed'"
            @click="refundOrder(row)"
          >退款</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <el-pagination
      style="margin-top: 16px; text-align: right;"
      background layout="total, sizes, prev, pager, next"
      :total="total"
      :page-sizes="[10, 20, 50]"
      :page-size.sync="pageSize"
      :current-page.sync="page"
      @current-change="loadList"
      @size-change="() => { page = 1; loadList() }"
    />

    <!-- 订单详情弹窗 -->
    <el-dialog title="订单详情" :visible.sync="showDetailDialog" width="600px">
      <el-descriptions :column="2" border v-if="detailData">
        <el-descriptions-item label="订单号">{{ detailData.order_no }}</el-descriptions-item>
        <el-descriptions-item label="订单ID">{{ detailData.id }}</el-descriptions-item>
        <el-descriptions-item label="服务类型">{{ serviceTypeMap[detailData.service_type] || detailData.service_type }}</el-descriptions-item>
        <el-descriptions-item label="订单状态">{{ statusLabel(detailData.order_status) }}</el-descriptions-item>
        <el-descriptions-item label="支付状态">{{ detailData.payment_status }}</el-descriptions-item>
        <el-descriptions-item label="支付金额">¥{{ detailData.paid_amount }}</el-descriptions-item>
        <el-descriptions-item label="应付金额">¥{{ detailData.payable_amount }}</el-descriptions-item>
        <el-descriptions-item label="原始金额">¥{{ detailData.original_amount }}</el-descriptions-item>
        <el-descriptions-item label="医院">{{ detailData.hospital_name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="科室">{{ detailData.department_name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="就诊人">{{ detailData.patient_name }}</el-descriptions-item>
        <el-descriptions-item label="联系电话">{{ detailData.patient_phone || '-' }}</el-descriptions-item>
        <el-descriptions-item label="服务地址" :span="2">{{ detailData.service_address || '-' }}</el-descriptions-item>
        <el-descriptions-item label="预约时间">{{ detailData.appointment_time || '-' }}</el-descriptions-item>
        <el-descriptions-item label="陪诊员ID">{{ detailData.escort_id || '-' }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ detailData.remark || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ detailData.created_at }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ detailData.updated_at }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <!-- 人工派单弹窗 -->
    <el-dialog title="人工派单" :visible.sync="showDispatchDialog" width="500px">
      <p>为订单 <b>{{ dispatchTarget?.order_no }}</b> 指派陪诊员：</p>
      <el-input-number v-model="dispatchEscortId" :min="1" placeholder="陪诊员ID" style="width: 100%; margin-bottom: 12px;" />
      <el-alert title="请输入陪诊员ID后点击确认派单" type="info" :closable="false" />
      <span slot="footer">
        <el-button @click="showDispatchDialog = false">取 消</el-button>
        <el-button type="primary" :loading="dispatching" @click="doManualDispatch">确认派单</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import axios from 'axios'

const API_BASE = '/api/v1/admin'

const STATUS_MAP = {
  pending: '待支付', dispatching: '派单中', assigned: '已指派',
  arrived: '已到达', serving: '服务中', completed: '已完成',
  cancelled: '已取消', refund: '已退款', closed: '已关闭'
}

const SERVICE_TYPE_MAP = {
  escort: '陪诊', register: '代挂号', pickup: '接送', planning: 'AI规划'
}

export default {
  name: 'OrdersManage',
  data() {
    return {
      list: [],
      total: 0,
      page: 1,
      pageSize: 20,
      loading: false,
      searchOrderNo: '',
      filterStatus: '',
      statusOptions: Object.entries(STATUS_MAP).map(([value, label]) => ({ value, label })),
      serviceTypeMap: SERVICE_TYPE_MAP,

      showDetailDialog: false,
      detailData: null,

      showDispatchDialog: false,
      dispatchTarget: null,
      dispatchEscortId: null,
      dispatching: false
    }
  },
  computed: {
    filteredBySearch() {
      if (!this.searchOrderNo) return this.list
      return this.list.filter(o => o.order_no.includes(this.searchOrderNo))
    }
  },
  mounted() {
    this.loadList()
  },
  methods: {
    async loadList() {
      this.loading = true
      try {
        const res = await axios.get(`${API_BASE}/orders`, {
          params: { page: this.page, pageSize: this.pageSize, status: this.filterStatus || undefined }
        })
        const data = res.data.data
        this.list = data.list || []
        this.total = data.total || 0
      } catch (e) {
        this.$message.error('加载订单列表失败')
      } finally {
        this.loading = false
      }
    },

    async viewDetail(row) {
      try {
        const res = await axios.get(`${API_BASE}/orders/detail`, { params: { orderId: row.id } })
        this.detailData = res.data.data
        this.showDetailDialog = true
      } catch (e) {
        this.$message.error('获取订单详情失败')
      }
    },

    showManualDispatch(row) {
      this.dispatchTarget = row
      this.dispatchEscortId = null
      this.showDispatchDialog = true
    },

    async doManualDispatch() {
      if (!this.dispatchEscortId) return this.$message.warning('请输入陪诊员ID')
      this.dispatching = true
      try {
        await axios.post(`${API_BASE}/orders/manual-dispatch`, {
          orderId: this.dispatchTarget.id,
          escortId: this.dispatchEscortId
        })
        this.$message.success('人工派单成功')
        this.showDispatchDialog = false
        this.loadList()
      } catch (e) {
        this.$message.error('派单失败：' + (e.response?.data?.message || e.message))
      } finally {
        this.dispatching = false
      }
    },

    async cancelOrder(row) {
      try {
        await this.$confirm(`确定取消订单「${row.order_no}」？`, '警告', { type: 'warning' })
        await axios.post(`${API_BASE}/orders/cancel`, { orderId: row.id })
        this.$message.success('订单已取消')
        this.loadList()
      } catch (e) {
        if (e !== 'cancel') this.$message.error('取消失败')
      }
    },

    async refundOrder(row) {
      try {
        const { value: reason } = await this.$prompt('请输入退款原因', '退款确认', {
          inputValue: '后台发起退款',
          confirmButtonText: '确认退款',
          cancelButtonText: '取消'
        })
        await axios.post(`${API_BASE}/orders/refund`, { orderId: row.id, reason })
        this.$message.success('退款申请已提交')
        this.loadList()
      } catch (e) {
        if (e !== 'cancel') this.$message.error('退款失败')
      }
    },

    statusLabel(status) { return STATUS_MAP[status] || status },
    orderStatusType(status) {
      const map = { completed: 'success', cancelled: 'info', dispatching: 'warning', serving: '', pending: '' }
      return map[status] || ''
    },
    payStatusType(status) {
      const map = { SUCCESS: 'success', PAYING: 'warning', FAILED: 'danger', REFUNDED: 'info', REFUNDING: 'warning' }
      return map[status] || 'info'
    }
  }
}
</script>

<style scoped>
.orders-page { padding: 20px; }
</style>

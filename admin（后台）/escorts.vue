<template>
  <div class="escorts-page">
    <h2>服务人员管理</h2>

    <!-- 顶部操作栏 -->
    <el-row :gutter="16" style="margin-bottom: 16px;">
      <el-col :span="6">
        <el-input v-model="searchPhone" placeholder="搜索服务人员手机号" clearable @clear="loadList" @keyup.enter.native="loadList">
          <el-button slot="append" icon="el-icon-search" @click="loadList"></el-button>
        </el-input>
      </el-col>
      <el-col :span="4">
        <el-select v-model="filterStatus" placeholder="在线状态" clearable @change="loadList">
          <el-option label="在线" value="online" />
          <el-option label="离线" value="offline" />
        </el-select>
      </el-col>
      <el-col :span="14" style="text-align: right;">
        <el-button type="primary" icon="el-icon-plus" @click="showCreateDialog = true">新增服务人员</el-button>
      </el-col>
    </el-row>

    <!-- 服务人员列表 -->
    <el-table :data="list" border stripe v-loading="loading" style="width: 100%;">
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="name" label="姓名" width="100" />
      <el-table-column prop="phone" label="手机号" width="130" />
      <el-table-column prop="community_id" label="社区ID" width="80" />
      <el-table-column label="在线状态" width="100">
        <template slot-scope="{ row }">
          <el-tag :type="row.status === 'online' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="工作状态" width="100">
        <template slot-scope="{ row }">
          <el-tag :type="row.work_status === 'working' ? 'warning' : ''" size="small">{{ row.work_status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="rating" label="评分" width="80" />
      <el-table-column prop="total_orders" label="总单数" width="80" />
      <el-table-column prop="completed_orders" label="完成单" width="80" />
      <el-table-column label="创建时间" width="160">
        <template slot-scope="{ row }">{{ row.created_at }}</template>
      </el-table-column>
      <el-table-column label="操作" min-width="200" fixed="right">
        <template slot-scope="{ row }">
          <el-button size="mini" @click="viewDetail(row)">详情</el-button>
          <el-button size="mini" type="success" v-if="row.status !== 'online'" @click="approveEscort(row)">启用</el-button>
          <el-button size="mini" type="danger" @click="disableEscort(row)">禁用</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <el-pagination
      style="margin-top: 16px; text-align: right;"
      background
      layout="total, prev, pager, next"
      :total="total"
      :page-size="pageSize"
      :current-page.sync="page"
      @current-change="loadList"
    />

    <!-- 新增服务人员弹窗 -->
    <el-dialog title="新增服务人员" :visible.sync="showCreateDialog" width="500px" @close="resetForm">
      <el-form :model="form" label-width="90px">
        <el-form-item label="姓名" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="手机号" required>
          <el-input v-model="form.phone" />
        </el-form-item>
        <el-form-item label="社区ID" required>
          <el-input-number v-model="form.communityId" :min="1" />
        </el-form-item>
        <el-form-item label="初始密码">
          <el-input v-model="form.password" placeholder="默认 123456" />
        </el-form-item>
        <el-form-item label="性别">
          <el-radio-group v-model="form.gender">
            <el-radio :label="1">男</el-radio>
            <el-radio :label="2">女</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="身份证号">
          <el-input v-model="form.idCard" />
        </el-form-item>
      </el-form>
      <span slot="footer">
        <el-button @click="showCreateDialog = false">取 消</el-button>
        <el-button type="primary" :loading="submitting" @click="createEscort">确 定</el-button>
      </span>
    </el-dialog>

    <!-- 详情弹窗 -->
    <el-dialog title="服务人员详情" :visible.sync="showDetailDialog" width="500px">
      <el-descriptions :column="1" border v-if="detailData">
        <el-descriptions-item label="ID">{{ detailData.id }}</el-descriptions-item>
        <el-descriptions-item label="姓名">{{ detailData.name }}</el-descriptions-item>
        <el-descriptions-item label="手机号">{{ detailData.phone }}</el-descriptions-item>
        <el-descriptions-item label="性别">{{ detailData.gender === 1 ? '男' : detailData.gender === 2 ? '女' : '未知' }}</el-descriptions-item>
        <el-descriptions-item label="身份证号">{{ detailData.id_card || '-' }}</el-descriptions-item>
        <el-descriptions-item label="社区ID">{{ detailData.community_id }}</el-descriptions-item>
        <el-descriptions-item label="在线状态">{{ detailData.status }}</el-descriptions-item>
        <el-descriptions-item label="工作状态">{{ detailData.work_status }}</el-descriptions-item>
        <el-descriptions-item label="评分">{{ detailData.rating }}</el-descriptions-item>
        <el-descriptions-item label="总订单">{{ detailData.total_orders }}</el-descriptions-item>
        <el-descriptions-item label="已完成">{{ detailData.completed_orders }}</el-descriptions-item>
        <el-descriptions-item label="当前位置">
          {{ detailData.latitude && detailData.longitude ? `${detailData.latitude}, ${detailData.longitude}` : '未上报' }}
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ detailData.created_at }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ detailData.updated_at }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script>
import axios from 'axios'

const API_BASE = '/api/v1/admin'

export default {
  name: 'EscortsManage',
  data() {
    return {
      list: [],
      total: 0,
      page: 1,
      pageSize: 20,
      loading: false,
      searchPhone: '',
      filterStatus: '',

      showCreateDialog: false,
      submitting: false,
      form: {
        name: '',
        phone: '',
        communityId: 1,
        password: '123456',
        gender: 1,
        idCard: ''
      },

      showDetailDialog: false,
      detailData: null
    }
  },
  mounted() {
    this.loadList()
  },
  methods: {
    async loadList() {
      this.loading = true
      try {
        const res = await axios.get(`${API_BASE}/escorts`, {
          params: { page: this.page, pageSize: this.pageSize }
        })
        const data = res.data.data
        this.list = data.list || []
        this.total = data.total || 0
      } catch (e) {
        this.$message.error('加载服务人员列表失败')
      } finally {
        this.loading = false
      }
    },

    async viewDetail(row) {
      try {
        const res = await axios.get(`${API_BASE}/escorts/detail`, { params: { escortId: row.id } })
        this.detailData = res.data.data
        this.showDetailDialog = true
      } catch (e) {
        this.$message.error('获取详情失败')
      }
    },

    async approveEscort(row) {
      try {
        await this.$confirm(`确定启用陪诊员「${row.name}」？`, '提示', { type: 'success' })
        await axios.post(`${API_BASE}/escorts/approve`, { escortId: row.id })
        this.$message.success('已启用')
        this.loadList()
      } catch (e) {
        if (e !== 'cancel') this.$message.error('操作失败')
      }
    },

    async disableEscort(row) {
      try {
        await this.$confirm(`确定禁用陪诊员「${row.name}」？`, '警告', { type: 'warning' })
        await axios.post(`${API_BASE}/escorts/disable`, { escortId: row.id })
        this.$message.success('已禁用')
        this.loadList()
      } catch (e) {
        if (e !== 'cancel') this.$message.error('操作失败')
      }
    },

    async createEscort() {
      if (!this.form.name || !this.form.phone) {
        return this.$message.warning('姓名和手机号为必填项')
      }
      this.submitting = true
      try {
        await axios.post(`${API_BASE}/escorts/create`, this.form)
        this.$message.success('创建成功')
        this.showCreateDialog = false
        this.loadList()
      } catch (e) {
        this.$message.error('创建失败：' + (e.response?.data?.message || e.message))
      } finally {
        this.submitting = false
      }
    },

    resetForm() {
      this.form = { name: '', phone: '', communityId: 1, password: '123456', gender: 1, idCard: '' }
    }
  }
}
</script>

<style scoped>
.escorts-page {
  padding: 20px;
}
</style>

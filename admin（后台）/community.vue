<template>
  <div class="community-page">
    <h2>社区与系统管理</h2>

    <el-tabs v-model="activeTab">
      <!-- ========== 社区管理 ========== -->
      <el-tab-pane label="社区管理" name="community">
        <el-row style="margin-bottom: 16px;">
          <el-button type="primary" icon="el-icon-plus" @click="openCreateCommunity">新增社区</el-button>
        </el-row>

        <el-table :data="communityList" border stripe v-loading="communityLoading" style="width: 100%;">
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column prop="name" label="社区名称" width="140" />
          <el-table-column prop="code" label="编码" width="140" />
          <el-table-column prop="manager_name" label="负责人" width="100" />
          <el-table-column prop="manager_phone" label="联系电话" width="130" />
          <el-table-column label="地址" min-width="200" show-overflow-tooltip>
            <template slot-scope="{ row }">
              {{ [row.province, row.city, row.district, row.address].filter(Boolean).join('') || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="80">
            <template slot-scope="{ row }">
              <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
                {{ row.status === 1 ? '启用' : '禁用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140">
            <template slot-scope="{ row }">
              <el-button size="mini" @click="openEditCommunity(row)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- ========== 系统配置 ========== -->
      <el-tab-pane label="系统配置" name="config">
        <el-table :data="configList" border stripe v-loading="configLoading" style="width: 100%;">
          <el-table-column prop="config_key" label="配置键" width="260" />
          <el-table-column label="配置值" min-width="200">
            <template slot-scope="{ row }">
              <el-input
                v-if="editingConfigKey === row.config_key"
                v-model="editingValue"
                size="small"
                style="width: 200px;"
              />
              <span v-else>{{ row.config_value }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="description" label="说明" min-width="200" show-overflow-tooltip />
          <el-table-column label="操作" width="160">
            <template slot-scope="{ row }">
              <template v-if="editingConfigKey === row.config_key">
                <el-button size="mini" type="success" @click="saveConfig(row)">保存</el-button>
                <el-button size="mini" @click="editingConfigKey = null">取消</el-button>
              </template>
              <el-button v-else size="mini" @click="startEditConfig(row)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- 新增/编辑社区弹窗 -->
    <el-dialog :title="communityForm.id ? '编辑社区' : '新增社区'" :visible.sync="showCommunityDialog" width="550px" @close="resetCommunityForm">
      <el-form :model="communityForm" label-width="80px">
        <el-form-item label="社区名称" required>
          <el-input v-model="communityForm.name" />
        </el-form-item>
        <el-form-item label="编码" required>
          <el-input v-model="communityForm.code" />
        </el-form-item>
        <el-form-item label="负责人">
          <el-input v-model="communityForm.managerName" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="communityForm.managerPhone" />
        </el-form-item>
        <el-form-item label="省份">
          <el-input v-model="communityForm.province" />
        </el-form-item>
        <el-form-item label="城市">
          <el-input v-model="communityForm.city" />
        </el-form-item>
        <el-form-item label="区县">
          <el-input v-model="communityForm.district" />
        </el-form-item>
        <el-form-item label="详细地址">
          <el-input v-model="communityForm.address" />
        </el-form-item>
        <el-form-item label="状态" v-if="communityForm.id">
          <el-switch v-model="communityForm.status" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="禁用" />
        </el-form-item>
      </el-form>
      <span slot="footer">
        <el-button @click="showCommunityDialog = false">取 消</el-button>
        <el-button type="primary" :loading="communitySubmitting" @click="submitCommunity">确 定</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import axios from 'axios'

const API_BASE = '/api/v1/admin'

export default {
  name: 'CommunityManage',
  data() {
    return {
      activeTab: 'community',

      // 社区
      communityList: [],
      communityLoading: false,
      showCommunityDialog: false,
      communitySubmitting: false,
      communityForm: {
        id: null, name: '', code: '', managerName: '', managerPhone: '',
        province: '', city: '', district: '', address: '', status: 1
      },

      // 配置
      configList: [],
      configLoading: false,
      editingConfigKey: null,
      editingValue: ''
    }
  },
  watch: {
    activeTab(val) {
      if (val === 'community' && this.communityList.length === 0) this.loadCommunities()
      if (val === 'config' && this.configList.length === 0) this.loadConfigs()
    }
  },
  mounted() {
    this.loadCommunities()
  },
  methods: {
    // ===== 社区管理 =====
    async loadCommunities() {
      this.communityLoading = true
      try {
        const res = await axios.get(`${API_BASE}/communities`)
        this.communityList = res.data.data || []
      } catch (e) {
        this.$message.error('加载社区列表失败')
      } finally {
        this.communityLoading = false
      }
    },

    openCreateCommunity() {
      this.communityForm = { id: null, name: '', code: '', managerName: '', managerPhone: '', province: '', city: '', district: '', address: '', status: 1 }
      this.showCommunityDialog = true
    },

    openEditCommunity(row) {
      this.communityForm = {
        id: row.id,
        name: row.name,
        code: row.code,
        managerName: row.manager_name,
        managerPhone: row.manager_phone,
        province: row.province,
        city: row.city,
        district: row.district,
        address: row.address,
        status: row.status
      }
      this.showCommunityDialog = true
    },

    async submitCommunity() {
      if (!this.communityForm.name || !this.communityForm.code) {
        return this.$message.warning('社区名称和编码为必填项')
      }
      this.communitySubmitting = true
      try {
        if (this.communityForm.id) {
          await axios.put(`${API_BASE}/communities/update`, this.communityForm)
          this.$message.success('更新成功')
        } else {
          await axios.post(`${API_BASE}/communities/create`, this.communityForm)
          this.$message.success('创建成功')
        }
        this.showCommunityDialog = false
        this.loadCommunities()
      } catch (e) {
        this.$message.error('操作失败：' + (e.response?.data?.message || e.message))
      } finally {
        this.communitySubmitting = false
      }
    },

    resetCommunityForm() {
      this.communityForm = { id: null, name: '', code: '', managerName: '', managerPhone: '', province: '', city: '', district: '', address: '', status: 1 }
    },

    // ===== 系统配置 =====
    async loadConfigs() {
      this.configLoading = true
      try {
        const res = await axios.get(`${API_BASE}/configs`)
        this.configList = res.data.data || []
      } catch (e) {
        this.$message.error('加载配置失败')
      } finally {
        this.configLoading = false
      }
    },

    startEditConfig(row) {
      this.editingConfigKey = row.config_key
      this.editingValue = row.config_value
    },

    async saveConfig(row) {
      try {
        await axios.put(`${API_BASE}/configs/update`, {
          configKey: row.config_key,
          configValue: this.editingValue
        })
        this.$message.success('配置已保存')
        this.editingConfigKey = null
        this.loadConfigs()
      } catch (e) {
        this.$message.error('保存失败')
      }
    }
  }
}
</script>

<style scoped>
.community-page { padding: 20px; }
</style>

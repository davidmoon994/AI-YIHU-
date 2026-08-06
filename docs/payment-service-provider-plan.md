# 微信支付服务商模式 — 技术方案

> 版本：v1.0 | 更新日期：2026-08-06

---

## 一、业务模型

```
平台方（你）
├── 服务商商户号（sp_mchid）
├── 小程序 AppID
├── 签名私钥 + APIv3 密钥
│
├── 社区 A → 子商户号 sub_mchid_A → 负责人 A 收款
├── 社区 B → 子商户号 sub_mchid_B → 负责人 B 收款
└── 社区 C → 子商户号 sub_mchid_C → 负责人 C 收款
```

- 用户下单 → 钱直接到对应社区的子商户（负责人账户）
- 平台可选分账抽佣（订单完成后自动执行）
- 所有配置在后台管理页面操作，无需改代码

---

## 二、前置条件

| 步骤 | 说明 | 耗时 |
|------|------|------|
| 1. 申请营业执照 | 平台方 + 每个社区负责人各一个 | 视当地工商局 |
| 2. 申请服务商商户号 | pay.weixin.qq.com → 服务商中心 | 1-3 个工作日 |
| 3. 每个负责人申请子商户号 | 用各自营业执照申请 | 1-3 个工作日 |
| 4. 服务商后台绑定子商户 | 建立 sp_mchid ↔ sub_mchid 关系 | 即时 |
| 5. 在 admin 后台填入配置 | 服务商凭证 + 各社区子商户号 | 5 分钟 |

---

## 三、数据库改动

### 3.1 communities 表新增字段

| 字段 | 类型 | 说明 |
|------|------|------|
| sub_mchid | VARCHAR(32) | 微信支付子商户号 |
| commission_rate | DECIMAL(5,2) | 平台抽佣比例(%) |

### 3.2 payments 表新增字段

| 字段 | 类型 | 说明 |
|------|------|------|
| sub_mchid | VARCHAR(32) | 实际收款的子商户号 |
| profit_share_status | VARCHAR(20) | 分账状态 |

### 3.3 system_configs 新增配置项

| config_key | 说明 |
|------------|------|
| sp_mchid | 服务商商户号 |
| api_v3_key | APIv3 密钥 |
| private_key_path | 私钥文件路径 |
| serial_no | 证书序列号 |
| profit_share_enabled | 分账功能开关 |

---

## 四、支付流程变化

### 4.1 下单（JSAPI 支付）

```
改造前: POST /v3/pay/transactions/jsapi
        { appid, mchid, ... }

改造后: POST /v3/pay/partner/transactions/jsapi
        { sp_appid, sp_mchid, sub_mchid, ... }
```

### 4.2 退款

```
改造前: POST /v3/refund/domestic/refunds
        { out_trade_no, out_refund_no, amount }

改造后: POST /v3/refund/domestic/refunds
        { sub_mchid, out_trade_no, out_refund_no, amount }
```

### 4.3 分账（订单完成后）

```
POST /v3/profitsharing/orders
{
  appid, transaction_id, out_order_no,
  receivers: [
    { type: "MERCHANT_ID", account: sp_mchid, amount: 平台佣金 }
  ]
}
```

---

## 五、后台管理功能

### 5.1 支付配置页

- 服务商商户号（sp_mchid）
- APIv3 密钥
- 证书序列号
- 私钥上传
- 分账开关

### 5.2 社区子商户管理

- 社区列表 + 子商户号
- 抽佣比例设置
- 绑定/解绑子商户
- 分账状态查看

---

## 六、代码改动清单

| 文件 | 改动 |
|------|------|
| server/sql/migration.sql | 新增数据库迁移 |
| server/services/payService.js | 服务商模式下单/退款/分账 |
| server/services/adminService.js | 支付配置 + 子商户 CRUD |
| server/routes/admin.js | 新增支付管理路由 |
| admin/index.html | 新增支付管理页面组件 |

---

## 七、上线检查清单

- [ ] 服务商商户号已申请
- [ ] 至少一个社区已绑定子商户号
- [ ] admin 后台支付配置已填写
- [ ] 分账功能已测试（沙箱环境）
- [ ] 支付回调 URL 已配置为 HTTPS 域名
- [ ] 私钥文件已上传到服务器

# AI 社区就医陪诊服务

> 基于 AI 的社区陪诊系统，为社区居民提供专业陪诊、代挂号、接送、AI 问诊等服务。  
> 包含用户端小程序、陪诊员端小程序、运营后台三端。

---

## 项目结构

```
├── server（后端）/           Express + MySQL 后端服务
│   ├── routes/              11 个 API 路由模块
│   ├── services/            11 个业务逻辑服务
│   ├── middleware/          JWT 鉴权 / 错误处理 / 参数校验
│   ├── sql/                 数据库初始化 + 种子数据
│   └── app.js              入口文件
│
├── miniapp-user（用户端）/   微信小程序 - 用户端
│   ├── pages/index/         首页（自动登录 + 服务入口）
│   ├── pages/ai/            AI 问诊（智能对话）
│   ├── pages/service/       服务下单（4步流程）
│   ├── pages/mine/          我的（订单 + 消息）
│   └── custom-tab-bar/      自定义底部导航
│
├── miniapp-escort（陪诊员端）/ 微信小程序 - 陪诊员端
│   ├── pages  home/         首页仪表盘
│   ├── pages  order/        接单管理
│   ├── pages  task/         任务执行（到达→服务→完成）
│   ├── pages  wallet/       收入钱包
│   ├── pages  learn/        学习中心
│   └── custom-tab-bar/      自定义底部导航
│
└── admin（后台）/            Vue + Element UI 运营后台
    └── index.html           单文件 SPA（CDN 加载）
```

---

## 技术栈

| 模块 | 技术 | 说明 |
|------|------|------|
| 后端 | Express 5 + MySQL2 | REST API + WebSocket |
| 认证 | JWT | 三种角色（用户/陪诊员/管理员）|
| 支付 | 微信支付 V3 | 下单 → 支付 → 退款全链路 |
| AI | Anthropic Claude | 症状分析 / 科室推荐 / 就医规划 |
| 用户端 | 微信小程序原生 | 4 Tab 页面 |
| 陪诊员端 | 微信小程序原生 | 5 Tab 页面 |
| 后台 | Vue 2 + Element UI | CDN 加载，无需构建 |

---

## 快速开始

### 1. 环境要求

- **Node.js** >= 18
- **MySQL** >= 5.7（推荐 8.0）
- **微信开发者工具**（用于小程序调试）

### 2. 初始化数据库

```bash
# 登录 MySQL
mysql -u root -p

# 创建数据库
CREATE DATABASE community_medical CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
exit;

# 导入表结构
mysql -u root -p community_medical < "server（后端）/sql/init.sql"

# 导入种子数据
mysql -u root -p community_medical < "server（后端）/sql/seed.sql"
```

### 3. 启动后端服务

```bash
cd "server（后端）"

# 安装依赖
npm install

# 配置环境变量（首次运行需编辑 .env）
cp .env.example .env
# 编辑 .env，修改 MYSQL_PASSWORD 为你的 MySQL 密码

# 启动（开发模式，自动重启）
npm run dev
```

看到以下输出即启动成功：
```
Escort System Server running on port 3000
```

### 4. 访问后台管理

后端启动后，浏览器打开：

```
http://localhost:3000/admin
```

- 默认管理员账号：`admin` / `admin123`
- 功能：运营总览、订单管理、陪诊员管理、社区配置

### 5. 运行用户端小程序

1. 打开**微信开发者工具** → 导入项目
2. 目录选择：`miniapp-user（用户端）/`
3. AppID：`wxce306b36ada907da`（或使用测试号）
4. 修改 `app.js` 第 2 行的 `API_BASE`：
   ```javascript
   const API_BASE = 'http://你的本机IP:3000/api/v1'
   ```
5. 在**详情 → 本地设置**中勾选「不校验合法域名」

### 6. 运行陪诊员端小程序

1. 再开一个微信开发者工具窗口 → 导入项目
2. 目录选择：`miniapp-escort（陪诊员端）/`
3. 同样修改 `app.js` 中的 `API_BASE`
4. 同样勾选「不校验合法域名」

---

## 核心业务流程

```
用户下单 → 微信支付 → 系统派单（自动/人工）
    → 陪诊员接单 → 到达 → 开始服务 → 完成
    → 订单结算 → 收入到账
```

### 订单状态流转

| 状态 | 说明 |
|------|------|
| pending | 待支付 |
| paid | 已支付 |
| dispatching | 派单中 |
| assigned | 已指派 |
| serving | 服务中 |
| completed | 已完成 |
| cancelled | 已取消 |

---

## API 概览

所有接口前缀：`/api/v1/`

| 模块 | 路径 | 说明 |
|------|------|------|
| auth | `/auth/login` | 微信登录 |
| user | `/user/profile` | 用户资料 |
| order | `/order/create` `/order/list` | 下单 / 订单列表 |
| pay | `/pay/create` `/pay/refund` | 支付 / 退款 |
| ai | `/ai/chat` `/ai/department` | AI 对话 / 科室推荐 |
| escort | `/escort/dashboard` `/escort/accept` | 陪诊员首页 / 接单 |
| dispatch | `/dispatch/auto` `/dispatch/manual` | 自动/人工派单 |
| admin | `/admin/login` `/admin/dashboard` | 管理员登录 / 总览 |

---

## 配置说明

### 环境变量（.env）

| 变量 | 说明 | 示例 |
|------|------|------|
| PORT | 服务端口 | 3000 |
| MYSQL_HOST | 数据库地址 | 127.0.0.1 |
| MYSQL_PASSWORD | 数据库密码 | your_password |
| JWT_SECRET | JWT 签名密钥 | random_string |
| WX_APPID | 小程序 AppID | wxce306b36ada907da |
| WX_SECRET | 小程序密钥 | your_wx_secret |

### 小程序端配置

两个小程序的 `app.js` 顶部均需配置后端地址：
```javascript
const API_BASE = 'https://your-domain.com/api/v1'
```

---

## 目录约定

- `server/sql/` — 数据库 DDL 与种子数据
- `server/uploads/` — 文件上传目录（.gitkeep 保留）
- `server/logs/` — 运行日志目录
- `admin/` — 后台管理（单 HTML，无需构建）

---

## 常见问题

**Q: 小程序模拟器报域名校验错误？**  
在微信开发者工具 → 详情 → 本地设置 → 勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」。

**Q: 后端启动报 MySQL 连接失败？**  
检查 `.env` 中 `MYSQL_HOST`、`MYSQL_USER`、`MYSQL_PASSWORD` 是否正确，确保 MySQL 服务已启动。

**Q: 后台登录后无法加载数据？**  
确认 `seed.sql` 已导入，且管理员账号存在于 `admins` 表中。

---

## License

Private / Unlicensed

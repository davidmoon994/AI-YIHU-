# Server 快速启动

对应 09-DEPLOY.md / 11-README.md，本目录是 Phase001~Phase002 的落地代码。

## 1. 安装依赖

```bash
cd server
npm install
```

## 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入 MySQL、JWT、微信支付等真实配置
```

## 3. 初始化数据库

```bash
mysql -u root -p < sql/init.sql
mysql -u root -p < sql/seed.sql
```

种子数据会创建：

- 默认社区（id=1）
- 超级管理员账号：`admin` / `Admin@123`（**首次登录后请立即修改密码**）
- 默认价格、派单超时等系统配置
- 两条示例学习课程

## 4. 启动服务

```bash
npm run dev    # 开发模式，文件变更自动重启
npm start      # 生产模式
```

启动成功后：

- HTTP 接口：`http://localhost:3000/api/v1/...`
- WebSocket：`ws://localhost:3000/ws?token=JWT_TOKEN`
- 健康检查：`http://localhost:3000/healthz`

## 5. 已实现的模块（对应 13-DEVELOPMENT_PLAN.md Phase001~Phase002）

| 模块 | 文件 | 状态 |
| --- | --- | --- |
| 基础框架 | app.js / db.js / middleware / utils | ✅ |
| 用户与微信登录 | services/userService.js, routes/auth.js, routes/user.js | ✅ |
| 地址/就诊人 | services/addressService.js, services/patientService.js | ✅ |
| 订单系统 | services/orderService.js, routes/order.js | ✅ |
| 微信支付V3 | services/payService.js, utils/wxCrypto.js, routes/pay.js | ✅（需真实商户证书才能联调） |
| 派单系统 | services/dispatchService.js, routes/dispatch.js | ✅ |
| 陪诊员端 | services/escortService.js, routes/escort.js | ✅ |
| WebSocket | routes/wsServer.js, services/wsService.js | ✅ |
| AI辅助接口 | services/aiService.js, routes/ai.js | ✅（需配置 ANTHROPIC_API_KEY，未配置时降级返回提示文案） |
| 消息中心 | services/messageService.js, routes/message.js | ✅ |
| 后台管理 | services/adminService.js, routes/admin.js | ✅ |
| 数据库 | sql/init.sql, sql/seed.sql | ✅ |

## 6. 尚未包含（需要你确认后再继续）

- `admin/`、`miniapp-user/`、`miniapp-escort/` 三个前端工程（本次只交付 Server）
- 微信支付需要你提供真实的 `apiclient_key.pem`（商户私钥）和微信支付平台证书才能完整跑通
- 分账（第十三条，预留功能，接口未实现，仅数据库/配置层面留了开关）
- 定时任务（超时重派已用内存 `setTimeout` 实现单机可用版本；多实例部署需要迁移到 Redis 分布式锁，文档 05-DISPATCH.md 里也提到了这一点）

## 7. 安全提示

- `.env` 不要提交到 Git
- 生产环境务必修改 `admin` 默认密码与 `JWT_SECRET`
- 微信支付相关证书文件请放在 `cert/` 目录（已在 `.gitignore` 建议中排除），不要打包进代码仓库

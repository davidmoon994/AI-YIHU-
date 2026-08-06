# ===== 生产环境 Node.js 镜像 =====
FROM node:18-alpine

WORKDIR /app

# 安装依赖（利用 Docker 缓存层）
COPY server（后端）/package.json server（后端）/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 复制后端代码
COPY server（后端）/ ./

# 复制后台管理 HTML（app.js 用 path.join(__dirname, '..', 'admin（后台）')）
RUN mkdir -p "/admin（后台）"
COPY "admin（后台）/index.html" "/admin（后台）/index.html"

# uploads 与 logs 目录
RUN mkdir -p uploads/icons logs

# 非 root 用户运行
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app "/admin（后台）"
USER appuser

EXPOSE 3000

CMD ["node", "app.js"]

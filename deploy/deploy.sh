#!/bin/bash
# ============================================================
#  AI-YIHU 项目部署脚本
#  从 GitHub 拉取代码 → 构建 Docker 镜像 → 启动服务 → 初始化数据库
#  用法：sudo bash deploy.sh [域名]
#  示例：sudo bash deploy.sh yihu.example.com
# ============================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
step()  { echo -e "${CYAN}[STEP]${NC} $*"; }

# ---------- 配置 ----------
GITHUB_REPO="https://github.com/davidmoon994/AI-YIHU-.git"
PROJECT_DIR="/opt/projects/ai-yihu"
NGINX_PORT="8081"
DOMAIN="${1:-}"

[[ $EUID -eq 0 ]] || error "请使用 root 或 sudo 运行此脚本"
command -v docker &>/dev/null || error "Docker 未安装，请先运行 server-setup.sh"

# ---------- 1. 拉取代码 ----------
step "1/6 拉取代码"
if [ -d "$PROJECT_DIR/.git" ]; then
    info "项目已存在，拉取最新代码..."
    cd "$PROJECT_DIR"
    git pull origin master
else
    info "克隆仓库到 $PROJECT_DIR ..."
    mkdir -p /opt/projects
    git clone "$GITHUB_REPO" "$PROJECT_DIR"
    cd "$PROJECT_DIR"
fi
info "代码就绪：$(git log --oneline -1)"

# ---------- 2. 生成安全密码 ----------
step "2/6 配置环境变量"
ENV_FILE="$PROJECT_DIR/deploy/.env.production"

if [ ! -f "$ENV_FILE.deployed" ]; then
    # 首次部署：生成随机密码
    DB_PASS=$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 20)
    DB_ROOT_PASS=$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 20)
    JWT_SEC=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 64)

    sed -i "s|YIHU_CHANGEME_2026|${DB_PASS}|g"         "$ENV_FILE"
    sed -i "s|YIHU_ROOT_CHANGEME_2026|${DB_ROOT_PASS}|g" "$ENV_FILE"
    sed -i "s|YIHU_JWT_CHANGEME_USE_RANDOM_64CHARS|${JWT_SEC}|g" "$ENV_FILE"

    if [ -n "$DOMAIN" ]; then
        sed -i "s|YOUR_DOMAIN|${DOMAIN}|g" "$ENV_FILE"
    fi

    touch "$ENV_FILE.deployed"
    info "已生成随机密码并写入 .env.production"
    warn "请手动编辑 $ENV_FILE 填入微信配置（WX_SECRET 等）"
else
    info "环境变量已配置过，跳过"
fi

# ---------- 3. 构建并启动容器 ----------
step "3/6 构建 Docker 镜像并启动服务"
cd "$PROJECT_DIR"
docker compose down --remove-orphans 2>/dev/null || true
docker compose up -d --build
info "等待服务就绪..."
sleep 10

# ---------- 4. 初始化数据库 ----------
step "4/6 初始化数据库"
MYSQL_USER=$(grep MYSQL_USER "$ENV_FILE" | cut -d= -f2)
MYSQL_PASS=$(grep MYSQL_PASSWORD "$ENV_FILE" | cut -d= -f2)
MYSQL_DB=$(grep MYSQL_DATABASE "$ENV_FILE" | cut -d= -f2)

# 检查是否已初始化
TABLE_COUNT=$(docker exec yihu-mysql mysql -u"$MYSQL_USER" -p"$MYSQL_PASS" -s -N \
    -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$MYSQL_DB'" 2>/dev/null || echo "0")

if [ "$TABLE_COUNT" -lt 5 ]; then
    info "数据库为空，导入表结构..."
    docker exec -i yihu-mysql mysql -u"$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" \
        < "$PROJECT_DIR/server（后端）/sql/init.sql"
    info "导入种子数据..."
    docker exec -i yihu-mysql mysql -u"$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" \
        < "$PROJECT_DIR/server（后端）/sql/seed.sql"
    info "数据库初始化完成"
else
    info "数据库已有 ${TABLE_COUNT} 张表，跳过初始化"
fi

# ---------- 5. 配置宿主机 Nginx 反向代理 ----------
step "5/6 配置宿主机 Nginx"
NGINX_CONF="/etc/nginx/conf.d/ai-yihu.conf"

if [ -n "$DOMAIN" ]; then
    cat > "$NGINX_CONF" << NGINX
# AI-YIHU 社区就医陪诊服务
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${NGINX_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX
    info "已创建 ${DOMAIN} 的反向代理配置"

    # 尝试自动申请 SSL（certbot）
    if command -v certbot &>/dev/null; then
        info "尝试申请 SSL 证书..."
        certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
            --email admin@"${DOMAIN#*.}" 2>/dev/null || warn "SSL 申请失败，请稍后手动配置"
    fi
else
    cat > "$NGINX_CONF" << NGINX
# AI-YIHU 社区就医陪诊服务（无域名模式）
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:${NGINX_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX
    warn "未提供域名，使用通配模式（仅可通过 IP 访问）"
fi

nginx -t && systemctl reload nginx
info "Nginx 已重载"

# ---------- 6. 验证 ----------
step "6/6 部署验证"
sleep 3

HEALTH=$(curl -sf "http://127.0.0.1:${NGINX_PORT}/healthz" 2>/dev/null || echo "FAILED")
if echo "$HEALTH" | grep -q '"code":0'; then
    info "✅ 后端健康检查通过"
else
    warn "⚠️  后端未响应，查看日志：docker compose logs app"
fi

ADMIN_CHECK=$(curl -sf -o /dev/null -w "%{http_code}" "http://127.0.0.1:${NGINX_PORT}/admin" 2>/dev/null || echo "000")
if [ "$ADMIN_CHECK" = "200" ]; then
    info "✅ 后台管理页面可访问"
else
    warn "⚠️  后台管理页面返回 $ADMIN_CHECK"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}  AI-YIHU 部署完成！${NC}"
echo "=========================================="
echo ""
if [ -n "$DOMAIN" ]; then
    echo "  后台管理：http://${DOMAIN}/admin"
    echo "  API 地址：http://${DOMAIN}/api/v1/"
else
    VPS_IP=$(curl -sf ifconfig.me 2>/dev/null || echo "YOUR_VPS_IP")
    echo "  后台管理：http://${VPS_IP}/admin"
    echo "  API 地址：http://${VPS_IP}/api/v1/"
fi
echo ""
echo "  默认管理员：admin / admin123"
echo ""
echo "  常用命令："
echo "    查看日志：cd ${PROJECT_DIR} && docker compose logs -f"
echo "    重启服务：cd ${PROJECT_DIR} && docker compose restart"
echo "    停止服务：cd ${PROJECT_DIR} && docker compose down"
echo "    更新部署：cd ${PROJECT_DIR} && sudo bash deploy/deploy.sh"
echo ""

#!/bin/bash
# ============================================================
#  VPS 初始化脚本（Ubuntu 22.04 LTS）
#  安装 Docker + 宿主机 Nginx + 安全加固
#  用法：sudo bash server-setup.sh
# ============================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ---------- 检查 root ----------
[[ $EUID -eq 0 ]] || error "请使用 root 或 sudo 运行此脚本"

info "===== 1/6 系统更新 ====="
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

info "===== 2/6 安装基础工具 ====="
apt-get install -y -qq \
    curl wget git vim unzip \
    ca-certificates gnupg lsb-release \
    ufw fail2ban

info "===== 3/6 安装 Docker ====="
if command -v docker &>/dev/null; then
    info "Docker 已安装，跳过"
else
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
        gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
      https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    info "Docker $(docker --version) 安装完成"
fi

info "===== 4/6 安装宿主机 Nginx（反向代理） ====="
if command -v nginx &>/dev/null; then
    info "Nginx 已安装，跳过"
else
    apt-get install -y -qq nginx
    systemctl enable nginx
fi

# 创建多项目代理配置目录
mkdir -p /etc/nginx/conf.d
mkdir -p /etc/nginx/ssl

# 修改主配置，include conf.d/*.conf
if ! grep -q 'include /etc/nginx/conf.d/\*.conf' /etc/nginx/nginx.conf; then
    # 在 http {} 块末尾的 } 之前插入 include
    sed -i '/http {/a\    include /etc/nginx/conf.d/*.conf;' /etc/nginx/nginx.conf 2>/dev/null || true
    # 如果 sed 没生效，直接追加（备用方案）
    if ! grep -q 'conf.d' /etc/nginx/nginx.conf; then
        warn "自动修改 nginx.conf 失败，请手动添加 include"
    fi
fi

systemctl restart nginx
info "Nginx $(nginx -v 2>&1) 就绪"

info "===== 5/6 防火墙配置 ====="
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    comment "SSH"
ufw allow 80/tcp    comment "HTTP"
ufw allow 443/tcp   comment "HTTPS"
ufw --force enable
info "UFW 防火墙已启用"

info "===== 6/6 安全加固 ====="
# fail2ban
systemctl enable fail2ban
systemctl start fail2ban

# SSH 加固
if grep -q "^#PasswordAuthentication" /etc/ssh/sshd_config; then
    warn "建议配置 SSH 密钥登录后禁用密码登录"
fi

info "=========================================="
info "  VPS 初始化完成！"
info "=========================================="
info "已安装：Docker + Nginx + UFW + Fail2ban"
info ""
info "多项目架构（每个项目独立 docker-compose）："
info "  /opt/projects/ai-yihu/    → 端口 8081（本项目）"
info "  /opt/projects/project-2/  → 端口 8082（预留）"
info "  /opt/projects/project-3/  → 端口 8083（预留）"
info ""
info "宿主机 Nginx 按域名路由到各项目。"
info ""
info "下一步：运行 deploy.sh 部署项目"

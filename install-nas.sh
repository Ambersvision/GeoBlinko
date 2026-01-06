#!/bin/bash
set -e

echo "==================================="
echo "  GeoBlinko NAS 部署脚本"
echo "  版本: 1.10.9"
echo "==================================="
echo ""

# 检查 Docker 是否已安装
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: Docker 未安装"
    echo "请先安装 Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ 错误: Docker Compose 未安装"
    echo "请先安装 Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker 和 Docker Compose 已安装"
echo ""

# 检查是否有足够的内存
TOTAL_MEM=$(free -m | awk '/Mem:/ {print $2}')
if [ "$TOTAL_MEM" -lt 4096 ]; then
    echo "⚠️  警告: 系统内存不足 4GB"
    echo "建议至少 8GB RAM 以获得最佳性能"
    echo ""
    read -p "是否继续部署？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "部署已取消"
        exit 1
    fi
fi

echo "✅ 内存检查通过 ($TOTAL_MEM MB)"
echo ""

# 检查磁盘空间
DISK_AVAIL=$(df -BG . | awk '/[0-9]%/{print $4}')
DISK_AVAIL_GB=$((DISK_AVAIL / 1024))
if [ "$DISK_AVAIL_GB" -lt 20 ]; then
    echo "⚠️  警告: 可用磁盘空间不足 20GB"
    echo "建议至少 20GB 可用空间"
    echo ""
    read -p "是否继续部署？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "部署已取消"
        exit 1
    fi
fi

echo "✅ 磁盘空间检查通过 ($DISK_AVAIL_GB GB 可用)"
echo ""

# 停止旧容器（如果存在）
if docker ps -a | grep -q "Geoblinko"; then
    echo "🛑 停止旧容器..."
    docker-compose -f docker-compose.nas.yml down
    echo "✅ 旧容器已停止"
    echo ""
fi

# 拉取最新代码
echo "📥 检查更新..."
git fetch origin
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})
if [ "$LOCAL" = "$REMOTE" ]; then
    echo "✅ 已是最新版本"
else
    echo "🔄 发现更新，正在拉取..."
    git pull origin main
    echo "✅ 更新完成"
fi
echo ""

# 配置说明
echo "==================================="
echo "  配置说明"
echo "==================================="
echo ""
echo "🔧 重要配置项需要手动修改："
echo "1. NAS IP 地址（用于外部访问）"
echo "2. 高德地图 API Key（必需，否则地图功能无法使用）"
echo "3. 数据库密码（建议修改）"
echo ""
echo "配置文件: docker-compose.nas.yml"
echo ""
echo "📝 需要编辑的行："
echo "- 第 63 行: NEXTAUTH_URL 中的 IP 地址 (192.168.0.160)"
echo "- 第 64 行: NEXT_PUBLIC_BASE_URL 中的 IP 地址 (192.168.0.160)"
echo "- 第 71-73 行: API Key 配置 (your_amap_web_api_key_here)"
echo "- 第 66 行: NEXTAUTH_SECRET 密码"
echo "- 第 22 行: POSTGRES_PASSWORD 数据库密码"
echo ""
read -p "是否现在编辑配置文件？(y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v nano &> /dev/null; then
        nano docker-compose.nas.yml
    elif command -v vim &> /dev/null; then
        vim docker-compose.nas.yml
    elif command -v vi &> /dev/null; then
        vi docker-compose.nas.yml
    else
        echo "⚠️  未找到文本编辑器，请手动编辑 docker-compose.nas.yml"
        echo "按 Enter 继续..."
        read -r
    fi
fi
echo ""

# 拉取镜像并启动容器
echo "📦 正在拉取 Docker 镜像..."
echo "注意: 可能需要几分钟下载镜像"
echo ""

docker-compose -f docker-compose.nas.yml pull

echo "🚀 启动容器..."
docker-compose -f docker-compose.nas.yml up -d

# 等待容器启动
echo "⏳ 等待服务启动..."
sleep 15

# 检查容器状态
if docker ps | grep -q "Geoblinko-website.*Up"; then
    echo ""
    echo "==================================="
    echo "  🎉 部署成功！"
    echo "==================================="
    echo ""
    echo "访问地址: http://localhost:2222"
    echo ""
    echo "如需从外部访问，请确保 docker-compose.nas.yml 中配置了正确的 NAS IP"
    echo ""
    echo "查看日志: docker-compose -f docker-compose.nas.yml logs -f"
    echo "停止服务: docker-compose -f docker-compose.nas.yml down"
    echo ""
else
    echo ""
    echo "❌ 容器启动失败"
    echo "请查看日志: docker-compose -f docker-compose.nas.yml logs"
    exit 1
fi

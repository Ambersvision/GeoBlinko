#!/bin/bash
set -e

echo "==================================="
echo "  GeoBlinko NAS 部署脚本"
echo "  版本: 1.10.3"
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
    docker-compose down
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

# 询问是否配置高德地图 API Key
echo "==================================="
echo "  高德地图配置"
echo "==================================="
echo ""
read -p "是否已有高德地图 API Key？(y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "请输入您的高德地图 API Key: " AMAP_KEY
    if [ -n "$AMAP_KEY" ]; then
        # 创建 .env 文件
        cat > .env.nas <<EOF
AMAP_WEB_API_KEY=$AMAP_KEY
NEXT_PUBLIC_AMAP_WEB_API_KEY=$AMAP_KEY
VITE_AMAP_WEB_API_KEY=$AMAP_KEY
EOF
        echo "✅ API Key 已配置"
    fi
else
    echo "ℹ️  将使用默认配置（部分功能可能受限）"
fi
echo ""

# 构建并启动容器
echo "🏗️  正在构建 Docker 镜像..."
echo "注意: 首次构建可能需要 10-20 分钟"
echo ""

if docker-compose build; then
    echo "✅ 镜像构建成功"
else
    echo "❌ 镜像构建失败"
    echo "请检查错误信息并重试"
    exit 1
fi
echo ""

echo "🚀 启动容器..."
docker-compose up -d

# 等待容器启动
echo "⏳ 等待服务启动..."
sleep 10

# 检查容器状态
if docker ps | grep -q "Geoblinko-website.*Up"; then
    echo ""
    echo "==================================="
    echo "  🎉 部署成功！"
    echo "==================================="
    echo ""
    echo "访问地址: http://localhost:2222"
    echo ""
    echo "如需从外部访问，请替换 localhost 为您的 NAS IP 地址"
    echo ""
    echo "查看日志: docker-compose logs -f"
    echo "停止服务: docker-compose down"
    echo ""
else
    echo ""
    echo "❌ 容器启动失败"
    echo "请查看日志: docker-compose logs"
    exit 1
fi

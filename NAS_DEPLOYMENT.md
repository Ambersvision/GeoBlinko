# GeoBlinko NAS Docker 部署指南

本指南帮助您在 NAS（网络存储设备）上部署 GeoBlinko。

## 系统要求

- Docker 20.10+
- Docker Compose 2.0+
- 至少 4GB RAM（推荐 8GB）
- 至少 20GB 可用磁盘空间

## 快速部署

### 方法一：使用 Docker Compose（推荐）

1. **克隆项目**
```bash
git clone https://github.com/Ambersvision/GeoBlinko.git
cd GeoBlinko
```

2. **配置环境变量**

复制环境变量示例文件并进行配置：

```bash
cp .env.example .env
# 编辑 .env 文件，配置您的 NAS IP 和高德地图 API Key
```

编辑 `.env` 文件中的关键配置：
```bash
# 您的 NAS IP 地址（用于外部访问）
NAS_IP=192.168.0.160

# 高德地图 Web API Key
AMAP_WEB_API_KEY=your_amap_web_api_key_here
```

**获取高德地图 API Key：**
- 访问 [高德开放平台](https://console.amap.com/)
- 注册并创建应用
- 获取 Web API Key

3. **启动服务**

使用 NAS 优化的配置文件启动：

```bash
docker-compose -f docker-compose.nas.yml up -d
```

4. **访问应用**

在浏览器中打开：`http://your-nas-ip:2222`

### 方法二：使用一键安装脚本

```bash
curl -sSL https://github.com/Ambersvision/GeoBlinko/raw/main/install-nas.sh | bash
```

## 端口说明

| 服务 | 容器端口 | 主机端口 | 用途 |
|------|----------|----------|------|
| GeoBlinko | 1111 | 2222 | Web 应用 |
| PostgreSQL | 5432 | 15432 | 数据库（可选对外） |

## 数据持久化

数据存储在 Docker volume 中：
- `geoblinko_pgdata16`: PostgreSQL 数据库

备份建议：
```bash
# 备份数据库
docker exec Geoblinko-postgres pg_dump -U postgres postgres > backup.sql

# 恢复数据库
cat backup.sql | docker exec -i Geoblinko-postgres psql -U postgres postgres
```

## 常见问题

### 1. 内存不足

如果遇到 OOM (Out of Memory) 错误：

**检查 Docker 内存限制：**
```bash
docker info | grep "Total Memory"
```

**Docker Desktop 用户：**
- 打开 Docker Desktop
- 进入 Settings → Resources
- 增加内存到至少 8GB

**Synology NAS 用户：**
- 控制面板 → Docker → 设置
- 内存限制：至少 8192 MB

**QNAP NAS 用户：**
- 控制台 → Docker → 容器设置
- 内存限制：至少 8192 MB

### 2. 构建失败（ARM 架构）

如果您在 ARM 架构的 NAS 上构建失败：

**解决方案：**
- 使用预构建的 Docker 镜像
- 或者确保有足够的内存（16GB）用于构建

### 3. 网络问题

如果容器无法访问网络：

**检查防火墙设置：**
- 确保端口 2222 已开放
- 如果需要外部访问，配置路由器端口转发

**DNS 配置：**
```yaml
# 在 docker-compose.yml 中添加
services:
  blinko-website:
    dns:
      - 8.8.8.8
      - 8.8.4.4
```

### 4. 数据库连接失败

**检查数据库健康状态：**
```bash
docker ps
# 查看 Geoblinko-postgres 状态是否为 healthy
```

**手动测试连接：**
```bash
docker exec -it Geoblinko-postgres psql -U postgres -d postgres
```

### 5. 更新应用

```bash
# 拉取最新代码
git pull origin main

# 重新构建并启动
docker-compose up -d --build
```

## 性能优化

### 1. 使用国内镜像源

已在 `docker-compose.yml` 中配置：
```yaml
build:
  args:
    USE_MIRROR: "true"  # 使用淘宝镜像
```

### 2. 调整 PostgreSQL 性能

```yaml
services:
  postgres:
    command:
      - "postgres"
      - "-c"
      - "shared_buffers=256MB"
      - "-c"
      - "max_connections=100"
```

### 3. 启用代理缓存

如果使用反向代理（如 Nginx）：

```nginx
location / {
    proxy_pass http://localhost:2222;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 安全建议

1. **修改默认密码**
   ```yaml
   environment:
     POSTGRES_PASSWORD: "your-strong-password"  # 修改默认密码
   ```

2. **使用 HTTPS**
   配置反向代理（Nginx/Caddy）启用 SSL

3. **限制数据库访问**
   ```yaml
   postgres:
     ports: []  # 不暴露数据库端口
   ```

4. **定期备份**
   设置定时任务备份数据库

## 版本信息

当前版本：1.10.3

更新日志：
- 修复地理位置选择器问题
- 优化地图初始化
- 移除 eventBus 依赖，改用 props 回调

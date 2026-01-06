#!/bin/sh
set -e

# 需要注入的前端环境变量列表（空格分隔）
INJECT_VARS="${INJECT_VARS:-VITE_AMAP_WEB_API_KEY NEXT_PUBLIC_AMAP_WEB_API_KEY AMAP_WEB_API_KEY}"

# 生成 config.js 文件（在 public 目录下，供前端访问）
CONFIG_FILE="/app/server/public/config.js"

echo "Generating config.js with environment variables..."

# 开始生成 config.js
echo "window.__BLINKO_CONFIG__ = {" > "$CONFIG_FILE"

# 遍历所有需要注入的变量
for var in $INJECT_VARS; do
    # 从环境变量中读取值
    value=$(eval echo \$$var)
    if [ -n "$value" ]; then
        # 将变量名和值添加到配置对象
        # 转义单引号以避免 shell 注入
        escaped_value=$(echo "$value" | sed "s/'/\\\\'/g")
        echo "  '$var': '$escaped_value'," >> "$CONFIG_FILE"
        echo "  Injected $var"
    else
        echo "  $var is not set, skipping"
    fi
done

# 结束配置对象
echo "};" >> "$CONFIG_FILE"

echo "config.js generated successfully at $CONFIG_FILE"

# 数据库初始化 - 检查是否需要运行 migration
echo "Checking database initialization..."
if ! npx prisma db pull 2>/dev/null | grep -q "accounts"; then
    echo "Database not initialized, running migrations..."
    npx prisma migrate deploy --skip-generate || echo "Migration failed or database already initialized"
else
    echo "Database tables already exist, skipping migration"
fi

echo "Starting GeoBlinko server..."

# 启动服务器（使用 node 而不是 bun）
exec node /app/server/index.js

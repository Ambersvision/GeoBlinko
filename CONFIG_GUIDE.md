# GeoBlinko 环境变量配置指南

本指南说明如何为预构建的 Docker 镜像配置环境变量，无需重新构建镜像。

## 工作原理

预构建的 Docker 镜像使用**运行时环境变量注入**技术：

1. **前端变量注入**：Docker 容器启动时，启动脚本将 `docker-compose.yml` 中定义的前端环境变量（`VITE_` 或 `NEXT_PUBLIC_` 前缀）注入到 `config.js` 文件
2. **前端读取配置**：前端代码从 `window.__BLINKO_CONFIG__` 对象读取配置
3. **后端变量**：后端直接从 `process.env` 读取环境变量，无需注入
4. **前端调用后端 API**：前端优先通过后端 API（如 `/v1/config/amap-key`）获取配置，后端 API 会读取 `process.env` 中的变量

这样用户只需修改 `docker-compose.yml` 即可设置自己的环境变量，无需重新构建镜像。

## 添加新的环境变量

### 步骤 1: 在 `docker-compose.yml` 中添加环境变量

编辑 `docker-compose.yml`，在 `blinko-website` 服务的 `environment` 部分添加新变量：

```yaml
services:
  blinko-website:
    environment:
      # 现有变量...
      VITE_AMAP_WEB_API_KEY: "your_key_here"
      NEXT_PUBLIC_AMAP_WEB_API_KEY: "your_key_here"
      AMAP_WEB_API_KEY: "your_key_here"
      # 添加新变量
      VITE_YOUR_NEW_KEY: "your_new_key_here"
```

### 步骤 2: 根据变量类型选择配置方式

**情况 A：前端可见变量**（`VITE_` 或 `NEXT_PUBLIC_` 前缀）

如果新的环境变量是前端需要直接使用的，在 `Dockerfile` 的启动脚本 `INJECT_VARS` 中添加：

```dockerfile
INJECT_VARS="VITE_AMAP_WEB_API_KEY NEXT_PUBLIC_AMAP_WEB_API_KEY VITE_YOUR_NEW_KEY"
```

然后在 `docker-compose.yml` 中添加：

```yaml
environment:
  VITE_YOUR_NEW_KEY: "your_value_here"
```

前端代码中从配置对象读取：

```typescript
const blinkoConfig = (window as any).__BLINKO_CONFIG__ || {};
const newKey = blinkoConfig.VITE_YOUR_NEW_KEY;
```

**情况 B：仅后端使用的变量**（无特殊前缀）

如果新的环境变量仅后端使用，只需在 `docker-compose.yml` 中添加即可，无需修改 Dockerfile：

```yaml
environment:
  YOUR_BACKEND_ONLY_KEY: "your_value_here"
```

后端代码中直接从 `process.env` 读取：

```typescript
const key = process.env.YOUR_BACKEND_ONLY_KEY;
```

### 步骤 3: 在前端代码中使用配置

在 TypeScript/React 代码中，从配置对象读取：

```typescript
// 获取全局配置对象
const blinkoConfig = (window as any).__BLINKO_CONFIG__ || {};

// 使用配置
const apiKey = blinkoConfig.VITE_YOUR_NEW_KEY;
```

### 步骤 4: 重新构建镜像（如果修改了 Dockerfile）

如果您修改了 Dockerfile 的启动脚本，需要重新构建镜像：

```bash
docker-compose build --no-cache blinko-website
docker-compose up -d
```

如果您只修改了 `docker-compose.yml` 的环境变量值，只需重启容器：

```bash
docker-compose restart blinko-website
```

## 当前支持的环境变量

以下环境变量已配置并可直接使用：

| 环境变量 | 用途 | 是否注入前端 | 示例值 |
|----------|------|------------|---------|
| `VITE_AMAP_WEB_API_KEY` | 高德地图 Web API Key（前端备用） | ✅ 是 | `494ffc7b7f40fccd775ca3227e6d8804` |
| `NEXT_PUBLIC_AMAP_WEB_API_KEY` | Next.js 前端配置（前端备用） | ✅ 是 | `494ffc7b7f40fccd775ca3227e6d8804` |
| `AMAP_WEB_API_KEY` | 高德地图 Web API Key（后端） | ❌ 否 | `ed4327e40666552c8f0d543748b18a38` |

**说明：**
- **前端变量**（`VITE_` 或 `NEXT_PUBLIC_` 前缀）：会注入到 `config.js`，前端代码可直接从 `window.__BLINKO_CONFIG__` 读取
- **后端变量**（无特殊前缀）：直接从 `process.env` 读取，无需注入到前端
- `AMAP_WEB_API_KEY` 是后端使用的变量，不需要注入到前端配置文件

## 命名约定

- **前端可见变量**：使用 `VITE_` 或 `NEXT_PUBLIC_` 前缀，这些变量会被注入到前端配置
- **后端变量**：无特殊前缀，仅供后端使用
- **配置优先级**：前端优先从 `window.__BLINKO_CONFIG__` 读取，失败时尝试后端 API

## 验证配置

启动容器后，可以检查配置是否正确注入：

```bash
# 进入容器
docker exec -it Geoblinko-website sh

# 查看配置文件
cat /app/server/public/config.js

# 查看环境变量
printenv | grep AMAP
```

在浏览器中，打开控制台并输入：

```javascript
console.log(window.__BLINKO_CONFIG__)
```

应该看到配置对象包含所有环境变量的值。

## 常见问题

### Q: 为什么有些变量需要 `VITE_` 前缀？

A: 这是 Vite 构建工具的约定。在开发模式下，Vite 会将 `VITE_` 前缀的环境变量注入到前端代码。在生产模式的运行时注入中，我们保留这个约定以保持一致性。

### Q: 可以添加多少个环境变量？

A: 理论上没有限制。只需在 Dockerfile 的启动脚本中列出需要注入的变量名。

### Q: 配置注入失败怎么办？

A: 检查容器日志：

```bash
docker logs Geoblinko-website
```

查看是否有 "Injecting environment variables to config.js..." 和 "Configuration injected successfully:" 消息。

### Q: 修改环境变量后需要重启容器吗？

A: 是的，因为配置注入发生在容器启动时。

```bash
docker-compose restart blinko-website
```

## 示例：添加 OpenAI API Key

假设您想添加 OpenAI API Key 支持：

**方式一：前端需要使用（注入到 config.js）**

1. 在 `docker-compose.yml` 中添加：
   ```yaml
   environment:
     VITE_OPENAI_API_KEY: "sk-your-key-here"
   ```

2. 在 Dockerfile 的启动脚本中添加（因为需要前端可见）：
   ```dockerfile
   INJECT_VARS="VITE_AMAP_WEB_API_KEY NEXT_PUBLIC_AMAP_WEB_API_KEY VITE_OPENAI_API_KEY"
   ```

3. 在前端代码中使用：
   ```typescript
   const blinkoConfig = (window as any).__BLINKO_CONFIG__ || {};
   const openAIKey = blinkoConfig.VITE_OPENAI_API_KEY;
   ```

4. 重新构建镜像：
   ```bash
   docker-compose build --no-cache blinko-website
   docker-compose up -d
   ```

**方式二：仅后端使用（无需注入）**

1. 在 `docker-compose.yml` 中添加：
   ```yaml
   environment:
     OPENAI_API_KEY: "sk-your-key-here"
   ```

2. 后端代码中直接读取：
   ```typescript
   const apiKey = process.env.OPENAI_API_KEY;
   ```

3. 无需重新构建镜像，只需重启容器：
   ```bash
   docker-compose restart blinko-website
   ```

现在所有用户都可以在 `docker-compose.yml` 中设置自己的 OpenAI API Key！

## 安全注意事项

- 不要将 `docker-compose.yml` 包含真实 API Key 的版本提交到 Git
- 创建一个 `docker-compose.yml.example` 模板文件
- 在部署时使用环境变量文件或密钥管理工具（如 Docker Secrets）

## 技术细节

配置注入在 Docker 容器的启动脚本 `start.sh` 中执行：

1. 检查环境变量是否定义
2. 如果定义了，转义特殊字符（引号、反斜杠等）
3. 构建 JavaScript 配置对象
4. 写入到 `/app/server/public/config.js`
5. 前端通过 `<script src="/config.js"></script>` 加载

这种方法的优点：
- ✅ 无需重新构建镜像即可更改配置
- ✅ 支持动态配置更新
- ✅ 适用于所有用户，包括使用预构建镜像的用户
- ✅ 配置集中管理，易于维护

## 相关文件

- `docker-compose.yml` - 定义环境变量
- `Dockerfile` - 包含启动脚本（配置注入逻辑）
- `app/public/config.js` - 配置文件模板（运行时生成）
- `app/index.html` - 加载配置文件
- `app/src/components/LocationPicker/index.tsx` - 使用配置的示例

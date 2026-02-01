# 地图服务配置指南

GeoBlinko 支持多个地图服务提供商，可以自动根据用户位置选择合适的地图服务。

## 支持的地图服务

### 1. 高德地图 (Amap) - 中国地区
- **适用场景**: 中国大陆地区
- **优点**: 数据准确，性能好
- **需要 API Key**: 是
- **获取方式**: [高德开放平台](https://lbs.amap.com/)

### 2. Google Maps - 国际地区
- **适用场景**: 中国以外地区
- **优点**: 全球覆盖，数据丰富
- **需要 API Key**: 是
- **获取方式**: [Google Cloud Console](https://console.cloud.google.com/)

### 3. OpenStreetMap (Leaflet) - 免费备用
- **适用场景**: 任何地区（备用方案）
- **优点**: 完全免费，无需 API Key
- **需要 API Key**: 否
- **注意**: 数据更新依赖社区，某些地区可能不够准确

## 配置方式

### 方法 1: 环境变量配置（推荐）

在 `docker-compose.yml` 中添加以下环境变量：

```yaml
services:
  blinko:
    environment:
      # 地图服务提供商
      # auto: 自动选择（国内用高德，国外用 Google）
      # amap: 强制使用高德地图
      # google: 强制使用 Google Maps
      # osm: 强制使用 OpenStreetMap
      - MAP_PROVIDER=auto

      # 高德地图 API Key（可选，中国地区需要）
      - AMAP_WEB_API_KEY=your_amap_key_here
      - VITE_AMAP_WEB_API_KEY=your_amap_key_here

      # Google Maps API Key（可选，国际地区需要）
      - GOOGLE_MAPS_API_KEY=your_google_maps_key_here
      - VITE_GOOGLE_MAPS_API_KEY=your_google_maps_key_here
```

### 方法 2: .env 文件配置

创建或编辑 `.env` 文件：

```env
# 地图服务提供商
MAP_PROVIDER=auto

# 高德地图 API Key
AMAP_WEB_API_KEY=your_amap_key_here
VITE_AMAP_WEB_API_KEY=your_amap_key_here

# Google Maps API Key
GOOGLE_MAPS_API_KEY=your_google_maps_key_here
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_key_here
```

## MAP_PROVIDER 配置选项

### auto（自动选择）
系统会根据用户当前位置自动选择合适的地图服务：
- 在中国境内：使用高德地图
- 在中国境外：使用 Google Maps（如果有 API Key），否则使用 OpenStreetMap

### amap（高德地图）
强制使用高德地图服务，适用于：
- 只在中国境内使用
- 已经有高德地图 API Key
- 需要最佳的中国地区地图体验

**注意**: 高德地图在国外无法使用

### google（Google Maps）
强制使用 Google Maps 服务，适用于：
- 主要在海外使用
- 已经有 Google Maps API Key
- 需要全球一致的地图体验

### osm（OpenStreetMap）
使用开源的 OpenStreetMap，适用于：
- 不想配置 API Key
- 开发和测试环境
- 数据准确性要求不高的场景

## 获取 API Key

### 高德地图 API Key

1. 访问 [高德开放平台](https://lbs.amap.com/)
2. 注册并登录账号
3. 进入控制台 -> 应用管理 -> 我的应用
4. 创建新应用，选择「Web端（JS API）」
5. 获取 API Key（Web端 JS API）
6. 在配置文件中填入 Key

### Google Maps API Key

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用以下 API：
   - Maps JavaScript API
   - Places API
   - Geocoding API
4. 创建凭据 -> API Key
5. 设置 API Key 限制（推荐）：
   - 应用限制：HTTP referrers
   - 添加你的域名
6. 在配置文件中填入 Key

## 工作原理

### 自动选择逻辑（MAP_PROVIDER=auto）

```typescript
function selectProvider(lat, lon) {
  const inChina = isInsideChina(lat, lon);  // 检查是否在中国境内
  
  if (inChina && hasAmapKey) {
    return MapProvider.AMAP;
  } else if (hasGoogleKey) {
    return MapProvider.GOOGLE;
  } else {
    return MapProvider.OSM;  // 降级到 OpenStreetMap
  }
}
```

### 坐标系转换

- **高德地图**: 使用 GCJ02 坐标系（火星坐标系）
- **Google Maps**: 使用 WGS84 坐标系（标准 GPS）
- **OpenStreetMap**: 使用 WGS84 坐标系

系统会自动处理坐标系转换，无需手动干预。

## 故障排查

### 问题 1: 地图无法加载

**可能原因**:
- API Key 未配置或配置错误
- API Key 未启用相应的 API 服务
- 网络连接问题

**解决方法**:
1. 检查环境变量是否正确配置
2. 检查 API Key 是否启用了所需的 API 服务
3. 查看浏览器控制台的错误信息
4. 尝试切换到 MAP_PROVIDER=osm（无需 API Key）

### 问题 2: 国外无法使用

**可能原因**:
- MAP_PROVIDER 设置为 `amap`
- 没有配置 Google Maps API Key

**解决方法**:
1. 将 MAP_PROVIDER 改为 `auto` 或 `google`
2. 配置 GOOGLE_MAPS_API_KEY
3. 或者设置 MAP_PROVIDER=osm 使用 OpenStreetMap

### 问题 3: 地图位置偏移

**可能原因**:
- 坐标系转换问题

**解决方法**:
- 系统已自动处理坐标系转换，如果仍有问题，请：
  1. 确认 MAP_PROVIDER 设置正确
  2. 查看后端日志是否有错误
  3. 在 GitHub 提交 issue

## 性能优化建议

1. **API Key 限制**: 为生产环境配置 API Key 的使用限制
2. **缓存机制**: 后端已实现地理位置缓存，减少 API 调用
3. **自动选择**: 推荐使用 MAP_PROVIDER=auto，系统会根据位置自动选择最优服务

## 开发环境

在开发环境中，可以设置：

```env
MAP_PROVIDER=osm  # 使用免费的 OpenStreetMap，无需 API Key
```

这样可以快速开发和测试，无需配置任何 API Key。

## 生产环境

在生产环境，推荐配置：

```env
MAP_PROVIDER=auto
AMAP_WEB_API_KEY=your_amap_key
VITE_AMAP_WEB_API_KEY=your_amap_key
GOOGLE_MAPS_API_KEY=your_google_maps_key
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_key
```

这样可以确保全球用户都能正常使用地理位置功能。

## 相关链接

- 高德开放平台: https://lbs.amap.com/
- Google Maps Platform: https://developers.google.com/maps
- OpenStreetMap: https://www.openstreetmap.org/
- Leaflet (OSM): https://leafletjs.com/

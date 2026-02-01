import { api } from '@/lib/trpc';

// 地图提供商类型
export enum MapProvider {
  AUTO = 'auto',           // 自动选择
  AMAP = 'amap',           // 高德地图
  GOOGLE = 'google',       // Google Maps
  OPENSTREETMAP = 'osm'    // OpenStreetMap (Leaflet)
}

/**
 * 判断坐标是否在中国境内
 */
function isInsideChina(lat: number, lon: number): boolean {
  return lon >= 72.004 && lon <= 137.8347 && lat >= 0.8293 && lat <= 55.8271;
}

/**
 * WGS84 转 GCJ02 坐标转换（高德坐标系）
 */
export function wgs84ToGcj02(lat: number, lon: number) {
  const PI = 3.14159265358979324;
  const A = 6378245.0;
  const EE = 0.00669342162296594323;
  const outOfChina = (lat: number, lng: number) => lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;

  if (outOfChina(lat, lon)) return { latitude: lat, longitude: lon };

  const transformLat = (x: number, y: number) => {
    let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
    ret += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0;
    return ret;
  };

  const transformLng = (x: number, y: number) => {
    let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0;
    ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0;
    return ret;
  };

  let dLat = transformLat(lon - 105.0, lat - 35.0);
  let dLng = transformLng(lon - 105.0, lat - 35.0);
  const radLat = lat / 180.0 * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
  dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);

  return {
    latitude: lat + dLat,
    longitude: lon + dLng
  };
}

/**
 * 高德地图加载器
 */
export class AmapLoader {
  private static scriptPromise: Promise<any> | null = null;

  static async load(apiKey: string): Promise<any> {
    if (typeof window === 'undefined') return null;
    if ((window as any).AMap) return (window as any).AMap;

    if (this.scriptPromise) {
      return this.scriptPromise;
    }

    this.scriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector('script[data-amap="v2"]');
      if (existing) {
        if ((window as any).AMap) {
          resolve();
        } else {
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', () => reject(new Error('AMap load error')), { once: true });
        }
        return;
      }

      const script = document.createElement('script');
      script.setAttribute('data-amap', 'v2');
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${apiKey}`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('AMap load error'));
      document.head.appendChild(script);
    });

    return (window as any).AMap;
  }
}

/**
 * Google Maps 加载器
 */
export class GoogleMapsLoader {
  private static scriptPromise: Promise<any> | null = null;

  static async load(apiKey: string): Promise<any> {
    if (typeof window === 'undefined') return null;
    if ((window as any).google?.maps) return (window as any).google.maps;

    if (this.scriptPromise) {
      return this.scriptPromise;
    }

    this.scriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector('script[data-google="maps"]');
      if (existing) {
        if ((window as any).google?.maps) {
          resolve();
        } else {
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', () => reject(new Error('Google Maps load error')), { once: true });
        }
        return;
      }

      const script = document.createElement('script');
      script.setAttribute('data-google', 'maps');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geocoding`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Google Maps load error'));
      document.head.appendChild(script);
    });

    return (window as any).google.maps;
  }
}

/**
 * Leaflet (OpenStreetMap) 加载器
 */
export class LeafletLoader {
  private static cssLoaded = false;
  private static scriptPromise: Promise<any> | null = null;

  static async load(): Promise<any> {
    if (typeof window === 'undefined') return null;
    if ((window as any).L) return (window as any).L;

    if (this.scriptPromise) {
      return this.scriptPromise;
    }

    // 加载 CSS
    if (!this.cssLoaded) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
      this.cssLoaded = true;
    }

    this.scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Leaflet load error'));
      document.head.appendChild(script);
    });

    return (window as any).L;
  }
}

/**
 * 地图服务配置
 */
interface MapServiceConfig {
  provider: MapProvider;
  amapApiKey?: string;
  googleApiKey?: string;
}

/**
 * 获取地图服务配置
 */
async function getMapConfig(): Promise<MapServiceConfig> {
  const blinkoConfig = (window as any).__BLINKO_CONFIG__ || {};

  // 尝试从后端获取高德 API Key
  let amapApiKey = blinkoConfig.VITE_AMAP_WEB_API_KEY ||
                   blinkoConfig.NEXT_PUBLIC_AMAP_WEB_API_KEY ||
                   blinkoConfig.AMAP_WEB_API_KEY;

  if (!amapApiKey) {
    try {
      const keyResult = await api.config.getAmapKey.query();
      amapApiKey = keyResult.key;
    } catch (error) {
      // Ignore error
    }
  }

  const googleApiKey = blinkoConfig.VITE_GOOGLE_MAPS_API_KEY ||
                      blinkoConfig.GOOGLE_MAPS_API_KEY;

  const providerStr = blinkoConfig.MAP_PROVIDER || MapProvider.AUTO;
  const provider = Object.values(MapProvider).includes(providerStr as MapProvider)
    ? providerStr as MapProvider
    : MapProvider.AUTO;

  return {
    provider,
    amapApiKey: amapApiKey || undefined,
    googleApiKey
  };
}

/**
 * 地图服务类
 */
export class MapService {
  private config: MapServiceConfig | null = null;
  private currentMap: any = null;
  private currentMarker: any = null;
  private mapType: MapProvider = MapProvider.OPENSTREETMAP;

  async initConfig() {
    if (!this.config) {
      this.config = await getMapConfig();
    }
    return this.config;
  }

  /**
   * 选择地图提供商
   */
  selectMapProvider(latitude?: number, longitude?: number): MapProvider {
    if (!this.config) {
      return MapProvider.OPENSTREETMAP; // 默认使用 OpenStreetMap
    }

    const provider = this.config.provider;

    if (provider === MapProvider.AMAP && this.config.amapApiKey) {
      return MapProvider.AMAP;
    }

    if (provider === MapProvider.GOOGLE && this.config.googleApiKey) {
      return MapProvider.GOOGLE;
    }

    if (provider === MapProvider.OPENSTREETMAP) {
      return MapProvider.OPENSTREETMAP;
    }

    // AUTO 模式：根据位置自动选择
    if (latitude !== undefined && longitude !== undefined) {
      const inChina = isInsideChina(latitude, longitude);
      if (inChina && this.config.amapApiKey) {
        return MapProvider.AMAP;
      } else if (this.config.googleApiKey) {
        return MapProvider.GOOGLE;
      }
    }

    // 降级策略：OpenStreetMap (免费，无需 API Key)
    return MapProvider.OPENSTREETMAP;
  }

  /**
   * 初始化地图
   */
  async initMap(container: HTMLElement, latitude: number, longitude: number): Promise<any> {
    await this.initConfig();
    const provider = this.selectMapProvider(latitude, longitude);
    this.mapType = provider;

    switch (provider) {
      case MapProvider.AMAP:
        return this.initAmap(container, latitude, longitude);
      case MapProvider.GOOGLE:
        return this.initGoogleMaps(container, latitude, longitude);
      case MapProvider.OPENSTREETMAP:
      default:
        return this.initLeaflet(container, latitude, longitude);
    }
  }

  /**
   * 初始化高德地图
   */
  private async initAmap(container: HTMLElement, latitude: number, longitude: number) {
    if (!this.config?.amapApiKey) {
      throw new Error('Amap API Key is required');
    }

    const AMap = await AmapLoader.load(this.config.amapApiKey);

    // 等待地图 SDK 完全初始化
    await new Promise<void>((resolve) => setTimeout(resolve, 200));

    const map = new AMap.Map(container, {
      zoom: 15,
      center: [longitude, latitude],
      viewMode: '3D',
      resizeEnable: true
    });

    const marker = new AMap.Marker({
      position: [longitude, latitude],
      draggable: false,
      cursor: 'default'
    });
    map.add(marker);

    this.currentMap = map;
    this.currentMarker = marker;

    return { map, marker, AMap };
  }

  /**
   * 初始化 Google Maps
   */
  private async initGoogleMaps(container: HTMLElement, latitude: number, longitude: number) {
    if (!this.config?.googleApiKey) {
      throw new Error('Google Maps API Key is required');
    }

    const googleMaps = await GoogleMapsLoader.load(this.config.googleApiKey);

    const map = new googleMaps.Map(container, {
      zoom: 15,
      center: { lat: latitude, lng: longitude },
      mapTypeId: 'roadmap'
    });

    const marker = new googleMaps.Marker({
      position: { lat: latitude, lng: longitude },
      map: map,
      draggable: false
    });

    this.currentMap = map;
    this.currentMarker = marker;

    return { map, marker, googleMaps };
  }

  /**
   * 初始化 Leaflet (OpenStreetMap)
   */
  private async initLeaflet(container: HTMLElement, latitude: number, longitude: number) {
    const L = await LeafletLoader.load();

    const map = L.map(container, {
      zoom: 15,
      center: [latitude, longitude]
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const marker = L.marker([latitude, longitude]).addTo(map);

    this.currentMap = map;
    this.currentMarker = marker;

    return { map, marker, L };
  }

  /**
   * 更新地图中心点
   */
  setCenter(latitude: number, longitude: number) {
    if (!this.currentMap) return;

    switch (this.mapType) {
      case MapProvider.AMAP:
        this.currentMap.setCenter([longitude, latitude]);
        break;
      case MapProvider.GOOGLE:
        this.currentMap.setCenter({ lat: latitude, lng: longitude });
        break;
      case MapProvider.OPENSTREETMAP:
        this.currentMap.setView([latitude, longitude]);
        break;
    }
  }

  /**
   * 更新标记位置
   */
  updateMarker(latitude: number, longitude: number) {
    if (!this.currentMap || !this.currentMarker) return;

    switch (this.mapType) {
      case MapProvider.AMAP:
        this.currentMarker.setPosition([longitude, latitude]);
        break;
      case MapProvider.GOOGLE:
        this.currentMarker.setPosition({ lat: latitude, lng: longitude });
        break;
      case MapProvider.OPENSTREETMAP:
        this.currentMarker.setLatLng([latitude, longitude]);
        break;
    }
  }

  /**
   * 添加点击事件监听器
   */
  onClick(callback: (lat: number, lng: number) => void) {
    if (!this.currentMap) return;

    switch (this.mapType) {
      case MapProvider.AMAP:
        this.currentMap.on('click', (e: any) => {
          callback(e.lnglat.getLat(), e.lnglat.getLng());
        });
        break;
      case MapProvider.GOOGLE:
        this.currentMap.addListener('click', (e: any) => {
          callback(e.latLng.lat(), e.latLng.lng());
        });
        break;
      case MapProvider.OPENSTREETMAP:
        this.currentMap.on('click', (e: any) => {
          callback(e.latlng.lat, e.latlng.lng);
        });
        break;
    }
  }

  /**
   * 销毁地图
   */
  destroy() {
    if (!this.currentMap) return;

    switch (this.mapType) {
      case MapProvider.AMAP:
      case MapProvider.OPENSTREETMAP:
        if (this.currentMap.destroy) {
          this.currentMap.destroy();
        }
        break;
      case MapProvider.GOOGLE:
        // Google Maps 不需要手动销毁
        break;
    }

    this.currentMap = null;
    this.currentMarker = null;
  }
}

// 导出单例
export const mapService = new MapService();
export default mapService;

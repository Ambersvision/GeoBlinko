import axios from 'axios';

// 地图服务提供商类型
export enum MapProvider {
  AUTO = 'auto',           // 自动选择（国内用高德，国外用Google）
  AMAP = 'amap',           // 高德地图
  GOOGLE = 'google',       // Google Maps
  OPENSTREETMAP = 'osm'    // OpenStreetMap (免费)
}

/**
 * 地图服务配置
 */
export interface MapConfig {
  provider: MapProvider;
  amapApiKey?: string;
  googleApiKey?: string;
  // OpenStreetMap 不需要 API Key
}

/**
 * 地理位置信息
 */
export interface LocationInfo {
  id: string;
  name: string;
  address: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  distance?: string;
  type?: string;
  poiName?: string;
  province?: string;
  city?: string;
  district?: string;
  street?: string;
}

/**
 * 逆地理编码结果
 */
export interface ReverseGeocodeResult {
  address: string;
  formattedAddress: string;
  province: string;
  city: string;
  district: string;
  street: string;
  poiName?: string;
  distance?: string;
}

/**
 * 判断坐标是否在中国境内
 */
function isInsideChina(lat: number, lon: number): boolean {
  // 中国大致范围：纬度 0-55，经度 73-136
  // 添加一些缓冲区域
  return lon >= 72.004 && lon <= 137.8347 && lat >= 0.8293 && lat <= 55.8271;
}

/**
 * 从环境变量获取地图服务配置
 */
function getMapConfig(): MapConfig {
  const providerStr = process.env.MAP_PROVIDER || MapProvider.AUTO;
  const provider = Object.values(MapProvider).includes(providerStr as MapProvider)
    ? providerStr as MapProvider
    : MapProvider.AUTO;

  return {
    provider,
    amapApiKey: process.env.AMAP_WEB_API_KEY || process.env.VITE_AMAP_WEB_API_KEY || process.env.NEXT_PUBLIC_AMAP_WEB_API_KEY,
    googleApiKey: process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY
  };
}

/**
 * 高德地图客户端
 */
class AmapClient {
  private apiKey: string;
  private baseURL = 'https://restapi.amap.com';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async searchLocation(params: {
    keyword: string;
    city?: string;
    pageSize?: number;
  }): Promise<LocationInfo[]> {
    const { keyword, city = '', pageSize = 10 } = params;

    const response = await axios.get(`${this.baseURL}/v5/place/text`, {
      params: {
        key: this.apiKey,
        keywords: keyword,
        city,
        pageSize,
        extensions: 'all'
      },
      timeout: 10000
    });

    if (response.data.status !== '1') {
      throw new Error(`Amap API error: ${response.data.info}`);
    }

    return (response.data.pois || []).map((poi: any) => ({
      id: poi.id,
      name: poi.name,
      address: poi.address || '',
      formattedAddress: `${poi.pname}${poi.cityname}${poi.adname}${poi.address || ''}`,
      latitude: parseFloat(poi.location.split(',')[1]),
      longitude: parseFloat(poi.location.split(',')[0]),
      distance: poi.distance ? `${Math.round(parseInt(poi.distance))} 米` : undefined,
      type: poi.type,
      poiName: poi.name,
      province: poi.pname,
      city: poi.cityname,
      district: poi.adname,
      street: poi.address
    }));
  }

  async searchNearby(params: {
    latitude: number;
    longitude: number;
    keywords?: string;
    radius?: number;
    pageSize?: number;
  }): Promise<LocationInfo[]> {
    const { latitude, longitude, keywords = '', radius = 500, pageSize = 10 } = params;
    const location = `${longitude},${latitude}`;

    const response = await axios.get(`${this.baseURL}/v5/place/around`, {
      params: {
        key: this.apiKey,
        location,
        keywords,
        radius,
        pageSize,
        extensions: 'all'
      },
      timeout: 10000
    });

    if (response.data.status !== '1') {
      throw new Error(`Amap API error: ${response.data.info}`);
    }

    return (response.data.pois || []).map((poi: any) => ({
      id: poi.id,
      name: poi.name,
      address: poi.address || '',
      formattedAddress: `${poi.pname}${poi.cityname}${poi.adname}${poi.address || ''}`,
      latitude: parseFloat(poi.location.split(',')[1]),
      longitude: parseFloat(poi.location.split(',')[0]),
      distance: poi.distance ? `${Math.round(parseInt(poi.distance))} 米` : undefined,
      type: poi.type,
      poiName: poi.name,
      province: poi.pname,
      city: poi.cityname,
      district: poi.adname,
      street: poi.address
    }));
  }

  async reverseGeocode(params: {
    latitude: number;
    longitude: number;
  }): Promise<ReverseGeocodeResult> {
    const { latitude, longitude } = params;
    const location = `${longitude},${latitude}`;

    const response = await axios.get(`${this.baseURL}/v3/geocode/regeo`, {
      params: {
        key: this.apiKey,
        location,
        radius: 1000,
        extensions: 'all',
        poitype: '000000'
      },
      timeout: 10000
    });

    if (response.data.status !== '1') {
      throw new Error(`Amap API error: ${response.data.info}`);
    }

    const regeocode = response.data.regeocode;
    if (!regeocode) {
      throw new Error('No reverse geocode result');
    }

    const addressComponent = regeocode.addressComponent;
    const formattedAddress = regeocode.formatted_address;
    const aois = regeocode.aois || [];
    const pois = regeocode.pois || [];

    let address = '';
    let poiName: string | undefined;

    if (aois.length > 0) {
      const aoi = aois[0];
      address = `${addressComponent.district || ''}${aoi.name || ''}${addressComponent.township || ''}${addressComponent.streetNumber?.name || ''}`;
      poiName = aoi.name;
    } else if (pois.length > 0) {
      const poi = pois[0];
      address = `${addressComponent.district || ''}${poi.name || ''}${addressComponent.streetNumber?.name || ''}`;
      poiName = poi.name;
    } else {
      address = `${addressComponent.district || ''}${addressComponent.streetNumber?.name || ''}`;
    }

    return {
      address,
      formattedAddress,
      province: addressComponent.province || '',
      city: Array.isArray(addressComponent.city) ? addressComponent.city[0] : (addressComponent.city || ''),
      district: addressComponent.district || '',
      street: addressComponent.township || '',
      poiName,
      distance: pois.length > 0 && pois[0].distance ? `${pois[0].distance} 米` : undefined
    };
  }
}

/**
 * Google Maps 客户端
 */
class GoogleMapsClient {
  private apiKey: string;
  private baseURL = 'https://maps.googleapis.com/maps/api';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async searchLocation(params: {
    keyword: string;
    pageSize?: number;
  }): Promise<LocationInfo[]> {
    const { keyword, pageSize = 10 } = params;

    const response = await axios.get(`${this.baseURL}/place/textsearch/json`, {
      params: {
        query: keyword,
        key: this.apiKey,
        fields: 'place_id,name,formatted_address,geometry',
        language: 'en'
      },
      timeout: 10000
    });

    if (response.data.status !== 'OK') {
      throw new Error(`Google Maps API error: ${response.data.status}`);
    }

    return response.data.results.slice(0, pageSize).map((place: any) => ({
      id: place.place_id,
      name: place.name,
      address: place.formatted_address,
      formattedAddress: place.formatted_address,
      latitude: place.geometry.location.lat,
      longitude: place.geometry.location.lng,
      type: 'place',
      poiName: place.name
    }));
  }

  async searchNearby(params: {
    latitude: number;
    longitude: number;
    keywords?: string;
    radius?: number;
    pageSize?: number;
  }): Promise<LocationInfo[]> {
    const { latitude, longitude, keywords = '', radius = 500, pageSize = 10 } = params;

    const response = await axios.get(`${this.baseURL}/place/nearbysearch/json`, {
      params: {
        location: `${latitude},${longitude}`,
        radius,
        keyword: keywords,
        key: this.apiKey,
        language: 'en'
      },
      timeout: 10000
    });

    if (response.data.status !== 'OK') {
      throw new Error(`Google Maps API error: ${response.data.status}`);
    }

    return response.data.results.slice(0, pageSize).map((place: any) => ({
      id: place.place_id,
      name: place.name,
      address: place.vicinity || '',
      formattedAddress: place.vicinity || place.name,
      latitude: place.geometry.location.lat,
      longitude: place.geometry.location.lng,
      distance: undefined,
      type: 'place',
      poiName: place.name
    }));
  }

  async reverseGeocode(params: {
    latitude: number;
    longitude: number;
  }): Promise<ReverseGeocodeResult> {
    const { latitude, longitude } = params;

    const response = await axios.get(`${this.baseURL}/geocode/json`, {
      params: {
        latlng: `${latitude},${longitude}`,
        key: this.apiKey,
        language: 'en'
      },
      timeout: 10000
    });

    if (response.data.status !== 'OK') {
      throw new Error(`Google Maps API error: ${response.data.status}`);
    }

    const result = response.data.results[0];
    const addressComponents = result.address_components;

    // 解析地址组件
    const getComponent = (types: string[]) => {
      return addressComponents.find((c: any) => types.some(t => c.types.includes(t)))?.long_name || '';
    };

    const city = getComponent(['locality', 'administrative_area_level_2', 'administrative_area_level_1']);
    const province = getComponent(['administrative_area_level_1', 'country']);
    const district = getComponent(['administrative_area_level_3', 'administrative_area_level_2']);
    const street = getComponent(['route', 'street_address']);

    return {
      address: result.formatted_address,
      formattedAddress: result.formatted_address,
      province,
      city,
      district,
      street,
      poiName: addressComponents.find((c: any) => c.types.includes('establishment'))?.long_name
    };
  }
}

/**
 * OpenStreetMap (Nominatim) 客户端 - 免费，无需 API Key
 */
class OpenStreetMapClient {
  private baseURL = 'https://nominatim.openstreetmap.org';

  async searchLocation(params: {
    keyword: string;
    pageSize?: number;
  }): Promise<LocationInfo[]> {
    const { keyword, pageSize = 10 } = params;

    const response = await axios.get(`${this.baseURL}/search`, {
      params: {
        q: keyword,
        format: 'json',
        limit: pageSize,
        addressdetails: 1
      },
      timeout: 10000,
      headers: {
        'User-Agent': 'GeoBlinko/1.0'
      }
    });

    return response.data.map((place: any) => ({
      id: place.place_id?.toString() || `osm_${Date.now()}_${Math.random()}`,
      name: place.display_name.split(',')[0],
      address: place.display_name,
      formattedAddress: place.display_name,
      latitude: parseFloat(place.lat),
      longitude: parseFloat(place.lon),
      type: place.type || 'place',
      poiName: place.display_name.split(',')[0]
    }));
  }

  async searchNearby(params: {
    latitude: number;
    longitude: number;
    keywords?: string;
    radius?: number;
    pageSize?: number;
  }): Promise<LocationInfo[]> {
    const { latitude, longitude, keywords = '', pageSize = 10 } = params;

    // OpenStreetMap 的 nearby search 需要使用 overpass API，这里简化为搜索当前坐标
    const response = await axios.get(`${this.baseURL}/reverse`, {
      params: {
        lat: latitude,
        lon: longitude,
        format: 'json',
        addressdetails: 1
      },
      timeout: 10000,
      headers: {
        'User-Agent': 'GeoBlinko/1.0'
      }
    });

    const place = response.data;

    // 基于当前地址返回简化结果
    return [{
      id: `osm_${Date.now()}`,
      name: place.display_name.split(',')[0],
      address: place.display_name,
      formattedAddress: place.display_name,
      latitude: parseFloat(place.lat),
      longitude: parseFloat(place.lon),
      distance: '0 米',
      type: 'current',
      poiName: place.display_name.split(',')[0]
    }];
  }

  async reverseGeocode(params: {
    latitude: number;
    longitude: number;
  }): Promise<ReverseGeocodeResult> {
    const { latitude, longitude } = params;

    const response = await axios.get(`${this.baseURL}/reverse`, {
      params: {
        lat: latitude,
        lon: longitude,
        format: 'json',
        addressdetails: 1
      },
      timeout: 10000,
      headers: {
        'User-Agent': 'GeoBlinko/1.0'
      }
    });

    const place = response.data.address || {};
    const addressParts = response.data.display_name.split(',').map((s: string) => s.trim());

    return {
      address: addressParts[0] || '',
      formattedAddress: response.data.display_name,
      province: place.state || place.country || '',
      city: place.city || place.town || place.village || '',
      district: place.suburb || place.district || '',
      street: place.road || place.street || '',
      poiName: addressParts[0]
    };
  }
}

/**
 * 统一地图服务客户端
 */
export class LocationService {
  private config: MapConfig;
  private amapClient?: AmapClient;
  private googleClient?: GoogleMapsClient;
  private osmClient: OpenStreetMapClient;

  constructor(config?: Partial<MapConfig>) {
    this.config = { ...getMapConfig(), ...config };
    this.osmClient = new OpenStreetMapClient();

    if (this.config.amapApiKey) {
      this.amapClient = new AmapClient(this.config.amapApiKey);
    }
    if (this.config.googleApiKey) {
      this.googleClient = new GoogleMapsClient(this.config.googleApiKey);
    }
  }

  /**
   * 根据位置和配置选择合适的地图服务
   */
  private selectProvider(latitude?: number, longitude?: number): AmapClient | GoogleMapsClient | OpenStreetMapClient {
    const provider = this.config.provider;

    if (provider === MapProvider.AMAP && this.amapClient) {
      return this.amapClient;
    }

    if (provider === MapProvider.GOOGLE && this.googleClient) {
      return this.googleClient;
    }

    if (provider === MapProvider.OPENSTREETMAP) {
      return this.osmClient;
    }

    // AUTO 模式：根据位置自动选择
    if (latitude !== undefined && longitude !== undefined) {
      const inChina = isInsideChina(latitude, longitude);
      if (inChina && this.amapClient) {
        return this.amapClient;
      } else if (this.googleClient) {
        return this.googleClient;
      }
    }

    // 降级策略：Google Maps -> OSM -> Amap
    if (this.googleClient) {
      return this.googleClient;
    }
    if (this.amapClient) {
      return this.amapClient;
    }

    // 最后使用 OpenStreetMap（免费，无需 API Key）
    return this.osmClient;
  }

  async searchLocation(params: {
    keyword: string;
    city?: string;
    pageSize?: number;
  }): Promise<LocationInfo[]> {
    const client = this.selectProvider();
    return client.searchLocation(params);
  }

  async searchNearby(params: {
    latitude: number;
    longitude: number;
    keywords?: string;
    radius?: number;
    pageSize?: number;
  }): Promise<LocationInfo[]> {
    const client = this.selectProvider(params.latitude, params.longitude);
    return client.searchNearby(params);
  }

  async reverseGeocode(params: {
    latitude: number;
    longitude: number;
  }): Promise<ReverseGeocodeResult> {
    const client = this.selectProvider(params.latitude, params.longitude);
    return client.reverseGeocode(params);
  }

  /**
   * IP 定位（降级方案）
   */
  async getIPLocation(): Promise<LocationInfo> {
    try {
      const response = await axios.get('https://ipapi.co/json/', { timeout: 5000 });
      const data = response.data;

      const client = this.selectProvider(data.latitude, data.longitude);

      return {
        id: 'ip_location',
        name: data.city || 'Unknown',
        address: data.city || '',
        formattedAddress: `${data.city || ''}, ${data.country_name || ''}`,
        latitude: data.latitude || 0,
        longitude: data.longitude || 0,
        province: data.region || '',
        city: data.city || ''
      };
    } catch (error) {
      // IP 定位失败，返回默认值
      return {
        id: 'default_location',
        name: 'Default',
        address: '',
        formattedAddress: '',
        latitude: 0,
        longitude: 0
      };
    }
  }
}

// 导出默认实例
export const locationService = new LocationService();
export default locationService;

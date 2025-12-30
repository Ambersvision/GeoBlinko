import axios from 'axios';

// 从环境变量获取 API Key
const AMAP_API_KEY = process.env.AMAP_WEB_API_KEY || '';

if (!AMAP_API_KEY) {
  console.warn('AMAP_WEB_API_KEY is not set in environment variables');
}

/**
 * 高德地图 API 响应接口
 */
export interface AmapResponse<T> {
  status: string;
  info: string;
  infocode: string;
  data?: T;
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
 * POI 搜索结果
 */
export interface POISearchResult {
  id: string;
  name: string;
  address: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  distance?: number;
  type: string;
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
 * 高德地图 API 客户端类
 */
export class AmapClient {
  private apiKey: string;
  private baseURL = 'https://restapi.amap.com';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || AMAP_API_KEY;
    
    if (!this.apiKey) {
      throw new Error('Amap API Key is required');
    }
  }

  /**
   * POI 关键词搜索
   */
  async searchLocation(params: {
    keyword: string;
    city?: string;
    pageSize?: number;
    pageNumber?: number;
  }): Promise<LocationInfo[]> {
    const { keyword, city = '', pageSize = 10, pageNumber = 1 } = params;

    try {
      const url = `${this.baseURL}/v5/place/text`;
      const response = await axios.get<AmapResponse<{ pois: any[] }>>(url, {
        params: {
          key: this.apiKey,
          keywords: keyword,
          city,
          pageSize,
          pageNumber,
          extensions: 'all'
        },
        timeout: 10000
      });

      if (response.data.status !== '1') {
        throw new Error(`Amap API error: ${response.data.info}`);
      }

      const pois = response.data.pois || [];
      
      return pois.map(poi => ({
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
    } catch (error) {
      console.error('Search location error:', error);
      throw new Error('Failed to search location');
    }
  }

  /**
   * 周边搜索
   */
  async searchNearby(params: {
    latitude: number;
    longitude: number;
    keywords?: string;
    radius?: number;
    pageSize?: number;
  }): Promise<LocationInfo[]> {
    const { latitude, longitude, keywords = '', radius = 500, pageSize = 10 } = params;
    const location = `${longitude},${latitude}`;

    try {
      const url = `${this.baseURL}/v5/place/around`;
      const response = await axios.get<AmapResponse<{ pois: any[] }>>(url, {
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

      const pois = response.data.pois || [];
      
      return pois.map(poi => ({
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
    } catch (error) {
      console.error('Search nearby error:', error);
      throw new Error('Failed to search nearby locations');
    }
  }

  /**
   * 逆地理编码（坐标转地址）
   */
  async reverseGeocode(params: {
    latitude: number;
    longitude: number;
    radius?: number;
  }): Promise<ReverseGeocodeResult> {
    const { latitude, longitude, radius = 1000 } = params;
    const location = `${longitude},${latitude}`;

    try {
      const url = `${this.baseURL}/v3/geocode/regeo`;
      const response = await axios.get<AmapResponse<{ regeocode?: any }>>(url, {
        params: {
          key: this.apiKey,
          location,
          radius,
          extensions: 'all',
          poitype: '000000' // 获取所有 POI 类型
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

      // 优先使用 AOI（区域）信息
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
        if (poi.distance) {
          poiName += ` 附近 ${poi.distance} 米`;
        }
      } else {
        address = `${addressComponent.district || ''}${addressComponent.streetNumber?.name || ''}`;
      }

      return {
        address,
        formattedAddress,
        province: addressComponent.province || '',
        city: Array.isArray(addressComponent.city) 
          ? (addressComponent.city[0] || '') 
          : (addressComponent.city || ''),
        district: addressComponent.district || '',
        street: addressComponent.township || '',
        poiName,
        distance: pois.length > 0 && pois[0].distance ? `${pois[0].distance} 米` : undefined
      };
    } catch (error) {
      console.error('Reverse geocode error:', error);
      throw new Error('Failed to reverse geocode');
    }
  }

  /**
   * 地理编码（地址转坐标）
   */
  async geocode(params: {
    address: string;
    city?: string;
  }): Promise<LocationInfo[]> {
    const { address, city = '' } = params;

    try {
      const url = `${this.baseURL}/v3/geocode/geo`;
      const response = await axios.get<AmapResponse<{ geocodes?: any[] }>>(url, {
        params: {
          key: this.apiKey,
          address,
          city
        },
        timeout: 10000
      });

      if (response.data.status !== '1') {
        throw new Error(`Amap API error: ${response.data.info}`);
      }

      const geocodes = response.data.geocodes || [];
      
      return geocodes.map(geo => ({
        id: geo.id,
        name: geo.formatted_address || '',
        address: geo.formatted_address || '',
        formattedAddress: geo.formatted_address || '',
        latitude: parseFloat(geo.location.split(',')[1]),
        longitude: parseFloat(geo.location.split(',')[0]),
        type: geo.level || ''
      }));
    } catch (error) {
      console.error('Geocode error:', error);
      throw new Error('Failed to geocode');
    }
  }

  /**
   * 输入提示（自动补全）
   */
  async getInputTips(params: {
    keyword: string;
    city?: string;
    limit?: number;
  }): Promise<LocationInfo[]> {
    const { keyword, city = '', limit = 10 } = params;

    try {
      const url = `${this.baseURL}/v3/assistant/inputtips`;
      const response = await axios.get<AmapResponse<{ tips?: any[] }>>(url, {
        params: {
          key: this.apiKey,
          keywords: keyword,
          city,
          output: 'json',
          citylimit: true,
          limit
        },
        timeout: 10000
      });

      if (response.data.status !== '1') {
        throw new Error(`Amap API error: ${response.data.info}`);
      }

      const tips = response.data.tips || [];
      
      return tips.filter(tip => tip.location).map(tip => ({
        id: tip.id,
        name: tip.name,
        address: tip.address || '',
        formattedAddress: tip.district ? `${tip.district}${tip.address || ''}` : tip.address || '',
        latitude: parseFloat(tip.location.split(',')[1]),
        longitude: parseFloat(tip.location.split(',')[0]),
        district: tip.district || ''
      }));
    } catch (error) {
      console.error('Input tips error:', error);
      throw new Error('Failed to get input tips');
    }
  }

  /**
   * IP 定位
   */
  async getIPLocation(): Promise<LocationInfo> {
    try {
      const url = `${this.baseURL}/v3/ip`;
      const response = await axios.get<AmapResponse<{ rectangle?: string; province?: string; city?: string }>>(url, {
        params: {
          key: this.apiKey
        },
        timeout: 10000
      });

      if (response.data.status !== '1') {
        throw new Error(`Amap API error: ${response.data.info}`);
      }

      const rectangle = response.data.rectangle;
      if (!rectangle) {
        throw new Error('No location found');
      }

      // rectangle 格式：经度1,纬度1;经度2,纬度2
      const coords = rectangle.split(';');
      const startCoord = coords[0].split(',');
      const endCoord = coords[1].split(',');
      
      const longitude = (parseFloat(startCoord[0]) + parseFloat(endCoord[0])) / 2;
      const latitude = (parseFloat(startCoord[1]) + parseFloat(endCoord[1])) / 2;

      return {
        id: 'ip_location',
        name: response.data.province || '',
        address: response.data.city || '',
        formattedAddress: `${response.data.data?.province || ''}${response.data.data?.city || ''}`,
        latitude,
        longitude,
        province: response.data.data?.province,
        city: response.data.data?.city
      };
    } catch (error) {
      console.error('IP location error:', error);
      throw new Error('Failed to get IP location');
    }
  }
}

// 导出默认实例
export const amapClient = new AmapClient();
export default amapClient;

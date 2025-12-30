/**
 * 模拟地理位置服务（用于开发和测试）
 * 当没有配置高德地图 API Key 时使用
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
 * 模拟的 POI 数据库
 */
const MOCK_POIS = [
  {
    id: 'B000A7BD6J',
    name: '天安门广场',
    address: '东城区西长安街',
    formattedAddress: '北京市东城区西长安街天安门广场',
    latitude: 39.908823,
    longitude: 116.397470
  },
  {
    id: 'B000A7S3U4',
    name: '故宫博物院',
    address: '东城区景山前街4号',
    formattedAddress: '北京市东城区景山前街4号故宫博物院',
    latitude: 39.916345,
    longitude: 116.397155
  },
  {
    id: 'B000A7TZ8Q',
    name: '北京首都国际机场',
    address: '顺义区首都机场路',
    formattedAddress: '北京市顺义区首都机场路北京首都国际机场',
    latitude: 40.079861,
    longitude: 116.603142
  },
  {
    id: 'B000A7UTA5',
    name: '颐和园',
    address: '海淀区新建宫门路19号',
    formattedAddress: '北京市海淀区新建宫门路19号颐和园',
    latitude: 39.999911,
    longitude: 116.275642
  },
  {
    id: 'B000A7V0X8',
    name: '天坛公园',
    address: '东城区天坛东路甲1号',
    formattedAddress: '北京市东城区天坛东路甲1号天坛公园',
    latitude: 39.882231,
    longitude: 116.406617
  },
  {
    id: 'B000A7V5G3',
    name: '北京大学',
    address: '海淀区颐和园路5号',
    formattedAddress: '北京市海淀区颐和园路5号北京大学',
    latitude: 39.992653,
    longitude: 116.310502
  },
  {
    id: 'B000A7VBQ0',
    name: '清华大学',
    address: '海淀区双清路30号',
    formattedAddress: '北京市海淀区双清路30号清华大学',
    latitude: 39.999935,
    longitude: 116.326403
  },
  {
    id: 'B000A7W1F5',
    name: '国家大剧院',
    address: '西城区西长安街2号',
    formattedAddress: '北京市西城区西长安街2号国家大剧院',
    latitude: 39.903841,
    longitude: 116.392822
  },
  {
    id: 'B000A7W4K7',
    name: '鸟巢',
    address: '朝阳区国家体育场南路1号',
    formattedAddress: '北京市朝阳区国家体育场南路1号鸟巢',
    latitude: 39.992958,
    longitude: 116.388494
  },
  {
    id: 'B000A7W8H2',
    name: '水立方',
    address: '朝阳区天辰东路',
    formattedAddress: '北京市朝阳区天辰东路口水立方',
    latitude: 39.993039,
    longitude: 116.380782
  },
  {
    id: 'B000A7XC4',
    name: '三里屯',
    address: '朝阳区三里屯路',
    formattedAddress: '北京市朝阳区三里屯路三里屯',
    latitude: 39.936475,
    longitude: 116.455527
  },
  {
    id: 'B000A7XJ3',
    name: '王府井',
    address: '东城区王府井大街',
    formattedAddress: '北京市东城区王府井大街王府井',
    latitude: 39.913889,
    longitude: 116.410371
  },
  {
    id: 'B000A7YQ7',
    name: '中关村',
    address: '海淀区中关村大街',
    formattedAddress: '北京市海淀区中关村大街中关村',
    latitude: 39.981025,
    longitude: 116.315863
  },
  {
    id: 'B000A7ZB5',
    name: 'CBD中央商务区',
    address: '朝阳区建外大街',
    formattedAddress: '北京市朝阳区建外大街CBD中央商务区',
    latitude: 39.908529,
    longitude: 116.476767
  },
  {
    id: 'B000A8A1K4',
    name: '西单',
    address: '西城区西单北大街',
    formattedAddress: '北京市西城区西单北大街西单',
    latitude: 39.909709,
    longitude: 116.365384
  }
];

/**
 * 模拟地理位置服务客户端
 */
export class MockAmapClient {
  constructor() {
    console.log('[MockAmapClient] Using mock location service for development/testing');
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
    const { keyword, pageSize = 10 } = params;

    // 模拟延迟
    await this.delay(300);

    // 根据关键词筛选
    const filtered = MOCK_POIS.filter(poi =>
      poi.name.includes(keyword) ||
      poi.address.includes(keyword) ||
      poi.formattedAddress.includes(keyword)
    );

    // 如果没有匹配结果，返回一些随机结果用于测试
    const results = filtered.length > 0 ? filtered : MOCK_POIS.slice(0, 5);

    return results
      .slice(0, pageSize)
      .map(poi => ({
        ...poi,
        distance: this.calculateDistance(39.908823, 116.397470, poi.latitude, poi.longitude)
      }));
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
    const { latitude, longitude, pageSize = 10 } = params;

    await this.delay(300);

    // 按距离排序
    const sorted = MOCK_POIS.map(poi => ({
      ...poi,
      distance: this.calculateDistance(latitude, longitude, poi.latitude, poi.longitude)
    }))
      .sort((a, b) => {
        const distA = parseFloat(a.distance || '0');
        const distB = parseFloat(b.distance || '0');
        return distA - distB;
      })
      .slice(0, pageSize);

    return sorted;
  }

  /**
   * 逆地理编码（坐标转地址）
   */
  async reverseGeocode(params: {
    latitude: number;
    longitude: number;
    radius?: number;
  }): Promise<ReverseGeocodeResult> {
    const { latitude, longitude } = params;

    await this.delay(200);

    // 查找最近的 POI
    const nearest = this.findNearestPOI(latitude, longitude);

    return {
      address: nearest?.address || '未知位置',
      formattedAddress: nearest?.formattedAddress || '北京市未知位置',
      province: '北京市',
      city: '北京市',
      district: nearest?.district || '东城区',
      street: nearest?.street || '未知街道',
      poiName: nearest?.name,
      distance: nearest ? this.calculateDistance(latitude, longitude, nearest.latitude, nearest.longitude) : undefined
    };
  }

  /**
   * 地理编码（地址转坐标）
   */
  async geocode(params: {
    address: string;
    city?: string;
  }): Promise<LocationInfo[]> {
    const { address } = params;

    await this.delay(300);

    // 模拟根据地址查找
    const filtered = MOCK_POIS.filter(poi =>
      poi.name.includes(address) ||
      poi.address.includes(address) ||
      poi.formattedAddress.includes(address)
    );

    return filtered.length > 0 ? filtered : [{
      id: 'mock_geocode',
      name: address,
      address: address,
      formattedAddress: `北京市${address}`,
      latitude: 39.908823,
      longitude: 116.397470
    }];
  }

  /**
   * 输入提示（自动补全）
   */
  async getInputTips(params: {
    keyword: string;
    city?: string;
    limit?: number;
  }): Promise<LocationInfo[]> {
    const { keyword, limit = 10 } = params;

    await this.delay(150);

    const filtered = MOCK_POIS.filter(poi =>
      poi.name.includes(keyword) ||
      poi.address.includes(keyword)
    );

    return filtered.slice(0, limit);
  }

  /**
   * IP 定位
   */
  async getIPLocation(): Promise<LocationInfo> {
    await this.delay(200);

    return {
      id: 'ip_location',
      name: 'IP定位',
      address: '北京市',
      formattedAddress: '北京市',
      latitude: 39.908823,
      longitude: 116.397470,
      province: '北京市',
      city: '北京市'
    };
  }

  /**
   * 计算两点之间的距离（Haversine 公式）
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): string {
    const R = 6371000; // 地球半径（米）
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return `${Math.round(distance)} 米`;
  }

  /**
   * 角度转弧度
   */
  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * 查找最近的 POI
   */
  private findNearestPOI(latitude: number, longitude: number) {
    let nearest = null;
    let minDistance = Infinity;

    for (const poi of MOCK_POIS) {
      const dist = parseFloat(this.calculateDistance(latitude, longitude, poi.latitude, poi.longitude));
      if (dist < minDistance) {
        minDistance = dist;
        nearest = poi;
      }
    }

    return nearest;
  }

  /**
   * 模拟延迟
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 导出默认实例
export const mockAmapClient = new MockAmapClient();
export default mockAmapClient;

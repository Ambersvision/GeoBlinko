import { getPlatform, Platform, getPlatformConfig } from '@/utils/platform';

export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
}

export interface LocationError {
  code: number;
  message: string;
  name: string;
}

export type LocationPermission = 'granted' | 'denied' | 'prompt' | 'not-supported';

/**
 * 统一地理位置服务类
 * 支持跨平台：Web、Windows、macOS、Linux、Android、iOS
 */
class GeolocationService {
  private platform: Platform;
  private platformConfig = getPlatformConfig();
  private watchId: number | null = null;
  private positionCallback: ((position: LocationResult) => void) | null = null;

  constructor() {
    this.platform = getPlatform();
  }

  /**
   * 检查是否支持地理位置
   */
  isSupported(): boolean {
    if (this.platform === 'web') {
      return typeof navigator !== 'undefined' && 'geolocation' in navigator;
    }
    
    // Tauri 平台都支持地理位置
    return true;
  }

  /**
   * 获取当前位置
   */
  async getCurrentPosition(): Promise<LocationResult> {
    if (!this.isSupported()) {
      throw new Error('Geolocation is not supported on this platform');
    }

    // Web 平台使用浏览器 API
    if (this.platform === 'web') {
      return this.getWebPosition();
    }

    // Tauri 平台使用 Tauri Geolocation Plugin
    return this.getTauriPosition();
  }

  /**
   * Web 平台获取位置
   */
  private async getWebPosition(): Promise<LocationResult> {
    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported in this browser');
    }

    const config = this.platformConfig.locationAccuracy;

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp
          });
        },
        (error) => {
          const locationError: LocationError = {
            code: error.code,
            message: this.getWebErrorMessage(error.code),
            name: error.name
          };
          reject(locationError);
        },
        {
          enableHighAccuracy: config.enableHighAccuracy,
          timeout: config.timeout,
          maximumAge: config.maximumAge
        }
      );
    });
  }

  /**
   * Tauri 平台获取位置
   */
  private async getTauriPosition(): Promise<LocationResult> {
    try {
      // 动态导入 Tauri 插件
      const { getCurrentPosition } = await import('@tauri-apps/plugin-geolocation');
      const position = await getCurrentPosition({});

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy || 0,
        altitude: position.coords.altitude,
        altitudeAccuracy: position.coords.altitudeAccuracy,
        heading: position.coords.heading,
        speed: position.coords.speed,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Failed to get Tauri position:', error);
      throw new Error('Failed to get position from Tauri plugin');
    }
  }

  /**
   * 获取 Web 平台错误消息
   */
  private getWebErrorMessage(code: number): string {
    switch (code) {
      case 1:
        return '用户拒绝了位置请求';
      case 2:
        return '无法获取位置信息';
      case 3:
        return '获取位置超时';
      default:
        return '未知错误';
    }
  }

  /**
   * 请求位置权限
   */
  async requestPermission(): Promise<LocationPermission> {
    if (!this.isSupported()) {
      return 'not-supported';
    }

    // Web 平台
    if (this.platform === 'web') {
      return this.requestWebPermission();
    }

    // Tauri 平台
    return this.requestTauriPermission();
  }

  /**
   * Web 平台请求权限
   */
  private async requestWebPermission(): Promise<LocationPermission> {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve('granted'),
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            resolve('denied');
          } else {
            // 其他错误可能是临时的，仍然可以重试
            resolve('prompt');
          }
        },
        { timeout: 5000 }
      );
    });
  }

  /**
   * Tauri 平台请求权限
   */
  private async requestTauriPermission(): Promise<LocationPermission> {
    try {
      const { permission } = await import('@tauri-apps/plugin-geolocation');
      const result = await permission.request('geolocation');
      
      if (result === 'granted') return 'granted';
      if (result === 'denied') return 'denied';
      return 'prompt';
    } catch (error) {
      console.error('Failed to request Tauri permission:', error);
      return 'not-supported';
    }
  }

  /**
   * 检查权限状态
   */
  async checkPermission(): Promise<LocationPermission> {
    if (this.platform === 'web') {
      // Web 平台无法直接检查权限状态，需要尝试获取位置
      try {
        await this.requestPermission();
        return 'granted';
      } catch {
        return 'denied';
      }
    }

    // Tauri 平台
    try {
      const { permission } = await import('@tauri-apps/plugin-geolocation');
      const result = await permission.check('geolocation');
      return result as LocationPermission;
    } catch (error) {
      console.error('Failed to check Tauri permission:', error);
      return 'not-supported';
    }
  }

  /**
   * 监听位置变化
   */
  watchPosition(callback: (position: LocationResult) => void): void {
    if (!this.isSupported()) {
      console.warn('Geolocation is not supported');
      return;
    }

    this.positionCallback = callback;

    if (this.platform === 'web') {
      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          callback({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp
          });
        },
        (error) => {
          console.error('Watch position error:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      // Tauri 平台的 watch 实现（如果需要）
      console.warn('Tauri watch position not implemented yet');
    }
  }

  /**
   * 停止监听位置变化
   */
  clearWatch(): void {
    if (this.platform === 'web' && this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.positionCallback = null;
  }

  /**
   * 计算两个位置之间的距离（Haversine 公式）
   */
  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // 地球半径（米）
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * 格式化距离
   */
  static formatDistance(distance: number): string {
    if (distance < 1000) {
      return `${Math.round(distance)} 米`;
    } else {
      return `${(distance / 1000).toFixed(1)} 公里`;
    }
  }

  /**
   * 使用降级方案获取位置（IP 定位）
   */
  async getCurrentPositionWithFallback(): Promise<LocationResult> {
    try {
      // 尝试获取高精度位置
      return await this.getCurrentPosition();
    } catch (error) {
      console.warn('Failed to get high precision location, trying fallback...');
      
      // 降级方案：使用 IP 定位
      try {
        return await this.getIPLocation();
      } catch (ipError) {
        console.error('IP location failed too:', ipError);
        throw new Error('无法获取位置，请手动选择地理位置');
      }
    }
  }

  /**
   * IP 定位（降级方案）
   */
  private async getIPLocation(): Promise<LocationResult> {
    try {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      
      return {
        latitude: data.latitude || 0,
        longitude: data.longitude || 0,
        accuracy: 5000, // IP 定位精度较低
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('IP location failed:', error);
      throw new Error('IP location service unavailable');
    }
  }

  /**
   * 打开系统设置（用于权限被拒绝的情况）
   */
  async openSystemSettings(): Promise<void> {
    if (this.platform === 'web') {
      // Web 平台无法打开设置
      console.warn('Cannot open system settings in web browser');
      return;
    }

    try {
      const { open } = await import('@tauri-apps/plugin-opener');
      
      // 根据平台打开不同的设置页面
      const settingsUrl = this.getSettingsUrl();
      await open(settingsUrl);
    } catch (error) {
      console.error('Failed to open system settings:', error);
    }
  }

  /**
   * 获取系统设置 URL
   */
  private getSettingsUrl(): string {
    switch (this.platform) {
      case 'android':
        // Android 设置
        return 'app-settings:';
      case 'ios':
        // iOS 设置
        return 'app-settings:';
      default:
        // 桌面平台
        return '';
    }
  }
}

// 导出单例
export const geolocationService = new GeolocationService();
export default geolocationService;

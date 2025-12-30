export type Platform = 'web' | 'windows' | 'macos' | 'linux' | 'android' | 'ios';

interface PlatformInfo {
  platform: Platform;
  isWeb: boolean;
  isDesktop: boolean;
  isMobile: boolean;
  isTauri: boolean;
}

/**
 * 获取当前运行平台
 */
export const getPlatform = (): Platform => {
  // 检查是否在 Tauri 环境中运行
  if (typeof window !== 'undefined' && (window as any).__TAURI__) {
    const platform = navigator.platform.toLowerCase();
    
    if (platform.includes('win')) return 'windows';
    if (platform.includes('mac')) return 'macos';
    if (platform.includes('linux')) return 'linux';
    if (platform.includes('android')) return 'android';
    if (platform.includes('iphone') || platform.includes('ipad') || platform.includes('ipod')) return 'ios';
  }
  
  return 'web';
};

/**
 * 获取平台详细信息
 */
export const getPlatformInfo = (): PlatformInfo => {
  const platform = getPlatform();
  
  return {
    platform,
    isWeb: platform === 'web',
    isDesktop: ['windows', 'macos', 'linux'].includes(platform),
    isMobile: ['android', 'ios'].includes(platform),
    isTauri: platform !== 'web'
  };
};

/**
 * 检查平台是否支持高精度定位
 */
export const supportsHighAccuracyLocation = (): boolean => {
  const platform = getPlatform();
  
  // Web 平台
  if (platform === 'web') {
    return 'geolocation' in navigator;
  }
  
  // Tauri 平台都支持高精度定位
  return true;
};

/**
 * 检查是否在 HTTPS 环境（Web 平台需要）
 */
export const isHTTPS = (): boolean => {
  if (typeof window === 'undefined') return true;
  return window.location.protocol === 'https:' || window.location.hostname === 'localhost';
};

/**
 * 获取设备用户代理信息（用于调试）
 */
export const getUserAgent = (): string => {
  if (typeof navigator === 'undefined') return 'Unknown';
  return navigator.userAgent || 'Unknown';
};

/**
 * 检查是否为移动设备
 */
export const isMobileDevice = (): boolean => {
  const platform = getPlatform();
  if (platform === 'android' || platform === 'ios') return true;
  if (platform === 'web') {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
  return false;
};

/**
 * 获取平台特定的配置
 */
export const getPlatformConfig = () => {
  const platformInfo = getPlatformInfo();
  
  return {
    ...platformInfo,
    // 定位精度配置
    locationAccuracy: {
      enableHighAccuracy: true,
      timeout: 20000, // 增加超时时间以获取更高精度
      maximumAge: 0 // 不使用缓存位置，始终获取最新位置
    },
    // 地图缩放级别
    mapZoomLevel: platformInfo.isMobile ? 15 : 16,
    // 是否支持后台定位
    supportsBackgroundLocation: ['android', 'ios'].includes(platformInfo.platform)
  };
};

export default {
  getPlatform,
  getPlatformInfo,
  supportsHighAccuracyLocation,
  isHTTPS,
  getUserAgent,
  isMobileDevice,
  getPlatformConfig
};

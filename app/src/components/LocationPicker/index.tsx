import { useState, useEffect, useCallback, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input, Spinner } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { useTranslation } from 'react-i18next';
import { geolocationService, LocationResult } from '@/services/GeolocationService';
import { useDisclosure } from '@heroui/react';
import { debounce } from 'lodash';
import { api } from '@/lib/trpc';
import PermissionDialog from '@/components/PermissionDialog';
import { getPlatformInfo } from '@/utils/platform';
import { ToastPlugin } from '@/store/module/Toast/Toast';
import i18n from '@/lib/i18n';

export interface LocationData {
  id: string;
  latitude: number;
  longitude: number;
  address: string;
  formattedAddress: string;
  poiName?: string;
  distance?: string;
  accuracy?: number;
  createdAt: string;
}

interface LocationPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onAddLocations: (locations: LocationData[]) => void;
  onInsertLocationText?: (text: string) => void;
  initialLocations?: LocationData[];
}

export const LocationPicker = observer(({
  isOpen,
  onClose,
  onAddLocations,
  onInsertLocationText,
  initialLocations = []
}: LocationPickerProps) => {
  const { t } = useTranslation();
  const platformInfo = getPlatformInfo();

  const [locations, setLocations] = useState<LocationData[]>(initialLocations);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any | null>(null);
  const [nearbyLocations, setNearbyLocations] = useState<any[]>([]);
  const [mapSelection, setMapSelection] = useState<LocationData | null>(initialLocations[0] ?? null);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const amapKey = (import.meta as any).env?.NEXT_PUBLIC_AMAP_WEB_API_KEY || (import.meta as any).env?.VITE_AMAP_WEB_API_KEY || (import.meta as any).env?.AMAP_WEB_API_KEY;

  // 当 initialLocations 变化时更新 locations 状态
  useEffect(() => {
    setLocations(initialLocations);
  }, [initialLocations]);

  // 权限对话框
  const { isOpen: isPermissionOpen, onOpen: onPermissionOpen, onClose: onPermissionClose } = useDisclosure();

  // 搜索地理位置
  const searchLocations = useCallback(
    debounce(async (keyword: string) => {
      if (!keyword.trim()) {
        setSearchResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const results = await api.notes.searchLocation.mutate({
          keyword: keyword.trim(),
          pageSize: 10
        });
        setSearchResults(results);
      } catch (error) {
        console.error('Search location error:', error);
        ToastPlugin.error(t('location.search.error'));
      } finally {
        setIsLoading(false);
      }
    }, 300),
    [t]
  );

  const loadAmap = useCallback(async () => {
    if (typeof window === 'undefined') return null;
    if ((window as any).AMap) return (window as any).AMap;
    if (!amapKey) {
      throw new Error('缺少高德 Web API Key，请配置 NEXT_PUBLIC_AMAP_WEB_API_KEY');
    }

    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector('script[data-amap="v2"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('AMap load error')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.setAttribute('data-amap', 'v2');
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${amapKey}`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('AMap load error'));
      document.head.appendChild(script);
    });

    return (window as any).AMap;
  }, [amapKey]);

  const focusMapOnLocation = useCallback((loc: { latitude: number; longitude: number }) => {
    if (!mapInstanceRef.current || !markerRef.current) return;
    const center: [number, number] = [loc.longitude, loc.latitude];
    markerRef.current.setPosition(center);
    mapInstanceRef.current.setZoomAndCenter(16, center);
  }, []);

  const reverseGeocodeByJs = useCallback(async (lng: number, lat: number) => {
    if (!geocoderRef.current) return null;
    return await new Promise<any>((resolve) => {
      geocoderRef.current.getAddress([lng, lat], (status: string, result: any) => {
        if (status === 'complete' && result?.regeocode) {
          resolve(result.regeocode);
        } else {
          resolve(null);
        }
      });
    });
  }, []);

  const handleMarkerDrag = useCallback(async (lnglat: any) => {
    if (!lnglat) return;
    const lng = lnglat?.lng || lnglat?.getLng?.();
    const lat = lnglat?.lat || lnglat?.getLat?.();
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter([lng, lat]);
    }
    const geocode = await reverseGeocodeByJs(lng, lat);
    setMapSelection({
      id: `map_${Date.now()}`,
      latitude: lat,
      longitude: lng,
      address: geocode?.formattedAddress || '',
      formattedAddress: geocode?.formattedAddress || '',
      poiName: geocode?.addressComponent?.building || geocode?.addressComponent?.neighborhood || '地图选点',
      distance: undefined,
      createdAt: new Date().toISOString()
    });
  }, [reverseGeocodeByJs]);

  useEffect(() => {
    if (!isOpen) return;
    let disposed = false;
    const initMap = async () => {
      setMapLoading(true);
      setMapError(null);
      try {
        const AMap = await loadAmap();
        if (!AMap || disposed) return;
        const base = mapSelection || locations[0] || nearbyLocations[0];
        const centerLng = base?.longitude ?? 116.397428;
        const centerLat = base?.latitude ?? 39.90923;
        mapInstanceRef.current = new AMap.Map(mapContainerRef.current, {
          zoom: 15,
          center: [centerLng, centerLat],
          viewMode: '3D',
          resizeEnable: true
        });
        geocoderRef.current = new AMap.Geocoder({ radius: 1000 });
        markerRef.current = new AMap.Marker({
          position: [centerLng, centerLat],
          draggable: true,
          cursor: 'move'
        });
        markerRef.current.on('dragend', (e: any) => handleMarkerDrag(e?.lnglat));
        mapInstanceRef.current.add(markerRef.current);
      } catch (error: any) {
        console.error('Init map failed:', error);
        setMapError(error?.message || '地图加载失败');
      } finally {
        if (!disposed) setMapLoading(false);
      }
    };

    initMap();
    return () => {
      disposed = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy?.();
      }
      mapInstanceRef.current = null;
      markerRef.current = null;
      geocoderRef.current = null;
    };
  }, [isOpen, loadAmap, handleMarkerDrag]);

  useEffect(() => {
    if (!mapInstanceRef.current || !mapSelection) return;
    focusMapOnLocation(mapSelection);
  }, [mapSelection, focusMapOnLocation]);

  useEffect(() => {
    if (!mapSelection && locations.length > 0) {
      setMapSelection(locations[0]);
    }
  }, [locations, mapSelection]);

  // WGS84 -> GCJ02（高德坐标系），避免打开高德地图偏移
  const wgs84ToGcj02 = (lat: number, lng: number) => {
    const PI = 3.14159265358979324;
    const A = 6378245.0;
    const EE = 0.00669342162296594323;
    const outOfChina = (lat: number, lng: number) => lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
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
    if (outOfChina(lat, lng)) return { latitude: lat, longitude: lng };
    let dLat = transformLat(lng - 105.0, lat - 35.0);
    let dLng = transformLng(lng - 105.0, lat - 35.0);
    const radLat = lat / 180.0 * PI;
    let magic = Math.sin(radLat);
    magic = 1 - EE * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
    dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);
    return { latitude: lat + dLat, longitude: lng + dLng };
  };

  // 获取当前位置 - 直接获取当前位置并添加
  const getCurrentLocation = async () => {
    setIsLoadingLocation(true);

    try {
      // 检查权限
      const permission = await geolocationService.requestPermission();

      if (permission === 'denied') {
        setShowPermissionDialog(true);
        onPermissionOpen();
        return;
      }

      if (permission === 'not-supported') {
        ToastPlugin.error(t('location.notSupported'));
        return;
      }

      // 获取位置 (WGS84)
      const position = await geolocationService.getCurrentPosition();
      // 转 GCJ02 以便在高德/国内地图上避免偏移
      const gcj = wgs84ToGcj02(position.latitude, position.longitude);

      // 显示位置精度信息
      if (position.accuracy) {
        const accuracyText = position.accuracy < 20 ? '超高精度' : position.accuracy < 50 ? '高精度' : position.accuracy < 100 ? '中等精度' : '低精度';
        console.log(`位置获取成功: 经度 ${position.longitude}, 纬度 ${position.latitude}, 精度 ${accuracyText} (${Math.round(position.accuracy)}米)`);
      }

      // 先获取当前位置的地址信息（服务端已做 WGS->GCJ，传原始 WGS 即可）
      let addressData;
      try {
        addressData = await api.notes.reverseGeocode.mutate({
          latitude: position.latitude,
          longitude: position.longitude
        });
      } catch (geocodeError) {
        console.error('Failed to reverse geocode:', geocodeError);
        ToastPlugin.error('获取位置信息失败');
        return;
      }

      // 获取附近的位置列表（服务端也会转换）
      let nearbyResults;
      try {
        nearbyResults = await api.notes.getNearbyLocations.mutate({
          latitude: position.latitude,
          longitude: position.longitude,
          radius: 2000, // 2000米范围内（扩大搜索范围以提高准确性）
          pageSize: 10
        });
      } catch (error) {
        console.error('Failed to get nearby locations:', error);
        nearbyResults = [];
      }

      // 将当前位置添加到列表的第一个位置（存 GCJ 坐标，打开高德不再偏移）
      const currentLoc = {
        id: `current_${Date.now()}`,
        name: addressData.poiName || addressData.address || '当前位置',
        address: addressData.address || '',
        formattedAddress: addressData.formattedAddress || '',
        latitude: gcj.latitude,
        longitude: gcj.longitude,
        distance: '0米',
        type: '当前位置'
      };

      // 设置附近位置列表，当前位置排在第一位
      setNearbyLocations([currentLoc, ...nearbyResults]);
      setMapSelection({
        id: currentLoc.id,
        latitude: currentLoc.latitude,
        longitude: currentLoc.longitude,
        address: currentLoc.address,
        formattedAddress: currentLoc.formattedAddress,
        poiName: currentLoc.name,
        distance: currentLoc.distance,
        createdAt: new Date().toISOString()
      });
      focusMapOnLocation({
        latitude: currentLoc.latitude,
        longitude: currentLoc.longitude,
        address: currentLoc.address,
        formattedAddress: currentLoc.formattedAddress,
        poiName: currentLoc.name
      });
      ToastPlugin.success('找到附近位置，请选择');

    } catch (error: any) {
      console.error('Get current location error:', error);

      if (error.message?.includes('permission') || error.message?.includes('denied')) {
        setShowPermissionDialog(true);
        onPermissionOpen();
      } else {
        ToastPlugin.error(t('location.currentLocation.error'));
      }
    } finally {
      setIsLoadingLocation(false);
    }
  };

  // 搜索输入变化
  const handleSearchChange = (value: string) => {
    setSearchKeyword(value);
    searchLocations(value);
  };

  // 搜索输入回车处理
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // 不做任何操作，让用户点击选择
    }
  };

  const jumpMapToKeyword = async () => {
    if (!searchKeyword.trim()) {
      ToastPlugin.error('请输入地点后再跳转地图');
      return;
    }
    try {
      setMapLoading(true);
      const results = searchResults.length > 0
        ? searchResults
        : await api.notes.searchLocation.mutate({ keyword: searchKeyword.trim(), pageSize: 1 });
      if (!results?.length) {
        ToastPlugin.error('未找到匹配位置');
        return;
      }
      const target = results[0];
      focusMapOnLocation({
        latitude: target.latitude,
        longitude: target.longitude,
        address: target.address,
        formattedAddress: target.formattedAddress,
        poiName: target.name
      });
      setMapSelection({
        id: `map_${Date.now()}`,
        latitude: target.latitude,
        longitude: target.longitude,
        address: target.address || '',
        formattedAddress: target.formattedAddress || '',
        poiName: target.name,
        distance: target.distance,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('jumpMapToKeyword error:', error);
      ToastPlugin.error('地图跳转失败');
    } finally {
      setMapLoading(false);
    }
  };

  const addMapSelectionToList = () => {
    if (!mapSelection) return;
    const exists = locations.some(loc => Math.abs(loc.latitude - mapSelection.latitude) < 1e-6 && Math.abs(loc.longitude - mapSelection.longitude) < 1e-6);
    const newLocation: LocationData = {
      ...mapSelection,
      id: mapSelection.id || `loc_${Date.now()}`,
      createdAt: mapSelection.createdAt || new Date().toISOString()
    };
    setLocations(exists ? locations : [...locations, newLocation]);
    if (!exists) {
      ToastPlugin.success('已将地图位置加入已选');
    } else {
      ToastPlugin.success('该位置已在列表中');
    }
  };

  // 添加搜索结果中的位置
  const addSearchResult = (result: any) => {
    const newLocation: LocationData = {
      id: `loc_${Date.now()}`,
      latitude: result.latitude,
      longitude: result.longitude,
      address: result.address || '',
      formattedAddress: result.formattedAddress || '',
      poiName: result.name,
      distance: result.distance,
      createdAt: new Date().toISOString()
    };

    setLocations([...locations, newLocation]);
    setSearchKeyword('');
    setSearchResults([]);
    setMapSelection(newLocation);
    focusMapOnLocation(newLocation);
  };

  // 添加附近位置
  const addNearbyLocation = (location: any) => {
    const newLocation: LocationData = {
      id: `loc_${Date.now()}`,
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address || '',
      formattedAddress: location.formattedAddress || '',
      poiName: location.name,
      distance: location.distance,
      createdAt: new Date().toISOString()
    };

    setLocations([...locations, newLocation]);
    setNearbyLocations([]);
    setMapSelection(newLocation);
    focusMapOnLocation(newLocation);
    ToastPlugin.success('位置已添加');
  };

  // 清空附近位置列表
  const clearNearbyLocations = () => {
    setNearbyLocations([]);
  };

  // 删除位置
  const removeLocation = (locationId: string) => {
    setLocations(locations.filter(loc => loc.id !== locationId));
  };

  // 生成位置文本（插入到编辑器中）
  const generateLocationText = () => {
    if (locations.length === 0) return '';

    const locationTexts = locations.map((loc, index) => {
      // 生成高德地图链接URL
      const mapUrl = `https://uri.amap.com/marker?position=${loc.longitude},${loc.latitude}&name=${encodeURIComponent(loc.poiName || loc.address)}`;

      // 使用 Markdown 格式：更小字体 + 斜体 + 位置图钉
      let markdown = `<span style="font-size: 0.75em;">*[📍 ${loc.poiName || loc.address}](${mapUrl})*</span>`;

      // 隐藏完整地址，只显示短地址

      return markdown;
    });

    // 多个位置用双换行分隔
    return locationTexts.join('\n\n');
  };

  // 确认添加位置
  const handleConfirm = () => {
    // 保存位置数据到 metadata
    onAddLocations(locations);

    // 如果提供了回调，将位置文本插入到编辑器
    if (onInsertLocationText) {
      const locationText = generateLocationText();
      if (locationText) {
        onInsertLocationText(locationText);
      }
    }

    handleClose();
  };

  // 关闭对话框
  const handleClose = () => {
    setLocations(initialLocations);
    setSearchKeyword('');
    setSearchResults([]);
    setSelectedLocation(null);
    setNearbyLocations([]);
    setMapSelection(initialLocations[0] ?? null);
    onClose();
  };

  // 打开系统设置
  const openSystemSettings = async () => {
    try {
      await geolocationService.openSystemSettings();
      onPermissionClose();
    } catch (error) {
      console.error('Failed to open system settings:', error);
      ToastPlugin.error(t('location.settings.openFailed'));
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        size="2xl"
        backdrop="blur"
        scrollBehavior="inside"
        hideCloseButton
        classNames={{
          wrapper: "z-[99999]",
          backdrop: "z-[99998]"
        }}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1 pb-0">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">
                {t('location.picker.title')}
              </h3>
              <Button 
                isIconOnly 
                variant="light" 
                size="sm"
                onPress={handleClose}
              >
                <Icon icon="solar:close-circle-bold" width={20} height={20} />
              </Button>
            </div>
            <p className="text-sm text-default-500">
              {t('location.picker.subtitle')}
            </p>
          </ModalHeader>
          
          <ModalBody className="space-y-4 pt-4">
            {/* 已选位置列表 */}
            {locations.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-default-600">
                  {t('location.picker.selected')} ({locations.length})
                </h4>
                {locations.map((location) => (
                  <div
                    key={location.id}
                    className="flex items-start gap-3 p-3 bg-default-50 rounded-lg group"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <Icon
                        icon="solar:map-point-bold"
                        width={20}
                        height={20}
                        className="text-primary"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-default-900 truncate">
                        {location.poiName || location.address}
                      </p>
                      <p className="text-sm text-default-500 truncate">
                        {location.formattedAddress}
                      </p>
                      {location.distance && (
                        <p className="text-xs text-primary-500 mt-1">
                          {location.distance}
                        </p>
                      )}
                    </div>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      color="danger"
                      onPress={() => removeLocation(location.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Icon icon="solar:trash-bin-trash-bold" width={16} height={16} />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* 互动地图 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-default-600">地图选点（拖拽/跳转）</h4>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="flat" onPress={() => mapSelection && focusMapOnLocation(mapSelection)} isDisabled={!mapSelection || mapLoading}>
                    对准当前选点
                  </Button>
                  <Button size="sm" color="primary" onPress={addMapSelectionToList} isDisabled={!mapSelection}>
                    将地图位置加入已选
                  </Button>
                </div>
              </div>
              <div className="relative w-full h-72 rounded-lg border border-default-200 overflow-hidden bg-default-50" ref={mapContainerRef}>
                {mapLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                    <Spinner label="地图加载中..." color="primary" />
                  </div>
                )}
                {mapError && (
                  <div className="absolute inset-0 flex items-center justify-center text-danger text-sm bg-background/80">
                    {mapError}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="输入地点后点击跳转地图"
                  value={searchKeyword}
                  onValueChange={handleSearchChange}
                  onKeyDown={handleSearchKeyDown}
                  startContent={<Icon icon="solar:magnifier-bold" width={18} height={18} className="text-default-400" />}
                />
                <Button color="primary" variant="flat" onPress={jumpMapToKeyword} isLoading={mapLoading}>
                  地图跳转
                </Button>
              </div>
              {mapSelection && (
                <p className="text-xs text-default-500">
                  当前选点：{mapSelection.poiName || mapSelection.address || '未命名位置'}（{mapSelection.latitude.toFixed(6)}, {mapSelection.longitude.toFixed(6)}）
                </p>
              )}
            </div>

            {/* 附近位置列表 */}
            {nearbyLocations.length > 0 && (
              <div className="border border-default-200 rounded-lg bg-background overflow-hidden">
                <div className="px-3 py-2 bg-default-100 border-b border-default-200 flex items-center justify-between">
                  <h4 className="text-sm font-medium text-default-600">
                    附近位置 ({nearbyLocations.length})
                  </h4>
                  <Button
                    size="sm"
                    color="default"
                    variant="light"
                    onPress={clearNearbyLocations}
                    startContent={<Icon icon="solar:close-circle-bold" width={16} height={16} />}
                    className="text-xs"
                  >
                    清除
                  </Button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {nearbyLocations.map((location, index) => (
                    <div
                      key={`nearby_${location.id}_${index}`}
                      className="flex items-start gap-3 p-3 hover:bg-default-100 cursor-pointer transition-colors border-b border-default-100 last:border-b-0"
                      onClick={() => addNearbyLocation(location)}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        <Icon
                          icon={location.type === '当前位置' ? 'solar:crosshairs-bold' : 'solar:map-point-bold'}
                          width={20}
                          height={20}
                          className={location.type === '当前位置' ? 'text-primary' : 'text-default-500'}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-default-900 truncate">
                          {location.name}
                        </p>
                        <p className="text-sm text-default-500 truncate">
                          {location.formattedAddress}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-primary-500">
                            {location.distance}
                          </p>
                          {location.type && (
                            <p className="text-xs text-default-400">
                              · {location.type}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <Icon
                          icon="solar:add-circle-bold"
                          width={24}
                          height={24}
                          className="text-primary"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 获取当前位置按钮 */}
            <Button
              variant="flat"
              color="primary"
              size="lg"
              className="w-full"
              onPress={getCurrentLocation}
              isLoading={isLoadingLocation}
              startContent={
                !isLoadingLocation ? (
                  <Icon icon="solar:crosshairs-bold" width={20} height={20} />
                ) : undefined
              }
            >
              {isLoadingLocation
                ? t('location.currentLocation.loading')
                : t('location.currentLocation.button')
              }
            </Button>
            <p className="text-xs text-default-400 mt-2">
              {t('location.currentLocation.hint')}
            </p>

            {/* 搜索地理位置 */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-default-600">
                {t('location.picker.searchTitle')}
              </h4>
              <Input
                placeholder={t('location.picker.searchPlaceholder')}
                value={searchKeyword}
                onValueChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
                startContent={
                  <Icon icon="solar:magnifier-bold" width={18} height={18} className="text-default-400" />
                }
                endContent={
                  isLoading ? (
                    <Spinner size="sm" />
                  ) : searchKeyword ? (
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      onPress={() => {
                        setSearchKeyword('');
                        setSearchResults([]);
                      }}
                    >
                      <Icon icon="solar:close-circle-bold" width={16} height={16} />
                    </Button>
                  ) : null
                }
              />

              {/* 搜索结果 - 显示为嵌入式的列表 */}
              {searchResults.length > 0 && (
                <div className="border border-default-200 rounded-lg bg-background overflow-hidden">
                  <div className="px-3 py-2 bg-default-100 border-b border-default-200">
                    <p className="text-xs text-default-600 font-medium">搜索结果 ({searchResults.length})</p>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {searchResults.map((result, index) => (
                      <div
                        key={`${result.id}-${index}`}
                        className="flex items-start gap-3 p-3 hover:bg-default-100 cursor-pointer transition-colors border-b border-default-100 last:border-b-0"
                        onClick={() => {
                          console.log('[LocationPicker] Search result clicked:', result);
                          addSearchResult(result);
                        }}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          <Icon
                            icon="solar:map-point-bold"
                            width={20}
                            height={20}
                            className="text-default-500"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-default-900 truncate">
                            {result.name}
                          </p>
                          <p className="text-sm text-default-500 truncate">
                            {result.formattedAddress}
                          </p>
                          {result.distance && (
                            <p className="text-xs text-primary-500 mt-1">
                              {result.distance}
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          <Icon
                            icon="solar:add-circle-bold"
                            width={24}
                            height={24}
                            className="text-primary"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ModalBody>
          
          <ModalFooter>
            <Button
              color="default"
              variant="light"
              onPress={handleClose}
            >
              {t('cancel')}
            </Button>
            <Button
              color="primary"
              onPress={handleConfirm}
              isDisabled={locations.length === 0}
              startContent={<Icon icon="solar:check-circle-bold" width={18} height={18} />}
            >
              {t('location.picker.confirm')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 权限请求对话框 */}
      <PermissionDialog
        isOpen={isPermissionOpen}
        onClose={onPermissionClose}
        onConfirm={openSystemSettings}
        title={t('location.permission.title')}
        description={t('location.permission.description')}
      />
    </>
  );
});

export default LocationPicker;

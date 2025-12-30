import { useState, useEffect, useCallback } from 'react';
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

      // 获取位置
      const position = await geolocationService.getCurrentPosition();

      // 显示位置精度信息
      if (position.accuracy) {
        const accuracyText = position.accuracy < 20 ? '超高精度' : position.accuracy < 50 ? '高精度' : position.accuracy < 100 ? '中等精度' : '低精度';
        console.log(`位置获取成功: 经度 ${position.longitude}, 纬度 ${position.latitude}, 精度 ${accuracyText} (${Math.round(position.accuracy)}米)`);
      }

      // 先获取当前位置的地址信息
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

      // 获取附近的位置列表
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

      // 将当前位置添加到列表的第一个位置
      const currentLoc = {
        id: `current_${Date.now()}`,
        name: addressData.poiName || addressData.address || '当前位置',
        address: addressData.address || '',
        formattedAddress: addressData.formattedAddress || '',
        latitude: position.latitude,
        longitude: position.longitude,
        distance: '0米',
        type: '当前位置'
      };

      // 设置附近位置列表，当前位置排在第一位
      setNearbyLocations([currentLoc, ...nearbyResults]);
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

      if (loc.formattedAddress && loc.formattedAddress !== loc.address) {
        const addressWithDistance = loc.distance ? `${loc.formattedAddress} ${loc.distance}` : loc.formattedAddress;
        markdown += `\n<span style="font-size: 0.75em;">*[${addressWithDistance}](${mapUrl})*</span>`;
      }

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

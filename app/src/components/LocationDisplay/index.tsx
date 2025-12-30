import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Icon } from '@/components/Common/Iconify/icons';
import { Button } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { geolocationService } from '@/services/GeolocationService';
import { ToastPlugin } from '@/store/module/Toast/Toast';

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

interface LocationDisplayProps {
  locations: LocationData[];
  isEditable?: boolean;
  onEdit?: () => void;
  compact?: boolean;
}

export const LocationDisplay = observer(({ 
  locations, 
  isEditable = false,
  onEdit,
  compact = false
}: LocationDisplayProps) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(!compact);

  // 打开地图
  const openMap = (latitude: number, longitude: number) => {
    const mapUrl = `https://uri.amap.com/marker?position=${longitude},${latitude}&name=位置&coordinate=gaode&callnative=1`;
    window.open(mapUrl, '_blank');
  };

  // 格式化时间
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) {
      return t('location.display.justNow');
    } else if (diffMins < 60) {
      return `${diffMins} ${t('location.display.minutesAgo')}`;
    } else if (diffMins < 1440) {
      const hours = Math.floor(diffMins / 60);
      return `${hours} ${t('location.display.hoursAgo')}`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // 计算与当前距离
  const calculateDistance = (latitude: number, longitude: number) => {
    // 简单实现，实际可使用更精确的算法
    return '';
  };

  if (locations.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 border-t border-default-200 pt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon icon="solar:map-location-bold-duotone" width={18} height={18} className="text-primary" />
          <span className="text-sm font-medium text-default-600">
            {t('location.display.title')} ({locations.length})
          </span>
        </div>
        
        {compact && (
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={() => setIsExpanded(!isExpanded)}
          >
            <Icon 
              icon={isExpanded ? "solar:alt-arrow-up-bold" : "solar:alt-arrow-down-bold"}
              width={16}
              height={16}
            />
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="space-y-2">
          {locations.map((location, index) => (
            <div 
              key={location.id}
              className="flex items-start gap-3 p-2 bg-default-50 rounded-lg hover:bg-default-100 transition-colors"
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
                {/* POI 名称 */}
                {location.poiName && (
                  <p className="font-medium text-default-900 truncate text-sm">
                    {location.poiName}
                  </p>
                )}
                
                {/* 地址信息 */}
                <p className="text-sm text-default-600 truncate">
                  {location.formattedAddress}
                </p>
                
                {/* 距离信息 */}
                {(location.distance || calculateLocationDistance(location.latitude, location.longitude)) && (
                  <p className="text-xs text-primary-500 mt-1">
                    {location.distance || calculateLocationDistance(location.latitude, location.longitude)}
                  </p>
                )}
                
                {/* 时间戳 */}
                <p className="text-xs text-default-400 mt-1">
                  {formatTime(location.createdAt)}
                </p>
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={() => openMap(location.latitude, location.longitude)}
                  title={t('location.display.viewOnMap')}
                >
                  <Icon icon="solar:map-bold-duotone" width={18} height={18} className="text-default-500" />
                </Button>
                
                {isEditable && onEdit && (
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    onPress={onEdit}
                    title={t('location.display.edit')}
                  >
                    <Icon icon="solar:pen-new-square-bold" width={18} height={18} className="text-default-500" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// 辅助函数：计算与当前用户的距离
const calculateLocationDistance = (latitude: number, longitude: number): string => {
  // 这里可以实现真实的距离计算
  // 目前返回空字符串，可以后续扩展
  return '';
};

export default LocationDisplay;

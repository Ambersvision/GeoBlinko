import { Icon } from '@/components/Common/Iconify/icons';
import { Tooltip } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { BlinkoCard } from './index';
import { DialogStandaloneStore } from '@/store/module/DialogStandalone';
import { api } from '@/lib/trpc';
import { cn } from '@heroui/theme';
import { LocationDisplay } from '@/components/LocationDisplay';
import { observer } from 'mobx-react-lite';

interface LocationData {
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

export interface LocationsContentProps {
  locations: LocationData[];
  noteId?: number;
  className?: string;
}

export const LocationsContent = observer(({ locations, noteId, className }: LocationsContentProps) => {
  const { t } = useTranslation();

  if (!locations || locations.length === 0) return null;

  const handleLocationClick = async (location: LocationData) => {
    // 打开位置详情对话框
    DialogStandaloneStore.setData({
      isOpen: true,
      onlyContent: true,
      showOnlyContentCloseButton: true,
      size: '4xl',
      content: <LocationDetailDialog location={location} />
    });
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

  return (
    <div className={cn('flex flex-col gap-2 mt-2', className)}>
      <div className='flex items-center gap-2 text-xs text-default-500 ml-1 mb-1'>
        <Icon icon="solar:map-location-bold-duotone" width="14" height="14" />
        <span className="font-medium">
          {t('location.display.title')} ({locations.length})
        </span>
      </div>

      {locations.map((location, index) => (
        <div
          key={location.id}
          className='location-card flex flex-col gap-1 rounded-md bg-default-50 hover:bg-default-100 !p-2 cursor-pointer transition-colors'
          onClick={() => handleLocationClick(location)}
        >
          {/* POI 名称 */}
          {location.poiName && (
            <div className='text-default-700 text-xs font-bold ml-1 line-clamp-1'>
              {location.poiName}
            </div>
          )}

          {/* 地址信息 */}
          <div className='text-default-600 text-xs ml-1 line-clamp-1'>
            {location.formattedAddress || location.address}
          </div>

          {/* 时间和操作图标 */}
          <div className='flex items-center justify-between mt-1'>
            <div className='text-desc text-xs ml-1 select-none'>
              {formatTime(location.createdAt)}
            </div>
            <Tooltip content={t('location.display.viewOnMap')} delay={1000}>
              <Icon
                icon="iconamoon:arrow-top-right-1"
                className='text-primary'
                width="14"
                height="14"
              />
            </Tooltip>
          </div>
        </div>
      ))}
    </div>
  );
});

// 位置详情对话框组件
const LocationDetailDialog = observer(({ location }: { location: LocationData }) => {
  const { t } = useTranslation();

  // 打开高德地图
  const openMap = () => {
    const mapUrl = `https://uri.amap.com/marker?position=${location.longitude},${location.latitude}&name=${encodeURIComponent(location.poiName || '位置')}&coordinate=gaode&callnative=1`;
    window.open(mapUrl, '_blank');
  };

  // 在新标签页打开高德地图网页版
  const openWebMap = () => {
    const webMapUrl = `https://gaode.com/search?query=${encodeURIComponent(location.formattedAddress || location.address)}`;
    window.open(webMapUrl, '_blank');
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* 位置标题 */}
      <div className="flex items-center gap-3 border-b border-default-200 pb-4">
        <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
          <Icon icon="solar:map-point-bold" width={24} height={24} className="text-primary" />
        </div>
        <div className="flex-1">
          {location.poiName && (
            <h3 className="text-lg font-bold text-default-900">{location.poiName}</h3>
          )}
          <p className="text-sm text-default-600 mt-1">{location.formattedAddress || location.address}</p>
        </div>
      </div>

      {/* 坐标信息 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-default-50 rounded-lg p-3">
          <div className="text-xs text-default-500 mb-1">{t('location.detail.latitude')}</div>
          <div className="text-sm font-mono font-medium text-default-900">{location.latitude.toFixed(6)}°</div>
        </div>
        <div className="bg-default-50 rounded-lg p-3">
          <div className="text-xs text-default-500 mb-1">{t('location.detail.longitude')}</div>
          <div className="text-sm font-mono font-medium text-default-900">{location.longitude.toFixed(6)}°</div>
        </div>
      </div>

      {/* 时间信息 */}
      <div className="bg-default-50 rounded-lg p-3">
        <div className="text-xs text-default-500 mb-1">{t('location.detail.recordedAt')}</div>
        <div className="text-sm text-default-900">
          {new Date(location.createdAt).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>

      {/* 精度信息 */}
      {location.accuracy && (
        <div className="bg-default-50 rounded-lg p-3">
          <div className="text-xs text-default-500 mb-1">{t('location.detail.accuracy')}</div>
          <div className="text-sm text-default-900">{location.accuracy} 米</div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-3 mt-2">
        <button
          onClick={openMap}
          className="flex-1 flex items-center justify-center gap-2 bg-primary text-white rounded-lg py-3 hover:bg-primary/600 transition-colors"
        >
          <Icon icon="solar:map-bold-duotone" width={20} height={20} />
          <span className="font-medium">{t('location.detail.openApp')}</span>
        </button>
        <button
          onClick={openWebMap}
          className="flex-1 flex items-center justify-center gap-2 bg-default-100 text-default-700 rounded-lg py-3 hover:bg-default-200 transition-colors"
        >
          <Icon icon="solar:browser-bold-duotone" width={20} height={20} />
          <span className="font-medium">{t('location.detail.openWeb')}</span>
        </button>
      </div>
    </div>
  );
});

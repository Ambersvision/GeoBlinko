import { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { Button, Input, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Switch } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { useTranslation } from 'react-i18next';
import { debounce } from 'lodash';

export interface LocationFilterState {
  hasLocation?: boolean;
  locationKeyword?: string;
}

interface LocationFilterProps {
  filter: LocationFilterState;
  onFilterChange: (filter: LocationFilterState) => void;
  onClear?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export const LocationFilter = observer(({ 
  filter, 
  onFilterChange,
  onClear,
  size = 'md'
}: LocationFilterProps) => {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState(filter.locationKeyword || '');

  // 更新关键词（带防抖）
  const handleKeywordChange = debounce((value: string) => {
    onFilterChange({
      ...filter,
      locationKeyword: value || undefined
    });
  }, 300);

  // 清除筛选
  const handleClear = () => {
    setKeyword('');
    onFilterChange({
      hasLocation: undefined,
      locationKeyword: undefined
    });
    onClear?.();
  };

  // 检查是否有筛选条件
  const hasActiveFilter = filter.hasLocation !== undefined || (filter.locationKeyword && filter.locationKeyword.trim());

  // 获取按钮大小
  const getButtonSize = () => {
    switch (size) {
      case 'sm':
        return 'sm';
      case 'lg':
        return 'lg';
      default:
        return 'md';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Dropdown>
        <DropdownTrigger>
          <Button
            size={getButtonSize()}
            variant={hasActiveFilter ? 'solid' : 'flat'}
            color={hasActiveFilter ? 'primary' : 'default'}
            startContent={
              <Icon 
                icon={hasActiveFilter ? "solar:map-location-bold-duotone" : "solar:map-location-bold"} 
                width={18} 
                height={18} 
              />
            }
          >
            {t('location.filter.title')}
            {hasActiveFilter && (
              <span className="ml-1 px-1.5 py-0.5 bg-primary-600 text-white text-xs rounded-full">
                1
              </span>
            )}
          </Button>
        </DropdownTrigger>
        
        <DropdownMenu 
          aria-label="Location filter options"
          className="min-w-64"
        >
          <DropdownItem
            key="hasLocation"
            startContent={<Icon icon="solar:check-circle-bold" width={18} height={18} />}
            endContent={
              <Switch
                size="sm"
                isSelected={filter.hasLocation === true}
                onValueChange={(isSelected) => {
                  onFilterChange({
                    ...filter,
                    hasLocation: isSelected ? true : undefined
                  });
                }}
              />
            }
          >
            {t('location.filter.hasLocation')}
          </DropdownItem>

          <DropdownItem
            key="noLocation"
            startContent={<Icon icon="solar:close-circle-bold" width={18} height={18} />}
            endContent={
              <Switch
                size="sm"
                isSelected={filter.hasLocation === false}
                onValueChange={(isSelected) => {
                  onFilterChange({
                    ...filter,
                    hasLocation: isSelected ? false : undefined
                  });
                }}
              />
            }
          >
            {t('location.filter.noLocation')}
          </DropdownItem>

          <DropdownSection title={t('location.filter.searchSection')}>
            <DropdownItem
              key="search"
              isReadOnly
            >
              <Input
                placeholder={t('location.filter.keywordPlaceholder')}
                value={keyword}
                onValueChange={(value) => {
                  setKeyword(value);
                  handleKeywordChange(value);
                }}
                startContent={
                  <Icon icon="solar:magnifier-bold" width={16} height={16} className="text-default-400" />
                }
                endContent={
                  keyword && (
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      onPress={() => {
                        setKeyword('');
                        onFilterChange({
                          ...filter,
                          locationKeyword: undefined
                        });
                      }}
                    >
                      <Icon icon="solar:close-circle-bold" width={14} height={14} />
                    </Button>
                  )
                }
                size="sm"
                className="w-full"
              />
            </DropdownItem>
          </DropdownSection>

          {hasActiveFilter && (
            <DropdownItem
              key="clear"
              startContent={<Icon icon="solar:trash-bin-trash-bold" width={18} height={18} />}
              className="text-danger"
              onPress={handleClear}
            >
              {t('location.filter.clear')}
            </DropdownItem>
          )}
        </DropdownMenu>
      </Dropdown>

      {/* 快速筛选按钮 */}
      <div className="flex items-center gap-1">
        <Button
          size={getButtonSize()}
          variant="flat"
          color={filter.hasLocation === true ? 'primary' : 'default'}
          onPress={() => {
            const newValue = filter.hasLocation === true ? undefined : true;
            onFilterChange({
              ...filter,
              hasLocation: newValue
            });
          }}
        >
          <Icon icon="solar:map-point-bold" width={16} height={16} />
        </Button>
        
        <Button
          size={getButtonSize()}
          variant="flat"
          color={filter.hasLocation === false ? 'danger' : 'default'}
          onPress={() => {
            const newValue = filter.hasLocation === false ? undefined : false;
            onFilterChange({
              ...filter,
              hasLocation: newValue
            });
          }}
        >
          <Icon icon="solar:map-location-off-bold" width={16} height={16} />
        </Button>
      </div>
    </div>
  );
});

// DropdownSection 组件（HeroUI 可能没有）
const DropdownSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <div className="px-3 py-1.5 text-xs font-semibold text-default-500 uppercase">
      {title}
    </div>
    {children}
  </div>
);

export default LocationFilter;

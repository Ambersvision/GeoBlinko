import { observer } from 'mobx-react-lite';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, useDisclosure } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { useTranslation } from 'react-i18next';

interface PermissionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  isLoading?: boolean;
}

export const PermissionDialog = observer(({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title,
  description,
  isLoading = false
}: PermissionDialogProps) => {
  const { t } = useTranslation();

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      size="md"
      backdrop="blur"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning-100 rounded-full">
              <Icon icon="solar:map-location-bold-duotone" width={32} height={32} className="text-warning" />
            </div>
            <h3 className="text-xl font-semibold">{title || t('location.permission.title')}</h3>
          </div>
        </ModalHeader>
        
        <ModalBody>
          <div className="space-y-3">
            <p className="text-default-600">
              {description || t('location.permission.description')}
            </p>
            
            <ul className="space-y-2 text-default-600 ml-4">
              <li className="flex items-start gap-2">
                <Icon icon="solar:check-circle-bold" width={16} height={16} className="text-success mt-0.5 flex-shrink-0" />
                <span>{t('location.permission.feature1')}</span>
              </li>
              <li className="flex items-start gap-2">
                <Icon icon="solar:check-circle-bold" width={16} height={16} className="text-success mt-0.5 flex-shrink-0" />
                <span>{t('location.permission.feature2')}</span>
              </li>
              <li className="flex items-start gap-2">
                <Icon icon="solar:check-circle-bold" width={16} height={16} className="text-success mt-0.5 flex-shrink-0" />
                <span>{t('location.permission.feature3')}</span>
              </li>
            </ul>
            
            <div className="bg-default-50 p-4 rounded-lg">
              <p className="text-sm text-default-500">
                <Icon icon="solar:info-circle-bold" width={16} height={16} className="inline-block mr-1" />
                {t('location.permission.privacyNotice')}
              </p>
            </div>
          </div>
        </ModalBody>
        
        <ModalFooter>
          <Button 
            color="default" 
            variant="light" 
            onPress={onClose}
            disabled={isLoading}
          >
            {t('location.permission.cancel')}
          </Button>
          <Button 
            color="primary" 
            onPress={onConfirm}
            isLoading={isLoading}
            startContent={<Icon icon="solar:map-point-bold" width={18} height={18} />}
          >
            {t('location.permission.allow')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
});

// Hook for using PermissionDialog
export const usePermissionDialog = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();

  const showPermissionDialog = (options: {
    title?: string;
    description?: string;
    onConfirm: () => void;
  }) => {
    // Store the onConfirm callback
    (window as any).__permissionDialogOnConfirm = options.onConfirm;
    onOpen();
  };

  return {
    isOpen,
    onOpen,
    onClose,
    showPermissionDialog
  };
};

export default PermissionDialog;

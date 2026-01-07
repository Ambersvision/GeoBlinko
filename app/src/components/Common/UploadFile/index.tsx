import { useDropzone } from "react-dropzone";
import { Button } from "@heroui/react";
import { Icon } from '@/components/Common/Iconify/icons';
import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { RootStore } from "@/store";
import { ToastPlugin } from "@/store/module/Toast/Toast";
import { BlinkoStore } from "@/store/blinkoStore";
import { observer } from "mobx-react-lite";
import { getBlinkoEndpoint } from "@/lib/blinkoEndpoint";
import axiosInstance from "@/lib/axios";
type IProps = {
  onUpload?: ({ filePath, fileName }) => void
  children?: React.ReactNode
  acceptImage?: boolean
}

export const UploadFileWrapper = observer(({ onUpload, children, acceptImage = false }: IProps) => {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const cancelSourceRef = useRef(axios.CancelToken.source())
  const blinko = RootStore.Get(BlinkoStore)

  const cancelUpload = () => {
    if (cancelSourceRef.current) {
      cancelSourceRef.current.cancel('Upload cancelled by user')
      setIsLoading(false)
      setUploadProgress(0)
      // Create new cancel token for next upload
      cancelSourceRef.current = axios.CancelToken.source()
      RootStore.Get(ToastPlugin).info(t('upload-cancelled'))
    }
  }

  const {
    getRootProps,
    getInputProps,
    open
  } = useDropzone({
    multiple: false,
    noClick: true,
    accept: acceptImage ? {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    } : undefined,
    onDrop: async acceptedFiles => {
      setIsLoading(true)
      setUploadProgress(0)
      try {
        const file = acceptedFiles[0]!
        const formData = new FormData();
        formData.append('file', file)

        const { onUploadProgress } = RootStore.Get(ToastPlugin)
          .setSizeThreshold(40)
          .uploadProgress(file, (progress) => {
            setUploadProgress(progress)
          });

        const response = await axiosInstance.post(getBlinkoEndpoint('/api/file/upload'), formData, {
          onUploadProgress,
          cancelToken: cancelSourceRef.current.token
        });

        onUpload?.(response.data)
      } catch (error: any) {
        if (!axios.isCancel(error)) {
          console.error('Upload failed:', error);
          RootStore.Get(ToastPlugin).error(t('upload-failed'))
        }
      } finally {
        setIsLoading(false)
        setUploadProgress(0)
      }
    }
  });

  return <div {...getRootProps()}>
    <input {...getInputProps()} />
    {children ?
      <div onClick={open}>{children}</div>
      : <div className="flex gap-2">
        <Button
          isDisabled={blinko.config.value?.objectStorage === 's3' || !isLoading}
          onPress={open}
          color='primary'
          startContent={<Icon icon="tabler:upload" width="20" height="20" />}
          size="sm"
        >
          {t('upload')}
        </Button>
        {isLoading && (
          <Button
            onPress={cancelUpload}
            color="danger"
            variant="light"
            size="sm"
          >
            <Icon icon="tabler:x" width="20" height="20" />
          </Button>
        )}
      </div>}
  </div>
})
import { observer } from 'mobx-react-lite'
import { EditorStore } from '../../editorStore'
import { IconButton } from '../IconButton'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/Common/Iconify/icons'

interface Props {
  store: EditorStore
  onClick?: () => void
}

export const LocationButton = observer(({ store, onClick }: Props) => {
  const { t } = useTranslation()
  const hasLocations = store.locations && store.locations.length > 0

  return (
    <div
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick?.()
      }}
    >
      <IconButton
        tooltip={t('location.picker.title')}
        icon={hasLocations ? 'solar:map-point-bold' : 'solar:map-point-linear'}
        className={hasLocations ? 'text-primary' : ''}
      />
    </div>
  )
})

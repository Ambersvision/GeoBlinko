import { observer } from "mobx-react-lite"
import Editor from "../Common/Editor"
import { RootStore } from "@/store"
import { BlinkoStore } from "@/store/blinkoStore"
import dayjs from "@/lib/dayjs"
import { useEffect, useRef, useState } from "react"
import { NoteType } from "@shared/lib/types"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { LocationPicker, LocationData } from "@/components/LocationPicker"
import { eventBus } from "@/lib/event"
import { geolocationService } from "@/services/GeolocationService"
import { ToastPlugin } from "@/store/module/Toast/Toast"
import { wgs84ToGcj02 } from "@/lib/helper"

type IProps = {
  mode: 'create' | 'edit',
  onSended?: () => void,
  onHeightChange?: (height: number) => void,
  height?: number,
  isInDialog?: boolean,
  withoutOutline?: boolean,
  initialData?: { file?: File, text?: string },
  autoOpenLocationPicker?: boolean
}

export const BlinkoEditor = observer(({ mode, onSended, onHeightChange, isInDialog, withoutOutline, initialData, autoOpenLocationPicker }: IProps) => {
  const isCreateMode = mode == 'create'
  const blinko = RootStore.Get(BlinkoStore)
  const editorRef = useRef<any>(null)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false)
  const [editorLocations, setEditorLocations] = useState<LocationData[]>([])

  const store = RootStore.Local(() => ({
    get noteContent() {
      if (isCreateMode) {
        try {
          const local = blinko.createContentStorage.value
          const blinkoContent = blinko.noteContent
          return local?.content != '' ? local?.content : blinkoContent
        } catch (error) {
          return ''
        }
      } else {
        try {
          const local = blinko.editContentStorage.list?.find(i => Number(i.id) == Number(blinko.curSelectedNote!.id))
          const blinkoContent = blinko.curSelectedNote?.content ?? ''
          return local?.content != '' ? (local?.content ?? blinkoContent) : blinkoContent
        } catch (error) {
          return ''
        }
      }
    },
    set noteContent(v: string) {
      if (isCreateMode) {
        try {
          blinko.noteContent = v
          blinko.createContentStorage.save({ content: v })
        } catch (error) {
          console.error(error)
        }
      } else {
        try {
          blinko.curSelectedNote!.content = v
          const hasLocal = blinko.editContentStorage.list?.find(i => Number(i.id) == Number(blinko.curSelectedNote!.id))
          if (hasLocal) {
            hasLocal.content = v
            blinko.editContentStorage.save()
          } else {
            blinko.editContentStorage.push({ content: v, id: Number(blinko.curSelectedNote!.id) })
          }
        } catch (error) {
          console.error(error)
        }
      }
    },
    get files(): any {
      if (mode == 'create') {
        const attachments = blinko.createAttachmentsStorage.list
        if (attachments.length) {
          return (attachments)
        } else {
          return []
        }
      } else {
        return blinko.curSelectedNote?.attachments
        // const attachments = blinko.editAttachmentsStorage.list.filter(i => Number(i.id) == Number(blinko.curSelectedNote!.id))
        // if (attachments?.length) {
        //   return attachments
        // } else {
        //   return blinko.curSelectedNote?.attachments
        // }
      }
    }
  }))

  // 自动获取位置（仅创建模式且用户未手动添加位置时）
  useEffect(() => {
    if (mode === 'create' && editorLocations.length === 0) {
      const fetchAutoLocation = async () => {
        try {
          const position = await geolocationService.getCurrentPosition();
          // 转换为 GCJ02 坐标（高德坐标系）
          const gcj = wgs84ToGcj02(position.latitude, position.longitude);

          const autoLocation: LocationData = {
            id: `auto_${Date.now()}`,
            latitude: gcj.latitude,
            longitude: gcj.longitude,
            address: '自动获取',
            formattedAddress: '自动获取',
            poiName: '自动获取',
            distance: '0米',
            createdAt: new Date().toISOString()
          };

          setEditorLocations([autoLocation]);
          console.log('[BlinkoEditor] Auto location added:', autoLocation);
        } catch (error) {
          // 获取位置失败不提示，用户可以手动添加
          console.log('[BlinkoEditor] Auto location fetch failed:', error);
        }
      };

      // 延迟获取位置，避免阻塞界面
      const timer = setTimeout(fetchAutoLocation, 500);
      return () => clearTimeout(timer);
    }
  }, [mode, editorLocations.length]);

  useEffect(() => {
    blinko.isCreateMode = mode == 'create'
    if (mode == 'create') {
      if (isInDialog) {
        document.documentElement.style.setProperty('--min-editor-height', `50vh`)
      }
      const local = blinko.createContentStorage.value
      if (local && local.content != '') {
        blinko.noteContent = local.content
      }
    } else {
      document.documentElement.style.setProperty('--min-editor-height', `unset`)
      try {
        const local = blinko.editContentStorage.list?.find(i => Number(i.id) == Number(blinko.curSelectedNote!.id))
        if (local && local?.content != '') {
          blinko.curSelectedNote!.content = local!.content
        }
        // 加载编辑模式下的位置数据
        if (blinko.curSelectedNote?.metadata?.locations) {
          setEditorLocations(blinko.curSelectedNote.metadata.locations)
        }
      } catch (error) {
        console.error(error)
      }
    }
  }, [mode])

  // 自动打开位置选择器（用于编辑位置的场景）
  useEffect(() => {
    if (autoOpenLocationPicker) {
      console.log('[BlinkoEditor] Auto-opening location picker');
      setIsLocationPickerOpen(true);
    }
  }, [autoOpenLocationPicker])

  // 处理位置按钮点击
  const handleLocationButtonPress = () => {
    console.log('[BlinkoEditor] Location button pressed, opening picker');
    setIsLocationPickerOpen(true);
  }

  // 处理插入位置文本到编辑器
  const handleInsertLocationText = (text: string) => {
    // 通过 eventBus 触发 editor:insert 事件
    // 这样可以复用 Editor 组件中已有的插入逻辑
    eventBus.emit('editor:insert', text)
  }


  return <div className={`h-full ${withoutOutline ? '' : ''}`} ref={editorRef} id='global-editor' data-tauri-drag-region onClick={() => {
    blinko.isCreateMode = mode == 'create'
  }}>
    <Editor
      mode={mode}
      originFiles={store.files}
      originReference={!isCreateMode ? blinko.curSelectedNote?.references?.map(i => i.toNoteId) : []}
      content={store.noteContent}
      onChange={v => {
        store.noteContent = v
      }}
      withoutOutline={withoutOutline}
      initialData={initialData}
      onLocationButtonPress={handleLocationButtonPress}
      onHeightChange={() => {
        onHeightChange?.(editorRef.current?.clientHeight ?? 75)
        if (editorRef.current) {
          const editorElement = document.getElementById('global-editor');
          if (editorElement && editorElement.children[0]) {
            //@ts-ignore
            editorElement.__storeInstance = editorElement.children[0].__storeInstance;
          }
        }
      }}
      isSendLoading={blinko.upsertNote.loading.value}
      bottomSlot={
        isCreateMode ? <div className='text-xs text-ignore ml-2'>Drop to upload files</div> :
          <div className='text-xs text-desc'>{dayjs(blinko.curSelectedNote!.createdAt).format("YYYY-MM-DD hh:mm:ss")}</div>
      }
      onSend={async ({ files, references, noteType, metadata }) => {
        // 合并位置数据到 metadata
        const finalMetadata = {
          ...metadata,
          locations: editorLocations.length > 0 ? editorLocations : undefined
        }

        if (isCreateMode) {
          console.log("createMode", files, references, noteType, metadata)
          //@ts-ignore
          await blinko.upsertNote.call({ type: noteType, references, refresh: false, content: blinko.noteContent, attachments: files.map(i => { return { name: i.name, path: i.uploadPath, size: i.size, type: i.type } }), metadata: finalMetadata })
          blinko.createAttachmentsStorage.clear()
          blinko.createContentStorage.clear()
          setEditorLocations([])
          if (blinko.noteTypeDefault == NoteType.NOTE && searchParams.get('path') != 'notes') {
            await navigate('/?path=notes')
            blinko.forceQuery++
          }
          if (blinko.noteTypeDefault == NoteType.BLINKO && location.pathname != '/') {
            await navigate('/')
            blinko.forceQuery++
          }
          blinko.updateTicker++
        } else {
          await blinko.upsertNote.call({
            id: blinko.curSelectedNote!.id,
            type: noteType,
            //@ts-ignore
            content: blinko.curSelectedNote.content,
            //@ts-ignore
            attachments: files.map(i => { return { name: i.name, path: i.uploadPath, size: i.size, type: i.type } }),
            references,
            metadata: finalMetadata
          })
          try {
            const index = blinko.editAttachmentsStorage.list?.findIndex(i => i.id == blinko.curSelectedNote!.id)
            if (index != -1) {
              blinko.editAttachmentsStorage.remove(index)
              blinko.editContentStorage.remove(index)
            }
          } catch (error) {
            console.error(error)
          }
          setEditorLocations([])
        }
        onSended?.()
      }} />

      {/* 位置选择器 */}
      <LocationPicker
        isOpen={isLocationPickerOpen}
        initialLocations={editorLocations}
        onClose={() => setIsLocationPickerOpen(false)}
        onInsertLocationText={handleInsertLocationText}
        onAddLocations={(locations) => {
          setEditorLocations(locations)
        }}
      />
    </div>
})



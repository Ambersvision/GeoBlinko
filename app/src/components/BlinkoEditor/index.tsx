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

type IProps = {
  mode: 'create' | 'edit',
  onSended?: () => void,
  onHeightChange?: (height: number) => void,
  height?: number,
  isInDialog?: boolean,
  withoutOutline?: boolean,
  initialData?: { file?: File, text?: string }
}

export const BlinkoEditor = observer(({ mode, onSended, onHeightChange, isInDialog, withoutOutline, initialData }: IProps) => {
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

  // 监听打开位置选择器事件（仅在编辑对话框模式下）
  useEffect(() => {
    const handleOpenLocationPicker = () => {
      // 只在编辑对话框模式下响应位置选择器事件
      // 排除主页上的创建模式编辑器
      if (!isCreateMode && isInDialog) {
        setIsLocationPickerOpen(true)
      }
    }
    eventBus.on('editor:openLocationPicker', handleOpenLocationPicker)
    return () => {
      eventBus.off('editor:openLocationPicker', handleOpenLocationPicker)
    }
  }, [isCreateMode, isInDialog])

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
          locations: editorLocations
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



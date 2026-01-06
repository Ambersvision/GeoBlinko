import { observer } from "mobx-react-lite";
import { Button, Card, Select, SelectItem, Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import { RootStore } from "@/store";
import { PromiseCall } from "@/store/standard/PromiseState";
import dayjs from "@/lib/dayjs";
import { api } from "@/lib/trpc";
import { Item } from "./Item";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { RangeCalendar } from "@heroui/react";
import { today, getLocalTimeZone } from "@internationalized/date";
import { helper } from "@/lib/helper";
import { ToastPlugin } from "@/store/module/Toast/Toast";
import { Icon } from '@/components/Common/Iconify/icons';
import { CollapsibleCard } from "@/components/Common/CollapsibleCard";
import { getBlinkoEndpoint } from "@/lib/blinkoEndpoint";
import { downloadFromLink } from "@/lib/tauriHelper";
import { UserStore } from "@/store/user";

export const ExportSetting = observer(() => {
  const { t } = useTranslation();
  const user = RootStore.Get(UserStore);
  const [exportFormat, setExportFormat] = useState("markdown");

  const [dateRange, setDateRange] = useState<{
    start: any;
    end: any;
  }>({
    start: null,
    end: null
  });
  const [focusedValue, setFocusedValue] = useState(today(getLocalTimeZone()));

  const now = today(getLocalTimeZone());
  const isSuperAdmin = user.isSuperAdmin;

  const formatOptions = [
    { label: "Blinko Backup (.bko)", value: "blinko", requireSuperAdmin: true },
    { label: "Markdown", value: "markdown", requireSuperAdmin: false },
    { label: "JSON", value: "json", requireSuperAdmin: false },
    { label: "CSV", value: "csv", requireSuperAdmin: false }
  ];

  const availableFormats = formatOptions.filter(opt => !opt.requireSuperAdmin || isSuperAdmin);

  // If current format is not available (e.g., non-superadmin had selected blinko), reset to markdown
  if (!isSuperAdmin && exportFormat === 'blinko') {
    setExportFormat('markdown');
  }


  const handleExport = async () => {
    RootStore.Get(ToastPlugin).loading(t('exporting'), { id: 'exporting' })

    try {
      if (exportFormat === 'blinko') {
        // Export to .bko format (full backup)
        const res = await PromiseCall(api.task.exportBlinkoBackup.mutate({
          baseURL: window.location.origin
        }));
        RootStore.Get(ToastPlugin).dismiss('exporting')
        if (res?.filePath) {
          downloadFromLink(getBlinkoEndpoint(res.filePath));
          RootStore.Get(ToastPlugin).success('Backup exported successfully')
        }
      } else {
        // Export to Markdown/CSV/JSON format
        const exportParams: any = {
          baseURL: window.location.origin,
          format: exportFormat as 'markdown' | 'csv' | 'json'
        };

        if (dateRange.start && dateRange.end) {
          exportParams.startDate = new Date(dateRange.start.toString());
          exportParams.endDate = new Date(dateRange.end.toString());
        }

        const res = await PromiseCall(api.task.exportMarkdown.mutate(exportParams));
        RootStore.Get(ToastPlugin).dismiss('exporting')
        if (res?.downloadUrl) {
          downloadFromLink(getBlinkoEndpoint(res.downloadUrl));
        }
      }
    } catch (error) {
      RootStore.Get(ToastPlugin).error(error.message)
    }
  };

  return (
    <CollapsibleCard
      icon="tabler:file-export"
      title={t('export')}
    >
      <Card shadow="none" className="flex flex-col p-4 bg-background">
        <Item
          leftContent={<>{t('export-format')}</>}
          rightContent={
            <Select
              selectedKeys={[exportFormat]}
              onChange={e => setExportFormat(e.target.value)}
              className="w-[200px]"
            >
              {availableFormats.map((item) => (
                <SelectItem key={item.value}>{t(item.label)}</SelectItem>
              ))}
            </Select>
          }
        />

        <Item
          leftContent={<>{t('time-range')}</>}
          rightContent={
            <Popover placement="bottom" classNames={{
              content: [
                "p-0 bg-transparent border-none shadow-none",
              ],
            }}>
              <PopoverTrigger>
                <Button variant="flat" >
                  {dateRange.start && dateRange.end ? (
                    `${dayjs(new Date(dateRange.start.toString())).format('YYYY-MM-DD')} ~ ${dayjs(new Date(dateRange.end.toString())).format('YYYY-MM-DD')}`
                  ) : t('all')}
                </Button>
              </PopoverTrigger>
              <PopoverContent>
                <div className="flex flex-col gap-2">
                  <RangeCalendar
                    className="bg-background"
                    value={dateRange.start && dateRange.end ? dateRange : undefined}
                    onChange={setDateRange}
                    focusedValue={focusedValue}
                    onFocusChange={setFocusedValue}
                  />
                </div>
              </PopoverContent>
            </Popover>
          }
        />


        <div className="flex justify-end">
          <Button
            className="mt-4"
            color="primary"
            onPress={handleExport}
            startContent={<Icon icon="system-uicons:arrow-top-right" width="24" height="24" />}
          >
            {t('export')}
          </Button>
        </div>

      </Card>
    </CollapsibleCard>
  );
});
'use client';

import Image from 'next/image';
import { ZaloDocumentButton } from '@/features/zalo-crm/zalo-document-share';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import CalendarViewWeekOutlinedIcon from '@mui/icons-material/CalendarViewWeekOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import { useQuery } from '@tanstack/react-query';
import { toBlob } from 'html-to-image';
import x3salesLogo from '@assets/logos/x3sales-logo.svg';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppDetailDialog } from '@/components/dialog/app-detail-dialog';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { formatCustomerIdentity } from '@/lib/customer-utils';
import { getMediaPreviewUrl } from '@/lib/media-url';
import { formatDate } from '@/lib/utils';
import api from '@/services/api/client';
import type { WeeklyReport, WeeklyReportCurrency } from '@/types/weekly-report';
import { formatWeeklyReportMoney, getWeeklyReportCurrency } from '@/lib/weekly-report-money';

type WeeklyReportCustomerPreviewDialogProps = {
  report: WeeklyReport | null;
  onClose: () => void;
  autoCopyImage?: boolean;
};

function MetricCard({
  label,
  value,
  currency,
  icon,
}: {
  label: string;
  value?: string | number | null;
  currency: WeeklyReportCurrency;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="min-h-10 text-sm font-bold leading-5 text-slate-600">{label}</p>
          <p className="mt-2 break-words text-lg font-black tabular-nums text-slate-950">
            {formatWeeklyReportMoney(value, currency)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function WeeklyReportCustomerPreviewDialog({
  report,
  onClose,
  autoCopyImage = false,
}: WeeklyReportCustomerPreviewDialogProps) {
  const notify = useAppNotification();
  const customerSheetRef = useRef<HTMLElement | null>(null);
  const [sheetReady, setSheetReady] = useState(false);
  const attachSheet = useCallback((node: HTMLElement | null) => {
    customerSheetRef.current = node;
    setSheetReady(Boolean(node));
  }, []);
  const [isCopyingImage, setIsCopyingImage] = useState(false);
  const [downloadBlob, setDownloadBlob] = useState<Blob | null>(null);
  const attemptedAutoCopy = useRef(false);
  const copyImageRef = useRef<(() => Promise<void>) | null>(null);
  const copyLock = useRef(false);

  const {
    data: detailedReport,
    isFetching,
    isError,
  } = useQuery<WeeklyReport & { deliveryVersion?: string }>({
    queryKey: ['weekly-reports', report ? String(report.id) : 'customer-preview'],
    queryFn: () =>
      api.get<WeeklyReport>(`/weekly-reports/${report?.id}`).then((response) => response.data),
    enabled: Boolean(report),
  });

  useEffect(() => {
    if (!report) {
      attemptedAutoCopy.current = false;
      setDownloadBlob(null);
      return;
    }
    if (
      autoCopyImage &&
      sheetReady &&
      detailedReport &&
      !isFetching &&
      !isError &&
      !attemptedAutoCopy.current
    ) {
      attemptedAutoCopy.current = true;
      void copyImageRef.current?.();
    }
  }, [report, autoCopyImage, sheetReady, detailedReport, isFetching, isError]);

  if (!report) return null;

  const currentReport = detailedReport || report;
  const currency = getWeeklyReportCurrency(currentReport.currency);
  const hasRemainingBudget =
    currentReport.remainingAccountBudget != null &&
    String(currentReport.remainingAccountBudget).trim() !== '';
  const projectName =
    currentReport.project?.projectName || currentReport.project?.projectCode || 'Báo cáo tuần';
  const projectCode = currentReport.project?.projectCode || `Báo cáo #${currentReport.id}`;
  const customerName = formatCustomerIdentity(currentReport.customer, 'Khách hàng');
  const imageAttachments = (currentReport.attachments || []).filter(
    (attachment) => !attachment.mimeType || attachment.mimeType.startsWith('image/'),
  );
  const copyCustomerImage = async () => {
    if (!customerSheetRef.current || copyLock.current || isFetching || isError) return;

    copyLock.current = true;
    setIsCopyingImage(true);
    setDownloadBlob(null);

    try {
      const sheet = customerSheetRef.current;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          Promise.all([
            document.fonts?.ready,
            ...Array.from(sheet.querySelectorAll('img')).map(async (image) => {
              // Includes images below the dialog fold; refuse partial exports on broken media.
              image.loading = 'eager';
              try {
                await image.decode();
              } catch {
                throw new Error('Có ảnh chưa tải được. Hãy tải lại ảnh trước khi xuất báo cáo.');
              }
              if (!image.naturalWidth) throw new Error('Có ảnh chưa tải được. Hãy thử lại.');
            }),
          ]),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('Ảnh tải quá lâu. Hãy thử lại sau.')), 20000);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }

      const width = Math.ceil(Math.max(sheet.scrollWidth, sheet.getBoundingClientRect().width));
      const height = Math.ceil(Math.max(sheet.scrollHeight, sheet.getBoundingClientRect().height));
      const blob = await toBlob(sheet, {
        backgroundColor: '#ffffff',
        cacheBust: true,
        width,
        height,
        pixelRatio: 2,
        style: {
          width: `${width}px`,
          height: `${height}px`,
          margin: '0',
          maxWidth: 'none',
          overflow: 'visible',
        },
      });

      if (!blob) throw new Error('Không thể tạo ảnh báo cáo tuần');

      setDownloadBlob(blob);
      try {
        if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined')
          throw new Error('Clipboard unavailable');
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        notify.success('Đã sao chép ảnh. Nhấn Ctrl+V để gửi.');
      } catch {
        notify.info('Ảnh đã sẵn sàng. Bấm Tải ảnh PNG nếu trình duyệt không cho sao chép.');
      }
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không thể lấy ảnh báo cáo tuần');
    } finally {
      setIsCopyingImage(false);
      copyLock.current = false;
    }
  };
  copyImageRef.current = copyCustomerImage;

  const downloadImage = () => {
    if (!downloadBlob) return;
    const url = URL.createObjectURL(downloadBlob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `bao-cao-tuan-${currentReport.id}-${currentReport.weekStartDate}.png`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <AppDetailDialog
      open
      title="Bản gửi khách"
      eyebrow={projectCode}
      subtitle={customerName}
      maxWidth="lg"
      loading={isFetching && !detailedReport}
      onClose={onClose}
      actions={
        <>
          <DialogActionButton
            tone="primary"
            startIcon={<PhotoCameraRoundedIcon />}
            disabled={!detailedReport || isFetching || isError || isCopyingImage}
            onClick={copyCustomerImage}
          >
            {isCopyingImage ? 'Đang lấy ảnh...' : 'Lấy ảnh'}
          </DialogActionButton>
          {downloadBlob && (
            <DialogActionButton startIcon={<DownloadRoundedIcon />} onClick={downloadImage}>
              Tải ảnh PNG
            </DialogActionButton>
          )}
          <ZaloDocumentButton
            kind="report"
            id={report.id}
            version={detailedReport?.deliveryVersion}
            getElement={() => customerSheetRef.current}
            disabled={isFetching || currentReport.status !== 'approved'}
          />
        </>
      }
    >
      <div className="overflow-x-auto bg-slate-100 p-3 sm:p-6">
        <article
          ref={attachSheet}
          className="mx-auto max-w-[1040px] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900"
        >
          <div className="space-y-5 px-6 py-6">
            <header className="grid gap-4 border-b-4 border-primary pb-5 md:grid-cols-[minmax(160px,1fr)_auto_minmax(160px,1fr)] md:items-center">
              <div className="flex justify-center md:justify-start">
                <Image src={x3salesLogo} alt="X3Sales" className="h-auto w-[150px]" priority />
              </div>
              <div className="text-center md:col-start-2">
                <h2 className="text-2xl font-black uppercase tracking-tight text-slate-950">
                  Báo cáo tuần
                </h2>
                <p className="mt-1.5 text-base font-extrabold uppercase tracking-wide text-blue-700">
                  {projectName}
                </p>
              </div>
              <div className="inline-flex min-h-10 w-fit max-w-full items-center justify-center gap-2 justify-self-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold tabular-nums text-slate-700 shadow-sm md:col-start-3 md:row-start-1 md:justify-self-end">
                <CalendarMonthOutlinedIcon aria-hidden fontSize="small" />
                <span>
                  {formatDate(currentReport.weekStartDate)} –{' '}
                  {formatDate(currentReport.weekEndDate)}
                </span>
              </div>
            </header>

            <section className="overflow-hidden rounded-xl border border-slate-200">
              <h3 className="border-b border-slate-200 bg-slate-100 px-5 py-3 text-base font-black uppercase text-slate-950">
                1. Tổng quan
              </h3>
              <div className="p-5">
                {imageAttachments.length > 0 ? (
                  <div
                    className={`grid gap-4 ${
                      imageAttachments.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                    }`}
                  >
                    {imageAttachments.map((attachment, index) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={attachment.id || `${attachment.fileUrl}-${index}`}
                        src={getMediaPreviewUrl(attachment.fileUrl) || attachment.fileUrl}
                        alt={`Hình ảnh tổng quan ${index + 1}`}
                        className="h-auto max-h-[520px] w-full rounded-lg border border-slate-200 bg-slate-50 object-contain"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid min-h-48 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm font-semibold text-slate-500">
                    Chưa có hình ảnh tổng quan
                  </div>
                )}
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200">
              <h3 className="border-b border-slate-200 bg-slate-100 px-5 py-3 text-base font-black uppercase text-slate-950">
                2. Chi tiêu tuần qua
                <span className="ml-3 inline-flex rounded-md bg-white px-2 py-1 text-xs font-bold text-blue-700 ring-1 ring-slate-200">
                  Đơn vị: {currency}
                </span>
              </h3>
              <div
                className={`grid gap-4 p-5 ${hasRemainingBudget ? 'grid-cols-4' : 'grid-cols-3'}`}
              >
                <MetricCard
                  currency={currency}
                  label="Chi phí"
                  value={currentReport.weeklySpendAmount}
                  icon={<PaidOutlinedIcon />}
                />
                <MetricCard
                  currency={currency}
                  label="Ngân sách trung bình / tuần"
                  value={currentReport.averageWeeklyBudget}
                  icon={<CalendarViewWeekOutlinedIcon />}
                />
                {hasRemainingBudget ? (
                  <MetricCard
                    currency={currency}
                    label="Ngân sách tài khoản còn lại"
                    value={currentReport.remainingAccountBudget}
                    icon={<AccountBalanceWalletOutlinedIcon />}
                  />
                ) : null}
                <MetricCard
                  currency={currency}
                  label="Tổng ngân sách"
                  value={currentReport.totalBudget ?? currentReport.monthlyBudget}
                  icon={<SavingsOutlinedIcon />}
                />
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200">
              <h3 className="border-b border-slate-200 bg-slate-100 px-5 py-3 text-base font-black uppercase text-slate-950">
                3. Đánh giá & phương án triển khai
              </h3>
              <div className="p-5">
                {currentReport.summary ? (
                  <p className="whitespace-pre-wrap text-sm font-medium leading-6 text-slate-700">
                    {currentReport.summary}
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-slate-500">
                    Chưa có ghi chú cho kỳ báo cáo này.
                  </p>
                )}
              </div>
            </section>

            <p className="text-center text-xs font-semibold text-slate-400">
              Cảm ơn quý khách đã tin tưởng và đồng hành cùng X3Sales.
            </p>
          </div>
        </article>
      </div>
    </AppDetailDialog>
  );
}

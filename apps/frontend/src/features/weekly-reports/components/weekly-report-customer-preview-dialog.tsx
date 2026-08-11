'use client';

import Image from 'next/image';
import { useRef, useState, type ReactNode } from 'react';
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
import type { WeeklyReport } from '@/types/weekly-report';

type WeeklyReportCustomerPreviewDialogProps = {
  report: WeeklyReport | null;
  onClose: () => void;
};

function formatCurrency(value?: string | number | null) {
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(Number(value) || 0))} đ`;
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value?: string | number | null;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="min-h-10 text-sm font-bold leading-5 text-slate-600">{label}</p>
          <p className="mt-2 whitespace-nowrap text-xl font-black tabular-nums text-slate-950">
            {formatCurrency(value)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function WeeklyReportCustomerPreviewDialog({
  report,
  onClose,
}: WeeklyReportCustomerPreviewDialogProps) {
  const notify = useAppNotification();
  const customerSheetRef = useRef<HTMLElement | null>(null);
  const [isCopyingImage, setIsCopyingImage] = useState(false);

  const { data: detailedReport, isFetching } = useQuery<WeeklyReport>({
    queryKey: ['weekly-reports', report ? String(report.id) : 'customer-preview'],
    queryFn: () =>
      api.get<WeeklyReport>(`/weekly-reports/${report?.id}`).then((response) => response.data),
    enabled: Boolean(report),
  });

  if (!report) return null;

  const currentReport = detailedReport || report;
  const projectName =
    currentReport.project?.projectName || currentReport.project?.projectCode || 'Báo cáo tuần';
  const projectCode = currentReport.project?.projectCode || `Báo cáo #${currentReport.id}`;
  const customerName = formatCustomerIdentity(currentReport.customer, 'Khách hàng');
  const imageAttachments = (currentReport.attachments || []).filter(
    (attachment) => !attachment.mimeType || attachment.mimeType.startsWith('image/'),
  );
  const copyCustomerImage = async () => {
    if (!customerSheetRef.current || isCopyingImage) return;

    setIsCopyingImage(true);

    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        throw new Error('Trình duyệt không hỗ trợ sao chép ảnh vào clipboard');
      }

      const sheet = customerSheetRef.current;
      await document.fonts?.ready;
      const images = Array.from(sheet.querySelectorAll('img'));
      await Promise.all(
        images.map(
          (image) =>
            new Promise<void>((resolve) => {
              if (image.complete) {
                resolve();
                return;
              }

              image.addEventListener('load', () => resolve(), { once: true });
              image.addEventListener('error', () => resolve(), { once: true });
            }),
        ),
      );

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

      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      notify.success('Đã lấy ảnh báo cáo. Bạn có thể Ctrl+V để gửi khách.');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không thể lấy ảnh báo cáo tuần');
    } finally {
      setIsCopyingImage(false);
    }
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
        <DialogActionButton
          tone="primary"
          startIcon={<PhotoCameraRoundedIcon />}
          disabled={!detailedReport || isCopyingImage}
          onClick={copyCustomerImage}
        >
          {isCopyingImage ? 'Đang lấy ảnh...' : 'Lấy ảnh'}
        </DialogActionButton>
      }
    >
      <div className="overflow-x-auto bg-slate-100 p-3 sm:p-6">
        <article
          ref={customerSheetRef}
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
              </h3>
              <div className="grid grid-cols-4 gap-4 p-5">
                <MetricCard
                  label="Chi phí"
                  value={currentReport.weeklySpendAmount}
                  icon={<PaidOutlinedIcon />}
                />
                <MetricCard
                  label="Ngân sách trung bình / tuần"
                  value={currentReport.averageWeeklyBudget}
                  icon={<CalendarViewWeekOutlinedIcon />}
                />
                <MetricCard
                  label="Ngân sách tài khoản còn lại"
                  value={currentReport.remainingAccountBudget}
                  icon={<AccountBalanceWalletOutlinedIcon />}
                />
                <MetricCard
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

'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { useQuery } from '@tanstack/react-query';
import { toBlob } from 'html-to-image';
import x3salesLogo from '@assets/logos/x3sales-logo.svg';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppDetailDialog } from '@/components/dialog/app-detail-dialog';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ImageLightbox } from '@/components/media/image-lightbox';
import { getMediaPreviewUrl } from '@/lib/media-url';
import { getQuotationPaymentContent } from '@/lib/quotation-utils';
import {
  DEFAULT_SITE_PROFILE,
  SITE_PROFILE_OPTION_GROUP,
  siteProfileFromOptions,
} from '@/lib/site-profile-options';
import api from '@/services/api/client';
import type { AppOption } from '@/types/option';
import type { Quotation, QuotationItem } from '@/types/quotation';
import { QuotationItemsTable, type QuotationTableLine } from './quotation-items-table';

type QuotationPreviewDialogProps = {
  quotation: Quotation | null;
  onClose: () => void;
};

type PreviewMode = 'detail' | 'customer';

function toNumber(value: string | number | null | undefined) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatCurrency(value: string | number | null | undefined) {
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(toNumber(value)))} đ`;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN');
}

function metadataText(item: QuotationItem, key: string) {
  const value = item.metadata?.[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function quotationMetadata(quotation: Quotation, key: string) {
  const value = quotation.metadata?.[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function metadataBoolean(item: QuotationItem, key: string) {
  return item.metadata?.[key] === true;
}

function quotationLines(quotation: Quotation): QuotationTableLine[] {
  return (quotation.items || []).map((item, index) => ({
    id: item.id ?? `${item.itemName}-${index}`,
    no: index + 1,
    name: item.itemName,
    unit: metadataText(item, 'unit') || 'Dịch vụ',
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    amount: item.amountBeforeVat ?? (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    excludedFromTotal: metadataBoolean(item, 'excludedFromTotal'),
    highlighted: metadataBoolean(item, 'locked'),
  }));
}

function payableAmount(quotation: Quotation) {
  const total = toNumber(quotation.totalAmount);
  const paid = toNumber(quotation.paidAmount);
  const outstanding = quotation.outstandingAmount;

  if (outstanding !== null && outstanding !== undefined && outstanding !== '') {
    return Math.max(0, toNumber(outstanding));
  }

  return Math.max(0, total - paid);
}

function quotationQrUrl(quotation: Quotation) {
  const bankCode = quotationMetadata(quotation, 'bankCode');
  const accountNo = quotationMetadata(quotation, 'bankAccountNo');
  const accountName = quotationMetadata(quotation, 'bankAccountName');
  const paymentContent = getQuotationPaymentContent(quotation);
  const amount = payableAmount(quotation);

  if (!paymentContent || !bankCode || !accountNo || !accountName) return '';

  const params = new URLSearchParams({
    addInfo: paymentContent,
    accountName,
  });

  if (amount > 0) {
    params.set('amount', String(Math.round(amount)));
  }

  return `https://img.vietqr.io/image/${bankCode}-${accountNo}-qr_only.png?${params.toString()}`;
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-slate-800" title={value}>
        {value}
      </p>
    </div>
  );
}

function CustomerInfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-extrabold text-slate-950" title={value}>
        {value || '-'}
      </p>
    </div>
  );
}

function PaymentDetails({
  quotation,
  customerView = false,
}: {
  quotation: Quotation;
  customerView?: boolean;
}) {
  const qrUrl = quotationQrUrl(quotation);
  const amount = payableAmount(quotation);
  const bankName =
    quotationMetadata(quotation, 'bankName') || quotationMetadata(quotation, 'bankCode');
  const accountNo = quotationMetadata(quotation, 'bankAccountNo');
  const accountName = quotationMetadata(quotation, 'bankAccountName');
  const paymentContent = getQuotationPaymentContent(quotation);
  const hasBankDetails = Boolean(bankName && accountNo && accountName);

  if (!hasBankDetails) {
    return (
      <section
        className={
          customerView
            ? 'bg-slate-50 px-4 py-6 text-center'
            : 'rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center'
        }
      >
        <p className="text-sm font-semibold text-slate-600">
          Báo phí chưa có đủ thông tin tài khoản nhận tiền để tạo QR.
        </p>
      </section>
    );
  }

  return (
    <section
      className={
        customerView
          ? 'bg-white px-5 py-5'
          : 'rounded-xl border border-slate-200 bg-white px-5 py-5'
      }
    >
      <div
        className={`grid items-center gap-5 ${qrUrl ? 'md:grid-cols-[minmax(0,1fr)_220px]' : ''}`}
      >
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold text-slate-950">
            Đề nghị quý khách thanh toán theo thông tin chuyển khoản sau:
          </h3>

          <dl className="mt-3 space-y-1.5 text-sm leading-5 text-slate-700">
            <div className="flex min-w-0 gap-1.5">
              <dt className="shrink-0 font-medium">Số tài khoản:</dt>
              <dd className="select-all font-extrabold tabular-nums text-slate-950">{accountNo}</dd>
            </div>
            <div className="flex min-w-0 gap-1.5">
              <dt className="shrink-0 font-medium">Ngân hàng:</dt>
              <dd className="font-semibold text-slate-900">{bankName}</dd>
            </div>
            <div className="flex min-w-0 gap-1.5">
              <dt className="shrink-0 font-medium">Chủ tài khoản:</dt>
              <dd className="font-semibold text-slate-900">{accountName}</dd>
            </div>
            {paymentContent ? (
              <div className="flex min-w-0 gap-1.5">
                <dt className="shrink-0 font-medium">Nội dung:</dt>
                <dd className="select-all break-all font-mono font-extrabold text-primary">
                  {paymentContent}
                </dd>
              </div>
            ) : null}
            <div className="flex min-w-0 items-center gap-1.5">
              <dt className="shrink-0 font-medium">
                {amount > 0 ? 'Số tiền cần thanh toán:' : 'Tình trạng:'}
              </dt>
              <dd
                className={`flex items-center gap-1 font-extrabold tabular-nums ${
                  amount > 0 ? 'text-emerald-700' : 'text-sky-700'
                }`}
              >
                {amount > 0 ? (
                  formatCurrency(amount)
                ) : (
                  <>
                    <CheckCircleRoundedIcon className="!text-[18px]" /> Đã thu đủ
                  </>
                )}
              </dd>
            </div>
          </dl>

          <p className="mt-4 text-sm font-medium text-slate-700">Cảm ơn quý khách rất nhiều!</p>
        </div>

        {qrUrl ? (
          <div className="flex items-center justify-center md:justify-end">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrUrl}
              alt="Mã VietQR thanh toán báo phí"
              className="aspect-square h-auto w-full max-w-[320px] object-contain"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CustomerQuotationTable({ quotation }: { quotation: Quotation }) {
  const items = quotation.items || [];

  return (
    <section className="mt-5 overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full min-w-[860px] table-fixed text-sm">
        <thead className="bg-blue-700 text-left text-xs font-extrabold uppercase tracking-wide text-white">
          <tr>
            <th className="w-[70px] px-3 py-3">STT</th>
            <th className="px-3 py-3">Nội dung</th>
            <th className="w-[110px] px-3 py-3">ĐVT</th>
            <th className="w-[90px] px-3 py-3 text-right">Số lần</th>
            <th className="w-[150px] px-3 py-3 text-right">Đơn giá</th>
            <th className="w-[160px] px-3 py-3 text-right">Thành tiền</th>
            <th className="w-[150px] px-3 py-3 text-center">Thuế suất</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {items.map((item, index) => {
            const excludedFromTotal = metadataBoolean(item, 'excludedFromTotal');
            const amount =
              item.amountBeforeVat ?? toNumber(item.quantity) * toNumber(item.unitPrice);
            const taxRate = excludedFromTotal
              ? 'KCT'
              : `${toNumber(item.vatRate ?? quotation.vatRate)}%`;

            return (
              <tr
                key={item.id ?? `${item.itemName}-${index}`}
                className={excludedFromTotal ? 'bg-blue-50/60' : 'odd:bg-white even:bg-slate-50/60'}
              >
                <td className="px-3 py-3 font-bold text-slate-700">{index + 1}</td>
                <td className="px-3 py-3 font-semibold text-slate-900">
                  <span>{item.itemName || '-'}</span>
                  {excludedFromTotal ? (
                    <span className="ml-2 inline-flex rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-blue-700">
                      Tham khảo
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {metadataText(item, 'unit') || 'Dịch vụ'}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                  {new Intl.NumberFormat('vi-VN').format(toNumber(item.quantity))}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                  {formatCurrency(item.unitPrice)}
                </td>
                <td className="px-3 py-3 text-right font-extrabold tabular-nums text-slate-950">
                  {formatCurrency(amount)}
                </td>
                <td className="px-3 py-3 text-center font-bold text-slate-700">{taxRate}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="border-t-2 border-slate-300 bg-slate-50">
          <tr>
            <td colSpan={6} className="px-3 py-2.5 text-right font-bold text-slate-600">
              Tổng tiền trước thuế
            </td>
            <td className="whitespace-nowrap px-3 py-2.5 text-right font-extrabold tabular-nums text-slate-950">
              {formatCurrency(quotation.subtotalAmount)}
            </td>
          </tr>
          <tr>
            <td colSpan={6} className="px-3 py-2.5 text-right font-bold text-slate-600">
              Tổng thuế {toNumber(quotation.vatRate)}%
            </td>
            <td className="whitespace-nowrap px-3 py-2.5 text-right font-extrabold tabular-nums text-slate-950">
              {formatCurrency(quotation.vatAmount)}
            </td>
          </tr>
          {toNumber(quotation.depositAmount) > 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-2.5 text-right font-bold text-slate-600">
                Cọc <span className="font-medium text-slate-500">(không tính VAT)</span>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right font-extrabold tabular-nums text-slate-950">
                {formatCurrency(quotation.depositAmount)}
              </td>
            </tr>
          ) : null}
          <tr className="border-t border-emerald-200 bg-emerald-50">
            <td
              colSpan={6}
              className="whitespace-nowrap px-3 py-3 text-right font-extrabold uppercase text-emerald-800"
            >
              Tổng cộng tiền thanh toán
            </td>
            <td className="whitespace-nowrap px-3 py-3 text-right text-base font-black tabular-nums text-emerald-800">
              {formatCurrency(quotation.totalAmount)}
            </td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

export function QuotationPreviewDialog({ quotation, onClose }: QuotationPreviewDialogProps) {
  const notify = useAppNotification();
  const customerSheetRef = useRef<HTMLElement | null>(null);
  const [mode, setMode] = useState<PreviewMode>('detail');
  const [isCopyingImage, setIsCopyingImage] = useState(false);
  const [reconciliationPreviewIndex, setReconciliationPreviewIndex] = useState<number | null>(null);

  const { data: siteProfileOptions = [] } = useQuery<AppOption[]>({
    queryKey: ['options', SITE_PROFILE_OPTION_GROUP],
    queryFn: () =>
      api
        .get<AppOption[]>('/options', { params: { groups: SITE_PROFILE_OPTION_GROUP } })
        .then((response) => response.data),
    enabled: Boolean(quotation),
  });

  const companyInfo = useMemo(
    () =>
      siteProfileOptions.length > 0
        ? siteProfileFromOptions(siteProfileOptions)
        : DEFAULT_SITE_PROFILE,
    [siteProfileOptions],
  );

  useEffect(() => {
    setMode('detail');
  }, [quotation?.id]);

  if (!quotation) return null;

  const reconciliationImages = quotation.accountReconciliationImageUrls || [];
  const partyName =
    quotation.customer?.customerName || quotation.lead?.customerName || 'Chưa xác định khách hàng';
  const statusLabel =
    quotation.status === 'refunded'
      ? Number(quotation.compensationAmount) > 0
        ? 'Đã hoàn tiền + bù thêm'
        : 'Đã hoàn tiền'
      : quotation.status === 'won'
        ? 'Đã thanh toán'
        : 'Báo phí';
  const projectCode = quotation.project?.projectCode || 'Chưa gắn dự án';
  const reconciliationLinks = reconciliationImages
    .map((imageUrl) => getMediaPreviewUrl(imageUrl) || imageUrl)
    .filter(Boolean);
  const reconciliationClipboardText =
    reconciliationLinks.length === 1
      ? `Ảnh đối soát: ${reconciliationLinks[0]}`
      : reconciliationLinks.length > 1
        ? `Ảnh đối soát:\n${reconciliationLinks
            .map((imageUrl, index) => `${index + 1}. ${imageUrl}`)
            .join('\n')}`
        : '';

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
      const blobPromise = toBlob(sheet, {
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
      }).then((blob) => {
        if (!blob) throw new Error('Không thể tạo ảnh báo phí');
        return blob;
      });

      const clipboardItem = new ClipboardItem({
        'image/png': blobPromise,
        ...(reconciliationClipboardText
          ? {
              'text/plain': new Blob([reconciliationClipboardText], {
                type: 'text/plain',
              }),
            }
          : {}),
      });

      await navigator.clipboard.write([clipboardItem]);
      notify.success(
        reconciliationClipboardText
          ? 'Đã lấy ảnh báo phí kèm link ảnh đối soát. Bạn có thể Ctrl+V để gửi khách.'
          : 'Đã lấy ảnh báo phí. Bạn có thể Ctrl+V để gửi khách.',
      );
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không thể lấy ảnh báo phí');
    } finally {
      setIsCopyingImage(false);
    }
  };

  return (
    <AppDetailDialog
      open
      title={mode === 'detail' ? 'Chi tiết báo phí' : 'Bản gửi khách'}
      eyebrow={quotation.quotationCode || `Báo phí #${quotation.id}`}
      subtitle={partyName}
      maxWidth="lg"
      onClose={onClose}
      actions={
        mode === 'detail' ? (
          <>
            <DialogActionButton
              href={`/quotations/${quotation.id}`}
              startIcon={<EditRoundedIcon />}
            >
              Chỉnh sửa
            </DialogActionButton>
            <DialogActionButton
              tone="primary"
              startIcon={<ReceiptLongRoundedIcon />}
              onClick={() => setMode('customer')}
            >
              Bản gửi khách
            </DialogActionButton>
          </>
        ) : (
          <>
            <DialogActionButton
              startIcon={<VisibilityRoundedIcon />}
              onClick={() => setMode('detail')}
            >
              Chi tiết
            </DialogActionButton>
            <DialogActionButton
              href={`/quotations/${quotation.id}`}
              startIcon={<EditRoundedIcon />}
            >
              Chỉnh sửa
            </DialogActionButton>
            <DialogActionButton
              tone="primary"
              startIcon={<PhotoCameraRoundedIcon />}
              disabled={isCopyingImage}
              onClick={copyCustomerImage}
            >
              {isCopyingImage ? 'Đang lấy ảnh...' : 'Lấy ảnh'}
            </DialogActionButton>
          </>
        )
      }
    >
      {mode === 'detail' ? (
        <div className="space-y-4 bg-slate-50/60 p-5">
          <section className="grid overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-slate-200">
            <InfoCell label="Dự án" value={projectCode} />
            <InfoCell
              label="Dịch vụ"
              value={quotation.serviceName || quotation.serviceCode || '-'}
            />
            <InfoCell label="Ngày báo" value={formatDate(quotation.createdAt)} />
            <InfoCell label="Tình trạng" value={statusLabel} />
          </section>

          {toNumber(quotation.refundedAmount) > 0 || toNumber(quotation.compensationAmount) > 0 ? (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-slate-200">
                <InfoCell
                  label="Đã nhận ban đầu"
                  value={formatCurrency(quotation.grossPaidAmount)}
                />
                <InfoCell label="Đã hoàn" value={formatCurrency(quotation.refundedAmount)} />
                <InfoCell label="Thực thu" value={formatCurrency(quotation.paidAmount)} />
                <InfoCell
                  label="Còn phải thu"
                  value={formatCurrency(quotation.outstandingAmount)}
                />
              </div>
              {toNumber(quotation.compensationAmount) > 0 ? (
                <p className="border-t border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600">
                  Bù thêm ngoài tiền khách đã nộp:
                  <span className="font-extrabold text-rose-700">
                    {formatCurrency(quotation.compensationAmount)}
                  </span>
                  <span className="text-slate-400"> · Không làm giảm công nợ báo phí</span>
                </p>
              ) : null}
            </section>
          ) : null}

          <section className="overflow-hidden rounded-xl bg-white">
            <QuotationItemsTable
              lines={quotationLines(quotation)}
              subtotal={quotation.subtotalAmount}
              vatRate={quotation.vatRate}
              vatAmount={quotation.vatAmount}
              deposit={quotation.depositAmount}
              total={quotation.totalAmount}
            />
          </section>

          <PaymentDetails quotation={quotation} />

          {reconciliationImages.length > 0 ? (
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-950">
                  Ảnh đối soát chi tiết tài khoản quảng cáo
                </h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                  {reconciliationImages.length}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {reconciliationImages.map((imageUrl, index) => {
                  const previewUrl = getMediaPreviewUrl(imageUrl) || imageUrl;

                  return (
                    <button
                      type="button"
                      key={`${imageUrl}-${index}`}
                      aria-haspopup="dialog"
                      aria-label={`Xem ảnh đối soát ${index + 1}`}
                      title={`Xem ảnh đối soát ${index + 1}`}
                      className="group min-w-0 cursor-zoom-in overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-left shadow-sm transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      onClick={() => setReconciliationPreviewIndex(index)}
                    >
                      <span className="block aspect-[1.586/1] overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewUrl}
                          alt={`Ảnh đối soát tài khoản quảng cáo ${index + 1}`}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                      </span>
                      <span className="block truncate border-t border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                        Ảnh {index + 1}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {quotation.note ? (
            <section className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Ghi chú
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-700">
                {quotation.note}
              </p>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto bg-slate-100 p-3 sm:p-6">
          <article
            ref={customerSheetRef}
            className="mx-auto max-w-[1040px] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900"
          >
            <header className="grid gap-5 border-b-4 border-primary px-6 py-5 md:grid-cols-[220px,minmax(0,1fr)] md:items-center">
              <div className="flex items-center">
                <Image src={x3salesLogo} alt="X3Sales" className="h-auto w-[160px]" priority />
              </div>
              <div className="space-y-1 text-sm leading-5 text-slate-600 md:text-right">
                <p className="font-extrabold text-slate-950">{companyInfo.companyName}</p>
                {companyInfo.taxCode ? <p>MST: {companyInfo.taxCode}</p> : null}
                <p>{[companyInfo.phone, companyInfo.website].filter(Boolean).join(' · ')}</p>
                {companyInfo.address ? <p>{companyInfo.address}</p> : null}
                {companyInfo.office ? <p>Văn phòng: {companyInfo.office}</p> : null}
              </div>
            </header>

            <div className="px-6 py-6">
              <div className="text-center">
                <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-slate-950">
                  Bảng báo giá thanh toán
                </h2>
                <p className="mt-1.5 text-base font-extrabold uppercase tracking-wide text-blue-700">
                  {quotation.serviceName || quotation.serviceCode || 'Dịch vụ'}
                </p>
              </div>

              <section className="mt-6 grid overflow-hidden rounded-lg border border-slate-200 bg-slate-50 md:grid-cols-3 md:divide-x md:divide-slate-200">
                <CustomerInfoCell label="Khách hàng" value={partyName} />
                <CustomerInfoCell label="Dự án" value={projectCode} />
                <CustomerInfoCell
                  label="Tổng thanh toán"
                  value={formatCurrency(quotation.totalAmount)}
                />
              </section>

              {reconciliationImages.length > 0 ? (
                <section className="mt-5">
                  <h3 className="mb-3 text-sm font-extrabold text-slate-950">
                    Ảnh đối soát chi tiết tài khoản quảng cáo
                  </h3>

                  <div
                    className={`grid gap-3 ${
                      reconciliationImages.length === 1
                        ? 'grid-cols-1'
                        : reconciliationImages.length === 2
                          ? 'grid-cols-2'
                          : 'grid-cols-3'
                    }`}
                  >
                    {reconciliationImages.map((imageUrl, index) => {
                      const previewUrl = getMediaPreviewUrl(imageUrl) || imageUrl;

                      return (
                        <button
                          type="button"
                          key={`${imageUrl}-${index}`}
                          aria-haspopup="dialog"
                          aria-label={`Xem ảnh đối soát ${index + 1}`}
                          title={`Xem ảnh đối soát ${index + 1}`}
                          className="group min-w-0 cursor-zoom-in overflow-hidden rounded-lg border border-slate-200 bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                          onClick={() => setReconciliationPreviewIndex(index)}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={previewUrl}
                            alt={`Ảnh đối soát tài khoản quảng cáo ${index + 1}`}
                            loading="lazy"
                            className="h-auto w-full object-contain transition-opacity duration-200 group-hover:opacity-90"
                          />
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              <CustomerQuotationTable quotation={quotation} />

              {quotation.note ? (
                <section className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <h3 className="text-sm font-extrabold text-slate-950">Lưu ý</h3>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
                    {quotation.note}
                  </p>
                </section>
              ) : null}

              <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                <PaymentDetails quotation={quotation} customerView />
              </div>

              <p className="mt-5 text-center text-xs font-semibold text-slate-400">
                Cảm ơn quý khách đã tin tưởng và lựa chọn dịch vụ của X3Sales.
              </p>
            </div>
          </article>
        </div>
      )}

      <ImageLightbox
        open={reconciliationPreviewIndex !== null}
        images={reconciliationImages.map((imageUrl, index) => ({
          src: imageUrl,
          alt: `Ảnh đối soát tài khoản quảng cáo ${index + 1}`,
          label: `Ảnh ${index + 1}`,
        }))}
        initialIndex={reconciliationPreviewIndex || 0}
        title="Ảnh đối soát tài khoản quảng cáo"
        onClose={() => setReconciliationPreviewIndex(null)}
      />
    </AppDetailDialog>
  );
}

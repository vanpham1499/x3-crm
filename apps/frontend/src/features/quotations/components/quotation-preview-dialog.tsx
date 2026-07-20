'use client';

import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppDetailDialog } from '@/components/dialog/app-detail-dialog';
import { getMediaPreviewUrl } from '@/lib/media-url';
import type { Quotation, QuotationItem } from '@/types/quotation';
import { QuotationItemsTable, type QuotationTableLine } from './quotation-items-table';

type QuotationPreviewDialogProps = {
  quotation: Quotation | null;
  onClose: () => void;
};

function formatCurrency(value: string | number | null | undefined) {
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(Number(value) || 0))} đ`;
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

export function QuotationPreviewDialog({ quotation, onClose }: QuotationPreviewDialogProps) {
  if (!quotation) return null;

  const reconciliationImages = quotation.accountReconciliationImageUrls || [];
  const partyName =
    quotation.customer?.customerName || quotation.lead?.customerName || 'Chưa xác định khách hàng';
  const statusLabel = quotation.status === 'won' ? 'Đã thanh toán' : 'Báo phí';

  return (
    <AppDetailDialog
      open
      title="Chi tiết báo phí"
      eyebrow={quotation.quotationCode || `Báo phí #${quotation.id}`}
      subtitle={partyName}
      maxWidth="md"
      onClose={onClose}
      actions={
        <DialogActionButton href={`/quotations/${quotation.id}`} startIcon={<EditRoundedIcon />}>
          Chỉnh sửa
        </DialogActionButton>
      }
    >
      <div className="space-y-4 bg-slate-50/60 p-5">
        <section className="grid overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-slate-200">
          <InfoCell label="Dự án" value={quotation.project?.projectCode || 'Chưa gắn dự án'} />
          <InfoCell label="Dịch vụ" value={quotation.serviceName || quotation.serviceCode || '-'} />
          <InfoCell label="Ngày báo" value={formatDate(quotation.createdAt)} />
          <InfoCell
            label="Tình trạng"
            value={`${statusLabel} · Đã thu ${formatCurrency(quotation.paidAmount)}`}
          />
        </section>

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
                  <a
                    key={`${imageUrl}-${index}`}
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    title={`Mở ảnh đối soát ${index + 1}`}
                    className="group min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
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
                  </a>
                );
              })}
            </div>
          </section>
        ) : null}

        {quotation.note ? (
          <section className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Ghi chú</p>
            <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-700">
              {quotation.note}
            </p>
          </section>
        ) : null}
      </div>
    </AppDetailDialog>
  );
}

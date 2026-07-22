'use client';

import Image from 'next/image';
import { useMemo, useRef, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { Checkbox, FormControlLabel, IconButton, MenuItem } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { toBlob } from 'html-to-image';
import x3salesLogo from '@assets/logos/x3sales-logo.svg';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppDetailDialog } from '@/components/dialog/app-detail-dialog';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { compactFormFieldClassName } from '@/components/form/form-field-styles';
import { FormInputField } from '@/components/form/form-input-field';
import { FormSelectField } from '@/components/form/form-select-field';
import { MoneyInput } from '@/components/form/money-input';
import {
  DEFAULT_SITE_PROFILE,
  SITE_PROFILE_OPTION_GROUP,
  siteProfileFromOptions,
} from '@/lib/site-profile-options';
import api from '@/services/api/client';
import type { AppOption } from '@/types/option';

type BuilderMode = 'edit' | 'preview';
type TaxRate = 'KCT' | '0' | '7' | '8' | '10';

type QuickQuotationLine = {
  id: string;
  content: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  taxRate: TaxRate;
  includedInTotal: boolean;
};

type CalculatedLine = QuickQuotationLine & {
  amount: number;
  taxAmount: number;
};

const DEFAULT_NOTES = `- Số tiền nạp vào tài khoản quảng cáo sẽ là ngân sách quảng cáo.
- Hóa đơn được xuất khi phát sinh dịch vụ hoặc khi khách hàng thanh toán chi phí dịch vụ.
- Quảng cáo chạy theo kỳ đã thống nhất hoặc đến khi hết ngân sách.`;

const DEFAULT_LINES: QuickQuotationLine[] = [
  {
    id: 'quick-quotation-line-1',
    content: 'Ngân sách quảng cáo',
    unit: 'Dịch vụ',
    quantity: '1',
    unitPrice: '0',
    taxRate: 'KCT',
    includedInTotal: false,
  },
  {
    id: 'quick-quotation-line-2',
    content: 'Phí cọc',
    unit: 'Dịch vụ',
    quantity: '1',
    unitPrice: '0',
    taxRate: 'KCT',
    includedInTotal: true,
  },
  {
    id: 'quick-quotation-line-3',
    content: 'Phí dịch vụ',
    unit: 'Dịch vụ',
    quantity: '1',
    unitPrice: '0',
    taxRate: '8',
    includedInTotal: true,
  },
];

const TAX_RATE_OPTIONS: Array<{ value: TaxRate; label: string }> = [
  { value: 'KCT', label: 'KCT' },
  { value: '0', label: '0%' },
  { value: '7', label: '7%' },
  { value: '8', label: '8%' },
  { value: '10', label: '10%' },
];

function createLineId() {
  return `quick-quotation-line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toNumber(value: string | number | null | undefined) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value));
}

function formatCurrency(value: number) {
  return `${formatNumber(value)} đ`;
}

function taxRateNumber(taxRate: TaxRate) {
  return taxRate === 'KCT' ? 0 : Number(taxRate) || 0;
}

function PreviewInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-extrabold text-slate-950" title={value}>
        {value || '-'}
      </p>
    </div>
  );
}

export function QuickQuotationBuilderDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const notify = useAppNotification();
  const previewRef = useRef<HTMLElement | null>(null);
  const [mode, setMode] = useState<BuilderMode>('edit');
  const [isCopyingImage, setIsCopyingImage] = useState(false);
  const [title, setTitle] = useState('BẢNG BÁO GIÁ THANH TOÁN DỊCH VỤ QUẢNG CÁO');
  const [customer, setCustomer] = useState('');
  const [duration, setDuration] = useState('30 ngày');
  const [budget, setBudget] = useState('0');
  const [lines, setLines] = useState<QuickQuotationLine[]>(DEFAULT_LINES);
  const [notes, setNotes] = useState(DEFAULT_NOTES);

  const { data: siteProfileOptions = [] } = useQuery<AppOption[]>({
    queryKey: ['options', SITE_PROFILE_OPTION_GROUP],
    queryFn: () =>
      api
        .get<AppOption[]>('/options', { params: { groups: SITE_PROFILE_OPTION_GROUP } })
        .then((response) => response.data),
    enabled: open,
  });

  const companyInfo = useMemo(
    () =>
      siteProfileOptions.length > 0
        ? siteProfileFromOptions(siteProfileOptions)
        : DEFAULT_SITE_PROFILE,
    [siteProfileOptions],
  );
  const quotation = useMemo(() => {
    const calculatedLines: CalculatedLine[] = lines.map((line) => {
      const amount = toNumber(line.quantity) * toNumber(line.unitPrice);
      const taxAmount = line.includedInTotal
        ? Math.round((amount * taxRateNumber(line.taxRate)) / 100)
        : 0;

      return { ...line, amount, taxAmount };
    });
    const subtotal = calculatedLines.reduce(
      (sum, line) => sum + (line.includedInTotal ? line.amount : 0),
      0,
    );
    const taxTotals = calculatedLines.reduce<Record<string, number>>((totals, line) => {
      if (!line.includedInTotal || line.taxRate === 'KCT' || line.taxRate === '0') {
        return totals;
      }
      totals[line.taxRate] = (totals[line.taxRate] || 0) + line.taxAmount;
      return totals;
    }, {});
    const totalTax = Object.values(taxTotals).reduce((sum, amount) => sum + amount, 0);

    return {
      lines: calculatedLines,
      subtotal,
      taxTotals,
      total: subtotal + totalTax,
    };
  }, [lines]);

  const updateLine = (lineId: string, values: Partial<QuickQuotationLine>) => {
    setLines((current) =>
      current.map((line) => (line.id === lineId ? { ...line, ...values } : line)),
    );
  };

  const addLine = () => {
    setLines((current) => [
      ...current,
      {
        id: createLineId(),
        content: '',
        unit: 'Dịch vụ',
        quantity: '1',
        unitPrice: '0',
        taxRate: '8',
        includedInTotal: true,
      },
    ]);
  };

  const deleteLine = (lineId: string) => {
    setLines((current) =>
      current.length === 1 ? current : current.filter((line) => line.id !== lineId),
    );
  };

  const copyPreviewImage = async () => {
    if (!previewRef.current || isCopyingImage) return;

    setIsCopyingImage(true);

    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        throw new Error('Trình duyệt không hỗ trợ sao chép ảnh vào clipboard');
      }

      const previewElement = previewRef.current;
      const imageBlobPromise = (async () => {
        await document.fonts?.ready;
        const images = Array.from(previewElement.querySelectorAll('img'));
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

        const captureWidth = Math.ceil(
          Math.max(previewElement.scrollWidth, previewElement.getBoundingClientRect().width),
        );
        const captureHeight = Math.ceil(
          Math.max(previewElement.scrollHeight, previewElement.getBoundingClientRect().height),
        );

        const blob = await toBlob(previewElement, {
          backgroundColor: '#ffffff',
          cacheBust: true,
          width: captureWidth,
          height: captureHeight,
          pixelRatio: 2,
          style: {
            width: `${captureWidth}px`,
            height: `${captureHeight}px`,
            margin: '0',
            maxWidth: 'none',
            overflow: 'visible',
          },
        });

        if (!blob) throw new Error('Không thể tạo ảnh báo phí');
        return blob;
      })();

      await navigator.clipboard.write([new ClipboardItem({ 'image/png': imageBlobPromise })]);
      notify.success('Đã lấy ảnh báo phí. Bạn có thể Ctrl+V để gửi khách.');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không thể lấy ảnh báo phí');
    } finally {
      setIsCopyingImage(false);
    }
  };

  return (
    <AppDetailDialog
      open={open}
      title="Tạo báo phí nhanh"
      subtitle={
        mode === 'edit' ? 'Nhập nội dung và kiểm tra số tiền' : 'Bản trình bày để chụp gửi khách'
      }
      maxWidth="lg"
      onClose={onClose}
      actions={
        mode === 'edit' ? (
          <DialogActionButton
            tone="primary"
            startIcon={<VisibilityRoundedIcon />}
            onClick={() => setMode('preview')}
          >
            Bản gửi khách
          </DialogActionButton>
        ) : (
          <>
            <DialogActionButton startIcon={<EditRoundedIcon />} onClick={() => setMode('edit')}>
              Chỉnh nội dung
            </DialogActionButton>
            <DialogActionButton
              tone="primary"
              startIcon={<PhotoCameraRoundedIcon />}
              disabled={isCopyingImage}
              onClick={copyPreviewImage}
            >
              {isCopyingImage ? 'Đang lấy ảnh...' : 'Lấy ảnh'}
            </DialogActionButton>
          </>
        )
      }
    >
      {mode === 'edit' ? (
        <div className="space-y-4 bg-slate-50/70 p-4 sm:p-5">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
              <FormInputField
                label="Tiêu đề báo phí"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="md:col-span-2 xl:col-span-12"
              />
              <FormInputField
                label="Khách hàng / Mã dự án"
                value={customer}
                onChange={(event) => setCustomer(event.target.value)}
                className="xl:col-span-5"
              />
              <FormInputField
                label="Thời gian"
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                className="xl:col-span-3"
              />
              <MoneyInput
                fullWidth
                size="small"
                label="Ngân sách + VAT"
                value={budget}
                onValueChange={setBudget}
                className={`${compactFormFieldClassName} xl:col-span-4`}
              />
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <h3 className="text-sm font-bold text-slate-950">Dòng báo phí</h3>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  Có thể nhập số âm cho dòng giảm giá.
                </p>
              </div>
              <DialogActionButton tone="primary" startIcon={<AddRoundedIcon />} onClick={addLine}>
                Thêm dòng
              </DialogActionButton>
            </div>

            <div className="divide-y divide-slate-100">
              {lines.map((line, index) => (
                <div key={line.id} className="grid gap-3 px-4 py-3 lg:grid-cols-12 lg:items-start">
                  <div className="flex h-10 items-center text-xs font-extrabold text-slate-500 lg:col-span-1">
                    {`1.${index + 1}`}
                  </div>
                  <FormInputField
                    label="Nội dung"
                    value={line.content}
                    onChange={(event) => updateLine(line.id, { content: event.target.value })}
                    className="lg:col-span-3"
                  />
                  <FormInputField
                    label="ĐVT"
                    value={line.unit}
                    onChange={(event) => updateLine(line.id, { unit: event.target.value })}
                    className="lg:col-span-2"
                  />
                  <FormInputField
                    label="Số lần"
                    type="number"
                    value={line.quantity}
                    onChange={(event) => updateLine(line.id, { quantity: event.target.value })}
                    slotProps={{ htmlInput: { min: 0, step: 'any' } }}
                    className="lg:col-span-1"
                  />
                  <MoneyInput
                    fullWidth
                    size="small"
                    allowNegative
                    label="Đơn giá"
                    value={line.unitPrice}
                    onValueChange={(value) => updateLine(line.id, { unitPrice: value })}
                    className={`${compactFormFieldClassName} lg:col-span-2`}
                  />
                  <FormSelectField
                    label="Thuế"
                    value={line.taxRate}
                    onChange={(event) =>
                      updateLine(line.id, { taxRate: event.target.value as TaxRate })
                    }
                    className="lg:col-span-1"
                  >
                    {TAX_RATE_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </FormSelectField>
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-1 lg:col-span-2 lg:justify-end">
                    <span
                      className="max-w-[120px] truncate text-xs font-extrabold tabular-nums text-slate-800"
                      title={formatCurrency(toNumber(line.quantity) * toNumber(line.unitPrice))}
                    >
                      {formatCurrency(toNumber(line.quantity) * toNumber(line.unitPrice))}
                    </span>
                    <FormControlLabel
                      className="!m-0 whitespace-nowrap"
                      control={
                        <Checkbox
                          size="small"
                          checked={line.includedInTotal}
                          onChange={(event) =>
                            updateLine(line.id, { includedInTotal: event.target.checked })
                          }
                        />
                      }
                      label={
                        <span className="text-xs font-semibold text-slate-600">Tính tổng</span>
                      }
                    />
                    <IconButton
                      size="small"
                      color="error"
                      disabled={lines.length === 1}
                      title="Xóa dòng báo phí"
                      aria-label={`Xóa dòng báo phí ${index + 1}`}
                      onClick={() => deleteLine(line.id)}
                      className="!h-9 !w-9 !rounded-lg"
                    >
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-4 py-3">
              <div className="grid min-w-[280px] grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <span className="font-semibold text-slate-500">Trước thuế</span>
                <strong className="text-right tabular-nums text-slate-950">
                  {formatCurrency(quotation.subtotal)}
                </strong>
                <span className="font-semibold text-slate-500">Tổng thanh toán</span>
                <strong className="text-right text-base tabular-nums text-primary">
                  {formatCurrency(quotation.total)}
                </strong>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <FormInputField
              label="Lưu ý"
              multiline
              minRows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </section>
        </div>
      ) : (
        <div className="overflow-x-auto bg-slate-100 p-3 sm:p-6">
          <article
            ref={previewRef}
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
                  {title || 'Bảng báo giá dịch vụ'}
                </h2>
              </div>

              <section className="mt-6 grid overflow-hidden rounded-lg border border-slate-200 bg-slate-50 md:grid-cols-3 md:divide-x md:divide-slate-200">
                <PreviewInfo label="Khách hàng" value={customer} />
                <PreviewInfo label="Thời gian" value={duration} />
                <PreviewInfo
                  label="Ngân sách + VAT"
                  value={toNumber(budget) ? formatCurrency(toNumber(budget)) : '-'}
                />
              </section>

              <section className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[860px] table-fixed text-sm">
                  <thead className="bg-blue-700 text-left text-xs font-extrabold uppercase tracking-wide text-white">
                    <tr>
                      <th className="w-[70px] px-3 py-3">STT</th>
                      <th className="px-3 py-3">Nội dung</th>
                      <th className="w-[110px] px-3 py-3">ĐVT</th>
                      <th className="w-[90px] px-3 py-3 text-right">Số lần</th>
                      <th className="w-[150px] px-3 py-3 text-right">Đơn giá</th>
                      <th className="w-[160px] px-3 py-3 text-right">Thành tiền</th>
                      <th className="w-[100px] px-3 py-3 text-center">Thuế suất</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {quotation.lines.map((line, index) => (
                      <tr
                        key={line.id}
                        className={
                          line.includedInTotal
                            ? 'odd:bg-white even:bg-slate-50/60'
                            : 'bg-blue-50/60'
                        }
                      >
                        <td className="px-3 py-3 font-bold text-slate-700">{`1.${index + 1}`}</td>
                        <td className="px-3 py-3 font-semibold text-slate-900">
                          <span>{line.content || '-'}</span>
                          {!line.includedInTotal ? (
                            <span className="ml-2 inline-flex rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-blue-700">
                              Tham khảo
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-slate-600">{line.unit || '-'}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                          {formatNumber(toNumber(line.quantity))}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                          {formatCurrency(toNumber(line.unitPrice))}
                        </td>
                        <td className="px-3 py-3 text-right font-extrabold tabular-nums text-slate-950">
                          {formatCurrency(line.amount)}
                        </td>
                        <td className="px-3 py-3 text-center font-bold text-slate-700">
                          {line.taxRate === 'KCT' ? 'KCT' : `${line.taxRate}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-300 bg-slate-50">
                    <tr>
                      <td colSpan={6} className="px-3 py-2.5 text-right font-bold text-slate-600">
                        Tổng tiền trước thuế
                      </td>
                      <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-slate-950">
                        {formatCurrency(quotation.subtotal)}
                      </td>
                    </tr>
                    {Object.entries(quotation.taxTotals)
                      .sort(([rateA], [rateB]) => Number(rateA) - Number(rateB))
                      .map(([rate, amount]) => (
                        <tr key={rate}>
                          <td
                            colSpan={6}
                            className="px-3 py-2.5 text-right font-bold text-slate-600"
                          >
                            Tổng thuế {rate}%
                          </td>
                          <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-slate-950">
                            {formatCurrency(amount)}
                          </td>
                        </tr>
                      ))}
                    <tr className="border-t border-emerald-200 bg-emerald-50">
                      <td
                        colSpan={6}
                        className="px-3 py-3 text-right font-extrabold uppercase text-emerald-800"
                      >
                        Tổng cộng tiền thanh toán
                      </td>
                      <td className="px-3 py-3 text-right text-base font-black tabular-nums text-emerald-800">
                        {formatCurrency(quotation.total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </section>

              <section className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <h3 className="text-sm font-extrabold text-slate-950">Lưu ý</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
                  {notes || '-'}
                </p>
              </section>

              <p className="mt-5 text-center text-xs font-semibold text-slate-400">
                Cảm ơn quý khách đã tin tưởng và lựa chọn dịch vụ của X3Sales.
              </p>
            </div>
          </article>
        </div>
      )}
    </AppDetailDialog>
  );
}

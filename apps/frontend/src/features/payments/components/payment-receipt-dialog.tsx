'use client';

import { useState } from 'react';
import { Alert, MenuItem } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppFormDialog } from '@/components/dialog/app-form-dialog';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { FormInputField } from '@/components/form/form-input-field';
import { FormSelectField } from '@/components/form/form-select-field';
import { FormDatePicker } from '@/components/form/form-date-picker';
import { MoneyInput } from '@/components/form/money-input';
import { ServerPaginatedAutocomplete } from '@/components/form/server-paginated-autocomplete';
import { compactFormFieldClassName } from '@/components/form/form-field-styles';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/services/api/client';
import type { Payment, PaymentReceiptType } from '@/types/payment';

export function PaymentReceiptDialog({
  payment,
  onClose,
  onSaved,
}: {
  payment: Payment | null;
  onClose: () => void;
  onSaved: (p: Payment) => void;
}) {
  const fresh = useQuery({
    queryKey: ['payments', 'receipt-editor', payment?.id],
    enabled: !!payment,
    refetchOnWindowFocus: false,
    gcTime: 0,
    queryFn: ({ signal }) =>
      api.get<Payment>(`/payments/${payment!.id}`, { signal }).then((r) => r.data),
    staleTime: 0,
  });
  if (payment && (fresh.isPending || fresh.isError))
    return (
      <AppFormDialog
        open
        title="Đối soát khoản tiền"
        onClose={onClose}
        onSubmit={(e) => e.preventDefault()}
        actions={<DialogActionButton onClick={onClose}>Đóng</DialogActionButton>}
      >
        <div className="p-5">
          {fresh.isError ? (
            <Alert severity="error">Không tải được giao dịch. Đóng và mở lại để thử.</Alert>
          ) : (
            'Đang tải giao dịch...'
          )}
        </div>
      </AppFormDialog>
    );
  return (
    <ReceiptEditor
      key={payment?.id || 'new'}
      payment={payment ? fresh.data! : null}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function ReceiptEditor({
  payment: loadedPayment,
  onClose,
  onSaved,
}: {
  payment: Payment | null;
  onClose: () => void;
  onSaved: (p: Payment) => void;
}) {
  // Keep the version and values together while editing, even if another tab refreshes the query.
  const [payment] = useState(loadedPayment);
  const client = useQueryClient();
  const notify = useAppNotification();
  const [type, setType] = useState<PaymentReceiptType>(payment?.receiptType || 'customer');
  const [channel, setChannel] = useState(payment?.paymentChannel || '');
  const [date, setDate] = useState(
    (payment?.transactionAt || payment?.transactionDate || '').slice(0, 10),
  );
  const [amount, setAmount] = useState(String(payment?.amount || ''));
  const [fee, setFee] = useState(String(payment?.platformFeeAmount || 0));
  const [account, setAccount] = useState(payment?.bankAccount || '');
  const [reference, setReference] = useState(payment?.reference || '');
  const [content, setContent] = useState(payment?.transactionContent || '');
  const [source, setSource] = useState<Payment | null>(
    payment?.sourcePaymentId ? { id: payment.sourcePaymentId } : null,
  );
  const [reason, setReason] = useState('');
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [error, setError] = useState('');
  const lockedType =
    !!payment &&
    (!!payment.allocations?.length || !!payment.refunds?.length || !!payment.sourcePaymentId);
  const paypal = channel === 'paypal' && type === 'customer';
  const close = () => {
    if (!save.isPending) dirty ? setDiscard(true) : onClose();
  };
  const save = useMutation({
    mutationFn: async () => {
      const unchangedDay =
        date === (payment?.transactionAt || payment?.transactionDate || '').slice(0, 10);
      const payload = {
        receiptType: type,
        paymentChannel: channel || null,
        transactionAt: unchangedDay ? payment?.transactionAt || date : date,
        amount: Number(amount),
        platformFeeAmount: paypal ? Number(fee) : 0,
        bankAccount: account.trim(),
        reference: reference.trim(),
        transactionContent: content.trim(),
        sourcePaymentId: type === 'internal' ? source?.id || null : null,
        changeReason: reason.trim(),
        expectedUpdatedAt: payment?.updatedAt,
      };
      return (
        payment
          ? await api.patch<Payment>(`/payments/${payment.id}`, payload)
          : await api.post<Payment>('/payments', payload)
      ).data;
    },
    onSuccess: (result) => {
      onSaved(result);
      onClose();
      for (const key of ['payments', 'projects', 'quotations', 'kpi', 'dashboard'])
        void client.invalidateQueries({ queryKey: [key] });
      notify.success(payment ? 'Đã cập nhật đối soát khoản tiền' : 'Đã ghi nhận khoản tiền');
    },
    onError: (e) => setError(getApiErrorMessage(e, 'Không lưu được khoản tiền')),
  });
  const valid =
    !!date &&
    Number(amount) > 0 &&
    !!channel &&
    (!payment || !!reason.trim()) &&
    (!paypal ||
      (!!account.trim() &&
        !!reference.trim() &&
        Number(fee) >= 0 &&
        Number(fee) <= Number(amount)));
  return (
    <>
      <AppFormDialog
        open
        maxWidth="sm"
        title={payment ? 'Đối soát khoản tiền' : 'Ghi nhận khoản tiền'}
        onClose={close}
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !save.isPending) save.mutate();
        }}
        actions={
          <>
            <DialogActionButton disabled={save.isPending} onClick={close}>
              Hủy
            </DialogActionButton>
            <DialogActionButton type="submit" tone="primary" disabled={!valid || save.isPending}>
              {save.isPending ? 'Đang lưu...' : 'Lưu'}
            </DialogActionButton>
          </>
        }
      >
        <div className="space-y-4 p-5" onChange={() => setDirty(true)}>
          {error && <Alert severity="error">{error}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormSelectField
              label="Loại giao dịch"
              value={type}
              disabled={lockedType}
              onChange={(e) => {
                setType(e.target.value as PaymentReceiptType);
                setDirty(true);
              }}
            >
              <MenuItem value="customer">Khách thanh toán</MenuItem>
              <MenuItem value="internal">Chuyển nội bộ</MenuItem>
              <MenuItem value="other">Khoản khác</MenuItem>
            </FormSelectField>
            <FormSelectField
              label="Kênh nhận tiền"
              value={channel}
              onChange={(e) => {
                setChannel(e.target.value);
                setDirty(true);
              }}
              required
            >
              <MenuItem value="bank">Ngân hàng</MenuItem>
              <MenuItem value="paypal">PayPal</MenuItem>
              <MenuItem value="cash">Tiền mặt</MenuItem>
              <MenuItem value="other">Khác</MenuItem>
            </FormSelectField>
          </div>
          <FormDatePicker
            label={type === 'customer' ? 'Ngày thực nhận' : 'Ngày giao dịch'}
            value={date}
            onChange={(v) => {
              setDate(v);
              setDirty(true);
            }}
            required
          />
          <MoneyInput
            fullWidth
            size="small"
            className={compactFormFieldClassName}
            label={type === 'customer' ? 'Số khách đã trả (VND)' : 'Số tiền (VND)'}
            value={amount}
            onValueChange={(v) => {
              setAmount(v);
              setDirty(true);
            }}
            required
          />
          {paypal && (
            <>
              <MoneyInput
                fullWidth
                size="small"
                className={compactFormFieldClassName}
                label="Phí PayPal (VND)"
                value={fee}
                onValueChange={(v) => {
                  setFee(v);
                  setDirty(true);
                }}
              />
              <p className="text-sm text-slate-600">
                Thực nhận ròng:{' '}
                <strong>
                  {Math.max(0, Number(amount) - Number(fee)).toLocaleString('vi-VN')} đ
                </strong>
              </p>
            </>
          )}
          <FormInputField
            label={paypal ? 'Tài khoản PayPal nhận tiền' : 'Tài khoản nhận'}
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            required={paypal}
          />
          <FormInputField
            label={paypal ? 'Mã giao dịch PayPal' : 'Mã tham chiếu'}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            required={paypal}
          />
          {type === 'internal' && (
            <>
              <ServerPaginatedAutocomplete<Payment>
                endpoint="/payments"
                queryKey={['payments', 'paypal-sources']}
                additionalParams={{ payment_channel: 'paypal', receipt_type: 'customer' }}
                label="Khoản PayPal gốc"
                value={source}
                onChange={(v) => {
                  setSource(v);
                  setDirty(true);
                }}
                getOptionLabel={(p) =>
                  `#${p.id} · ${p.reference || p.transactionContent || 'Khoản thu PayPal'}${p.amount ? ` · ${Number(p.amount).toLocaleString('vi-VN')} đ` : ''}`
                }
              />
              <p className="text-xs text-slate-500">
                Chuyển nội bộ không phân bổ báo phí và không tăng KPI.
              </p>
            </>
          )}
          <FormInputField
            label="Nội dung giao dịch"
            multiline
            minRows={2}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          {payment && (
            <FormInputField
              label="Lý do điều chỉnh"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          )}
        </div>
      </AppFormDialog>
      <ConfirmDialog
        open={discard}
        title="Bỏ thay đổi?"
        description="Thông tin chưa lưu sẽ bị bỏ."
        confirmText="Bỏ thay đổi"
        onClose={() => setDiscard(false)}
        onConfirm={onClose}
      />
    </>
  );
}

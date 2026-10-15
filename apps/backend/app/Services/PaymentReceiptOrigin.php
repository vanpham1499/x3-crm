<?php

namespace App\Services;

use App\Models\Payment;
use App\Repositories\PaymentRepository;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class PaymentReceiptOrigin
{
    public const FIELDS = ['transaction_at', 'transaction_date', 'amount', 'receipt_type', 'payment_channel', 'bank_account', 'reference', 'platform_fee_amount', 'source_payment_id'];

    /** Called inside FinancialMutation, before saving or auto-allocating. */
    public static function validate(array $data, ?Payment $current = null): array
    {
        $values = array_replace($current?->only(self::FIELDS) ?? [], $data);
        $type = $values['receipt_type'] ?? 'customer';
        $channel = $values['payment_channel'] ?? null;
        $fee = round((float) ($values['platform_fee_amount'] ?? 0), 2);
        $amount = round((float) ($values['amount'] ?? 0), 2);
        $sourceId = $values['source_payment_id'] ?? null;
        $fail = fn ($field, $message) => throw ValidationException::withMessages([$field => [$message]]);
        if ($fee < 0 || $fee > $amount || ($fee > 0 && ($channel !== 'paypal' || $type !== 'customer'))) {
            $fail('platformFeeAmount', 'Phí PayPal phải từ 0 đến số khách đã trả và chỉ áp dụng khoản thu PayPal.');
        }
        if ($current && $type !== ($current->receipt_type ?? 'customer')
            && ($current->allocations()->exists() || $current->refunds()->exists())) {
            $fail('receiptType', 'Giao dịch đã phân bổ hoặc có hoàn tiền. Cần đối soát các liên kết trước khi đổi loại.');
        }
        if ($current?->source_payment_id && $type !== 'internal') {
            $fail('receiptType', 'Lần chuyển PayPal đã liên kết không được đổi thành khoản khách thanh toán.');
        }
        if ($channel === 'paypal' && $type === 'customer') {
            $account = trim((string) ($values['bank_account'] ?? ''));
            $reference = trim((string) ($values['reference'] ?? ''));
            if ($account === '' || $reference === '') {
                $fail('reference', 'Khoản thu PayPal cần tài khoản nhận và mã giao dịch PayPal.');
            }
            if (Payment::where('payment_channel', 'paypal')->where('receipt_type', 'customer')
                ->whereRaw('lower(trim(bank_account)) = ?', [strtolower($account)])
                ->whereRaw('lower(trim(reference)) = ?', [strtolower($reference)])
                ->when($current, fn ($q) => $q->where('id', '!=', $current->id))->exists()) {
                $fail('reference', 'Mã giao dịch PayPal này đã được ghi nhận trên tài khoản nhận.');
            }
            $data['bank_account'] = $account;
            $data['reference'] = $reference;
        }
        if ($sourceId) {
            if ($type !== 'internal' || (int) $sourceId === (int) $current?->id) {
                $fail('sourcePaymentId', 'Chỉ giao dịch chuyển nội bộ mới được liên kết khoản thu gốc khác chính nó.');
            }
            $source = app(PaymentRepository::class)->findWithRelationsOrFail((string) $sourceId, auth()->user());
            if ($source->payment_channel !== 'paypal' || ($source->receipt_type ?? 'customer') !== 'customer') {
                $fail('sourcePaymentId', 'Khoản thu gốc phải là tiền khách đã trả qua PayPal.');
            }
            $withdrawn = Payment::where('source_payment_id', $sourceId)
                ->when($current, fn ($q) => $q->where('id', '!=', $current->id))->sum('amount');
            if ($withdrawn + $amount > (float) $source->amount - (float) $source->platform_fee_amount + 0.01) {
                $fail('amount', 'Tổng tiền chuyển về ngân hàng vượt số ròng của khoản PayPal gốc.');
            }
        }
        if ($current && Payment::where('source_payment_id', $current->id)->exists()) {
            $withdrawn = (float) Payment::where('source_payment_id', $current->id)->sum('amount');
            if ($type !== 'customer' || $channel !== 'paypal' || $amount - $fee < $withdrawn - 0.01) {
                $fail('amount', 'Khoản thu đã có chuyển nội bộ liên kết; thông tin mới không đủ đối soát số đã chuyển.');
            }
        }
        if ($type !== 'customer') {
            foreach (['quotation_id', 'project_id', 'customer_id', 'contract_id', 'lead_id'] as $field) {
                $data[$field] = null;
            }
        }
        $data['receipt_type'] = $type;
        if (array_key_exists('platform_fee_amount', $data)) {
            $data['platform_fee_amount'] = $fee;
        }
        return $data;
    }

    public static function audit(Payment $payment, ?array $before, string $reason): void
    {
        $after = $payment->only(self::FIELDS);
        if ($before !== null && $before == $after) {
            return;
        }
        DB::table('payment_receipt_audits')->insert([
            'payment_id' => $payment->id, 'actor_id' => auth()->id(),
            'before' => $before === null ? null : json_encode($before, JSON_THROW_ON_ERROR),
            'after' => json_encode($after, JSON_THROW_ON_ERROR),
            'reason' => $reason, 'created_at' => now(),
        ]);
    }
}

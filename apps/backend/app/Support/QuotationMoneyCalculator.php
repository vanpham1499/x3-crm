<?php

namespace App\Support;

use Illuminate\Validation\ValidationException;

class QuotationMoneyCalculator
{
    public const MAX_ROUNDING_ADJUSTMENT = 1;

    /** Recompute payable amounts on the server; never trust a submitted adjustment. */
    public static function apply(array $data, array &$items): array
    {
        $metadata = is_array($data['metadata'] ?? null) ? $data['metadata'] : [];
        $target = $metadata['targetTotalAmount'] ?? null;
        if ($target === '') {
            $target = null;
        }
        if ($target !== null && (! is_numeric($target) || ! is_finite((float) $target)
            || (float) $target <= 0 || floor((float) $target) !== (float) $target)) {
            throw ValidationException::withMessages([
                'metadata.targetTotalAmount' => 'Tổng thanh toán mong muốn phải là số nguyên lớn hơn 0.',
            ]);
        }

        $subtotal = $items === [] ? round((float) ($data['subtotal_amount'] ?? 0)) : 0.0;
        $itemVat = 0.0;
        $lastTaxableIndex = null;
        foreach ($items as $index => &$item) {
            $excluded = ($item['metadata']['excludedFromTotal'] ?? false) === true;
            $amount = round((float) ($item['amount_before_vat'] ?? 0));
            $rate = $excluded ? 0.0 : (float) ($data['vat_rate'] ?? $item['vat_rate'] ?? 0);
            $item['amount_before_vat'] = $amount;
            $item['vat_rate'] = $rate;
            $item['vat_amount'] = $excluded ? 0.0 : round($amount * $rate / 100);
            $item['amount_after_vat'] = $amount + $item['vat_amount'];
            if (! $excluded) {
                $subtotal += $amount;
                $itemVat += $item['vat_amount'];
                if ($amount != 0) {
                    $lastTaxableIndex = $index;
                }
            }
        }
        unset($item);

        $vat = array_key_exists('vat_rate', $data)
            ? round($subtotal * (float) $data['vat_rate'] / 100)
            : ($items === [] ? round((float) ($data['vat_amount'] ?? 0)) : $itemVat);
        if ($lastTaxableIndex !== null) {
            $items[$lastTaxableIndex]['vat_amount'] += $vat - $itemVat;
            $items[$lastTaxableIndex]['amount_after_vat'] = $items[$lastTaxableIndex]['amount_before_vat']
                + $items[$lastTaxableIndex]['vat_amount'];
        }
        $deposit = round((float) ($data['deposit_amount'] ?? 0));
        $baseTotal = $subtotal + $vat + $deposit;
        $adjustment = $target === null ? 0.0 : (float) $target - $baseTotal;
        if (abs($adjustment) > self::MAX_ROUNDING_ADJUSTMENT) {
            throw ValidationException::withMessages([
                'metadata.targetTotalAmount' => 'Chỉ được điều chỉnh làm tròn tối đa 1đ. Vui lòng kiểm tra ngân sách và các hạng mục.',
            ]);
        }
        if ($subtotal < 0 || $deposit < 0 || $baseTotal + $adjustment < 0) {
            throw ValidationException::withMessages(['items' => 'Tổng tiền báo phí không được âm.']);
        }

        $data['subtotal_amount'] = $subtotal;
        $data['vat_amount'] = $vat;
        $data['deposit_amount'] = $deposit;
        $data['total_amount'] = $baseTotal + $adjustment;
        $metadata['targetTotalAmount'] = $target === null ? null : (float) $target;
        $metadata['roundingAdjustment'] = $adjustment;
        $data['metadata'] = $metadata;

        return $data;
    }
}

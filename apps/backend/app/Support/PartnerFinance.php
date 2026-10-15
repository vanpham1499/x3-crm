<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class PartnerFinance
{
    public static function cents(float|string|null $value): int
    {
        return (int) round((float) $value * 100);
    }

    public static function allocations(array $rows, float $amount): array
    {
        $seen = [];
        $sum = 0;
        foreach ($rows as &$row) {
            $period = (string) ($row['period'] ?? '');
            if (! preg_match('/^20\d{2}-(0[1-9]|1[0-2])$/', $period) || isset($seen[$period])) {
                throw ValidationException::withMessages(['allocations' => ['Kỳ ghi nhận không hợp lệ hoặc bị trùng.']]);
            }
            $seen[$period] = true;
            $cents = self::cents($row['amount'] ?? 0);
            if ($cents < 0 || ($cents === 0 && self::cents($amount) !== 0)) {
                throw ValidationException::withMessages(['allocations' => ['Giá trị mỗi kỳ phải lớn hơn 0.']]);
            }
            $row = ['period' => $period, 'amount' => $cents / 100];
            $sum += $cents;
        }
        if ($rows === [] || $sum !== self::cents($amount)) {
            throw ValidationException::withMessages(['allocations' => ['Tổng phân bổ phải bằng giá trị được ghi nhận.']]);
        }

        return $rows;
    }

    public static function assertOpen(array $periods): void
    {
        if (DB::table('partner_finance_periods')->whereIn('period', array_unique($periods))->whereNotNull('locked_at')->exists()) {
            throw ValidationException::withMessages(['period' => ['Kỳ đã chốt. Admin cần mở kỳ có lý do trước khi điều chỉnh.']]);
        }
    }

    public static function protectSource(string $type, int|string $id): void
    {
        if (DB::table('partner_finance_recognitions')->where('entity_type', $type)->where('entity_id', $id)->exists()) {
            throw ValidationException::withMessages(['finance' => ['Nguồn đã ghi nhận theo kỳ. Gỡ ghi nhận trong Công nợ & lợi nhuận trước khi sửa hoặc hủy.']]);
        }
    }
}

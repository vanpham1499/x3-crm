<?php

namespace App\Support;

use App\Models\Option;
use App\Models\WeeklyReport;
use Illuminate\Validation\ValidationException;

/** Report-only amounts. Never exchange, post to a ledger, or use quotation rounding. */
final class WeeklyReportMoney
{
    private const FALLBACK_CURRENCIES = ['VND', 'USD', 'EUR', 'AUD'];

    public const FIELDS = [
        'weekly_spend_amount' => 'weeklySpendAmount',
        'average_weekly_budget' => 'averageWeeklyBudget',
        'remaining_account_budget' => 'remainingAccountBudget',
        'total_budget' => 'totalBudget',
        'monthly_budget' => 'monthlyBudget',
    ];

    /** Amounts here have already passed decimal validation. No intermediate rounding. */
    public static function calculateWeeklyBudget(string $total): string
    {
        $cents = self::cents($total);
        $weekly = intdiv($cents * 7 + 15, 30);

        return intdiv($weekly, 100).'.'.str_pad((string) ($weekly % 100), 2, '0', STR_PAD_LEFT);
    }

    public static function applyWeeklyBudget(array $data, ?WeeklyReport $existing = null): array
    {
        $total = $data['total_budget'] ?? $existing?->total_budget ?? '0.00';
        $changed = $existing === null
            || (string) ($data['currency'] ?? $existing->currency) !== (string) $existing->currency
            || (array_key_exists('total_budget', $data)
                && self::cents((string) $total) !== self::cents((string) ($existing->total_budget ?? '0')));
        if ($changed) {
            $data['average_weekly_budget'] = self::calculateWeeklyBudget((string) $total);
        } else {
            // Updating notes or resubmitting a legacy total must preserve its saved average.
            unset($data['average_weekly_budget']);
        }

        return $data;
    }

    private static function cents(string $amount): int
    {
        [$whole, $fraction] = array_pad(explode('.', $amount, 2), 2, '');

        return (int) $whole * 100 + (int) str_pad($fraction, 2, '0');
    }

    /**
     * @return array<int, string>
     */
    public static function configuredCurrencies(bool $activeOnly = false): array
    {
        $query = Option::query()->where('group', Option::GROUP_WEEKLY_REPORT_CURRENCY);
        $hasConfiguredOptions = (clone $query)->exists();

        $currencies = (clone $query)
            ->when($activeOnly, fn ($query) => $query->where('is_active', true))
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get(['key', 'value'])
            ->map(fn (Option $option): string => strtoupper(trim((string) ($option->value ?: $option->key))))
            ->filter(fn (string $currency): bool => (bool) preg_match('/^[A-Z]{3,10}$/D', $currency))
            ->unique()
            ->values()
            ->all();

        return $hasConfiguredOptions ? $currencies : self::FALLBACK_CURRENCIES;
    }

    public static function prepare(array $data, ?WeeklyReport $existing = null): array
    {
        $originalCurrency = $existing?->currency ?: 'VND';
        $currency = array_key_exists('currency', $data) ? $data['currency'] : $originalCurrency;
        $currency = is_string($currency) ? strtoupper(trim($currency)) : $currency;
        $changed = $existing !== null && $currency !== $originalCurrency;
        if (($existing === null || $changed)
            && ! in_array($currency, self::configuredCurrencies(true), true)) {
            throw ValidationException::withMessages([
                'currency' => 'Đơn vị tiền tệ chưa được cấu hình hoặc đang tạm tắt trong Tùy chọn hệ thống.',
            ]);
        }
        if ($changed && ! in_array($data['currency_change_confirmed'] ?? false, [true, 1, '1'], true)) {
            throw ValidationException::withMessages([
                'currency' => 'Cần xác nhận đổi tiền tệ và nhập lại các số tiền; hệ thống không tự quy đổi.',
            ]);
        }
        unset($data['currency_change_confirmed']);
        $data['currency'] = $currency;

        // Omitted on creation/change of unit means unknown, never a relabelled old balance.
        // On same-currency PATCH, omission still preserves the stored value.
        if (($existing === null || $changed) && ! array_key_exists('remaining_account_budget', $data)) {
            $data['remaining_account_budget'] = null;
        }

        // Required measures must be entered in the chosen unit; remaining balance is optional.
        if ($changed || ($existing === null && $currency !== 'VND')) {
            foreach (array_slice(self::FIELDS, 0, 4, true) as $field => $apiField) {
                if (in_array($field, ['remaining_account_budget', 'average_weekly_budget'], true)) {
                    continue;
                }
                if (! array_key_exists($field, $data) || $data[$field] === null || $data[$field] === '') {
                    throw ValidationException::withMessages([$apiField => 'Nhập số tiền theo '.$currency.'; nhập 0 nếu không phát sinh.']);
                }
            }
            // This legacy snapshot must not retain a monthly VND preset.
            $data['monthly_budget'] ??= '0';
        }

        foreach (self::FIELDS as $field => $apiField) {
            if (! array_key_exists($field, $data)) {
                continue; // Partial updates preserve stored values, including legacy fractions.
            }
            $value = $data[$field];
            if ($field === 'remaining_account_budget'
                && ($value === null || (is_string($value) && trim($value) === ''))) {
                $data[$field] = null; // Explicit blank clears it; zero remains a real value.

                continue;
            }
            if ($value === null || $value === '') {
                // Preserve legacy nullable/default handling on same-currency updates.
                unset($data[$field]);

                continue;
            }
            if ((! is_string($value) && ! is_int($value) && ! is_float($value))
                || ! preg_match('/^\d{1,13}(?:\.\d{1,2})?$/D', (string) $value)) {
                throw ValidationException::withMessages([
                    $apiField => 'Số tiền phải không âm, tối đa 13 chữ số phần nguyên và 2 chữ số thập phân.',
                ]);
            }
            // String normalization preserves cents exactly; no float round trip.
            [$whole, $fraction] = array_pad(explode('.', (string) $value, 2), 2, '');
            $data[$field] = (ltrim($whole, '0') ?: '0').'.'.str_pad($fraction, 2, '0');
        }

        return $data;
    }
}

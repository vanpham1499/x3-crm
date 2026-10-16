<?php

namespace App\Support;

use App\Models\{ProjectCost, Quotation};
use Illuminate\Support\Collection;

/** Proposals only: never posts recognition or changes the cash/KPI ledgers. */
final class FinanceRecognitionSuggestion
{
    public static function requiresCompletion(Quotation $quote): bool
    {
        $code = strtoupper((string) ($quote->service_code ?: $quote->service?->code));
        return preg_match('/^DV3(?:[.\-]|$)/', $code) === 1;
    }

    public static function result(string $status, string $reason, array $allocations = []): array
    {
        return compact('status', 'reason', 'allocations');
    }

    public static function cost(ProjectCost $cost): array
    {
        if (!$cost->work_period) return self::result('review', 'Thiếu kỳ công việc; bổ sung tại khoản chi.');
        if ((float) $cost->total_amount <= 0) return self::result('review', 'Chi phí chưa có giá trị hợp lệ.');
        if (!$cost->uses_payment_ledger && $cost->status === 'completed' && !$cost->transaction_date) {
            return self::result('review', 'Khoản đã chi cũ thiếu ngày thanh toán.');
        }
        return self::result('ready', 'Theo kỳ công việc đã nhập', [
            ['period' => $cost->work_period->format('Y-m'), 'amount' => (float) $cost->total_amount],
        ]);
    }

    public static function revenue(Quotation $quote, float $amount, Collection $topups, Collection $projectQuotes): array
    {
        if ($quote->paymentRefunds->contains(fn ($r) => $r->status === 'completed')) {
            return self::result('review', 'Có hoàn tiền; kiểm tra giá trị và kỳ ghi nhận.');
        }
        if (self::requiresCompletion($quote)) {
            return $quote->work_completed_period
                ? self::result('ready', 'Theo tháng hoàn thành công việc', [
                    ['period' => $quote->work_completed_period->format('Y-m'), 'amount' => $amount],
                ])
                : self::result('review', 'Nhân sự phụ trách cần xác nhận tháng hoàn thành báo phí.');
        }
        $budget = ProjectTopupBudgetCalculator::calculateQuotation($quote)['eligibleBudget'];
        if ($budget > 0) {
            $linked = $topups->filter(fn ($c) => (int) $c->quotation_id === (int) $quote->id);
            $unlinked = $topups->filter(fn ($c) => !$c->quotation_id);
            $budgetQuotes = $projectQuotes->filter(fn ($q) => !$q->isVoided() && ProjectTopupBudgetCalculator::calculateQuotation($q)['eligibleBudget'] > 0);
            if ($budgetQuotes->count() === 1) $linked = $linked->merge($unlinked);
            elseif ($linked->isEmpty() && $unlinked->isNotEmpty()) return self::result('review', 'Nhiều báo phí: cần liên kết lần nạp với đúng báo phí.');
            $cash = $linked->filter(fn ($c) => !$c->isPromotion() && $c->status === 'completed');
            if ($cash->contains(fn ($c) => !$c->transaction_date || $c->cid_is_dead || $c->cidIncident)) {
                return self::result('review', 'Lần nạp thiếu ngày hoặc có sự cố CID; kiểm tra lại.');
            }
            $sum = round((float) $cash->sum('total_amount'), 2);
            if ($sum < $budget - 1) {
                if ($budgetQuotes->count() > 1 && $unlinked->isNotEmpty()) return self::result('review', 'Còn lần nạp chưa liên kết; kiểm tra đúng báo phí trước khi ghi nhận.');
                return self::result('waiting', 'Chờ nạp đủ ngân sách của báo phí.');
            }
            if ($sum > $budget + 1) return self::result('review', 'Tổng lần nạp vượt ngân sách báo phí; kiểm tra liên kết.');
            $running = 0;
            foreach ($cash->sortBy(fn ($c) => $c->transaction_date->format('Y-m-d').'-'.str_pad((string) $c->id, 20, '0', STR_PAD_LEFT)) as $topup) {
                $running += (float) $topup->total_amount;
                if ($running >= $budget - 1) return self::result('ready', 'Theo tháng nạp đủ ngân sách', [
                    ['period' => $topup->transaction_date->format('Y-m'), 'amount' => $amount],
                ]);
            }
        }
        // Fee-only services have no top-up milestone. Propose the date of full receipt,
        // using actual bank dates, never the date someone imported/allocated the record.
        $receipts = [];
        foreach ($quote->paymentAllocations as $allocation) {
            $at = $allocation->payment?->transaction_at ?: $allocation->payment?->transaction_date;
            if (!$at || (float) $allocation->amount <= 0) return self::result('review', 'Khoản thu thiếu ngày thực nhận hoặc giá trị không hợp lệ.');
            $receipts[] = ['date' => substr((string) $at, 0, 10), 'amount' => (float) $allocation->amount];
        }
        usort($receipts, fn ($a, $b) => strcmp($a['date'], $b['date']));
        $paid = 0;
        foreach ($receipts as $receipt) {
            $paid += $receipt['amount'];
            if ((float) $quote->total_amount > 0 && round($paid) >= round((float) $quote->total_amount)) {
                return self::result('ready', 'Không có ngân sách: theo ngày thu đủ tiền', [
                    ['period' => substr($receipt['date'], 0, 7), 'amount' => $amount],
                ]);
            }
        }
        return self::result('waiting', 'Chờ thu đủ tiền dịch vụ.');
    }

}

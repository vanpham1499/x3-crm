<?php

namespace App\Services;

use App\Models\PartnerFinanceRecognition;
use App\Models\ProjectCost;
use App\Models\Quotation;
use App\Support\DashboardComparison;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/** Read-only company/project figures. Never sum the Sale and implementation KPI credits. */
final class DashboardFinanceService
{
    public function __construct(private readonly PartnerFinanceService $finance) {}

    public function cash(CarbonImmutable $start, CarbonImmutable $lastMonth, Collection $quotes, Collection $receipts, Collection $refunds): array
    {
        $r = DashboardComparison::range($start, $lastMonth, CarbonImmutable::now(config('app.timezone')));
        $events = [];
        $codes = $quotes->pluck('quotation_code', 'id');
        foreach ($receipts as $receipt) {
            $events[] = ['at' => KpiFeeEvents::receiptAt($receipt)->setTimezone(config('app.timezone')),
                'kind' => 'received', 'amount' => (float) $receipt->amount,
                'reference' => $codes[$receipt->quotation_id] ?? 'Báo phí #'.$receipt->quotation_id];
        }
        foreach ($refunds as $refund) {
            $events[] = ['at' => CarbonImmutable::parse($refund->completed_at)->setTimezone(config('app.timezone')),
                'kind' => 'refund', 'amount' => (float) $refund->amount,
                'reference' => $codes[$refund->quotation_id] ?? 'Hoàn tiền #'.$refund->id];
        }
        foreach ($quotes as $quote) {
            $events[] = ['at' => CarbonImmutable::parse($quote->created_at)->setTimezone(config('app.timezone')),
                'kind' => 'quotation', 'amount' => (float) $quote->total_amount, 'reference' => $quote->quotation_code];
        }

        return self::cashProjection($r, $events);
    }

    public static function cashProjection(array $r, array $events): array
    {
        $daily = $r['months'] === 1;
        $format = $daily ? 'Y-m-d' : 'Y-m';
        $buckets = [];
        for ($cursor = $r['start']; $cursor->lessThanOrEqualTo($r['end']); $cursor = $daily ? $cursor->addDay() : $cursor->addMonth()) {
            $buckets[$cursor->format($format)] = ['at' => $cursor, 'received' => 0.0, 'refund' => 0.0, 'quotation' => 0.0];
        }
        $previous = [];
        $details = [];
        $totals = ['received' => 0.0, 'refund' => 0.0, 'quotation' => 0.0, 'previousNet' => 0.0];
        foreach ($events as $event) {
            if ($r['future']) {
                continue;
            }
            $at = $event['at'];
            $kind = $event['kind'];
            if ($at->betweenIncluded($r['start'], $r['cutoff'])) {
                $buckets[$at->format($format)][$kind] += $event['amount'];
                $totals[$kind] += $event['amount'];
                if ($kind !== 'quotation') {
                    $details[] = ['date' => $at->toDateTimeString(), 'kind' => $kind,
                        'amount' => round($event['amount'], 2), 'reference' => $event['reference'], 'side' => 'current'];
                }
            }
            if ($at->betweenIncluded($r['previousStart'], $r['previousCutoff']) && $kind !== 'quotation') {
                $key = $at->format($format);
                $value = $event['amount'] * ($kind === 'refund' ? -1 : 1);
                $previous[$key] = ($previous[$key] ?? 0) + $value;
                $totals['previousNet'] += $value;
                $details[] = ['date' => $at->toDateTimeString(), 'kind' => $kind,
                    'amount' => round($event['amount'], 2), 'reference' => $event['reference'], 'side' => 'previous'];
            }
        }
        $points = [];
        $currentSum = $previousSum = $quotedSum = 0.0;
        $priorCursor = $r['previousStart'];
        foreach ($buckets as $key => $bucket) {
            $currentSum += $bucket['received'] - $bucket['refund'];
            $quotedSum += $bucket['quotation'];
            // Include any unmatched day(s) at the end of a longer previous month in the last current bucket.
            $previousUntil = $daily ? $bucket['at']->subMonthsNoOverflow($r['months'])->endOfDay()
                : $bucket['at']->subMonthsNoOverflow($r['months'])->endOfMonth();
            if ($bucket['at']->format($format) === $r['end']->format($format) && ! $r['partial']) {
                $previousUntil = $r['previousEnd'];
            }
            while ($priorCursor->lessThanOrEqualTo($previousUntil)) {
                $previousSum += $previous[$priorCursor->format($format)] ?? 0;
                $priorCursor = $daily ? $priorCursor->addDay() : $priorCursor->addMonth();
            }
            $visible = ! $r['future'] && $bucket['at']->lessThanOrEqualTo($r['cutoff']);
            $points[] = ['label' => $bucket['at']->format($daily ? 'd/m' : 'm/Y'),
                'current' => $visible ? round($currentSum, 2) : null,
                'previous' => $visible ? round($previousSum, 2) : null,
                'quotation' => $visible ? round($quotedSum, 2) : null];
        }
        $net = round($totals['received'] - $totals['refund'], 2);
        usort($details, fn ($a, $b) => strcmp($b['date'], $a['date']));

        return ['granularity' => $daily ? 'day' : 'month', 'points' => $points,
            'from' => $r['start']->toDateString(), 'to' => $r['future'] ? null : $r['cutoff']->toDateString(),
            'previousFrom' => $r['previousStart']->toDateString(), 'previousTo' => $r['future'] ? null : $r['previousCutoff']->toDateString(),
            'partial' => $r['partial'], 'asOf' => $r['cutoff']->toIso8601String(),
            'received' => round($totals['received'], 2), 'refund' => round($totals['refund'], 2),
            'net' => $net, 'previousNet' => round($totals['previousNet'], 2),
            'difference' => round($net - $totals['previousNet'], 2),
            'changeRate' => $r['future'] ? null : DashboardComparison::change($net, $totals['previousNet']), 'details' => $details];
    }

    public function profit(CarbonImmutable $start, CarbonImmutable $lastMonth, Collection $projects): array
    {
        $r = DashboardComparison::range($start, $lastMonth, CarbonImmutable::now(config('app.timezone')));
        $ids = $projects->pluck('id');
        $codes = $projects->pluck('project_code', 'id');
        $quotes = Quotation::whereIn('project_id', $ids)
            ->with(['items', 'paymentAllocations', 'paymentRefunds', 'project'])->get()->keyBy('id');
        $costs = ProjectCost::whereIn('project_id', $ids)->where('entry_type', ProjectCost::TYPE_PARTNER_COST)
            ->where('status', '!=', ProjectCost::STATUS_CANCELLED)->get()->keyBy('id');
        $records = PartnerFinanceRecognition::whereIn('project_id', $ids)->get();
        $review = [];
        $entries = [];
        $seen = [];
        foreach ($records as $record) {
            $source = $record->entity_type === 'revenue' ? $quotes->get($record->entity_id) : $costs->get($record->entity_id);
            if (! $source || ($source instanceof Quotation && $source->isVoided())) {
                continue;
            }
            $seen[$record->entity_type.':'.$source->id] = true;
            $amount = $source instanceof Quotation ? $this->finance->revenueAmount($source) : (float) $source->total_amount;
            $valid = $amount !== null && abs($amount - (float) $record->amount) <= 0.01
                && abs(collect($record->allocations)->sum('amount') - (float) $record->amount) <= 0.01;
            foreach ($record->allocations as $allocation) {
                if ($allocation['period'] < $r['previousStart']->format('Y-m') || $allocation['period'] > $lastMonth->format('Y-m')) {
                    continue;
                }
                $item = ['project' => $codes[$source->project_id] ?? '', 'projectId' => $source->project_id,
                    'reference' => $source instanceof Quotation ? $source->quotation_code : 'Chi phí #'.$source->id,
                    'kind' => $record->entity_type, 'period' => $allocation['period'], 'amount' => (float) $allocation['amount']];
                if ($valid) {
                    $entries[] = $item;
                } else {
                    $review[$record->entity_type.':'.$source->id] = $item + ['reason' => 'Nguồn đã thay đổi; cần xác nhận lại kỳ'];
                }
            }
        }
        foreach (['revenue' => $quotes, 'cost' => $costs] as $kind => $sources) {
            foreach ($sources as $source) {
                if (isset($seen[$kind.':'.$source->id]) || ($source instanceof Quotation && $source->isVoided())) {
                    continue;
                }
                // An unassigned period is never inferred from payment date. Show it as unresolved, not zero cost.
                if ($source->created_at && $source->created_at->greaterThan($r['end'])) {
                    continue;
                }
                $amount = $kind === 'revenue' ? $this->finance->revenueAmount($source) : (float) $source->total_amount;
                if ($amount !== null && abs($amount) < 0.01) {
                    continue;
                }
                $review[$kind.':'.$source->id] = ['project' => $codes[$source->project_id] ?? '', 'projectId' => $source->project_id,
                    'reference' => $kind === 'revenue' ? $source->quotation_code : 'Chi phí #'.$source->id,
                    'kind' => $kind, 'period' => null, 'amount' => $amount,
                    'reason' => $amount === null ? 'Cần đối soát ngân sách/phí dịch vụ' : 'Chưa xác nhận kỳ ghi nhận'];
            }
        }

        return self::profitProjection($r, $entries, array_values($review));
    }

    public static function profitProjection(array $r, array $entries, array $review): array
    {
        $buckets = [];
        foreach ($entries as $entry) {
            $buckets[$entry['period']][$entry['kind']] = ($buckets[$entry['period']][$entry['kind']] ?? 0) + $entry['amount'];
        }
        $points = [];
        $revenue = $cost = $prior = 0.0;
        for ($at = $r['start']; $at->lessThanOrEqualTo($r['end']); $at = $at->addMonth()) {
            $month = $at->format('Y-m');
            $oldMonth = $at->subMonthsNoOverflow($r['months'])->format('Y-m');
            $current = $buckets[$month] ?? [];
            $old = $buckets[$oldMonth] ?? [];
            $visible = ! $r['future'] && $at->lessThanOrEqualTo($r['cutoff']);
            if ($visible) {
                $revenue += $current['revenue'] ?? 0;
                $cost += $current['cost'] ?? 0;
                $prior += ($old['revenue'] ?? 0) - ($old['cost'] ?? 0);
            }
            $points[] = ['label' => $at->format('m/Y'), 'current' => $visible ? round($revenue - $cost, 2) : null,
                'previous' => $visible ? round($prior, 2) : null];
        }
        // Monthly recognition has no daily cutoff. Never claim a partial month's percent is a like-for-like day comparison.
        $comparable = ! $r['partial'] && count($review) === 0;
        return ['points' => $points, 'from' => $r['start']->format('Y-m'), 'to' => ($r['partial'] && ! $r['future'] ? $r['cutoff'] : $r['end'])->format('Y-m'),
            'previousFrom' => $r['previousStart']->format('Y-m'), 'previousTo' => ($r['partial'] && ! $r['future'] ? $r['previousCutoff'] : $r['previousEnd'])->format('Y-m'),
            'revenue' => round($revenue, 2), 'cost' => round($cost, 2), 'profit' => round($revenue - $cost, 2),
            'previousProfit' => round($prior, 2), 'comparable' => $comparable, 'partial' => $r['partial'],
            'changeRate' => $comparable ? DashboardComparison::change($revenue - $cost, $prior) : null,
            'review' => $review, 'details' => array_values(array_filter($entries, fn ($entry) => ! $r['future'] && (
                ($entry['period'] >= $r['start']->format('Y-m') && $entry['period'] <= $r['cutoff']->format('Y-m'))
                || ($entry['period'] >= $r['previousStart']->format('Y-m') && $entry['period'] <= $r['previousCutoff']->format('Y-m'))
            )))];
    }
}

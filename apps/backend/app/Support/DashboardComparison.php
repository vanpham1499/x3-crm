<?php

namespace App\Support;

use Carbon\CarbonImmutable;

/** Calendar-aligned comparisons; day 31 clamps to the preceding month's last day. */
final class DashboardComparison
{
    public static function range(CarbonImmutable $start, CarbonImmutable $lastMonth, CarbonImmutable $now): array
    {
        $start = $start->startOfMonth();
        $end = $lastMonth->endOfMonth();
        $months = (int) $start->diffInMonths($lastMonth->startOfMonth()) + 1;
        $previousStart = $start->subMonthsNoOverflow($months);
        $previousEnd = $start->subDay()->endOfDay();
        $cutoff = $now->lessThan($end) ? $now : $end;
        $future = $now->lessThan($start);
        $previousCutoff = $cutoff->subMonthsNoOverflow($months);
        if ($cutoff->equalTo($end)) {
            $previousCutoff = $previousEnd;
        }

        return ['start' => $start, 'end' => $end, 'cutoff' => $cutoff,
            'previousStart' => $previousStart, 'previousEnd' => $previousEnd,
            'previousCutoff' => $previousCutoff, 'months' => $months,
            'partial' => $now->lessThan($end), 'future' => $future];
    }

    public static function change(float $current, float $previous): ?float
    {
        return abs($previous) < 0.01 ? null : round(($current - $previous) / abs($previous) * 100, 2);
    }
}

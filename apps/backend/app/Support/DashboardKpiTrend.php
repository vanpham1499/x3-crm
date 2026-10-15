<?php

namespace App\Support;

use Carbon\CarbonImmutable;

/** Dated KPI credits, independent of company cash and profit recognition. */
final class DashboardKpiTrend
{
    public static function project(CarbonImmutable $start, CarbonImmutable $lastMonth, CarbonImmutable $now, array $events): array
    {
        $zone = 'Asia/Ho_Chi_Minh';
        $r = DashboardComparison::range(
            CarbonImmutable::parse($start->format('Y-m').'-01', $zone),
            CarbonImmutable::parse($lastMonth->format('Y-m').'-01', $zone),
            $now->setTimezone($zone),
        );
        $daily = $r['months'] === 1;
        $current = $previous = [];
        foreach ($events as $event) {
            $at = $event['at']->setTimezone($zone);
            if (! $r['future'] && $at->betweenIncluded($r['start'], $r['cutoff'])) {
                $current[] = ['at' => $at, 'amount' => $event['amount']];
            }
            if (! $r['future'] && $at->betweenIncluded($r['previousStart'], $r['previousCutoff'])) {
                $previous[] = ['at' => $at, 'amount' => $event['amount']];
            }
        }
        usort($current, fn ($a, $b) => $a['at']->getTimestamp() <=> $b['at']->getTimestamp());
        usort($previous, fn ($a, $b) => $a['at']->getTimestamp() <=> $b['at']->getTimestamp());
        $sameBasis = true;
        for ($at = $r['start']; $at->lessThanOrEqualTo($r['cutoff']); $at = $at->addMonth()) {
            if (KpiFeeBasis::applies($at->format('Y-m')) !== KpiFeeBasis::applies($at->subMonthsNoOverflow($r['months'])->format('Y-m'))) {
                $sameBasis = false;
            }
        }
        $comparable = ! $r['future'] && $sameBasis;
        $points = [];
        $sum = $priorSum = 0.0;
        $index = $priorIndex = 0;
        for ($at = $r['start']; $at->lessThanOrEqualTo($r['end']); $at = $daily ? $at->addDay() : $at->addMonth()) {
            $until = $daily ? $at->endOfDay() : $at->endOfMonth();
            $until = $until->min($r['cutoff']);
            $priorUntil = $daily ? $at->subMonthsNoOverflow($r['months'])->endOfDay()
                : $at->subMonthsNoOverflow($r['months'])->endOfMonth();
            // A completed February must include all days of the preceding January.
            if (! $r['partial'] && $at->format($daily ? 'Y-m-d' : 'Y-m') === $r['end']->format($daily ? 'Y-m-d' : 'Y-m')) {
                $priorUntil = $r['previousEnd'];
            }
            $priorUntil = $priorUntil->min($r['previousCutoff']);
            $visible = ! $r['future'] && $at->lessThanOrEqualTo($r['cutoff']);
            $before = $sum;
            $priorBefore = $priorSum;
            while ($visible && isset($current[$index]) && $current[$index]['at']->lessThanOrEqualTo($until)) {
                $sum += $current[$index++]['amount'];
            }
            while ($visible && isset($previous[$priorIndex]) && $previous[$priorIndex]['at']->lessThanOrEqualTo($priorUntil)) {
                $priorSum += $previous[$priorIndex++]['amount'];
            }
            $points[] = [
                'period' => $at->format($daily ? 'Y-m-d' : 'Y-m'),
                'label' => $at->format($daily ? 'd/m' : 'm/Y'),
                'to' => $visible ? $until->toDateString() : null,
                'previousTo' => $visible ? $priorUntil->toDateString() : null,
                'profitAmount' => $visible ? round($sum - $before, 2) : null,
                'previousProfitAmount' => $visible ? round($priorSum - $priorBefore, 2) : null,
                'cumulativeProfitAmount' => $visible ? round($sum, 2) : null,
                'previousCumulativeProfitAmount' => $visible ? round($priorSum, 2) : null,
                'difference' => $visible && $comparable ? round($sum - $priorSum, 2) : null,
            ];
        }

        return [
            'granularity' => $daily ? 'day' : 'month', 'points' => $points,
            'from' => $r['start']->toDateString(), 'to' => $r['future'] ? null : $r['cutoff']->toDateString(),
            'previousFrom' => $r['previousStart']->toDateString(), 'previousTo' => $r['future'] ? null : $r['previousCutoff']->toDateString(),
            'partial' => $r['partial'], 'future' => $r['future'], 'asOf' => $r['cutoff']->toIso8601String(),
            'currentAmount' => round($sum, 2), 'previousAmount' => round($priorSum, 2),
            'comparable' => $comparable, 'comparisonReason' => $r['future'] ? 'future' : ($sameBasis ? null : 'different_basis'),
            'difference' => $comparable ? round($sum - $priorSum, 2) : null,
            'changeRate' => $comparable ? DashboardComparison::change($sum, $priorSum) : null,
        ];
    }
}

<?php

namespace App\Support;

use Carbon\CarbonImmutable;

final class KpiReportingTime
{
    /**
     * KPI tables group by the ledger's recorded calendar date. Payment transaction_at
     * is stored and returned as a timezone-less bank/local time (PaymentResource).
     * Laravel's UTC cast must not move that date into another reporting month.
     * Keep this at the ledger projection boundary; genuine UTC instants elsewhere
     * still use setTimezone(), including DashboardKpiTrend's generic event input.
     */
    public static function fromLedger(CarbonImmutable $at): CarbonImmutable
    {
        return $at->shiftTimezone('Asia/Ho_Chi_Minh');
    }
}

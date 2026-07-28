<?php

namespace App\Repositories;

use App\Models\KpiTarget;
use Illuminate\Support\Collection;

class KpiTargetRepository extends BaseRepository
{
    protected function model(): string
    {
        return KpiTarget::class;
    }

    public function findForRange(string $periodStart, string $periodEnd): Collection
    {
        return $this->query()
            ->whereDate('period_month', '>=', $periodStart)
            ->whereDate('period_month', '<', $periodEnd)
            ->get();
    }

    public function upsertTarget(
        string $scopeType,
        int $scopeId,
        string $periodMonth,
        float $targetAmount,
    ): KpiTarget {
        return KpiTarget::query()->updateOrCreate(
            [
                'scope_type' => $scopeType,
                'scope_id' => $scopeId,
                'period_month' => $periodMonth,
            ],
            [
                'target_amount' => round($targetAmount, 2),
            ],
        );
    }
}

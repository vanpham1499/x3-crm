<?php

namespace App\Console\Commands;

use App\Models\Quotation;
use App\Support\KpiFeeBasis;
use Illuminate\Console\Command;

class FreezeKpiFeeBasis extends Command
{
    protected $signature = 'kpi:freeze-fee-basis';

    protected $description = 'Freeze existing paid quotation fee/owner snapshots for the October 2026 policy';

    public function handle(): int
    {
        $count = 0;
        Quotation::whereNull('kpi_fee_basis')->whereHas('paymentAllocations')
            ->chunkById(100, function ($quotations) use (&$count): void {
                foreach ($quotations as $quotation) {
                    KpiFeeBasis::freeze($quotation);
                    $count++;
                }
            });
        $this->info("Frozen {$count} quotation snapshots. Existing snapshots retained.");

        return self::SUCCESS;
    }
}

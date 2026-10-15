<?php

namespace App\Console\Commands;

use App\Models\Project;
use App\Support\ProjectTopupBudgetCalculator;
use App\Support\QuotationFinancialBasis;
use App\Support\QuotationServiceRevenue;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class AuditProjectFinance extends Command
{
    protected $signature = 'finance:audit-topup {--project= : Exact project code or ID}';

    protected $description = 'Read-only audit of corrected top-up sources and service revenue';

    public function handle(): int
    {
        DB::beginTransaction();
        try {
            if (DB::getDriverName() === 'pgsql') {
                DB::statement('SET TRANSACTION READ ONLY');
            }
            $checked = $changed = $negative = $review = 0;
            $rows = [];
            $query = Project::with(['quotations.items', 'quotations.paymentAllocations',
                'quotations.paymentRefunds', 'costs.cidIncident']);
            if ($project = $this->option('project')) {
                $query->where(is_numeric($project) ? 'id' : 'project_code', $project);
            }
            $query->chunkById(100, function ($projects) use (&$checked, &$changed, &$negative, &$review, &$rows): void {
                foreach ($projects as $project) {
                    $checked++;
                    $budget = ProjectTopupBudgetCalculator::calculate($project);
                    $oldKSource = false;
                    $needsReview = false;
                    $fee = 0.0;
                    foreach ($project->quotations as $quotation) {
                        $topup = ProjectTopupBudgetCalculator::calculateQuotation($quotation);
                        $revenue = QuotationServiceRevenue::calculate($quotation, $topup);
                        $fee += $revenue['collectedBeforeVat'] ?? 0;
                        $needsReview = $needsReview || $revenue['needsReview'];
                        $oldKSource = $oldKSource || (QuotationFinancialBasis::projectType($quotation) === 'K'
                            && (float) ($quotation->metadata['budget'] ?? 0) > 0
                            && (float) $quotation->paymentAllocations->sum('amount') > 0);
                    }
                    $changed += (int) $oldKSource;
                    $negative += (int) ($budget['availableBudget'] < 0);
                    $review += (int) $needsReview;
                    if (($oldKSource || $needsReview || $budget['availableBudget'] < 0 || $this->option('project')) && count($rows) < 30) {
                        $rows[] = [$project->project_code, $budget['eligibleBudget'], $budget['availableBudget'],
                            $needsReview ? 'REVIEW' : round($fee, 2),
                            $budget['availableBudget'] < 0 ? 'OVER TOPUP' : ($oldKSource ? 'K CORRECTED' : 'CHECK')];
                    }
                }
            });
            $this->table(['Project', 'Eligible budget', 'Available', 'Service received excl. VAT', 'Review'], $rows);
            $this->info("Projects={$checked}; paid K with reference budget={$changed}; negative budgets={$negative}; revenue review={$review}. No data modified. First 30 matches shown.");
        } finally {
            DB::rollBack();
        }

        return self::SUCCESS;
    }
}

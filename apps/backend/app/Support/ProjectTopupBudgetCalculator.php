<?php

namespace App\Support;

use App\Models\Project;
use App\Models\ProjectCost;
use App\Models\Quotation;
use App\Models\QuotationItem;

class ProjectTopupBudgetCalculator
{
    /**
     * @return array{customerBudget: float, usedBudget: float, availableBudget: float}
     */
    public static function calculate(Project $project): array
    {
        $project->loadMissing([
            'quotations.items',
            'costs.cidIncident',
        ]);

        $customerBudget = round((float) $project->quotations
            ->sum(fn (Quotation $quotation): float => self::quotationBudget($quotation)), 2);
        $usedBudget = round((float) $project->costs
            ->where('entry_type', ProjectCost::TYPE_AD_SPEND)
            ->where('status', ProjectCost::STATUS_COMPLETED)
            ->sum(fn (ProjectCost $cost): float => $cost->actualCostAmount()), 2);

        return [
            'customerBudget' => $customerBudget,
            'usedBudget' => $usedBudget,
            'availableBudget' => round($customerBudget - $usedBudget, 2),
        ];
    }

    private static function quotationBudget(Quotation $quotation): float
    {
        $metadata = is_array($quotation->metadata) ? $quotation->metadata : [];
        $budget = max(0, (float) ($metadata['budget'] ?? 0));
        $quotationVatRate = max(0, (float) ($quotation->vat_rate ?? 0));
        $budgetWithVat = $budget + round($budget * $quotationVatRate / 100, 2);
        $extraBudget = (float) $quotation->items
            ->filter(fn (QuotationItem $item): bool => self::countsTowardTopupBudget($item))
            ->sum(fn (QuotationItem $item): float => self::itemAmountAfterVat($item));

        return round($budgetWithVat + $extraBudget, 2);
    }

    private static function countsTowardTopupBudget(QuotationItem $item): bool
    {
        $metadata = is_array($item->metadata) ? $item->metadata : [];

        return filter_var(
            $metadata['countsTowardTopupBudget'] ?? false,
            FILTER_VALIDATE_BOOLEAN,
        );
    }

    private static function itemAmountAfterVat(QuotationItem $item): float
    {
        if ($item->amount_after_vat !== null) {
            return (float) $item->amount_after_vat;
        }

        $amountBeforeVat = (float) ($item->amount_before_vat ?? 0);
        $vatRate = max(0, (float) ($item->vat_rate ?? 0));

        return round($amountBeforeVat + ($amountBeforeVat * $vatRate / 100), 2);
    }
}

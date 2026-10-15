<?php

namespace App\Support;

use App\Models\Quotation;
use App\Models\QuotationItem;

/** Read the issued quotation, never the project's mutable current type. */
final class QuotationFinancialBasis
{
    public static function projectType(Quotation $quotation): ?string
    {
        $metadata = $quotation->metadata ?? [];
        foreach ([$metadata['projectType'] ?? null,
            explode('.', (string) ($metadata['projectCodeBase'] ?? ''))[2] ?? null,
            explode('.', (string) $quotation->quotation_code)[2] ?? null] as $value) {
            $type = strtoupper(trim((string) $value));
            if (in_array($type, ['K', 'M', 'O', 'N'], true)) {
                return $type;
            }
        }

        return null;
    }

    public static function excluded(QuotationItem $item): bool
    {
        return filter_var($item->metadata['excludedFromTotal'] ?? false, FILTER_VALIDATE_BOOLEAN);
    }

    public static function isBudgetItem(Quotation $quotation, QuotationItem $item): bool
    {
        if (self::projectType($quotation) === 'K' || self::excluded($item)) {
            return false;
        }

        return (string) $item->item_code === '-1'
            || (! in_array((string) $item->item_code, ['-2', '-3'], true)
                && filter_var($item->metadata['countsTowardTopupBudget'] ?? false, FILTER_VALIDATE_BOOLEAN));
    }

    public static function eligibleBudget(Quotation $quotation): float
    {
        if ($quotation->isVoided() || self::projectType($quotation) === 'K') {
            return 0.0;
        }
        $quotation->loadMissing('items');
        $budget = (float) $quotation->items
            ->filter(fn (QuotationItem $item): bool => self::isBudgetItem($quotation, $item))
            ->sum(fn (QuotationItem $item): float => round(self::gross($item)));

        // Legacy M snapshots without the generated budget line retain their source.
        // An explicitly excluded line must never fall back to metadata.budget.
        if (! $quotation->items->contains(fn ($item) => (string) $item->item_code === '-1')
            && self::projectType($quotation) === 'M') {
            $base = max(0, round((float) ($quotation->metadata['budget'] ?? 0)));
            $budget += $base + round($base * max(0, (float) $quotation->vat_rate) / 100);
        }

        return round(max(0, $budget));
    }

    public static function gross(QuotationItem $item): float
    {
        return (float) ($item->amount_after_vat ??
            ((float) $item->amount_before_vat + (float) ($item->vat_amount ??
                round((float) $item->amount_before_vat * max(0, (float) $item->vat_rate) / 100, 2))));
    }
}

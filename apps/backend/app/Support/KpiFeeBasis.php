<?php

namespace App\Support;

use App\Models\Quotation;
use App\Models\Service;

/** Versioned KPI policy. Amounts are VND; stored quotation lines are authoritative. */
final class KpiFeeBasis
{
    public const START = '2026-10';

    public static function applies(string $period): bool
    {
        return substr($period, 0, 7) >= self::START;
    }

    public static function capture(Quotation $quotation): array
    {
        $quotation->loadMissing(['items', 'project.managerUser', 'project.customer.salesUser']);
        $project = $quotation->project;
        $fee = 0.0;
        $feeGross = 0.0;
        foreach ($quotation->items as $item) {
            $meta = $item->metadata ?? [];
            // Stable auto-line codes, never matching customer-editable display names.
            if ((string) $item->item_code !== '-2' || ($meta['excludedFromTotal'] ?? false)) {
                continue;
            }
            $fee += max(0, (float) $item->amount_before_vat);
            $feeGross += max(0, (float) $item->amount_before_vat + (float) $item->vat_amount);
        }
        $root = $project?->service_id;
        $seen = [];
        while ($root && ! isset($seen[$root])) {
            $seen[$root] = true;
            $parent = Service::withTrashed()->find($root)?->parent_id;
            if (! $parent) {
                break;
            }
            $root = $parent;
        }
        $firstId = $project ? Quotation::where('project_id', $project->id)
            ->orderBy('created_at')->orderBy('id')->value('id') : null;

        return [
            'version' => 'management_fee_v1',
            'capturedAt' => now()->toIso8601String(),
            'fee' => round($fee, 2),
            'feeGross' => round($feeGross, 2),
            'billableGross' => round(max(0, (float) $quotation->subtotal_amount + (float) $quotation->vat_amount), 2),
            'deposit' => round(max(0, (float) $quotation->deposit_amount), 2),
            'projectId' => $project?->id,
            'serviceId' => $root,
            'managerId' => $project?->manager_user_id,
            'managerDepartmentId' => $project?->managerUser?->department_id,
            'salesId' => $project?->customer?->sales_user_id,
            'salesDepartmentId' => $project?->customer?->salesUser?->department_id,
            'firstQuotation' => (int) $firstId === (int) $quotation->id,
            'classification' => $fee > 0 ? 'management_fee' : 'no_management_fee',
        ];
    }

    public static function freeze(Quotation $quotation): void
    {
        if ($quotation->kpi_fee_basis !== null) {
            return;
        }
        $basis = self::capture($quotation);
        // Concurrent receipts must agree on one immutable snapshot.
        Quotation::whereKey($quotation->id)->whereNull('kpi_fee_basis')
            ->update(['kpi_fee_basis' => json_encode($basis, JSON_THROW_ON_ERROR)]);
        $quotation->refresh();
    }

    public static function recognized(array $basis, float $grossPaid): float
    {
        $gross = max(0, (float) $basis['billableGross']);
        if ($gross <= 0) {
            return 0.0;
        }
        $paid = min($gross, max(0, $grossPaid - (float) $basis['deposit']));

        return round($paid / $gross * (float) $basis['fee'], 2);
    }
}

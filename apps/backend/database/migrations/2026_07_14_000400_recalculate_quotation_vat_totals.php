<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('quotations')
            ->whereNull('deleted_at')
            ->where('vat_rate', '>', 0)
            ->orderBy('id')
            ->chunkById(100, function ($quotations): void {
                foreach ($quotations as $quotation) {
                    $subtotal = (float) $quotation->subtotal_amount;
                    $vatRate = (float) $quotation->vat_rate;
                    $vatAmount = round($subtotal * $vatRate / 100, 2);
                    $totalAmount = round($subtotal + $vatAmount, 2);
                    $storedTotal = (float) $quotation->total_amount;
                    $totalChanged = abs((float) $quotation->vat_amount - $vatAmount) >= 0.01
                        || abs($storedTotal - $totalAmount) >= 0.01;

                    if ($totalChanged) {
                        $updates = [
                            'vat_amount' => $vatAmount,
                            'total_amount' => $totalAmount,
                            'updated_at' => now(),
                        ];

                        if (abs((float) $quotation->deposit_amount - $storedTotal) < 0.01) {
                            $updates['deposit_amount'] = $totalAmount;
                        }

                        DB::table('quotations')->where('id', $quotation->id)->update($updates);
                    }

                    DB::table('quotation_items')
                        ->where('quotation_id', $quotation->id)
                        ->whereNull('deleted_at')
                        ->orderBy('id')
                        ->get(['id', 'amount_before_vat'])
                        ->each(function (object $item) use ($vatRate): void {
                            $amountBeforeVat = (float) $item->amount_before_vat;
                            $itemVatAmount = round($amountBeforeVat * $vatRate / 100, 2);

                            DB::table('quotation_items')->where('id', $item->id)->update([
                                'vat_rate' => $vatRate,
                                'vat_amount' => $itemVatAmount,
                                'amount_after_vat' => round($amountBeforeVat + $itemVatAmount, 2),
                                'updated_at' => now(),
                            ]);
                        });

                    if ($totalChanged) {
                        $this->reconcilePayments($quotation, $totalAmount);
                    }
                }
            });
    }

    public function down(): void
    {
        // The previous totals were inconsistent with their VAT rate, so they must not be restored.
    }

    private function reconcilePayments(object $quotation, float $totalAmount): void
    {
        $receivedAmount = (float) DB::table('payments')
            ->where('quotation_id', $quotation->id)
            ->whereNull('deleted_at')
            ->sum('amount');
        $matchStatus = $quotation->project_id ? 'matched_project' : 'matched_quotation';

        if ($receivedAmount <= 0) {
            $paymentStatus = $matchStatus;
        } elseif ($receivedAmount < $totalAmount) {
            $paymentStatus = 'partial';
        } elseif ($receivedAmount > $totalAmount) {
            $paymentStatus = 'overpaid';
        } else {
            $paymentStatus = 'paid';
        }

        DB::table('payments')
            ->where('quotation_id', $quotation->id)
            ->whereNull('deleted_at')
            ->update([
                'status' => $paymentStatus,
                'reconciled_status' => $matchStatus,
                'updated_at' => now(),
            ]);
    }
};

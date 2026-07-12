<?php

use App\Support\QuotationReference;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $quotations = DB::table('quotations')
            ->whereNull('deleted_at')
            ->whereNotNull('quotation_code')
            ->get()
            ->sortByDesc(fn ($quotation): int => strlen(
                QuotationReference::compact($quotation->quotation_code),
            ));
        $matchedQuotationIds = [];

        DB::table('payments')
            ->whereNull('deleted_at')
            ->whereNull('quotation_id')
            ->whereNotNull('transaction_content')
            ->orderBy('id')
            ->chunkById(100, function ($payments) use ($quotations, &$matchedQuotationIds): void {
                foreach ($payments as $payment) {
                    $quotation = $quotations->first(
                        fn ($item): bool => QuotationReference::appearsIn(
                            (string) $payment->transaction_content,
                            (string) $item->quotation_code,
                        ),
                    );

                    if (! $quotation) {
                        continue;
                    }

                    $matchStatus = $quotation->project_id ? 'matched_project' : 'matched_quotation';

                    DB::table('payments')->where('id', $payment->id)->update([
                        'quotation_id' => $quotation->id,
                        'lead_id' => $quotation->lead_id,
                        'customer_id' => $quotation->customer_id,
                        'project_id' => $quotation->project_id,
                        'contract_id' => $quotation->contract_id,
                        'status' => $matchStatus,
                        'reconciled_status' => $matchStatus,
                        'matched_at' => now(),
                        'updated_at' => now(),
                    ]);

                    $matchedQuotationIds[] = $quotation->id;
                }
            });

        foreach (array_unique($matchedQuotationIds) as $quotationId) {
            $quotation = DB::table('quotations')->where('id', $quotationId)->first();

            if (! $quotation) {
                continue;
            }

            $receivedAmount = (float) DB::table('payments')
                ->where('quotation_id', $quotationId)
                ->whereNull('deleted_at')
                ->sum('amount');
            $matchStatus = $quotation->project_id ? 'matched_project' : 'matched_quotation';
            $status = $this->collectionStatus(
                $receivedAmount,
                (float) $quotation->total_amount,
                $matchStatus,
            );

            DB::table('payments')
                ->where('quotation_id', $quotationId)
                ->whereNull('deleted_at')
                ->update([
                    'status' => $status,
                    'reconciled_status' => $matchStatus,
                    'updated_at' => now(),
                ]);

            if ($receivedAmount > 0 && $quotation->status !== 'lost') {
                DB::table('quotations')->where('id', $quotationId)->update([
                    'status' => 'won',
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        // Dữ liệu đối soát có thể đã được sử dụng sau migration nên không tự động hoàn tác.
    }

    private function collectionStatus(float $received, float $total, string $matchStatus): string
    {
        if ($received <= 0) {
            return $matchStatus;
        }

        if ($received < $total) {
            return 'partial';
        }

        if ($received > $total) {
            return 'overpaid';
        }

        return 'paid';
    }
};

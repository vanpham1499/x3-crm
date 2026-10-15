<?php

namespace App\Services;

use App\Models\Payment;
use App\Models\PaymentRefund;
use App\Models\User;
use App\Support\KpiFeeBasis;
use App\Support\QuotationFinancialBasis;
use Illuminate\Support\Facades\DB;

/** Read-only explanation of the same events used by KPI; never invents a fee basis. */
final class PaymentRecognitionService
{
    public function describe(Payment $payment): array
    {
        $payment->loadMissing(['allocations.quotation.project', 'allocations.quotation.paymentAllocations.payment', 'allocations.quotation.paymentRefunds']);
        $rows = $payment->allocations->map(function ($allocation): array {
            $quote = $allocation->quotation;
            $at = KpiFeeEvents::receiptAt($allocation);
            $basis = $quote?->kpi_fee_basis;
            $status = 'recognized';
            $amount = null;
            if (! $quote || ! $quote->project) {
                $status = 'unavailable';
            } elseif (! KpiFeeBasis::applies($at->format('Y-m'))) {
                $status = 'legacy';
            } elseif (! is_array($basis)) {
                $status = 'missing_basis';
            } else {
                $events = KpiFeeEvents::build(collect([$quote]), $quote->paymentAllocations,
                    $quote->paymentRefunds->where('status', PaymentRefund::STATUS_COMPLETED));
                $amount = (float) ($events->firstWhere('id', 'fee-receipt-'.$allocation->id)['amount'] ?? 0);
                if ((float) $basis['fee'] <= 0) {
                    $status = 'no_fee';
                } elseif ($amount <= 0) {
                    $status = 'no_increment';
                }
            }
            $person = function ($id) {
                $user = $id ? User::withTrashed()->find($id) : null;
                return $user ? ['id' => $user->id, 'name' => $user->name, 'code' => $user->code] : null;
            };
            return [
                'allocationId' => $allocation->id, 'quotationId' => $allocation->quotation_id,
                'quotationCode' => $quote?->quotation_code, 'projectCode' => $quote?->project?->project_code,
                'projectType' => $quote ? QuotationFinancialBasis::projectType($quote) : null,
                'allocatedAmount' => (float) $allocation->amount, 'recognizedAt' => $at->format('Y-m-d H:i:s'),
                'period' => $at->format('Y-m'), 'status' => $status,
                'feeAmount' => $amount, 'feeBasis' => $basis['fee'] ?? null,
                'implementation' => is_array($basis) ? $person($basis['managerId'] ?? null) : null,
                'sales' => is_array($basis) && ($basis['firstQuotation'] ?? false) ? $person($basis['salesId'] ?? null) : null,
                'firstQuotation' => $basis['firstQuotation'] ?? null,
            ];
        })->values();
        return [
            'paymentId' => $payment->id, 'rows' => $rows,
            'history' => DB::table('payment_receipt_audits as a')->leftJoin('users as u', 'u.id', '=', 'a.actor_id')
                ->where('a.payment_id', $payment->id)->orderByDesc('a.id')->limit(20)
                ->get(['a.reason', 'a.created_at as createdAt', 'u.name as actor', 'a.before', 'a.after'])
                ->map(fn ($row) => ['reason' => $row->reason, 'createdAt' => $row->createdAt, 'actor' => $row->actor,
                    'before' => $row->before ? json_decode($row->before, true) : null, 'after' => json_decode($row->after, true)]),
        ];
    }
}

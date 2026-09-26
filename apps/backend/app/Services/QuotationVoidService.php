<?php

namespace App\Services;

use App\Http\Resources\QuotationResource;
use App\Models\Contract;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use App\Models\PaymentRefund;
use App\Models\Project;
use App\Models\Quotation;
use App\Repositories\PaymentRepository;
use App\Support\FinancialMutation;
use App\Support\ProjectTopupBudgetCalculator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/** Cancellation is a ledger correction, never deletion of a bank transaction. */
class QuotationVoidService extends BaseService
{
    public function __construct(
        private readonly PaymentAllocationService $allocations,
        private readonly PaymentRepository $payments,
        private readonly PaymentsService $paymentService,
        private readonly KpiService $kpi,
    ) {}

    public function preview(string $id, array $data): array
    {
        return FinancialMutation::run(function () use ($id, $data): array {
            $source = Quotation::withVoided()->findOrFail($id);
            $this->authorize('void', $source);
            if ($source->isVoided()) {
                throw new ConflictHttpException('Báo phí đã hủy. Mở lại lịch sử để xem kết quả.');
            }

            return $this->plan($source, $data)['preview'];
        });
    }

    public function execute(string $id, array $data): array
    {
        return FinancialMutation::run(function () use ($id, $data): array {
            $source = Quotation::withVoided()->lockForUpdate()->findOrFail($id);
            $this->authorize('void', $source);
            $requestHash = hash('sha256', json_encode([
                $this->currentUser()->id, $data['mode'], isset($data['targetQuotationId']) ? (int) $data['targetQuotationId'] : null,
                trim($data['reason']), trim($data['confirmationCode']),
            ], JSON_THROW_ON_ERROR));
            if ($source->isVoided()) {
                if ($source->void_request_id === $data['requestId'] && hash_equals($source->void_request_hash ?? '', $requestHash)) {
                    return $this->result($source); // Retry after a lost response, no repeated release.
                }
                throw new ConflictHttpException('Báo phí đã được hủy; không thể xử lý tiền lần nữa.');
            }
            if (Quotation::withVoided()->where('void_request_id', $data['requestId'])->exists()) {
                throw new ConflictHttpException('Mã yêu cầu đã dùng cho thao tác khác. Vui lòng mở lại hộp xử lý.');
            }
            if (trim($data['confirmationCode']) !== $source->quotation_code) {
                throw ValidationException::withMessages(['confirmationCode' => 'Nhập đúng mã báo phí đầy đủ để xác nhận.']);
            }
            $context = $this->plan($source, $data);
            $preview = $context['preview'];
            if (! hash_equals($preview['fingerprint'], $data['fingerprint'])) {
                throw new ConflictHttpException('Số liệu đã thay đổi sau khi xem trước. Hãy tải lại kết quả dự kiến và xác nhận lại.');
            }
            if ($preview['blockers'] !== []) {
                throw ValidationException::withMessages(['quotation' => $preview['blockers']]);
            }
            $newAllocationIds = [];
            foreach ($context['sourceAllocations'] as $allocation) {
                $allocation->deleted_by = $this->currentUser()->id;
                $allocation->save();
                $allocation->delete();
            }
            foreach ($preview['entries'] as $entry) {
                if ($entry['transferAmount'] <= 0) {
                    continue;
                }
                $old = $context['sourceAllocations']->firstWhere('id', $entry['allocationId']);
                $created = PaymentAllocation::create([
                    'payment_id' => $entry['paymentId'],
                    'quotation_id' => $context['target']->id,
                    'customer_id' => $context['target']->customer_id,
                    'project_id' => $context['target']->project_id,
                    'amount' => $entry['transferAmount'],
                    // Keep bank-date fallback in the original period, audit uses voided_at.
                    'allocated_at' => $old->allocated_at ?? $old->created_at,
                    'note' => 'Chuyển từ báo phí hủy '.$source->quotation_code.'; phân bổ #'.$old->id,
                    'created_by' => $this->currentUser()->id,
                    'updated_by' => $this->currentUser()->id,
                ]);
                $newAllocationIds[] = $created->id;
            }
            $audit = $preview;
            unset($audit['fingerprint'], $audit['blockers']);
            $audit['reason'] = trim($data['reason']);
            $audit['actor'] = $this->currentUser()->only(['id', 'code', 'name']);
            $audit['voidedAt'] = now()->toISOString();
            $audit['newAllocationIds'] = $newAllocationIds;
            $audit['originalQuotation'] = $source->getAttributes();
            $audit['originalItems'] = $source->items->map->getAttributes()->all();
            $audit['originalPaymentLinks'] = $context['payments']->map(fn ($p) => $p->only(['id', 'quotation_id', 'customer_id', 'project_id', 'contract_id']))->all();
            $audit['originalProjectQuotationId'] = $source->project?->quotation_id;
            $source->forceFill([
                'voided_at' => now(), 'voided_by' => $this->currentUser()->id,
                'void_request_id' => $data['requestId'], 'void_request_hash' => $requestHash,
                'void_details' => $audit,
            ])->save();
            // Keep monetary totals, metadata, code and original bank evidence untouched.
            foreach ($context['payments'] as $payment) {
                if ((string) $payment->quotation_id === (string) $source->id) {
                    DB::table('payments')->where('id', $payment->id)->update([
                        'quotation_id' => null, 'contract_id' => null,
                        // Keep known project/customer context for visibility, not a fake orphan.
                        'updated_at' => now(),
                    ]);
                }
                $this->allocations->reconcilePayment($payment->id);
                $this->paymentService->syncPaymentNotifications($payment->id);
            }
            // Keep the legacy primary link valid so later Project edits do not reopen a void quote.
            DB::table('projects')->where('id', $source->project_id)
                ->where('quotation_id', $source->id)
                ->update(['quotation_id' => $context['target']?->id]);
            if ($context['target']) {
                $this->allocations->reconcileQuotation($context['target']->id);
            }

            return $this->result($source);
        });
    }

    private function result(Quotation $source): array
    {
        $source->load(['items', 'project', 'customer', 'paymentAllocations', 'paymentRefunds']);

        return ['quotation' => (new QuotationResource($source))->resolve(), 'audit' => $source->void_details];
    }

    private function plan(Quotation $source, array $data): array
    {
        $project = Project::query()->lockForUpdate()->find($source->project_id);
        if (! $project || ! $source->customer_id || (string) $project->customer_id !== (string) $source->customer_id) {
            throw ValidationException::withMessages(['quotation' => 'Báo phí chưa có dự án/khách hàng hợp lệ để xử lý.']);
        }
        $this->authorize('view', $source);
        $quotes = Quotation::query()->where('project_id', $project->id)->orderBy('id')->lockForUpdate()->get();
        $quotes->load(['items', 'paymentAllocations.payment', 'paymentRefunds']);
        $source = $quotes->firstWhere('id', $source->id);
        if (! $source) {
            throw new ConflictHttpException('Báo phí không còn hiệu lực.');
        }
        $target = null;
        if ($data['mode'] === 'transfer') {
            $target = $quotes->firstWhere('id', (int) ($data['targetQuotationId'] ?? 0));
            if (! $target || $target->id === $source->id || (string) $target->customer_id !== (string) $source->customer_id) {
                throw ValidationException::withMessages(['targetQuotationId' => 'Chọn báo phí khác, cùng khách hàng và cùng dự án, còn hiệu lực.']);
            }
            $this->authorize('view', $target);
            if ($this->allocations->quotationOutstandingAmount($target) <= 0) {
                throw ValidationException::withMessages(['targetQuotationId' => 'Báo phí đích đã thu đủ hoặc không còn công nợ.']);
            }
        }
        $sourceAllocations = $source->paymentAllocations->sortBy('id')->values();
        $payments = Payment::query()
            ->where(fn ($query) => $query->whereIn('id', $sourceAllocations->pluck('payment_id'))->orWhere('quotation_id', $source->id))
            ->orderBy('id')->lockForUpdate()->get();
        $payments->load(['allocations', 'refunds']);
        foreach ($payments as $payment) {
            // Same payment visibility as the normal allocation action.
            $this->payments->findWithRelationsOrFail((string) $payment->id, $this->currentUser());
        }
        $project->setRelation('quotations', $quotes);
        $project->load(['costs.cidIncident', 'costs.adjustments']);
        $blockers = [];
        $protectedRefunds = PaymentRefund::query()
            ->where(fn ($q) => $q->whereIn('quotation_id', array_filter([$source->id, $target?->id]))
                ->orWhereIn('payment_allocation_id', $sourceAllocations->pluck('id')))
            ->whereIn('status', [PaymentRefund::STATUS_PENDING, PaymentRefund::STATUS_COMPLETED])
            ->orderBy('id')->get();
        foreach ($protectedRefunds as $refund) {
            $blockers[] = 'Khoản trả khách #'.$refund->id.' ('.$refund->refund_type.', '.$refund->status.') đang liên quan. Xử lý theo luồng hoàn tiền, không tháo phân bổ này.';
        }
        foreach ($sourceAllocations as $allocation) {
            if (! $payments->contains('id', $allocation->payment_id)) {
                $blockers[] = 'Phân bổ #'.$allocation->id.' không có giao dịch nguồn đang hoạt động.';
            }
        }
        foreach ($payments as $payment) {
            if (($payment->receipt_type ?? 'customer') !== 'customer') {
                $blockers[] = 'Giao dịch #'.$payment->id.' không phải khoản thu khách hàng.';
            }
            $reserved = $payment->refunds->where('refund_type', PaymentRefund::TYPE_OVERPAYMENT)
                ->whereIn('status', [PaymentRefund::STATUS_PENDING, PaymentRefund::STATUS_COMPLETED]);
            if (self::cents($payment->allocations->sum('amount')) + self::cents($reserved->sum('amount')) > self::cents($payment->amount)) {
                $blockers[] = 'Giao dịch #'.$payment->id.' có số đã cam kết vượt tiền gốc, cần đối soát trước.';
            }
        }
        $before = ProjectTopupBudgetCalculator::calculate($project);
        $targetOutstanding = $target ? $this->allocations->quotationOutstandingAmount($target) : 0.0;
        $capacity = self::cents($targetOutstanding);
        $entries = [];
        $targetCopy = $target ? clone $target : null;
        $simulatedAllocations = $target ? new Collection($target->paymentAllocations->all()) : new Collection;
        foreach ($sourceAllocations as $allocation) {
            $payment = $payments->firstWhere('id', $allocation->payment_id);
            $amount = self::cents($allocation->amount);
            $transfer = $target ? min($amount, $capacity) : 0;
            $capacity -= $transfer;
            $entries[] = [
                'allocationId' => $allocation->id, 'paymentId' => $allocation->payment_id,
                'reference' => $payment?->reference, 'bankAmount' => $payment?->amount,
                'transactionAt' => $payment?->transaction_at?->toIso8601String()
                    ?? $payment?->transaction_date?->toDateString() ?? $allocation->allocated_at?->toIso8601String(),
                'allocatedAt' => $allocation->allocated_at?->toIso8601String(),
                'amount' => $amount / 100, 'transferAmount' => $transfer / 100,
                'releaseAmount' => ($amount - $transfer) / 100,
            ];
            if ($transfer > 0) {
                $copy = clone $allocation;
                $copy->quotation_id = $target->id;
                $copy->amount = $transfer / 100;
                $copy->setRelation('payment', $payment);
                $simulatedAllocations->push($copy);
            }
        }
        if ($targetCopy) {
            $targetCopy->setRelation('paymentAllocations', $simulatedAllocations);
        }
        $remainingQuotes = $quotes->reject(fn ($q) => $q->id === $source->id)
            ->map(fn ($q) => $targetCopy && $q->id === $targetCopy->id ? $targetCopy : $q)->values();
        $projectAfter = clone $project;
        $projectAfter->setRelation('quotations', new Collection($remainingQuotes->all()));
        $after = ProjectTopupBudgetCalculator::calculate($projectAfter);
        // A pre-existing deficit may remain only if this operation does not worsen it.
        if ($after['availableBudget'] < min(0, $before['availableBudget'])) {
            $blockers[] = 'Hủy làm thiếu nguồn cho tiền đã nạp: có thể nạp trước '.number_format($before['availableBudget'], 0, ',', '.')
                .'đ, sau '.number_format($after['availableBudget'], 0, ',', '.').'đ. Chọn báo phí thay thế có nguồn phù hợp.';
        }
        $contracts = Contract::query()->where(fn ($q) => $q->where('quotation_id', $source->id)
            ->when($source->contract_id, fn ($q) => $q->orWhere('id', $source->contract_id)))->orderBy('id')->get();
        $warnings = ['Không chuyển tiền ngân hàng, không tạo hoàn tiền và không xóa chi phí. Các kỳ KPI liên quan được tính lại theo phân bổ mới.'];
        foreach ($contracts as $contract) {
            $warnings[] = 'Hợp đồng '.($contract->contract_no ?: '#'.$contract->id).' được giữ nguyên; đối chiếu riêng chứng từ liên quan.';
        }
        foreach ($payments as $payment) {
            if ($payment->output_invoice_number) {
                $warnings[] = 'Giao dịch #'.$payment->id.' có số hóa đơn '.$payment->output_invoice_number.'. Thao tác này không hủy/điều chỉnh hóa đơn.';
            }
        }
        if ($project->costs->isNotEmpty()) {
            $warnings[] = 'Dự án đã có chi phí. Các khoản chi và liên kết chứng từ được giữ nguyên.';
        }
        $firstCredit = function ($items): ?array {
            $all = $items->flatMap(fn ($q) => $q->paymentAllocations);
            $credit = $this->kpi->paidFirstQuotations($items, $all)->first();

            return $credit ? ['quotationCode' => $credit['quotation']->quotation_code, 'paidAt' => $credit['paidAt']->toIso8601String()] : null;
        };
        $fingerprint = hash_hmac('sha256', json_encode([
            $this->currentUser()->id, $data['mode'], $target?->id,
            $project->getAttributes(), $quotes->toArray(), $payments->toArray(),
            $project->costs->toArray(), $protectedRefunds->toArray(), $contracts->toArray(),
        ], JSON_THROW_ON_ERROR), (string) config('app.key'));
        $preview = [
            'sourceId' => $source->id, 'sourceCode' => $source->quotation_code,
            'projectId' => $project->id, 'projectCode' => $project->project_code,
            'customerId' => $source->customer_id, 'totalAmount' => (float) $source->total_amount,
            'mode' => $data['mode'], 'targetId' => $target?->id, 'targetCode' => $target?->quotation_code,
            'allocatedAmount' => round(array_sum(array_column($entries, 'amount')), 2),
            'transferAmount' => round(array_sum(array_column($entries, 'transferAmount')), 2),
            'releaseAmount' => round(array_sum(array_column($entries, 'releaseAmount')), 2),
            'targetOutstandingBefore' => $targetOutstanding,
            'targetOutstandingAfter' => $targetCopy ? (new QuotationResource($targetCopy))->resolve()['outstandingAmount'] : 0.0,
            'availableBudgetBefore' => $before['availableBudget'], 'availableBudgetAfter' => $after['availableBudget'],
            'acquisitionBefore' => $firstCredit($quotes), 'acquisitionAfter' => $firstCredit($remainingQuotes),
            'entries' => $entries, 'warnings' => $warnings,
            'blockers' => array_values(array_unique($blockers)), 'fingerprint' => $fingerprint,
        ];

        return compact('source', 'target', 'payments', 'sourceAllocations', 'preview');
    }

    private static function cents(mixed $value): int
    {
        return (int) round((float) $value * 100);
    }
}

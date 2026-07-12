<?php

namespace App\Services;

use App\Http\Resources\PaymentResource;
use App\Models\Payment;
use App\Models\Quotation;
use App\Repositories\PaymentRepository;
use Illuminate\Support\Facades\DB;

class PaymentsService extends BaseService
{
    public function __construct(
        private readonly PaymentRepository $payments,
        private readonly QuotationsService $quotations,
    ) {}

    public function findAll(array $filters = [])
    {
        return $this->apiCollection($this->payments->findAll($this->normalizeKeys($filters)), PaymentResource::class);
    }

    public function findOne(string $id): array
    {
        return $this->apiResource($this->payments->findWithRelationsOrFail($id), PaymentResource::class);
    }

    public function create(array $data): array
    {
        return $this->transaction(function () use ($data): array {
            $data = $this->normalizePayload($data);
            $quotation = ! empty($data['quotation_id'])
                ? $this->quotations->findModel((string) $data['quotation_id'])
                : null;

            if ($quotation) {
                $data = array_merge($data, $this->matchedPayload($quotation));
            }

            /** @var Payment $payment */
            $payment = $this->payments->create($data);
            $this->reconcileQuotationPayments($quotation?->id);

            return $this->paymentResource($payment);
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            $current = $this->payments->findWithRelationsOrFail($id);
            $previousQuotationId = $current->quotation_id;
            $data = $this->normalizePayload($data);
            $quotationId = array_key_exists('quotation_id', $data)
                ? $data['quotation_id']
                : $previousQuotationId;
            $quotation = $quotationId
                ? $this->quotations->findModel((string) $quotationId)
                : null;

            if ($quotation && array_key_exists('quotation_id', $data)) {
                $data = array_merge($data, $this->matchedPayload($quotation));
            }

            /** @var Payment $payment */
            $payment = $this->payments->update($id, $data);
            $this->reconcileQuotationPayments($previousQuotationId);

            if ((string) $quotationId !== (string) $previousQuotationId) {
                $this->reconcileQuotationPayments($quotationId);
            }

            return $this->paymentResource($payment);
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            $payment = $this->payments->findWithRelationsOrFail($id);
            $quotationId = $payment->quotation_id;
            $this->payments->delete($id);
            $this->reconcileQuotationPayments($quotationId);

            return ['message' => 'Xóa thanh toán thành công'];
        });
    }

    public function webhook(array $data): array
    {
        return $this->transaction(function () use ($data): array {
            $rawPayload = $data;

            if (! $this->isIncomingTransfer($rawPayload)) {
                return ['ignored' => true, 'reason' => 'outgoing_transfer'];
            }

            $data = $this->normalizePayload($data);
            $content = (string) ($data['transaction_content'] ?? '');
            $quotation = $this->quotations->findCodeInText($content);
            $existingPayment = $this->findDuplicateWebhookPayment($data);

            if ($existingPayment) {
                if ($quotation && ! $existingPayment->quotation_id) {
                    $existingPayment = $this->payments->update($existingPayment->id, array_merge(
                        $this->matchedPayload($quotation),
                        ['webhook_payload' => $rawPayload],
                    ));
                    $this->reconcileQuotationPayments($quotation->id);
                }

                return $this->paymentResource($existingPayment);
            }

            if (! $quotation) {
                $payment = $this->payments->create(array_merge($data, [
                    'status' => 'unmatched',
                    'reconciled_status' => 'unmatched',
                    'webhook_payload' => $rawPayload,
                ]));

                return $this->paymentResource($payment);
            }

            $payment = $this->payments->create(array_merge($data, $this->matchedPayload($quotation), [
                'webhook_payload' => $rawPayload,
            ]));
            $this->reconcileQuotationPayments($quotation->id);

            return $this->paymentResource($payment);
        });
    }

    public function matchProject(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            $payment = $this->payments->findWithRelationsOrFail($id);
            $data = $this->normalizePayload($data);
            $quotation = $payment->quotation_id ? $this->quotations->findModel($payment->quotation_id) : null;

            if (! $quotation && ! empty($data['quotation_id'])) {
                $quotation = $this->quotations->findModel($data['quotation_id']);
            }

            $update = array_filter([
                'quotation_id' => $quotation?->id ?? $data['quotation_id'] ?? null,
                'lead_id' => $quotation?->lead_id ?? $data['lead_id'] ?? null,
                'customer_id' => $quotation?->customer_id ?? $data['customer_id'] ?? null,
                'project_id' => $quotation?->project_id ?? $data['project_id'] ?? null,
                'contract_id' => $quotation?->contract_id ?? $data['contract_id'] ?? null,
            ], fn ($value) => $value !== null);

            $update['status'] = ($update['project_id'] ?? null) ? 'matched_project' : 'matched_quotation';
            $update['reconciled_status'] = $update['status'];
            $update['matched_at'] = now();

            /** @var Payment $updated */
            $updated = $this->payments->update($payment->id, $update);
            $this->reconcileQuotationPayments($quotation?->id);

            return $this->paymentResource($updated);
        });
    }

    private function matchedPayload(Quotation $quotation): array
    {
        $hasProject = (bool) $quotation->project_id;

        return [
            'quotation_id' => $quotation->id,
            'lead_id' => $quotation->lead_id,
            'customer_id' => $quotation->customer_id,
            'project_id' => $quotation->project_id,
            'contract_id' => $quotation->contract_id,
            'status' => $hasProject ? 'matched_project' : 'matched_quotation',
            'reconciled_status' => $hasProject ? 'matched_project' : 'matched_quotation',
            'matched_at' => now(),
        ];
    }

    private function normalizePayload(array $data): array
    {
        $data = $this->normalizeKeys($data);
        $data['transaction_date'] = $data['transaction_date'] ?? now()->toDateString();

        foreach (['quotation_id', 'lead_id', 'customer_id', 'project_id', 'contract_id', 'revenue_id'] as $key) {
            if (array_key_exists($key, $data) && $data[$key] === '') {
                $data[$key] = null;
            }
        }

        return $data;
    }

    private function normalizeKeys(array $data): array
    {
        $map = [
            'quotationId' => 'quotation_id',
            'leadId' => 'lead_id',
            'customerId' => 'customer_id',
            'projectId' => 'project_id',
            'contractId' => 'contract_id',
            'revenueId' => 'revenue_id',
            'transactionDate' => 'transaction_date',
            'bankAccount' => 'bank_account',
            'transactionContent' => 'transaction_content',
            'customerCodeText' => 'customer_code_text',
            'reconciledStatus' => 'reconciled_status',
        ];

        foreach ($map as $from => $to) {
            if (array_key_exists($from, $data)) {
                $data[$to] = $data[$from];
                unset($data[$from]);
            }
        }

        $aliases = [
            'transaction_content' => ['content', 'description'],
            'amount' => ['transferAmount', 'transfer_amount'],
            'bank_account' => ['accountNumber', 'account_number', 'gateway'],
            'customer_code_text' => ['subAccount', 'sub_account'],
            'reference' => ['referenceCode', 'reference_code', 'code', 'id'],
        ];

        foreach ($aliases as $target => $sources) {
            if (isset($data[$target]) && $data[$target] !== '') {
                continue;
            }

            foreach ($sources as $source) {
                if (isset($data[$source]) && $data[$source] !== '') {
                    $data[$target] = $data[$source];
                    break;
                }
            }
        }

        return $data;
    }

    private function reconcileQuotationPayments(string|int|null $quotationId): void
    {
        if (! $quotationId) {
            return;
        }

        $quotation = $this->quotations->findModel((string) $quotationId);
        $receivedAmount = (float) Payment::query()
            ->where('quotation_id', $quotationId)
            ->sum('amount');
        $matchStatus = $quotation->project_id ? 'matched_project' : 'matched_quotation';
        $paymentStatus = $this->collectionStatus(
            $receivedAmount,
            (float) $quotation->total_amount,
            $matchStatus,
        );

        Payment::query()
            ->where('quotation_id', $quotationId)
            ->update([
                'status' => $paymentStatus,
                'reconciled_status' => $matchStatus,
                'matched_at' => now(),
                'updated_at' => now(),
            ]);

        if ($receivedAmount > 0 && $quotation->status !== Quotation::STATUS_LOST) {
            DB::table('quotations')
                ->where('id', $quotationId)
                ->update(['status' => Quotation::STATUS_WON, 'updated_at' => now()]);
        }
    }

    private function collectionStatus(
        float $receivedAmount,
        float $totalAmount,
        string $matchStatus,
    ): string {
        if ($receivedAmount <= 0) {
            return $matchStatus;
        }

        if ($receivedAmount < $totalAmount) {
            return 'partial';
        }

        if ($receivedAmount > $totalAmount) {
            return 'overpaid';
        }

        return 'paid';
    }

    private function findDuplicateWebhookPayment(array $data): ?Payment
    {
        $reference = trim((string) ($data['reference'] ?? ''));

        if ($reference === '') {
            return null;
        }

        return Payment::query()
            ->where('reference', $reference)
            ->when(
                ! empty($data['bank_account']),
                fn ($query) => $query->where('bank_account', $data['bank_account']),
            )
            ->first();
    }

    private function isIncomingTransfer(array $data): bool
    {
        $transferType = strtolower(trim((string) ($data['transferType'] ?? $data['transfer_type'] ?? '')));

        return $transferType === '' || in_array(
            $transferType,
            ['in', 'incoming', 'credit', 'receive', 'received'],
            true,
        );
    }

    private function paymentResource(Payment $payment): array
    {
        return $this->apiResource(
            $payment->refresh()->load(['quotation', 'lead', 'customer', 'project', 'contract', 'revenue']),
            PaymentResource::class,
        );
    }
}

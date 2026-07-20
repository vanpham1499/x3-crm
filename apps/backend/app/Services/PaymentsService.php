<?php

namespace App\Services;

use App\Http\Resources\PaymentResource;
use App\Models\Payment;
use App\Models\Quotation;
use App\Repositories\PaymentRepository;
use App\Support\QuotationReference;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Validation\ValidationException;

class PaymentsService extends BaseService
{
    public function __construct(
        private readonly PaymentRepository $payments,
        private readonly QuotationsService $quotations,
        private readonly PaymentAllocationService $paymentAllocations,
    ) {}

    public function findAll(array $filters = [])
    {
        $payments = $this->payments->findAll($this->normalizeKeys($filters));
        $this->paymentAllocations->appendCollectionContext($payments);

        return $this->apiCollection($payments, PaymentResource::class);
    }

    public function findPaginated(array $filters, int $perPage, int $page): array
    {
        $paginator = $this->payments->findPaginated($this->normalizeKeys($filters), $perPage, $page);
        $this->paymentAllocations->appendCollectionContext($paginator->getCollection());

        return $this->apiPaginatedCollection($paginator, PaymentResource::class);
    }

    public function findOne(string $id): array
    {
        $payment = $this->payments->findWithRelationsOrFail($id);
        $this->paymentAllocations->appendCollectionContext(new Collection([$payment]));

        return $this->apiResource($payment, PaymentResource::class);
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
            $this->paymentAllocations->reconcilePayment($payment->id);
            $this->paymentAllocations->autoAllocateToQuotation($payment->id, $quotation?->id, auth()->id());

            return $this->paymentResource($payment);
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            $current = $this->payments->findWithRelationsOrFail($id);
            $data = $this->normalizePayload($data);

            if (array_key_exists('amount', $data)) {
                $committedAmount = (float) $current->allocations->sum('amount')
                    + (float) $current->refunds->sum('amount');

                if ((float) $data['amount'] < $committedAmount) {
                    throw ValidationException::withMessages([
                        'amount' => ['Số tiền giao dịch không được nhỏ hơn tổng đã phân bổ và đã hoàn.'],
                    ]);
                }
            }

            $previousQuotationId = $current->quotation_id;
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
            $this->paymentAllocations->reconcilePayment($payment->id);
            $this->paymentAllocations->reconcileQuotation($previousQuotationId);

            if ((string) $quotationId !== (string) $previousQuotationId) {
                $this->paymentAllocations->autoAllocateToQuotation($payment->id, $quotationId, auth()->id());
            }

            return $this->paymentResource($payment);
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            $payment = $this->payments->findWithRelationsOrFail($id);

            if ($payment->allocations->isNotEmpty() || $payment->refunds->isNotEmpty()) {
                throw ValidationException::withMessages([
                    'payment' => ['Không thể xóa giao dịch đã có phân bổ hoặc hoàn tiền.'],
                ]);
            }

            $this->payments->delete($id);

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
                $webhookDetails = array_filter([
                    'transaction_date' => $data['transaction_date'] ?? null,
                    'transaction_at' => $data['transaction_at'] ?? null,
                    'sender_name' => $data['sender_name'] ?? null,
                    'bank_account' => $data['bank_account'] ?? null,
                    'transaction_content' => $data['transaction_content'] ?? null,
                    'webhook_payload' => $rawPayload,
                ], fn ($value) => $value !== null && $value !== '');

                if ($quotation && ! $existingPayment->quotation_id) {
                    $existingPayment = $this->payments->update($existingPayment->id, array_merge(
                        $this->matchedPayload($quotation),
                        $webhookDetails,
                    ));
                } elseif ($webhookDetails !== []) {
                    $existingPayment = $this->payments->update($existingPayment->id, $webhookDetails);
                }

                $this->paymentAllocations->reconcilePayment($existingPayment->id);
                $this->paymentAllocations->autoAllocateToQuotation(
                    $existingPayment->id,
                    $quotation?->id,
                    auth()->id(),
                );

                return $this->paymentResource($existingPayment);
            }

            if (! $quotation) {
                $payment = $this->payments->create(array_merge($data, [
                    'status' => 'unmatched',
                    'reconciled_status' => 'unmatched',
                    'receipt_type' => 'customer',
                    'webhook_payload' => $rawPayload,
                ]));
                $this->paymentAllocations->reconcilePayment($payment->id);

                return $this->paymentResource($payment);
            }

            $payment = $this->payments->create(array_merge($data, $this->matchedPayload($quotation), [
                'receipt_type' => 'customer',
                'webhook_payload' => $rawPayload,
            ]));
            $this->paymentAllocations->autoAllocateToQuotation($payment->id, $quotation->id, auth()->id());

            return $this->paymentResource($payment);
        });
    }

    public function matchProject(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            $this->authorize('manage', Payment::class);
            $data = $this->normalizePayload($data);
            $quotation = ! empty($data['quotation_id'])
                ? $this->quotations->findModel((string) $data['quotation_id'])
                : null;

            $this->paymentAllocations->link($id, [
                'customer_id' => $quotation?->customer_id ?? $data['customer_id'] ?? null,
                'project_id' => $quotation?->project_id ?? $data['project_id'] ?? null,
                'receipt_type' => 'customer',
            ]);

            if ($quotation) {
                $this->payments->update($id, $this->matchedPayload($quotation));
                $this->paymentAllocations->autoAllocateToQuotation($id, $quotation->id, auth()->id());
            }

            return $this->paymentResource($this->payments->findWithRelationsOrFail($id));
        });
    }

    public function allocate(string $id, array $data): array
    {
        $this->authorize('manage', Payment::class);
        $this->paymentAllocations->allocate($id, $data['allocations'] ?? [], auth()->id());

        return $this->paymentResource($this->payments->findWithRelationsOrFail($id));
    }

    public function removeAllocation(string $paymentId, string $allocationId): array
    {
        $this->authorize('manage', Payment::class);
        $this->paymentAllocations->removeAllocation($paymentId, $allocationId, auth()->id());

        return $this->paymentResource($this->payments->findWithRelationsOrFail($paymentId));
    }

    public function refund(string $id, array $data): array
    {
        $this->authorize('manage', Payment::class);
        $this->paymentAllocations->refund($id, $data, auth()->id());

        return $this->paymentResource($this->payments->findWithRelationsOrFail($id));
    }

    public function link(string $id, array $data): array
    {
        $this->authorize('manage', Payment::class);
        $this->paymentAllocations->link($id, $this->normalizeKeys($data));

        return $this->paymentResource($this->payments->findWithRelationsOrFail($id));
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
            'receipt_type' => 'customer',
            'matched_at' => now(),
        ];
    }

    private function normalizePayload(array $data): array
    {
        $data = $this->normalizeKeys($data);
        $transactionAt = $data['transaction_at'] ?? null;

        if ($transactionAt) {
            $parsedTransactionAt = Carbon::parse($transactionAt);
            $data['transaction_at'] = $parsedTransactionAt->format('Y-m-d H:i:s');
            $data['transaction_date'] = $data['transaction_date'] ?? $parsedTransactionAt->toDateString();
        } elseif (! empty($data['transaction_date'])) {
            $data['transaction_at'] = Carbon::parse($data['transaction_date'])
                ->startOfDay()
                ->format('Y-m-d H:i:s');
        }

        $data['transaction_date'] = $data['transaction_date'] ?? now()->toDateString();

        foreach (['quotation_id', 'lead_id', 'customer_id', 'project_id', 'contract_id'] as $key) {
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
            'transactionDate' => 'transaction_at',
            'transactionAt' => 'transaction_at',
            'bankAccount' => 'bank_account',
            'senderName' => 'sender_name',
            'transactionContent' => 'transaction_content',
            'customerCodeText' => 'customer_code_text',
            'reconciledStatus' => 'reconciled_status',
            'receiptType' => 'receipt_type',
            'dateFrom' => 'date_from',
            'dateTo' => 'date_to',
            'groupByQuotation' => 'group_by_quotation',
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

        if (empty($data['sender_name'])) {
            $description = trim((string) ($data['description'] ?? ''));
            $content = trim((string) ($data['transaction_content'] ?? ''));

            if (
                $description !== ''
                && QuotationReference::compact($description) !== QuotationReference::compact($content)
            ) {
                $data['sender_name'] = $description;
            }
        }

        return $data;
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
        $payment = $payment->refresh()->load([
            'quotation',
            'lead',
            'customer',
            'project',
            'contract',
            'allocations.quotation.customer',
            'allocations.quotation.project',
            'refunds',
        ]);
        $this->paymentAllocations->appendCollectionContext(new Collection([$payment]));

        return $this->apiResource($payment, PaymentResource::class);
    }
}

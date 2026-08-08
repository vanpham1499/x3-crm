<?php

namespace App\Services;

use App\Http\Resources\PaymentRefundResource;
use App\Http\Resources\PaymentResource;
use App\Models\Payment;
use App\Models\PaymentRefund;
use App\Models\Quotation;
use App\Repositories\PaymentRefundRepository;
use App\Repositories\PaymentRepository;
use App\Support\QuotationReference;
use Carbon\Carbon;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Validation\ValidationException;

class PaymentsService extends BaseService
{
    public function __construct(
        private readonly PaymentRepository $payments,
        private readonly PaymentRefundRepository $refunds,
        private readonly QuotationsService $quotations,
        private readonly PaymentAllocationService $paymentAllocations,
        private readonly NotificationDispatchService $notifications,
        private readonly NotificationRecipientResolver $notificationRecipients,
    ) {}

    public function findAll(array $filters = [])
    {
        $payments = $this->payments->findAll(
            $this->normalizeKeys($filters),
            $this->currentUser(),
        );
        $this->paymentAllocations->appendCollectionContext($payments);

        return $this->apiCollection($payments, PaymentResource::class);
    }

    public function findPaginated(array $filters, int $perPage, int $page): array
    {
        $paginator = $this->payments->findPaginated(
            $this->normalizeKeys($filters),
            $perPage,
            $page,
            $this->currentUser(),
        );
        $this->paymentAllocations->appendCollectionContext($paginator->getCollection());

        return $this->apiPaginatedCollection($paginator, PaymentResource::class);
    }

    public function findOne(string $id): array
    {
        $payment = $this->payments->findWithRelationsOrFail($id, $this->currentUser());
        $this->paymentAllocations->appendCollectionContext(new Collection([$payment]));

        return $this->apiResource($payment, PaymentResource::class);
    }

    public function findRefundsPaginated(array $filters, int $perPage, int $page): array
    {
        $paginator = $this->refunds->findPaginated(
            $this->normalizeKeys($filters),
            $perPage,
            $page,
            $this->currentUser(),
        );

        return $this->apiPaginatedCollection($paginator, PaymentRefundResource::class);
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
            $this->syncPaymentNotifications($payment->id, true);

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
                    + (float) $current->refunds
                        ->whereIn('status', [PaymentRefund::STATUS_PENDING, PaymentRefund::STATUS_COMPLETED])
                        ->where('refund_type', PaymentRefund::TYPE_OVERPAYMENT)
                        ->sum('amount');

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

            $this->syncPaymentNotifications($payment->id);

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

            $this->notifications->resolve('payment', $payment->id, ['payment_processing_required']);
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
                $this->syncPaymentNotifications($existingPayment->id);

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
                $this->syncPaymentNotifications($payment->id, true);

                return $this->paymentResource($payment);
            }

            $payment = $this->payments->create(array_merge($data, $this->matchedPayload($quotation), [
                'receipt_type' => 'customer',
                'webhook_payload' => $rawPayload,
            ]));
            $this->paymentAllocations->autoAllocateToQuotation($payment->id, $quotation->id, auth()->id());
            $this->syncPaymentNotifications($payment->id, true);

            return $this->paymentResource($payment);
        });
    }

    public function allocate(string $id, array $data): array
    {
        $this->authorize('allocate', Payment::class);
        $this->payments->findWithRelationsOrFail($id, $this->currentUser());
        $this->authorizeAllocationTargets($data['allocations'] ?? []);
        $this->paymentAllocations->allocate($id, $data['allocations'] ?? [], auth()->id());
        $this->syncPaymentNotifications($id);

        return $this->paymentResource($this->payments->findWithRelationsOrFail($id));
    }

    public function removeAllocation(string $paymentId, string $allocationId): array
    {
        $this->authorize('allocate', Payment::class);
        $this->payments->findWithRelationsOrFail($paymentId, $this->currentUser());
        $this->paymentAllocations->removeAllocation($paymentId, $allocationId, auth()->id());
        $this->syncPaymentNotifications($paymentId);

        return $this->paymentResource($this->payments->findWithRelationsOrFail($paymentId));
    }

    public function refund(string $id, array $data): array
    {
        $this->authorize('createRefund', Payment::class);
        $this->payments->findWithRelationsOrFail($id, $this->currentUser());
        $refund = $this->paymentAllocations->refund($id, $data, auth()->id());
        $this->syncRefundNotifications($refund);
        $this->syncPaymentNotifications($id);

        return $this->paymentResource($this->payments->findWithRelationsOrFail($id));
    }

    public function updateRefund(string $id, array $data): array
    {
        $this->authorize('manage', Payment::class);
        $refund = $this->paymentAllocations->updateRefund($id, $data, auth()->id());
        $this->syncRefundNotifications($refund);
        $this->syncPaymentNotifications($refund->payment_id);

        return $this->apiResource($refund, PaymentRefundResource::class);
    }

    public function removeRefund(string $id): array
    {
        $this->authorize('manage', Payment::class);
        $refund = PaymentRefund::query()->findOrFail($id);
        $this->paymentAllocations->removeRefund($id, auth()->id());
        $this->notifications->resolve('payment_refund', $refund->id, ['payment_refund_processing_required']);
        $this->syncPaymentNotifications($refund->payment_id);

        return ['message' => 'Đã xóa khoản hoàn và tính lại công nợ'];
    }

    public function updateInvoice(string $id, array $data): array
    {
        $this->authorize('manage', Payment::class);
        $invoiceNumber = trim((string) ($data['invoiceNumber'] ?? ''));

        $this->payments->update($id, [
            'output_invoice_number' => $invoiceNumber !== '' ? $invoiceNumber : null,
        ]);

        return $this->paymentResource($this->payments->findWithRelationsOrFail($id));
    }

    private function syncPaymentNotifications(string|int $paymentId, bool $isNewReceipt = false): void
    {
        $payment = Payment::query()->with([
            'project',
            'customer',
            'lead',
            'allocations.quotation.project',
            'allocations.quotation.customer',
            'allocations.quotation.lead',
        ])->findOrFail($paymentId);

        if (($payment->receipt_type ?? 'customer') !== 'customer') {
            $this->notifications->resolve('payment', $payment->id, ['payment_processing_required']);

            return;
        }

        $requiresProcessing = $payment->reconciled_status === 'unmatched'
            || (float) $payment->excess_amount > 0.01;

        if ($requiresProcessing) {
            $this->notifications->send($this->notificationRecipients->paymentManagers(), [
                'module' => 'payment',
                'event_key' => 'payment_processing_required',
                'title' => 'Có khoản thu đang chờ xử lý',
                'message' => $this->paymentMessage($payment),
                'kind' => 'action',
                'severity' => 'warning',
                'entity_type' => 'payment',
                'entity_id' => $payment->id,
                'action_url' => '/payments',
                'dedupe_key' => 'payment_processing_required:'.$payment->id,
                'reopen_resolved' => true,
            ]);
        } else {
            $this->notifications->resolve('payment', $payment->id, ['payment_processing_required']);
        }

        $relatedRecipients = $this->notificationRecipients->usersWithPermission(
            $this->paymentRecipientIds($payment),
            'payment.view',
        );
        $hasAllocation = $payment->allocations->isNotEmpty();

        if (! $hasAllocation && ! ($isNewReceipt && ! $requiresProcessing)) {
            return;
        }

        $recipients = $relatedRecipients;

        if ($isNewReceipt && ! $requiresProcessing) {
            $recipients = $recipients
                ->concat($this->notificationRecipients->paymentManagers())
                ->unique('id')
                ->values();
        }

        $this->notifications->send($recipients, [
            'module' => 'payment',
            'event_key' => 'payment_received',
            'title' => 'Đã nhận thanh toán từ khách hàng',
            'message' => $this->paymentMessage($payment),
            'severity' => 'success',
            'entity_type' => 'payment',
            'entity_id' => $payment->id,
            'action_url' => '/payments',
            'dedupe_key' => 'payment_received:'.$payment->id,
        ]);
    }

    private function syncRefundNotifications(PaymentRefund $refund): void
    {
        $refund = $refund->refresh()->load([
            'payment.project',
            'payment.customer',
            'payment.lead',
            'payment.allocations.quotation.project',
            'payment.allocations.quotation.customer',
            'payment.allocations.quotation.lead',
            'project',
            'customer',
            'quotation',
        ]);
        $this->notifications->resolve('payment_refund', $refund->id, ['payment_refund_processing_required']);

        if ($refund->status === PaymentRefund::STATUS_PENDING) {
            $this->notifications->send($this->notificationRecipients->paymentManagers(), [
                'module' => 'payment',
                'event_key' => 'payment_refund_processing_required',
                'title' => $refund->refund_type === PaymentRefund::TYPE_COMPENSATION
                    ? 'Có khoản bù thêm đang chờ xử lý'
                    : 'Có khoản trả khách đang chờ xử lý',
                'message' => $this->refundMessage($refund),
                'kind' => 'action',
                'severity' => 'warning',
                'entity_type' => 'payment_refund',
                'entity_id' => $refund->id,
                'action_url' => '/payments?tab=refunds',
                'dedupe_key' => 'payment_refund_processing_required:'.$refund->id,
                'reopen_resolved' => true,
            ]);

            return;
        }

        $payment = $refund->payment;
        $recipientIds = $this->paymentRecipientIds($payment)
            ->push($refund->created_by)
            ->push($refund->project?->manager_user_id)
            ->filter()
            ->unique()
            ->values();
        $recipients = $this->notificationRecipients->usersWithPermission($recipientIds, 'payment.view');
        $isCompleted = $refund->status === PaymentRefund::STATUS_COMPLETED;
        $isCompensation = $refund->refund_type === PaymentRefund::TYPE_COMPENSATION;

        $this->notifications->send($recipients, [
            'module' => 'payment',
            'event_key' => $isCompleted ? 'payment_refund_completed' : 'payment_refund_cancelled',
            'title' => $isCompleted
                ? ($isCompensation ? 'Khoản bù thêm đã hoàn tất' : 'Khoản trả khách đã hoàn tất')
                : 'Khoản trả khách đã được hủy',
            'message' => $this->refundMessage($refund),
            'severity' => $isCompleted ? 'success' : 'info',
            'entity_type' => 'payment_refund',
            'entity_id' => $refund->id,
            'action_url' => '/payments?tab=refunds',
            'dedupe_key' => ($isCompleted ? 'payment_refund_completed:' : 'payment_refund_cancelled:').$refund->id,
        ]);
    }

    private function paymentRecipientIds(Payment $payment): \Illuminate\Support\Collection
    {
        $ids = collect([
            $payment->project?->manager_user_id,
        ]);

        foreach ($payment->allocations as $allocation) {
            $quotation = $allocation->quotation;
            $ids->push(
                $quotation?->project?->manager_user_id,
            );
        }

        return $ids->filter()->map(fn ($id): int => (int) $id)->unique()->values();
    }

    private function paymentMessage(Payment $payment): string
    {
        $projectNames = $payment->allocations
            ->map(fn ($allocation) => $allocation->quotation?->project?->project_name)
            ->push($payment->project?->project_name)
            ->filter()
            ->unique()
            ->implode(', ');

        return implode(' · ', array_filter([
            number_format((float) $payment->amount, 0, ',', '.').' đ',
            $projectNames ?: $payment->customer?->customer_name,
            $payment->sender_name,
        ]));
    }

    private function refundMessage(PaymentRefund $refund): string
    {
        return implode(' · ', array_filter([
            number_format((float) $refund->amount, 0, ',', '.').' đ',
            $refund->project?->project_name ?: $refund->customer?->customer_name,
            $refund->reason,
        ]));
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

    private function authorizeAllocationTargets(array $entries): void
    {
        $user = $this->currentUser();
        $quotationIds = collect($entries)
            ->map(fn (array $entry): int => (int) ($entry['quotation_id'] ?? $entry['quotationId'] ?? 0))
            ->filter()
            ->unique();

        foreach ($quotationIds as $quotationId) {
            $quotation = $this->quotations
                ->findModel((string) $quotationId)
                ->loadMissing('project.managerUser');

            if (
                $user
                && (
                    $user->hasPermission('payment.view_all')
                    || $user->hasPermission('payment.manage')
                    || (int) $quotation->project?->manager_user_id === (int) $user->id
                    || (
                        $user->hasPermission('payment.view_department')
                        && $user->canAccessDepartment($quotation->project?->managerUser?->department_id)
                    )
                )
            ) {
                continue;
            }

            throw new AuthorizationException(
                'Bạn chỉ được phân bổ khoản thu vào báo phí thuộc dự án mình quản lý.',
            );
        }
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
            'refundType' => 'refund_type',
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

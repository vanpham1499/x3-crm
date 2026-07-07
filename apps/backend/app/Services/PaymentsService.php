<?php

namespace App\Services;

use App\Http\Resources\PaymentResource;
use App\Models\Payment;
use App\Models\Quotation;
use App\Repositories\PaymentRepository;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

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
            /** @var Payment $payment */
            $payment = $this->payments->create($this->normalizePayload($data));

            return $this->apiResource($payment->load(['quotation', 'lead', 'customer', 'project', 'contract', 'revenue']), PaymentResource::class);
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            /** @var Payment $payment */
            $payment = $this->payments->update($id, $this->normalizePayload($data));

            return $this->apiResource($payment->load(['quotation', 'lead', 'customer', 'project', 'contract', 'revenue']), PaymentResource::class);
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            $this->payments->delete($id);

            return ['message' => 'Xóa thanh toán thành công'];
        });
    }

    public function webhook(array $data): array
    {
        return $this->transaction(function () use ($data): array {
            $data = $this->normalizePayload($data);
            $content = (string) ($data['transaction_content'] ?? '');
            $quotation = $this->quotations->findCodeInText($content);

            if (! $quotation) {
                $payment = $this->payments->create(array_merge($data, [
                    'status' => 'unmatched',
                    'reconciled_status' => 'unmatched',
                    'webhook_payload' => $data['payload'] ?? $data,
                ]));

                return $this->apiResource($payment->load(['quotation', 'lead', 'customer', 'project', 'contract', 'revenue']), PaymentResource::class);
            }

            $payment = $this->payments->create(array_merge($data, $this->matchedPayload($quotation), [
                'webhook_payload' => $data['payload'] ?? $data,
            ]));

            return $this->apiResource($payment->load(['quotation', 'lead', 'customer', 'project', 'contract', 'revenue']), PaymentResource::class);
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

            return $this->apiResource($updated->load(['quotation', 'lead', 'customer', 'project', 'contract', 'revenue']), PaymentResource::class);
        });
    }

    private function matchedPayload(Quotation $quotation): array
    {
        $hasProject = $quotation->project_id && $quotation->contract_id;

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

        return $data;
    }
}

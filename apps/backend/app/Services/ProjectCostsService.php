<?php

namespace App\Services;

use App\Http\Resources\ProjectCostResource;
use App\Models\ProjectCost;
use App\Repositories\ProjectCostRepository;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProjectCostsService extends BaseService
{
    public function __construct(private readonly ProjectCostRepository $costs) {}

    public function findAll(array $filters = [])
    {
        return $this->apiCollection($this->costs->findAll($this->normalizeKeys($filters)), ProjectCostResource::class);
    }

    public function findOne(string $id): array
    {
        return $this->apiResource($this->costs->findWithRelationsOrFail($id), ProjectCostResource::class);
    }

    public function create(array $data): array
    {
        return $this->transaction(function () use ($data): array {
            $data = $this->preparePayload($data);
            /** @var ProjectCost $cost */
            $cost = $this->costs->create($data);

            return $this->apiResource($this->costs->findWithRelationsOrFail((string) $cost->id), ProjectCostResource::class);
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            /** @var ProjectCost $existing */
            $existing = $this->costs->findOrFail($id);
            $data = $this->preparePayload($data, $existing);
            $this->costs->update($id, $data);

            return $this->apiResource($this->costs->findWithRelationsOrFail($id), ProjectCostResource::class);
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            $this->costs->delete($id);

            return ['message' => 'Xóa chi phí dự án thành công'];
        });
    }

    /**
     * Merges submitted fields onto the record's current values (when updating) before
     * recalculating derived amounts, so a partial PATCH cannot silently reset fields that
     * were not part of the request (status, VAT/total amounts, acceptance/invoice status).
     */
    private function preparePayload(array $data, ?ProjectCost $existing = null): array
    {
        $data = $this->normalizeKeys($data);

        foreach (['quotation_id', 'bank_account_option_id', 'partner_option_id'] as $key) {
            if (array_key_exists($key, $data) && $data[$key] === '') {
                $data[$key] = null;
            }
        }

        $mergeableFields = [
            'project_id', 'quotation_id', 'entry_type', 'transaction_date', 'cid', 'ad_account',
            'bank_account_option_id', 'partner_option_id', 'amount_before_vat', 'vat_rate',
            'discount_amount', 'status', 'acceptance_status', 'input_invoice_status', 'note',
        ];

        $base = [];

        if ($existing) {
            foreach ($mergeableFields as $field) {
                $base[$field] = $existing->{$field};
            }
        }

        $data = array_merge($base, $data);

        $data['status'] = $data['status'] ?? ProjectCost::STATUS_PENDING;
        $amountBeforeVat = (float) ($data['amount_before_vat'] ?? 0);
        $vatRate = (float) ($data['vat_rate'] ?? 0);
        $discountAmount = (float) ($data['discount_amount'] ?? 0);
        $data['vat_amount'] = round($amountBeforeVat * $vatRate / 100, 2);
        $data['total_amount'] = round(max(0, $amountBeforeVat + $data['vat_amount'] - $discountAmount), 2);

        if (($data['entry_type'] ?? null) === ProjectCost::TYPE_AD_SPEND) {
            $data['partner_option_id'] = null;
            $data['discount_amount'] = 0;
            $data['acceptance_status'] = null;
            $data['input_invoice_status'] = null;
            $data['total_amount'] = round($amountBeforeVat + $data['vat_amount'], 2);
        } else {
            $data['cid'] = null;
            $data['ad_account'] = null;
            $data['acceptance_status'] = $data['acceptance_status'] ?? 'pending';
            $data['input_invoice_status'] = $data['input_invoice_status'] ?? 'pending';
        }

        $this->validateQuotationProject($data);

        return $data;
    }

    private function normalizeKeys(array $data): array
    {
        $map = [
            'projectId' => 'project_id',
            'quotationId' => 'quotation_id',
            'entryType' => 'entry_type',
            'transactionDate' => 'transaction_date',
            'adAccount' => 'ad_account',
            'bankAccountOptionId' => 'bank_account_option_id',
            'partnerOptionId' => 'partner_option_id',
            'amountBeforeVat' => 'amount_before_vat',
            'vatRate' => 'vat_rate',
            'vatAmount' => 'vat_amount',
            'discountAmount' => 'discount_amount',
            'totalAmount' => 'total_amount',
            'acceptanceStatus' => 'acceptance_status',
            'inputInvoiceStatus' => 'input_invoice_status',
        ];

        foreach ($map as $from => $to) {
            if (array_key_exists($from, $data)) {
                $data[$to] = $data[$from];
                unset($data[$from]);
            }
        }

        return $data;
    }

    private function validateQuotationProject(array $data): void
    {
        if (empty($data['quotation_id'])) {
            return;
        }

        $quotationProjectId = DB::table('quotations')
            ->where('id', $data['quotation_id'])
            ->whereNull('deleted_at')
            ->value('project_id');

        if ($quotationProjectId && (string) $quotationProjectId !== (string) $data['project_id']) {
            throw ValidationException::withMessages([
                'quotationId' => ['Báo phí không thuộc dự án này.'],
            ]);
        }
    }
}

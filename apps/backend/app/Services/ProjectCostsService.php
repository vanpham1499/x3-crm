<?php

namespace App\Services;

use App\Http\Resources\ProjectCostResource;
use App\Models\ProjectCost;
use App\Models\ProjectCostAdjustment;
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

    public function findPaginated(array $filters, int $perPage, int $page): array
    {
        return $this->apiPaginatedCollection(
            $this->costs->findPaginated($this->normalizeKeys($filters), $perPage, $page),
            ProjectCostResource::class,
        );
    }

    public function findOne(string $id): array
    {
        return $this->apiResource($this->costs->findWithRelationsOrFail($id), ProjectCostResource::class);
    }

    public function create(array $data): array
    {
        return $this->transaction(function () use ($data): array {
            $data = $this->preparePayload($data);
            $this->authorizeProjectOwnership($data['project_id'] ?? null);
            /** @var ProjectCost $cost */
            $cost = $this->costs->create($data);

            return $this->apiResource($this->costs->findWithRelationsOrFail((string) $cost->id), ProjectCostResource::class);
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            /** @var ProjectCost $existing */
            $existing = $this->costs->findForUpdateOrFail($id);
            $this->authorizeProjectOwnership($existing->project_id);
            $this->ensureNotReconciled($existing);
            $data = $this->preparePayload($data, $existing);
            $this->costs->update($id, $data);

            return $this->apiResource($this->costs->findWithRelationsOrFail($id), ProjectCostResource::class);
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            $cost = $this->costs->findForUpdateOrFail($id);
            $this->authorizeProjectOwnership($cost->project_id);
            $this->ensureNotReconciled($cost);
            $this->costs->delete($id);

            return ['message' => 'Xóa chi phí dự án thành công'];
        });
    }

    public function reconcile(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            $this->authorizeAccounting();
            $cost = $this->costs->findForUpdateOrFail($id);
            $cost->load('adjustments');
            $data = $this->normalizeKeys($data);
            $adjustments = $data['adjustments'] ?? [];

            $this->validateAdjustmentBalance($cost, $adjustments);

            $result = $data['reconciliation_result'] ?? ProjectCost::RECONCILIATION_MATCHED;
            $isFinalReconciliation = in_array($result, [
                ProjectCost::RECONCILIATION_MATCHED,
                ProjectCost::RECONCILIATION_MATCHED_WITH_NOTE,
                ProjectCost::RECONCILIATION_DIFFERENCE,
            ], true);

            $updates = [
                'status' => $result === ProjectCost::RECONCILIATION_CANCELLED
                    ? ProjectCost::STATUS_CANCELLED
                    : ProjectCost::STATUS_COMPLETED,
                'invoice_number' => trim((string) ($data['invoice_number'] ?? '')) ?: null,
                'reconciliation_result' => $result,
                'invoice_status' => $data['invoice_status'] ?? ProjectCost::INVOICE_STATUS_PENDING,
                'invoice_recipient_type' => $data['invoice_recipient_type'] ?? ProjectCost::INVOICE_RECIPIENT_CUSTOMER,
                'invoice_recipient_name' => trim((string) ($data['invoice_recipient_name'] ?? '')) ?: null,
                'reconciliation_note' => trim((string) ($data['reconciliation_note'] ?? '')) ?: null,
            ];

            if ($isFinalReconciliation) {
                $updates = array_merge($updates, [
                    'reconciled_at' => $cost->reconciled_at ?: now(),
                    'reconciled_by' => $cost->reconciled_by ?: auth()->id(),
                ]);
            } else {
                $updates['reconciled_at'] = null;
                $updates['reconciled_by'] = null;
            }

            $this->costs->update($id, $updates);
            $this->syncAdjustments($cost, $adjustments);

            return $this->apiResource(
                $this->costs->findWithRelationsOrFail($id),
                ProjectCostResource::class,
            );
        });
    }

    /**
     * Merges submitted fields onto the record's current values (when updating) before
     * recalculating derived amounts, then normalizes fields according to each cost type.
     * Partner costs intentionally keep only partner, amount, date, status and note data.
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
            'cid_is_dead', 'cid_spent_amount',
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
            $data['vat_rate'] = 0;
            $data['vat_amount'] = 0;
            $data['discount_amount'] = 0;
            $data['acceptance_status'] = null;
            $data['input_invoice_status'] = null;
            $data['cid_is_dead'] = (bool) ($data['cid_is_dead'] ?? false);
            $data['cid_spent_amount'] = $data['cid_is_dead']
                ? round(max(0, (float) ($data['cid_spent_amount'] ?? 0)), 2)
                : 0;
            $data['total_amount'] = round($amountBeforeVat, 2);
        } else {
            $data['quotation_id'] = null;
            $data['bank_account_option_id'] = null;
            $data['cid'] = null;
            $data['ad_account'] = null;
            $data['cid_is_dead'] = false;
            $data['cid_spent_amount'] = 0;
            $data['vat_rate'] = 0;
            $data['vat_amount'] = 0;
            $data['discount_amount'] = 0;
            $data['total_amount'] = round($amountBeforeVat, 2);
            $data['acceptance_status'] = null;
            $data['input_invoice_status'] = null;
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
            'cidIsDead' => 'cid_is_dead',
            'cidSpentAmount' => 'cid_spent_amount',
            'bankAccountOptionId' => 'bank_account_option_id',
            'partnerOptionId' => 'partner_option_id',
            'amountBeforeVat' => 'amount_before_vat',
            'vatRate' => 'vat_rate',
            'vatAmount' => 'vat_amount',
            'discountAmount' => 'discount_amount',
            'totalAmount' => 'total_amount',
            'acceptanceStatus' => 'acceptance_status',
            'inputInvoiceStatus' => 'input_invoice_status',
            'dateFrom' => 'date_from',
            'dateTo' => 'date_to',
            'groupByProject' => 'group_by_project',
            'reconciledStatus' => 'reconciled_status',
            'reconciliationResult' => 'reconciliation_result',
            'invoiceStatus' => 'invoice_status',
            'invoiceRecipientType' => 'invoice_recipient_type',
            'invoiceRecipientName' => 'invoice_recipient_name',
            'reconciliationNote' => 'reconciliation_note',
            'balanceStatus' => 'balance_status',
            'adjustmentType' => 'adjustment_type',
        ];

        foreach ($map as $from => $to) {
            if (array_key_exists($from, $data)) {
                $data[$to] = $data[$from];
                unset($data[$from]);
            }
        }

        return $data;
    }

    private function ensureNotReconciled(ProjectCost $cost): void
    {
        if (! $cost->reconciled_at) {
            return;
        }

        throw ValidationException::withMessages([
            'cost' => ['Khoản chi đã được đối soát nên không thể chỉnh sửa hoặc xóa.'],
        ]);
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

    private function syncAdjustments(ProjectCost $cost, array $adjustments): void
    {
        $cost->adjustments()->delete();

        foreach ($adjustments as $adjustment) {
            $cost->adjustments()->create([
                'adjustment_type' => $adjustment['adjustment_type'] ?? $adjustment['adjustmentType'] ?? ProjectCostAdjustment::TYPE_OTHER,
                'status' => $adjustment['status'] ?? ProjectCostAdjustment::STATUS_COMPLETED,
                'amount' => round(max(0, (float) ($adjustment['amount'] ?? 0)), 2),
                'reference' => trim((string) ($adjustment['reference'] ?? '')) ?: null,
                'note' => trim((string) ($adjustment['note'] ?? '')) ?: null,
            ]);
        }
    }

    private function validateAdjustmentBalance(ProjectCost $cost, array $adjustments): void
    {
        $plannedBalanceHandling = collect($adjustments)
            ->filter(fn ($adjustment) => in_array(
                $adjustment['adjustment_type'] ?? $adjustment['adjustmentType'] ?? null,
                ProjectCostAdjustment::BALANCE_HANDLING_TYPES,
                true,
            ))
            ->filter(fn ($adjustment) => ($adjustment['status'] ?? ProjectCostAdjustment::STATUS_COMPLETED) !== ProjectCostAdjustment::STATUS_CANCELLED)
            ->sum(fn ($adjustment) => (float) ($adjustment['amount'] ?? 0));

        if ($plannedBalanceHandling <= $cost->originalBalanceAmount() + 0.01) {
            return;
        }

        throw ValidationException::withMessages([
            'adjustments' => ['Số tiền xử lý số dư không được vượt quá số dư còn lại của lần nạp.'],
        ]);
    }
}

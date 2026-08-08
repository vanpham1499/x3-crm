<?php

namespace App\Services;

use App\Http\Resources\ProjectCostResource;
use App\Models\Project;
use App\Models\ProjectCost;
use App\Models\ProjectCostAdjustment;
use App\Models\ProjectCostCidIncident;
use App\Models\User;
use App\Repositories\ProjectCostRepository;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProjectCostsService extends BaseService
{
    public function __construct(
        private readonly ProjectCostRepository $costs,
        private readonly NotificationDispatchService $notifications,
        private readonly NotificationRecipientResolver $notificationRecipients,
    ) {}

    public function findAll(array $filters = [])
    {
        $filters = $this->normalizeKeys($filters);
        $user = auth()->user();

        if (! $user) {
            throw new AuthorizationException;
        }

        if (($filters['context'] ?? null) === 'project_finance' && ! empty($filters['project_id'])) {
            $project = Project::query()->findOrFail($filters['project_id']);
            $this->authorize('view', $project);

            return $this->apiCollection($this->costs->findAll($filters), ProjectCostResource::class);
        }

        $this->ensureCanOpenCostPage($user);

        return $this->apiCollection($this->costs->findAll($filters, $user), ProjectCostResource::class);
    }

    public function findPaginated(array $filters, int $perPage, int $page): array
    {
        $user = auth()->user();

        if (! $user) {
            throw new AuthorizationException;
        }

        $this->ensureCanOpenCostPage($user);

        return $this->apiPaginatedCollection(
            $this->costs->findPaginated($this->normalizeKeys($filters), $perPage, $page, $user),
            ProjectCostResource::class,
        );
    }

    public function findOne(string $id): array
    {
        $cost = $this->costs->findWithRelationsOrFail($id);
        $this->authorize('view', $cost);

        return $this->apiResource($cost, ProjectCostResource::class);
    }

    public function create(array $data): array
    {
        return $this->transaction(function () use ($data): array {
            $data = $this->preparePayload($data);
            $data['status'] = ProjectCost::STATUS_PENDING;
            $project = Project::query()->findOrFail($data['project_id']);
            $this->authorize('manageProject', [ProjectCost::class, $project]);
            /** @var ProjectCost $cost */
            $cost = $this->costs->create($data);
            $cost = $this->costs->findWithRelationsOrFail((string) $cost->id);
            $this->notifyCostWorkflow($cost);

            return $this->apiResource($cost, ProjectCostResource::class);
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            /** @var ProjectCost $existing */
            $existing = $this->costs->findForUpdateOrFail($id);
            $existing->load('project.managerUser', 'project.salesUser');
            $this->ensureNotReconciled($existing);
            $normalized = $this->normalizeKeys($data);
            $hasStatus = array_key_exists('status', $normalized);
            $statusChanged = $hasStatus && $normalized['status'] !== $existing->status;
            $businessFields = array_diff(array_keys($normalized), ['status']);

            if ($businessFields !== []) {
                $this->authorize('manage', $existing);

                if (
                    $existing->status !== ProjectCost::STATUS_PENDING
                    && ! auth()->user()?->can('fund', $existing)
                ) {
                    throw ValidationException::withMessages([
                        'cost' => ['Chỉ Lead được sửa khoản chi sau khi đã xác nhận nạp/chi.'],
                    ]);
                }
            }

            if ($statusChanged) {
                $this->authorize('fund', $existing);
            } elseif ($businessFields === []) {
                $this->authorize('manage', $existing);
            }

            $data = $this->preparePayload($normalized, $existing);

            if ((string) $data['project_id'] !== (string) $existing->project_id) {
                $project = Project::query()->findOrFail($data['project_id']);
                $this->authorize('manageProject', [ProjectCost::class, $project]);
            }

            $this->costs->update($id, $data);
            $cost = $this->costs->findWithRelationsOrFail($id);
            $this->notifyCostWorkflow($cost);

            return $this->apiResource($cost, ProjectCostResource::class);
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            $cost = $this->costs->findForUpdateOrFail($id);
            $cost->load('project.managerUser', 'project.salesUser');
            $this->authorize('fund', $cost);
            $this->ensureNotReconciled($cost);
            $this->ensurePendingForDelete($cost);
            $this->notifications->resolve('project_cost', $cost->id, [
                'cost_funding_required',
                'cost_reconciliation_required',
                'cost_reconciliation_unmatched',
            ]);
            $this->costs->delete($id);

            return ['message' => 'Xóa chi phí dự án thành công'];
        });
    }

    public function reconcile(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            $cost = $this->costs->findForUpdateOrFail($id);
            $cost->load('project.managerUser', 'project.salesUser');
            $this->authorize('approve', $cost);
            $this->ensureReadyForReconciliation($cost);
            $cost->load('adjustments');
            $data = $this->normalizeKeys($data);
            $adjustments = $data['adjustments'] ?? [];

            $this->validateAdjustmentBalance($cost, $adjustments);

            $result = $data['reconciliation_result'] ?? ProjectCost::RECONCILIATION_UNMATCHED;
            $isMatched = $result === ProjectCost::RECONCILIATION_MATCHED;
            $invoiceNumber = trim((string) ($data['invoice_number'] ?? '')) ?: null;

            $updates = [
                'invoice_number' => $invoiceNumber,
                'reconciliation_result' => $result,
                'invoice_status' => $invoiceNumber
                    ? ProjectCost::INVOICE_STATUS_RECEIVED
                    : ProjectCost::INVOICE_STATUS_PENDING,
                'invoice_recipient_type' => ProjectCost::INVOICE_RECIPIENT_COMPANY,
                'invoice_recipient_name' => null,
                'reconciliation_note' => trim((string) ($data['reconciliation_note'] ?? '')) ?: null,
                'reconciled_at' => $isMatched ? now() : null,
                'reconciled_by' => $isMatched ? auth()->id() : null,
            ];

            $this->costs->update($id, $updates);
            $this->syncAdjustments($cost, $adjustments);
            $cost = $this->costs->findWithRelationsOrFail($id);
            $this->notifications->resolve('project_cost', $cost->id, ['cost_reconciliation_required']);

            if ($isMatched) {
                $cost->loadMissing('project');
                $recipients = $this->notificationRecipients->authorizedUsers([
                    $cost->created_by,
                    $cost->project?->manager_user_id,
                    $cost->project?->sales_user_id,
                ], 'view', $cost);
                $this->notifications->send($recipients, [
                    'module' => 'cost',
                    'event_key' => 'cost_reconciled',
                    'title' => 'Chi phí đã được đối soát khớp',
                    'message' => $cost->project?->project_name,
                    'severity' => 'success',
                    'entity_type' => 'project_cost',
                    'entity_id' => $cost->id,
                    'action_url' => '/projects/'.$cost->project_id.'?tab=finance',
                    'dedupe_key' => 'cost_reconciled:'.$cost->id.':'.$cost->updated_at?->format('YmdHisu'),
                ]);
            } else {
                $cost->loadMissing('project');
                $recipients = $this->notificationRecipients->authorizedUsers([
                    $cost->created_by,
                    $cost->project?->manager_user_id,
                    $cost->project?->sales_user_id,
                ], 'view', $cost);
                $this->notifications->send($recipients, [
                    'module' => 'cost',
                    'event_key' => 'cost_reconciliation_unmatched',
                    'title' => 'Chi phí chưa khớp, cần kiểm tra lại',
                    'message' => $cost->reconciliation_note ?: $cost->project?->project_name,
                    'kind' => 'action',
                    'severity' => 'error',
                    'entity_type' => 'project_cost',
                    'entity_id' => $cost->id,
                    'action_url' => '/projects/'.$cost->project_id.'?tab=finance',
                    'dedupe_key' => 'cost_reconciliation_unmatched:'.$cost->id.':'.$cost->updated_at?->format('YmdHisu'),
                ]);
            }

            return $this->apiResource(
                $cost,
                ProjectCostResource::class,
            );
        });
    }

    private function notifyCostWorkflow(ProjectCost $cost): void
    {
        $this->notifications->resolve('project_cost', $cost->id, [
            'cost_funding_required',
            'cost_reconciliation_required',
            'cost_reconciliation_unmatched',
        ]);

        if ($cost->status === ProjectCost::STATUS_CANCELLED) {
            return;
        }

        $cost->loadMissing('project');

        if ($cost->status === ProjectCost::STATUS_PENDING) {
            $this->notifications->send($this->notificationRecipients->projectCostFunders($cost), [
                'module' => 'cost',
                'event_key' => 'cost_funding_required',
                'title' => $cost->entry_type === ProjectCost::TYPE_AD_SPEND
                    ? 'Có yêu cầu nạp ngân sách đang chờ duyệt'
                    : 'Có khoản chi đang chờ duyệt',
                'message' => $cost->project?->project_name,
                'kind' => 'action',
                'severity' => 'warning',
                'entity_type' => 'project_cost',
                'entity_id' => $cost->id,
                'action_url' => '/projects/'.$cost->project_id.'?tab=finance',
                'dedupe_key' => 'cost_funding_required:'.$cost->id.':'.$cost->updated_at?->format('YmdHisu'),
            ]);

            return;
        }

        $this->notifications->send($this->notificationRecipients->projectCostApprovers($cost), [
            'module' => 'cost',
            'event_key' => 'cost_reconciliation_required',
            'title' => 'Có chi phí đang chờ đối soát',
            'message' => $cost->project?->project_name,
            'kind' => 'action',
            'severity' => 'warning',
            'entity_type' => 'project_cost',
            'entity_id' => $cost->id,
            'action_url' => '/costs',
            'dedupe_key' => 'cost_reconciliation_required:'.$cost->id.':'.$cost->updated_at?->format('YmdHisu'),
        ]);
    }

    public function reportCidIncident(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            $cost = $this->costs->findForUpdateOrFail($id);
            $cost->load('project.managerUser', 'project.salesUser');
            $this->authorize('manage', $cost);
            $this->ensureCidIncidentEligible($cost);

            $incident = ProjectCostCidIncident::query()
                ->where('project_cost_id', $cost->id)
                ->whereIn('status', [
                    ProjectCostCidIncident::STATUS_PENDING,
                    ProjectCostCidIncident::STATUS_CONFIRMED,
                ])
                ->latest('id')
                ->lockForUpdate()
                ->first();

            if ($incident?->status === ProjectCostCidIncident::STATUS_CONFIRMED) {
                throw ValidationException::withMessages([
                    'cidIncident' => ['CID đã được kế toán xác nhận ngừng hoạt động.'],
                ]);
            }

            $stoppedAt = (string) ($data['stoppedAt'] ?? '');

            if ($cost->transaction_date && $stoppedAt < $cost->transaction_date->toDateString()) {
                throw ValidationException::withMessages([
                    'stoppedAt' => ['Ngày CID ngừng không được trước ngày nạp.'],
                ]);
            }

            $spentAmount = round(max(0, (float) ($data['spentAmount'] ?? 0)), 2);
            $unrecoverableAmount = round(max(0, (float) ($data['unrecoverableAmount'] ?? 0)), 2);
            $totalAmount = round(max(0, (float) ($cost->total_amount ?? 0)), 2);

            if ($spentAmount + $unrecoverableAmount > $totalAmount + 0.01) {
                throw ValidationException::withMessages([
                    'spentAmount' => ['Tổng tiền đã chạy và không thu hồi được không được vượt quá tiền đã nạp.'],
                ]);
            }

            $payload = [
                'project_cost_id' => $cost->id,
                'stopped_at' => $stoppedAt,
                'spent_amount' => $spentAmount,
                'unrecoverable_amount' => $unrecoverableAmount,
                'released_amount' => round(max(0, $totalAmount - $spentAmount - $unrecoverableAmount), 2),
                'status' => ProjectCostCidIncident::STATUS_PENDING,
                'note' => trim((string) ($data['note'] ?? '')) ?: null,
                'reported_by' => auth()->id(),
                'reported_at' => now(),
                'confirmed_by' => null,
                'confirmed_at' => null,
                'cancelled_by' => null,
                'cancelled_at' => null,
            ];

            if ($incident) {
                $incident->fill($payload)->save();
            } else {
                ProjectCostCidIncident::query()->create($payload);
            }

            return $this->apiResource(
                $this->costs->findWithRelationsOrFail($id),
                ProjectCostResource::class,
            );
        });
    }

    public function confirmCidIncident(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            $cost = $this->costs->findForUpdateOrFail($id);
            $cost->load('project.managerUser', 'project.salesUser');
            $this->authorize('approve', $cost);
            $incident = ProjectCostCidIncident::query()
                ->where('project_cost_id', $cost->id)
                ->where('status', ProjectCostCidIncident::STATUS_PENDING)
                ->latest('id')
                ->lockForUpdate()
                ->first();

            if (! $incident) {
                throw ValidationException::withMessages([
                    'cidIncident' => ['Không có báo cáo CID ngừng hoạt động đang chờ xác nhận.'],
                ]);
            }

            $incident->fill([
                'status' => ProjectCostCidIncident::STATUS_CONFIRMED,
                'confirmed_by' => auth()->id(),
                'confirmed_at' => now(),
            ])->save();

            return $this->apiResource(
                $this->costs->findWithRelationsOrFail($id),
                ProjectCostResource::class,
            );
        });
    }

    public function cancelCidIncident(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            $cost = $this->costs->findForUpdateOrFail($id);
            $cost->load('project.managerUser', 'project.salesUser');
            $this->authorize('manage', $cost);
            $incident = ProjectCostCidIncident::query()
                ->where('project_cost_id', $cost->id)
                ->where('status', ProjectCostCidIncident::STATUS_PENDING)
                ->latest('id')
                ->lockForUpdate()
                ->first();

            if (! $incident) {
                throw ValidationException::withMessages([
                    'cidIncident' => ['Không có báo cáo CID đang chờ để hủy.'],
                ]);
            }

            $incident->fill([
                'status' => ProjectCostCidIncident::STATUS_CANCELLED,
                'cancelled_by' => auth()->id(),
                'cancelled_at' => now(),
            ])->save();

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
            'invoiceNumber' => 'invoice_number',
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

    private function ensureReadyForReconciliation(ProjectCost $cost): void
    {
        if ($cost->status === ProjectCost::STATUS_COMPLETED) {
            return;
        }

        throw ValidationException::withMessages([
            'cost' => ['Lead phải xác nhận khoản ngân sách đã nạp/đã chi trước khi kế toán đối soát.'],
        ]);
    }

    private function ensurePendingForDelete(ProjectCost $cost): void
    {
        if ($cost->status === ProjectCost::STATUS_PENDING) {
            return;
        }

        throw ValidationException::withMessages([
            'cost' => ['Chỉ có thể xóa yêu cầu còn chờ; khoản đã nạp/đã chi phải chuyển sang Đã hủy.'],
        ]);
    }

    private function ensureCanOpenCostPage(User $user): void
    {
        if (
            $user->hasPermission('cost.view')
            || $user->hasPermission('cost.view_department')
            || $user->hasPermission('cost.view_all')
        ) {
            return;
        }

        throw new AuthorizationException('Bạn không có quyền mở trang Chi phí.');
    }

    private function ensureCidIncidentEligible(ProjectCost $cost): void
    {
        if ($cost->entry_type !== ProjectCost::TYPE_AD_SPEND) {
            throw ValidationException::withMessages([
                'cidIncident' => ['Chỉ khoản nạp quảng cáo mới có thể báo CID ngừng hoạt động.'],
            ]);
        }

        if (! $cost->reconciled_at) {
            throw ValidationException::withMessages([
                'cidIncident' => ['Khoản nạp chưa đối soát, hãy cập nhật CID trực tiếp trong lần nạp.'],
            ]);
        }

        if ($cost->cid_is_dead) {
            throw ValidationException::withMessages([
                'cidIncident' => ['CID đã được ghi nhận ngừng trước khi đối soát.'],
            ]);
        }

        if ($cost->status === ProjectCost::STATUS_CANCELLED) {
            throw ValidationException::withMessages([
                'cidIncident' => ['Không thể báo CID ngừng cho khoản nạp đã hủy.'],
            ]);
        }
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

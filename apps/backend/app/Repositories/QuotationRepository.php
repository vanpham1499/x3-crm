<?php

namespace App\Repositories;

use App\Models\PaymentAllocation;
use App\Models\PaymentRefund;
use App\Models\Quotation;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class QuotationRepository extends BaseRepository
{
    protected string $notFoundMessage = 'Quotation không tồn tại';

    protected function model(): string
    {
        return Quotation::class;
    }

    public function findAll(array $filters = [], ?User $user = null): Collection
    {
        return $this->filteredQuery($filters, $user)->get();
    }

    public function findPaginated(array $filters, int $perPage, int $page, ?User $user = null): LengthAwarePaginator
    {
        return $this->filteredQuery($filters, $user)
            ->paginate($perPage, ['*'], 'page', $page);
    }

    private function filteredQuery(array $filters, ?User $user = null): Builder
    {
        $keyword = trim((string) ($filters['keyword'] ?? $filters['search'] ?? ''));
        $dateFrom = $filters['date_from'] ?? null;
        $dateTo = $filters['date_to'] ?? null;

        $query = $this->query()
            ->with($this->relations());

        $this->applyViewScope($query, $user);
        $allocationOpen = filter_var($filters['allocation_open'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $status = (string) ($filters['status'] ?? '');

        if ($status === 'voided') {
            $query->withoutGlobalScope('effective')->whereNotNull('quotations.voided_at');
            if ($allocationOpen) {
                $query->whereRaw('1 = 0');
            }
        } elseif ($status !== '' || $allocationOpen) {
            $this->applyStatusFilter($query, $status !== '' ? $status : Quotation::STATUS_DRAFT);
        }

        if ($allocationOpen && $status !== '' && $status !== Quotation::STATUS_DRAFT) {
            $query->whereRaw('1 = 0');
        }

        return $query
            ->when($keyword !== '', fn ($query) => $query->where(function ($query) use ($keyword): void {
                $query
                    ->where('quotation_code', 'ilike', "%{$keyword}%")
                    ->orWhere('service_code', 'ilike', "%{$keyword}%")
                    ->orWhere('service_name', 'ilike', "%{$keyword}%")
                    ->orWhere('note', 'ilike', "%{$keyword}%")
                    ->orWhereHas('lead', fn ($relation) => $relation
                        ->where('lead_code', 'ilike', "%{$keyword}%")
                        ->orWhere('customer_name', 'ilike', "%{$keyword}%"))
                    ->orWhereHas('customer', fn ($relation) => $relation
                        ->where('customer_code', 'ilike', "%{$keyword}%")
                        ->orWhere('customer_name', 'ilike', "%{$keyword}%"))
                    ->orWhereHas('project', fn ($relation) => $relation
                        ->where('project_code', 'ilike', "%{$keyword}%")
                        ->orWhere('project_name', 'ilike', "%{$keyword}%"));
            }))
            ->when($filters['lead_id'] ?? null, fn ($query, $value) => $query->where('lead_id', $value))
            ->when($filters['customer_id'] ?? null, fn ($query, $value) => $query->where('customer_id', $value))
            ->when($filters['project_id'] ?? null, fn ($query, $value) => $query->where('project_id', $value))
            ->when($filters['contract_id'] ?? null, fn ($query, $value) => $query->where('contract_id', $value))
            ->when($filters['service_id'] ?? null, fn ($query, $value) => $query->where('service_id', $value))
            ->when($filters['created_by'] ?? null, fn ($query, $value) => $query->where('created_by', $value))
            ->when($dateFrom, fn ($query) => $query->whereDate('quotations.created_at', '>=', $dateFrom))
            ->when($dateTo, fn ($query) => $query->whereDate('quotations.created_at', '<=', $dateTo))
            ->when($allocationOpen, fn ($query) => $query
                ->whereNotNull('project_id')
                ->whereRaw('ROUND(COALESCE(total_amount, 0)) > 0'))
            ->orderByDesc('created_at');
    }

    /**
     * SQL equivalent of the status displayed by QuotationResource. The stored
     * status can predate a payment/refund or the VND rounding rules. Filter the
     * ledger before pagination/counting rather than hiding rows in the browser.
     */
    private function applyStatusFilter(Builder $query, string $status): void
    {
        if (! in_array($status, [Quotation::STATUS_DRAFT, Quotation::STATUS_WON, Quotation::STATUS_REFUNDED], true)) {
            $query->whereRaw('1 = 0');

            return;
        }

        // Aggregate separately: joining allocations directly to refunds would
        // multiply both sums when a quotation has more than one of each.
        $allocations = PaymentAllocation::query()
            ->select('quotation_id')
            ->selectRaw('ROUND(COALESCE(SUM(amount), 0)) AS gross_paid_amount')
            ->groupBy('quotation_id');
        $refunds = PaymentRefund::query()
            ->select('quotation_id')
            ->where('status', PaymentRefund::STATUS_COMPLETED)
            ->whereIn('refund_type', [PaymentRefund::TYPE_DEPOSIT, PaymentRefund::TYPE_PAYMENT])
            ->selectRaw('ROUND(COALESCE(SUM(CASE WHEN refund_type = ? THEN amount ELSE 0 END), 0)) AS deposit_refunded_amount', [PaymentRefund::TYPE_DEPOSIT])
            ->selectRaw('ROUND(COALESCE(SUM(CASE WHEN refund_type = ? THEN amount ELSE 0 END), 0)) AS payment_refunded_amount', [PaymentRefund::TYPE_PAYMENT])
            ->groupBy('quotation_id');

        // Use the driver's JSON selector (PostgreSQL in the app, SQLite in tests).
        $adjustmentValue = $query->getQuery()->getGrammar()->wrap('quotations.metadata->roundingAdjustment');
        $adjustment = "COALESCE(CAST(NULLIF({$adjustmentValue}, '') AS NUMERIC), 0)";
        if ($query->getConnection()->getDriverName() === 'pgsql') {
            // Old JSON may contain an empty/non-numeric value. Do not let a
            // numeric cast failure turn a read-only filter into an HTTP 500.
            $adjustment = "CASE WHEN BTRIM({$adjustmentValue}) ~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$' THEN CAST({$adjustmentValue} AS NUMERIC) ELSE 0 END";
        }

        $amounts = Quotation::query()
            ->select('quotations.id', 'quotations.metadata->depositMode as deposit_mode')
            ->selectRaw('ROUND(COALESCE(quotations.total_amount, 0)) AS total_amount')
            ->selectRaw('COALESCE(quotations.total_amount, 0) AS raw_total_amount, COALESCE(quotations.deposit_amount, 0) AS raw_deposit_amount')
            ->selectRaw('ROUND(COALESCE(quotations.deposit_amount, 0)) AS deposit_amount')
            ->selectRaw('COALESCE(quotations.subtotal_amount, 0) AS subtotal_amount, COALESCE(quotations.vat_amount, 0) AS vat_amount')
            ->selectRaw("{$adjustment} AS rounding_adjustment")
            ->selectRaw('COALESCE(quotation_receipts.gross_paid_amount, 0) AS gross_paid_amount')
            ->selectRaw('COALESCE(quotation_refunds.deposit_refunded_amount, 0) AS deposit_refunded_amount')
            ->selectRaw('COALESCE(quotation_refunds.payment_refunded_amount, 0) AS payment_refunded_amount')
            ->leftJoinSub($allocations, 'quotation_receipts', fn ($join) => $join
                ->on('quotation_receipts.quotation_id', '=', 'quotations.id'))
            ->leftJoinSub($refunds, 'quotation_refunds', fn ($join) => $join
                ->on('quotation_refunds.quotation_id', '=', 'quotations.id'));

        $summary = DB::query()->fromSub($amounts, 'amounts')
            ->select('amounts.*')
            // Round each refund type before adding, exactly as the API does.
            ->selectRaw('deposit_refunded_amount + payment_refunded_amount AS refunded_amount')
            ->selectRaw(<<<'SQL'
                CASE
                    WHEN deposit_mode = ? OR (
                        deposit_amount > 0
                        AND (
                            ABS(total_amount - (subtotal_amount + vat_amount + deposit_amount + rounding_adjustment)) < 0.01
                            OR ABS(raw_total_amount - (subtotal_amount + vat_amount + raw_deposit_amount + rounding_adjustment)) < 0.01
                        )
                    ) THEN CASE
                        WHEN deposit_amount < deposit_refunded_amount THEN deposit_amount
                        ELSE deposit_refunded_amount
                    END
                    ELSE 0
                END AS released_deposit_amount
                SQL, [Quotation::DEPOSIT_MODE_NON_TAXABLE_ADDITION]);

        $balances = DB::query()->fromSub($summary, 'summary')
            ->select('id', 'gross_paid_amount', 'refunded_amount')
            ->selectRaw('CASE WHEN gross_paid_amount > refunded_amount THEN gross_paid_amount - refunded_amount ELSE 0 END AS paid_amount')
            ->selectRaw('CASE WHEN total_amount > released_deposit_amount THEN total_amount - released_deposit_amount ELSE 0 END AS collectible_amount');

        $matchingIds = DB::query()->fromSub($balances, 'balances')
            ->select('id')
            ->whereRaw(<<<'SQL'
                CASE
                    WHEN gross_paid_amount > 0.01 AND paid_amount <= 0.01
                        AND refunded_amount >= gross_paid_amount - 0.01 THEN ?
                    WHEN collectible_amount > 0.01 AND paid_amount >= collectible_amount - 0.01 THEN ?
                    ELSE ?
                END = ?
                SQL, [Quotation::STATUS_REFUNDED, Quotation::STATUS_WON, Quotation::STATUS_DRAFT, $status]);

        $query->whereIn('quotations.id', $matchingIds);
    }

    private function applyViewScope(Builder $query, ?User $user): void
    {
        if (! $user || $user->hasPermission('quotation.view_all')) {
            return;
        }

        $departmentIds = $user->hasPermission('quotation.view_department')
            ? $user->accessibleDepartmentIds()
            : [];

        if ($departmentIds !== []) {
            $query->where(function (Builder $scope) use ($departmentIds): void {
                $scope
                    ->where(function (Builder $projectScope) use ($departmentIds): void {
                        $projectScope
                            ->whereNotNull('project_id')
                            ->whereHas('project', fn (Builder $project) => $project
                                ->where(fn (Builder $owners) => $owners
                                    ->whereHas('managerUser', fn (Builder $manager) => $manager->whereIn('department_id', $departmentIds))
                                    ->orWhereHas('salesUser', fn (Builder $sales) => $sales->whereIn('department_id', $departmentIds))));
                    })
                    ->orWhere(function (Builder $customerScope) use ($departmentIds): void {
                        $customerScope
                            ->whereNull('project_id')
                            ->whereNotNull('customer_id')
                            ->whereHas('customer.salesUser', fn (Builder $sales) => $sales->whereIn('department_id', $departmentIds));
                    })
                    ->orWhere(function (Builder $leadScope) use ($departmentIds): void {
                        $leadScope
                            ->whereNull('project_id')
                            ->whereNull('customer_id')
                            ->whereHas('lead.assignedUser', fn (Builder $assigned) => $assigned->whereIn('department_id', $departmentIds));
                    });
            });

            return;
        }

        $teamIds = $user->hasPermission('quotation.view_team') ? $user->accessibleTeamIds() : [];
        if ($teamIds !== []) {
            $query->where(function (Builder $scope) use ($teamIds): void {
                $scope
                    ->where(function (Builder $projectScope) use ($teamIds): void {
                        $projectScope
                            ->whereNotNull('project_id')
                            ->whereHas('project', fn (Builder $project) => $project
                                ->where(fn (Builder $owners) => $owners
                                    ->whereHas('managerUser', fn (Builder $manager) => $manager->whereIn('team_id', $teamIds))
                                    ->orWhereHas('salesUser', fn (Builder $sales) => $sales->whereIn('team_id', $teamIds))));
                    })
                    ->orWhere(function (Builder $customerScope) use ($teamIds): void {
                        $customerScope
                            ->whereNull('project_id')
                            ->whereNotNull('customer_id')
                            ->whereHas('customer.salesUser', fn (Builder $sales) => $sales->whereIn('team_id', $teamIds));
                    })
                    ->orWhere(function (Builder $leadScope) use ($teamIds): void {
                        $leadScope
                            ->whereNull('project_id')
                            ->whereNull('customer_id')
                            ->whereHas('lead.assignedUser', fn (Builder $assigned) => $assigned->whereIn('team_id', $teamIds));
                    });
            });

            return;
        }

        if ($user->hasPermission('quotation.view')) {
            $query->where(function (Builder $scope) use ($user): void {
                $scope
                    ->where(function (Builder $projectScope) use ($user): void {
                        $projectScope
                            ->whereNotNull('project_id')
                            ->whereHas('project', fn (Builder $project) => $project
                                ->where(fn (Builder $owners) => $owners
                                    ->where('manager_user_id', $user->id)
                                    ->orWhere('sales_user_id', $user->id)));
                    })
                    ->orWhere(function (Builder $customerScope) use ($user): void {
                        $customerScope
                            ->whereNull('project_id')
                            ->whereNotNull('customer_id')
                            ->whereHas('customer', fn (Builder $customer) => $customer->where('sales_user_id', $user->id));
                    })
                    ->orWhere(function (Builder $leadScope) use ($user): void {
                        $leadScope
                            ->whereNull('project_id')
                            ->whereNull('customer_id')
                            ->whereHas('lead', fn (Builder $lead) => $lead->where('assigned_user_id', $user->id));
                    });
            });

            return;
        }

        $query->whereRaw('1 = 0');
    }

    private function relations(): array
    {
        return [
            'lead.assignedUser',
            'customer.salesUser',
            'project.managerUser',
            'project.salesUser',
            'contract',
            'service',
            'items.service',
            'paymentAllocations',
            'paymentRefunds',
            'createdBy',
            'topupCreditApprovedBy',
        ];
    }

    public function findWithRelationsOrFail(string $id): Quotation
    {
        /** @var Quotation|null $quotation */
        $quotation = $this->query()->withoutGlobalScope('effective')
            ->with($this->relations())
            ->whereKey($id)
            ->first();

        if (! $quotation) {
            throw new NotFoundHttpException($this->notFoundMessage);
        }

        return $quotation;
    }

    public function findForUpdateOrFail(string $id): Quotation
    {
        /** @var Quotation|null $quotation */
        $quotation = $this->query()
            ->whereKey($id)
            ->lockForUpdate()
            ->first();

        if (! $quotation) {
            throw new NotFoundHttpException($this->notFoundMessage);
        }

        return $quotation->load([
            'lead',
            'customer',
            'project',
            'contract',
            'service',
            'items.service',
            'paymentAllocations',
            'paymentRefunds',
            'createdBy',
            'topupCreditApprovedBy',
        ]);
    }

    public function findByCode(?string $code): ?Quotation
    {
        if (! $code) {
            return null;
        }

        return $this->query()->with(['lead', 'customer', 'project', 'contract', 'service', 'items.service', 'paymentAllocations', 'paymentRefunds', 'createdBy', 'topupCreditApprovedBy'])->where('quotation_code', $code)->first();
    }
}

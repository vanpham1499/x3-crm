<?php

namespace App\Repositories;

use App\Models\PaymentRefund;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class PaymentRefundRepository extends BaseRepository
{
    protected string $notFoundMessage = 'Khoản trả khách không tồn tại';

    protected function model(): string
    {
        return PaymentRefund::class;
    }

    public function findPaginated(
        array $filters,
        int $perPage,
        int $page,
        ?User $user = null,
    ): LengthAwarePaginator {
        return $this->filteredQuery($filters, $user)->paginate($perPage, ['*'], 'page', $page);
    }

    private function filteredQuery(array $filters, ?User $user = null): Builder
    {
        $keyword = trim((string) ($filters['keyword'] ?? ''));
        $dateFrom = $filters['date_from'] ?? null;
        $dateTo = $filters['date_to'] ?? null;

        $query = $this->query()->with($this->relations());

        $this->applyViewScope($query, $user);

        return $query
            ->when($keyword !== '', fn ($query) => $query->where(function ($query) use ($keyword): void {
                $query
                    ->where('recipient_name', 'ilike', "%{$keyword}%")
                    ->orWhere('recipient_account', 'ilike', "%{$keyword}%")
                    ->orWhere('recipient_bank', 'ilike', "%{$keyword}%")
                    ->orWhere('reference', 'ilike', "%{$keyword}%")
                    ->orWhere('reason', 'ilike', "%{$keyword}%")
                    ->orWhere('note', 'ilike', "%{$keyword}%")
                    ->orWhereHas('payment', fn ($relation) => $relation
                        ->where('transaction_content', 'ilike', "%{$keyword}%")
                        ->orWhere('reference', 'ilike', "%{$keyword}%")
                        ->orWhere('output_invoice_number', 'ilike', "%{$keyword}%"))
                    ->orWhereHas('quotation', fn ($relation) => $relation
                        ->where('quotation_code', 'ilike', "%{$keyword}%"))
                    ->orWhereHas('project', fn ($relation) => $relation
                        ->where('project_code', 'ilike', "%{$keyword}%")
                        ->orWhere('project_name', 'ilike', "%{$keyword}%"))
                    ->orWhereHas('customer', fn ($relation) => $relation
                        ->where('customer_code', 'ilike', "%{$keyword}%")
                        ->orWhere('customer_name', 'ilike', "%{$keyword}%"));
            }))
            ->when($filters['refund_type'] ?? null, fn ($query, $value) => $query->where('refund_type', $value))
            ->when($filters['status'] ?? null, fn ($query, $value) => $query->where('status', $value))
            ->when($dateFrom, fn ($query) => $query->where(function ($query) use ($dateFrom): void {
                $query
                    ->whereDate('completed_at', '>=', $dateFrom)
                    ->orWhere(function ($query) use ($dateFrom): void {
                        $query->whereNull('completed_at')->whereDate('scheduled_at', '>=', $dateFrom);
                    });
            }))
            ->when($dateTo, fn ($query) => $query->where(function ($query) use ($dateTo): void {
                $query
                    ->whereDate('completed_at', '<=', $dateTo)
                    ->orWhere(function ($query) use ($dateTo): void {
                        $query->whereNull('completed_at')->whereDate('scheduled_at', '<=', $dateTo);
                    });
            }))
            ->orderByRaw('COALESCE(completed_at, scheduled_at) DESC NULLS LAST')
            ->orderByDesc('created_at');
    }

    private function applyViewScope(Builder $query, ?User $user): void
    {
        if (
            ! $user
            || $user->hasPermission('payment.view_all')
            || $user->hasPermission('payment.manage')
        ) {
            return;
        }

        $projectRelations = [
            'project',
            'quotation.project',
            'allocation.project',
            'allocation.quotation.project',
            'payment.project',
            'payment.quotation.project',
            'payment.allocations.project',
            'payment.allocations.quotation.project',
        ];

        $departmentIds = $user->accessibleDepartmentIds();

        $query->where(function (Builder $scope) use ($departmentIds, $projectRelations, $user): void {
            $scope->whereHas('payment', function (Builder $payment): void {
                $payment
                    ->where('receipt_type', 'customer')
                    ->where(function (Builder $status): void {
                        $status
                            ->where('reconciled_status', 'unmatched')
                            ->orWhere(function (Builder $legacy): void {
                                $legacy->whereNull('reconciled_status')->where('status', 'unmatched');
                            });
                    })
                    ->whereNull('quotation_id')
                    ->whereNull('project_id')
                    ->whereDoesntHave('allocations');
            });

            foreach ($projectRelations as $relation) {
                if ($user->hasPermission('payment.view_department') && $departmentIds !== []) {
                    $scope->orWhereHas(
                        $relation.'.managerUser',
                        fn (Builder $manager) => $manager->whereIn('department_id', $departmentIds),
                    );

                    continue;
                }

                $scope->orWhereHas(
                    $relation,
                    fn (Builder $project) => $project->where('manager_user_id', $user->id),
                );
            }
        });
    }

    public function relations(): array
    {
        return [
            'payment',
            'allocation',
            'quotation',
            'customer',
            'project',
            'createdBy',
        ];
    }
}

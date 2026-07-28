<?php

namespace App\Services;

use App\Http\Resources\KpiTargetResource;
use App\Models\Department;
use App\Models\KpiTarget;
use App\Models\PaymentAllocation;
use App\Models\PaymentRefund;
use App\Models\Project;
use App\Models\ProjectCost;
use App\Models\ProjectCostAdjustment;
use App\Models\Quotation;
use App\Models\Service;
use App\Repositories\KpiReportRepository;
use App\Repositories\KpiTargetRepository;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class KpiService extends BaseService
{
    private const MONEY_EPSILON = 0.01;

    public function __construct(
        private readonly KpiReportRepository $reports,
        private readonly KpiTargetRepository $targets,
    ) {}

    public function report(?string $periodFrom = null, ?string $periodTo = null): array
    {
        [$rangeStart, $rangeEnd] = $this->periodRange($periodFrom, $periodTo);
        $rangeEndExclusive = $rangeEnd->addMonth();
        $periodStarts = collect();

        for ($cursor = $rangeStart; $cursor->lessThanOrEqualTo($rangeEnd); $cursor = $cursor->addMonth()) {
            $periodStarts->push($cursor);
        }

        $services = $this->reports->services();
        $departments = $this->reports->departments();
        $projects = $this->reports->activeProjects();
        $projectIds = $projects->pluck('id');
        $quotations = $this->reports->quotations($projectIds);
        $quotationIds = $quotations->pluck('id');
        $allocations = $this->reports->allocations($quotations->pluck('id'));
        $refunds = $this->reports->completedRefunds(
            $rangeStart->toDateTimeString(),
            $rangeEndExclusive->toDateTimeString(),
            $projectIds,
            $quotationIds,
        );
        $costs = $this->reports->completedCosts(
            $rangeStart->toDateString(),
            $rangeEndExclusive->toDateString(),
            $projectIds,
        );
        $targetsByPeriod = $this->targets
            ->findForRange($rangeStart->toDateString(), $rangeEndExclusive->toDateString())
            ->groupBy(fn (KpiTarget $target): string => $target->period_month->format('Y-m'));
        $refundsByPeriod = $refunds
            ->groupBy(fn (PaymentRefund $refund): string => $refund->completed_at->format('Y-m'));
        $costsByPeriod = $costs
            ->groupBy(fn (ProjectCost $cost): string => $cost->transaction_date->format('Y-m'));

        $serviceMap = $services->keyBy('id');
        $projectMap = $projects->keyBy('id');
        $quotationMap = $quotations->keyBy('id');
        $projectRootServices = $projects->mapWithKeys(fn (Project $project): array => [
            $project->id => $this->rootServiceId($project->service_id, $serviceMap),
        ]);
        $referencedRootServiceIds = $projectRootServices
            ->filter()
            ->map(fn ($id): int => (int) $id)
            ->unique()
            ->values()
            ->all();
        $rootServiceIds = $services
            ->filter(fn (Service $service): bool => $service->parent_id === null
                && ($service->deleted_at === null
                    || in_array((int) $service->id, $referencedRootServiceIds, true)))
            ->pluck('id')
            ->map(fn ($id): int => (int) $id)
            ->all();
        $firstSuccessfulByProject = $this->firstSuccessfulQuotations($quotations, $allocations);

        $periods = $periodStarts->map(fn (CarbonImmutable $periodStart): array => $this->buildMonthlyReport(
            $periodStart->format('Y-m'),
            $services,
            $departments,
            $allocations,
            $quotationMap,
            $projectMap,
            $projectRootServices,
            $rootServiceIds,
            $firstSuccessfulByProject,
            $targetsByPeriod->get($periodStart->format('Y-m'), collect()),
            $refundsByPeriod->get($periodStart->format('Y-m'), collect()),
            $costsByPeriod->get($periodStart->format('Y-m'), collect()),
        ))->values();

        return [
            'periodFrom' => $rangeStart->format('Y-m'),
            'periodTo' => $rangeEnd->format('Y-m'),
            'calculationBasis' => [
                'currency' => 'VND',
                'sourceAmountBasis' => 'gross_including_vat',
                'profitAmountBasis' => 'before_vat',
                'projectScope' => 'existing_projects',
                'sourceDepositIncluded' => true,
                'serviceProfitDepositIncluded' => false,
                'acquisitionProfitDepositIncluded' => true,
            ],
            'periods' => $periods,
        ];
    }

    public function upsertTarget(array $data): array
    {
        $scopeType = (string) $data['scopeType'];
        $scopeId = (int) $data['scopeId'];
        $periodStart = $this->periodStart((string) $data['period']);
        $targetAmount = (float) $data['targetAmount'];

        $this->validateScope($scopeType, $scopeId);

        $target = $this->targets->upsertTarget(
            $scopeType,
            $scopeId,
            $periodStart->toDateString(),
            $targetAmount,
        );

        return $this->apiResource($target, KpiTargetResource::class);
    }

    private function buildMonthlyReport(
        string $periodKey,
        Collection $services,
        Collection $departments,
        Collection $allocations,
        Collection $quotationMap,
        Collection $projectMap,
        Collection $projectRootServices,
        array $rootServiceIds,
        Collection $firstSuccessfulByProject,
        Collection $targets,
        Collection $refunds,
        Collection $costs,
    ): array {
        $serviceActuals = $this->emptyServiceActuals($rootServiceIds);
        $departmentActuals = $this->emptyDepartmentActuals($departments->pluck('id'));
        $targetMap = $targets
            ->keyBy(fn (KpiTarget $target): string => $target->scope_type.':'.$target->scope_id);

        $this->applyReceivedRevenue(
            $periodKey,
            $allocations,
            $quotationMap,
            $projectMap,
            $projectRootServices,
            $serviceActuals,
            $departmentActuals,
        );
        $this->applyCosts(
            $costs,
            $projectMap,
            $projectRootServices,
            $serviceActuals,
            $departmentActuals,
        );
        $this->applyAcquisitionCredits(
            $periodKey,
            $firstSuccessfulByProject,
            $projectMap,
            $departmentActuals,
        );
        $this->applyRefunds(
            $refunds,
            $quotationMap,
            $projectMap,
            $projectRootServices,
            $firstSuccessfulByProject,
            $serviceActuals,
            $departmentActuals,
        );

        $serviceRows = $services
            ->filter(fn (Service $service): bool => in_array((int) $service->id, $rootServiceIds, true))
            ->map(function (Service $service) use ($serviceActuals, $targetMap): array {
                $actual = $serviceActuals[(int) $service->id];
                $target = (float) ($targetMap->get(KpiTarget::SCOPE_SERVICE.':'.$service->id)?->target_amount ?? 0);
                $actualAmount = $actual['receivedBeforeVatAmount']
                    - $actual['costBeforeVatAmount']
                    - $actual['refundBeforeVatAmount'];

                return [
                    'id' => (int) $service->id,
                    'scopeType' => KpiTarget::SCOPE_SERVICE,
                    'code' => $service->code,
                    'name' => $service->name,
                    'isActive' => (bool) $service->is_active && ! $service->trashed(),
                    'isDeleted' => $service->trashed(),
                    'targetAmount' => $this->money($target),
                    'receivedAmount' => $this->money($actual['receivedAmount']),
                    'costAmount' => $this->money($actual['costAmount']),
                    'refundAmount' => $this->money($actual['refundAmount']),
                    'actualAmount' => $this->money($actualAmount),
                    'completionRate' => $this->completionRate($actualAmount, $target),
                ];
            })
            ->values();

        $departmentRows = $departments
            ->map(function (Department $department) use ($departmentActuals, $targetMap): array {
                $actual = $departmentActuals[(int) $department->id];
                $target = (float) ($targetMap->get(KpiTarget::SCOPE_DEPARTMENT.':'.$department->id)?->target_amount ?? 0);
                $implementationAmount = $actual['implementationReceivedBeforeVatAmount']
                    - $actual['implementationCostBeforeVatAmount']
                    - $actual['implementationRefundBeforeVatAmount'];
                $acquisitionAmount = $actual['acquisitionCreditBeforeVatAmount']
                    - $actual['acquisitionRefundBeforeVatAmount'];
                $actualAmount = $implementationAmount + $acquisitionAmount;

                return [
                    'id' => (int) $department->id,
                    'scopeType' => KpiTarget::SCOPE_DEPARTMENT,
                    'name' => $department->name,
                    'targetAmount' => $this->money($target),
                    'implementationReceivedAmount' => $this->money($actual['implementationReceivedAmount']),
                    'implementationCostAmount' => $this->money($actual['implementationCostAmount']),
                    'implementationRefundAmount' => $this->money($actual['implementationRefundAmount']),
                    'implementationAmount' => $this->money($implementationAmount),
                    'acquisitionCreditAmount' => $this->money($actual['acquisitionCreditAmount']),
                    'acquisitionRefundAmount' => $this->money($actual['acquisitionRefundAmount']),
                    'acquisitionAmount' => $this->money($acquisitionAmount),
                    'actualAmount' => $this->money($actualAmount),
                    'completionRate' => $this->completionRate($actualAmount, $target),
                ];
            })
            ->values();

        return [
            'period' => $periodKey,
            'services' => $serviceRows,
            'departments' => $departmentRows,
            'summary' => [
                'services' => $this->summary($serviceRows),
                'departments' => $this->summary($departmentRows),
            ],
        ];
    }

    private function applyReceivedRevenue(
        string $periodKey,
        Collection $allocations,
        Collection $quotationMap,
        Collection $projectMap,
        Collection $projectRootServices,
        array &$serviceActuals,
        array &$departmentActuals,
    ): void {
        foreach ($allocations->groupBy('quotation_id') as $quotationId => $quotationAllocations) {
            /** @var Quotation|null $quotation */
            $quotation = $quotationMap->get($quotationId);

            if (! $quotation) {
                continue;
            }

            $cumulativeAmount = 0.0;
            $sortedAllocations = $quotationAllocations
                ->sortBy(fn (PaymentAllocation $allocation): string => $this->allocationEventAt($allocation)->format('Y-m-d H:i:s.u').'-'.str_pad((string) $allocation->id, 20, '0', STR_PAD_LEFT));

            foreach ($sortedAllocations as $allocation) {
                $before = $cumulativeAmount;
                $cumulativeAmount += (float) $allocation->amount;

                if ($this->allocationEventAt($allocation)->format('Y-m') !== $periodKey) {
                    continue;
                }

                $receivedAmount = (float) $allocation->amount;
                $receivedBeforeVatAmount = $this->recognizedRevenueBetween(
                    $quotation,
                    $before,
                    $cumulativeAmount,
                );

                if ($receivedAmount <= self::MONEY_EPSILON
                    && $receivedBeforeVatAmount <= self::MONEY_EPSILON) {
                    continue;
                }

                $project = $projectMap->get($quotation->project_id);
                $rootServiceId = $projectRootServices->get($quotation->project_id);
                $departmentId = $project?->managerUser?->department_id;

                if ($rootServiceId && isset($serviceActuals[$rootServiceId])) {
                    $serviceActuals[$rootServiceId]['receivedAmount'] += $receivedAmount;
                    $serviceActuals[$rootServiceId]['receivedBeforeVatAmount'] += $receivedBeforeVatAmount;
                }

                if ($departmentId && isset($departmentActuals[$departmentId])) {
                    $departmentActuals[$departmentId]['implementationReceivedAmount'] += $receivedAmount;
                    $departmentActuals[$departmentId]['implementationReceivedBeforeVatAmount'] +=
                        $receivedBeforeVatAmount;
                }
            }
        }
    }

    private function applyCosts(
        Collection $costs,
        Collection $projectMap,
        Collection $projectRootServices,
        array &$serviceActuals,
        array &$departmentActuals,
    ): void {
        foreach ($costs as $cost) {
            /** @var ProjectCost $cost */
            $amounts = $this->costAmounts($cost);
            $project = $projectMap->get($cost->project_id);
            $rootServiceId = $projectRootServices->get($cost->project_id);
            $departmentId = $project?->managerUser?->department_id;

            if ($rootServiceId && isset($serviceActuals[$rootServiceId])) {
                $serviceActuals[$rootServiceId]['costAmount'] += $amounts['gross'];
                $serviceActuals[$rootServiceId]['costBeforeVatAmount'] += $amounts['beforeVat'];
            }

            if ($departmentId && isset($departmentActuals[$departmentId])) {
                $departmentActuals[$departmentId]['implementationCostAmount'] += $amounts['gross'];
                $departmentActuals[$departmentId]['implementationCostBeforeVatAmount'] +=
                    $amounts['beforeVat'];
            }
        }
    }

    private function applyAcquisitionCredits(
        string $periodKey,
        Collection $firstSuccessfulByProject,
        Collection $projectMap,
        array &$departmentActuals,
    ): void {
        foreach ($firstSuccessfulByProject as $projectId => $success) {
            if ($success['paidAt']->format('Y-m') !== $periodKey) {
                continue;
            }

            $project = $projectMap->get($projectId);
            $departmentId = $project?->customer?->salesUser?->department_id;

            if (! $departmentId || ! isset($departmentActuals[$departmentId])) {
                continue;
            }

            /** @var Quotation $quotation */
            $quotation = $success['quotation'];
            $departmentActuals[$departmentId]['acquisitionCreditAmount'] += (float) $quotation->total_amount;
            $departmentActuals[$departmentId]['acquisitionCreditBeforeVatAmount'] +=
                (float) $quotation->subtotal_amount + (float) $quotation->deposit_amount;
        }
    }

    private function applyRefunds(
        Collection $refunds,
        Collection $quotationMap,
        Collection $projectMap,
        Collection $projectRootServices,
        Collection $firstSuccessfulByProject,
        array &$serviceActuals,
        array &$departmentActuals,
    ): void {
        foreach ($refunds as $refund) {
            /** @var PaymentRefund $refund */
            $quotation = $quotationMap->get($refund->quotation_id);
            $projectId = $refund->project_id ?: $quotation?->project_id;
            $project = $projectMap->get($projectId);
            $refundAmount = (float) $refund->amount;
            $serviceRefundBeforeVatAmount = in_array($refund->refund_type, [
                PaymentRefund::TYPE_DEPOSIT,
                PaymentRefund::TYPE_OVERPAYMENT,
            ], true)
                ? 0.0
                : $this->refundBeforeVat($refund, $quotation);
            $rootServiceId = $projectRootServices->get($projectId);
            $implementationDepartmentId = $project?->managerUser?->department_id;

            if ($rootServiceId && isset($serviceActuals[$rootServiceId])) {
                $serviceActuals[$rootServiceId]['refundAmount'] += $refundAmount;
                $serviceActuals[$rootServiceId]['refundBeforeVatAmount'] +=
                    $serviceRefundBeforeVatAmount;
            }

            if ($implementationDepartmentId && isset($departmentActuals[$implementationDepartmentId])) {
                $departmentActuals[$implementationDepartmentId]['implementationRefundAmount'] += $refundAmount;
                $departmentActuals[$implementationDepartmentId]['implementationRefundBeforeVatAmount'] +=
                    $serviceRefundBeforeVatAmount;
            }

            $firstSuccess = $firstSuccessfulByProject->get($projectId);

            if (! $firstSuccess || (int) $firstSuccess['quotation']->id !== (int) $refund->quotation_id) {
                continue;
            }

            $acquisitionDepartmentId = $project?->customer?->salesUser?->department_id;

            if ($acquisitionDepartmentId && isset($departmentActuals[$acquisitionDepartmentId])) {
                $acquisitionRefundBeforeVatAmount =
                    $refund->refund_type === PaymentRefund::TYPE_OVERPAYMENT
                        ? 0.0
                        : $this->refundBeforeVat($refund, $quotation);
                $departmentActuals[$acquisitionDepartmentId]['acquisitionRefundAmount'] += $refundAmount;
                $departmentActuals[$acquisitionDepartmentId]['acquisitionRefundBeforeVatAmount'] +=
                    $acquisitionRefundBeforeVatAmount;
            }
        }
    }

    private function firstSuccessfulQuotations(Collection $quotations, Collection $allocations): Collection
    {
        $allocationsByQuotation = $allocations->groupBy('quotation_id');
        $successes = collect();

        foreach ($quotations as $quotation) {
            /** @var Quotation $quotation */
            $totalAmount = (float) $quotation->total_amount;

            if ($totalAmount <= self::MONEY_EPSILON) {
                continue;
            }

            $cumulativeAmount = 0.0;
            $paidAt = null;
            $sortedAllocations = $allocationsByQuotation
                ->get($quotation->id, collect())
                ->sortBy(fn (PaymentAllocation $allocation): string => $this->allocationEventAt($allocation)->format('Y-m-d H:i:s.u').'-'.str_pad((string) $allocation->id, 20, '0', STR_PAD_LEFT));

            foreach ($sortedAllocations as $allocation) {
                $cumulativeAmount += (float) $allocation->amount;

                if ($cumulativeAmount >= $totalAmount - self::MONEY_EPSILON) {
                    $paidAt = $this->allocationEventAt($allocation);
                    break;
                }
            }

            if (! $paidAt) {
                continue;
            }

            $current = $successes->get($quotation->project_id);

            if (! $current
                || $paidAt->lessThan($current['paidAt'])
                || ($paidAt->equalTo($current['paidAt']) && $quotation->id < $current['quotation']->id)) {
                $successes->put($quotation->project_id, [
                    'quotation' => $quotation,
                    'paidAt' => $paidAt,
                ]);
            }
        }

        return $successes;
    }

    private function recognizedRevenueBetween(Quotation $quotation, float $before, float $after): float
    {
        $depositAmount = max(0, (float) $quotation->deposit_amount);
        $taxableGrossAmount = max(0, (float) $quotation->subtotal_amount + (float) $quotation->vat_amount);
        $taxableBefore = min(max(0, $before - $depositAmount), $taxableGrossAmount);
        $taxableAfter = min(max(0, $after - $depositAmount), $taxableGrossAmount);
        $recognizedGross = max(0, $taxableAfter - $taxableBefore);

        return $this->money($recognizedGross * $this->quotationBeforeVatFactor($quotation));
    }

    private function quotationBeforeVatFactor(?Quotation $quotation): float
    {
        if (! $quotation) {
            return 1.0;
        }

        $taxableGross = (float) $quotation->subtotal_amount + (float) $quotation->vat_amount;

        return $taxableGross > self::MONEY_EPSILON
            ? (float) $quotation->subtotal_amount / $taxableGross
            : 1.0;
    }

    private function refundBeforeVat(PaymentRefund $refund, ?Quotation $quotation): float
    {
        $amount = (float) $refund->amount;

        if ($refund->refund_type === PaymentRefund::TYPE_PAYMENT) {
            return $this->money($amount * $this->quotationBeforeVatFactor($quotation));
        }

        return $this->money($amount);
    }

    /**
     * @return array{gross: float, beforeVat: float}
     */
    private function costAmounts(ProjectCost $cost): array
    {
        $actualGross = $cost->actualCostAmount();
        $invoiceGrossBeforeDiscount = (float) $cost->amount_before_vat + (float) $cost->vat_amount;
        $baseBeforeVat = $invoiceGrossBeforeDiscount > self::MONEY_EPSILON
            ? $actualGross * ((float) $cost->amount_before_vat / $invoiceGrossBeforeDiscount)
            : $actualGross;
        $extraCosts = (float) $cost->adjustments
            ->where('status', ProjectCostAdjustment::STATUS_COMPLETED)
            ->whereIn('adjustment_type', ProjectCostAdjustment::EXTRA_COST_TYPES)
            ->sum(fn (ProjectCostAdjustment $adjustment): float => (float) $adjustment->amount);

        return [
            'gross' => $this->money($actualGross + $extraCosts),
            'beforeVat' => $this->money($baseBeforeVat + $extraCosts),
        ];
    }

    private function allocationEventAt(PaymentAllocation $allocation): CarbonImmutable
    {
        $value = $allocation->payment?->transaction_at
            ?: $allocation->payment?->transaction_date
            ?: $allocation->allocated_at
            ?: $allocation->created_at;

        return CarbonImmutable::parse($value);
    }

    private function rootServiceId(int|string|null $serviceId, Collection $serviceMap): ?int
    {
        $visited = [];
        $currentId = $serviceId ? (int) $serviceId : null;

        while ($currentId && ! isset($visited[$currentId])) {
            $visited[$currentId] = true;
            /** @var Service|null $service */
            $service = $serviceMap->get($currentId);

            if (! $service) {
                return null;
            }

            if ($service->parent_id === null) {
                return (int) $service->id;
            }

            $currentId = (int) $service->parent_id;
        }

        return null;
    }

    private function emptyServiceActuals(array $rootServiceIds): array
    {
        return collect($rootServiceIds)->mapWithKeys(fn (int $id): array => [
            $id => [
                'receivedAmount' => 0.0,
                'costAmount' => 0.0,
                'refundAmount' => 0.0,
                'receivedBeforeVatAmount' => 0.0,
                'costBeforeVatAmount' => 0.0,
                'refundBeforeVatAmount' => 0.0,
            ],
        ])->all();
    }

    private function emptyDepartmentActuals(Collection $departmentIds): array
    {
        return $departmentIds->mapWithKeys(fn ($id): array => [
            (int) $id => [
                'implementationReceivedAmount' => 0.0,
                'implementationCostAmount' => 0.0,
                'implementationRefundAmount' => 0.0,
                'acquisitionCreditAmount' => 0.0,
                'acquisitionRefundAmount' => 0.0,
                'implementationReceivedBeforeVatAmount' => 0.0,
                'implementationCostBeforeVatAmount' => 0.0,
                'implementationRefundBeforeVatAmount' => 0.0,
                'acquisitionCreditBeforeVatAmount' => 0.0,
                'acquisitionRefundBeforeVatAmount' => 0.0,
            ],
        ])->all();
    }

    private function summary(Collection $rows): array
    {
        $targetAmount = (float) $rows->sum('targetAmount');
        $actualAmount = (float) $rows->sum('actualAmount');

        return [
            'targetAmount' => $this->money($targetAmount),
            'actualAmount' => $this->money($actualAmount),
            'completionRate' => $this->completionRate($actualAmount, $targetAmount),
        ];
    }

    private function completionRate(float $actualAmount, float $targetAmount): ?float
    {
        return $targetAmount > self::MONEY_EPSILON
            ? round($actualAmount / $targetAmount * 100, 2)
            : null;
    }

    private function periodStart(?string $period): CarbonImmutable
    {
        return $period
            ? CarbonImmutable::createFromFormat('!Y-m', $period)->startOfMonth()
            : CarbonImmutable::now()->startOfMonth();
    }

    private function periodRange(?string $periodFrom, ?string $periodTo): array
    {
        $rangeStart = $this->periodStart($periodFrom);
        $rangeEnd = $this->periodStart($periodTo ?: $periodFrom);

        if ($rangeEnd->lessThan($rangeStart)) {
            throw ValidationException::withMessages([
                'period_to' => ['Tháng kết thúc phải bằng hoặc sau tháng bắt đầu.'],
            ]);
        }

        if ($rangeStart->diffInMonths($rangeEnd) + 1 > 36) {
            throw ValidationException::withMessages([
                'period_to' => ['Mỗi lần chỉ được xem tối đa 36 tháng.'],
            ]);
        }

        return [$rangeStart, $rangeEnd];
    }

    private function validateScope(string $scopeType, int $scopeId): void
    {
        $exists = match ($scopeType) {
            KpiTarget::SCOPE_SERVICE => Service::query()
                ->whereKey($scopeId)
                ->whereNull('parent_id')
                ->exists(),
            KpiTarget::SCOPE_DEPARTMENT => Department::query()->whereKey($scopeId)->exists(),
            default => false,
        };

        if (! $exists) {
            throw ValidationException::withMessages([
                'scopeId' => ['Đối tượng KPI không tồn tại hoặc không hợp lệ.'],
            ]);
        }
    }

    private function money(float $amount): float
    {
        return round($amount, 2);
    }
}

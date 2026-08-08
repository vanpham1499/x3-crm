<?php

namespace App\Services;

use App\Http\Resources\KpiTargetResource;
use App\Models\Department;
use App\Models\KpiTarget;
use App\Models\Option;
use App\Models\PaymentAllocation;
use App\Models\PaymentRefund;
use App\Models\Project;
use App\Models\ProjectCost;
use App\Models\ProjectCostAdjustment;
use App\Models\Quotation;
use App\Models\Service;
use App\Models\User;
use App\Repositories\KpiReportRepository;
use App\Repositories\KpiTargetRepository;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class KpiService extends BaseService
{
    private const MONEY_EPSILON = 0.01;

    public function __construct(
        private readonly KpiReportRepository $reports,
        private readonly KpiTargetRepository $targets,
    ) {}

    public function report(
        ?string $periodFrom = null,
        ?string $periodTo = null,
        ?User $viewer = null,
    ): array {
        [$rangeStart, $rangeEnd] = $this->periodRange($periodFrom, $periodTo);
        $rangeEndExclusive = $rangeEnd->addMonth();
        $periodStarts = collect();

        for ($cursor = $rangeStart; $cursor->lessThanOrEqualTo($rangeEnd); $cursor = $cursor->addMonth()) {
            $periodStarts->push($cursor);
        }

        $services = $this->reports->services();
        $serviceGroups = Option::query()
            ->where('group', Option::GROUP_SERVICE_KPI)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();
        $departments = $this->reports->departments();
        $users = $this->reports->users();
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
        $paidFirstQuotationByProject = $this->paidFirstQuotations($quotations, $allocations);

        $periods = $periodStarts->map(fn (CarbonImmutable $periodStart): array => $this->buildMonthlyReport(
            $periodStart->format('Y-m'),
            $services,
            $serviceGroups,
            $departments,
            $users,
            $allocations,
            $quotationMap,
            $projectMap,
            $projectRootServices,
            $rootServiceIds,
            $paidFirstQuotationByProject,
            $targetsByPeriod->get($periodStart->format('Y-m'), collect()),
            $refundsByPeriod->get($periodStart->format('Y-m'), collect()),
            $costsByPeriod->get($periodStart->format('Y-m'), collect()),
        ))->values();
        $viewerScope = $viewer ? $this->viewerScope($viewer) : $this->allViewerScope();

        if ($viewer) {
            $periods = $this->scopePeriods($periods, $viewerScope);
        }

        return [
            'periodFrom' => $rangeStart->format('Y-m'),
            'periodTo' => $rangeEnd->format('Y-m'),
            'viewerScope' => $viewerScope,
            'calculationBasis' => [
                'currency' => 'VND',
                'sourceAmountBasis' => 'gross_including_vat',
                'profitAmountBasis' => 'before_vat',
                'projectScope' => 'existing_projects',
                'sourceDepositIncluded' => true,
                'serviceProfitDepositIncluded' => false,
                'acquisitionProfitDepositIncluded' => true,
                'acquisitionProfitDepositScope' => 'project_type_k_only',
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
        $this->authorizeTargetManagement($scopeType, $scopeId);

        $target = $this->targets->upsertTarget(
            $scopeType,
            $scopeId,
            $periodStart->toDateString(),
            $targetAmount,
        );

        return $this->apiResource($target, KpiTargetResource::class);
    }

    public function detail(string $period, string $scopeType, int $scopeId, User $viewer): array
    {
        $periodStart = $this->periodStart($period);
        $periodEnd = $periodStart->addMonth();
        [$scopeName, $serviceRootIds, $scopeUser] = $this->detailScopeContext($scopeType, $scopeId);

        $this->authorizeDetailScope($viewer, $scopeType, $scopeId, $scopeUser);

        $services = $this->reports->services();
        $projects = $this->reports->activeProjects();
        $projectIds = $projects->pluck('id');
        $quotations = $this->reports->quotations($projectIds);
        $quotationIds = $quotations->pluck('id');
        $allocations = $this->reports->allocations($quotationIds);
        $refunds = $this->reports->completedRefunds(
            $periodStart->toDateTimeString(),
            $periodEnd->toDateTimeString(),
            $projectIds,
            $quotationIds,
        );
        $costs = $this->reports->completedCosts(
            $periodStart->toDateString(),
            $periodEnd->toDateString(),
            $projectIds,
        );
        $serviceMap = $services->keyBy('id');
        $projectMap = $projects->keyBy('id');
        $quotationMap = $quotations->keyBy('id');
        $projectRootServices = $projects->mapWithKeys(fn (Project $project): array => [
            $project->id => $this->rootServiceId($project->service_id, $serviceMap),
        ]);
        $paidFirstQuotationByProject = $this->paidFirstQuotations($quotations, $allocations);
        $entries = collect();
        $implementationBranch = in_array($scopeType, [
            KpiTarget::SCOPE_SERVICE,
            KpiTarget::SCOPE_SERVICE_GROUP,
        ], true) ? 'service' : 'implementation';

        foreach ($allocations->groupBy('quotation_id') as $quotationId => $quotationAllocations) {
            /** @var Quotation|null $quotation */
            $quotation = $quotationMap->get($quotationId);
            /** @var Project|null $project */
            $project = $quotation ? $projectMap->get($quotation->project_id) : null;

            if (! $quotation || ! $project || ! $this->matchesDetailImplementation(
                $project,
                $scopeType,
                $scopeId,
                $serviceRootIds,
                $projectRootServices,
            )) {
                continue;
            }

            $cumulativeAmount = 0.0;
            $sortedAllocations = $quotationAllocations
                ->sortBy(fn (PaymentAllocation $allocation): string => $this->allocationEventAt($allocation)->format('Y-m-d H:i:s.u').'-'.str_pad((string) $allocation->id, 20, '0', STR_PAD_LEFT));

            foreach ($sortedAllocations as $allocation) {
                $before = $cumulativeAmount;
                $cumulativeAmount += (float) $allocation->amount;
                $eventAt = $this->allocationEventAt($allocation);

                if ($eventAt->format('Y-m') !== $period) {
                    continue;
                }

                $beforeVatAmount = $this->recognizedRevenueBetween($quotation, $before, $cumulativeAmount);

                if ((float) $allocation->amount <= self::MONEY_EPSILON
                    && $beforeVatAmount <= self::MONEY_EPSILON) {
                    continue;
                }

                $entries->push($this->detailEntry(
                    'allocation-'.$allocation->id,
                    $implementationBranch,
                    'received',
                    'Khoản thu đã phân bổ',
                    $eventAt,
                    (float) $allocation->amount,
                    $beforeVatAmount,
                    $beforeVatAmount,
                    $project,
                    $quotation,
                    $allocation->payment?->transaction_content
                        ?: $allocation->payment?->reference
                        ?: 'Khoản thu #'.$allocation->payment_id,
                ));
            }
        }

        foreach ($costs as $cost) {
            /** @var ProjectCost $cost */
            /** @var Project|null $project */
            $project = $projectMap->get($cost->project_id);

            if (! $project || ! $this->matchesDetailImplementation(
                $project,
                $scopeType,
                $scopeId,
                $serviceRootIds,
                $projectRootServices,
            )) {
                continue;
            }

            $amounts = $this->costAmounts($cost);
            $entries->push($this->detailEntry(
                'cost-'.$cost->id,
                $implementationBranch,
                'cost',
                'Chi phí thực tế',
                CarbonImmutable::parse($cost->transaction_date),
                $amounts['gross'],
                $amounts['beforeVat'],
                -$amounts['beforeVat'],
                $project,
                $quotationMap->get($cost->quotation_id),
                $cost->invoice_number
                    ? 'Hóa đơn '.$cost->invoice_number
                    : ($cost->cid ? 'CID '.$cost->cid : 'Chi phí #'.$cost->id),
            ));
        }

        foreach ($paidFirstQuotationByProject as $projectId => $success) {
            /** @var Project|null $project */
            $project = $projectMap->get($projectId);

            if (! $project
                || $success['paidAt']->format('Y-m') !== $period
                || ! $this->matchesDetailAcquisition($project, $scopeType, $scopeId)) {
                continue;
            }

            /** @var Quotation $quotation */
            $quotation = $success['quotation'];
            $beforeVatAmount = $this->acquisitionProfitBeforeVat($project, $quotation);
            $entries->push($this->detailEntry(
                'acquisition-'.$quotation->id,
                'acquisition',
                'acquisition_credit',
                'Báo phí đầu đã thu đủ',
                $success['paidAt'],
                (float) $quotation->total_amount,
                $beforeVatAmount,
                $beforeVatAmount,
                $project,
                $quotation,
                $project->project_type === 'K'
                    ? 'Phí dịch vụ tháng đầu + cọc'
                    : 'Lợi nhuận báo phí đầu',
            ));
        }

        foreach ($refunds as $refund) {
            /** @var PaymentRefund $refund */
            /** @var Quotation|null $quotation */
            $quotation = $quotationMap->get($refund->quotation_id);
            $projectId = $refund->project_id ?: $quotation?->project_id;
            /** @var Project|null $project */
            $project = $projectMap->get($projectId);

            if (! $project) {
                continue;
            }

            if ($this->matchesDetailImplementation(
                $project,
                $scopeType,
                $scopeId,
                $serviceRootIds,
                $projectRootServices,
            )) {
                $beforeVatAmount = in_array($refund->refund_type, [
                    PaymentRefund::TYPE_DEPOSIT,
                    PaymentRefund::TYPE_OVERPAYMENT,
                ], true)
                    ? 0.0
                    : $this->refundBeforeVat($refund, $quotation);
                $entries->push($this->detailEntry(
                    'implementation-refund-'.$refund->id,
                    $implementationBranch,
                    'refund',
                    'Hoàn tiền '.$this->refundTypeLabel($refund->refund_type),
                    CarbonImmutable::parse($refund->completed_at),
                    (float) $refund->amount,
                    $beforeVatAmount,
                    -$beforeVatAmount,
                    $project,
                    $quotation,
                    $refund->reference ?: $refund->reason ?: $refund->note ?: 'Hoàn tiền #'.$refund->id,
                ));
            }

            $firstSuccess = $paidFirstQuotationByProject->get($projectId);

            if (! $firstSuccess
                || (int) $firstSuccess['quotation']->id !== (int) $refund->quotation_id
                || ! $this->matchesDetailAcquisition($project, $scopeType, $scopeId)) {
                continue;
            }

            $beforeVatAmount = $this->acquisitionRefundBeforeVat($project, $refund, $quotation);
            $entries->push($this->detailEntry(
                'acquisition-refund-'.$refund->id,
                'acquisition',
                'acquisition_refund',
                'Hoàn tiền '.$this->refundTypeLabel($refund->refund_type),
                CarbonImmutable::parse($refund->completed_at),
                (float) $refund->amount,
                $beforeVatAmount,
                -$beforeVatAmount,
                $project,
                $quotation,
                $refund->reference ?: $refund->reason ?: $refund->note ?: 'Hoàn tiền #'.$refund->id,
            ));
        }

        $entries = $entries
            ->sortByDesc(fn (array $entry): string => $entry['eventAt'].'-'.$entry['id'])
            ->values();
        $branchLabels = $scopeType === KpiTarget::SCOPE_SERVICE
            || $scopeType === KpiTarget::SCOPE_SERVICE_GROUP
            ? ['service' => 'Dịch vụ']
            : [
                'implementation' => 'Nhánh triển khai',
                'acquisition' => 'Nhánh phụ trách khách hàng',
            ];
        $branches = collect($branchLabels)
            ->map(function (string $label, string $key) use ($entries): array {
                $branchEntries = $entries->where('branch', $key)->values();

                return $this->detailBranch($key, $label, $branchEntries);
            })
            ->values();

        return [
            'period' => $period,
            'scope' => [
                'type' => $scopeType,
                'id' => $scopeId,
                'name' => $scopeName,
            ],
            'totals' => $this->detailTotals($entries),
            'branches' => $branches,
        ];
    }

    private function buildMonthlyReport(
        string $periodKey,
        Collection $services,
        Collection $serviceGroups,
        Collection $departments,
        Collection $users,
        Collection $allocations,
        Collection $quotationMap,
        Collection $projectMap,
        Collection $projectRootServices,
        array $rootServiceIds,
        Collection $paidFirstQuotationByProject,
        Collection $targets,
        Collection $refunds,
        Collection $costs,
    ): array {
        $serviceActuals = $this->emptyServiceActuals($rootServiceIds);
        $departmentActuals = $this->emptyDepartmentActuals($departments->pluck('id'));
        $employeeActuals = $this->emptyEmployeeActuals($users->pluck('id'));
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
            $employeeActuals,
        );
        $this->applyCosts(
            $costs,
            $projectMap,
            $projectRootServices,
            $serviceActuals,
            $departmentActuals,
            $employeeActuals,
        );
        $this->applyAcquisitionCredits(
            $periodKey,
            $paidFirstQuotationByProject,
            $projectMap,
            $departmentActuals,
            $employeeActuals,
        );
        $this->applyRefunds(
            $refunds,
            $quotationMap,
            $projectMap,
            $projectRootServices,
            $paidFirstQuotationByProject,
            $serviceActuals,
            $departmentActuals,
            $employeeActuals,
        );

        $serviceRows = $this->buildServiceRows(
            $services,
            $serviceGroups,
            $rootServiceIds,
            $serviceActuals,
            $targetMap,
        );

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

        $employeeRows = $users
            ->map(function (User $user) use ($employeeActuals, $targetMap): array {
                $actual = $employeeActuals[(int) $user->id];
                $target = (float) ($targetMap->get(KpiTarget::SCOPE_EMPLOYEE.':'.$user->id)?->target_amount ?? 0);
                $implementationAmount = $actual['implementationReceivedBeforeVatAmount']
                    - $actual['implementationCostBeforeVatAmount']
                    - $actual['implementationRefundBeforeVatAmount'];
                $acquisitionAmount = $actual['acquisitionCreditBeforeVatAmount']
                    - $actual['acquisitionRefundBeforeVatAmount'];
                $actualAmount = $implementationAmount + $acquisitionAmount;

                return [
                    'id' => (int) $user->id,
                    'scopeType' => KpiTarget::SCOPE_EMPLOYEE,
                    'code' => $user->code,
                    'name' => $user->name,
                    'departmentId' => $user->department_id ? (int) $user->department_id : null,
                    'departmentName' => $user->department?->name,
                    'isActive' => (bool) $user->is_active && ! $user->trashed(),
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
            'employees' => $employeeRows,
            'summary' => [
                'services' => $this->summary($serviceRows),
                'departments' => $this->summary($departmentRows),
                'employees' => $this->summary($employeeRows),
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
        array &$employeeActuals,
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

                $managerUserId = $project?->manager_user_id;

                if ($managerUserId && isset($employeeActuals[$managerUserId])) {
                    $employeeActuals[$managerUserId]['implementationReceivedAmount'] += $receivedAmount;
                    $employeeActuals[$managerUserId]['implementationReceivedBeforeVatAmount'] +=
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
        array &$employeeActuals,
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

            $managerUserId = $project?->manager_user_id;

            if ($managerUserId && isset($employeeActuals[$managerUserId])) {
                $employeeActuals[$managerUserId]['implementationCostAmount'] += $amounts['gross'];
                $employeeActuals[$managerUserId]['implementationCostBeforeVatAmount'] +=
                    $amounts['beforeVat'];
            }
        }
    }

    private function applyAcquisitionCredits(
        string $periodKey,
        Collection $paidFirstQuotationByProject,
        Collection $projectMap,
        array &$departmentActuals,
        array &$employeeActuals,
    ): void {
        foreach ($paidFirstQuotationByProject as $projectId => $success) {
            if ($success['paidAt']->format('Y-m') !== $periodKey) {
                continue;
            }

            $project = $projectMap->get($projectId);
            $departmentId = $project?->customer?->salesUser?->department_id;
            /** @var Quotation $quotation */
            $quotation = $success['quotation'];

            if ($departmentId && isset($departmentActuals[$departmentId])) {
                $departmentActuals[$departmentId]['acquisitionCreditAmount'] += (float) $quotation->total_amount;
                $departmentActuals[$departmentId]['acquisitionCreditBeforeVatAmount'] +=
                    $this->acquisitionProfitBeforeVat($project, $quotation);
            }

            $salesUserId = $project?->customer?->sales_user_id;

            if ($salesUserId && isset($employeeActuals[$salesUserId])) {
                $employeeActuals[$salesUserId]['acquisitionCreditAmount'] += (float) $quotation->total_amount;
                $employeeActuals[$salesUserId]['acquisitionCreditBeforeVatAmount'] +=
                    $this->acquisitionProfitBeforeVat($project, $quotation);
            }
        }
    }

    private function applyRefunds(
        Collection $refunds,
        Collection $quotationMap,
        Collection $projectMap,
        Collection $projectRootServices,
        Collection $paidFirstQuotationByProject,
        array &$serviceActuals,
        array &$departmentActuals,
        array &$employeeActuals,
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

            $managerUserId = $project?->manager_user_id;

            if ($managerUserId && isset($employeeActuals[$managerUserId])) {
                $employeeActuals[$managerUserId]['implementationRefundAmount'] += $refundAmount;
                $employeeActuals[$managerUserId]['implementationRefundBeforeVatAmount'] +=
                    $serviceRefundBeforeVatAmount;
            }

            $firstSuccess = $paidFirstQuotationByProject->get($projectId);

            if (! $firstSuccess || (int) $firstSuccess['quotation']->id !== (int) $refund->quotation_id) {
                continue;
            }

            $acquisitionDepartmentId = $project?->customer?->salesUser?->department_id;

            if ($acquisitionDepartmentId && isset($departmentActuals[$acquisitionDepartmentId])) {
                $acquisitionRefundBeforeVatAmount = $this->acquisitionRefundBeforeVat(
                    $project,
                    $refund,
                    $quotation,
                );
                $departmentActuals[$acquisitionDepartmentId]['acquisitionRefundAmount'] += $refundAmount;
                $departmentActuals[$acquisitionDepartmentId]['acquisitionRefundBeforeVatAmount'] +=
                    $acquisitionRefundBeforeVatAmount;
            }

            $salesUserId = $project?->customer?->sales_user_id;

            if ($salesUserId && isset($employeeActuals[$salesUserId])) {
                $acquisitionRefundBeforeVatAmount = $this->acquisitionRefundBeforeVat(
                    $project,
                    $refund,
                    $quotation,
                );
                $employeeActuals[$salesUserId]['acquisitionRefundAmount'] += $refundAmount;
                $employeeActuals[$salesUserId]['acquisitionRefundBeforeVatAmount'] +=
                    $acquisitionRefundBeforeVatAmount;
            }
        }
    }

    /** @return array{0: string, 1: array<int>, 2: User|null} */
    private function detailScopeContext(string $scopeType, int $scopeId): array
    {
        if ($scopeType === KpiTarget::SCOPE_SERVICE) {
            $service = Service::query()
                ->withTrashed()
                ->whereKey($scopeId)
                ->whereNull('parent_id')
                ->first();

            if ($service) {
                return [collect([$service->code, $service->name])->filter()->implode(' - '), [$scopeId], null];
            }
        }

        if ($scopeType === KpiTarget::SCOPE_SERVICE_GROUP) {
            $group = Option::query()
                ->whereKey($scopeId)
                ->where('group', Option::GROUP_SERVICE_KPI)
                ->where('is_active', true)
                ->first();

            if ($group) {
                $memberIds = collect(($group->meta ?? [])['serviceRootIds'] ?? [])
                    ->map(fn ($id): int => (int) $id)
                    ->filter()
                    ->unique()
                    ->values()
                    ->all();

                return [$group->label ?: $group->value ?: $group->key, $memberIds, null];
            }
        }

        if ($scopeType === KpiTarget::SCOPE_DEPARTMENT) {
            $department = Department::query()->find($scopeId);

            if ($department) {
                return [$department->name, [], null];
            }
        }

        if ($scopeType === KpiTarget::SCOPE_EMPLOYEE) {
            $user = User::query()->withTrashed()->find($scopeId);

            if ($user) {
                return [collect([$user->code, $user->name])->filter()->implode(' - '), [], $user];
            }
        }

        throw ValidationException::withMessages([
            'scope_id' => ['Đối tượng KPI không tồn tại hoặc không hợp lệ.'],
        ]);
    }

    private function authorizeDetailScope(
        User $viewer,
        string $scopeType,
        int $scopeId,
        ?User $scopeUser,
    ): void {
        $viewerScope = $this->viewerScope($viewer);

        if ($viewerScope['level'] === 'all') {
            return;
        }

        if ($scopeType === KpiTarget::SCOPE_EMPLOYEE
            && ($scopeId === (int) $viewer->id
                || ($viewerScope['level'] === 'department'
                    && in_array((int) ($scopeUser?->department_id ?? 0), $viewerScope['departmentIds'] ?? [], true)))) {
            return;
        }

        if ($scopeType === KpiTarget::SCOPE_DEPARTMENT
            && $viewerScope['level'] === 'department'
            && in_array($scopeId, $viewerScope['departmentIds'] ?? [], true)) {
            return;
        }

        throw new AuthorizationException('Bạn không có quyền xem dữ liệu đối soát KPI của đối tượng này.');
    }

    private function matchesDetailImplementation(
        Project $project,
        string $scopeType,
        int $scopeId,
        array $serviceRootIds,
        Collection $projectRootServices,
    ): bool {
        if (in_array($scopeType, [KpiTarget::SCOPE_SERVICE, KpiTarget::SCOPE_SERVICE_GROUP], true)) {
            return in_array((int) $projectRootServices->get($project->id), $serviceRootIds, true);
        }

        if ($scopeType === KpiTarget::SCOPE_DEPARTMENT) {
            return (int) ($project->managerUser?->department_id ?? 0) === $scopeId;
        }

        return $scopeType === KpiTarget::SCOPE_EMPLOYEE
            && (int) $project->manager_user_id === $scopeId;
    }

    private function matchesDetailAcquisition(Project $project, string $scopeType, int $scopeId): bool
    {
        if ($scopeType === KpiTarget::SCOPE_DEPARTMENT) {
            return (int) ($project->customer?->salesUser?->department_id ?? 0) === $scopeId;
        }

        return $scopeType === KpiTarget::SCOPE_EMPLOYEE
            && (int) ($project->customer?->sales_user_id ?? 0) === $scopeId;
    }

    private function detailEntry(
        string $id,
        string $branch,
        string $kind,
        string $label,
        CarbonImmutable $eventAt,
        float $sourceAmount,
        float $beforeVatAmount,
        float $profitImpactAmount,
        Project $project,
        ?Quotation $quotation,
        string $reference,
    ): array {
        return [
            'id' => $id,
            'branch' => $branch,
            'kind' => $kind,
            'label' => $label,
            'eventAt' => $eventAt->toIso8601String(),
            'sourceAmount' => $this->money($sourceAmount),
            'beforeVatAmount' => $this->money($beforeVatAmount),
            'profitImpactAmount' => $this->money($profitImpactAmount),
            'reference' => $reference,
            'project' => [
                'id' => (int) $project->id,
                'code' => $project->project_code,
                'name' => $project->project_name,
                'type' => $project->project_type === 'N' ? 'O' : $project->project_type,
            ],
            'quotation' => $quotation ? [
                'id' => (int) $quotation->id,
                'code' => $quotation->quotation_code,
            ] : null,
        ];
    }

    private function detailBranch(string $key, string $label, Collection $entries): array
    {
        return [
            'key' => $key,
            'label' => $label,
            'totals' => $this->detailTotals($entries),
            'entries' => $entries->all(),
        ];
    }

    private function detailTotals(Collection $entries): array
    {
        return [
            'receivedAmount' => $this->money((float) $entries
                ->whereIn('kind', ['received', 'acquisition_credit'])
                ->sum('sourceAmount')),
            'costAmount' => $this->money((float) $entries
                ->where('kind', 'cost')
                ->sum('sourceAmount')),
            'refundAmount' => $this->money((float) $entries
                ->whereIn('kind', ['refund', 'acquisition_refund'])
                ->sum('sourceAmount')),
            'profitAmount' => $this->money((float) $entries->sum('profitImpactAmount')),
        ];
    }

    private function refundTypeLabel(string $type): string
    {
        return match ($type) {
            PaymentRefund::TYPE_DEPOSIT => 'tiền cọc',
            PaymentRefund::TYPE_OVERPAYMENT => 'tiền thừa',
            PaymentRefund::TYPE_COMPENSATION => 'bồi thường',
            default => 'thanh toán',
        };
    }

    public function paidFirstQuotations(Collection $quotations, Collection $allocations): Collection
    {
        $allocationsByQuotation = $allocations->groupBy('quotation_id');
        $successes = collect();

        foreach ($quotations->groupBy('project_id') as $projectId => $projectQuotations) {
            /** @var Quotation $quotation */
            $quotation = $projectQuotations
                ->sortBy(fn (Quotation $item): string => ($item->created_at?->format('Y-m-d H:i:s.u') ?? '')
                    .'-'.str_pad((string) $item->id, 20, '0', STR_PAD_LEFT))
                ->first();

            if (! $quotation) {
                continue;
            }

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

            $successes->put($projectId, [
                'quotation' => $quotation,
                'paidAt' => $paidAt,
            ]);
        }

        return $successes;
    }

    public function acquisitionProfitBeforeVat(Project $project, Quotation $quotation): float
    {
        $depositAmount = strtoupper((string) $project->project_type) === 'K'
            ? (float) $quotation->deposit_amount
            : 0.0;

        return $this->money((float) $quotation->subtotal_amount + $depositAmount);
    }

    public function acquisitionRefundBeforeVat(
        Project $project,
        PaymentRefund $refund,
        ?Quotation $quotation,
    ): float {
        if ($refund->refund_type === PaymentRefund::TYPE_OVERPAYMENT) {
            return 0.0;
        }

        if ($refund->refund_type === PaymentRefund::TYPE_DEPOSIT
            && strtoupper((string) $project->project_type) !== 'K') {
            return 0.0;
        }

        return $this->refundBeforeVat($refund, $quotation);
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

    private function buildServiceRows(
        Collection $services,
        Collection $serviceGroups,
        array $rootServiceIds,
        array $serviceActuals,
        Collection $targetMap,
    ): Collection {
        $rootServices = $services
            ->filter(fn (Service $service): bool => in_array((int) $service->id, $rootServiceIds, true))
            ->keyBy('id');
        $assignedRootIds = [];

        $groupRows = $serviceGroups
            ->map(function (Option $group) use (
                $rootServices,
                $serviceActuals,
                $targetMap,
                &$assignedRootIds,
            ): ?array {
                $memberIds = collect(($group->meta ?? [])['serviceRootIds'] ?? [])
                    ->map(fn ($id): int => (int) $id)
                    ->filter(fn (int $id): bool => $rootServices->has($id)
                        && ! in_array($id, $assignedRootIds, true))
                    ->unique()
                    ->values();

                if ($memberIds->isEmpty()) {
                    return null;
                }

                $assignedRootIds = array_merge($assignedRootIds, $memberIds->all());
                $members = $memberIds
                    ->map(fn (int $id): Service => $rootServices->get($id))
                    ->values();
                $actual = $this->sumServiceActuals($memberIds, $serviceActuals);
                $groupTarget = $targetMap->get(KpiTarget::SCOPE_SERVICE_GROUP.':'.$group->id);
                $target = $groupTarget
                    ? (float) $groupTarget->target_amount
                    : (float) $memberIds->sum(fn (int $id): float => (float) (
                        $targetMap->get(KpiTarget::SCOPE_SERVICE.':'.$id)?->target_amount ?? 0
                    ));

                return $this->serviceRow(
                    (int) $group->id,
                    KpiTarget::SCOPE_SERVICE_GROUP,
                    $members->pluck('code')->implode(' + '),
                    $group->label,
                    $members->contains(fn (Service $service): bool => $service->is_active && ! $service->trashed()),
                    false,
                    $target,
                    $actual,
                    $members,
                    (int) ($members->min('sort_order') ?? 0),
                );
            })
            ->filter();

        $serviceRows = $rootServices
            ->reject(fn (Service $service): bool => in_array((int) $service->id, $assignedRootIds, true))
            ->map(function (Service $service) use ($serviceActuals, $targetMap): array {
                $target = (float) (
                    $targetMap->get(KpiTarget::SCOPE_SERVICE.':'.$service->id)?->target_amount ?? 0
                );

                return $this->serviceRow(
                    (int) $service->id,
                    KpiTarget::SCOPE_SERVICE,
                    $service->code,
                    $service->name,
                    (bool) $service->is_active && ! $service->trashed(),
                    $service->trashed(),
                    $target,
                    $serviceActuals[(int) $service->id],
                    collect([$service]),
                    (int) $service->sort_order,
                );
            });

        return $groupRows
            ->concat($serviceRows)
            ->sortBy('sortOrder')
            ->values()
            ->map(function (array $row): array {
                unset($row['sortOrder']);

                return $row;
            });
    }

    private function sumServiceActuals(Collection $serviceIds, array $serviceActuals): array
    {
        $fields = [
            'receivedAmount',
            'costAmount',
            'refundAmount',
            'receivedBeforeVatAmount',
            'costBeforeVatAmount',
            'refundBeforeVatAmount',
        ];

        return collect($fields)->mapWithKeys(fn (string $field): array => [
            $field => (float) $serviceIds->sum(fn (int $id): float => (float) (
                $serviceActuals[$id][$field] ?? 0
            )),
        ])->all();
    }

    private function serviceRow(
        int $id,
        string $scopeType,
        string $code,
        string $name,
        bool $isActive,
        bool $isDeleted,
        float $target,
        array $actual,
        Collection $members,
        int $sortOrder,
    ): array {
        $actualAmount = $actual['receivedBeforeVatAmount']
            - $actual['costBeforeVatAmount']
            - $actual['refundBeforeVatAmount'];

        return [
            'id' => $id,
            'scopeType' => $scopeType,
            'code' => $code,
            'name' => $name,
            'isActive' => $isActive,
            'isDeleted' => $isDeleted,
            'memberServices' => $members->map(fn (Service $service): array => [
                'id' => (int) $service->id,
                'code' => $service->code,
                'name' => $service->name,
            ])->values()->all(),
            'targetAmount' => $this->money($target),
            'receivedAmount' => $this->money($actual['receivedAmount']),
            'costAmount' => $this->money($actual['costAmount']),
            'refundAmount' => $this->money($actual['refundAmount']),
            'actualAmount' => $this->money($actualAmount),
            'completionRate' => $this->completionRate($actualAmount, $target),
            'sortOrder' => $sortOrder,
        ];
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

    private function emptyEmployeeActuals(Collection $userIds): array
    {
        return $userIds->mapWithKeys(fn ($id): array => [
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
            KpiTarget::SCOPE_SERVICE_GROUP => Option::query()
                ->whereKey($scopeId)
                ->where('group', Option::GROUP_SERVICE_KPI)
                ->where('is_active', true)
                ->exists(),
            KpiTarget::SCOPE_DEPARTMENT => Department::query()->whereKey($scopeId)->exists(),
            KpiTarget::SCOPE_EMPLOYEE => User::query()->whereKey($scopeId)->exists(),
            default => false,
        };

        if (! $exists) {
            throw ValidationException::withMessages([
                'scopeId' => ['Đối tượng KPI không tồn tại hoặc không hợp lệ.'],
            ]);
        }
    }

    private function authorizeTargetManagement(string $scopeType, int $scopeId): void
    {
        $viewer = $this->currentUser();

        if (! $viewer) {
            throw new AuthorizationException('Bạn không có quyền cập nhật kế hoạch KPI.');
        }

        if ($viewer->hasPermission('kpi.manage_all')) {
            return;
        }

        if ($viewer->hasPermission('kpi.manage_department')) {
            $departmentIds = $viewer->accessibleDepartmentIds();
            $isDepartmentTarget = $scopeType === KpiTarget::SCOPE_DEPARTMENT
                && in_array($scopeId, $departmentIds, true);
            $isEmployeeTarget = $scopeType === KpiTarget::SCOPE_EMPLOYEE
                && User::query()
                    ->whereKey($scopeId)
                    ->whereIn('department_id', $departmentIds)
                    ->exists();

            if ($isDepartmentTarget || $isEmployeeTarget) {
                return;
            }
        }

        if ($viewer->hasPermission('kpi.manage')
            && $scopeType === KpiTarget::SCOPE_EMPLOYEE
            && $scopeId === (int) $viewer->id) {
            return;
        }

        throw new AuthorizationException('Bạn chỉ được lập KPI cho nhân sự và phòng ban trong phạm vi quản lý.');
    }

    private function money(float $amount): float
    {
        return round($amount, 2);
    }

    private function viewerScope(User $viewer): array
    {
        if ($viewer->hasPermission('kpi.view_all') || $viewer->hasPermission('kpi.manage_all')) {
            return $this->allViewerScope($viewer);
        }

        $departmentIds = $viewer->accessibleDepartmentIds();

        if (($viewer->hasPermission('kpi.view_department')
            || $viewer->hasPermission('kpi.manage_department'))
            && $departmentIds !== []) {
            return [
                'level' => 'department',
                'userId' => (int) $viewer->id,
                'departmentId' => $departmentIds[0] ?? null,
                'departmentIds' => $departmentIds,
            ];
        }

        return [
            'level' => 'own',
            'userId' => (int) $viewer->id,
            'departmentId' => $viewer->department_id ? (int) $viewer->department_id : null,
            'departmentIds' => $departmentIds,
        ];
    }

    private function allViewerScope(?User $viewer = null): array
    {
        return [
            'level' => 'all',
            'userId' => $viewer ? (int) $viewer->id : null,
            'departmentId' => $viewer?->department_id ? (int) $viewer->department_id : null,
            'departmentIds' => $viewer?->accessibleDepartmentIds() ?? [],
        ];
    }

    private function scopePeriods(Collection $periods, array $scope): Collection
    {
        return $periods
            ->map(function (array $period) use ($scope): array {
                $services = collect($period['services']);
                $departments = collect($period['departments']);
                $employees = collect($period['employees'])
                    ->filter(fn (array $employee): bool => (bool) ($employee['isActive'] ?? false)
                        || $this->employeeHasKpiData($employee))
                    ->values();

                if ($scope['level'] === 'department') {
                    $services = collect();
                    $departments = $departments
                        ->whereIn('id', $scope['departmentIds'] ?? [])
                        ->values();
                    $employees = $employees
                        ->whereIn('departmentId', $scope['departmentIds'] ?? [])
                        ->values();
                } elseif ($scope['level'] === 'own') {
                    $services = collect();
                    $departments = collect();
                    $employees = $employees
                        ->where('id', $scope['userId'])
                        ->values();
                }

                $period['services'] = $services->values();
                $period['departments'] = $departments->values();
                $period['employees'] = $employees->values();
                $period['summary'] = [
                    'services' => $this->summary($services),
                    'departments' => $this->summary($departments),
                    'employees' => $this->summary($employees),
                ];

                return $period;
            })
            ->values();
    }

    private function employeeHasKpiData(array $employee): bool
    {
        foreach ([
            'targetAmount',
            'implementationReceivedAmount',
            'implementationCostAmount',
            'implementationRefundAmount',
            'acquisitionCreditAmount',
            'acquisitionRefundAmount',
        ] as $field) {
            if (abs((float) ($employee[$field] ?? 0)) >= self::MONEY_EPSILON) {
                return true;
            }
        }

        return false;
    }
}

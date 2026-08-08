<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Department;
use App\Models\Lead;
use App\Models\Option;
use App\Models\PaymentAllocation;
use App\Models\PaymentRefund;
use App\Models\Project;
use App\Models\ProjectCost;
use App\Models\ProjectCostAdjustment;
use App\Models\Quotation;
use App\Models\User;
use App\Repositories\KpiReportRepository;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class DashboardService extends BaseService
{
    private const MONEY_EPSILON = 0.01;

    public function __construct(
        private readonly KpiService $kpi,
        private readonly KpiReportRepository $reports,
        private readonly MeetingsService $meetings,
        private readonly WeeklyReportsService $weeklyReports,
    ) {}

    public function report(?string $periodFrom = null, ?string $periodTo = null): array
    {
        /** @var User $currentUser */
        $currentUser = $this->currentUser();
        $scope = $this->dashboardScope($currentUser);
        [$rangeStart, $rangeEnd] = $this->periodRange($periodFrom, $periodTo);
        $monthCount = $rangeStart->diffInMonths($rangeEnd) + 1;
        $previousEnd = $rangeStart->subMonth();
        $previousStart = $previousEnd->subMonths($monthCount - 1);

        $currentReport = $this->kpi->report(
            $rangeStart->format('Y-m'),
            $rangeEnd->format('Y-m'),
        );
        $previousReport = $this->kpi->report(
            $previousStart->format('Y-m'),
            $previousEnd->format('Y-m'),
        );

        $allServices = $this->aggregateServices($currentReport['periods']);
        $allDepartments = $this->aggregateDepartments($currentReport['periods']);
        $allEmployees = $this->aggregateEmployees($currentReport['periods']);
        $previousServices = $this->aggregateServices($previousReport['periods']);
        $previousDepartments = $this->aggregateDepartments($previousReport['periods']);
        $previousEmployees = $this->aggregateEmployees($previousReport['periods']);

        $projects = $this->reports->activeProjects();
        $scopedProjects = $this->scopeProjectCollection($projects, $currentUser, $scope['level']);
        $services = $scope['level'] === 'all' ? $allServices : [];
        $departments = $this->scopeDepartmentRows($allDepartments, $scope);
        $employees = $this->enrichEmployeeProjectMetrics(
            $this->scopeEmployeeRows($allEmployees, $scope),
            $projects,
        );

        $currentSummary = $this->financialSummary(
            $scope,
            $allServices,
            $allDepartments,
            $allEmployees,
        );
        $previousSummary = $this->financialSummary(
            $scope,
            $previousServices,
            $previousDepartments,
            $previousEmployees,
        );
        $rangeEndExclusive = $rangeEnd->addMonth();
        $previousEndExclusive = $previousEnd->addMonth();
        $newCustomerCount = $this->newCustomerCount(
            $rangeStart,
            $rangeEndExclusive,
            $currentUser,
        );
        $previousNewCustomerCount = $this->newCustomerCount(
            $previousStart,
            $previousEndExclusive,
            $currentUser,
        );

        $projectIds = $projects->pluck('id');
        $quotations = $this->reports->quotations($projectIds);
        $quotationIds = $quotations->pluck('id');
        $allocations = $this->reports->allocations($quotationIds);
        $refunds = $this->reports->completedRefunds(
            $previousStart->toDateTimeString(),
            $rangeEndExclusive->toDateTimeString(),
            $projectIds,
            $quotationIds,
        );
        $costs = $this->reports->completedCosts(
            $previousStart->toDateString(),
            $rangeEndExclusive->toDateString(),
            $projectIds,
        );
        $scopedProjectIds = $scopedProjects->pluck('id');
        $scopedQuotations = $quotations
            ->whereIn('project_id', $scopedProjectIds)
            ->values();
        $scopedQuotationIds = $scopedQuotations->pluck('id');
        $scopedAllocations = $allocations
            ->whereIn('quotation_id', $scopedQuotationIds)
            ->values();
        $scopedRefunds = $refunds
            ->filter(fn (PaymentRefund $refund): bool => $scopedProjectIds->contains($refund->project_id)
                || $scopedQuotationIds->contains($refund->quotation_id))
            ->values();
        $operations = $this->operationalOverview(
            $rangeStart,
            $rangeEndExclusive,
            $previousStart,
            $previousEndExclusive,
            $newCustomerCount,
            $previousNewCustomerCount,
            $currentUser,
        );

        return [
            'periodFrom' => $rangeStart->format('Y-m'),
            'periodTo' => $rangeEnd->format('Y-m'),
            'comparison' => [
                'periodFrom' => $previousStart->format('Y-m'),
                'periodTo' => $previousEnd->format('Y-m'),
            ],
            'scope' => $scope,
            'calculationBasis' => $currentReport['calculationBasis'],
            'summary' => [
                'receivedAmount' => $currentSummary['receivedAmount'],
                'receivedChangeRate' => $this->changeRate(
                    $currentSummary['receivedAmount'],
                    $previousSummary['receivedAmount'],
                ),
                'newCustomerCount' => $newCustomerCount,
                'newCustomerChangeRate' => $this->changeRate(
                    $newCustomerCount,
                    $previousNewCustomerCount,
                ),
                'profitAmount' => $currentSummary['profitAmount'],
                'profitChangeRate' => $this->changeRate(
                    $currentSummary['profitAmount'],
                    $previousSummary['profitAmount'],
                ),
                'targetAmount' => $currentSummary['targetAmount'],
                'completionRate' => $this->completionRate(
                    $currentSummary['profitAmount'],
                    $currentSummary['targetAmount'],
                ),
            ],
            'operations' => $operations,
            'trend' => $this->buildTrend(
                $rangeStart,
                $rangeEnd,
                $previousStart,
                $previousEnd,
                $scopedQuotations,
                $scopedAllocations,
                $scopedRefunds,
            ),
            'profitTrend' => $scope['level'] === 'all'
                ? null
                : $this->buildProfitTrend(
                    $rangeStart,
                    $rangeEnd,
                    $previousStart,
                    $previousEnd,
                    $scope,
                    $projects,
                    $quotations,
                    $allocations,
                    $refunds,
                    $costs,
                ),
            'services' => $services,
            'departments' => $departments,
            'employees' => $employees,
            'updatedAt' => CarbonImmutable::now()->toIso8601String(),
        ];
    }

    private function operationalOverview(
        CarbonImmutable $rangeStart,
        CarbonImmutable $rangeEndExclusive,
        CarbonImmutable $previousStart,
        CarbonImmutable $previousEndExclusive,
        int $newCustomerCount,
        int $previousNewCustomerCount,
        User $currentUser,
    ): array {
        $newLeadQuery = $this->scopedLeadQuery($currentUser)
            ->where('occurred_date', '>=', $rangeStart->toDateString())
            ->where('occurred_date', '<', $rangeEndExclusive->toDateString());
        $previousNewLeadCount = $this->scopedLeadQuery($currentUser)
            ->where('occurred_date', '>=', $previousStart->toDateString())
            ->where('occurred_date', '<', $previousEndExclusive->toDateString())
            ->count();
        $newLeadCount = (clone $newLeadQuery)->count();
        $convertedNewLeadCount = (clone $newLeadQuery)
            ->whereNotNull('converted_customer_id')
            ->count();

        $newProjectCount = $this->newProjectCount(
            $rangeStart,
            $rangeEndExclusive,
            $currentUser,
        );
        $previousNewProjectCount = $this->newProjectCount(
            $previousStart,
            $previousEndExclusive,
            $currentUser,
        );
        $managedProjectCount = $this->scopedProjectQuery($currentUser)
            ->where('created_at', '<', $rangeEndExclusive)
            ->count();
        $previousManagedProjectCount = $this->scopedProjectQuery($currentUser)
            ->where('created_at', '<', $previousEndExclusive)
            ->count();
        $meetingSummary = $currentUser->hasPermission('meeting.view')
            ? $this->meetings->summary()
            : null;
        $weeklyReportSummary = $currentUser->hasPermission('weeklyreport.view')
            ? ($this->weeklyReports->board([], 1, 1)['meta']['summary'] ?? null)
            : null;

        return [
            'leads' => [
                'newCount' => $newLeadCount,
                'newChangeRate' => $this->changeRate($newLeadCount, $previousNewLeadCount),
                'convertedFromNewCount' => $convertedNewLeadCount,
                'conversionRate' => $newLeadCount > 0
                    ? round($convertedNewLeadCount / $newLeadCount * 100, 2)
                    : null,
                'openCount' => $this->scopedLeadQuery($currentUser)
                    ->whereNull('converted_customer_id')
                    ->count(),
                'totalCount' => $this->scopedLeadQuery($currentUser)->count(),
            ],
            'customers' => [
                'newCount' => $newCustomerCount,
                'newChangeRate' => $this->changeRate(
                    $newCustomerCount,
                    $previousNewCustomerCount,
                ),
                'totalCount' => $this->scopedCustomerQuery($currentUser)->count(),
            ],
            'projects' => [
                'newCount' => $newProjectCount,
                'newChangeRate' => $this->changeRate(
                    $newProjectCount,
                    $previousNewProjectCount,
                ),
                'totalCount' => $this->scopedProjectQuery($currentUser)->count(),
                'managedChangeRate' => $this->changeRate(
                    $managedProjectCount,
                    $previousManagedProjectCount,
                ),
                'statuses' => $this->projectStatusOverview($currentUser),
            ],
            'meetings' => $meetingSummary,
            'weeklyReports' => $weeklyReportSummary,
        ];
    }

    private function newProjectCount(
        CarbonImmutable $rangeStart,
        CarbonImmutable $rangeEndExclusive,
        User $currentUser,
    ): int {
        return $this->scopedProjectQuery($currentUser)
            ->where('created_at', '>=', $rangeStart)
            ->where('created_at', '<', $rangeEndExclusive)
            ->count();
    }

    private function projectStatusOverview(User $currentUser): array
    {
        $rows = Option::query()
            ->where('group', Option::GROUP_PROJECT_STATUS)
            ->orderBy('sort_order')
            ->orderBy('label')
            ->get()
            ->map(function (Option $option) use ($currentUser): array {
                $color = is_array($option->meta) ? ($option->meta['color'] ?? null) : null;

                return [
                    'id' => (int) $option->id,
                    'key' => $option->key,
                    'label' => $option->label,
                    'color' => is_string($color) && trim($color) !== '' ? $color : '#64748b',
                    'count' => $this->scopedProjectQuery($currentUser)
                        ->where('status_option_id', $option->id)
                        ->count(),
                ];
            })
            ->filter(fn (array $row): bool => $row['count'] > 0)
            ->values();
        $withoutStatus = $this->scopedProjectQuery($currentUser)
            ->whereNull('status_option_id')
            ->count();

        if ($withoutStatus > 0) {
            $rows->push([
                'id' => 0,
                'key' => null,
                'label' => 'Chưa có trạng thái',
                'color' => '#94a3b8',
                'count' => $withoutStatus,
            ]);
        }

        return $rows->all();
    }

    private function dashboardScope(User $user): array
    {
        $departmentIds = $user->accessibleDepartmentIds();
        $departmentNames = Department::query()
            ->whereIn('id', $departmentIds)
            ->orderBy('name')
            ->pluck('name');
        $departmentName = $user->department_id
            ? $user->department()->value('name')
            : null;

        if ($user->hasPermission('project.view_all')) {
            return [
                'level' => 'all',
                'label' => 'Toàn hệ thống',
                'userId' => (int) $user->id,
                'userName' => $user->name,
                'departmentId' => $user->department_id ? (int) $user->department_id : null,
                'departmentIds' => $departmentIds,
                'departmentName' => $departmentName,
                'targetLabel' => 'Kế hoạch toàn công ty',
            ];
        }

        if ($user->hasPermission('project.view_department') && $departmentIds !== []) {
            return [
                'level' => 'department',
                'label' => $departmentNames->count() === 1
                    ? (string) $departmentNames->first()
                    : $departmentNames->count().' phòng ban phụ trách',
                'userId' => (int) $user->id,
                'userName' => $user->name,
                'departmentId' => $departmentIds[0] ?? null,
                'departmentIds' => $departmentIds,
                'departmentName' => $departmentNames->implode(', '),
                'targetLabel' => 'Kế hoạch phòng ban',
            ];
        }

        return [
            'level' => 'own',
            'label' => 'Dữ liệu của tôi',
            'userId' => (int) $user->id,
            'userName' => $user->name,
            'departmentId' => $user->department_id ? (int) $user->department_id : null,
            'departmentIds' => $user->department_id ? [(int) $user->department_id] : [],
            'departmentName' => $departmentName,
            'targetLabel' => $departmentName ? 'Kế hoạch phòng ban' : 'Chưa có kế hoạch',
        ];
    }

    private function scopedLeadQuery(User $user): Builder
    {
        $query = Lead::query();

        if ($user->hasPermission('lead.view_all')) {
            return $query;
        }

        $departmentIds = $user->accessibleDepartmentIds();

        if ($user->hasPermission('lead.view_department') && $departmentIds !== []) {
            return $query->whereHas(
                'assignedUser',
                fn (Builder $assigned) => $assigned->whereIn('department_id', $departmentIds),
            );
        }

        return $query->where('assigned_user_id', $user->id);
    }

    private function scopedCustomerQuery(User $user): Builder
    {
        $query = Customer::query();

        if ($user->hasPermission('customer.view_all')) {
            return $query;
        }

        $departmentIds = $user->accessibleDepartmentIds();

        if ($user->hasPermission('customer.view_department') && $departmentIds !== []) {
            return $query->whereHas(
                'salesUser',
                fn (Builder $sales) => $sales->whereIn('department_id', $departmentIds),
            );
        }

        return $query->where('sales_user_id', $user->id);
    }

    private function scopedProjectQuery(User $user): Builder
    {
        $query = Project::query();

        if ($user->hasPermission('project.view_all')) {
            return $query;
        }

        $departmentIds = $user->accessibleDepartmentIds();

        if ($user->hasPermission('project.view_department') && $departmentIds !== []) {
            return $query->where(function (Builder $scope) use ($departmentIds): void {
                $scope
                    ->whereHas(
                        'managerUser',
                        fn (Builder $manager) => $manager->whereIn('department_id', $departmentIds),
                    )
                    ->orWhereHas(
                        'salesUser',
                        fn (Builder $sales) => $sales->whereIn('department_id', $departmentIds),
                    );
            });
        }

        return $query->where(function (Builder $scope) use ($user): void {
            $scope
                ->where('manager_user_id', $user->id)
                ->orWhere('sales_user_id', $user->id);
        });
    }

    private function scopeProjectCollection(
        Collection $projects,
        User $user,
        string $level,
    ): Collection {
        if ($level === 'all') {
            return $projects->values();
        }

        $departmentIds = $user->accessibleDepartmentIds();

        if ($level === 'department' && $departmentIds !== []) {
            return $projects
                ->filter(fn (Project $project): bool => in_array((int) ($project->managerUser?->department_id ?? 0), $departmentIds, true)
                    || in_array((int) ($project->salesUser?->department_id ?? 0), $departmentIds, true))
                ->values();
        }

        return $projects
            ->filter(fn (Project $project): bool => (int) $project->manager_user_id === (int) $user->id
                || (int) $project->sales_user_id === (int) $user->id)
            ->values();
    }

    private function scopeDepartmentRows(array $rows, array $scope): array
    {
        if ($scope['level'] === 'all') {
            return $rows;
        }

        if (($scope['departmentIds'] ?? []) === []) {
            return [];
        }

        return collect($rows)
            ->whereIn('id', $scope['departmentIds'])
            ->values()
            ->all();
    }

    private function scopeEmployeeRows(array $rows, array $scope): array
    {
        if ($scope['level'] === 'all') {
            return $rows;
        }

        $collection = collect($rows);

        if ($scope['level'] === 'department') {
            return $collection
                ->whereIn('departmentId', $scope['departmentIds'] ?? [])
                ->values()
                ->all();
        }

        return $collection
            ->where('id', $scope['userId'])
            ->values()
            ->all();
    }

    private function financialSummary(
        array $scope,
        array $services,
        array $departments,
        array $employees,
    ): array {
        if ($scope['level'] === 'all') {
            return $this->serviceSummary($services);
        }

        if ($scope['level'] === 'department') {
            $departmentRows = collect($departments)
                ->whereIn('id', $scope['departmentIds'] ?? []);
            $profitAmount = (float) $departmentRows->sum('actualAmount');
            $targetAmount = (float) $departmentRows->sum('targetAmount');

            return [
                'receivedAmount' => $this->money(
                    (float) $departmentRows->sum('implementationReceivedAmount')
                    + (float) $departmentRows->sum('acquisitionCreditAmount'),
                ),
                'profitAmount' => $this->money($profitAmount),
                'targetAmount' => $this->money($targetAmount),
                'completionRate' => $this->completionRate($profitAmount, $targetAmount),
            ];
        }

        $employee = collect($employees)->firstWhere('id', $scope['userId']);
        $profitAmount = (float) ($employee['actualAmount'] ?? 0);
        $targetAmount = (float) ($employee['targetAmount'] ?? 0);

        return [
            'receivedAmount' => $this->money(
                (float) ($employee['implementationReceivedAmount'] ?? 0)
                + (float) ($employee['acquisitionCreditAmount'] ?? 0),
            ),
            'profitAmount' => $this->money($profitAmount),
            'targetAmount' => $this->money($targetAmount),
            'completionRate' => $this->completionRate($profitAmount, $targetAmount),
        ];
    }

    private function enrichEmployeeProjectMetrics(array $employees, Collection $projects): array
    {
        return collect($employees)
            ->map(function (array $employee) use ($projects): array {
                $managedProjects = $projects
                    ->filter(fn (Project $project): bool => (int) $project->manager_user_id === (int) $employee['id']);
                $statusCounts = $managedProjects
                    ->groupBy(fn (Project $project): string => $this->projectHealthBucket(
                        $project->statusOption?->key,
                        $project->statusOption?->label,
                    ))
                    ->map->count();

                return array_merge($employee, [
                    'projectCount' => $managedProjects->count(),
                    'activeProjectCount' => (int) $statusCounts->get('active', 0),
                    'pausedProjectCount' => (int) $statusCounts->get('paused', 0),
                    'stoppedProjectCount' => (int) $statusCounts->get('stopped', 0),
                    'otherProjectCount' => (int) $statusCounts->get('other', 0),
                ]);
            })
            ->filter(fn (array $employee): bool => $this->employeeHasDashboardData($employee))
            ->values()
            ->all();
    }

    private function employeeHasDashboardData(array $employee): bool
    {
        if ((int) ($employee['projectCount'] ?? 0) > 0) {
            return true;
        }

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

    private function projectHealthBucket(?string $key, ?string $label): string
    {
        $value = mb_strtolower(trim(($key ?? '').' '.($label ?? '')));

        if (str_contains($value, 'active') || str_contains($value, 'đang chạy')) {
            return 'active';
        }

        if (str_contains($value, 'pause') || str_contains($value, 'paused') || str_contains($value, 'tạm dừng')) {
            return 'paused';
        }

        if (str_contains($value, 'stop') || str_contains($value, 'dừng') || str_contains($value, 'cancel')) {
            return 'stopped';
        }

        return 'other';
    }

    private function aggregateServices(Collection|array $periods): array
    {
        $amountFields = [
            'targetAmount',
            'receivedAmount',
            'costAmount',
            'refundAmount',
            'actualAmount',
        ];

        return collect($periods)
            ->flatMap(fn (array $period): array => collect($period['services'])->all())
            ->groupBy(fn (array $row): string => $row['scopeType'].':'.$row['id'])
            ->map(function (Collection $rows) use ($amountFields): array {
                $result = $rows->first();

                foreach ($amountFields as $field) {
                    $result[$field] = $this->money((float) $rows->sum($field));
                }

                $result['completionRate'] = $this->completionRate(
                    $result['actualAmount'],
                    $result['targetAmount'],
                );

                return $result;
            })
            ->sortByDesc('actualAmount')
            ->values()
            ->all();
    }

    private function aggregateDepartments(Collection|array $periods): array
    {
        $amountFields = [
            'targetAmount',
            'implementationReceivedAmount',
            'implementationCostAmount',
            'implementationRefundAmount',
            'implementationAmount',
            'acquisitionCreditAmount',
            'acquisitionRefundAmount',
            'acquisitionAmount',
            'actualAmount',
        ];

        return collect($periods)
            ->flatMap(fn (array $period): array => collect($period['departments'])->all())
            ->groupBy('id')
            ->map(function (Collection $rows) use ($amountFields): array {
                $result = $rows->first();

                foreach ($amountFields as $field) {
                    $result[$field] = $this->money((float) $rows->sum($field));
                }

                $result['completionRate'] = $this->completionRate(
                    $result['actualAmount'],
                    $result['targetAmount'],
                );

                return $result;
            })
            ->sortByDesc('actualAmount')
            ->values()
            ->all();
    }

    private function aggregateEmployees(Collection|array $periods): array
    {
        $amountFields = [
            'targetAmount',
            'implementationReceivedAmount',
            'implementationCostAmount',
            'implementationRefundAmount',
            'implementationAmount',
            'acquisitionCreditAmount',
            'acquisitionRefundAmount',
            'acquisitionAmount',
            'actualAmount',
        ];

        return collect($periods)
            ->flatMap(fn (array $period): array => collect($period['employees'] ?? [])->all())
            ->groupBy('id')
            ->map(function (Collection $rows) use ($amountFields): array {
                $result = $rows->first();

                foreach ($amountFields as $field) {
                    $result[$field] = $this->money((float) $rows->sum($field));
                }

                $result['completionRate'] = $this->completionRate(
                    $result['actualAmount'],
                    $result['targetAmount'],
                );

                return $result;
            })
            ->sortByDesc('actualAmount')
            ->values()
            ->all();
    }

    private function serviceSummary(array $services): array
    {
        $rows = collect($services);

        return [
            'receivedAmount' => $this->money((float) $rows->sum('receivedAmount')),
            'profitAmount' => $this->money((float) $rows->sum('actualAmount')),
            'targetAmount' => $this->money((float) $rows->sum('targetAmount')),
        ];
    }

    private function buildTrend(
        CarbonImmutable $rangeStart,
        CarbonImmutable $rangeEnd,
        CarbonImmutable $previousStart,
        CarbonImmutable $previousEnd,
        Collection $quotations,
        Collection $allocations,
        Collection $refunds,
    ): array {
        $granularity = $rangeStart->format('Y-m') === $rangeEnd->format('Y-m') ? 'day' : 'month';
        $currentBuckets = $this->bucketStarts($rangeStart, $rangeEnd, $granularity);
        $previousBuckets = $this->bucketStarts($previousStart, $previousEnd, $granularity);
        $currentValues = $this->emptyTrendValues($currentBuckets, $granularity);
        $previousValues = $this->emptyTrendValues($previousBuckets, $granularity);

        foreach ($quotations as $quotation) {
            /** @var Quotation $quotation */
            $eventAt = CarbonImmutable::parse($quotation->created_at);
            $this->addTrendAmount(
                $eventAt,
                (float) $quotation->total_amount,
                'quotationAmount',
                $rangeStart,
                $rangeEnd->addMonth(),
                $currentValues,
                $granularity,
            );
            $this->addTrendAmount(
                $eventAt,
                (float) $quotation->total_amount,
                'quotationAmount',
                $previousStart,
                $previousEnd->addMonth(),
                $previousValues,
                $granularity,
            );
        }

        foreach ($allocations as $allocation) {
            /** @var PaymentAllocation $allocation */
            $eventAt = $this->allocationEventAt($allocation);
            $this->addTrendAmount(
                $eventAt,
                (float) $allocation->amount,
                'receivedAmount',
                $rangeStart,
                $rangeEnd->addMonth(),
                $currentValues,
                $granularity,
            );
            $this->addTrendAmount(
                $eventAt,
                (float) $allocation->amount,
                'receivedAmount',
                $previousStart,
                $previousEnd->addMonth(),
                $previousValues,
                $granularity,
            );
        }

        foreach ($refunds as $refund) {
            /** @var PaymentRefund $refund */
            $eventAt = CarbonImmutable::parse($refund->completed_at);
            $this->addTrendAmount(
                $eventAt,
                (float) $refund->amount,
                'refundAmount',
                $rangeStart,
                $rangeEnd->addMonth(),
                $currentValues,
                $granularity,
            );
            $this->addTrendAmount(
                $eventAt,
                (float) $refund->amount,
                'refundAmount',
                $previousStart,
                $previousEnd->addMonth(),
                $previousValues,
                $granularity,
            );
        }

        $currentRows = array_values($currentValues);
        $previousRows = array_values($previousValues);
        $currentCumulativeQuotation = 0.0;
        $currentCumulativeReceived = 0.0;
        $currentCumulativeRefund = 0.0;
        $currentCumulative = 0.0;
        $previousCumulative = 0.0;

        $points = collect($currentRows)
            ->map(function (array $row, int $index) use (
                $previousRows,
                &$currentCumulativeQuotation,
                &$currentCumulativeReceived,
                &$currentCumulativeRefund,
                &$currentCumulative,
                &$previousCumulative,
                $granularity,
            ): array {
                $previous = $previousRows[$index] ?? [
                    'quotationAmount' => 0.0,
                    'receivedAmount' => 0.0,
                    'refundAmount' => 0.0,
                ];
                $netAmount = $row['receivedAmount'] - $row['refundAmount'];
                $previousNetAmount = $previous['receivedAmount'] - $previous['refundAmount'];
                $currentCumulativeQuotation += $row['quotationAmount'];
                $currentCumulativeReceived += $row['receivedAmount'];
                $currentCumulativeRefund += $row['refundAmount'];
                $currentCumulative += $netAmount;
                $previousCumulative += $previousNetAmount;

                return [
                    'period' => $row['period'],
                    'label' => $this->trendLabel($row['period'], $granularity),
                    'quotationAmount' => $this->money($row['quotationAmount']),
                    'receivedAmount' => $this->money($row['receivedAmount']),
                    'refundAmount' => $this->money($row['refundAmount']),
                    'netAmount' => $this->money($netAmount),
                    'cumulativeQuotationAmount' => $this->money($currentCumulativeQuotation),
                    'cumulativeReceivedAmount' => $this->money($currentCumulativeReceived),
                    'cumulativeRefundAmount' => $this->money($currentCumulativeRefund),
                    'cumulativeNetAmount' => $this->money($currentCumulative),
                    'previousNetAmount' => $this->money($previousNetAmount),
                    'previousCumulativeNetAmount' => $this->money($previousCumulative),
                ];
            })
            ->all();

        return [
            'granularity' => $granularity,
            'points' => $points,
        ];
    }

    private function buildProfitTrend(
        CarbonImmutable $rangeStart,
        CarbonImmutable $rangeEnd,
        CarbonImmutable $previousStart,
        CarbonImmutable $previousEnd,
        array $scope,
        Collection $projects,
        Collection $quotations,
        Collection $allocations,
        Collection $refunds,
        Collection $costs,
    ): array {
        $granularity = $rangeStart->format('Y-m') === $rangeEnd->format('Y-m') ? 'day' : 'month';
        $currentValues = $this->emptyProfitTrendValues(
            $this->bucketStarts($rangeStart, $rangeEnd, $granularity),
            $granularity,
        );
        $previousValues = $this->emptyProfitTrendValues(
            $this->bucketStarts($previousStart, $previousEnd, $granularity),
            $granularity,
        );
        $projectMap = $projects->keyBy('id');
        $quotationMap = $quotations->keyBy('id');
        $paidFirstQuotationByProject = $this->kpi->paidFirstQuotations($quotations, $allocations);

        foreach ($allocations->groupBy('quotation_id') as $quotationId => $quotationAllocations) {
            /** @var Quotation|null $quotation */
            $quotation = $quotationMap->get($quotationId);
            /** @var Project|null $project */
            $project = $quotation ? $projectMap->get($quotation->project_id) : null;

            if (! $quotation || ! $project || ! $this->matchesImplementationScope($project, $scope)) {
                continue;
            }

            $cumulativeAmount = 0.0;
            $sortedAllocations = $quotationAllocations
                ->sortBy(fn (PaymentAllocation $allocation): string => $this->allocationEventAt($allocation)->format('Y-m-d H:i:s.u').'-'.str_pad((string) $allocation->id, 20, '0', STR_PAD_LEFT));

            foreach ($sortedAllocations as $allocation) {
                $before = $cumulativeAmount;
                $cumulativeAmount += (float) $allocation->amount;
                $recognizedAmount = $this->recognizedRevenueBetween(
                    $quotation,
                    $before,
                    $cumulativeAmount,
                );

                if ($recognizedAmount > self::MONEY_EPSILON) {
                    $this->addProfitTrendAmount(
                        $this->allocationEventAt($allocation),
                        $recognizedAmount,
                        $rangeStart,
                        $rangeEnd->addMonth(),
                        $previousStart,
                        $previousEnd->addMonth(),
                        $currentValues,
                        $previousValues,
                        $granularity,
                    );
                }
            }
        }

        foreach ($costs as $cost) {
            /** @var ProjectCost $cost */
            /** @var Project|null $project */
            $project = $projectMap->get($cost->project_id);

            if (! $project || ! $this->matchesImplementationScope($project, $scope)) {
                continue;
            }

            $this->addProfitTrendAmount(
                CarbonImmutable::parse($cost->transaction_date),
                -$this->costAmounts($cost)['beforeVat'],
                $rangeStart,
                $rangeEnd->addMonth(),
                $previousStart,
                $previousEnd->addMonth(),
                $currentValues,
                $previousValues,
                $granularity,
            );
        }

        foreach ($paidFirstQuotationByProject as $projectId => $success) {
            /** @var Project|null $project */
            $project = $projectMap->get($projectId);

            if (! $project || ! $this->matchesAcquisitionScope($project, $scope)) {
                continue;
            }

            /** @var Quotation $quotation */
            $quotation = $success['quotation'];
            $this->addProfitTrendAmount(
                $success['paidAt'],
                $this->kpi->acquisitionProfitBeforeVat($project, $quotation),
                $rangeStart,
                $rangeEnd->addMonth(),
                $previousStart,
                $previousEnd->addMonth(),
                $currentValues,
                $previousValues,
                $granularity,
            );
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

            $eventAt = CarbonImmutable::parse($refund->completed_at);

            if ($this->matchesImplementationScope($project, $scope)
                && ! in_array($refund->refund_type, [
                    PaymentRefund::TYPE_DEPOSIT,
                    PaymentRefund::TYPE_OVERPAYMENT,
                ], true)) {
                $this->addProfitTrendAmount(
                    $eventAt,
                    -$this->refundBeforeVat($refund, $quotation),
                    $rangeStart,
                    $rangeEnd->addMonth(),
                    $previousStart,
                    $previousEnd->addMonth(),
                    $currentValues,
                    $previousValues,
                    $granularity,
                );
            }

            $firstSuccess = $paidFirstQuotationByProject->get($projectId);

            if ($this->matchesAcquisitionScope($project, $scope)
                && $firstSuccess
                && (int) $firstSuccess['quotation']->id === (int) $refund->quotation_id
                && $refund->refund_type !== PaymentRefund::TYPE_OVERPAYMENT) {
                $this->addProfitTrendAmount(
                    $eventAt,
                    -$this->kpi->acquisitionRefundBeforeVat($project, $refund, $quotation),
                    $rangeStart,
                    $rangeEnd->addMonth(),
                    $previousStart,
                    $previousEnd->addMonth(),
                    $currentValues,
                    $previousValues,
                    $granularity,
                );
            }
        }

        $currentRows = array_values($currentValues);
        $previousRows = array_values($previousValues);
        $currentCumulative = 0.0;
        $previousCumulative = 0.0;

        return [
            'granularity' => $granularity,
            'points' => collect($currentRows)
                ->map(function (array $row, int $index) use (
                    $previousRows,
                    &$currentCumulative,
                    &$previousCumulative,
                    $granularity,
                ): array {
                    $previousAmount = (float) ($previousRows[$index]['profitAmount'] ?? 0);
                    $currentCumulative += (float) $row['profitAmount'];
                    $previousCumulative += $previousAmount;

                    return [
                        'period' => $row['period'],
                        'label' => $this->trendLabel($row['period'], $granularity),
                        'profitAmount' => $this->money($row['profitAmount']),
                        'cumulativeProfitAmount' => $this->money($currentCumulative),
                        'previousProfitAmount' => $this->money($previousAmount),
                        'previousCumulativeProfitAmount' => $this->money($previousCumulative),
                    ];
                })
                ->all(),
        ];
    }

    private function emptyProfitTrendValues(Collection $bucketStarts, string $granularity): array
    {
        return $bucketStarts->mapWithKeys(function (CarbonImmutable $start) use ($granularity): array {
            $period = $start->format($granularity === 'day' ? 'Y-m-d' : 'Y-m');

            return [$period => [
                'period' => $period,
                'profitAmount' => 0.0,
            ]];
        })->all();
    }

    private function addProfitTrendAmount(
        CarbonImmutable $eventAt,
        float $amount,
        CarbonImmutable $rangeStart,
        CarbonImmutable $rangeEndExclusive,
        CarbonImmutable $previousStart,
        CarbonImmutable $previousEndExclusive,
        array &$currentValues,
        array &$previousValues,
        string $granularity,
    ): void {
        $key = $eventAt->format($granularity === 'day' ? 'Y-m-d' : 'Y-m');

        if ($eventAt->greaterThanOrEqualTo($rangeStart) && $eventAt->lessThan($rangeEndExclusive)) {
            $currentValues[$key]['profitAmount'] += $amount;
        }

        if ($eventAt->greaterThanOrEqualTo($previousStart) && $eventAt->lessThan($previousEndExclusive)) {
            $previousValues[$key]['profitAmount'] += $amount;
        }
    }

    private function matchesImplementationScope(Project $project, array $scope): bool
    {
        if ($scope['level'] === 'department') {
            return in_array(
                (int) ($project->managerUser?->department_id ?? 0),
                $scope['departmentIds'] ?? [],
                true,
            );
        }

        return (int) $project->manager_user_id === (int) $scope['userId'];
    }

    private function matchesAcquisitionScope(Project $project, array $scope): bool
    {
        if ($scope['level'] === 'department') {
            return in_array(
                (int) ($project->customer?->salesUser?->department_id ?? 0),
                $scope['departmentIds'] ?? [],
                true,
            );
        }

        return (int) ($project->customer?->sales_user_id ?? 0) === (int) $scope['userId'];
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

    private function bucketStarts(
        CarbonImmutable $rangeStart,
        CarbonImmutable $rangeEnd,
        string $granularity,
    ): Collection {
        $starts = collect();
        $cursor = $rangeStart;
        $exclusiveEnd = $rangeEnd->addMonth();

        while ($cursor->lessThan($exclusiveEnd)) {
            $starts->push($cursor);
            $cursor = $granularity === 'day' ? $cursor->addDay() : $cursor->addMonth();
        }

        return $starts;
    }

    private function emptyTrendValues(Collection $bucketStarts, string $granularity): array
    {
        return $bucketStarts->mapWithKeys(function (CarbonImmutable $start) use ($granularity): array {
            $period = $start->format($granularity === 'day' ? 'Y-m-d' : 'Y-m');

            return [$period => [
                'period' => $period,
                'quotationAmount' => 0.0,
                'receivedAmount' => 0.0,
                'refundAmount' => 0.0,
            ]];
        })->all();
    }

    private function addTrendAmount(
        CarbonImmutable $eventAt,
        float $amount,
        string $field,
        CarbonImmutable $rangeStart,
        CarbonImmutable $rangeEndExclusive,
        array &$values,
        string $granularity,
    ): void {
        if ($eventAt->lessThan($rangeStart) || ! $eventAt->lessThan($rangeEndExclusive)) {
            return;
        }

        $key = $eventAt->format($granularity === 'day' ? 'Y-m-d' : 'Y-m');

        if (isset($values[$key])) {
            $values[$key][$field] += $amount;
        }
    }

    private function allocationEventAt(PaymentAllocation $allocation): CarbonImmutable
    {
        $value = $allocation->payment?->transaction_at
            ?: $allocation->payment?->transaction_date
            ?: $allocation->allocated_at
            ?: $allocation->created_at;

        return CarbonImmutable::parse($value);
    }

    private function trendLabel(string $period, string $granularity): string
    {
        $value = CarbonImmutable::parse($granularity === 'day' ? $period : $period.'-01');

        return $granularity === 'day'
            ? $value->format('d/m')
            : 'T'.$value->format('m/Y');
    }

    private function newCustomerCount(
        CarbonImmutable $rangeStart,
        CarbonImmutable $rangeEndExclusive,
        User $currentUser,
    ): int {
        return $this->scopedCustomerQuery($currentUser)
            ->where('created_at', '>=', $rangeStart)
            ->where('created_at', '<', $rangeEndExclusive)
            ->count();
    }

    private function changeRate(float|int $current, float|int $previous): ?float
    {
        if (abs((float) $previous) <= self::MONEY_EPSILON) {
            return abs((float) $current) <= self::MONEY_EPSILON ? 0.0 : null;
        }

        return round(((float) $current - (float) $previous) / abs((float) $previous) * 100, 2);
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

    private function money(float $amount): float
    {
        return round($amount, 2);
    }
}

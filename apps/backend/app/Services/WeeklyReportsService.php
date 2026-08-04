<?php

namespace App\Services;

use App\Http\Resources\WeeklyReportResource;
use App\Models\Project;
use App\Models\ProjectWeeklySetting;
use App\Models\WeeklyReport;
use App\Models\WeeklyReportItem;
use App\Repositories\ProjectWeeklySettingRepository;
use App\Repositories\WeeklyReportRepository;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

class WeeklyReportsService extends BaseService
{
    public function __construct(
        private readonly WeeklyReportRepository $reports,
        private readonly ProjectWeeklySettingRepository $weeklySettings,
        private readonly NotificationDispatchService $notifications,
        private readonly NotificationRecipientResolver $notificationRecipients,
    ) {}

    public function findAll(array $filters = [])
    {
        return $this->apiCollection(
            $this->reports->findAll($this->currentUser(), $this->normalizeKeys($filters)),
            WeeklyReportResource::class,
        );
    }

    public function findPaginated(array $filters, int $perPage, int $page): array
    {
        return $this->apiPaginatedCollection(
            $this->reports->findPaginated(
                $this->currentUser(),
                $this->normalizeKeys($filters),
                $perPage,
                $page,
            ),
            WeeklyReportResource::class,
        );
    }

    public function board(array $filters, int $perPage, int $page): array
    {
        $filters = $this->normalizeKeys($filters);
        $weekMonday = $this->resolveBoardWeek($filters['week_start'] ?? null);
        $weekSunday = $weekMonday->addDays(6);
        $today = CarbonImmutable::today(config('app.timezone'));
        $settings = $this->weeklySettings
            ->findActiveForBoard($filters, $this->currentUser())
            ->filter(fn (ProjectWeeklySetting $setting): bool => $setting->project?->requiresWeeklyReport() ?? false)
            ->values();
        $projectIds = $settings->pluck('project_id')->map(fn ($id) => (int) $id)->all();
        $reports = $this->reports->findForBoardPeriods(
            $projectIds,
            $weekMonday->subDays(7)->toDateString(),
            $weekSunday->toDateString(),
        );
        $reportsByPeriod = [];
        $legacyReportsByCycle = [];

        foreach ($reports as $report) {
            $key = $this->periodKey(
                (int) $report->project_id,
                $report->week_start_date->toDateString(),
                $report->week_end_date->toDateString(),
            );

            $reportsByPeriod[$key] ??= $report;

            $legacyCycleKey = $this->cycleKey(
                (int) $report->project_id,
                CarbonImmutable::instance($report->report_date)
                    ->startOfWeek(CarbonImmutable::MONDAY)
                    ->toDateString(),
            );
            $legacyReportsByCycle[$legacyCycleKey] ??= $report;
        }

        $rows = $settings
            ->map(function (ProjectWeeklySetting $setting) use ($weekMonday, $today, $reportsByPeriod, $legacyReportsByCycle): ?array {
                if (! $setting->project) {
                    return null;
                }

                $dueDate = $weekMonday->addDays(max(0, ((int) $setting->report_weekday) - 1));
                $projectStartDate = $this->projectStartDate($setting->project, true);

                if ($projectStartDate && $dueDate->lessThanOrEqualTo($projectStartDate)) {
                    return null;
                }

                $periodStart = $dueDate->subDays(7);
                if ($projectStartDate && $periodStart->lessThan($projectStartDate)) {
                    $periodStart = $projectStartDate;
                }
                $periodEnd = $dueDate->subDay();
                $key = $this->periodKey(
                    (int) $setting->project_id,
                    $periodStart->toDateString(),
                    $periodEnd->toDateString(),
                );
                /** @var WeeklyReport|null $report */
                $legacyReport = $legacyReportsByCycle[$this->cycleKey(
                    (int) $setting->project_id,
                    $weekMonday->toDateString(),
                )] ?? null;
                $legacyReportMatchesOldPeriod = $legacyReport
                    && CarbonImmutable::instance($legacyReport->week_end_date)
                        ->addDay()
                        ->dayOfWeekIso !== (int) $setting->report_weekday;
                $report = $reportsByPeriod[$key]
                    ?? ($legacyReportMatchesOldPeriod ? $legacyReport : null);
                $progressStatus = $report?->status ?? 'not_created';
                $dueStatus = $this->resolveDueStatus($report, $dueDate, $today);

                return [
                    'settingId' => $setting->id,
                    'projectId' => $setting->project_id,
                    'reportOwnerUserId' => $setting->report_owner_user_id,
                    'reportWeekday' => (int) $setting->report_weekday,
                    'dueDate' => $dueDate->toDateString(),
                    'periodStartDate' => $periodStart->toDateString(),
                    'periodEndDate' => $periodEnd->toDateString(),
                    'dueStatus' => $dueStatus,
                    'progressStatus' => $progressStatus,
                    'weeklyCondition' => $report?->weekly_condition,
                    'project' => [
                        'id' => $setting->project->id,
                        'projectCode' => $setting->project->project_code,
                        'projectName' => $setting->project->project_name,
                        'startDate' => $projectStartDate?->toDateString(),
                        'customer' => $setting->project->customer ? [
                            'id' => $setting->project->customer->id,
                            'customerCode' => $setting->project->customer->customer_code,
                            'customerName' => $setting->project->customer->customer_name,
                        ] : null,
                    ],
                    'reportOwner' => $setting->reportOwner ? [
                        'id' => $setting->reportOwner->id,
                        'code' => $setting->reportOwner->code,
                        'name' => $setting->reportOwner->name,
                    ] : null,
                    'report' => $report
                        ? $this->apiResource($report, WeeklyReportResource::class)
                        : null,
                ];
            })
            ->filter()
            ->values()
            ->all();

        $summary = [
            'total' => count($rows),
            'dueToday' => count(array_filter($rows, fn (array $row) => $row['dueStatus'] === 'due_today')),
            'overdue' => count(array_filter($rows, fn (array $row) => $row['dueStatus'] === 'overdue')),
            'waitingApproval' => count(array_filter($rows, fn (array $row) => $row['progressStatus'] === WeeklyReport::STATUS_SUBMITTED)),
            'completed' => count(array_filter($rows, fn (array $row) => $row['progressStatus'] === WeeklyReport::STATUS_APPROVED)),
        ];

        $rows = array_values(array_filter($rows, function (array $row) use ($filters): bool {
            if (($filters['due_status'] ?? null) && $row['dueStatus'] !== $filters['due_status']) {
                return false;
            }

            if (($filters['progress_status'] ?? null) && $row['progressStatus'] !== $filters['progress_status']) {
                return false;
            }

            if (($filters['weekly_condition'] ?? null) && $row['weeklyCondition'] !== $filters['weekly_condition']) {
                return false;
            }

            return true;
        }));

        usort($rows, fn (array $left, array $right) => $this->boardPriority($left) <=> $this->boardPriority($right)
            ?: strcmp((string) ($left['dueDate'] ?? ''), (string) ($right['dueDate'] ?? ''))
            ?: strcmp((string) ($left['project']['projectCode'] ?? ''), (string) ($right['project']['projectCode'] ?? '')));

        $total = count($rows);
        $lastPage = max(1, (int) ceil($total / max(1, $perPage)));
        $page = min(max(1, $page), $lastPage);
        $offset = ($page - 1) * $perPage;

        return [
            'data' => array_slice($rows, $offset, $perPage),
            'meta' => [
                'currentPage' => $page,
                'lastPage' => $lastPage,
                'perPage' => $perPage,
                'total' => $total,
                'from' => $total > 0 ? $offset + 1 : null,
                'to' => $total > 0 ? min($offset + $perPage, $total) : null,
                'weekStart' => $weekMonday->toDateString(),
                'weekEnd' => $weekSunday->toDateString(),
                'summary' => $summary,
            ],
        ];
    }

    public function findOne(string $id): array
    {
        $report = $this->reports->findVisibleWithRelationsOrFail($this->currentUser(), $id);
        $this->authorize('view', $report);

        return $this->apiResource($report, WeeklyReportResource::class);
    }

    public function create(array $data): array
    {
        return $this->transaction(function () use ($data): array {
            $items = $data['items'] ?? [];
            unset($data['items']);

            $data = $this->preparePayload($data, true);
            $project = Project::query()->find($data['project_id'] ?? null);
            $this->authorize('create', [WeeklyReport::class, $project]);
            $data['status'] = WeeklyReport::STATUS_DRAFT;
            $data['created_by'] = $this->currentUser()?->id;

            if ($this->reports->existsForPeriod(
                (int) $data['project_id'],
                (string) $data['week_start_date'],
                (string) $data['week_end_date'],
            )) {
                throw ValidationException::withMessages([
                    'cycleWeekStart' => ['Dự án đã có báo cáo trong kỳ này.'],
                ]);
            }

            /** @var WeeklyReport $report */
            $report = $this->reports->create($data);
            $this->syncItems($report, $items);

            return $this->apiResource($report->load(['project', 'customer', 'reporter', 'approver', 'rejecter', 'items.assignee', 'items.createdBy:id,code,name', 'attachments.uploadedBy']), WeeklyReportResource::class);
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            /** @var WeeklyReport $existingReport */
            $existingReport = $this->reports->findWithRelationsOrFail($id);
            $this->authorize('update', $existingReport);
            $this->assertStatusIn(
                $existingReport,
                [WeeklyReport::STATUS_DRAFT, WeeklyReport::STATUS_REJECTED],
                'Chỉ báo cáo nháp hoặc đã bị từ chối mới được chỉnh sửa.',
            );
            unset($data['items']);

            $data = $this->preparePayload($data);
            unset(
                $data['project_id'],
                $data['customer_id'],
                $data['reporter_user_id'],
                $data['week_start_date'],
                $data['week_end_date'],
                $data['report_date'],
                $data['status'],
            );
            $data['updated_by'] = $this->currentUser()?->id;

            /** @var WeeklyReport $report */
            $report = $this->reports->update($id, $data);

            return $this->apiResource($report->load(['project', 'customer', 'reporter', 'approver', 'rejecter', 'items.assignee', 'items.createdBy:id,code,name', 'attachments.uploadedBy']), WeeklyReportResource::class);
        });
    }

    public function addMessage(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            /** @var WeeklyReport $report */
            $report = $this->reports->findVisibleWithRelationsOrFail($this->currentUser(), $id);
            $this->authorize('comment', $report);

            $content = trim((string) ($data['content'] ?? ''));
            $replyToId = $data['reply_to_message_id'] ?? $data['replyToMessageId'] ?? null;
            $replyTo = null;

            if ($content === '') {
                throw ValidationException::withMessages([
                    'content' => ['Nội dung trao đổi không được để trống.'],
                ]);
            }

            if ($replyToId) {
                /** @var WeeklyReportItem|null $replyTo */
                $replyTo = $report->items()->whereKey($replyToId)->first();

                if (! $replyTo) {
                    throw ValidationException::withMessages([
                        'replyToMessageId' => ['Tin nhắn được phản hồi không thuộc báo cáo này.'],
                    ]);
                }
            }

            /** @var WeeklyReportItem $message */
            $message = $report->items()->create([
                'reply_to_item_id' => $replyTo?->reply_to_item_id ?: $replyTo?->id,
                'item_type' => $replyTo ? 'reply' : 'message',
                'content' => $content,
                'status' => 'open',
            ]);
            $report->loadMissing('project');
            $recipientIds = $replyTo
                ? collect([$replyTo->created_by])
                : collect([
                    $report->reporter_user_id,
                    $report->project?->manager_user_id,
                    $report->project?->sales_user_id,
                ]);
            $this->notifications->send($this->notificationRecipients->authorizedUsers($recipientIds, 'view', $report), [
                'module' => 'weekly_report',
                'event_key' => 'weekly_report_message',
                'title' => $replyTo ? 'Có phản hồi mới trong báo cáo tuần' : 'Có trao đổi mới trong báo cáo tuần',
                'message' => $report->project?->project_name,
                'severity' => 'info',
                'entity_type' => 'weekly_report',
                'entity_id' => $report->id,
                'action_url' => '/weekly-reports/'.$report->id,
                'dedupe_key' => 'weekly_report_message:'.$message->id,
            ]);

            return $this->apiResource(
                $report->fresh()->load(['project', 'customer', 'reporter', 'approver', 'rejecter', 'items.assignee', 'items.createdBy:id,code,name', 'attachments.uploadedBy']),
                WeeklyReportResource::class,
            );
        });
    }

    public function updateMessage(string $id, string $messageId, array $data): array
    {
        return $this->transaction(function () use ($id, $messageId, $data): array {
            $report = $this->reports->findVisibleWithRelationsOrFail($this->currentUser(), $id);
            $message = $this->findMessageInReport($report, $messageId);
            $this->authorize('update', $message);

            $content = trim((string) ($data['content'] ?? ''));

            if ($content === '') {
                throw ValidationException::withMessages([
                    'content' => ['Nội dung trao đổi không được để trống.'],
                ]);
            }

            $message->update(['content' => $content]);

            return $this->freshReportResource($report);
        });
    }

    public function deleteMessage(string $id, string $messageId): array
    {
        return $this->transaction(function () use ($id, $messageId): array {
            $report = $this->reports->findVisibleWithRelationsOrFail($this->currentUser(), $id);
            $message = $this->findMessageInReport($report, $messageId);
            $this->authorize('delete', $message);

            if ($message->replies()->exists()) {
                throw ValidationException::withMessages([
                    'message' => ['Tin nhắn đã có phản hồi nên không thể xóa. Bạn vẫn có thể chỉnh sửa nội dung.'],
                ]);
            }

            $message->delete();

            return $this->freshReportResource($report);
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            /** @var WeeklyReport $report */
            $report = $this->reports->findWithRelationsOrFail($id);
            $this->authorize('delete', $report);
            $this->assertStatus($report, WeeklyReport::STATUS_DRAFT, 'Chỉ báo cáo nháp mới được xóa.');
            $this->reports->delete($id);

            return ['message' => 'Xóa báo cáo tuần thành công'];
        });
    }

    public function submit(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            /** @var WeeklyReport $existingReport */
            $existingReport = $this->reports->findWithRelationsOrFail($id);
            $this->authorize('update', $existingReport);
            $this->assertStatusIn(
                $existingReport,
                [WeeklyReport::STATUS_DRAFT, WeeklyReport::STATUS_REJECTED],
                'Chỉ báo cáo nháp hoặc đã bị từ chối mới được gửi duyệt.',
            );
            /** @var WeeklyReport $report */
            $report = $this->reports->update($id, [
                'status' => WeeklyReport::STATUS_SUBMITTED,
                'submitted_at' => now(),
                'updated_by' => $this->currentUser()?->id,
            ]);
            $report->loadMissing(['project.weeklySetting', 'reporter']);
            $this->notifications->resolve('weekly_report', $report->id, [
                'weekly_report_rejected',
                'weekly_report_returned',
            ]);
            if ($report->project?->weeklySetting) {
                $this->notifications->resolve('project_weekly_setting', $report->project->weeklySetting->id, [
                    'weekly_report_due',
                    'weekly_report_overdue',
                ]);
            }
            $this->notifications->send($this->notificationRecipients->weeklyReportApprovers($report), [
                'module' => 'weekly_report',
                'event_key' => 'weekly_report_submitted',
                'title' => 'Báo cáo tuần đang chờ duyệt',
                'message' => trim(($report->project?->project_name ?? 'Dự án').' · '.($report->reporter?->name ?? 'Nhân sự')),
                'kind' => 'action',
                'severity' => 'warning',
                'entity_type' => 'weekly_report',
                'entity_id' => $report->id,
                'action_url' => '/weekly-reports/'.$report->id,
                'dedupe_key' => 'weekly_report_submitted:'.$report->id.':'.$report->submitted_at?->format('YmdHisu'),
            ]);

            return $this->apiResource($report->load(['project', 'customer', 'reporter', 'approver', 'rejecter', 'items.assignee', 'items.createdBy:id,code,name', 'attachments.uploadedBy']), WeeklyReportResource::class);
        });
    }

    public function approve(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            /** @var WeeklyReport $existingReport */
            $existingReport = $this->reports->findWithRelationsOrFail($id);
            $this->authorize('approve', $existingReport);
            $this->assertStatus($existingReport, WeeklyReport::STATUS_SUBMITTED, 'Chỉ báo cáo đang chờ duyệt mới được duyệt.');
            /** @var WeeklyReport $report */
            $report = $this->reports->update($id, [
                'status' => WeeklyReport::STATUS_APPROVED,
                'approved_by' => $this->currentUser()?->id,
                'approved_at' => now(),
            ]);
            $report->loadMissing('project');
            $this->notifications->resolve('weekly_report', $report->id, [
                'weekly_report_submitted',
                'weekly_report_due',
                'weekly_report_overdue',
            ]);
            $this->notifyReporter($report, 'weekly_report_approved', 'Báo cáo tuần đã được duyệt', 'success');

            return $this->apiResource($report->load(['project', 'customer', 'reporter', 'approver', 'rejecter', 'items.assignee', 'items.createdBy:id,code,name', 'attachments.uploadedBy']), WeeklyReportResource::class);
        });
    }

    public function reject(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            /** @var WeeklyReport $existingReport */
            $existingReport = $this->reports->findWithRelationsOrFail($id);
            $this->authorize('approve', $existingReport);
            $this->assertStatus(
                $existingReport,
                WeeklyReport::STATUS_SUBMITTED,
                'Chỉ báo cáo đang chờ duyệt mới được từ chối.',
            );

            /** @var WeeklyReport $report */
            $report = $this->reports->update($id, [
                'status' => WeeklyReport::STATUS_REJECTED,
                'rejection_reason' => trim((string) $data['reason']),
                'rejected_by' => $this->currentUser()?->id,
                'rejected_at' => now(),
                'approved_by' => null,
                'approved_at' => null,
                'updated_by' => $this->currentUser()?->id,
            ]);
            $report->loadMissing('project');
            $this->notifications->resolve('weekly_report', $report->id, ['weekly_report_submitted']);
            $this->notifyReporter(
                $report,
                'weekly_report_rejected',
                'Báo cáo tuần bị từ chối',
                'error',
                'action',
                trim((string) $report->rejection_reason),
            );

            return $this->apiResource($report->load(['project', 'customer', 'reporter', 'approver', 'rejecter', 'items.assignee', 'items.createdBy:id,code,name', 'attachments.uploadedBy']), WeeklyReportResource::class);
        });
    }

    public function returnToDraft(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            /** @var WeeklyReport $existingReport */
            $existingReport = $this->reports->findWithRelationsOrFail($id);
            $this->authorize('approve', $existingReport);
            $this->assertStatus($existingReport, WeeklyReport::STATUS_SUBMITTED, 'Chỉ báo cáo đang chờ duyệt mới được trả về nháp.');

            /** @var WeeklyReport $report */
            $report = $this->reports->update($id, [
                'status' => WeeklyReport::STATUS_DRAFT,
                'submitted_at' => null,
                'approved_by' => null,
                'approved_at' => null,
                'updated_by' => $this->currentUser()?->id,
            ]);
            $report->loadMissing('project');
            $this->notifications->resolve('weekly_report', $report->id, ['weekly_report_submitted']);
            $this->notifyReporter($report, 'weekly_report_returned', 'Báo cáo tuần được trả về bản nháp', 'warning', 'action');

            return $this->apiResource($report->load(['project', 'customer', 'reporter', 'approver', 'rejecter', 'items.assignee', 'items.createdBy:id,code,name', 'attachments.uploadedBy']), WeeklyReportResource::class);
        });
    }

    private function notifyReporter(
        WeeklyReport $report,
        string $eventKey,
        string $title,
        string $severity,
        string $kind = 'info',
        ?string $message = null,
    ): void {
        $this->notifications->send(
            $this->notificationRecipients->authorizedUsers([$report->reporter_user_id], 'view', $report),
            [
                'module' => 'weekly_report',
                'event_key' => $eventKey,
                'title' => $title,
                'message' => $message ?: $report->project?->project_name,
                'kind' => $kind,
                'severity' => $severity,
                'entity_type' => 'weekly_report',
                'entity_id' => $report->id,
                'action_url' => '/weekly-reports/'.$report->id,
                'dedupe_key' => implode(':', [$eventKey, $report->id, $report->updated_at?->format('YmdHisu')]),
            ],
        );
    }

    private function preparePayload(array $data, bool $isCreating = false): array
    {
        $data = $this->normalizeKeys($data);
        $cycleWeekStart = $data['cycle_week_start'] ?? null;
        unset($data['cycle_week_start']);

        if (! empty($data['project_id'])) {
            /** @var Project|null $project */
            $project = Project::query()->with('statusOption')->find($data['project_id']);

            if ($project) {
                if ($isCreating && ! $project->requiresWeeklyReport()) {
                    throw ValidationException::withMessages([
                        'projectId' => ['Trạng thái hiện tại của dự án không yêu cầu báo cáo tuần.'],
                    ]);
                }

                $data['customer_id'] = $data['customer_id'] ?? $project->customer_id;
                $data['project_status'] = $data['project_status']
                    ?? $project->statusOption?->label
                    ?? 'Chưa có trạng thái';
            }

            $settingQuery = ProjectWeeklySetting::query()
                ->where('project_id', $data['project_id'])
                ->where('is_active', true)
                ->whereBetween('report_weekday', [1, 5]);

            if ($isCreating) {
                $settingQuery->lockForUpdate();
            }

            /** @var ProjectWeeklySetting|null $setting */
            $setting = $settingQuery->first();

            if ($setting) {
                $data['monthly_budget'] = $data['monthly_budget'] ?? $setting->monthly_budget;
                $data['management_fee_rate'] = $data['management_fee_rate'] ?? $setting->management_fee_rate;
                $data['average_weekly_budget'] = $data['average_weekly_budget']
                    ?? round((float) $setting->monthly_budget / 4, 2);
                $data['total_budget'] = $data['total_budget'] ?? $setting->monthly_budget;
            }

            if ($isCreating && $cycleWeekStart) {
                if (! $setting) {
                    throw ValidationException::withMessages([
                        'projectId' => ['Dự án chưa có lịch báo cáo tuần đang áp dụng.'],
                    ]);
                }

                $weekMonday = $this->resolveBoardWeek((string) $cycleWeekStart);
                $currentWeekMonday = $this->resolveBoardWeek(null);

                if ($weekMonday->greaterThan($currentWeekMonday)) {
                    throw ValidationException::withMessages([
                        'cycleWeekStart' => ['Chỉ được tạo báo cáo cho tuần hiện tại hoặc các tuần trước.'],
                    ]);
                }

                $dueDate = $weekMonday->addDays(max(0, ((int) $setting->report_weekday) - 1));
                $projectStartDate = $project ? $this->projectStartDate($project) : null;

                if (! $projectStartDate) {
                    throw ValidationException::withMessages([
                        'projectId' => ['Dự án chưa có ngày bắt đầu. Vui lòng cập nhật dự án trước khi tạo báo cáo tuần.'],
                    ]);
                }

                if ($dueDate->lessThanOrEqualTo($projectStartDate)) {
                    throw ValidationException::withMessages([
                        'cycleWeekStart' => ['Hạn báo cáo của kỳ phải sau ngày bắt đầu dự án.'],
                    ]);
                }

                $periodStart = $dueDate->subDays(7);
                if ($periodStart->lessThan($projectStartDate)) {
                    $periodStart = $projectStartDate;
                }

                $data['week_start_date'] = $periodStart->toDateString();
                $data['week_end_date'] = $dueDate->subDay()->toDateString();
            }
        }

        if ($isCreating && ! $cycleWeekStart && ! empty($data['week_end_date'])) {
            $reportWeekMonday = CarbonImmutable::parse((string) $data['week_end_date'], config('app.timezone'))
                ->addDay()
                ->startOfWeek(CarbonImmutable::MONDAY)
                ->startOfDay();

            if ($reportWeekMonday->greaterThan($this->resolveBoardWeek(null))) {
                throw ValidationException::withMessages([
                    'weekEndDate' => ['Chỉ được tạo báo cáo cho tuần hiện tại hoặc các tuần trước.'],
                ]);
            }
        }

        if ($isCreating) {
            $data['reporter_user_id'] = $data['reporter_user_id'] ?? $this->currentUser()?->id;
            $data['report_date'] = $data['report_date'] ?? now()->toDateString();
        }

        return $data;
    }

    private function resolveBoardWeek(?string $value): CarbonImmutable
    {
        $date = $value
            ? CarbonImmutable::parse($value, config('app.timezone'))
            : CarbonImmutable::today(config('app.timezone'));

        return $date->startOfWeek(CarbonImmutable::MONDAY)->startOfDay();
    }

    private function projectStartDate(Project $project, bool $fallbackToCreatedAt = false): ?CarbonImmutable
    {
        if ($project->start_date) {
            return CarbonImmutable::instance($project->start_date)->startOfDay();
        }

        if ($fallbackToCreatedAt && $project->created_at) {
            return CarbonImmutable::instance($project->created_at)->startOfDay();
        }

        return null;
    }

    private function periodKey(int $projectId, string $periodStart, string $periodEnd): string
    {
        return "{$projectId}|{$periodStart}|{$periodEnd}";
    }

    private function cycleKey(int $projectId, string $weekStart): string
    {
        return "{$projectId}|{$weekStart}";
    }

    private function resolveDueStatus(
        ?WeeklyReport $report,
        CarbonImmutable $dueDate,
        CarbonImmutable $today,
    ): string {
        if ($report && in_array($report->status, [WeeklyReport::STATUS_SUBMITTED, WeeklyReport::STATUS_APPROVED, WeeklyReport::STATUS_REJECTED], true)) {
            $submittedDate = $report->submitted_at
                ? CarbonImmutable::instance($report->submitted_at)->startOfDay()
                : CarbonImmutable::instance($report->report_date)->startOfDay();

            return $submittedDate->lessThanOrEqualTo($dueDate) ? 'on_time' : 'late';
        }

        if ($today->lessThan($dueDate)) {
            return 'not_due';
        }

        if ($today->equalTo($dueDate)) {
            return 'due_today';
        }

        return 'overdue';
    }

    private function boardPriority(array $row): int
    {
        if ($row['dueStatus'] === 'overdue') {
            return 0;
        }

        if ($row['dueStatus'] === 'due_today') {
            return 1;
        }

        return match ($row['progressStatus']) {
            WeeklyReport::STATUS_REJECTED => 2,
            WeeklyReport::STATUS_DRAFT => 3,
            WeeklyReport::STATUS_SUBMITTED => 4,
            WeeklyReport::STATUS_APPROVED => 5,
            default => 5,
        };
    }

    private function assertStatus(WeeklyReport $report, string $expectedStatus, string $message): void
    {
        if ($report->status !== $expectedStatus) {
            throw ValidationException::withMessages([
                'status' => [$message],
            ]);
        }
    }

    private function assertStatusIn(WeeklyReport $report, array $allowedStatuses, string $message): void
    {
        if (! in_array($report->status, $allowedStatuses, true)) {
            throw ValidationException::withMessages([
                'status' => [$message],
            ]);
        }
    }

    private function syncItems(WeeklyReport $report, array $items): void
    {
        $report->items()->delete();

        foreach ($items as $item) {
            $report->items()->create($this->normalizeItemKeys($item));
        }
    }

    private function findMessageInReport(WeeklyReport $report, string $messageId): WeeklyReportItem
    {
        /** @var WeeklyReportItem|null $message */
        $message = $report->items()->whereKey($messageId)->first();

        if (! $message) {
            throw ValidationException::withMessages([
                'message' => ['Tin nhắn không tồn tại trong báo cáo này.'],
            ]);
        }

        return $message;
    }

    private function freshReportResource(WeeklyReport $report): array
    {
        return $this->apiResource(
            $report->fresh()->load(['project', 'customer', 'reporter', 'approver', 'rejecter', 'items.assignee', 'items.createdBy:id,code,name', 'attachments.uploadedBy']),
            WeeklyReportResource::class,
        );
    }

    private function normalizeItemKeys(array $item): array
    {
        $map = [
            'itemType' => 'item_type',
            'dueDate' => 'due_date',
            'assigneeUserId' => 'assignee_user_id',
        ];

        foreach ($map as $from => $to) {
            if (array_key_exists($from, $item)) {
                $item[$to] = $item[$from];
                unset($item[$from]);
            }
        }

        $item['item_type'] = $item['item_type'] ?? 'message';
        $item['status'] = $item['status'] ?? 'open';

        return $item;
    }

    private function normalizeKeys(array $data): array
    {
        $map = [
            'projectId' => 'project_id',
            'customerId' => 'customer_id',
            'reporterUserId' => 'reporter_user_id',
            'weekStartDate' => 'week_start_date',
            'weekEndDate' => 'week_end_date',
            'cycleWeekStart' => 'cycle_week_start',
            'reportDate' => 'report_date',
            'projectStatus' => 'project_status',
            'weeklyCondition' => 'weekly_condition',
            'weeklySpendAmount' => 'weekly_spend_amount',
            'averageWeeklyBudget' => 'average_weekly_budget',
            'remainingAccountBudget' => 'remaining_account_budget',
            'totalBudget' => 'total_budget',
            'monthlyBudget' => 'monthly_budget',
            'managementFeeRate' => 'management_fee_rate',
            'problemSolution' => 'problem_solution',
            'nextAction' => 'next_action',
            'dateFrom' => 'date_from',
            'dateTo' => 'date_to',
            'reportOwnerUserId' => 'report_owner_user_id',
            'reportWeekday' => 'report_weekday',
            'dueStatus' => 'due_status',
            'progressStatus' => 'progress_status',
            'weekStart' => 'week_start',
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

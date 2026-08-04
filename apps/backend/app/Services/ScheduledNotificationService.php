<?php

namespace App\Services;

use App\Models\Meeting;
use App\Models\ProjectWeeklySetting;
use App\Models\WeeklyReport;
use Carbon\CarbonImmutable;

class ScheduledNotificationService
{
    public function __construct(
        private readonly NotificationDispatchService $notifications,
        private readonly NotificationRecipientResolver $notificationRecipients,
    ) {}

    public function dispatch(): array
    {
        return [
            'meetingReminders' => $this->dispatchMeetingReminders(),
            'weeklyReportReminders' => $this->dispatchWeeklyReportReminders(),
        ];
    }

    private function dispatchMeetingReminders(): int
    {
        $now = CarbonImmutable::now('UTC');
        $meetings = Meeting::query()
            ->whereIn('status', Meeting::ACTIVE_STATUSES)
            ->where('starts_at', '>', $now)
            ->where('starts_at', '<=', $now->addDay())
            ->with('participants:id')
            ->get();
        $sent = 0;

        foreach ($meetings as $meeting) {
            $minutesUntilStart = $now->diffInMinutes(CarbonImmutable::instance($meeting->starts_at), false);
            $eventKey = $minutesUntilStart <= 30 ? 'meeting_reminder_30m' : 'meeting_reminder_24h';
            $label = $minutesUntilStart <= 30 ? 'Lịch hẹn sắp bắt đầu' : 'Bạn có lịch hẹn trong 24 giờ tới';
            $recipientIds = collect([$meeting->organizer_user_id])
                ->merge($meeting->participants->pluck('id'))
                ->filter()
                ->unique();
            $recipients = $this->notificationRecipients->authorizedUsers($recipientIds, 'view', $meeting);
            $sent += $this->notifications->send($recipients, [
                'actor_user_id' => null,
                'module' => 'meeting',
                'event_key' => $eventKey,
                'title' => $label,
                'message' => $meeting->subject.' · '.$meeting->starts_at
                    ->timezone($meeting->timezone ?: 'Asia/Ho_Chi_Minh')
                    ->format('H:i d/m/Y'),
                'severity' => $minutesUntilStart <= 30 ? 'warning' : 'info',
                'entity_type' => 'meeting',
                'entity_id' => $meeting->id,
                'action_url' => '/meetings',
                'dedupe_key' => implode(':', [
                    $eventKey,
                    $meeting->id,
                    $meeting->starts_at->format('YmdHis'),
                ]),
            ])->count();
        }

        return $sent;
    }

    private function dispatchWeeklyReportReminders(): int
    {
        $today = CarbonImmutable::today('Asia/Ho_Chi_Minh');
        $weekMonday = $today->startOfWeek(CarbonImmutable::MONDAY);
        $settings = ProjectWeeklySetting::query()
            ->where('is_active', true)
            ->whereBetween('report_weekday', [1, 5])
            ->whereNotNull('report_owner_user_id')
            ->with(['project.statusOption', 'project.weeklySetting', 'reportOwner'])
            ->get()
            ->filter(fn (ProjectWeeklySetting $setting): bool => $setting->project?->requiresWeeklyReport() ?? false);
        $sent = 0;

        foreach ($settings as $setting) {
            $dueDate = $weekMonday->addDays(((int) $setting->report_weekday) - 1);
            $projectStart = $setting->project?->start_date
                ? CarbonImmutable::instance($setting->project->start_date)->startOfDay()
                : CarbonImmutable::instance($setting->project->created_at)->startOfDay();

            if ($today->lessThan($dueDate) || $dueDate->lessThanOrEqualTo($projectStart)) {
                continue;
            }

            $periodStart = $dueDate->subDays(7);
            if ($periodStart->lessThan($projectStart)) {
                $periodStart = $projectStart;
            }
            $periodEnd = $dueDate->subDay();
            $report = WeeklyReport::query()
                ->where('project_id', $setting->project_id)
                ->where(function ($query) use ($periodStart, $periodEnd, $weekMonday): void {
                    $query->where(function ($period) use ($periodStart, $periodEnd): void {
                        $period
                            ->whereDate('week_start_date', $periodStart->toDateString())
                            ->whereDate('week_end_date', $periodEnd->toDateString());
                    })->orWhereBetween('report_date', [
                        $weekMonday->toDateString(),
                        $weekMonday->addDays(6)->toDateString(),
                    ]);
                })
                ->latest('id')
                ->first();

            if ($report && in_array($report->status, [WeeklyReport::STATUS_SUBMITTED, WeeklyReport::STATUS_APPROVED], true)) {
                $this->notifications->resolve('project_weekly_setting', $setting->id, [
                    'weekly_report_due',
                    'weekly_report_overdue',
                ]);

                continue;
            }

            $isOverdue = $today->greaterThan($dueDate);
            if ($isOverdue) {
                $this->notifications->resolve('project_weekly_setting', $setting->id, ['weekly_report_due']);
            }
            $eventKey = $isOverdue ? 'weekly_report_overdue' : 'weekly_report_due';
            $recipients = $this->notificationRecipients->usersWithPermission(
                [$setting->report_owner_user_id],
                'weeklyreport.view',
            );
            $sent += $this->notifications->send($recipients, [
                'actor_user_id' => null,
                'module' => 'weekly_report',
                'event_key' => $eventKey,
                'title' => $isOverdue ? 'Báo cáo tuần đã quá hạn' : 'Báo cáo tuần đến hạn hôm nay',
                'message' => $setting->project?->project_name.' · hạn '.$dueDate->format('d/m/Y'),
                'kind' => 'action',
                'severity' => $isOverdue ? 'error' : 'warning',
                'entity_type' => 'project_weekly_setting',
                'entity_id' => $setting->id,
                'action_url' => '/weekly-reports',
                'data' => [
                    'projectId' => $setting->project_id,
                    'dueDate' => $dueDate->toDateString(),
                ],
                'dedupe_key' => implode(':', [$eventKey, $setting->id, $dueDate->toDateString()]),
            ])->count();
        }

        return $sent;
    }
}

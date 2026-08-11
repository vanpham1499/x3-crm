<?php

namespace App\Services;

use App\Http\Resources\MeetingResource;
use App\Models\Customer;
use App\Models\CustomerTimeline;
use App\Models\Meeting;
use App\Models\Project;
use App\Models\User;
use App\Repositories\MeetingRepository;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class MeetingsService extends BaseService
{
    public function __construct(
        private readonly MeetingRepository $meetings,
        private readonly NotificationDispatchService $notifications,
        private readonly NotificationRecipientResolver $notificationRecipients,
    ) {}

    public function findAll(array $filters): Collection
    {
        $this->authorize('viewAny', Meeting::class);

        return $this->apiCollection(
            $this->meetings->findVisible($this->requiredUser(), $filters),
            MeetingResource::class,
        );
    }

    public function findPaginated(array $filters, int $perPage, int $page): array
    {
        $this->authorize('viewAny', Meeting::class);

        return $this->apiPaginatedCollection(
            $this->meetings->paginateVisible($this->requiredUser(), $filters, $perPage, $page),
            MeetingResource::class,
        );
    }

    public function summary(): array
    {
        $this->authorize('viewAny', Meeting::class);

        $query = $this->meetings->visibleBaseQuery($this->requiredUser());
        $timezone = config('app.timezone', 'Asia/Ho_Chi_Minh');
        $todayStart = CarbonImmutable::today($timezone)->utc();
        $todayEnd = $todayStart->addDay();
        $now = CarbonImmutable::now('UTC');

        return [
            'today' => (clone $query)
                ->where('starts_at', '<', $todayEnd)
                ->where('ends_at', '>=', $todayStart)
                ->whereNotIn('status', [Meeting::STATUS_CANCELLED])
                ->count(),
            'upcoming' => (clone $query)
                ->where('starts_at', '>=', $now)
                ->where('starts_at', '<', $now->addDays(7))
                ->whereIn('status', Meeting::ACTIVE_STATUSES)
                ->count(),
            'waitingConfirmation' => (clone $query)
                ->where('starts_at', '>=', $now)
                ->where('status', Meeting::STATUS_SCHEDULED)
                ->count(),
            'overdue' => (clone $query)
                ->where('ends_at', '<', $now)
                ->whereIn('status', Meeting::ACTIVE_STATUSES)
                ->count(),
        ];
    }

    public function organizerOptions(): Collection
    {
        $this->authorize('viewAny', Meeting::class);

        return $this->meetings
            ->findVisibleOrganizers($this->requiredUser())
            ->map(fn (User $user): array => [
                'id' => $user->id,
                'code' => $user->code,
                'name' => $user->name,
            ])
            ->values();
    }

    public function findOne(string $id): array
    {
        $meeting = $this->meetings->findVisibleOrFail($this->requiredUser(), $id);
        $this->authorize('view', $meeting);

        return $this->apiResource($meeting, MeetingResource::class);
    }

    public function create(array $data): array
    {
        $this->authorize('create', Meeting::class);

        return $this->transaction(function () use ($data): array {
            [$payload, $participantIds, $guests, $allowConflict] = $this->preparePayload($data);
            $this->assertNoConflict(
                $payload['organizer_user_id'],
                $participantIds,
                $payload['starts_at'],
                $payload['ends_at'],
                null,
                $allowConflict,
            );

            /** @var Meeting $meeting */
            $meeting = $this->meetings->create([
                ...$payload,
                'status' => Meeting::STATUS_SCHEDULED,
            ]);
            $meeting->update([
                'meeting_code' => 'MTG-'.str_pad((string) $meeting->id, 6, '0', STR_PAD_LEFT),
            ]);
            $this->syncPeople($meeting, $participantIds, $guests);
            $this->recordHistory($meeting, 'created', ['meeting' => $this->snapshot($meeting)]);
            $this->notifyMeeting($meeting, $this->meetingRecipientIds($meeting), 'meeting_created');
            $this->recordTimeline($meeting, 'meeting_created', 'Tạo lịch hẹn');

            return $this->resource($meeting);
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            $meeting = $this->meetings->findVisibleOrFail($this->requiredUser(), $id);
            $this->authorize('update', $meeting);
            $this->assertActive($meeting);
            $before = $this->snapshot($meeting);
            $beforeRecipientIds = $this->meetingRecipientIds($meeting);

            [$payload, $participantIds, $guests, $allowConflict] = $this->preparePayload($data);
            $this->assertNoConflict(
                $payload['organizer_user_id'],
                $participantIds,
                $payload['starts_at'],
                $payload['ends_at'],
                $meeting->id,
                $allowConflict,
            );

            $timeChanged = ! $meeting->starts_at?->equalTo(CarbonImmutable::parse($payload['starts_at']))
                || ! $meeting->ends_at?->equalTo(CarbonImmutable::parse($payload['ends_at']));

            if ($timeChanged) {
                $payload['status'] = Meeting::STATUS_SCHEDULED;
            }

            $meeting->fill($payload)->save();
            $this->syncPeople($meeting, $participantIds, $guests);
            $action = $timeChanged ? 'rescheduled' : 'updated';
            $this->recordHistory($meeting, $action, [
                'before' => $before,
                'after' => $this->snapshot($meeting->refresh()),
            ]);
            $this->recordTimeline(
                $meeting,
                $timeChanged ? 'meeting_rescheduled' : 'meeting_updated',
                $timeChanged ? 'Đổi lịch hẹn' : 'Cập nhật lịch hẹn',
            );

            $recipientIds = $beforeRecipientIds
                ->merge($this->meetingRecipientIds($meeting))
                ->unique()
                ->values();
            $this->notifyMeeting($meeting, $recipientIds, $timeChanged ? 'meeting_rescheduled' : 'meeting_updated');

            return $this->resource($meeting);
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            $meeting = $this->meetings->findVisibleOrFail($this->requiredUser(), $id);
            $this->authorize('delete', $meeting);
            $this->recordTimeline($meeting, 'meeting_deleted', 'Xóa lịch hẹn');
            $recipientIds = $this->meetingRecipientIds($meeting);
            $this->notifyMeeting($meeting, $recipientIds, 'meeting_cancelled', 'Lịch hẹn đã bị xóa');
            $this->notifications->resolve('meeting', $meeting->id, ['meeting_reminder_24h', 'meeting_reminder_30m']);
            $meeting->deleted_by = $this->currentUser()?->id;
            $meeting->save();
            $meeting->delete();

            return ['message' => 'Xóa lịch hẹn thành công'];
        });
    }

    public function confirm(string $id): array
    {
        return $this->transition(
            $id,
            [Meeting::STATUS_SCHEDULED],
            Meeting::STATUS_CONFIRMED,
            'confirmed',
            'meeting_confirmed',
            'Xác nhận lịch hẹn',
        );
    }

    public function complete(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            $meeting = $this->meetings->findVisibleOrFail($this->requiredUser(), $id);
            $this->authorize('update', $meeting);
            $this->assertActive($meeting);
            $meeting->update([
                'status' => Meeting::STATUS_COMPLETED,
                'result' => trim((string) $data['result']),
                'next_action' => filled($data['nextAction'] ?? null) ? trim((string) $data['nextAction']) : null,
                'next_action_date' => $data['nextActionDate'] ?? null,
                'completed_at' => now(),
                'cancelled_at' => null,
                'cancellation_reason' => null,
            ]);
            $this->recordHistory($meeting, 'completed', [
                'result' => $meeting->result,
                'nextAction' => $meeting->next_action,
                'nextActionDate' => $meeting->next_action_date?->toDateString(),
            ]);
            $this->recordTimeline($meeting, 'meeting_completed', 'Hoàn thành lịch hẹn');

            return $this->resource($meeting);
        });
    }

    public function cancel(string $id, string $reason): array
    {
        return $this->transaction(function () use ($id, $reason): array {
            $meeting = $this->meetings->findVisibleOrFail($this->requiredUser(), $id);
            $this->authorize('update', $meeting);
            $this->assertActive($meeting);
            $meeting->update([
                'status' => Meeting::STATUS_CANCELLED,
                'cancellation_reason' => trim($reason),
                'cancelled_at' => now(),
            ]);
            $this->notifyMeeting($meeting, $this->meetingRecipientIds($meeting), 'meeting_cancelled');
            $this->notifications->resolve('meeting', $meeting->id, ['meeting_reminder_24h', 'meeting_reminder_30m']);
            $this->recordHistory($meeting, 'cancelled', ['reason' => $meeting->cancellation_reason]);
            $this->recordTimeline($meeting, 'meeting_cancelled', 'Hủy lịch hẹn');

            return $this->resource($meeting);
        });
    }

    public function markNoShow(string $id): array
    {
        return $this->transition(
            $id,
            Meeting::ACTIVE_STATUSES,
            Meeting::STATUS_NO_SHOW,
            'no_show',
            'meeting_no_show',
            'Khách không tham gia lịch hẹn',
        );
    }

    private function transition(
        string $id,
        array $fromStatuses,
        string $toStatus,
        string $historyAction,
        string $timelineAction,
        string $timelineTitle,
    ): array {
        return $this->transaction(function () use (
            $id,
            $fromStatuses,
            $toStatus,
            $historyAction,
            $timelineAction,
            $timelineTitle,
        ): array {
            $meeting = $this->meetings->findVisibleOrFail($this->requiredUser(), $id);
            $this->authorize('update', $meeting);

            if (! in_array($meeting->status, $fromStatuses, true)) {
                throw ValidationException::withMessages([
                    'status' => ['Trạng thái lịch hẹn hiện tại không cho phép thao tác này.'],
                ]);
            }

            $meeting->update(['status' => $toStatus]);
            $this->recordHistory($meeting, $historyAction, ['status' => $toStatus]);
            $this->recordTimeline($meeting, $timelineAction, $timelineTitle);

            return $this->resource($meeting);
        });
    }

    private function preparePayload(array $data): array
    {
        $projectId = $this->nullableInt($data['projectId'] ?? null);
        $customerId = $this->nullableInt($data['customerId'] ?? null);
        $leadId = $this->nullableInt($data['leadId'] ?? null);

        if ($projectId) {
            $project = Project::query()->with('customer')->findOrFail($projectId);
            $customerId = $project->customer_id;
            $leadId = $project->customer?->lead_id;
        } elseif ($customerId) {
            $customer = Customer::query()->findOrFail($customerId);
            $leadId = $customer->lead_id;
        }

        $timezone = (string) ($data['timezone'] ?? config('app.timezone', 'Asia/Ho_Chi_Minh'));
        $startsAt = CarbonImmutable::parse((string) $data['startsAt'], $timezone)->utc();
        $endsAt = CarbonImmutable::parse((string) $data['endsAt'], $timezone)->utc();
        $organizerId = (int) $data['organizerUserId'];
        $participantIds = collect($data['participantUserIds'] ?? [])
            ->map(fn ($id): int => (int) $id)
            ->reject(fn (int $id): bool => $id === $organizerId)
            ->unique()
            ->values()
            ->all();
        $guests = collect($data['guests'] ?? [])
            ->map(fn (array $guest): array => [
                'name' => trim((string) $guest['name']),
                'email' => filled($guest['email'] ?? null) ? trim((string) $guest['email']) : null,
                'phone' => filled($guest['phone'] ?? null) ? trim((string) $guest['phone']) : null,
                'attendance_status' => 'pending',
            ])
            ->values()
            ->all();

        return [[
            'lead_id' => $leadId,
            'customer_id' => $customerId,
            'project_id' => $projectId,
            'organizer_user_id' => $organizerId,
            'subject' => trim((string) $data['subject']),
            'meeting_type' => $data['meetingType'],
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
            'timezone' => $timezone,
            'location' => filled($data['location'] ?? null) ? trim((string) $data['location']) : null,
            'meeting_url' => filled($data['meetingUrl'] ?? null) ? trim((string) $data['meetingUrl']) : null,
            'agenda' => filled($data['agenda'] ?? null) ? trim((string) $data['agenda']) : null,
        ], $participantIds, $guests, (bool) ($data['allowConflict'] ?? false)];
    }

    private function assertNoConflict(
        int $organizerId,
        array $participantIds,
        CarbonImmutable $startsAt,
        CarbonImmutable $endsAt,
        ?int $exceptMeetingId,
        bool $allowConflict,
    ): void {
        if ($allowConflict) {
            return;
        }

        $conflicts = $this->meetings->conflictingMeetings(
            array_values(array_unique([$organizerId, ...$participantIds])),
            $startsAt->toDateTimeString(),
            $endsAt->toDateTimeString(),
            $exceptMeetingId,
        );

        if ($conflicts->isEmpty()) {
            return;
        }

        $labels = $conflicts
            ->take(3)
            ->map(fn (Meeting $meeting): string => sprintf(
                '%s (%s - %s)',
                $meeting->subject,
                $meeting->starts_at?->timezone(config('app.timezone'))->format('d/m H:i'),
                $meeting->ends_at?->timezone(config('app.timezone'))->format('H:i'),
            ))
            ->all();

        throw ValidationException::withMessages([
            'startsAt' => ['Có nhân sự đang trùng lịch. Hãy kiểm tra hoặc xác nhận vẫn tạo lịch.'],
            'conflicts' => $labels,
        ]);
    }

    private function syncPeople(Meeting $meeting, array $participantIds, array $guests): void
    {
        $meeting->participants()->sync(
            collect($participantIds)
                ->mapWithKeys(fn (int $id): array => [$id => ['attendance_status' => 'pending']])
                ->all(),
        );
        $meeting->guests()->delete();

        if ($guests !== []) {
            $meeting->guests()->createMany($guests);
        }
    }

    /** @return Collection<int, int> */
    private function meetingRecipientIds(Meeting $meeting): Collection
    {
        return collect([$meeting->organizer_user_id])
            ->merge($meeting->participants()->pluck('users.id'))
            ->filter()
            ->map(fn ($id): int => (int) $id)
            ->unique()
            ->values();
    }

    private function notifyMeeting(
        Meeting $meeting,
        Collection $recipientIds,
        string $eventKey,
        ?string $title = null,
    ): void {
        $titles = [
            'meeting_created' => 'Bạn có lịch hẹn mới',
            'meeting_updated' => 'Lịch hẹn đã được cập nhật',
            'meeting_rescheduled' => 'Thời gian lịch hẹn đã thay đổi',
            'meeting_cancelled' => 'Lịch hẹn đã bị hủy',
        ];
        $time = $meeting->starts_at
            ? $meeting->starts_at->timezone($meeting->timezone ?: 'Asia/Ho_Chi_Minh')->format('H:i d/m/Y')
            : null;

        $this->notifications->send($this->notificationRecipients->authorizedUsers($recipientIds, 'view', $meeting), [
            'module' => 'meeting',
            'event_key' => $eventKey,
            'title' => $title ?? ($titles[$eventKey] ?? 'Lịch hẹn được cập nhật'),
            'message' => trim($meeting->subject.($time ? ' · '.$time : '')),
            'severity' => $eventKey === 'meeting_cancelled' ? 'warning' : 'info',
            'entity_type' => 'meeting',
            'entity_id' => $meeting->id,
            'action_url' => '/meetings',
            'dedupe_key' => implode(':', [$eventKey, $meeting->id, $meeting->updated_at?->format('YmdHisu')]),
        ]);
    }

    private function assertActive(Meeting $meeting): void
    {
        if (! in_array($meeting->status, Meeting::ACTIVE_STATUSES, true)) {
            throw ValidationException::withMessages([
                'status' => ['Chỉ lịch đang chờ xác nhận hoặc đã xác nhận mới được cập nhật.'],
            ]);
        }
    }

    private function recordHistory(Meeting $meeting, string $action, array $payload): void
    {
        $meeting->histories()->create([
            'action' => $action,
            'payload' => $payload,
            'actor_user_id' => $this->currentUser()?->id,
        ]);
    }

    private function recordTimeline(Meeting $meeting, string $action, string $title): void
    {
        if (! $meeting->lead_id && ! $meeting->customer_id && ! $meeting->project_id) {
            return;
        }

        CustomerTimeline::query()->create([
            'lead_id' => $meeting->lead_id,
            'customer_id' => $meeting->customer_id,
            'project_id' => $meeting->project_id,
            'type' => 'meeting',
            'content' => json_encode([
                'action' => $action,
                'title' => $title,
                'meeting' => $this->snapshot($meeting),
                'result' => $meeting->result,
                'nextAction' => $meeting->next_action,
                'cancellationReason' => $meeting->cancellation_reason,
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'next_action_date' => $meeting->next_action_date,
            'created_by' => $this->currentUser()?->id,
        ]);
    }

    private function snapshot(Meeting $meeting): array
    {
        return [
            'id' => $meeting->id,
            'meetingCode' => $meeting->meeting_code,
            'subject' => $meeting->subject,
            'meetingType' => $meeting->meeting_type,
            'startsAt' => $meeting->starts_at?->toISOString(),
            'endsAt' => $meeting->ends_at?->toISOString(),
            'status' => $meeting->status,
            'location' => $meeting->location,
            'meetingUrl' => $meeting->meeting_url,
        ];
    }

    private function resource(Meeting $meeting): array
    {
        return $this->apiResource(
            $meeting->refresh()->load([
                'lead',
                'customer',
                'project',
                'organizer.department',
                'participants.department',
                'guests',
                'histories.actor',
                'createdBy',
            ]),
            MeetingResource::class,
        );
    }

    private function requiredUser(): User
    {
        $user = $this->currentUser();

        if (! $user) {
            throw new AuthorizationException('Bạn cần đăng nhập để xem lịch hẹn.');
        }

        return $user;
    }

    private function nullableInt(mixed $value): ?int
    {
        return filled($value) ? (int) $value : null;
    }
}

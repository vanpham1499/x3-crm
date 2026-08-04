<?php

namespace App\Services;

use App\Events\UserNotificationsChanged;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Support\Collection;

class NotificationDispatchService
{
    /**
     * @param  iterable<int|User>  $recipients
     * @param  array<string, mixed>  $payload
     * @return Collection<int, UserNotification>
     */
    public function send(iterable $recipients, array $payload): Collection
    {
        $actorId = $payload['actor_user_id'] ?? request()->user()?->id;
        $recipientIds = collect($recipients)
            ->map(fn ($recipient) => $recipient instanceof User ? $recipient->id : $recipient)
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->reject(fn (int $id) => $actorId && $id === (int) $actorId)
            ->values();

        if ($recipientIds->isEmpty()) {
            return collect();
        }

        $activeRecipientIds = User::query()
            ->whereIn('id', $recipientIds)
            ->where('is_active', true)
            ->pluck('id');

        $notifications = $activeRecipientIds->map(function ($recipientId) use ($payload, $actorId): UserNotification {
            $userId = (int) $recipientId;
            $dedupeKey = (string) ($payload['dedupe_key'] ?? implode(':', [
                $payload['event_key'],
                $payload['entity_type'] ?? 'global',
                $payload['entity_id'] ?? '0',
                now()->format('YmdHisu'),
            ]));

            $notification = UserNotification::query()->firstOrCreate(
                [
                    'user_id' => $userId,
                    'dedupe_key' => $dedupeKey,
                ],
                [
                    'actor_user_id' => $actorId,
                    'module' => $payload['module'],
                    'event_key' => $payload['event_key'],
                    'title' => $payload['title'],
                    'message' => $payload['message'] ?? null,
                    'kind' => $payload['kind'] ?? UserNotification::KIND_INFO,
                    'severity' => $payload['severity'] ?? 'info',
                    'entity_type' => $payload['entity_type'] ?? null,
                    'entity_id' => $payload['entity_id'] ?? null,
                    'action_url' => $payload['action_url'] ?? null,
                    'data' => $payload['data'] ?? null,
                ],
            );

            if ($notification->wasRecentlyCreated) {
                UserNotificationsChanged::dispatch($userId, 'created', (int) $notification->id);
            } elseif (($payload['reopen_resolved'] ?? false) && $notification->resolved_at) {
                $notification->forceFill([
                    'actor_user_id' => $actorId,
                    'title' => $payload['title'],
                    'message' => $payload['message'] ?? null,
                    'kind' => $payload['kind'] ?? UserNotification::KIND_ACTION,
                    'severity' => $payload['severity'] ?? 'warning',
                    'action_url' => $payload['action_url'] ?? $notification->action_url,
                    'data' => $payload['data'] ?? $notification->data,
                    'read_at' => null,
                    'resolved_at' => null,
                    'archived_at' => null,
                ])->save();
                UserNotificationsChanged::dispatch($userId, 'reopened', (int) $notification->id);
            }

            return $notification;
        });

        return $notifications;
    }

    public function resolve(string $entityType, int|string $entityId, array $eventKeys = []): int
    {
        $query = UserNotification::query()
            ->where('entity_type', $entityType)
            ->where('entity_id', $entityId)
            ->whereNull('resolved_at')
            ->when($eventKeys !== [], fn ($query) => $query->whereIn('event_key', $eventKeys));
        $recipientIds = (clone $query)->distinct()->pluck('user_id');
        $updated = $query->update(['resolved_at' => now()]);

        if ($updated > 0) {
            $recipientIds->each(fn ($userId) => UserNotificationsChanged::dispatch(
                (int) $userId,
                'resolved',
            ));
        }

        return $updated;
    }
}

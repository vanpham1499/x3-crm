<?php

namespace App\Services;

use App\Events\UserNotificationsChanged;
use App\Http\Resources\UserNotificationResource;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class UserNotificationsService extends BaseService
{
    public function findPaginated(User $user, string $filter, int $perPage, int $page): array
    {
        $paginator = UserNotification::query()
            ->where('user_id', $user->id)
            ->when(
                $filter === 'archived',
                fn ($query) => $query->whereNotNull('archived_at'),
                fn ($query) => $query->whereNull('archived_at'),
            )
            ->when($filter === 'unread', fn ($query) => $query->whereNull('read_at'))
            ->when($filter === 'action', fn ($query) => $query
                ->where('kind', UserNotification::KIND_ACTION)
                ->whereNull('resolved_at'))
            ->with('actor:id,code,name')
            ->orderByRaw("CASE WHEN kind = 'action' AND resolved_at IS NULL THEN 0 ELSE 1 END")
            ->latest()
            ->paginate($perPage, ['*'], 'page', $page);

        return $this->paginated($paginator);
    }

    public function summary(User $user): array
    {
        $query = UserNotification::query()
            ->where('user_id', $user->id)
            ->whereNull('archived_at');

        return [
            'totalCount' => (clone $query)->count(),
            'archivedCount' => UserNotification::query()
                ->where('user_id', $user->id)
                ->whereNotNull('archived_at')
                ->count(),
            'unreadCount' => (clone $query)->whereNull('read_at')->count(),
            'pendingActionCount' => (clone $query)
                ->where('kind', UserNotification::KIND_ACTION)
                ->whereNull('resolved_at')
                ->count(),
            'attentionCount' => (clone $query)->whereNull('read_at')->count(),
        ];
    }

    public function markRead(User $user, int|string $id): array
    {
        $notification = $this->findOwned($user, $id);

        if (! $notification->read_at) {
            $notification->update(['read_at' => now()]);
            UserNotificationsChanged::dispatch($user->id, 'read', $notification->id);
        }

        return (new UserNotificationResource($notification->load('actor:id,code,name')))->resolve();
    }

    public function markAllRead(User $user): int
    {
        $updated = UserNotification::query()
            ->where('user_id', $user->id)
            ->whereNull('archived_at')
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        if ($updated > 0) {
            UserNotificationsChanged::dispatch($user->id, 'read_all');
        }

        return $updated;
    }

    public function archive(User $user, int|string $id): array
    {
        $notification = $this->findOwned($user, $id);
        $notification->update([
            'read_at' => $notification->read_at ?? now(),
            'archived_at' => now(),
        ]);
        UserNotificationsChanged::dispatch($user->id, 'archived', $notification->id);

        return ['id' => $notification->id, 'archived' => true];
    }

    public function restore(User $user, int|string $id): array
    {
        $notification = UserNotification::query()
            ->where('user_id', $user->id)
            ->whereNotNull('archived_at')
            ->findOrFail($id);
        $notification->update(['archived_at' => null]);
        UserNotificationsChanged::dispatch($user->id, 'restored', $notification->id);

        return ['id' => $notification->id, 'archived' => false];
    }

    private function findOwned(User $user, int|string $id): UserNotification
    {
        return UserNotification::query()
            ->where('user_id', $user->id)
            ->whereNull('archived_at')
            ->findOrFail($id);
    }

    private function paginated(LengthAwarePaginator $paginator): array
    {
        return [
            'data' => $paginator->getCollection()
                ->map(fn (UserNotification $notification) => (new UserNotificationResource($notification))->resolve())
                ->values(),
            'meta' => [
                'currentPage' => $paginator->currentPage(),
                'lastPage' => $paginator->lastPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
        ];
    }
}

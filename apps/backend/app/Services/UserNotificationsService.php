<?php

namespace App\Services;

use App\Events\UserNotificationsChanged;
use App\Http\Resources\UserNotificationResource;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UserNotificationsService extends BaseService
{
    public function previewHandleAll(User $user, ?string $module = null, bool $unread = false): array
    {
        // Freeze the selection before confirmation, including results beyond the loaded page.
        $ids = UserNotification::query()->where('user_id', $user->id)->pendingInbox()
            ->when($module, fn ($q) => $q->whereRaw('('.UserNotification::INBOX_MODULE_SQL.') = ?', [$module]))
            ->when($unread, fn ($q) => $q->whereNull('read_at'))
            ->orderBy('id')->pluck('id')->all();

        return [
            'count' => count($ids),
            'token' => Crypt::encryptString(json_encode([
                'userId' => (int) $user->id, 'ids' => $ids, 'expiresAt' => now()->addMinutes(5)->timestamp,
            ], JSON_THROW_ON_ERROR)),
        ];
    }

    public function handleAll(User $user, string $token): int
    {
        try {
            $selection = json_decode(Crypt::decryptString($token), true, 512, JSON_THROW_ON_ERROR);
        } catch (\Illuminate\Contracts\Encryption\DecryptException|\JsonException $e) {
            throw ValidationException::withMessages(['token' => 'Danh sách xác nhận không hợp lệ. Vui lòng chọn lại.']);
        }
        if (($selection['userId'] ?? null) !== (int) $user->id || ($selection['expiresAt'] ?? 0) <= now()->timestamp) {
            throw ValidationException::withMessages(['token' => 'Danh sách xác nhận đã hết hiệu lực. Vui lòng chọn lại.']);
        }

        return $this->transaction(function () use ($user, $selection): int {
            $updated = 0;
            foreach (array_chunk($selection['ids'], 500) as $ids) {
                $rows = UserNotification::query()->where('user_id', $user->id)->whereIn('id', $ids)
                    ->pendingInbox()->orderBy('id')->lockForUpdate()->get();
                if ($rows->isEmpty()) continue;
                $at = now();
                $updated += UserNotification::query()->where('user_id', $user->id)->whereIn('id', $rows->modelKeys())
                    ->pendingInbox()->update([
                        'handled_at' => $at,
                        'read_at' => DB::raw('COALESCE(read_at, '.$this->quoteTimestamp($at->toDateTimeString()).')'),
                        'inbox_reopened_at' => null,
                    ]);
            }
            if ($updated > 0) UserNotificationsChanged::dispatch((int) $user->id, 'handled_all');

            return $updated;
        });
    }

    private function quoteTimestamp(string $timestamp): string
    {
        return DB::connection()->getPdo()->quote($timestamp);
    }

    public function findPaginated(User $user, string $filter, int $perPage, int $page, ?string $module = null, bool $unread = false): array
    {
        $query = UserNotification::query()->where('user_id', $user->id);
        if ($filter === 'archived') {
            $query->whereNotNull('archived_at'); // Compatibility with older clients.
        } elseif ($filter === 'done') {
            $query->doneInbox();
        } else {
            $query->pendingInbox();
        }
        $paginator = $query
            ->when($module, fn ($q) => $q->whereRaw('('.UserNotification::INBOX_MODULE_SQL.') = ?', [$module]))
            ->when($unread || $filter === 'unread', fn ($q) => $q->whereNull('read_at'))
            ->when($filter === 'action', fn ($q) => $q->where('kind', UserNotification::KIND_ACTION)->whereNull('resolved_at'))
            ->with('actor:id,code,name')
            ->when($filter === 'done', fn ($q) => $q->orderByRaw('COALESCE(handled_at, archived_at, resolved_at) DESC'))
            ->orderByDesc('created_at')->orderByDesc('id')
            ->paginate($perPage, ['*'], 'page', $page);

        return $this->paginated($paginator);
    }

    public function summary(User $user): array
    {
        $pending = 'handled_at IS NULL AND archived_at IS NULL AND (resolved_at IS NULL OR inbox_reopened_at IS NOT NULL)';
        $rows = UserNotification::query()->where('user_id', $user->id)
            ->selectRaw(UserNotification::INBOX_MODULE_SQL.' as inbox_module')->selectRaw("COUNT(*) as total,
                SUM(CASE WHEN {$pending} THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN {$pending} AND read_at IS NULL THEN 1 ELSE 0 END) as unread,
                SUM(CASE WHEN {$pending} AND kind = 'action' AND resolved_at IS NULL THEN 1 ELSE 0 END) as actions,
                SUM(CASE WHEN archived_at IS NOT NULL THEN 1 ELSE 0 END) as archived")
            ->groupByRaw(UserNotification::INBOX_MODULE_SQL)->get();
        $modules = $rows->map(fn ($row) => [
            'module' => $row->inbox_module, 'pendingCount' => (int) $row->pending,
            'doneCount' => (int) $row->total - (int) $row->pending, 'unreadCount' => (int) $row->unread,
        ])->values();

        return [
            'totalCount' => (int) $rows->sum('pending'),
            'doneCount' => (int) $modules->sum('doneCount'),
            'archivedCount' => (int) $rows->sum('archived'),
            'unreadCount' => (int) $rows->sum('unread'),
            'pendingActionCount' => (int) $rows->sum('actions'),
            'attentionCount' => (int) $rows->sum('pending'),
            'modules' => $modules,
        ];
    }

    public function handle(User $user, int|string $id): array
    {
        return $this->transaction(function () use ($user, $id): array {
            $notification = UserNotification::where('user_id', $user->id)->lockForUpdate()->findOrFail($id);
            if (! $notification->inboxIsDone()) {
                $notification->update(['handled_at' => now(), 'read_at' => $notification->read_at ?? now(), 'inbox_reopened_at' => null]);
                UserNotificationsChanged::dispatch($user->id, 'handled', $notification->id);
            }

            return (new UserNotificationResource($notification->load('actor:id,code,name')))->resolve();
        });
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
            ->pendingInbox()
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
        return $this->transaction(function () use ($user, $id): array {
            $notification = UserNotification::where('user_id', $user->id)->lockForUpdate()->findOrFail($id);
            if ($notification->inboxIsDone()) {
                $notification->update([
                    'handled_at' => null, 'archived_at' => null,
                    // Reopens only this recipient's inbox, never the underlying business record.
                    'inbox_reopened_at' => now(),
                ]);
                UserNotificationsChanged::dispatch($user->id, 'restored', $notification->id);
            }

            return (new UserNotificationResource($notification->load('actor:id,code,name')))->resolve();
        });
    }

    private function findOwned(User $user, int|string $id): UserNotification
    {
        return UserNotification::query()
            ->where('user_id', $user->id)
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

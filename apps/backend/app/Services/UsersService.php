<?php

namespace App\Services;

use App\Http\Resources\UserResource;
use App\Models\User;
use App\Repositories\UserRepository;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class UsersService extends BaseService
{
    private const DATA_SCOPE_MODULES = [
        'lead',
        'customer',
        'project',
        'meeting',
        'weeklyreport',
        'p2point',
    ];

    private const DATA_SCOPE_ACTIONS = ['view', 'create', 'update', 'delete', 'approve'];

    public function __construct(private readonly UserRepository $users) {}

    public function findAll(array $filters = [])
    {
        return $this->apiCollection($this->users->findAll($filters), UserResource::class);
    }

    public function findLookup(array $filters = [], ?string $context = null)
    {
        $module = in_array($context, self::DATA_SCOPE_MODULES, true) ? $context : null;
        $currentUser = $this->currentUser();

        if ($module && $currentUser) {
            $hasAllScope = collect(self::DATA_SCOPE_ACTIONS)
                ->contains(fn (string $action): bool => $currentUser->hasPermission("{$module}.{$action}_all"));

            if (! $hasAllScope) {
                $hasDepartmentScope = collect(self::DATA_SCOPE_ACTIONS)
                    ->contains(fn (string $action): bool => $currentUser->hasPermission("{$module}.{$action}_department"));

                if (
                    $currentUser->department_id
                    && $hasDepartmentScope
                ) {
                    $filters['department_id'] = $currentUser->department_id;
                } else {
                    $filters['id'] = $currentUser->id;
                }
            }
        }

        return $this->apiCollection($this->users->findAll($filters), UserResource::class);
    }

    public function findOne(string $id): array
    {
        /** @var User $user */
        $user = $this->users->findOrFail($id);

        return $this->apiResource($user, UserResource::class);
    }

    public function findByEmail(string $email): ?User
    {
        return $this->users->findByEmail($email);
    }

    public function create(array $data): array
    {
        return $this->transaction(function () use ($data): array {
            if ($this->users->existsActiveByEmailOrCode($data['email'], $data['code'])) {
                throw new ConflictHttpException('Email hoặc mã nhân viên đã tồn tại');
            }

            $data['role_id'] = $this->resolveRoleId($data['role']);
            $data['password'] = Hash::make($data['password']);
            $data['is_active'] = true;

            /** @var User $user */
            $user = $this->users->create($data);

            return $this->apiResource($user, UserResource::class);
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            $adminRoleId = $this->lockAdminRoleId();
            /** @var User $user */
            $user = User::query()->lockForUpdate()->findOrFail($id);

            if (array_key_exists('isActive', $data)) {
                $data['is_active'] = $data['isActive'];
                unset($data['isActive']);
            }

            if (array_key_exists('role', $data)) {
                $data['role_id'] = $this->resolveRoleId($data['role']);
            }

            if (array_key_exists('password', $data)) {
                if (filled($data['password'])) {
                    $data['password'] = Hash::make($data['password']);
                } else {
                    unset($data['password']);
                }
            }

            $this->ensureAdminContinuity($user, $data, $adminRoleId);

            $user = $this->users->update($id, $data);

            return $this->apiResource($user, UserResource::class);
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            $adminRoleId = $this->lockAdminRoleId();
            /** @var User $user */
            $user = User::query()->lockForUpdate()->findOrFail($id);
            $this->ensureAdminContinuity($user, [], $adminRoleId, true);
            $this->users->delete($id);

            return ['message' => 'Xóa nhân viên thành công'];
        });
    }

    public function updatePassword(string $id, string $hashedPassword): void
    {
        $this->transaction(fn () => $this->users->updatePassword($id, $hashedPassword));
    }

    public function getStats(): array
    {
        $byRole = $this->users
            ->countActiveByRole()
            ->map(fn ($row) => ['role' => $row->role, '_count' => (int) $row->_count])
            ->values();

        return [
            'total' => $this->users->countActive(),
            'byRole' => $byRole,
        ];
    }

    private function resolveRoleId(string $role): string
    {
        $roleId = DB::table('roles')
            ->where('name', $role)
            ->whereNull('deleted_at')
            ->value('id');

        if (! $roleId) {
            throw new UnprocessableEntityHttpException('Vai trò không tồn tại trong danh mục roles');
        }

        return $roleId;
    }

    private function lockAdminRoleId(): int|string|null
    {
        return DB::table('roles')
            ->where('name', User::ROLE_ADMIN)
            ->whereNull('deleted_at')
            ->lockForUpdate()
            ->value('id');
    }

    private function ensureAdminContinuity(
        User $user,
        array $nextData,
        int|string|null $adminRoleId,
        bool $deleting = false,
    ): void {
        if (! $adminRoleId) {
            return;
        }

        $isAdmin = (string) $user->role_id === (string) $adminRoleId
            || $user->role === User::ROLE_ADMIN;

        if (! $isAdmin) {
            return;
        }

        $adminQuery = User::query()->where(function ($query) use ($adminRoleId): void {
            $query
                ->where('role_id', $adminRoleId)
                ->orWhere('role', User::ROLE_ADMIN);
        });
        $adminCount = (clone $adminQuery)->count();
        $activeAdminCount = (clone $adminQuery)->where('is_active', true)->count();
        $willRemainAdmin = ! $deleting
            && (! array_key_exists('role_id', $nextData)
                || (string) $nextData['role_id'] === (string) $adminRoleId);
        $willRemainActive = ! $deleting
            && (bool) ($nextData['is_active'] ?? $user->is_active);

        if (! $willRemainAdmin && $adminCount <= 1) {
            throw new ConflictHttpException(
                'Không thể đổi vai trò của admin duy nhất. Hãy tạo thêm một admin trước.',
            );
        }

        if (
            $user->is_active
            && (! $willRemainAdmin || ! $willRemainActive)
            && $activeAdminCount <= 1
        ) {
            throw new ConflictHttpException(
                'Không thể vô hiệu hóa hoặc xóa admin đang hoạt động cuối cùng.',
            );
        }

        if ($deleting && $adminCount <= 1) {
            throw new ConflictHttpException(
                'Không thể xóa admin duy nhất. Hãy tạo thêm một admin trước.',
            );
        }
    }
}

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
    public function __construct(private readonly UserRepository $users)
    {
    }

    public function findAll(?string $search = null)
    {
        return $this->apiCollection($this->users->findAll($search), UserResource::class);
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
            if ($this->users->existsByEmailOrCode($data['email'], $data['code'])) {
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
            if (array_key_exists('isActive', $data)) {
                $data['is_active'] = $data['isActive'];
                unset($data['isActive']);
            }

            if (array_key_exists('role', $data)) {
                $data['role_id'] = $this->resolveRoleId($data['role']);
            }

            /** @var User $user */
            $user = $this->users->update($id, $data);

            return $this->apiResource($user, UserResource::class);
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            /** @var User $user */
            $user = $this->users->deactivate($id);

            return $this->apiResource($user, UserResource::class);
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
        $roleId = DB::table('roles')->where('name', $role)->value('id');

        if (! $roleId) {
            throw new UnprocessableEntityHttpException('Vai trò không tồn tại trong danh mục roles');
        }

        return $roleId;
    }
}

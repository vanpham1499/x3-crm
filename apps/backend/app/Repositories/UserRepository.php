<?php

namespace App\Repositories;

use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

class UserRepository extends BaseRepository
{
    protected string $notFoundMessage = 'Nhân viên không tồn tại';

    protected function model(): string
    {
        return User::class;
    }

    public function findAll(array $filters = []): Collection
    {
        $keyword = trim((string) ($filters['keyword'] ?? $filters['search'] ?? ''));
        $roleId = $filters['role_id'] ?? null;
        $isActive = $filters['is_active'] ?? null;

        return $this->query()
            ->when($keyword !== '', function ($query) use ($keyword): void {
                $query->where(function ($query) use ($keyword): void {
                    $query
                        ->where('name', 'ilike', "%{$keyword}%")
                        ->orWhere('code', 'ilike', "%{$keyword}%")
                        ->orWhere('email', 'ilike', "%{$keyword}%");
                });
            })
            ->when($roleId, fn ($query) => $query->where('role_id', $roleId))
            ->when($isActive !== null && $isActive !== '', function ($query) use ($isActive): void {
                $query->where('is_active', filter_var($isActive, FILTER_VALIDATE_BOOLEAN));
            })
            ->orderBy('code')
            ->get();
    }

    public function findByEmail(string $email): ?User
    {
        /** @var User|null $user */
        $user = $this->firstWhere('email', $email);

        return $user;
    }

    public function existsByEmailOrCode(string $email, string $code): bool
    {
        return $this->query()
            ->where('email', $email)
            ->orWhere('code', $code)
            ->exists();
    }

    public function deactivate(string $id): Model
    {
        return $this->update($id, ['is_active' => false]);
    }

    public function updatePassword(string $id, string $hashedPassword): Model
    {
        return $this->update($id, ['password' => $hashedPassword]);
    }

    public function countActive(): int
    {
        return $this->query()->where('is_active', true)->count();
    }

    public function countActiveByRole(): Collection
    {
        return $this->query()
            ->selectRaw('role, count(*) as _count')
            ->where('is_active', true)
            ->groupBy('role')
            ->orderBy('role')
            ->get();
    }
}

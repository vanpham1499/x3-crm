<?php

namespace App\Services;

use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpKernel\Exception\UnauthorizedHttpException;

class AuthService extends BaseService
{
    public function __construct(private readonly UsersService $users) {}

    public function login(string $email, string $password, bool $remember = false): array
    {
        $user = $this->users->findByEmail($email);

        if (! $user || ! $user->is_active) {
            throw new UnauthorizedHttpException('', 'Tài khoản không tồn tại hoặc đã bị khóa');
        }

        if (! Hash::check($password, $user->password)) {
            throw new UnauthorizedHttpException('', 'Sai mật khẩu');
        }

        $guard = Auth::guard('web');
        $guard->setRememberDuration((int) config('auth.remember_duration', 43200));
        $guard->login($user, $remember);

        return $this->getProfile($user);
    }

    public function getProfile(User $user): array
    {
        $user->load('roleRef.permissions');

        return [
            'user' => $this->apiResource($user, UserResource::class),
            'role' => $user->roleRef ? [
                'id' => $user->roleRef->id,
                'name' => $user->roleRef->name,
                'description' => $user->roleRef->description,
            ] : null,
            'permissions' => $user->roleRef
                ? $user->roleRef->permissions->pluck('code')->values()
                : [],
        ];
    }

    public function logout(): array
    {
        return ['message' => 'Đăng xuất thành công'];
    }

    public function updateProfile(User $user, array $data): array
    {
        return $this->transaction(function () use ($user, $data): array {
            $user->fill(collect($data)->only(['name', 'phone', 'avatar'])->all());
            $user->updated_by = $user->id;
            $user->save();

            return $this->getProfile($user->refresh());
        });
    }

    public function changePassword(User $user, string $currentPassword, string $newPassword): array
    {
        if (! Hash::check($currentPassword, $user->password)) {
            throw new UnauthorizedHttpException('', 'Mật khẩu hiện tại không đúng');
        }

        $this->users->updatePassword($user->id, Hash::make($newPassword));

        return ['message' => 'Đổi mật khẩu thành công'];
    }
}

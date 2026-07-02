<?php

namespace App\Services;

use App\Http\Resources\UserResource;
use App\Models\User;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpKernel\Exception\UnauthorizedHttpException;

class AuthService extends BaseService
{
    public function __construct(private readonly UsersService $users)
    {
    }

    public function login(string $email, string $password): array
    {
        $user = $this->users->findByEmail($email);

        if (! $user || ! $user->is_active) {
            throw new UnauthorizedHttpException('', 'Tài khoản không tồn tại hoặc đã bị khóa');
        }

        if (! Hash::check($password, $user->password)) {
            throw new UnauthorizedHttpException('', 'Sai mật khẩu');
        }

        return [
            'access_token' => $this->makeToken($user),
            'user' => [
                'id' => $user->id,
                'code' => $user->code,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'phone' => $user->phone,
            ],
        ];
    }

    public function getProfile(User $user): array
    {
        return $this->apiResource($user, UserResource::class);
    }

    public function changePassword(User $user, string $currentPassword, string $newPassword): array
    {
        if (! Hash::check($currentPassword, $user->password)) {
            throw new UnauthorizedHttpException('', 'Mật khẩu hiện tại không đúng');
        }

        $this->users->updatePassword($user->id, Hash::make($newPassword));

        return ['message' => 'Đổi mật khẩu thành công'];
    }

    private function makeToken(User $user): string
    {
        $now = time();

        return JWT::encode([
            'iat' => $now,
            'exp' => $now + config('jwt.ttl'),
            'sub' => $user->id,
            'email' => $user->email,
            'role' => $user->role,
            'code' => $user->code,
            'name' => $user->name,
        ], config('jwt.secret'), 'HS256');
    }
}

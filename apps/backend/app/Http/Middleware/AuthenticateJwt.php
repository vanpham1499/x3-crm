<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Firebase\JWT\ExpiredException;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateJwt
{
    public function handle(Request $request, Closure $next): Response
    {
        $header = $request->header('Authorization', '');

        if (! str_starts_with($header, 'Bearer ')) {
            return response()->json(['message' => 'Chưa đăng nhập'], 401);
        }

        try {
            $token = trim(substr($header, 7));
            $payload = JWT::decode($token, new Key(config('jwt.secret'), 'HS256'));
            $user = User::query()->whereKey($payload->sub ?? null)->first();

            if (! $user || ! $user->is_active) {
                return response()->json(['message' => 'Tài khoản không tồn tại hoặc đã bị khóa'], 401);
            }

            $request->attributes->set('auth_user', $user);
        } catch (ExpiredException) {
            return response()->json(['message' => 'Phiên đăng nhập đã hết hạn'], 401);
        } catch (\Throwable) {
            return response()->json(['message' => 'Token không hợp lệ'], 401);
        }

        return $next($request);
    }
}

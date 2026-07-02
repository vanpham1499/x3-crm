<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->attributes->get('auth_user');

        if (! $user || ! in_array($user->role, $roles, true)) {
            return response()->json(['message' => 'Bạn không có quyền thực hiện thao tác này'], 403);
        }

        return $next($request);
    }
}

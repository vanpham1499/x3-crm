<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePermission
{
    public function handle(Request $request, Closure $next, string ...$codes): Response
    {
        $user = $request->user();

        if (! $user || ! collect($codes)->contains(fn (string $code) => $user->hasPermission($code))) {
            return response()->json(['message' => 'Bạn không có quyền thực hiện thao tác này'], 403);
        }

        return $next($request);
    }
}

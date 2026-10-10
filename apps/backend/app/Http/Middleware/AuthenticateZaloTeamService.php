<?php

namespace App\Http\Middleware;

use App\Services\ZaloTeamIdentity;
use App\Services\ZaloTeamRuntime;
use Closure;
use Illuminate\Http\Request;

class AuthenticateZaloTeamService
{
    public function handle(Request $request, Closure $next)
    {
        ZaloTeamRuntime::authenticateService($request);
        $user = app(ZaloTeamIdentity::class)->session($request);
        $request->setUserResolver(fn () => $user);

        return $next($request);
    }
}

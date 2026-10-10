<?php

namespace App\Http\Middleware;

use App\Services\ZaloTeamRuntime;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

class EnsureCrmFrontendRequestsAreStateful extends EnsureFrontendRequestsAreStateful
{
    public function handle($request, $next)
    {
        // HTTP kernel registration precedes config loading. Decide only when the
        // request pipeline runs, after environment and cached config are loaded.
        if (ZaloTeamRuntime::role() === 'zalo') {
            return $next($request);
        }

        return parent::handle($request, $next);
    }
}

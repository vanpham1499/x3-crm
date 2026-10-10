<?php

use App\Console\Commands\DispatchNotificationReminders;
use App\Console\Commands\EnsureAdminUser;
use App\Console\Commands\RestoreZaloTeamArchive;
use App\Console\Commands\SyncZaloTeamArchive;
use App\Http\Middleware\EnsureActiveUser;
use App\Http\Middleware\EnsurePermission;
use App\Http\Middleware\EnsureUserRole;
use App\Http\Middleware\VerifyPaymentWebhookSecret;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\HandleCors;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withProviders([\App\Providers\ZaloTeamRuntimeProvider::class])
    ->withCommands([
        \App\Console\Commands\DeliverZaloCrmDocuments::class,
        \App\Console\Commands\DispatchZaloWorkReminders::class,
        EnsureAdminUser::class,
        DispatchNotificationReminders::class,
        SyncZaloTeamArchive::class,
        RestoreZaloTeamArchive::class,
    ])
    ->withSchedule(function (Schedule $schedule): void {
        if (\App\Services\ZaloTeamRuntime::role() === 'combined') {
            $schedule->command('zalo-team:archive')->everyMinute()->withoutOverlapping(30);
        }
        if (\App\Services\ZaloTeamRuntime::role() === 'zalo') { return; }
        $schedule->command('zalo-team:deliver-documents')->everyMinute()->withoutOverlapping(10);
        $schedule->command('zalo-team:deliver-documents --prune')->dailyAt('02:20')->withoutOverlapping(10);
        $schedule->command('zalo-team:work-reminders')->everyMinute()->withoutOverlapping(10);
        $schedule->command('notifications:dispatch-reminders')
            ->everyMinute()
            ->withoutOverlapping(10);
    })
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->api(prepend: [
            \App\Http\Middleware\EnsureCrmFrontendRequestsAreStateful::class,
        ], append: [
            HandleCors::class,
        ]);

        $middleware->alias([
            'active' => EnsureActiveUser::class,
            'role' => EnsureUserRole::class,
            'permission' => EnsurePermission::class,
            'verify_payment_webhook' => VerifyPaymentWebhookSecret::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Webhook callers may omit Accept: application/json. Preserve error status
        // codes while returning JSON instead of Laravel's HTML error page.
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request, Throwable $exception): bool => $request->is('api/*') || $request->expectsJson(),
        );
        $exceptions->render(function (ValidationException $exception, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json([
                'message' => 'Dữ liệu không hợp lệ',
                'errors' => $exception->errors(),
            ], 422);
        });

        $exceptions->render(function (HttpExceptionInterface $exception, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            $status = $exception->getStatusCode();

            return response()->json([
                'message' => $exception->getMessage() ?: Response::$statusTexts[$status],
            ], $status, $exception->getHeaders());
        });
    })
    ->create();

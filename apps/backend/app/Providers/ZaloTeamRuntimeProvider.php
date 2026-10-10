<?php

namespace App\Providers;

use App\Services\ZaloTeamRuntime;
use Illuminate\Console\Events\CommandStarting;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

class ZaloTeamRuntimeProvider extends ServiceProvider
{
    public function boot(): void
    {
        if (ZaloTeamRuntime::role() !== 'zalo') {
            $this->app->booted(function () {
                Broadcast::routes(['middleware' => ['api', 'auth:sanctum', 'active']]);
                require base_path('routes/channels.php');
            });
        }
        Event::listen(CommandStarting::class, function (CommandStarting $event) {
            $role = ZaloTeamRuntime::role();
            if (config('zalo_team.remote_api_url') && in_array($event->command, ['zalo-team:archive-restore', 'zalo-team:import-pc'], true)) {
                throw new \RuntimeException('Archive writes moved to the dedicated Zalo service. Use the PC bridge.');
            }
            if ($role === 'crm' && str_starts_with($event->command ?? '', 'zalo-team:') && ! in_array($event->command, ['zalo-team:work-reminders', 'zalo-team:deliver-documents'], true)) {
                throw new \RuntimeException('Zalo commands must run on the Zalo service.');
            }
            if ($role === 'zalo' && in_array($event->command, ['db:seed', 'migrate:fresh', 'migrate:refresh', 'migrate:reset', 'db:wipe', 'notifications:dispatch-reminders'], true)) {
                throw new \RuntimeException('CRM/destructive commands are disabled on the Zalo service.');
            }
            if ($role === 'zalo' && $event->command === 'migrate') {
                $paths = $event->input->getOption('path');
                if (! $paths) {
                    throw new \RuntimeException('Use zalo-team:migrate for the isolated schema.');
                }
                $allowed = array_map(fn ($path) => str_replace('\\', '/', $path), ZaloTeamRuntime::migrationPaths());
                foreach ($paths as $path) {
                    if (! in_array(str_replace('\\', '/', $path), $allowed, true)) {
                        throw new \RuntimeException('Migration outside the Zalo schema.');
                    }
                }
            }
        });
    }
}

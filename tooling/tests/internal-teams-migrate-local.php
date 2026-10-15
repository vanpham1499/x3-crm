<?php
require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app = require __DIR__.'/../../apps/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
set_exception_handler(function (Throwable $e): void { fwrite(STDERR, (string) $e); exit(1); });
if (config('database.default') !== 'pgsql' || config('database.connections.pgsql.host') !== '127.0.0.1'
    || (string) config('database.connections.pgsql.port') !== '5433') throw new RuntimeException('Local DB 127.0.0.1:5433 only');
Illuminate\Support\Facades\Artisan::call('migrate', ['--path' => 'database/migrations/2026_10_14_000100_create_internal_teams.php', '--force' => true]);
echo Illuminate\Support\Facades\Artisan::output();
// Keep this development DB aligned if the new, unshipped migration was applied before index tuning.
Illuminate\Support\Facades\DB::statement('CREATE INDEX IF NOT EXISTS teams_leader_user_id_index ON teams (leader_user_id)');
Illuminate\Support\Facades\DB::statement('CREATE INDEX IF NOT EXISTS users_team_id_index ON users (team_id)');

<?php

namespace App\Console\Commands;

use App\Services\ZaloTeamRuntime;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;

class MigrateZaloTeamService extends Command
{
    protected $signature = 'zalo-team:migrate';

    protected $description = 'Migrate only the dedicated Zalo database; never seed CRM data';

    public function handle(): int
    {
        if (ZaloTeamRuntime::role() !== 'zalo' || Schema::hasTable('customers') || Schema::hasTable('roles') || (Schema::hasTable('users') && ! Schema::hasColumn('users', 'zalo_owner'))) {
            $this->error('Requires runtime=zalo and a dedicated Zalo database.');

            return self::FAILURE;
        }
        return $this->call('migrate', ['--path' => ZaloTeamRuntime::migrationPaths(), '--realpath' => true, '--force' => true]);
    }
}

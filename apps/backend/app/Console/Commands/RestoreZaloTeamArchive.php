<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\ZaloTeamArchiveBackup;
use Illuminate\Console\Command;

class RestoreZaloTeamArchive extends Command
{
    protected $signature = 'zalo-team:archive-restore {user : Original CRM user ID} {backup : Snapshot UUID} {--apply : Restore missing archive rows and blobs; default only verifies}';

    protected $description = 'Discover and verify an encrypted snapshot after restoring the CRM identity and archive migrations';

    public function handle(ZaloTeamArchiveBackup $backup): int
    {
        $u = app(\App\Services\ZaloTeamIdentity::class)->worker((int) ((int) $this->argument('user')));
        try {
            $id = $this->argument('backup');
            $backup->discover($u, $id);
            $result = $this->option('apply') ? $backup->restore($u, $id) : $backup->verify($u, $id);
            $this->info(($this->option('apply') ? 'Restored missing data. ' : 'Verified. ').$result['rows'].' records; '.$result['files'].' unique files.');

            return self::SUCCESS;
        } catch (\Throwable) {
            $this->error('Cannot restore: check backup directory, original owner, encryption key and file integrity.');

            return self::FAILURE;
        }
    }
}

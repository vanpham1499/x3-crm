<?php

namespace App\Console\Commands;

use App\Services\ZaloTeamRuntime;
use App\Services\ZaloTeamWorkspace;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;

class DispatchZaloWorkReminders extends Command
{
    protected $signature = 'zalo-team:work-reminders {--watch : Run only internal work reminders every minute}';

    protected $description = 'Nhắc công việc nội bộ CRM; không gửi tin Zalo';

    public function handle(ZaloTeamWorkspace $service): int
    {
        if (ZaloTeamRuntime::role() === 'zalo' || ! Schema::hasTable('zt_crm_tasks')) {
            return self::SUCCESS;
        }
        do {
            try {
                $this->info('Đã tạo '.$service->dispatchWorkReminders().' thông báo đến hạn.');
            } catch (\Throwable $e) {
                report($e);
                $this->error('Chưa xử lý được nhắc hạn; sẽ thử lại ở chu kỳ sau.');
                if (! $this->option('watch')) {
                    return self::FAILURE;
                }
            }
            if ($this->option('watch')) {
                sleep(60);
            }
        } while ($this->option('watch'));

        return self::SUCCESS;
    }
}

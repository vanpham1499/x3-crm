<?php

namespace App\Console\Commands;

use App\Services\ScheduledNotificationService;
use Illuminate\Console\Command;

class DispatchNotificationReminders extends Command
{
    protected $signature = 'notifications:dispatch-reminders';

    protected $description = 'Dispatch idempotent meeting and weekly-report reminders';

    public function handle(ScheduledNotificationService $notifications): int
    {
        $result = $notifications->dispatch();
        $this->info(sprintf(
            'Dispatched %d meeting reminders and %d weekly-report reminders.',
            $result['meetingReminders'],
            $result['weeklyReportReminders'],
        ));

        return self::SUCCESS;
    }
}

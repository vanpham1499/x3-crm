<?php

namespace App\Console\Commands;

use App\Events\UserNotificationsChanged;
use App\Models\Meeting;
use App\Models\P2Point;
use App\Models\Payment;
use App\Models\PaymentRefund;
use App\Models\ProjectCost;
use App\Models\UserNotification;
use App\Models\WeeklyReport;
use Illuminate\Console\Command;

/** One-off, idempotent cleanup of legacy workflow reminders. Never changes business records. */
class ReconcileNotificationInbox extends Command
{
    protected $signature = 'notifications:reconcile-inbox {--apply : Persist verified workflow closures}';

    protected $description = 'Preview or close old notifications whose workflow step has ended';

    public function handle(): int
    {
        $count = 0;
        $users = [];
        $models = ['weekly_report' => WeeklyReport::class, 'meeting' => Meeting::class,
            'payment' => Payment::class, 'payment_refund' => PaymentRefund::class,
            'project_cost' => ProjectCost::class, 'p2_point' => P2Point::class];
        foreach ($models as $type => $model) {
            UserNotification::where('entity_type', $type)->whereNull('resolved_at')->chunkById(250,
                function ($rows) use ($model, &$count, &$users): void {
                    $sources = $model::withTrashed()->whereIn('id', $rows->pluck('entity_id'))->get()->keyBy('id');
                    foreach ($rows as $row) {
                        $source = $sources->get($row->entity_id);
                        // Unknown event types and absent records remain untouched; no guessing.
                        if (! $source || ! self::stepEnded($row->event_key, $source)) {
                            continue;
                        }
                        $count++;
                        if ($this->option('apply')) {
                            UserNotification::whereKey($row->id)->whereNull('resolved_at')
                                ->update(['resolved_at' => now(), 'inbox_reopened_at' => null]);
                            $users[$row->user_id] = true;
                        }
                    }
                });
        }
        foreach (array_keys($users) as $userId) {
            UserNotificationsChanged::dispatch((int) $userId, 'reconciled');
        }
        $this->info(($this->option('apply') ? 'Closed ' : 'Would close ').$count.' obsolete workflow notifications.');

        return self::SUCCESS;
    }

    public static function stepEnded(string $event, object $source): bool
    {
        $deleted = $source->deleted_at !== null;

        return match ($event) {
            'weekly_report_submitted' => $deleted || $source->status !== WeeklyReport::STATUS_SUBMITTED,
            'weekly_report_rejected', 'weekly_report_returned' => $deleted || in_array($source->status, [WeeklyReport::STATUS_SUBMITTED, WeeklyReport::STATUS_APPROVED], true),
            'meeting_reminder_24h', 'meeting_reminder_30m' => $deleted || ! in_array($source->status, Meeting::ACTIVE_STATUSES, true),
            'payment_processing_required' => $deleted || ($source->receipt_type ?? 'customer') !== 'customer' || ($source->reconciled_status !== 'unmatched' && (float) $source->excess_amount <= 0.01),
            'payment_refund_processing_required' => $deleted || $source->status !== PaymentRefund::STATUS_PENDING,
            'p2_approval_required' => $deleted || $source->is_approved,
            'cost_funding_required' => $deleted || $source->status !== ProjectCost::STATUS_PENDING,
            'cost_reconciliation_required', 'cost_reconciliation_unmatched' => $deleted || $source->status === ProjectCost::STATUS_CANCELLED || $source->reconciliation_result === 'matched',
            default => false,
        };
    }
}

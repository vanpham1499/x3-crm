<?php

use App\Console\Commands\ReconcileNotificationInbox;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\NotificationDispatchService;
use App\Services\UserNotificationsService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;

// All fixtures live in SQLite memory. Never writes to CRM/PostgreSQL.
require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app = require __DIR__.'/../../apps/backend/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:']);
DB::purge('sqlite');
Event::fake();

Schema::create('users', function ($table): void {
    $table->id();
    $table->string('name');
    $table->string('code');
    $table->boolean('is_active')->default(true);
    $table->softDeletes();
});
(require __DIR__.'/../../apps/backend/database/migrations/2026_08_01_000400_create_user_notifications_table.php')->up();
(require __DIR__.'/../../apps/backend/database/migrations/2026_10_13_000200_add_notification_inbox_handling.php')->up();
DB::table('users')->insert([['id' => 1, 'name' => 'One', 'code' => 'T1'], ['id' => 2, 'name' => 'Two', 'code' => 'T2']]);
$one = User::findOrFail(1);
$two = User::findOrFail(2);
$service = new UserNotificationsService;
$dispatch = new NotificationDispatchService;
$checks = 0;
function checkInbox(bool $condition, string $label): void
{
    global $checks;
    if (! $condition) {
        throw new RuntimeException($label);
    }
    $checks++;
}
function seedNotice(array $extra = []): UserNotification
{
    static $sequence = 0;

    return UserNotification::create(array_merge([
        'user_id' => 1, 'module' => 'weekly_report', 'event_key' => 'weekly_report_submitted',
        'title' => 'Fixture', 'kind' => 'action', 'entity_type' => 'weekly_report', 'entity_id' => 10,
        'dedupe_key' => 'fixture:'.++$sequence,
    ], $extra));
}
$notice = seedNotice();
$other = seedNotice(['user_id' => 2]);
checkInbox($service->summary($one)['totalCount'] === 1, 'Only owned pending notification counted');
$service->markRead($one, $notice->id);
checkInbox($service->summary($one)['totalCount'] === 1 && $service->summary($one)['unreadCount'] === 0, 'Reading does not handle');
$service->handle($one, $notice->id);
checkInbox($notice->fresh()->resolved_at === null, 'Manual done never resolves business workflow');
checkInbox($service->summary($one)['doneCount'] === 1 && $service->summary($one)['totalCount'] === 0, 'Manual done moves list and badge');
checkInbox(! $other->fresh()->inboxIsDone(), 'Manual handling does not affect other recipient');
$service->handle($one, $notice->id);
checkInbox($service->summary($one)['doneCount'] === 1, 'Repeated handle is idempotent');
$service->restore($one, $notice->id);
checkInbox(! $notice->fresh()->inboxIsDone(), 'Undo returns pending');
$dispatch->resolve('weekly_report', 10, ['weekly_report_submitted']);
checkInbox($notice->fresh()->inboxIsDone() && $other->fresh()->inboxIsDone(), 'Workflow completion closes all recipients');
$service->restore($one, $notice->id);
checkInbox(! $notice->fresh()->inboxIsDone() && $notice->fresh()->resolved_at !== null, 'Personal reopen preserves business resolution');
checkInbox($other->fresh()->inboxIsDone(), 'Reopen does not affect other recipient');
$resolvedCount = $dispatch->resolve('weekly_report', 10, ['weekly_report_submitted']);
checkInbox($resolvedCount === 0 && ! $notice->fresh()->inboxIsDone(), 'Repeated old resolution does not override personal reopen');
foreach (['handle', 'restore', 'markRead', 'archive'] as $operation) {
    try {
        $service->$operation($two, $notice->id);
        checkInbox(false, 'Unauthorized '.$operation);
    } catch (ModelNotFoundException) {
        checkInbox(true, 'Denied '.$operation);
    }
}
$legacy = seedNotice(['archived_at' => now()]);
checkInbox($legacy->inboxIsDone(), 'Legacy archive is done');
$archivedResource = $service->findPaginated($one, 'done', 20, 1)['data']->firstWhere('id', $legacy->id);
checkInbox($archivedResource['doneSource'] === 'legacy_archive', 'Legacy provenance retained');
$service->restore($one, $legacy->id);
checkInbox(! $legacy->fresh()->inboxIsDone(), 'Legacy archive can be restored');
$payment = seedNotice(['module' => 'payment', 'entity_type' => 'payment', 'entity_id' => 1, 'event_key' => 'payment_processing_required', 'dedupe_key' => 'payment:1']);
$page = $service->findPaginated($one, 'all', 20, 1, 'payment', true);
checkInbox($page['meta']['total'] === 1 && $page['data']->first()['id'] === $payment->id, 'Module/unread filter combined server-side');
$service->markAllRead($one);
checkInbox($service->summary($one)['unreadCount'] === 0 && $service->summary($one)['totalCount'] === 3, 'Read all preserves pending work');
$dispatch->resolve('payment', 1, ['payment_processing_required']);
$service->handle($one, $payment->id);
$dispatch->send([1], ['module' => 'payment', 'event_key' => 'payment_processing_required', 'entity_type' => 'payment', 'entity_id' => 1,
    'title' => 'Requires action again', 'dedupe_key' => 'payment:1', 'reopen_resolved' => true]);
checkInbox(! $payment->fresh()->inboxIsDone() && $payment->fresh()->read_at === null, 'New workflow cycle reopens unread');
checkInbox($payment->fresh()->handled_at === null && $payment->fresh()->inbox_reopened_at === null, 'New workflow clears personal closure overrides');
$before = UserNotification::count();
$dispatch->send([1], ['module' => 'payment', 'event_key' => 'payment_processing_required', 'entity_type' => 'payment', 'entity_id' => 1,
    'title' => 'Duplicate', 'dedupe_key' => 'payment:1', 'reopen_resolved' => true]);
checkInbox(UserNotification::count() === $before, 'Repeated event deduped');
$weekOne = seedNotice(['entity_type' => 'project_weekly_setting', 'event_key' => 'weekly_report_due', 'data' => ['dueDate' => '2026-10-05']]);
$weekTwo = seedNotice(['entity_type' => 'project_weekly_setting', 'event_key' => 'weekly_report_due', 'data' => ['dueDate' => '2026-10-12']]);
$dispatch->resolve('project_weekly_setting', 10, ['weekly_report_due'], ['dueDate' => '2026-10-12']);
checkInbox(! $weekOne->fresh()->inboxIsDone() && $weekTwo->fresh()->inboxIsDone(), 'Weekly closure only affects matching cycle');
$summary = $service->summary($one);
checkInbox(array_sum(array_column($summary['modules']->all(), 'pendingCount')) === $summary['totalCount'], 'Module pending counts match total');
checkInbox(array_sum(array_column($summary['modules']->all(), 'doneCount')) === $summary['doneCount'], 'Module done counts match total');
checkInbox($service->findPaginated($one, 'all', 1, 1)['meta']['lastPage'] > 1, 'Pagination works');
// All status combinations partition the inbox exactly once, matching PHP serialization.
for ($mask = 0; $mask < 16; $mask++) {
    $row = seedNotice(['handled_at' => $mask & 1 ? now() : null, 'archived_at' => $mask & 2 ? now() : null,
        'resolved_at' => $mask & 4 ? now() : null, 'inbox_reopened_at' => $mask & 8 ? now() : null]);
    $pending = UserNotification::whereKey($row->id)->pendingInbox()->exists();
    $done = UserNotification::whereKey($row->id)->doneInbox()->exists();
    checkInbox($pending !== $done && $done === $row->inboxIsDone(), 'State partition '.$mask);
}
foreach ([
    ['weekly_report_submitted', ['status' => 'approved'], true],
    ['weekly_report_submitted', ['status' => 'submitted'], false],
    ['weekly_report_returned', ['status' => 'draft'], false],
    ['meeting_reminder_24h', ['status' => 'completed'], true],
    ['meeting_reminder_30m', ['status' => 'scheduled'], false],
    ['payment_processing_required', ['receipt_type' => 'customer', 'reconciled_status' => 'matched', 'excess_amount' => 0], true],
    ['payment_processing_required', ['receipt_type' => 'customer', 'reconciled_status' => 'matched', 'excess_amount' => 100], false],
    ['cost_reconciliation_required', ['status' => 'completed', 'reconciliation_result' => 'unmatched'], false],
    ['cost_reconciliation_required', ['status' => 'completed', 'reconciliation_result' => 'matched'], true],
    ['unknown', [], false],
] as [$event, $source, $expected]) {
    checkInbox(ReconcileNotificationInbox::stepEnded($event, (object) array_merge(['deleted_at' => null], $source)) === $expected, 'Legacy workflow '.$event);
}
echo "$checks notification inbox checks passed (SQLite memory)\n";

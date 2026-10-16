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
$legacyMessage = seedNotice(['module' => 'weekly_report', 'event_key' => 'weekly_report_message',
    'entity_type' => 'weekly_report', 'entity_id' => 77, 'dedupe_key' => 'weekly_report_message:123']);
$newMessage = seedNotice(['module' => 'internal_discussion', 'event_key' => 'weekly_report_message',
    'entity_type' => 'weekly_report', 'entity_id' => 77]);
$discussion = $service->findPaginated($one, 'all', 20, 1, 'internal_discussion');
checkInbox($discussion['meta']['total'] === 2, 'Old and new discussion notifications share the new category');
$oldResource = $discussion['data']->firstWhere('id', $legacyMessage->id);
checkInbox($oldResource['module'] === 'internal_discussion' && $oldResource['actionUrl'] === '/weekly-reports/77#message-123', 'Legacy discussion opens exact message');
checkInbox(! $service->findPaginated($one, 'all', 50, 1, 'weekly_report')['data']->contains('id', $legacyMessage->id), 'Discussion excluded from workflow category');
$module = $service->summary($one)['modules']->firstWhere('module', 'internal_discussion');
checkInbox($module['pendingCount'] === 2 && $module['doneCount'] === 0, 'Discussion badge agrees with list');
$service->markRead($one, $legacyMessage->id);
checkInbox(! $legacyMessage->fresh()->inboxIsDone(), 'Reading discussion does not complete it');
$service->handle($one, $legacyMessage->id);
checkInbox($service->findPaginated($one, 'done', 20, 1, 'internal_discussion')['meta']['total'] === 1, 'Discussion done filter preserved');
checkInbox(! ReconcileNotificationInbox::stepEnded('weekly_report_message', (object) ['deleted_at' => null, 'status' => 'approved']), 'Report approval does not close discussion');

// Batch operation uses a server-frozen, authenticated selection rather than the visible page.
$bulkRows = collect();
for ($i = 0; $i < 27; $i++) $bulkRows->push(seedNotice(['module' => 'bulk_test']));
$readBulk = seedNotice(['module' => 'bulk_test', 'read_at' => now()->subDay()]);
$doneBulk = seedNotice(['module' => 'bulk_test', 'handled_at' => now()->subDay()]);
$foreignBulk = seedNotice(['module' => 'bulk_test', 'user_id' => 2]);
$beforeSummary = $service->summary($one);
$preview = $service->previewHandleAll($one, 'bulk_test', true);
checkInbox($preview['count'] === 27, 'Preview includes all pages and respects unread/module/owner/pending filters');
checkInbox($bulkRows->every(fn ($row) => ! $row->fresh()->inboxIsDone()), 'Preview has no side effects');
$arrivedLater = seedNotice(['module' => 'bulk_test']);
foreach ([$preview['token'].'tampered', 'invalid'] as $invalidToken) {
    try { $service->handleAll($one, $invalidToken); checkInbox(false, 'Tampered snapshot rejected'); }
    catch (Illuminate\Validation\ValidationException) { checkInbox(true, 'Tampered snapshot rejected'); }
}
try { $service->handleAll($two, $preview['token']); checkInbox(false, 'Other user cannot consume selection'); }
catch (Illuminate\Validation\ValidationException) { checkInbox(true, 'Other user cannot consume selection'); }
// Another window processes one entry while the confirmation is open.
$service->handle($one, $bulkRows->first()->id);
checkInbox($service->handleAll($one, $preview['token']) === 26, 'Only still-pending captured notifications are updated');
checkInbox($bulkRows->every(fn ($row) => $row->fresh()->inboxIsDone() && $row->fresh()->read_at !== null), 'Batch marks selected notifications handled and read');
checkInbox($bulkRows->every(fn ($row) => $row->fresh()->resolved_at === null), 'Batch never approves or resolves underlying workflows');
checkInbox(! $readBulk->fresh()->inboxIsDone() && ! $foreignBulk->fresh()->inboxIsDone() && ! $arrivedLater->fresh()->inboxIsDone(), 'Read, foreign and newly arrived entries remain pending');
checkInbox($doneBulk->fresh()->handled_at->equalTo($doneBulk->handled_at), 'Already-handled timestamp unchanged');
checkInbox($service->handleAll($one, $preview['token']) === 0, 'Immediate repeated submit is idempotent');
$afterSummary = $service->summary($one);
checkInbox($afterSummary['totalCount'] === $beforeSummary['totalCount'] - 27 + 1, 'Badge uses real remaining pending count');
$service->restore($one, $bulkRows->last()->id);
checkInbox(! $bulkRows->last()->fresh()->inboxIsDone(), 'An individually batch-handled notice can be restored');
$readAt = $readBulk->read_at;
$allBulk = $service->previewHandleAll($one, 'bulk_test');
checkInbox($allBulk['count'] === 3 && $service->handleAll($one, $allBulk['token']) === 3, 'Without unread filter, existing read notices are included');
checkInbox($readBulk->fresh()->read_at->equalTo($readAt), 'Existing read timestamp is preserved');
$emptyBulk = $service->previewHandleAll($one, 'no_such_module');
checkInbox($emptyBulk['count'] === 0 && $service->handleAll($one, $emptyBulk['token']) === 0, 'Empty selection is a safe no-op');
$oldDiscussion = seedNotice(['module' => 'weekly_report', 'event_key' => 'weekly_report_message']);
$discussionPreview = $service->previewHandleAll($one, 'internal_discussion');
$service->handleAll($one, $discussionPreview['token']);
checkInbox($oldDiscussion->fresh()->inboxIsDone(), 'Batch uses normalized category for legacy internal messages');
$expiredPreview = $service->previewHandleAll($one);
Illuminate\Support\Carbon::setTestNow(now()->addMinutes(6));
try { $service->handleAll($one, $expiredPreview['token']); checkInbox(false, 'Expired confirmation rejected'); }
catch (Illuminate\Validation\ValidationException) { checkInbox(true, 'Expired confirmation rejected'); }
finally { Illuminate\Support\Carbon::setTestNow(); }

echo "$checks notification inbox checks passed (SQLite memory)\n";

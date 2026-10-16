<?php

// Local-only integration: no messages escape this rolled-back transaction.
require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app = require __DIR__.'/../../apps/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
set_exception_handler(function (Throwable $error): void { fwrite(STDERR, $error->getMessage().PHP_EOL); exit(1); });
if (config('database.default') !== 'pgsql' || config('database.connections.pgsql.host') !== '127.0.0.1'
    || (string) config('database.connections.pgsql.port') !== '5433') throw new RuntimeException('Local DB only');

use App\Models\{User, Role, Permission, Project, WeeklyReport, UserNotification};
use App\Services\WeeklyReportsService;
use App\Events\UserNotificationsChanged;
use Illuminate\Support\Facades\{Auth, DB, Event};
use Illuminate\Support\Str;

$checks = 0;
function assertDiscussion(bool $ok, string $label): void {
    global $checks;
    if (!$ok) throw new RuntimeException($label);
    $checks++;
}
function discussionViewer(User $user): void {
    Auth::setUser($user);
    request()->setUserResolver(fn () => $user);
}
function discussionUser(User $source, array $permissions): User {
    $role = Role::create(['name' => 'Rollback discussion '.Str::random(10)]);
    $role->permissions()->sync(Permission::whereIn('code', $permissions)->pluck('id'));
    $user = $source->replicate();
    $user->code = 'CHAT-'.Str::random(10);
    $user->email = Str::random(15).'@example.invalid';
    $user->role = 'EMPLOYEE';
    $user->role_id = $role->id;
    $user->is_active = true;
    $user->saveQuietly();
    return $user->fresh();
}

Event::fake([UserNotificationsChanged::class]);
DB::beginTransaction();
try {
    $admin = User::where('role', 'ADMIN')->firstOrFail();
    $author = discussionUser($admin, ['weeklyreport.view_all']);
    $approver = discussionUser($admin, ['weeklyreport.view_all', 'weeklyreport.approve_all']);
    $participant = discussionUser($admin, ['weeklyreport.view_all']);
    $outsider = discussionUser($admin, []);
    discussionViewer($author);
    $project = Project::firstOrFail()->replicate();
    $project->project_code = 'CHAT-'.Str::random(10);
    $project->project_name = 'Rollback discussion fixture';
    $project->quotation_id = null;
    $project->manager_user_id = $author->id;
    $project->sales_user_id = $outsider->id; // Candidate without view permission must be filtered.
    $project->saveQuietly();
    $report = WeeklyReport::create(['project_id' => $project->id, 'customer_id' => $project->customer_id,
        'reporter_user_id' => $author->id, 'week_start_date' => '2088-10-04', 'week_end_date' => '2088-10-10',
        'report_date' => '2088-10-11', 'status' => 'draft', 'project_status' => 'ACTIVE', 'currency' => 'VND', 'weekly_condition' => 'stable']);
    $service = app(WeeklyReportsService::class);
    $service->addMessage((string)$report->id, ['content' => 'Discussion fixture first message']);
    $root = $report->items()->firstOrFail();
    $notices = UserNotification::where('dedupe_key', 'weekly_report_message:'.$root->id)->get();
    assertDiscussion($notices->contains('user_id', $approver->id), 'Authorized approver receives new discussion');
    assertDiscussion(!$notices->contains('user_id', $author->id), 'Sender does not notify self');
    assertDiscussion(!$notices->contains('user_id', $outsider->id), 'Project assignment does not bypass view permission');
    $notice = $notices->firstWhere('user_id', $approver->id);
    assertDiscussion($notice->module === 'internal_discussion', 'New category persisted');
    assertDiscussion($notice->action_url === '/weekly-reports/'.$report->id.'#message-'.$root->id, 'Exact message deep link');
    assertDiscussion(str_contains($notice->message, 'Discussion fixture first message'), 'Preview contains message excerpt');
    assertDiscussion($notice->data['sourceModule'] === 'weekly_report', 'Page source retained');
    discussionViewer($participant);
    $service->addMessage((string)$report->id, ['content' => 'Participant reply', 'replyToMessageId' => $root->id]);
    discussionViewer($author);
    $service->addMessage((string)$report->id, ['content' => 'Author reply', 'replyToMessageId' => $root->id]);
    $last = $report->items()->reorder()->latest('id')->firstOrFail();
    $replyNotices = UserNotification::where('dedupe_key', 'weekly_report_message:'.$last->id)->get();
    assertDiscussion($replyNotices->contains('user_id', $participant->id), 'Thread participant receives subsequent replies');
    assertDiscussion($replyNotices->contains('user_id', $approver->id), 'Approver remains informed of reply');
    assertDiscussion(!$replyNotices->contains('user_id', $author->id), 'Reply sender excluded');
    assertDiscussion(Event::dispatched(UserNotificationsChanged::class)->isEmpty(), 'No realtime event escapes before transaction commit');
    echo "PASS $checks discussion checks; broadcast faked, all fixtures rolled back.\n";
} finally {
    DB::rollBack();
}

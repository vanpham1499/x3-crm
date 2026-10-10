<?php
// In-memory fixtures inherited from the collaboration suite. No live data/network.
require __DIR__.'/zalo-team-collaboration.php';

use Illuminate\Support\Facades\DB;

DB::table('zt_crm_tasks')->where('assignee_id', 4)->update(['project_id' => 100]);
DB::table('zt_access_grants')->insert(['account_id'=>101,'user_id'=>4,'department_at_grant'=>10,'level'=>'operate','can_sync'=>false,'can_link'=>false]);
for ($i = 0; $i < 20; $i++) {
    $service->presence(actor(3), ['accountId'=>101,'conversationId'=>'g11','sessionId'=>'performance-session-'.$i,'presenceState'=>'viewing']);
}
function measureWork(callable $run): array {
    DB::enableQueryLog(); DB::flushQueryLog();
    $start = hrtime(true); $result = $run();
    $ms = (hrtime(true) - $start) / 1e6; $queries = count(DB::getQueryLog()); DB::disableQueryLog();
    return ['queries'=>$queries,'ms'=>round($ms,2),'items'=>count($result['items'])];
}
$board = measureWork(fn()=> $service->board(actor(1), ['scope'=>'team','taskFilter'=>'all']));
$presence = measureWork(fn()=> $service->presence(actor(4), ['accountId'=>101,'conversationId'=>'g11','sessionId'=>'performance-viewer-1','presenceState'=>'viewing']));
echo 'WORK_PERFORMANCE '.json_encode(compact('board','presence'))."\n";
if (in_array('--check', $argv, true)) {
    check($board['queries'] <= 18 && $board['items'] === 30, 'board project reads stay bounded for 30 rows');
    check($presence['queries'] <= 25 && $presence['items'] === 1, 'presence query count does not scale with twenty tabs');
}

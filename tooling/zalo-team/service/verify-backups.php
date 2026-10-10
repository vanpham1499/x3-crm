<?php
require '/app/vendor/autoload.php';
$app=require '/app/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
foreach(Illuminate\Support\Facades\DB::table('zt_archive_settings')->get() as $s) {
    $u=app(App\Services\ZaloTeamIdentity::class)->worker((int)$s->user_id);
    foreach(Illuminate\Support\Facades\DB::table('zt_archive_backups')->where('owner',$s->owner)->where('state','ready')->orderBy('created_at')->get() as $b){
        $v=app(App\Services\ZaloTeamArchiveBackup::class)->verify($u,$b->id);
        echo json_encode(['id'=>$b->id,'rows'=>$v['rows'],'files'=>$v['files']])."\n";
    }
}

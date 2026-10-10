<?php
namespace App\Http\Controllers;
use App\Services\{ZaloTeamCampaigns, ZaloTeamCampaignWorker, ZaloTeamCatalog, ZaloTeamAccess};
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

class ZaloTeamCampaignController extends Controller
{
    public function preview(Request $request, ZaloTeamCampaigns $service, string $id, string $asset)
    {
        return $service->previewAsset($request->user(),$id,$asset);
    }
    public function command(Request $request, ZaloTeamCampaigns $service)
    {
        abort_if(config('zalo_team.remote_api_url'),409,'Chiến dịch chạy ở dịch vụ Zalo riêng.');
        abort_if(config('zalo_team.maintenance'),503,'Dịch vụ đang bảo trì.');
        $v=$request->validate([
            'kind'=>'required|in:bootstrap,list,detail,audience,create,update,edit,delete,requeue,start,pause,resume,cancel,retry,suppress,asset,template',
            'accountId'=>'required_if:kind,audience,create,update,asset|integer|min:1',
            'id'=>'required_if:kind,detail,update,edit,delete,requeue,start,pause,resume,cancel,retry,suppress|uuid',
            'revision'=>'required_if:kind,update|string|size:64',
            'deliveryId'=>'required_if:kind,retry|uuid','recipientId'=>'required_if:kind,suppress|uuid',
            'requestId'=>'required_if:kind,create,update,template|uuid','name'=>'required_if:kind,create,update,template|string|max:120',
            'type'=>'required_if:kind,audience,create,update|in:person,group','match'=>'nullable|in:any,all',
            'includeTags'=>'array|max:100','includeTags.*'=>'uuid|distinct','excludeTags'=>'array|max:100','excludeTags.*'=>'uuid|distinct',
            'peers'=>'required_if:kind,create,update|array|min:1|max:2000','peers.*'=>['required','string','distinct','regex:/^g?\d{1,30}$/'],
            'text'=>'nullable|string|max:2000','assetIds'=>'array|max:3','assetIds.*'=>'uuid|distinct',
            'interval'=>'required_if:kind,create,update|integer|min:10|max:3600','startHour'=>'required_if:kind,create,update|integer|min:0|max:23',
            'endHour'=>'required_if:kind,create,update|integer|min:1|max:24|gt:startHour',
            'scheduledAt'=>'nullable|date','page'=>'integer|min:0|max:100000',
            'suppressed'=>'boolean',
            'limit'=>'integer|min:1|max:100','search'=>'nullable|string|max:120',
            'state'=>'in:all,draft,running,paused,completed,cancelled',
            'file'=>'required_if:kind,asset|file|max:25600',
        ]);
        $u=$request->user();
        $result=match($v['kind']) {
            'list'=>isset($v['limit']) ? $service->listing($u,$v['page'] ?? 0,$v['limit'],$v['search'] ?? '',$v['state'] ?? 'all') : ['items'=>$service->listing($u)],
            'detail'=>$service->detail($u,$v['id'],$v['page'] ?? 0),
            'audience'=>$service->audience($u,$v),
            'create'=>$service->create($u,$v),
            'update'=>$service->create($u,$v,$v['id']),
            'edit'=>$service->editData($u,$v['id']),
            'delete'=>$service->remove($u,$v['id']),
            'requeue'=>$service->requeue($u,$v['id']),
            'start','pause','resume','cancel'=>$service->transition($u,$v['id'],$v['kind'],$v['scheduledAt'] ?? null),
            'retry'=>app(ZaloTeamCampaignWorker::class)->retry($u,$v['id'],$v['deliveryId']),
            'suppress'=>$service->suppress($u,$v['id'],$v['recipientId'],$v['suppressed'] ?? true),
            'asset'=>$this->asset($request,$service,(int)$v['accountId']),
            'template'=>$this->template($u,$v,$service),
            'bootstrap'=>$this->bootstrap($u,$service),
        };
        return response()->json($result)->header('Cache-Control','private, no-store');
    }
    private function bootstrap($u,$service): array
    {
        $scope=ZaloTeamAccess::scope($u);
        $allowed=($scope['admin'] ?? false) || $u->hasPermission('zalo_team.campaigns.send');
        $status=app(ZaloTeamCatalog::class)->command($u,['action'=>'status']);
        $ids=ZaloTeamAccess::ids($u,'write');
        return ['canSend'=>$allowed,'workerReady'=>$service->workerReady(),'accounts'=>array_values(array_filter($status['accounts'] ?? [],fn ($a)=>$ids===null || in_array((int)$a['id'],$ids,true))),
            'tags'=>$service->table('tags')->where('archived',false)->orderBy('position')->get(['id','name'])->all(),
            'templates'=>$service->table('campaign_templates')->where('actor_id',$u->id)->orderByDesc('updated_at')->limit(50)->get()->all()];
    }
    private function template($u,array $v,$service): array
    {
        abort_unless((ZaloTeamAccess::scope($u)['admin'] ?? false) || $u->hasPermission('zalo_team.campaigns.send'),403);
        abort_unless(trim($v['text'] ?? '')!=='',422,'Mẫu tin cần nội dung.');
        $old=$service->table('campaign_templates')->where('id',$v['requestId'])->first();
        abort_if($old && $old->actor_id!=$u->id,403);
        DB::table('zt_campaign_templates')->updateOrInsert(['id'=>$v['requestId'],'workspace'=>config('zalo_team.workspace'),'actor_id'=>$u->id],['name'=>$v['name'],'text'=>$v['text'],'updated_at'=>now()]);
        return ['ok'=>true];
    }
    private function asset(Request $r,$service,int $account): array
    {
        $u=$r->user(); $service->authorize($u,$account);
        $f=$r->file('file'); $name=$f->getClientOriginalName();
        abort_if(preg_match('/[\\\\\/\x00-\x1f]/',$name) || strlen($name)>255,422,'Tên tệp không hợp lệ.');
        $mime=$f->getMimeType() ?: 'application/octet-stream';
        $kind=in_array($mime,['image/png','image/jpeg','image/gif','image/webp'])?'image':'file';
        $id=(string)Str::uuid(); $root=config('zalo_team.campaign_path');
        if (!is_dir($root)) mkdir($root,0700,true);
        $bytes=$f->getSize(); abort_unless($bytes>0,422,'Tệp đang rỗng. Hãy chọn tệp có nội dung.');
        $hash=hash_file('sha256',$f->getRealPath());
        $existing=$service->table('campaign_assets')->where('actor_id',$u->id)->where('sha256',$hash)->where('name',$name)->first();
        if ($existing && is_file($root.DIRECTORY_SEPARATOR.$existing->id)) return ['id'=>$existing->id,'name'=>$existing->name,'kind'=>$existing->kind,'bytes'=>$existing->bytes];
        $f->move($root,$id); chmod($root.DIRECTORY_SEPARATOR.$id,0600);
        try { DB::table('zt_campaign_assets')->insert(['id'=>$id,'workspace'=>config('zalo_team.workspace'),'actor_id'=>$u->id,
            'name'=>$name,'mime'=>$mime,'kind'=>$kind,'bytes'=>$bytes,'sha256'=>$hash,'created_at'=>now()]); }
        catch (\Throwable $e) { unlink($root.DIRECTORY_SEPARATOR.$id); throw $e; }
        return ['id'=>$id,'name'=>$name,'kind'=>$kind,'bytes'=>$bytes];
    }
}

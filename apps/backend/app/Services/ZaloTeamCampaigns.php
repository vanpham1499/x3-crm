<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Carbon;

class ZaloTeamCampaigns
{
    public function table(string $name = 'campaigns')
    {
        $q=DB::table('zt_'.$name)->where('workspace', config('zalo_team.workspace'));
        if ($name==='campaigns') $q->where('identity_origin',config('zalo_team.public_origin'));
        return $q;
    }

    public function workerKey(): string { return hash('sha256',config('zalo_team.workspace').':'.config('zalo_team.public_origin')); }
    public function workerReady(): bool { return DB::table('zt_campaign_workers')->where('key',$this->workerKey())->where('seen_at','>',now()->subMinutes(5))->exists(); }

    public function authorize(User $u, int $account): void
    {
        abort_unless((ZaloTeamAccess::scope($u)['admin'] ?? false) || $u->hasPermission('zalo_team.campaigns.send'), 403, 'Bạn chưa có quyền gửi chiến dịch Zalo.');
        ZaloTeamAccess::allow($u, $account, 'write');
    }

    public function visible(User $u)
    {
        return ZaloTeamAccess::sources($this->table(), $u);
    }

    public function get(User $u, string $id)
    {
        $c = $this->visible($u)->where('id', $id)->first();
        abort_unless($c && $c->state !== 'deleted', 404, 'Không tìm thấy chiến dịch.');
        $scope = ZaloTeamAccess::scope($u);
        abort_unless($c->actor_id == $u->id || ($scope['admin'] ?? false) || ($scope['accounts'][$c->account_id]['manage'] ?? false), 403);
        return $c;
    }

    public function listing(User $u, ?int $page = null, int $limit = 25, string $search = '', string $state = 'all'): array
    {
        $scope = ZaloTeamAccess::scope($u);
        $query = $this->visible($u)->where('state','!=','deleted');
        if (!($scope['admin'] ?? false)) {
            $managed = array_keys(array_filter((array)($scope['accounts'] ?? []), fn ($a) => $a['manage'] ?? false));
            $query->where(fn ($q) => $q->where('actor_id', $u->id)->orWhereIn('account_id', $managed));
        }
        if ($state !== 'all') $query->where('state', $state);
        if (trim($search) !== '') $query->whereRaw("LOWER(name) LIKE ? ESCAPE '!'", ['%'.mb_strtolower(str_replace(['!', '%', '_'], ['!!', '!%', '!_'], trim($search))).'%']);
        $limit = max(1, min(100, $limit));
        $total = $page !== null ? (clone $query)->count() : null;
        $page = $page !== null ? min(max(0, $page), max(0, (int) ceil($total / $limit) - 1)) : null;
        $campaigns=$query->orderByDesc('created_at')->orderByDesc('id')->offset(($page ?? 0) * $limit)->limit($page === null ? 100 : $limit)->get();
        $ids=$campaigns->pluck('id');
        $counts=DB::table('zt_campaign_deliveries')->whereIn('campaign_id',$ids)
            ->selectRaw('campaign_id, state, count(*) as total')->groupBy('campaign_id','state')->get()->groupBy('campaign_id');
        $recipients=DB::table('zt_campaign_recipients')->whereIn('campaign_id',$ids)
            ->selectRaw('campaign_id, count(*) as total')->groupBy('campaign_id')->pluck('total','campaign_id');
        $items = $campaigns->map(fn ($c) => $this->summary($c,($counts[$c->id] ?? collect())->pluck('total','state'),(int)($recipients[$c->id] ?? 0)))->all();
        return $page === null ? $items : ['items'=>$items, 'pagination'=>['page'=>$page, 'limit'=>$limit, 'total'=>$total]];
    }

    public function summary($c, $counts=null, ?int $recipients=null): array
    {
        $counts ??= DB::table('zt_campaign_deliveries')->where('campaign_id', $c->id)->selectRaw('state, count(*) as total')->groupBy('state')->pluck('total', 'state');
        return ['id'=>$c->id, 'name'=>$c->name, 'accountId'=>$c->account_id, 'accountName'=>$c->account_name,
            'state'=>$c->state, 'issue'=>$c->issue, 'scheduledAt'=>$c->scheduled_at, 'createdAt'=>$c->created_at,
            'recipients'=>$recipients ?? DB::table('zt_campaign_recipients')->where('campaign_id',$c->id)->count(),
            'counts'=>$counts, 'parts'=>json_decode($c->parts,true), 'interval'=>$c->interval_seconds,
            'startHour'=>$c->start_hour, 'endHour'=>$c->end_hour];
    }

    public function detail(User $u, string $id, int $page): array
    {
        $c = $this->get($u, $id);
        $rows = DB::table('zt_campaign_recipients')->where('campaign_id',$id)->orderBy('name')->orderBy('id')->offset($page*50)->limit(50)->get();
        $deliveries = DB::table('zt_campaign_deliveries')->whereIn('recipient_id',$rows->pluck('id'))->orderBy('position')->get()->groupBy('recipient_id');
        $suppressed=$this->table('campaign_suppressions')->whereIn('source_key',$rows->pluck('source_key'))->pluck('source_key')->flip();
        return $this->summary($c) + ['canEdit'=>$c->actor_id==$u->id && $c->state==='draft','canCopy'=>$c->actor_id==$u->id,'rows'=>$rows->map(fn ($r) => ['id'=>$r->id,'name'=>$r->name,'peer'=>$r->peer,
            'suppressed'=>isset($suppressed[$r->source_key]),'parts'=>json_decode($r->parts,true),'deliveries'=>($deliveries[$r->id] ?? collect())->map(fn ($d)=>[
                'id'=>$d->id,'position'=>$d->position,'state'=>$d->state,'issue'=>$d->issue,'receipt'=>json_decode($d->receipt ?? 'null',true),
            ])->all()])->all(), 'page'=>$page];
    }

    /** Reads the entire selected native directory, never the rendered inbox subset. */
    public function audience(User $u, array $v): array
    {
        $aid = (int)$v['accountId']; $this->authorize($u,$aid);
        $catalog = app(ZaloTeamCatalog::class);
        $status = $catalog->command($u,['action'=>'status']);
        $account = collect($status['accounts'] ?? [])->firstWhere('id',$aid);
        abort_unless($account && ($account['status'] ?? '') === 'connected' && !empty($account['externalId']),409,'Tài khoản chưa kết nối.');
        $data = $catalog->command($u,['action'=>'directory','accountId'=>$aid,'directory'=>['kind'=>$v['type'] === 'group' ? 'groups' : 'friends']]);
        abort_unless(isset($data['items']) && is_array($data['items']) && empty($data['error']),409,'Chưa đọc đủ danh bạ. Hãy thử lại.');
        $rows = [];
        foreach ($data['items'] as $p) {
            $peer = (string)($p['conversationId'] ?? $p['id'] ?? '');
            if (!preg_match($v['type'] === 'group' ? '/^g\d{1,30}$/' : '/^\d{1,30}$/',$peer)) continue;
            $rows[$peer] = ['peer'=>$peer,'name'=>(string)($p['name'] ?? $p['displayName'] ?? $peer),'sourceKey'=>$account['externalId'].':'.$peer];
        }
        abort_if(count($rows)>20000,422,'Danh bạ quá lớn cho lượt này. Cần phân trang nguồn trước khi gửi.');
        $assignments = $this->table('tag_assignments')->where('active',true)->whereIn('source',array_column($rows,'sourceKey'))->get()->groupBy('source');
        $suppressed = $this->table('campaign_suppressions')->pluck('source_key')->flip();
        $include = $v['includeTags'] ?? []; $exclude = $v['excludeTags'] ?? [];
        $eligible=[]; $excluded=0;
        foreach ($rows as $row) {
            $tags = ($assignments[$row['sourceKey']] ?? collect())->pluck('tag_id')->all();
            $match = !$include || (($v['match'] ?? 'any') === 'all' ? !array_diff($include,$tags) : (bool)array_intersect($include,$tags));
            if (!$match) continue;
            if (isset($suppressed[$row['sourceKey']]) || array_intersect($exclude,$tags)) {$excluded++;continue;}
            $eligible[] = $row;
        }
        abort_if(count($eligible)>2000,422,'Tệp khách có hơn 2.000 liên hệ. Chọn thêm thẻ để thu hẹp trước khi tạo chiến dịch.');
        return ['account'=>$account,'rows'=>$eligible,'excluded'=>$excluded,'tags'=>$this->table('tags')->where('archived',false)->orderBy('position')->get(['id','name'])->all()];
    }

    public function create(User $u, array $v, ?string $updateId=null): array
    {
        $this->authorize($u,(int)$v['accountId']);
        $fingerprint = hash('sha256',json_encode([$u->id,$v]));
        if (!$updateId && $previous=$this->table()->where('id',$v['requestId'])->first()) {
            abort_unless($previous->fingerprint === $fingerprint,409,'Mã yêu cầu đã được sử dụng cho nội dung khác.');
            return $this->detail($u,$previous->id,0);
        }
        $audience = $this->audience($u,$v);
        $selected = collect($audience['rows'])->whereIn('peer',$v['peers'])->keyBy('peer');
        abort_unless($selected->count() === count($v['peers']),409,'Danh sách đã thay đổi hoặc có người nhận không còn hợp lệ. Hãy tải lại tệp khách.');
        $parts=[];
        if (trim($v['text'] ?? '') !== '') $parts[]=['kind'=>'text','text'=>trim($v['text'])];
        foreach ($v['assetIds'] ?? [] as $id) {
            $a=$this->table('campaign_assets')->where('id',$id)->where('actor_id',$u->id)->first();
            abort_unless($a,422,'Tệp đính kèm không còn khả dụng.');
            $parts[]=['kind'=>$a->kind,'assetId'=>$a->id,'name'=>$a->name];
        }
        abort_unless(count($parts),422,'Hãy nhập nội dung hoặc chọn tệp.');
        $sender=ZaloTeamAccess::scope($u)['userName'] ?? $u->name ?? ('Nhân viên #'.$u->id);
        $prepared=[];
        foreach ($selected as $row) {
            $resolved=array_map(function ($part) use ($row,$sender) {
                if ($part['kind']==='text') {
                    $part['text']=strtr($part['text'],['{ten_khach}'=>$row['name'] ?: 'anh/chị','{ten_nhan_vien}'=>$sender]);
                    abort_if(preg_match('/\{[^{}]+\}/u',$part['text']),422,'Nội dung có biến không được hỗ trợ.');
                    abort_if(strlen(mb_convert_encoding($part['text'],'UTF-16LE','UTF-8'))/2>2000,422,'Nội dung sau cá nhân hóa vượt 2.000 ký tự.');
                }
                return $part;
            },$parts);
            $prepared[]=[$row,$resolved];
        }
        if ($updateId) $this->get($u,$updateId);
        DB::transaction(function () use ($u,$v,$fingerprint,$audience,$parts,$prepared,$updateId) {
            if ($updateId) {
                $old=$this->table()->where('id',$updateId)->lockForUpdate()->first();
                abort_unless($old && $old->state==='draft' && $old->actor_id==$u->id,409,'Chỉ người tạo được sửa chiến dịch còn ở bản nháp.');
                $this->authorize($u,(int)$old->account_id);
                abort_unless(hash_equals($old->fingerprint,$v['revision'] ?? ''),409,'Bản nháp đã thay đổi. Tải lại trước khi sửa.');
            }
            $values=['workspace'=>config('zalo_team.workspace'),
                'actor_id'=>$u->id,'identity_origin'=>config('zalo_team.public_origin'),'account_id'=>$v['accountId'],'account_name'=>$audience['account']['name'],
                'external_id'=>$audience['account']['externalId'],'name'=>$v['name'],'state'=>'draft','fingerprint'=>$fingerprint,
                'filters'=>json_encode(['includeTags'=>$v['includeTags'] ?? [],'excludeTags'=>$v['excludeTags'] ?? [],'type'=>$v['type'],'match'=>$v['match'] ?? 'any']),
                'parts'=>json_encode($parts),'interval_seconds'=>$v['interval'],'start_hour'=>$v['startHour'],'end_hour'=>$v['endHour'],
                'updated_at'=>now()];
            if ($updateId) {
                $v['requestId']=$updateId;
                $this->table()->where('id',$updateId)->update($values);
                DB::table('zt_campaign_deliveries')->where('campaign_id',$updateId)->delete();
                DB::table('zt_campaign_recipients')->where('campaign_id',$updateId)->delete();
            } else DB::table('zt_campaigns')->insert(['id'=>$v['requestId'],'created_at'=>now()]+$values);
            foreach ($prepared as [$row,$resolved]) {
                $rid=(string)Str::uuid();
                DB::table('zt_campaign_recipients')->insert(['id'=>$rid,'campaign_id'=>$v['requestId'],'peer'=>$row['peer'],
                    'source_key'=>$row['sourceKey'],'name'=>$row['name'],'parts'=>json_encode($resolved)]);
                foreach ($resolved as $position=>$part) DB::table('zt_campaign_deliveries')->insert([
                    'id'=>(string)Str::uuid(),'campaign_id'=>$v['requestId'],'recipient_id'=>$rid,'position'=>$position,'state'=>'queued','updated_at'=>now(),
                ]);
            }
            $this->audit($v['requestId'],$u,$updateId?'update':'create');
        });
        return $this->detail($u,$updateId ?? $v['requestId'],0);
    }

    public function audit(string $id, User $u, string $action): void
    {
        DB::table('zt_campaign_audits')->insert(['campaign_id'=>$id,'actor_id'=>$u->id,'action'=>$action,'created_at'=>now()]);
    }

    public function editData(User $u, string $id): array
    {
        $c=$this->get($u,$id); $this->authorize($u,(int)$c->account_id);
        abort_unless($c->actor_id==$u->id,403,'Chỉ người tạo được sửa hoặc sao chép nội dung chiến dịch.');
        $parts=json_decode($c->parts,true);
        return $this->summary($c)+['revision'=>$c->fingerprint,'filters'=>json_decode($c->filters,true),
            'peers'=>DB::table('zt_campaign_recipients')->where('campaign_id',$id)->pluck('peer')->all(),
            'text'=>collect($parts)->firstWhere('kind','text')['text'] ?? '',
            'assets'=>array_values(array_map(fn($p)=>['id'=>$p['assetId'],'name'=>$p['name'],'kind'=>$p['kind']],array_filter($parts,fn($p)=>isset($p['assetId']))))];
    }

    /** Requeue only undispatched parts. Confirmation/resume remains a separate action. */
    public function requeue(User $u, string $id): array
    {
        $c=$this->get($u,$id); $this->authorize($u,(int)$c->account_id);
        DB::transaction(function () use ($u,$id) {
            $c=$this->table()->where('id',$id)->lockForUpdate()->first();
            abort_unless(in_array($c->state,['paused','completed','cancelled']),409,'Tạm dừng chiến dịch trước khi chuẩn bị gửi tiếp.');
            $q=DB::table('zt_campaign_deliveries')->where('campaign_id',$id);
            abort_if((clone $q)->whereIn('state',['preparing','sending','unknown'])->exists(),409,'Còn phần đang gửi hoặc chưa xác nhận. Kiểm tra kết quả trước khi gửi tiếp.');
            $retry=(clone $q)->whereNull('dispatched_at')->whereIn('state',['failed','skipped','cancelled']);
            abort_unless((clone $retry)->exists(),409,'Không có phần chưa gửi để thử lại.');
            $retry->update(['state'=>'queued','issue'=>null,'lease'=>null,'updated_at'=>now()]);
            $this->table()->where('id',$id)->update(['state'=>'paused','issue'=>null,'updated_at'=>now()]);
            $this->audit($id,$u,'requeue');
        });
        return $this->detail($u,$id,0);
    }

    public function remove(User $u, string $id): array
    {
        $c=$this->get($u,$id); $this->authorize($u,(int)$c->account_id);
        DB::transaction(function () use ($u,$id) {
            $c=$this->table()->where('id',$id)->lockForUpdate()->first();
            abort_unless(in_array($c->state,['draft','paused','completed','cancelled']),409,'Tạm dừng chiến dịch trước khi xóa.');
            abort_if(DB::table('zt_campaign_deliveries')->where('campaign_id',$id)->whereIn('state',['preparing','sending','unknown'])->exists(),409,'Còn phần đang gửi hoặc chưa xác nhận. Kiểm tra kết quả trước khi xóa.');
            // Retain delivery receipts and audit history; deleting a campaign cannot recall Zalo messages.
            DB::table('zt_campaign_deliveries')->where('campaign_id',$id)->whereIn('state',['queued','failed'])->update(['state'=>'cancelled','updated_at'=>now()]);
            $this->table()->where('id',$id)->update(['state'=>'deleted','updated_at'=>now()]);
            $this->audit($id,$u,'delete');
        });
        return ['ok'=>true];
    }

    public function previewAsset(User $u, string $id, string $assetId)
    {
        $c=$this->get($u,$id);
        abort_unless(collect(json_decode($c->parts,true))->contains('assetId',$assetId),404);
        $a=$this->table('campaign_assets')->where('id',$assetId)->first();
        abort_unless($a && Str::isUuid($a->id),404);
        $path=rtrim(config('zalo_team.campaign_path'),'/\\').DIRECTORY_SEPARATOR.$a->id;
        abort_unless(is_file($path),404,'Tệp không còn trong kho chiến dịch.');
        return response()->file($path,['Content-Type'=>in_array($a->mime,['image/png','image/jpeg','image/gif','image/webp'])?$a->mime:'application/octet-stream',
            'Cache-Control'=>'private, no-store','X-Content-Type-Options'=>'nosniff']);
    }

    public function transition(User $u, string $id, string $action, ?string $scheduled): array
    {
        $c=$this->get($u,$id); $this->authorize($u,(int)$c->account_id);
        if (in_array($action,['start','resume'])) abort_unless($this->workerReady(),503,'Dịch vụ gửi cho môi trường này chưa chạy. Bản nháp vẫn được giữ.');
        DB::transaction(function () use ($u,$id,$action,$scheduled) {
            $c=$this->table()->where('id',$id)->lockForUpdate()->first();
            $state=match($action) {'start','resume'=>'running','pause'=>'paused','cancel'=>'cancelled'};
            if ($c->state===$state) return;
            abort_unless(match($action) {
                'start'=>$c->state==='draft' && $c->actor_id==$u->id,
                'resume'=>$c->state==='paused', 'pause'=>$c->state==='running',
                'cancel'=>in_array($c->state,['draft','running','paused']), default=>false,
            },409,'Trạng thái chiến dịch đã thay đổi. Hãy tải lại.');
            if ($action==='resume') {
                $deliveries=DB::table('zt_campaign_deliveries')->where('campaign_id',$id);
                abort_if((clone $deliveries)->whereIn('state',['unknown','sending','preparing'])->exists(),409,'Kiểm tra phần đang gửi hoặc chưa xác nhận trước khi tiếp tục.');
                abort_unless((clone $deliveries)->where('state','queued')->exists(),409,'Không có phần đang chờ gửi.');
            }
            $at=$scheduled ? Carbon::parse($scheduled)->utc() : now();
            abort_if($at->greaterThan(now()->addDays(30)),422,'Chỉ hẹn giờ tối đa 30 ngày.');
            $this->table()->where('id',$id)->update(['state'=>$state,'scheduled_at'=>$at,'issue'=>null,'updated_at'=>now()]);
            if ($action==='cancel') DB::table('zt_campaign_deliveries')->where('campaign_id',$id)->whereIn('state',['queued','failed'])->update(['state'=>'cancelled','updated_at'=>now()]);
            $this->audit($id,$u,$action);
        });
        return $this->detail($u,$id,0);
    }

    public function suppress(User $u, string $id, string $recipient, bool $enabled=true): array
    {
        $c=$this->get($u,$id); $this->authorize($u,(int)$c->account_id);
        $r=DB::table('zt_campaign_recipients')->where('campaign_id',$id)->where('id',$recipient)->first();
        abort_unless($r,404);
        if ($enabled) DB::table('zt_campaign_suppressions')->updateOrInsert(['workspace'=>config('zalo_team.workspace'),'source_key'=>$r->source_key],['actor_id'=>$u->id,'created_at'=>now()]);
        else $this->table('campaign_suppressions')->where('source_key',$r->source_key)->delete();
        $this->audit($id,$u,($enabled?'suppress:':'unsuppress:').$recipient);
        return ['ok'=>true];
    }
}

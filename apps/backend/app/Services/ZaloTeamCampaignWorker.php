<?php
namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Carbon;

class ZaloTeamCampaignWorker
{
    public function __construct(private ZaloTeamCampaignTransport $transport, private ZaloTeamCampaigns $campaigns) {}

    public function claim(): ?array
    {
        // Recover only after the previous bounded request/lease has expired.
        DB::table('zt_campaign_deliveries')->whereIn('campaign_id',$this->campaigns->table()->select('id'))
            ->where('state','sending')->where('updated_at','<',now()->subMinutes(5))
            ->update(['state'=>'unknown','issue'=>'Lượt gửi bị gián đoạn. Kiểm tra kết quả trước khi gửi tiếp.','updated_at'=>now()]);
        DB::table('zt_campaign_deliveries')->whereIn('campaign_id',$this->campaigns->table()->select('id'))
            ->where('state','preparing')->where('updated_at','<',now()->subMinutes(5))
            ->update(['state'=>'queued','updated_at'=>now()]);
        foreach ($this->campaigns->table()->where('state','running')->where('scheduled_at','<=',now())->orderBy('scheduled_at')->limit(100)->get() as $c) {
            $hour=now('Asia/Ho_Chi_Minh')->hour;
            if ($hour<$c->start_hour || $hour>=$c->end_hour) continue;
            $key=$c->workspace.':'.$c->account_id;
            DB::table('zt_campaign_accounts')->insertOrIgnore(['key'=>$key]);
            $claim=DB::transaction(function () use ($key,$c) {
                $lock=DB::table('zt_campaign_accounts')->where('key',$key)->lockForUpdate()->first();
                if (($lock->lease_until && Carbon::parse($lock->lease_until)->isFuture()) || ($lock->next_at && Carbon::parse($lock->next_at)->isFuture())) return null;
                $current=$this->campaigns->table()->where('id',$c->id)->lockForUpdate()->first();
                if ($current->state!=='running') return null;
                if (DB::table('zt_campaign_deliveries')->where('campaign_id',$c->id)->where('state','unknown')->exists()) {
                    $this->pause($c->id,'Có tin chưa xác nhận kết quả. Kiểm tra trước khi tiếp tục.'); return null;
                }
                $d=DB::table('zt_campaign_deliveries as d')->where('d.campaign_id',$c->id)->where('d.state','queued')
                    ->whereNotExists(fn ($q)=>$q->selectRaw('1')->from('zt_campaign_deliveries as earlier')->whereColumn('earlier.recipient_id','d.recipient_id')->whereColumn('earlier.position','<','d.position')->where('earlier.state','!=','sent'))
                    ->orderBy('d.recipient_id')->orderBy('d.position')->select('d.*')->lockForUpdate()->first();
                if (!$d) {
                    $active=DB::table('zt_campaign_deliveries')->where('campaign_id',$c->id)->whereIn('state',['preparing','sending'])->exists();
                    if (!$active) {
                        $issues=DB::table('zt_campaign_deliveries')->where('campaign_id',$c->id)->whereIn('state',['unknown','failed','queued'])->exists();
                        $this->campaigns->table()->where('id',$c->id)->update(['state'=>$issues?'paused':'completed','issue'=>$issues?'Có mục cần kiểm tra trước khi tiếp tục.':null,'updated_at'=>now()]);
                    }
                    return null;
                }
                $lease=(string)Str::uuid();
                DB::table('zt_campaign_accounts')->where('key',$key)->update(['lease'=>$lease,'lease_until'=>now()->addMinutes(5)]);
                DB::table('zt_campaign_deliveries')->where('id',$d->id)->update(['state'=>'preparing','lease'=>$lease,'updated_at'=>now()]);
                return [$current,$d,$key,$lease];
            });
            if ($claim) return $claim;
        }
        return null;
    }

    private function error(\Throwable $e): string
    {
        if ($e instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface && in_array($e->getStatusCode(),[401,403,404])) return 'Quyền gửi hoặc người thực hiện không còn hợp lệ.';
        return match($e->getMessage()) {
            'WEB_ACCOUNT_OFFLINE'=>'Tài khoản Zalo mất kết nối. Kết nối lại rồi bấm Tiếp tục.',
            'CAMPAIGN_ASSET_MISSING'=>'Tệp chiến dịch không còn đọc được. Kiểm tra kho tệp.',
            'CAMPAIGN_ACCOUNT_CHANGED'=>'Tài khoản Zalo đã đổi danh tính. Chiến dịch đã dừng.',
            'CAMPAIGN_CONNECTOR_VERSION'=>'Bộ kết nối chưa hỗ trợ gửi chiến dịch. Cần cập nhật dịch vụ.',
            default=>'Nguồn Zalo chưa sẵn sàng hoặc đã từ chối thao tác. Kiểm tra tài khoản trước khi tiếp tục.',
        };
    }

    public function tick(): bool
    {
        $claim=$this->claim(); if (!$claim) return false;
        [$c,$d,$key,$lease]=$claim; $dispatched=false;
        try {
            $u=$this->transport->actor((int)$c->actor_id); $this->campaigns->authorize($u,(int)$c->account_id);
            $r=DB::table('zt_campaign_recipients')->where('id',$d->recipient_id)->first();
            $filters=json_decode($c->filters,true);
            $excluded=$this->campaigns->table('campaign_suppressions')->where('source_key',$r->source_key)->exists()
                || $this->campaigns->table('tag_assignments')->where('source',$r->source_key)->where('active',true)->whereIn('tag_id',$filters['excludeTags'] ?? [])->exists();
            if ($excluded) {
                DB::table('zt_campaign_deliveries')->where('recipient_id',$r->id)->whereIn('state',['queued','preparing'])->update([
                    'state'=>'skipped','issue'=>'Đã ngừng nhận chiến dịch hoặc thuộc thẻ loại trừ.','updated_at'=>now()]);
                return true;
            }
            $status=$this->transport->command(['action'=>'status']);
            if (($status['campaignProtocol'] ?? null)!==1) throw new \RuntimeException('CAMPAIGN_CONNECTOR_VERSION');
            $account=collect($status['accounts'] ?? [])->firstWhere('id',(int)$c->account_id);
            if (!$account || ($account['status'] ?? '')!=='connected') throw new \RuntimeException('WEB_ACCOUNT_OFFLINE');
            if ((string)$account['externalId'] !== $c->external_id) throw new \RuntimeException('CAMPAIGN_ACCOUNT_CHANGED');
            $this->transport->command(['action'=>'directory','accountId'=>(int)$c->account_id,'directory'=>['kind'=>'open','id'=>$r->peer]]);
            $part=json_decode($r->parts,true)[$d->position];
            $body=['accountId'=>(int)$c->account_id,'expectedExternalId'=>$c->external_id,'conversationId'=>$r->peer,'requestId'=>$d->id,
                'crmSender'=>['userId'=>(int)$u->id,'name'=>ZaloTeamAccess::scope($u)['userName'] ?? ('Nhân viên #'.$u->id)],
                ...($part['kind']==='text'?['text'=>$part['text']]:[]), 'action'=>$part['kind']==='text'?'send-text':'send-media'];
            if ($part['kind']!=='text') {
                $asset=$this->campaigns->table('campaign_assets')->where('id',$part['assetId'])->first();
                if (!$asset) throw new \RuntimeException('CAMPAIGN_ASSET_MISSING');
                $upload=$this->transport->upload($asset,(int)$c->account_id,$r->peer);
                DB::table('zt_campaign_deliveries')->where('id',$d->id)->where('lease',$lease)->where('state','preparing')->update(['upload_id'=>$upload]);
                $body['media']=['uploadId'=>$upload];
            }
            // Revalidate the actor after preparation and immediately before dispatch.
            $fresh=$this->transport->actor((int)$c->actor_id); $this->campaigns->authorize($fresh,(int)$c->account_id);
            $allowed=DB::transaction(function () use ($c,$d,$key,$lease,$r,$filters) {
                $lock=DB::table('zt_campaign_accounts')->where('key',$key)->lockForUpdate()->first();
                $current=$this->campaigns->table()->where('id',$c->id)->lockForUpdate()->first();
                if ($lock->lease!==$lease || !Carbon::parse($lock->lease_until)->isFuture()) return false;
                if ($current->state!=='running' || $this->campaigns->table('campaign_suppressions')->where('source_key',$r->source_key)->exists()
                    || $this->campaigns->table('tag_assignments')->where('source',$r->source_key)->where('active',true)->whereIn('tag_id',$filters['excludeTags'] ?? [])->exists()) {
                    DB::table('zt_campaign_deliveries')->where('id',$d->id)->where('lease',$lease)->where('state','preparing')->update(['state'=>$current->state==='cancelled'?'cancelled':'queued','updated_at'=>now()]);
                    return false;
                }
                return DB::table('zt_campaign_deliveries')->where('id',$d->id)->where('lease',$lease)->where('state','preparing')->update(['state'=>'sending','dispatched_at'=>now(),'updated_at'=>now()])===1;
            });
            if (!$allowed) return true;
            $dispatched=true;
            $result=$this->transport->command($body);
            $state=($result['status'] ?? '')==='sent'?'sent':'unknown';
            DB::table('zt_campaign_deliveries')->where('id',$d->id)->where('lease',$lease)->update(['state'=>$state,'receipt'=>json_encode($result),
                'issue'=>$state==='unknown'?'Chưa xác nhận kết quả. Không tự gửi lại.':null,'updated_at'=>now()]);
            if ($state==='unknown') $this->pause($c->id,'Có tin chưa xác nhận kết quả. Kiểm tra trước khi tiếp tục.');
        } catch (\Throwable $e) {
            // Record diagnostic codes only; never log message bodies, tokens or peer details.
            \Illuminate\Support\Facades\Log::warning('Campaign delivery failed', [
                'campaign_id'=>$c->id, 'delivery_id'=>$d->id, 'dispatched'=>$dispatched,
                'code'=>preg_match('/^[A-Z_]{3,80}$/',$e->getMessage())?$e->getMessage():'CAMPAIGN_TRANSPORT_ERROR',
            ]);
            $issue=$dispatched?'Chưa xác nhận kết quả. Không tự gửi lại.':$this->error($e);
            $changed=DB::table('zt_campaign_deliveries')->where('id',$d->id)->where('lease',$lease)->whereIn('state',['preparing','sending'])->update(['state'=>$dispatched?'unknown':'failed','issue'=>$issue,'updated_at'=>now()]);
            if ($changed) $this->pause($c->id,$issue);
        } finally {
            DB::table('zt_campaign_accounts')->where('key',$key)->where('lease',$lease)->update(['lease'=>null,'lease_until'=>null,'next_at'=>now()->addSeconds($c->interval_seconds)]);
        }
        return true;
    }
    private function pause(string $id,string $issue): void
    {
        $this->campaigns->table()->where('id',$id)->where('state','running')->update(['state'=>'paused','issue'=>$issue,'updated_at'=>now()]);
    }

    public function retry(\App\Models\User $u, string $campaign, string $delivery): array
    {
        $c=$this->campaigns->get($u,$campaign); $this->campaigns->authorize($u,(int)$c->account_id);
        abort_unless(in_array($c->state,['paused','completed','cancelled']),409,'Tạm dừng chiến dịch trước khi xử lý lại.');
        $d=DB::table('zt_campaign_deliveries')->where('campaign_id',$campaign)->where('id',$delivery)->first(); abort_unless($d,404);
        if ($d->state==='failed' && !$d->dispatched_at && $c->state!=='cancelled') {
            DB::table('zt_campaign_deliveries')->where('id',$d->id)->where('state','failed')->update(['state'=>'queued','issue'=>null,'updated_at'=>now()]);
        } elseif ($d->state==='unknown') {
            $r=DB::table('zt_campaign_recipients')->where('id',$d->recipient_id)->first();
            $part=json_decode($r->parts,true)[$d->position];
            $result=$this->transport->command(['action'=>$part['kind']==='text'?'send-text':'send-media','accountId'=>(int)$c->account_id,
                'conversationId'=>$r->peer,'expectedExternalId'=>$c->external_id,'requestId'=>$d->id,
                ...($part['kind']==='text'?['text'=>$part['text']]:[]), 'checkOnly'=>true,
                'crmSender'=>['userId'=>(int)$c->actor_id,'name'=>'Kiểm tra chiến dịch'],
                ...($part['kind']==='text'?[]:['media'=>['uploadId'=>$d->upload_id]])]);
            if (($result['status'] ?? '')==='sent') DB::table('zt_campaign_deliveries')->where('id',$d->id)->where('state','unknown')->update(['state'=>'sent','receipt'=>json_encode($result),'issue'=>null,'updated_at'=>now()]);
        }
        $this->campaigns->audit($campaign,$u,'check:'.$delivery);
        return $this->campaigns->detail($u,$campaign,0);
    }
}

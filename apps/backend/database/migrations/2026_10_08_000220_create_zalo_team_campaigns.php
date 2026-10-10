<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        if (config('zalo_team.runtime') !== 'zalo' && Schema::hasTable('permissions')) {
            DB::table('permissions')->updateOrInsert(['code'=>'zalo_team.campaigns.send'], [
                'module'=>'zalo_team','name'=>'Gửi chiến dịch Zalo','description'=>'Gửi hàng loạt bằng tài khoản được phép thao tác',
                'created_at'=>now(),'updated_at'=>now(),
            ]);
        }
        // CRM stores the permission only; campaign data belongs to the Zalo service.
        if (config('zalo_team.runtime') !== 'zalo' && (config('zalo_team.runtime') === 'crm' || config('zalo_team.remote_api_url'))) return;
        Schema::create('zt_campaign_workers', function (Blueprint $t) {
            $t->string('key')->primary(); $t->timestampTz('seen_at');
        });
        Schema::create('zt_campaign_templates', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->string('workspace'); $t->unsignedBigInteger('actor_id');
            $t->string('name',120); $t->text('text'); $t->timestampTz('updated_at');
        });
        Schema::create('zt_campaigns', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->string('workspace'); $t->unsignedBigInteger('actor_id');
            $t->string('identity_origin');
            $t->unsignedBigInteger('account_id'); $t->string('account_name'); $t->string('external_id');
            $t->string('name', 120); $t->string('state')->default('draft'); $t->json('filters');
            $t->json('parts'); $t->string('fingerprint', 64); $t->timestampTz('scheduled_at')->nullable();
            $t->unsignedInteger('interval_seconds')->default(60); $t->unsignedTinyInteger('start_hour')->default(8);
            $t->unsignedTinyInteger('end_hour')->default(20); $t->text('issue')->nullable();
            $t->timestampTz('created_at'); $t->timestampTz('updated_at'); $t->index(['workspace','state','scheduled_at']);
        });
        Schema::create('zt_campaign_recipients', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->uuid('campaign_id')->index(); $t->string('peer', 40);
            $t->string('source_key', 100); $t->string('name'); $t->json('parts');
            $t->unique(['campaign_id','peer']);
        });
        Schema::create('zt_campaign_deliveries', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->uuid('campaign_id')->index(); $t->uuid('recipient_id')->index();
            $t->unsignedInteger('position'); $t->string('state')->default('queued');
            $t->uuid('lease')->nullable();
            $t->uuid('upload_id')->nullable(); $t->json('receipt')->nullable(); $t->text('issue')->nullable();
            $t->timestampTz('dispatched_at')->nullable(); $t->timestampTz('updated_at');
            $t->unique(['recipient_id','position']); $t->index(['campaign_id','state']);
        });
        Schema::create('zt_campaign_accounts', function (Blueprint $t) {
            $t->string('key', 100)->primary(); $t->uuid('lease')->nullable();
            $t->timestampTz('lease_until')->nullable(); $t->timestampTz('next_at')->nullable();
        });
        Schema::create('zt_campaign_suppressions', function (Blueprint $t) {
            $t->string('workspace'); $t->string('source_key',100); $t->unsignedBigInteger('actor_id');
            $t->timestampTz('created_at'); $t->primary(['workspace','source_key']);
        });
        Schema::create('zt_campaign_assets', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->string('workspace'); $t->unsignedBigInteger('actor_id');
            $t->string('name'); $t->string('mime'); $t->string('kind'); $t->unsignedBigInteger('bytes');
            $t->string('sha256',64); $t->timestampTz('created_at');
        });
        Schema::create('zt_campaign_audits', function (Blueprint $t) {
            $t->id(); $t->uuid('campaign_id')->index(); $t->unsignedBigInteger('actor_id');
            $t->string('action'); $t->timestampTz('created_at');
        });
    }
    public function down(): void
    {
        if (config('zalo_team.runtime') !== 'zalo' && (config('zalo_team.runtime') === 'crm' || config('zalo_team.remote_api_url'))) return;
        foreach (['workers','templates','audits','assets','suppressions','accounts','deliveries','recipients','campaigns'] as $name)
            Schema::dropIfExists($name === 'campaigns' ? 'zt_campaigns' : 'zt_campaign_'.$name);
    }
};

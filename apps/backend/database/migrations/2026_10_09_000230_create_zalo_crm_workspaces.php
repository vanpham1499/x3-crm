<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // CRM metadata only; intentionally excluded from the Zalo service migration glob.
        Schema::create('zt_crm_workspaces', function (Blueprint $t) {
            $t->string('id', 64)->primary();
            $t->string('owner', 64)->index();
            $t->unsignedBigInteger('assignee_id')->nullable()->index();
            $t->string('state', 24)->default('needs_action')->index();
            $t->unsignedInteger('revision')->default(0);
            $t->timestamps();
        });
        Schema::create('zt_crm_workspace_sources', function (Blueprint $t) {
            $t->string('id', 64)->primary();
            $t->string('workspace_id', 64);
            $t->foreign('workspace_id')->references('id')->on('zt_crm_workspaces')->cascadeOnDelete();
            $t->unsignedBigInteger('account_id')->index();
            $t->string('external_id', 128);
            $t->string('conversation_id', 64);
            $t->timestamps();
        });
        Schema::create('zt_crm_workspace_links', function (Blueprint $t) {
            $t->string('workspace_id', 64);
            $t->foreign('workspace_id')->references('id')->on('zt_crm_workspaces')->cascadeOnDelete();
            $t->string('kind', 16);
            $t->unsignedBigInteger('entity_id');
            $t->unsignedBigInteger('created_by');
            $t->timestamp('created_at');
            $t->primary(['workspace_id', 'kind', 'entity_id']);
        });
        Schema::create('zt_crm_workspace_events', function (Blueprint $t) {
            $t->id();
            $t->string('workspace_id', 64)->index();
            $t->unsignedBigInteger('actor_id');
            $t->string('action', 24);
            $t->json('detail');
            $t->timestamp('created_at');
        });
    }

    public function down(): void
    {
        foreach (['zt_crm_workspace_events', 'zt_crm_workspace_links', 'zt_crm_workspace_sources', 'zt_crm_workspaces'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};

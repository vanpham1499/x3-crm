<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('zt_crm_delivery_routes', function (Blueprint $t) {
            $t->id();
            $t->string('owner', 64);
            $t->string('kind', 16);
            $t->unsignedBigInteger('entity_id');
            $t->string('mode', 16)->default('disabled');
            $t->text('destination')->nullable();
            $t->unsignedInteger('revision')->default(0);
            $t->unsignedBigInteger('updated_by');
            $t->timestamps();
            $t->unique(['owner', 'kind', 'entity_id'], 'zt_delivery_route_entity');
        });
        Schema::create('zt_crm_deliveries', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('owner', 64);
            $t->string('kind', 16);
            $t->unsignedBigInteger('entity_id');
            $t->unsignedBigInteger('actor_id');
            $t->string('version', 64);
            $t->string('dedupe', 64)->unique();
            $t->text('snapshot');
            $t->text('parts');
            $t->string('state', 16)->default('queued');
            $t->string('issue')->nullable();
            $t->uuid('lease')->nullable();
            $t->timestamps();
            $t->index(['owner', 'kind', 'entity_id', 'created_at'], 'zt_delivery_history');
            $t->index(['state', 'updated_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('zt_crm_deliveries');
        Schema::dropIfExists('zt_crm_delivery_routes');
    }
};

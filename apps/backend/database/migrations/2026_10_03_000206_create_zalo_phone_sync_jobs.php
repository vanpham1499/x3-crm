<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('zt_phone_sync_jobs', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('owner', 64)->index();
            $t->unsignedBigInteger('account_id');
            $t->string('external_id', 30);
            $t->string('state', 24);
            $t->boolean('cancel_requested')->default(false);
            $t->boolean('archive_requested')->default(false);
            $t->json('result')->nullable();
            $t->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('zt_phone_sync_jobs');
    }
};

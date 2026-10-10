<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Operational receipts, not message content; never replayed by backup restore.
        Schema::create('zt_archive_pc_recoveries', function (Blueprint $t) {
            $t->string('id', 64)->primary();
            $t->string('owner', 64)->index();
            $t->string('asset_id', 64)->index();
            $t->string('source_id', 64)->index();
            $t->timestampTz('requested_at');
            $t->timestampTz('checked_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('zt_archive_pc_recoveries');
    }
};

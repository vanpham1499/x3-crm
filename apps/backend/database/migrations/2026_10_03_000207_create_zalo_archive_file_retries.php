<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('zt_archive_file_retries', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('owner', 64)->index();
            $t->json('selection');
            $t->unsignedInteger('matched')->default(0);
            $t->unsignedInteger('queued')->nullable();
            $t->timestampTz('created_at');
            $t->timestampTz('applied_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('zt_archive_file_retries');
    }
};

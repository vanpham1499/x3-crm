<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('zt_archive_checkpoints', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('owner', 64)->index();
            $t->date('date');
            $t->json('manifest');
            $t->string('checksum', 64);
            $t->json('summary');
            $t->json('verification')->nullable();
            $t->timestampTz('verified_at')->nullable();
            $t->timestampTz('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('zt_archive_checkpoints');
    }
};

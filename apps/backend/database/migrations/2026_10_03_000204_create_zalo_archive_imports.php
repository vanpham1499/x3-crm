<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('zt_archive_imports', function (Blueprint $t) {
            $t->string('id', 64)->primary();
            $t->string('owner', 64)->index();
            $t->string('source_id', 64);
            $t->foreign('source_id')->references('id')->on('zt_archive_sources');
            $t->string('kind', 24)->default('pc');
            $t->string('state', 24);
            $t->json('summary');
            $t->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('zt_archive_imports');
    }
};

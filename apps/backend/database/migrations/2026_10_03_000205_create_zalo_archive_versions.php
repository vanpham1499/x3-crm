<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('zt_archive_versions', function (Blueprint $t) {
            $t->string('id', 64)->primary();
            $t->string('owner', 64)->index();
            $t->string('source_id', 64)->index();
            $t->string('native_id', 200);
            $t->string('origin', 16);
            $t->string('disposition', 24);
            $t->json('payload');
            $t->timestampTz('recorded_at');
            $t->index(['source_id', 'native_id']);
        });
    }

    public function down(): void
    {
        // Rollback must never discard historical payloads created after deployment.
        throw new RuntimeException('Archive versions are retained. Roll back application code without dropping historical data.');
    }
};

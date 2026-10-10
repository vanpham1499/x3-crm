<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('zt_archive_drive_objects', function (Blueprint $t) {
            $t->string('id', 64)->primary();
            $t->string('owner', 64)->index();
            $t->string('kind', 24);
            $t->string('object_key', 64);
            $t->string('checksum', 64);
            $t->unsignedBigInteger('bytes');
            $t->string('drive_id', 128)->nullable();
            $t->string('folder_id', 128);
            $t->string('shared_drive_id', 128);
            $t->text('upload_session')->nullable(); // Encrypted with APP_KEY.
            $t->unsignedBigInteger('uploaded')->default(0);
            $t->string('state', 16)->default('pending');
            $t->unsignedInteger('attempts')->default(0);
            $t->string('error', 80)->nullable(); // Sanitized codes, never upstream URLs/tokens.
            $t->timestampTz('retry_at')->nullable();
            $t->timestampTz('verified_at')->nullable();
            $t->timestampTz('accessed_at')->nullable();
            $t->timestampTz('cached_at')->nullable();
            $t->timestampsTz();
            $t->unique(['owner', 'kind', 'object_key']);
            $t->index(['state', 'retry_at']);
        });
    }

    public function down(): void
    {
        throw new RuntimeException('Drive locators are retained. Roll back code without dropping storage metadata.');
    }
};

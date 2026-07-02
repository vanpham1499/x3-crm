<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attachments', function (Blueprint $table): void {
            if (! Schema::hasColumn('attachments', 'original_name')) {
                $table->string('original_name')->nullable()->after('file_name');
            }

            if (! Schema::hasColumn('attachments', 'mime_type')) {
                $table->string('mime_type', 100)->nullable()->after('file_type');
            }

            if (! Schema::hasColumn('attachments', 'file_size')) {
                $table->unsignedBigInteger('file_size')->default(0)->after('mime_type');
            }

            if (! Schema::hasColumn('attachments', 'disk')) {
                $table->string('disk', 50)->default('public')->after('file_size');
            }
        });
    }

    public function down(): void
    {
        Schema::table('attachments', function (Blueprint $table): void {
            if (Schema::hasColumn('attachments', 'disk')) {
                $table->dropColumn('disk');
            }

            if (Schema::hasColumn('attachments', 'file_size')) {
                $table->dropColumn('file_size');
            }

            if (Schema::hasColumn('attachments', 'mime_type')) {
                $table->dropColumn('mime_type');
            }

            if (Schema::hasColumn('attachments', 'original_name')) {
                $table->dropColumn('original_name');
            }
        });
    }
};

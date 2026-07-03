<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('services', function (Blueprint $table): void {
            if (! Schema::hasColumn('services', 'parent_id')) {
                $table->foreignUuid('parent_id')->nullable()->after('id')->constrained('services')->restrictOnDelete();
            }

            if (! Schema::hasColumn('services', 'content')) {
                $table->text('content')->nullable()->after('name');
            }

            if (! Schema::hasColumn('services', 'invoice_content')) {
                $table->text('invoice_content')->nullable()->after('content');
            }

            if (! Schema::hasColumn('services', 'invoice_timing')) {
                $table->text('invoice_timing')->nullable()->after('invoice_content');
            }

            if (! Schema::hasColumn('services', 'level')) {
                $table->unsignedSmallInteger('level')->default(1)->after('description');
            }

            if (! Schema::hasColumn('services', 'sort_order')) {
                $table->unsignedInteger('sort_order')->default(0)->after('level');
            }

            $table->index(['parent_id', 'deleted_at']);
            $table->index(['level', 'is_active', 'deleted_at']);
        });
    }

    public function down(): void
    {
        Schema::table('services', function (Blueprint $table): void {
            $table->dropIndex(['parent_id', 'deleted_at']);
            $table->dropIndex(['level', 'is_active', 'deleted_at']);
            $table->dropForeign(['parent_id']);
            $table->dropColumn([
                'parent_id',
                'content',
                'invoice_content',
                'invoice_timing',
                'level',
                'sort_order',
            ]);
        });
    }
};

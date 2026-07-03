<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            if (! Schema::hasColumn('projects', 'status_option_id')) {
                $table->foreignUuid('status_option_id')->nullable()->after('status_id')->constrained('options')->nullOnDelete();
            }
        });

        DB::statement('alter table projects alter column status_id drop not null');
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            if (Schema::hasColumn('projects', 'status_option_id')) {
                $table->dropForeign(['status_option_id']);
                $table->dropColumn('status_option_id');
            }
        });
    }
};

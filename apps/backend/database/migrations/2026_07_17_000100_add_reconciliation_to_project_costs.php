<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_costs', function (Blueprint $table): void {
            $table->timestamp('reconciled_at')->nullable()->after('note');
            $table->foreignId('reconciled_by')
                ->nullable()
                ->after('reconciled_at')
                ->constrained('users')
                ->nullOnDelete();
            $table->index(['reconciled_at', 'deleted_at']);
        });
    }

    public function down(): void
    {
        Schema::table('project_costs', function (Blueprint $table): void {
            $table->dropIndex(['reconciled_at', 'deleted_at']);
            $table->dropConstrainedForeignId('reconciled_by');
            $table->dropColumn('reconciled_at');
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('weekly_reports', function (Blueprint $table): void {
            $table->text('rejection_reason')->nullable()->after('approved_at');
            $table->foreignId('rejected_by')->nullable()->after('rejection_reason')->constrained('users')->nullOnDelete();
            $table->timestamp('rejected_at')->nullable()->after('rejected_by');
        });
    }

    public function down(): void
    {
        Schema::table('weekly_reports', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('rejected_by');
            $table->dropColumn(['rejection_reason', 'rejected_at']);
        });
    }
};

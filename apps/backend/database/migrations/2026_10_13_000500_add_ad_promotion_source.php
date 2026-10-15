<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_costs', function (Blueprint $table) {
            $table->string('funding_source', 20)->default('cash');
            $table->string('promotion_code')->nullable();
            $table->date('promotion_expires_on')->nullable();
            $table->decimal('promotion_used_amount', 18, 2)->default(0);
            $table->decimal('promotion_revoked_amount', 18, 2)->default(0);
            $table->text('promotion_evidence_url')->nullable();
            $table->json('promotion_history')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('project_costs', fn (Blueprint $table) => $table->dropColumn([
            'funding_source', 'promotion_code', 'promotion_expires_on', 'promotion_used_amount',
            'promotion_revoked_amount', 'promotion_evidence_url', 'promotion_history',
        ]));
    }
};

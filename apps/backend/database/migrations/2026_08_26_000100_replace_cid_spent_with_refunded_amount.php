<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_costs', function (Blueprint $table): void {
            $table->decimal('cid_refunded_amount', 15, 2)->default(0)->after('cid_spent_amount');
        });

        // Preserve the financial result of existing stopped CIDs while changing
        // the input semantics from "spent" to the amount returned to the project.
        DB::statement(<<<'SQL'
            UPDATE project_costs
            SET cid_refunded_amount = GREATEST(
                LEAST(
                    COALESCE(total_amount, 0) - COALESCE(cid_spent_amount, 0),
                    COALESCE(total_amount, 0)
                ),
                0
            )
            WHERE cid_is_dead = true
            SQL);
    }

    public function down(): void
    {
        Schema::table('project_costs', function (Blueprint $table): void {
            $table->dropColumn('cid_refunded_amount');
        });
    }
};

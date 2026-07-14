<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_costs', function (Blueprint $table): void {
            $table->boolean('cid_is_dead')->default(false)->after('ad_account');
            $table->decimal('cid_spent_amount', 15, 2)->default(0)->after('cid_is_dead');
        });
    }

    public function down(): void
    {
        Schema::table('project_costs', function (Blueprint $table): void {
            $table->dropColumn(['cid_is_dead', 'cid_spent_amount']);
        });
    }
};

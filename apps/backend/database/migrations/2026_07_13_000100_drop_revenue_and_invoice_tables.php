<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Drop the payments.revenue_id column (and its composite index) first — it is the only
        // FK from a surviving table into `revenues`. `revenue_items` and `invoices` are dropped
        // outright below, so their own FKs into `revenues` disappear with them.
        Schema::table('payments', function (Blueprint $table): void {
            $table->dropIndex(['project_id', 'revenue_id', 'deleted_at']);
            $table->dropConstrainedForeignId('revenue_id');
        });

        Schema::dropIfExists('invoices');
        Schema::dropIfExists('revenue_items');
        Schema::dropIfExists('revenues');
    }

    public function down(): void
    {
        // Intentionally no-op: the Revenue/Invoice module (superseded by ProjectCost +
        // Quotation-as-báo-phí) was removed deliberately, not accidentally. Restoring it would
        // require recreating the original table/column definitions from source control history.
    }
};

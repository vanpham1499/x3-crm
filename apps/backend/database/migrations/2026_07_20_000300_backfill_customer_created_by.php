<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            UPDATE customers
            SET created_by = (
                SELECT customer_timelines.created_by
                FROM customer_timelines
                WHERE customer_timelines.customer_id = customers.id
                  AND customer_timelines.created_by IS NOT NULL
                  AND customer_timelines.deleted_at IS NULL
                ORDER BY customer_timelines.created_at ASC, customer_timelines.id ASC
                LIMIT 1
            )
            WHERE customers.created_by IS NULL
              AND EXISTS (
                  SELECT 1
                  FROM customer_timelines
                  WHERE customer_timelines.customer_id = customers.id
                    AND customer_timelines.created_by IS NOT NULL
                    AND customer_timelines.deleted_at IS NULL
              )
        SQL);
    }

    public function down(): void
    {
        // Dữ liệu người tạo được khôi phục từ lịch sử nên không xóa khi rollback.
    }
};

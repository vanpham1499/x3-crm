<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            UPDATE leads
            SET created_by = creator.created_by
            FROM (
                SELECT DISTINCT ON (lead_id) lead_id, created_by
                FROM customer_timelines
                WHERE lead_id IS NOT NULL
                  AND created_by IS NOT NULL
                  AND deleted_at IS NULL
                ORDER BY lead_id, created_at ASC, id ASC
            ) AS creator
            WHERE leads.id = creator.lead_id
              AND leads.created_by IS NULL
        SQL);
    }

    public function down(): void
    {
        // Dữ liệu người tạo đã được khôi phục từ lịch sử nên không xóa khi rollback.
    }
};

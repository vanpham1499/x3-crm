<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const GROUP = 'kpi_category';

    private const CATEGORIES = [
        ['key' => 'retention', 'label' => 'Tỷ lệ giữ chân khách hàng (Retention)', 'type' => 'bonus', 'default_score' => 2],
        ['key' => 'work_efficiency_praise', 'label' => 'Hiệu quả công việc (khách khen ngợi)', 'type' => 'bonus', 'default_score' => 1],
        ['key' => 'professional_initiative', 'label' => 'Sáng kiến chuyên môn', 'type' => 'bonus', 'default_score' => 2],
        ['key' => 'effective_solution', 'label' => 'Áp dụng phương án hiệu quả', 'type' => 'bonus', 'default_score' => 1],
        ['key' => 'new_service_upsell', 'label' => 'Gia tăng dịch vụ mới', 'type' => 'bonus', 'default_score' => 2],
        ['key' => 'technical_control_error', 'label' => 'Lỗi kiểm soát kỹ thuật', 'type' => 'penalty', 'default_score' => -1],
        ['key' => 'forecast_error', 'label' => 'Lỗi dự báo', 'type' => 'penalty', 'default_score' => -2],
        ['key' => 'budget_control_error', 'label' => 'Lỗi kiểm soát ngân sách', 'type' => 'penalty', 'default_score' => -1],
        ['key' => 'deadline_error', 'label' => 'Lỗi hội họp/Deadline nhóm', 'type' => 'penalty', 'default_score' => -0.5],
        ['key' => 'customer_response_error', 'label' => 'Phản hồi khách hàng chậm/thiếu', 'type' => 'penalty', 'default_score' => -0.5],
        ['key' => 'work_effectiveness_error', 'label' => 'Lỗi hiệu quả công việc (khách dừng)', 'type' => 'penalty', 'default_score' => -2],
    ];

    public function up(): void
    {
        $now = now();

        foreach (self::CATEGORIES as $index => $category) {
            DB::table('options')->insertOrIgnore([
                'group' => self::GROUP,
                'key' => $category['key'],
                'value' => $category['key'],
                'label' => $category['label'],
                'meta' => json_encode([
                    'type' => $category['type'],
                    'defaultScore' => $category['default_score'],
                ]),
                'sort_order' => ($index + 1) * 10,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        DB::table('options')->where('group', self::GROUP)->delete();
    }
};

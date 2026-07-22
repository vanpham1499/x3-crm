<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const GROUP = 'weekly_condition';

    public function up(): void
    {
        $now = now();
        $options = [
            [
                'key' => 'tot',
                'label' => 'Tốt',
                'color' => '#00a878',
                'sort_order' => 10,
            ],
            [
                'key' => 'can_theo_doi',
                'label' => 'Cần theo dõi',
                'color' => '#d97706',
                'sort_order' => 20,
            ],
            [
                'key' => 'rui_ro',
                'label' => 'Rủi ro',
                'color' => '#e11d48',
                'sort_order' => 30,
            ],
        ];

        foreach ($options as $option) {
            DB::table('options')->updateOrInsert(
                [
                    'group' => self::GROUP,
                    'key' => $option['key'],
                ],
                [
                    'value' => $option['key'],
                    'label' => $option['label'],
                    'meta' => json_encode(['color' => $option['color']]),
                    'sort_order' => $option['sort_order'],
                    'is_active' => true,
                    'deleted_at' => null,
                    'updated_at' => $now,
                    'created_at' => $now,
                ],
            );
        }
    }

    public function down(): void
    {
        DB::table('options')
            ->where('group', self::GROUP)
            ->whereIn('key', ['tot', 'can_theo_doi', 'rui_ro'])
            ->delete();
    }
};

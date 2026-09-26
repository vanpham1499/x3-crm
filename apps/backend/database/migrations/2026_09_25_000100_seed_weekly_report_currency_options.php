<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const GROUP = 'weekly_report_currency';

    private const CURRENCIES = [
        ['code' => 'VND', 'label' => 'Đồng Việt Nam', 'sort_order' => 10],
        ['code' => 'USD', 'label' => 'Đô la Mỹ', 'sort_order' => 20],
        ['code' => 'EUR', 'label' => 'Euro', 'sort_order' => 30],
        ['code' => 'AUD', 'label' => 'Đô la Úc', 'sort_order' => 40],
    ];

    public function up(): void
    {
        $now = now();

        foreach (self::CURRENCIES as $currency) {
            $existing = DB::table('options')
                ->where('group', self::GROUP)
                ->where('key', $currency['code'])
                ->first();

            $values = [
                'value' => $currency['code'],
                'label' => $currency['label'],
                'sort_order' => $currency['sort_order'],
                'is_active' => true,
                'deleted_at' => null,
                'deleted_by' => null,
                'updated_at' => $now,
            ];

            if ($existing) {
                DB::table('options')->where('id', $existing->id)->update($values);
                continue;
            }

            DB::table('options')->insert([
                'group' => self::GROUP,
                'key' => $currency['code'],
                ...$values,
                'created_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        $codes = array_column(self::CURRENCIES, 'code');

        if (DB::table('weekly_reports')
            ->whereIn('currency', $codes)
            ->whereNull('deleted_at')
            ->exists()) {
            return;
        }

        DB::table('options')
            ->where('group', self::GROUP)
            ->whereIn('key', $codes)
            ->delete();
    }
};

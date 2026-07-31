<?php

use App\Models\Option;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        $this->updateProjectStatuses(function (array $meta, object $option): array {
            if (array_key_exists(Option::META_REQUIRES_WEEKLY_REPORT, $meta)) {
                return $meta;
            }

            $normalizedStatus = Str::of(($option->key ?? '').' '.($option->label ?? ''))
                ->ascii()
                ->lower()
                ->replace(['-', '_'], ' ')
                ->squish()
                ->toString();
            $isPaused = Str::contains($normalizedStatus, ['tam dung', 'pause', 'paused', 'hold']);
            $isStopped = ! $isPaused && Str::contains($normalizedStatus, [
                'dung',
                'da dung',
                'stop',
                'stopped',
                'cancel',
                'cancelled',
                'closed',
            ]);

            $meta[Option::META_REQUIRES_WEEKLY_REPORT] = ! $isStopped;

            return $meta;
        });
    }

    public function down(): void
    {
        $this->updateProjectStatuses(function (array $meta): array {
            unset($meta[Option::META_REQUIRES_WEEKLY_REPORT]);

            return $meta;
        });
    }

    private function updateProjectStatuses(callable $updateMeta): void
    {
        DB::table('options')
            ->where('group', Option::GROUP_PROJECT_STATUS)
            ->orderBy('id')
            ->get(['id', 'key', 'label', 'meta'])
            ->each(function (object $option) use ($updateMeta): void {
                $meta = is_string($option->meta)
                    ? (json_decode($option->meta, true) ?: [])
                    : ((array) ($option->meta ?? []));

                DB::table('options')
                    ->where('id', $option->id)
                    ->update([
                        'meta' => json_encode(
                            $updateMeta($meta, $option),
                            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
                        ),
                        'updated_at' => now(),
                    ]);
            });
    }
};

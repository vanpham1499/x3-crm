<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('projects')
            ->where('project_type', 'N')
            ->update(['project_type' => 'O']);

        $this->normalizeQuotationMetadata('N', 'O');
    }

    public function down(): void
    {
        DB::table('projects')
            ->where('project_type', 'O')
            ->update(['project_type' => 'N']);

        $this->normalizeQuotationMetadata('O', 'N');
    }

    private function normalizeQuotationMetadata(string $from, string $to): void
    {
        DB::table('quotations')
            ->whereNotNull('metadata')
            ->select(['id', 'metadata'])
            ->orderBy('id')
            ->chunkById(100, function ($quotations) use ($from, $to): void {
                foreach ($quotations as $quotation) {
                    $metadata = json_decode((string) $quotation->metadata, true);

                    if (! is_array($metadata) || ($metadata['projectType'] ?? null) !== $from) {
                        continue;
                    }

                    $metadata['projectType'] = $to;

                    DB::table('quotations')
                        ->where('id', $quotation->id)
                        ->update([
                            'metadata' => json_encode(
                                $metadata,
                                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
                            ),
                        ]);
                }
            });
    }
};

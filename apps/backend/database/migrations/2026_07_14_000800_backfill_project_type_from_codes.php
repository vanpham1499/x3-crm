<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('projects')
            ->select(['id', 'project_code'])
            ->orderBy('id')
            ->chunkById(100, function ($projects): void {
                foreach ($projects as $project) {
                    $segments = explode('.', mb_strtoupper((string) $project->project_code));
                    $projectType = ($segments[2] ?? null) === 'M' ? 'M' : 'K';

                    DB::table('projects')
                        ->where('id', $project->id)
                        ->update(['project_type' => $projectType]);
                }
            });
    }

    public function down(): void
    {
        DB::table('projects')->update(['project_type' => 'K']);
    }
};

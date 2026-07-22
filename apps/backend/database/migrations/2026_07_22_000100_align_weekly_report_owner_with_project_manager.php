<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $this->syncReportOwners('manager_user_id');
    }

    public function down(): void
    {
        $this->syncReportOwners('sales_user_id');
    }

    private function syncReportOwners(string $projectUserColumn): void
    {
        DB::table('projects')
            ->whereNotNull($projectUserColumn)
            ->select(['id', $projectUserColumn])
            ->orderBy('id')
            ->chunkById(200, function ($projects) use ($projectUserColumn): void {
                foreach ($projects as $project) {
                    DB::table('project_weekly_settings')
                        ->where('project_id', $project->id)
                        ->update([
                            'report_owner_user_id' => $project->{$projectUserColumn},
                            'updated_at' => now(),
                        ]);
                }
            });
    }
};

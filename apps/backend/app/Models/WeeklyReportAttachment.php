<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WeeklyReportAttachment extends BaseModel
{
    protected $fillable = [
        'weekly_report_id',
        'file_name',
        'file_url',
        'mime_type',
        'uploaded_by',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function weeklyReport(): BelongsTo
    {
        return $this->belongsTo(WeeklyReport::class);
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WeeklyReportItem extends BaseModel
{
    protected $fillable = [
        'weekly_report_id',
        'reply_to_item_id',
        'item_type',
        'title',
        'content',
        'priority',
        'status',
        'due_date',
        'assignee_user_id',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'due_date' => 'date',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function weeklyReport(): BelongsTo
    {
        return $this->belongsTo(WeeklyReport::class);
    }

    public function replyTo(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reply_to_item_id');
    }

    public function replies(): HasMany
    {
        return $this->hasMany(self::class, 'reply_to_item_id');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_user_id');
    }
}

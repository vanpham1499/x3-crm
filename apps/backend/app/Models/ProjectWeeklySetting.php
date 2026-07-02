<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectWeeklySetting extends BaseModel
{
    protected $fillable = [
        'project_id',
        'report_owner_user_id',
        'report_weekday',
        'monthly_budget',
        'management_fee_rate',
        'is_active',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'report_weekday' => 'integer',
        'monthly_budget' => 'decimal:2',
        'management_fee_rate' => 'decimal:2',
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function reportOwner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'report_owner_user_id');
    }
}

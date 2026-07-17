<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KpiPoint extends BaseModel
{
    public const TYPE_BONUS = 'bonus';

    public const TYPE_PENALTY = 'penalty';

    protected $fillable = [
        'user_id',
        'project_id',
        'entry_date',
        'category',
        'type',
        'score',
        'customer_ref',
        'note',
        'is_approved',
        'approved_by',
        'approved_at',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'entry_date' => 'date',
        'score' => 'decimal:2',
        'is_approved' => 'boolean',
        'approved_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function categoryOption(): BelongsTo
    {
        return $this->belongsTo(Option::class, 'category', 'key')->where('group', Option::GROUP_KPI_CATEGORY);
    }
}

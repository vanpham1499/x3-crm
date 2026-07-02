<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerTimeline extends BaseModel
{
    protected $fillable = [
        'lead_id',
        'customer_id',
        'project_id',
        'type',
        'content',
        'next_action_date',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'next_action_date' => 'date',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}

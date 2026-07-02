<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends BaseModel
{
    protected $fillable = [
        'project_id',
        'revenue_id',
        'transaction_date',
        'bank_account',
        'transaction_content',
        'amount',
        'customer_code_text',
        'is_notified',
        'reconciled_status',
        'note',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'transaction_date' => 'date',
        'amount' => 'decimal:2',
        'is_notified' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function revenue(): BelongsTo
    {
        return $this->belongsTo(Revenue::class);
    }
}

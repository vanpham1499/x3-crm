<?php

namespace App\Models;

class KpiTarget extends BaseModel
{
    public const SCOPE_SERVICE = 'service';

    public const SCOPE_DEPARTMENT = 'department';

    public const SCOPES = [
        self::SCOPE_SERVICE,
        self::SCOPE_DEPARTMENT,
    ];

    protected $fillable = [
        'scope_type',
        'scope_id',
        'period_month',
        'target_amount',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'scope_id' => 'integer',
        'period_month' => 'date',
        'target_amount' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}

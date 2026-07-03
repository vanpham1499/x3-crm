<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

class Option extends BaseModel
{
    public const GROUP_LEAD_STATUS = 'lead_status';

    public const GROUP_LEAD_SOURCE = 'lead_source';

    public const GROUP_INDUSTRY = 'industry';

    public const GROUP_LEAD_SERVICE = 'lead_service';

    protected $fillable = [
        'group',
        'key',
        'value',
        'label',
        'meta',
        'sort_order',
        'is_active',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'meta' => 'array',
        'sort_order' => 'integer',
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function statusLeads(): HasMany
    {
        return $this->hasMany(Lead::class, 'status_option_id');
    }

    public function sourceLeads(): HasMany
    {
        return $this->hasMany(Lead::class, 'source_option_id');
    }

    public function industryLeads(): HasMany
    {
        return $this->hasMany(Lead::class, 'industry_option_id');
    }
}

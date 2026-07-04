<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

class Option extends BaseModel
{
    public const GROUP_LEAD_STATUS = 'lead_status';

    public const GROUP_LEAD_SOURCE = 'lead_source';

    public const GROUP_INDUSTRY = 'industry';

    public const GROUP_LEAD_SERVICE = 'lead_service';

    public const GROUP_CUSTOMER_TYPE = 'customer_type';

    public const GROUP_PROJECT_STATUS = 'project_status';

    public const GROUP_CONTRACT_STATUS = 'contract_status';

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

    public function typeCustomers(): HasMany
    {
        return $this->hasMany(Customer::class, 'customer_type_option_id');
    }

    public function sourceCustomers(): HasMany
    {
        return $this->hasMany(Customer::class, 'source_option_id');
    }

    public function industryCustomers(): HasMany
    {
        return $this->hasMany(Customer::class, 'industry_option_id');
    }

    public function statusProjects(): HasMany
    {
        return $this->hasMany(Project::class, 'status_option_id');
    }

    public function statusContracts(): HasMany
    {
        return $this->hasMany(Contract::class, 'contract_status_option_id');
    }
}

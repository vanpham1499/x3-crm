<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

class Service extends BaseModel
{
    protected $fillable = [
        'code',
        'name',
        'description',
        'is_active',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function packages(): HasMany
    {
        return $this->hasMany(ServicePackage::class);
    }

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }
}

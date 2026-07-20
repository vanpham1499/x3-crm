<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Collection;

class User extends Authenticatable
{
    use HasFactory;
    use SoftDeletes;

    public const ROLE_ADMIN = 'ADMIN';
    public const ROLE_LEADER = 'LEADER';
    public const ROLE_EMPLOYEE = 'EMPLOYEE';
    public const ROLE_ACCOUNTANT = 'ACCOUNTANT';
    public const ROLE_SALES = 'SALES';

    public const ROLES = [
        self::ROLE_ADMIN,
        self::ROLE_LEADER,
        self::ROLE_EMPLOYEE,
        self::ROLE_ACCOUNTANT,
        self::ROLE_SALES,
    ];

    protected $fillable = [
        'code',
        'role_id',
        'department_id',
        'name',
        'email',
        'password',
        'phone',
        'role',
        'avatar',
        'is_active',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function roleRef(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    public function isLeader(): bool
    {
        return $this->role === self::ROLE_LEADER;
    }

    private ?Collection $permissionCodesCache = null;

    /**
     * Whether the user's role has been granted this permission code, via role_permissions.
     * Role-agnostic by design: callers should never branch on role name, only on permission code.
     */
    public function hasPermission(string $code): bool
    {
        if ($this->permissionCodesCache === null) {
            $this->permissionCodesCache = $this->role_id
                ? Role::query()->find($this->role_id)?->permissions()->pluck('code') ?? collect()
                : collect();
        }

        return $this->permissionCodesCache->contains($code);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(self::class, 'created_by');
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(self::class, 'updated_by');
    }

    public function deletedBy(): BelongsTo
    {
        return $this->belongsTo(self::class, 'deleted_by');
    }

    public function managedProjects(): HasMany
    {
        return $this->hasMany(Project::class, 'manager_user_id');
    }

    public function salesProjects(): HasMany
    {
        return $this->hasMany(Project::class, 'sales_user_id');
    }

    public function weeklyReports(): HasMany
    {
        return $this->hasMany(WeeklyReport::class, 'reporter_user_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;

class User extends Authenticatable
{
    use HasFactory;
    use HasUuids;

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
        'name',
        'email',
        'password',
        'phone',
        'role',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}

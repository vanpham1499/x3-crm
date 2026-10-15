<?php

namespace App\Models;

use App\Services\ZaloTeamAccess;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
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

    protected static function booted(): void
    {
        static::updating(function (self $user): void {
            if ($user->isDirty('department_id') && $user->team_id) {
                $team = Team::find($user->team_id);
                if (! $team || (int) $team->department_id !== (int) $user->department_id) {
                    $user->team_id = null;
                }
            }
        });
        static::updated(function (self $user) {
            if ($user->wasChanged('department_id')) {
                Team::where('leader_user_id', $user->id)->where(fn ($q) => $q->where('department_id', '!=', $user->department_id ?? 0))->update(['leader_user_id' => null]);
            }
            if ($user->wasChanged('team_id')) {
                $at = now();
                TeamMembership::where('user_id', $user->id)->whereNull('ended_at')->update(['ended_at' => $at]);
                if ($user->team_id) {
                    TeamMembership::create(['user_id' => $user->id, 'team_id' => $user->team_id,
                        'started_at' => $at, 'changed_by' => request()->user()?->id]);
                }
            }
            if ($user->wasChanged('department_id') || ($user->wasChanged('is_active') && ! $user->is_active)) {
                ZaloTeamAccess::revokeUser((int) $user->id);
            }
        });
        static::deleted(fn (self $user) => ZaloTeamAccess::revokeUser((int) $user->id));
        static::deleted(fn (self $user) => TeamMembership::where('user_id', $user->id)->whereNull('ended_at')->update(['ended_at' => now()]));
    }

    public function isLeader(): bool
    {
        return $this->role === self::ROLE_LEADER;
    }

    private ?Collection $permissionCodesCache = null;

    /** @var array<int>|null */
    private ?array $accessibleDepartmentIdsCache = null;

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

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function ledTeams(): HasMany
    {
        return $this->hasMany(Team::class, 'leader_user_id');
    }

    /** Membership grants no permission; callers must check the module/action grant. */
    public function accessibleTeamIds(): array
    {
        $ids = $this->ledTeams()->pluck('id');
        if ($this->team_id && Team::whereKey($this->team_id)->exists()) {
            $ids->push($this->team_id);
        }

        return $ids->map(fn ($id) => (int) $id)->unique()->values()->all();
    }

    public function sharesTeamWith(?User $other): bool
    {
        return $other?->team_id && in_array((int) $other->team_id, $this->accessibleTeamIds(), true);
    }

    public function ledDepartments(): HasMany
    {
        return $this->hasMany(Department::class, 'leader_user_id');
    }

    /**
     * A user belongs to one primary department, but may lead multiple teams.
     * Department-scoped permissions cover both the primary department and
     * every department currently led by the user.
     *
     * @return array<int>
     */
    public function accessibleDepartmentIds(): array
    {
        if ($this->accessibleDepartmentIdsCache !== null) {
            return $this->accessibleDepartmentIdsCache;
        }

        $ledDepartmentIds = $this->relationLoaded('ledDepartments')
            ? $this->ledDepartments->pluck('id')
            : $this->ledDepartments()->pluck('departments.id');

        return $this->accessibleDepartmentIdsCache = $ledDepartmentIds
            ->push($this->department_id)
            ->filter()
            ->map(fn ($departmentId): int => (int) $departmentId)
            ->unique()
            ->values()
            ->all();
    }

    public function canAccessDepartment(int|string|null $departmentId): bool
    {
        if (! $departmentId) {
            return false;
        }

        return in_array((int) $departmentId, $this->accessibleDepartmentIds(), true);
    }

    /** Directional check: whether this user may access the other user's department scope. */
    public function sharesDepartmentWith(?User $other): bool
    {
        return $this->canAccessDepartment($other?->department_id);
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

    public function organizedMeetings(): HasMany
    {
        return $this->hasMany(Meeting::class, 'organizer_user_id');
    }

    public function meetingParticipations(): BelongsToMany
    {
        return $this->belongsToMany(Meeting::class, 'meeting_participants')
            ->withPivot('attendance_status')
            ->withTimestamps();
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(UserNotification::class);
    }
}

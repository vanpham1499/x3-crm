<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Project extends BaseModel
{
    protected $fillable = [
        'project_code',
        'customer_id',
        'quotation_id',
        'service_id',
        'project_name',
        'project_type',
        'status_id',
        'status_option_id',
        'manager_user_id',
        'sales_user_id',
        'zalo_group',
        'plan_link',
        'weekly_report_link',
        'customer_tracking_report_link',
        'admin_web_account',
        'start_date',
        'end_date',
        'note',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(Quotation::class);
    }

    public function status(): BelongsTo
    {
        return $this->belongsTo(Status::class);
    }

    public function statusOption(): BelongsTo
    {
        return $this->belongsTo(Option::class, 'status_option_id');
    }

    public function managerUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'manager_user_id');
    }

    public function salesUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sales_user_id');
    }

    public function isManagedBy(User $user): bool
    {
        return $this->manager_user_id === $user->id;
    }

    public function isAssignedTo(User $user): bool
    {
        return $this->sales_user_id === $user->id;
    }

    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function costs(): HasMany
    {
        return $this->hasMany(ProjectCost::class);
    }

    public function googleAdAccount(): HasOne
    {
        return $this->hasOne(GoogleAdAccount::class);
    }

    public function weeklySetting(): HasOne
    {
        return $this->hasOne(ProjectWeeklySetting::class);
    }

    public function weeklyReports(): HasMany
    {
        return $this->hasMany(WeeklyReport::class);
    }

    public function timelines(): HasMany
    {
        return $this->hasMany(CustomerTimeline::class);
    }
}

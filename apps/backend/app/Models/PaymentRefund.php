<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentRefund extends BaseModel
{
    public const TYPE_DEPOSIT = 'deposit';

    public const TYPE_PAYMENT = 'payment';

    public const TYPE_OVERPAYMENT = 'overpayment';

    public const TYPE_COMPENSATION = 'compensation';

    public const STATUS_PENDING = 'pending';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'payment_id',
        'payment_allocation_id',
        'quotation_id',
        'customer_id',
        'project_id',
        'refund_type',
        'status',
        'amount',
        'scheduled_at',
        'refunded_at',
        'completed_at',
        'recipient_name',
        'recipient_account',
        'recipient_bank',
        'reason',
        'reference',
        'note',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'scheduled_at' => 'datetime',
        'refunded_at' => 'datetime',
        'completed_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    public function allocation(): BelongsTo
    {
        return $this->belongsTo(PaymentAllocation::class, 'payment_allocation_id');
    }

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(Quotation::class);
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

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProjectCost extends BaseModel
{
    public const TYPE_AD_SPEND = 'ad_spend';

    public const TYPE_PARTNER_COST = 'partner_cost';

    public const STATUS_PENDING = 'pending';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_CANCELLED = 'cancelled';

    public const RECONCILIATION_MATCHED = 'matched';

    public const RECONCILIATION_MATCHED_WITH_NOTE = 'matched_with_note';

    public const RECONCILIATION_DIFFERENCE = 'difference';

    public const RECONCILIATION_PENDING_DOCUMENTS = 'pending_documents';

    public const RECONCILIATION_CANCELLED = 'cancelled';

    public const INVOICE_STATUS_PENDING = 'pending';

    public const INVOICE_STATUS_WAITING = 'waiting';

    public const INVOICE_STATUS_RECEIVED = 'received';

    public const INVOICE_STATUS_NOT_REQUIRED = 'not_required';

    public const INVOICE_RECIPIENT_CUSTOMER = 'customer';

    public const INVOICE_RECIPIENT_COMPANY = 'company';

    public const INVOICE_RECIPIENT_OTHER = 'other';

    protected $fillable = [
        'project_id',
        'quotation_id',
        'entry_type',
        'transaction_date',
        'status',
        'cid',
        'ad_account',
        'cid_is_dead',
        'cid_spent_amount',
        'bank_account_option_id',
        'partner_option_id',
        'amount_before_vat',
        'vat_rate',
        'vat_amount',
        'discount_amount',
        'total_amount',
        'acceptance_status',
        'input_invoice_status',
        'invoice_number',
        'reconciliation_result',
        'invoice_status',
        'invoice_recipient_type',
        'invoice_recipient_name',
        'reconciliation_note',
        'note',
        'reconciled_at',
        'reconciled_by',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'transaction_date' => 'date',
        'cid_is_dead' => 'boolean',
        'cid_spent_amount' => 'decimal:2',
        'amount_before_vat' => 'decimal:2',
        'vat_rate' => 'decimal:2',
        'vat_amount' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'reconciled_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(Quotation::class);
    }

    public function bankAccountOption(): BelongsTo
    {
        return $this->belongsTo(Option::class, 'bank_account_option_id');
    }

    public function partnerOption(): BelongsTo
    {
        return $this->belongsTo(Option::class, 'partner_option_id');
    }

    public function reconciledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reconciled_by');
    }

    public function adjustments(): HasMany
    {
        return $this->hasMany(ProjectCostAdjustment::class);
    }

    public function cashOutAmount(): float
    {
        return round((float) ($this->total_amount ?? 0) + $this->completedAdjustmentTotal(ProjectCostAdjustment::EXTRA_COST_TYPES), 2);
    }

    public function actualCostAmount(): float
    {
        if ($this->entry_type !== self::TYPE_AD_SPEND || ! $this->cid_is_dead) {
            return round((float) ($this->total_amount ?? 0), 2);
        }

        // Số dư của CID chỉ được hoàn lại hạn mức dự án sau khi kế toán
        // xác nhận đối soát. Trước thời điểm đó, toàn bộ tiền đã nạp vẫn
        // được giữ là chi phí đang chờ xác minh.
        if (! $this->reconciled_at) {
            return round((float) ($this->total_amount ?? 0), 2);
        }

        return round(max(0, (float) ($this->cid_spent_amount ?? 0)), 2);
    }

    public function originalBalanceAmount(): float
    {
        if ($this->entry_type !== self::TYPE_AD_SPEND || ! $this->cid_is_dead) {
            return 0.0;
        }

        return round(max(
            0,
            (float) ($this->total_amount ?? 0) - max(0, (float) ($this->cid_spent_amount ?? 0)),
        ), 2);
    }

    public function handledBalanceAmount(): float
    {
        return $this->reconciled_at
            ? $this->originalBalanceAmount()
            : 0.0;
    }

    public function remainingBalanceAmount(): float
    {
        return round(max(0, $this->originalBalanceAmount() - $this->handledBalanceAmount()), 2);
    }

    public function realizedCostAmount(): float
    {
        return round($this->actualCostAmount() + $this->completedAdjustmentTotal(ProjectCostAdjustment::EXTRA_COST_TYPES), 2);
    }

    public function balanceStatus(): string
    {
        if ($this->originalBalanceAmount() <= 0) {
            return 'none';
        }

        return $this->reconciled_at ? 'resolved' : 'pending';
    }

    private function completedAdjustmentTotal(array $types): float
    {
        $adjustments = $this->relationLoaded('adjustments')
            ? $this->adjustments
            : $this->adjustments()->get();

        return round((float) $adjustments
            ->where('status', ProjectCostAdjustment::STATUS_COMPLETED)
            ->whereIn('adjustment_type', $types)
            ->sum(fn (ProjectCostAdjustment $adjustment) => (float) ($adjustment->amount ?? 0)), 2);
    }
}

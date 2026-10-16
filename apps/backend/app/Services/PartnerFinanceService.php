<?php

namespace App\Services;

use App\Models\PartnerCostPayment;
use App\Models\Project;
use App\Models\ProjectCost;
use App\Models\Quotation;
use App\Repositories\ProjectCostRepository;
use App\Support\FinancialMutation;
use App\Support\PartnerFinance;
use App\Support\FinanceRecognitionSuggestion;
use App\Support\ProjectTopupBudgetCalculator;
use App\Support\QuotationFinancialBasis;
use App\Support\QuotationServiceRevenue;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Ramsey\Uuid\Uuid;

/** Management ledger for partner services. It never posts bank transactions or changes KPI policy. */
class PartnerFinanceService extends BaseService
{
    public function __construct(private readonly ProjectCostRepository $costs) {}

    private function fail(string $message): never
    {
        throw ValidationException::withMessages(['finance' => [$message]]);
    }

    private function canConfirm(Project $project): bool
    {
        $cost = new ProjectCost(['project_id' => $project->id]);
        $cost->setRelation('project', $project);

        return auth()->user()->can('approve', $cost) || auth()->user()->can('fund', $cost);
    }

    private function recognition(string $type, int $id): ?array
    {
        $row = DB::table('partner_finance_recognitions')->where('entity_type', $type)->where('entity_id', $id)->first();

        return $row ? $this->decode($row) : null;
    }

    private function decode(object $row): array
    {
        $data = (array) $row;
        $data['allocations'] = json_decode($row->allocations, true, flags: JSON_THROW_ON_ERROR);
        $data['amount'] = (float) $row->amount;

        return $data;
    }

    private function audit(string $type, string|int $id, string $action, mixed $before, mixed $after, string $reason): void
    {
        DB::table('partner_finance_audits')->insert([
            'entity_type' => $type, 'entity_id' => (string) $id, 'action' => $action,
            'before' => json_encode($before), 'after' => json_encode($after),
            'reason' => $reason, 'actor_id' => auth()->id(), 'created_at' => now(),
        ]);
    }

    private function source(string $type, int $id): ProjectCost|Quotation
    {
        $source = $type === 'cost' ? ProjectCost::query()->with('project')->findOrFail($id)
            : Quotation::query()->with(['project', 'items', 'paymentAllocations', 'paymentRefunds'])->findOrFail($id);
        $this->authorize('view', $source);
        abort_unless($source->project && $this->canConfirm($source->project), 403);
        if ($type === 'cost' && ($source->entry_type !== ProjectCost::TYPE_PARTNER_COST || $source->status === ProjectCost::STATUS_CANCELLED)) {
            $this->fail('Chỉ ghi nhận chi phí đối tác còn hiệu lực.');
        }
        if ($type === 'revenue' && $source->isVoided()) {
            $this->fail('Báo phí đã hủy.');
        }

        return $source;
    }

    public function revenueAmount(Quotation $quote): ?float
    {
        $data = QuotationServiceRevenue::calculate($quote, ProjectTopupBudgetCalculator::calculateQuotation($quote));
        if ($data['needsReview']) {
            return null;
        }
        // Refunds change the source value; an existing snapshot is flagged for explicit review.
        $gross = (float) $quote->subtotal_amount + (float) $quote->vat_amount;
        $serviceBefore = (float) $data['beforeVat'];
        $serviceGross = (float) $quote->items->filter(fn ($item) => ! QuotationFinancialBasis::excluded($item)
            && (string) $item->item_code !== '-1' && ! QuotationFinancialBasis::isBudgetItem($quote, $item))
            ->sum(fn ($item) => QuotationFinancialBasis::gross($item));
        $refundGross = 0;
        foreach ($quote->paymentRefunds->where('status', 'completed')->where('refund_type', 'payment') as $refund) {
            $split = $refund->service_fee_refund_amount !== null || $refund->budget_refund_amount !== null;
            $refundGross += $split ? (float) $refund->service_fee_refund_amount
                : ($gross > 0 ? (float) $refund->amount * $serviceGross / $gross : 0);
        }

        return round(max(0, $serviceBefore - ($serviceGross > 0 ? $refundGross * $serviceBefore / $serviceGross : 0)), 2);
    }

    public function confirm(string $type, int $id, array $data): array
    {
        return FinancialMutation::run(function () use ($type, $id, $data): array {
            $source = $this->source($type, $id);
            $old = $this->recognition($type, $id);
            if ((int) ($data['revision'] ?? 0) !== (int) ($old['revision'] ?? 0)) {
                $this->fail('Dữ liệu đã thay đổi. Tải lại trước khi xác nhận.');
            }
            $amount = $type === 'cost' ? (float) $source->total_amount : $this->revenueAmount($source);
            if ($amount === null || $amount < 0 || ($type === 'cost' && $amount === 0.0)) {
                $this->fail('Nguồn chưa có giá trị dịch vụ hợp lệ. Cần đối soát trước khi ghi nhận.');
            }
            $allocations = PartnerFinance::allocations($data['allocations'], $amount);
            PartnerFinance::assertOpen(array_merge(array_column($allocations, 'period'), array_column($old['allocations'] ?? [], 'period')));
            if ($type === 'cost' && ! $source->uses_payment_ledger) {
                if ($source->status === ProjectCost::STATUS_COMPLETED) {
                    if (! $source->transaction_date) {
                        $this->fail('Khoản cũ thiếu ngày chi. Bổ sung ngày chi thật trước khi đối soát.');
                    }
                    // Import a baseline only; no bank payment is executed and no date is rewritten.
                    PartnerCostPayment::create(['project_cost_id' => $id, 'request_id' => (string) Str::uuid(),
                        'paid_on' => $source->transaction_date, 'amount' => $source->total_amount,
                        'reference' => 'Đối soát khoản đã chi trước đây', 'is_legacy' => true, 'created_by' => auth()->id()]);
                }
                $source->uses_payment_ledger = true;
                $source->save();
            }
            $values = ['project_id' => $source->project_id, 'allocations' => json_encode($allocations),
                'amount' => $amount, 'revision' => (int) DB::table('partner_finance_audits')->where('entity_type', $type)->where('entity_id', (string) $id)->count() + 1,
                'confirmed_by' => auth()->id(), 'updated_at' => now()];
            if (! $old) {
                $values['created_at'] = now();
            }
            DB::table('partner_finance_recognitions')->updateOrInsert(['entity_type' => $type, 'entity_id' => $id], $values);
            $new = $this->recognition($type, $id);
            $this->audit($type, $id, $old ? 'adjust' : 'confirm', $old, $new, $data['reason']);

            return $new;
        });
    }

    public function unconfirm(string $type, int $id, array $data): array
    {
        return FinancialMutation::run(function () use ($type, $id, $data): array {
            $this->source($type, $id);
            $old = $this->recognition($type, $id);
            if (! $old || (int) $data['revision'] !== (int) $old['revision']) {
                $this->fail('Dữ liệu đã thay đổi. Tải lại trước khi điều chỉnh.');
            }
            PartnerFinance::assertOpen(array_column($old['allocations'], 'period'));
            DB::table('partner_finance_recognitions')->where('id', $old['id'])->delete();
            $this->audit($type, $id, 'unconfirm', $old, null, $data['reason']);

            return ['message' => 'Đã gỡ ghi nhận; lịch sử và các khoản thanh toán được giữ lại.'];
        });
    }

    public function pay(int $id, array $data): array
    {
        return FinancialMutation::run(function () use ($id, $data): array {
            $cost = ProjectCost::query()->with(['project', 'partnerPayments'])->lockForUpdate()->findOrFail($id);
            $this->authorize('fund', $cost);
            if ($cost->entry_type !== ProjectCost::TYPE_PARTNER_COST || $cost->status === ProjectCost::STATUS_CANCELLED || ! $cost->uses_payment_ledger) {
                $this->fail('Cần xác nhận chi phí đối tác trước khi ghi thanh toán.');
            }
            if ($cost->reconciled_at) {
                $this->fail('Khoản đã đối soát khớp không thể thêm thanh toán.');
            }
            $existing = PartnerCostPayment::where('request_id', $data['requestId'])->first();
            if ($existing) {
                if ((int) $existing->project_cost_id !== $id || PartnerFinance::cents($existing->amount) !== PartnerFinance::cents($data['amount'])
                    || $existing->paid_on->toDateString() !== $data['paidOn']) {
                    $this->fail('Mã yêu cầu đã được dùng cho một thanh toán khác.');
                }

                return ['id' => $existing->id];
            }
            if (! $this->recognition('cost', $id)) {
                $this->fail('Cần xác nhận kỳ ghi nhận chi phí trước.');
            }
            PartnerFinance::assertOpen([substr($data['paidOn'], 0, 7)]);
            $remaining = PartnerFinance::cents($cost->total_amount) - PartnerFinance::cents($cost->partnerPaidAmount());
            if (PartnerFinance::cents($data['amount']) <= 0 || PartnerFinance::cents($data['amount']) > $remaining) {
                $this->fail('Số tiền vượt công nợ còn phải trả.');
            }
            $payment = PartnerCostPayment::create(['project_cost_id' => $id, 'request_id' => $data['requestId'],
                'paid_on' => $data['paidOn'], 'amount' => $data['amount'], 'reference' => $data['reference'] ?? null,
                'note' => $data['note'] ?? null, 'created_by' => auth()->id()]);
            $this->syncPaidStatus($cost);
            $this->audit('cost', $id, 'payment', null, $payment->toArray(), $data['note'] ?? 'Ghi nhận thanh toán');

            return ['id' => $payment->id];
        });
    }

    private function syncPaidStatus(ProjectCost $cost): void
    {
        $cost->load('partnerPayments');
        $paid = $cost->partnerPaidAmount();
        $cost->status = PartnerFinance::cents($paid) >= PartnerFinance::cents($cost->total_amount) ? 'completed' : 'pending';
        $cost->transaction_date = $cost->partnerPayments->whereNull('voided_at')->max('paid_on');
        $statusChanged = $cost->isDirty('status');
        $cost->save();
        if ($statusChanged) {
            app(ProjectCostsService::class)->notifyCostWorkflow($cost);
        }
    }

    public function payBatch(array $data): array
    {
        return FinancialMutation::run(function () use ($data): array {
            $parts = collect($data['allocations'])->sortBy('costId')->values();
            $hash = hash('sha256', json_encode([$parts->all(), $data['paidOn'], $data['reference'] ?? null, $data['note'], auth()->id()]));
            $key = substr(hash('sha256', $data['requestId']), 0, 30);
            $previous = DB::table('partner_finance_audits')->where('entity_type', 'batch')->where('entity_id', $key)->first();
            // Authorize every source even on a retry after permissions have changed.
            $costs = ProjectCost::with('project')->whereIn('id', $parts->pluck('costId'))->get();
            if ($costs->count() !== $parts->count()) {
                $this->fail('Có khoản chi không còn tồn tại.');
            }
            foreach ($costs as $cost) {
                $this->authorize('fund', $cost);
            }
            if ($costs->count() > 1 && ($costs->contains(fn ($cost) => ! $cost->partner_option_id) || $costs->pluck('partner_option_id')->unique()->count() !== 1)) {
                $this->fail('Một lần thanh toán chỉ phân bổ cho cùng một đối tác.');
            }
            if ($previous) {
                $result = json_decode($previous->after, true, flags: JSON_THROW_ON_ERROR);
                if (! hash_equals($result['hash'], $hash)) {
                    $this->fail('Yêu cầu thanh toán đã được ghi với nội dung khác. Tải lại để đối soát.');
                }

                return $result;
            }
            $ids = [];
            foreach ($parts as $part) {
                $payment = $this->pay((int) $part['costId'], array_merge($data, ['amount' => $part['amount'],
                    'requestId' => (string) Uuid::uuid5(Uuid::NAMESPACE_URL, $data['requestId'].':'.$part['costId'])]));
                $ids[] = $payment['id'];
            }
            $result = ['hash' => $hash, 'ids' => $ids];
            $this->audit('batch', $key, 'payment_batch', null, $result, $data['note']);

            return $result;
        });
    }

    public function voidPayment(int $id, int $paymentId, string $reason): array
    {
        return FinancialMutation::run(function () use ($id, $paymentId, $reason): array {
            $cost = ProjectCost::query()->with('project')->lockForUpdate()->findOrFail($id);
            $this->authorize('fund', $cost);
            if ($cost->reconciled_at) {
                $this->fail('Khoản đã đối soát khớp không thể hủy thanh toán.');
            }
            $payment = PartnerCostPayment::where('project_cost_id', $id)->findOrFail($paymentId);
            if ($payment->voided_at) {
                return ['message' => 'Thanh toán đã được hủy.'];
            }
            PartnerFinance::assertOpen([$payment->paid_on->format('Y-m')]);
            if ($payment->is_legacy) {
                $this->fail('Khoản nhập từ lịch sử chỉ dùng đối soát, không được hủy trong sổ mới.');
            }
            $before = $payment->toArray();
            $payment->update(['voided_at' => now(), 'voided_by' => auth()->id(), 'void_reason' => $reason]);
            $this->syncPaidStatus($cost);
            $this->audit('cost', $id, 'void_payment', $before, $payment->toArray(), $reason);

            return ['message' => 'Đã hủy ghi nhận thanh toán.'];
        });
    }

    public function period(string $period, bool $locked, string $reason): array
    {
        abort_unless(auth()->user()->isAdmin(), 403);

        return FinancialMutation::run(function () use ($period, $locked, $reason): array {
            $before = DB::table('partner_finance_periods')->where('period', $period)->first();
            DB::table('partner_finance_periods')->updateOrInsert(['period' => $period], [
                'locked_at' => $locked ? now() : null, 'locked_by' => $locked ? auth()->id() : null,
                'created_at' => $before?->created_at ?? now(), 'updated_at' => now(),
            ]);
            $this->audit('period', $period, $locked ? 'lock' : 'unlock', $before, ['locked' => $locked], $reason);

            return ['locked' => $locked];
        });
    }

    private function suggestion(ProjectCost|Quotation $source, ?float $amount, ?array $recognition, $topups, $quotes, array $locked): array
    {
        if ($recognition) {
            $valid = $amount !== null && PartnerFinance::cents($amount) === PartnerFinance::cents($recognition['amount'])
                && PartnerFinance::cents(collect($recognition['allocations'])->sum('amount')) === PartnerFinance::cents($amount);
            return FinanceRecognitionSuggestion::result($valid ? 'confirmed' : 'review', $valid ? 'Đã ghi nhận' : 'Giá trị nguồn thay đổi; cần xác nhận lại.');
        }
        if ($amount === null) return FinanceRecognitionSuggestion::result('review', 'Cần kiểm tra cơ cấu ngân sách/phí dịch vụ.');
        if ($amount <= 0) return FinanceRecognitionSuggestion::result('excluded', 'Không có giá trị cần ghi nhận.');
        $result = $source instanceof ProjectCost ? FinanceRecognitionSuggestion::cost($source)
            : FinanceRecognitionSuggestion::revenue($source, $amount, $topups, $quotes);
        if ($result['status'] === 'ready') {
            $periods = array_column($result['allocations'], 'period');
            if (array_intersect($periods, $locked)) $result = FinanceRecognitionSuggestion::result('review', 'Kỳ đề xuất đã chốt; cần kiểm tra trước khi ghi nhận.', $result['allocations']);
            elseif (max($periods) > now(config('app.timezone'))->format('Y-m')) $result = FinanceRecognitionSuggestion::result('waiting', 'Chưa đến kỳ công việc.', $result['allocations']);
        }
        $result['fingerprint'] = hash('sha256', json_encode([$source->getTable(), $source->id, (string) $source->updated_at, $amount, $result], JSON_THROW_ON_ERROR));
        return $result;
    }

    public function confirmBatch(array $data): array
    {
        return FinancialMutation::run(function () use ($data): array {
            $items = collect($data['items'])->sortBy(fn ($r) => $r['type'].':'.$r['id'])->values();
            if ($items->unique(fn ($r) => $r['type'].':'.$r['id'])->count() !== $items->count()) $this->fail('Danh sách có khoản bị trùng.');
            // Recheck source authorization even for retries; never trust UI selection/scope.
            foreach ($items as $item) $this->source($item['type'], (int) $item['id']);
            $hash = hash('sha256', json_encode([$data['period'], $items->all(), $data['reason'], auth()->id()]));
            $key = substr(hash('sha256', $data['requestId']), 0, 30);
            $previous = DB::table('partner_finance_audits')->where('entity_type', 'recognition_batch')->where('entity_id', $key)->first();
            if ($previous) {
                $result = json_decode($previous->after, true, flags: JSON_THROW_ON_ERROR);
                if (!hash_equals($result['hash'], $hash)) $this->fail('Mã yêu cầu đã dùng với danh sách khác.');
                return $result;
            }
            $available = [];
            foreach ($this->report($data['period'])['rows'] as $project) {
                foreach (['costs' => 'cost', 'quotations' => 'revenue'] as $group => $type) {
                    foreach ($project[$group] as $row) $available[$type.':'.$row['id']] = $row['suggestion'];
                }
            }
            foreach ($items as $item) {
                $proposal = $available[$item['type'].':'.$item['id']] ?? null;
                if (!$proposal || $proposal['status'] !== 'ready' || !hash_equals($proposal['fingerprint'], $item['fingerprint'])
                    || !in_array($data['period'], array_column($proposal['allocations'], 'period'), true)) {
                    $this->fail('Có khoản đã thay đổi hoặc không còn đủ điều kiện. Tải lại danh sách để kiểm tra; chưa ghi nhận khoản nào.');
                }
            }
            foreach ($items as $item) {
                $proposal = $available[$item['type'].':'.$item['id']];
                $this->confirm($item['type'], (int) $item['id'], ['revision' => 0,
                    'allocations' => $proposal['allocations'], 'reason' => $data['reason'].' · '.$proposal['reason']]);
            }
            $result = ['count' => $items->count(), 'hash' => $hash];
            $this->audit('recognition_batch', $key, 'confirm_batch', null, $result, $data['reason']);
            return $result;
        });
    }

    public function report(string $period): array
    {
        $user = auth()->user();
        // Reuse the centralized cost visibility rules; never infer scope from a posted project ID.
        $costs = $this->costs->financeCosts($user);
        $projects = $costs->pluck('project')->filter()->unique('id')->keyBy('id');
        // Revenue can be recognized even when a project has no partner cost yet.
        $revenueProjects = app(\App\Repositories\ProjectRepository::class)->findAll([], $user)
            ->filter(fn ($project) => $this->canConfirm($project));
        $revenueProjects->load(['quotations.items', 'quotations.paymentAllocations.payment', 'quotations.paymentRefunds', 'quotations.project']);
        $projects = $projects->union($revenueProjects->keyBy('id'));
        $topups = ProjectCost::whereIn('project_id', $projects->keys())->where('entry_type', ProjectCost::TYPE_AD_SPEND)
            ->where('status', '!=', ProjectCost::STATUS_CANCELLED)->with(['project', 'cidIncident'])->get();
        $lockedPeriods = DB::table('partner_finance_periods')->whereNotNull('locked_at')->pluck('period')->all();
        $records = DB::table('partner_finance_recognitions')->whereIn('project_id', $projects->keys())->get()->map(fn ($row) => $this->decode($row));
        $costCounts = ProjectCost::whereIn('project_id', $projects->keys())
            ->where('entry_type', ProjectCost::TYPE_PARTNER_COST)->where('status', '!=', ProjectCost::STATUS_CANCELLED)
            ->selectRaw('project_id, count(*) as count')->groupBy('project_id')->pluck('count', 'project_id');
        $rows = [];
        foreach ($projects as $project) {
            $projectCosts = $costs->where('project_id', $project->id);
            $projectRecords = $records->where('project_id', $project->id);
            $quotes = $project->quotations->filter(fn ($q) => ! $q->isVoided() && $user->can('view', $q));
            $costIds = $projectCosts->pluck('id');
            $quoteIds = $quotes->pluck('id');
            $recognizedCost = 0;
            $revenue = 0;
            foreach ($projectRecords as $record) {
                if ($record['entity_type'] === 'cost' && ! $costIds->contains($record['entity_id'])) {
                    continue;
                }
                if ($record['entity_type'] === 'revenue' && ! $quoteIds->contains($record['entity_id'])) {
                    continue;
                }
                foreach ($record['allocations'] as $allocation) {
                    if ($allocation['period'] !== $period) {
                        continue;
                    }
                    if ($record['entity_type'] === 'cost') {
                        $recognizedCost += $allocation['amount'];
                    } else {
                        $revenue += $allocation['amount'];
                    }
                }
            }
            $projectTopups = $topups->where('project_id', $project->id);
            $canSeeTopups = $projectTopups->every(fn ($c) => $user->can('view', $c));
            $quoteRows = $quotes->map(function ($q) use ($projectRecords, $projectTopups, $project, $lockedPeriods, $canSeeTopups) {
                $amount = $this->revenueAmount($q);
                $recognition = $projectRecords->first(fn ($r) => $r['entity_type'] === 'revenue' && $r['entity_id'] === $q->id);

                return ['id' => $q->id, 'code' => $q->quotation_code, 'amount' => $amount, 'recognition' => $recognition,
                    'suggestion' => $canSeeTopups ? $this->suggestion($q, $amount, $recognition, $projectTopups, $project->quotations, $lockedPeriods)
                        : FinanceRecognitionSuggestion::result('review', 'Cần người có quyền xem đầy đủ lần nạp kiểm tra.'),
                    'needsReview' => $amount === null || ($recognition && PartnerFinance::cents($amount) !== PartnerFinance::cents($recognition['amount']))];
            })->values();
            $costRows = $projectCosts->map(function ($cost) use ($projectRecords, $user, $lockedPeriods) {
                return ['id' => $cost->id, 'partner' => $cost->partnerOption?->label ?? 'Chưa chọn đối tác',
                    'partnerId' => $cost->partner_option_id,
                    'quotationId' => $cost->quotation_id, 'workPeriod' => $cost->work_period?->format('Y-m'),
                    'amount' => (float) $cost->total_amount, 'paid' => $cost->partnerPaidAmount(),
                    'remaining' => max(0, round((float) $cost->total_amount - $cost->partnerPaidAmount(), 2)),
                    'suggestion' => $this->suggestion($cost, (float) $cost->total_amount, $projectRecords->first(fn ($r) => $r['entity_type'] === 'cost' && $r['entity_id'] === $cost->id), collect(), collect(), $lockedPeriods),
                    'usesLedger' => (bool) $cost->uses_payment_ledger, 'paidOn' => $cost->transaction_date?->toDateString(),
                    'canFund' => $user->can('fund', $cost), 'reconciled' => (bool) $cost->reconciled_at,
                    'recognition' => $projectRecords->first(fn ($r) => $r['entity_type'] === 'cost' && $r['entity_id'] === $cost->id),
                    'payments' => $cost->partnerPayments->map(fn ($p) => ['id' => $p->id, 'amount' => (float) $p->amount,
                        'paidOn' => $p->paid_on->toDateString(), 'reference' => $p->reference, 'voided' => (bool) $p->voided_at,
                        'legacy' => $p->is_legacy, 'voidReason' => $p->void_reason])->values(),
                ];
            })->values();
            $paidInPeriod = $projectCosts->sum(function ($cost) use ($period) {
                if (! $cost->uses_payment_ledger) {
                    return $cost->status === 'completed' && $cost->transaction_date?->format('Y-m') === $period ? (float) $cost->total_amount : 0;
                }

                return $cost->partnerPayments->filter(fn ($p) => ! $p->voided_at && $p->paid_on->format('Y-m') === $period)->sum('amount');
            });
            $suggestions = $costRows->concat($quoteRows)->pluck('suggestion');
            $reviewCount = $suggestions->where('status', 'review')->count();
            $receivedInPeriod = $quotes->sum(fn ($quote) => $quote->paymentAllocations->filter(function ($allocation) use ($period) {
                $at = $allocation->payment?->transaction_at ?: $allocation->payment?->transaction_date ?: $allocation->allocated_at ?: $allocation->created_at;

                return $at && CarbonImmutable::parse($at)->format('Y-m') === $period;
            })->sum('amount'));
            $rows[] = ['id' => $project->id, 'code' => $project->project_code, 'name' => $project->project_name,
                'partialScope' => $projectCosts->count() < ($costCounts[$project->id] ?? 0)
                    || $quotes->count() < $project->quotations->filter(fn ($q) => ! $q->isVoided())->count(),
                'revenue' => round($revenue, 2), 'cost' => round($recognizedCost, 2), 'profit' => round($revenue - $recognizedCost, 2),
                'paidInPeriod' => round($paidInPeriod, 2), 'receivedInPeriod' => round($receivedInPeriod, 2),
                'payable' => round($costRows->filter(fn ($r) => $r['recognition'])->sum('remaining'), 2),
                'unconfirmedPayable' => round($costRows->filter(fn ($r) => ! $r['recognition'])->sum('remaining'), 2),
                'readyCount' => $suggestions->where('status', 'ready')->count(), 'waitingCount' => $suggestions->where('status', 'waiting')->count(),
                'reviewCount' => $reviewCount, 'canConfirm' => $this->canConfirm($project), 'costs' => $costRows, 'quotations' => $quoteRows];
        }

        return ['period' => $period, 'locked' => DB::table('partner_finance_periods')->where('period', $period)->whereNotNull('locked_at')->exists(),
            'canLock' => $user->isAdmin(), 'rows' => $rows];
    }

    public function history(string $type, int $id): array
    {
        $source = $type === 'cost' ? ProjectCost::findOrFail($id) : Quotation::findOrFail($id);
        $this->authorize('view', $source);

        return DB::table('partner_finance_audits as a')->leftJoin('users as u', 'u.id', '=', 'a.actor_id')
            ->where('a.entity_type', $type)->where('a.entity_id', (string) $id)->orderByDesc('a.id')
            ->get(['a.action', 'a.reason', 'a.before', 'a.after', 'a.created_at', 'u.name as actor'])->all();
    }
}

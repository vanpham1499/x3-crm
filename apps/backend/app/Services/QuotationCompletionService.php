<?php

namespace App\Services;

use App\Models\{Quotation, ProjectCost};
use App\Support\{FinanceRecognitionSuggestion, FinancialMutation, PartnerFinance};
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class QuotationCompletionService
{
    public static function canEdit(Quotation $quote): bool
    {
        $user = auth()->user();
        if (!$user || $quote->isVoided() || !$user->can('view', $quote)) return false;
        $cost = new ProjectCost(['project_id' => $quote->project_id]);
        $cost->setRelation('project', $quote->project);
        return $user->can('update', $quote) || $user->can('manage', $cost) || $user->can('approve', $cost) || $user->can('fund', $cost);
    }

    public function update(int $id, array $data): array
    {
        return FinancialMutation::run(function () use ($id, $data): array {
            $quote = Quotation::with(['project', 'service'])->lockForUpdate()->findOrFail($id);
            abort_unless(self::canEdit($quote), 403);
            abort_unless(FinanceRecognitionSuggestion::requiresCompletion($quote), 422, 'Chỉ áp dụng tháng hoàn thành cho DV3.');
            $before = $quote->work_completed_period?->format('Y-m');
            if ($before !== $data['expectedPeriod']) throw ValidationException::withMessages(['period' => 'Dữ liệu đã thay đổi. Tải lại báo phí trước khi sửa.']);
            $reason = trim($data['reason'] ?? '');
            if ($before && mb_strlen($reason) < 3) throw ValidationException::withMessages(['reason' => 'Nhập lý do điều chỉnh tháng hoàn thành.']);
            $data['reason'] = $reason ?: 'Xác nhận tháng hoàn thành lần đầu';
            PartnerFinance::protectSource('revenue', $id);
            PartnerFinance::assertOpen(array_filter([$before, $data['period']]));
            if ($data['period'] > now(config('app.timezone'))->format('Y-m')) throw ValidationException::withMessages(['period' => 'Chưa thể xác nhận hoàn thành trong tháng tương lai.']);
            $quote->work_completed_period = $data['period'] ? $data['period'].'-01' : null;
            $quote->updated_by = auth()->id();
            $quote->save();
            DB::table('partner_finance_audits')->insert(['entity_type' => 'revenue', 'entity_id' => $id,
                'action' => 'work_completion', 'before' => json_encode(['period' => $before]),
                'after' => json_encode(['period' => $data['period']]), 'reason' => $data['reason'],
                'actor_id' => auth()->id(), 'created_at' => now()]);
            return ['workCompletedPeriod' => $data['period']];
        });
    }
}

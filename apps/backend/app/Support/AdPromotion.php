<?php

namespace App\Support;

use App\Models\Option;
use App\Models\ProjectCost;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

final class AdPromotion
{
    public static function prepare(array $data, ?ProjectCost $existing): array
    {
        $source = $data['funding_source'] ?? 'cash';
        $fail = fn ($field, $message) => throw ValidationException::withMessages([$field => [$message]]);
        if (! in_array($source, ['cash', 'promotion'], true)) {
            $fail('fundingSource', 'Nguồn ngân sách không hợp lệ.');
        }
        if ($existing && $source !== ($existing->funding_source ?? 'cash')) {
            $fail('fundingSource', 'Không đổi nguồn của khoản cũ. Cần đối soát riêng để bảo toàn lịch sử tiền.');
        }
        if ($source !== 'promotion') {
            if (! empty($data['bank_account_option_id']) && (! $existing || (string) $existing->bank_account_option_id !== (string) $data['bank_account_option_id'])) {
                $card = Option::find($data['bank_account_option_id']);
                if (strtoupper(trim((string) $card?->label)) === 'MKM') {
                    $fail('fundingSource', 'Thẻ MKM cũ chỉ dùng đối soát lịch sử. Chọn nguồn Mã khuyến mãi để ghi khoản mới.');
                }
            }
            foreach (['promotion_code', 'promotion_expires_on', 'promotion_evidence_url'] as $field) {
                $data[$field] = null;
            }
            $data['promotion_used_amount'] = $data['promotion_revoked_amount'] = 0;

            return $data;
        }
        if ($data['entry_type'] !== ProjectCost::TYPE_AD_SPEND) {
            $fail('fundingSource', 'MKM chỉ dùng cho ngân sách quảng cáo.');
        }
        $data['cid'] = trim((string) ($data['cid'] ?? ''));
        if ($existing && ((string) $existing->project_id !== (string) $data['project_id'] || $existing->cid !== $data['cid'])) {
            $fail('cid', 'MKM đã lưu không được chuyển sang dự án hoặc CID khác.');
        }
        $data['promotion_code'] = trim((string) ($data['promotion_code'] ?? ''));
        if (! $data['promotion_code'] || empty($data['cid'])) {
            $fail('promotionCode', 'Nhập mã hoặc tên ưu đãi và CID được cấp.');
        }
        if ((float) $data['total_amount'] <= 0) {
            $fail('amountBeforeVat', 'Giá trị MKM phải lớn hơn 0.');
        }
        $used = (float) ($data['promotion_used_amount'] ?? 0);
        $revoked = (float) ($data['promotion_revoked_amount'] ?? 0);
        if ($used < 0 || $revoked < 0 || round($used + $revoked, 2) > (float) $data['total_amount']) {
            $fail('promotionUsedAmount', 'Đã dùng và thu hồi không được vượt giá trị MKM.');
        }
        if ($data['status'] !== 'completed' && ($used > 0 || $revoked > 0)) {
            $fail('status', 'Khoản đã dùng/thu hồi phải giữ trạng thái Đã cấp để bảo toàn lịch sử.');
        }
        if ($data['status'] === 'completed' && (empty($data['transaction_date']) || empty($data['promotion_evidence_url']))) {
            $fail('promotionEvidenceUrl', 'Bổ sung ngày được cấp và ảnh xác nhận trước khi xác nhận MKM.');
        }
        $date = ! empty($data['transaction_date']) ? CarbonImmutable::parse($data['transaction_date'])->toDateString() : null;
        if ($data['status'] === 'completed' && $date > now('Asia/Ho_Chi_Minh')->toDateString()) {
            $fail('transactionDate', 'Ngày được cấp không được ở tương lai.');
        }
        if (! empty($data['promotion_expires_on']) && $date && CarbonImmutable::parse($data['promotion_expires_on'])->toDateString() < $date) {
            $fail('promotionExpiresOn', 'Hạn sử dụng không được trước ngày cấp.');
        }
        if (ProjectCost::where('funding_source', 'promotion')->where('cid', $data['cid'])
            ->where('promotion_code', $data['promotion_code'])->where('status', '!=', 'cancelled')
            ->when($existing, fn ($q) => $q->where('id', '!=', $existing->id))->exists() && $data['status'] !== 'cancelled') {
            $fail('promotionCode', 'MKM này đã được ghi cho CID. Kiểm tra khoản hiện có để tránh ghi trùng.');
        }
        if ($existing?->status === 'completed') {
            if ($used < (float) $existing->promotion_used_amount || $revoked < (float) $existing->promotion_revoked_amount) {
                $fail('promotionUsedAmount', 'Không giảm số đã dùng hoặc đã thu hồi. Cần đối soát lịch sử trước khi điều chỉnh sai lệch.');
            }
        }
        if (($data['cid_is_dead'] ?? false) || (float) ($data['cid_refunded_amount'] ?? 0) > 0) {
            $fail('cidIsDead', 'MKM không hoàn thành tiền; cập nhật giá trị thu hồi riêng.');
        }
        $data['bank_account_option_id'] = null;
        $data['promotion_used_amount'] = $used;
        $data['promotion_revoked_amount'] = $revoked;
        $fields = ['status', 'total_amount', 'promotion_code', 'transaction_date', 'promotion_expires_on', 'promotion_used_amount', 'promotion_revoked_amount', 'promotion_evidence_url'];
        $history = $existing?->promotion_history ?? [];
        $history[] = ['at' => now()->toISOString(), 'actor' => auth()->user()?->name, 'actorId' => auth()->id(),
            'before' => $existing ? $existing->only($fields) : null, 'after' => array_intersect_key($data, array_flip($fields)), 'note' => $data['note'] ?? null];
        $data['promotion_history'] = $history;

        return $data;
    }
}

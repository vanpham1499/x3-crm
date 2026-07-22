<?php

namespace App\Http\Requests\ProjectCosts;

use App\Http\Requests\BaseRequest;
use App\Models\Option;
use App\Models\ProjectCost;
use Illuminate\Validation\Rule;

class CreateProjectCostRequest extends BaseRequest
{
    public function rules(): array
    {
        $topupCardExists = Rule::exists('options', 'id')
            ->where(fn ($query) => $query
                ->whereIn('group', [Option::GROUP_AD_TOPUP_CARD, 'company_bank_account'])
                ->whereNull('deleted_at'));
        $partnerExists = Rule::exists('options', 'id')
            ->where(fn ($query) => $query->where('group', 'project_partner')->whereNull('deleted_at'));

        return [
            'project_id' => ['required_without:projectId', 'integer', Rule::exists('projects', 'id')->whereNull('deleted_at')],
            'projectId' => ['required_without:project_id', 'integer', Rule::exists('projects', 'id')->whereNull('deleted_at')],
            'quotation_id' => ['nullable', 'integer', Rule::exists('quotations', 'id')->whereNull('deleted_at')],
            'quotationId' => ['nullable', 'integer', Rule::exists('quotations', 'id')->whereNull('deleted_at')],
            'entry_type' => ['required_without:entryType', Rule::in([ProjectCost::TYPE_AD_SPEND, ProjectCost::TYPE_PARTNER_COST])],
            'entryType' => ['required_without:entry_type', Rule::in([ProjectCost::TYPE_AD_SPEND, ProjectCost::TYPE_PARTNER_COST])],
            'transaction_date' => ['nullable', 'date'],
            'transactionDate' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in([ProjectCost::STATUS_PENDING, ProjectCost::STATUS_COMPLETED, ProjectCost::STATUS_CANCELLED])],
            'cid' => ['nullable', 'string', 'max:100'],
            'ad_account' => ['nullable', 'string', 'max:255'],
            'adAccount' => ['nullable', 'string', 'max:255'],
            'cid_is_dead' => ['nullable', 'boolean'],
            'cidIsDead' => ['nullable', 'boolean'],
            'cid_spent_amount' => ['nullable', 'numeric', 'min:0'],
            'cidSpentAmount' => ['nullable', 'numeric', 'min:0'],
            'bank_account_option_id' => ['nullable', 'integer', $topupCardExists],
            'bankAccountOptionId' => ['nullable', 'integer', $topupCardExists],
            'partner_option_id' => ['nullable', 'integer', $partnerExists],
            'partnerOptionId' => ['nullable', 'integer', $partnerExists],
            'amount_before_vat' => ['nullable', 'numeric', 'min:0'],
            'amountBeforeVat' => ['nullable', 'numeric', 'min:0'],
            'vat_rate' => ['nullable', 'numeric', 'min:0'],
            'vatRate' => ['nullable', 'numeric', 'min:0'],
            'vat_amount' => ['nullable', 'numeric', 'min:0'],
            'vatAmount' => ['nullable', 'numeric', 'min:0'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'discountAmount' => ['nullable', 'numeric', 'min:0'],
            'total_amount' => ['nullable', 'numeric', 'min:0'],
            'totalAmount' => ['nullable', 'numeric', 'min:0'],
            'acceptance_status' => ['nullable', Rule::in(['pending', 'accepted', 'not_required'])],
            'acceptanceStatus' => ['nullable', Rule::in(['pending', 'accepted', 'not_required'])],
            'input_invoice_status' => ['nullable', Rule::in(['pending', 'received', 'not_required'])],
            'inputInvoiceStatus' => ['nullable', Rule::in(['pending', 'received', 'not_required'])],
            'note' => ['nullable', 'string'],
        ];
    }
}

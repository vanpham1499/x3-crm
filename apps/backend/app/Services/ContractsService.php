<?php

namespace App\Services;

use App\Http\Resources\ContractResource;
use App\Models\Contract;
use App\Repositories\ContractRepository;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ContractsService extends BaseService
{
    public function __construct(private readonly ContractRepository $contracts) {}

    public function findAll(array $filters = [])
    {
        return $this->apiCollection($this->contracts->findAll($this->normalizeKeys($filters)), ContractResource::class);
    }

    public function findOne(string $id): array
    {
        return $this->apiResource($this->contracts->findWithRelationsOrFail($id), ContractResource::class);
    }

    public function create(array $data): array
    {
        return $this->transaction(function () use ($data): array {
            $data = $this->normalizePayload($data);
            $this->authorizeProjectOwnership($data['project_id'] ?? null);

            /** @var Contract $contract */
            $contract = $this->contracts->create($data);
            $this->syncQuotationLinks($contract);

            return $this->apiResource($contract->load(['project', 'quotation', 'lead', 'customer', 'contractStatus', 'contractStatusOption']), ContractResource::class);
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            $existing = $this->contracts->findWithRelationsOrFail($id);
            $this->authorizeProjectOwnership($existing->project_id);
            /** @var Contract $contract */
            $contract = $this->contracts->update($id, $this->normalizePayload($data, $existing));
            $this->syncQuotationLinks($contract, $existing->quotation_id);

            return $this->apiResource($contract->load(['project', 'quotation', 'lead', 'customer', 'contractStatus', 'contractStatusOption']), ContractResource::class);
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            $contract = $this->contracts->findWithRelationsOrFail($id);
            $this->authorizeProjectOwnership($contract->project_id);
            $this->clearQuotationLinks($contract);
            $this->contracts->delete($id);

            return ['message' => 'Xóa hợp đồng thành công'];
        });
    }

    private function normalizePayload(array $data, ?Contract $existing = null): array
    {
        $data = $this->normalizeKeys($data);
        $projectId = $data['project_id'] ?? $existing?->project_id;
        $quotationId = array_key_exists('quotation_id', $data)
            ? $data['quotation_id']
            : $existing?->quotation_id;

        // Tiền cọc thuộc báo phí, không cho hợp đồng lưu một giá trị độc lập dễ bị lệch.
        unset($data['deposit_amount']);

        if ($projectId) {
            $project = DB::table('projects')->where('id', $projectId)->whereNull('deleted_at')->first();
            $data['customer_id'] = $data['customer_id'] ?? $existing?->customer_id ?? $project?->customer_id;
            $data['contract_no'] = $data['contract_no'] ?? $existing?->contract_no ?? $project?->project_code;
        }

        if (! empty($quotationId)) {
            $quotation = DB::table('quotations')->where('id', $quotationId)->whereNull('deleted_at')->first();

            if ($quotation?->project_id && (string) $quotation->project_id !== (string) $projectId) {
                throw ValidationException::withMessages([
                    'quotationId' => ['Báo phí không thuộc dự án này.'],
                ]);
            }

            $data['lead_id'] = $data['lead_id'] ?? $existing?->lead_id ?? $quotation?->lead_id;
            $data['customer_id'] = $data['customer_id'] ?? $quotation?->customer_id;
            $data['deposit_amount'] = $quotation?->deposit_amount ?? 0;
        } else {
            $data['deposit_amount'] = 0;
        }

        $modeProvided = array_key_exists('invoice_recipient_type', $data);
        $recipientType = $data['invoice_recipient_type'] ?? $existing?->invoice_recipient_type ?? 'customer';

        if (! $existing || $modeProvided) {
            $data['invoice_recipient_type'] = $recipientType;
        }

        if ($recipientType === 'customer' && (! $existing || $modeProvided || array_key_exists('customer_id', $data))) {
            $customer = ! empty($data['customer_id'])
                ? DB::table('customers')->where('id', $data['customer_id'])->whereNull('deleted_at')->first()
                : null;

            if ($customer) {
                $data['invoice_recipient_name'] = $customer->company_name ?: $customer->customer_name;
                $data['invoice_representative_name'] = $customer->representative_name;
                $data['invoice_tax_code'] = $customer->tax_code;
                $data['invoice_address'] = $customer->address;
                $data['invoice_email'] = $customer->invoice_email ?: $customer->email;
                $data['invoice_phone'] = $customer->phone;
            }
        }

        return $data;
    }

    private function normalizeKeys(array $data): array
    {
        $map = [
            'projectId' => 'project_id',
            'quotationId' => 'quotation_id',
            'leadId' => 'lead_id',
            'customerId' => 'customer_id',
            'contractNo' => 'contract_no',
            'contractStatusId' => 'contract_status_id',
            'contractStatusOptionId' => 'contract_status_option_id',
            'depositAmount' => 'deposit_amount',
            'signedDate' => 'signed_date',
            'expiredDate' => 'expired_date',
            'contractMonth' => 'contract_month',
            'fileUrl' => 'file_url',
            'invoiceRecipientType' => 'invoice_recipient_type',
            'invoiceRecipientName' => 'invoice_recipient_name',
            'invoiceRepresentativeName' => 'invoice_representative_name',
            'invoiceTaxCode' => 'invoice_tax_code',
            'invoiceAddress' => 'invoice_address',
            'invoiceEmail' => 'invoice_email',
            'invoicePhone' => 'invoice_phone',
        ];

        foreach ($map as $from => $to) {
            if (array_key_exists($from, $data)) {
                $data[$to] = $data[$from];
                unset($data[$from]);
            }
        }

        return $data;
    }

    private function syncQuotationLinks(Contract $contract, ?int $previousQuotationId = null): void
    {
        if ($previousQuotationId && (string) $previousQuotationId !== (string) $contract->quotation_id) {
            DB::table('quotations')
                ->where('id', $previousQuotationId)
                ->where('contract_id', $contract->id)
                ->update(['contract_id' => null, 'updated_at' => now()]);
            DB::table('payments')
                ->where('quotation_id', $previousQuotationId)
                ->where('contract_id', $contract->id)
                ->whereNull('deleted_at')
                ->update(['contract_id' => null, 'updated_at' => now()]);
        }

        if (! $contract->quotation_id) {
            return;
        }

        DB::table('quotations')->where('id', $contract->quotation_id)->update([
            'contract_id' => $contract->id,
            'updated_at' => now(),
        ]);
        DB::table('payments')
            ->where('quotation_id', $contract->quotation_id)
            ->whereNull('deleted_at')
            ->update([
                'contract_id' => $contract->id,
                'updated_at' => now(),
            ]);
    }

    private function clearQuotationLinks(Contract $contract): void
    {
        DB::table('quotations')
            ->where('contract_id', $contract->id)
            ->update(['contract_id' => null, 'updated_at' => now()]);
        DB::table('payments')
            ->where('contract_id', $contract->id)
            ->whereNull('deleted_at')
            ->update(['contract_id' => null, 'updated_at' => now()]);
    }
}

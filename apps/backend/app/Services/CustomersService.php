<?php

namespace App\Services;

use App\Http\Resources\CustomerResource;
use App\Models\Customer;
use App\Models\CustomerTimeline;
use App\Models\Lead;
use App\Models\Option;
use App\Models\User;
use App\Repositories\CustomerRepository;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class CustomersService extends BaseService
{
    public function __construct(private readonly CustomerRepository $customers) {}

    public function findAll(array $filters = [])
    {
        return $this->apiCollection($this->customers->findAll($this->normalizeKeys($filters)), CustomerResource::class);
    }

    public function findOne(string $id): array
    {
        return $this->apiResource($this->customers->findWithRelationsOrFail($id), CustomerResource::class);
    }

    public function create(array $data, bool $linkLead = true): array
    {
        return $this->transaction(function () use ($data, $linkLead): array {
            $data = $this->normalizePayload($data);
            $data['customer_code'] = $data['customer_code'] ?? $this->generateCustomerCode();
            $lead = $linkLead ? $this->lockLeadForConversion($data['lead_id'] ?? null) : null;

            /** @var Customer $customer */
            $customer = $this->customers->create($data);
            $customer = $this->loadCustomerRelations($customer);
            $this->recordTimeline($customer, 'create', $this->buildCreatedTimelineContent($customer));

            if ($lead) {
                $this->completeLeadConversion($lead, $customer);
            }

            return $this->apiResource($this->loadCustomerRelations($customer), CustomerResource::class);
        });
    }

    public function update(string $id, array $data): array
    {
        return $this->transaction(function () use ($id, $data): array {
            $data = $this->normalizePayload($data);
            $before = $this->loadCustomerRelations($this->customers->findWithRelationsOrFail($id));

            /** @var Customer $customer */
            $customer = $this->customers->update($id, $data);
            $customer = $this->loadCustomerRelations($customer);
            $changes = $this->describeCustomerChanges($before, $customer, $data);

            if ($changes !== []) {
                $this->recordTimeline($customer, 'update', $this->buildUpdatedTimelineContent($customer, $changes));
            }

            return $this->apiResource($this->loadCustomerRelations($customer), CustomerResource::class);
        });
    }

    public function remove(string $id): array
    {
        return $this->transaction(function () use ($id): array {
            $this->customers->delete($id);

            return ['message' => 'Xóa khách hàng thành công'];
        });
    }

    private function normalizePayload(array $data): array
    {
        $data = $this->normalizeKeys($data);

        if (array_key_exists('customer_code', $data) && ($data['customer_code'] === '' || $data['customer_code'] === null)) {
            unset($data['customer_code']);
        }

        foreach (['lead_id', 'customer_type_option_id', 'source_option_id', 'industry_option_id', 'sales_user_id'] as $key) {
            if (array_key_exists($key, $data) && $data[$key] === '') {
                unset($data[$key]);
            }
        }

        return $data;
    }

    private function normalizeKeys(array $data): array
    {
        $map = [
            'customerCode' => 'customer_code',
            'leadId' => 'lead_id',
            'customerName' => 'customer_name',
            'customerType' => 'customer_type',
            'customerTypeOptionId' => 'customer_type_option_id',
            'companyName' => 'company_name',
            'representativeName' => 'representative_name',
            'taxCode' => 'tax_code',
            'identityNo' => 'identity_no',
            'industryOptionId' => 'industry_option_id',
            'sourceOptionId' => 'source_option_id',
            'salesUserId' => 'sales_user_id',
        ];

        foreach ($map as $from => $to) {
            if (array_key_exists($from, $data)) {
                $data[$to] = $data[$from];
                unset($data[$from]);
            }
        }

        return $data;
    }

    private function loadCustomerRelations(Customer $customer): Customer
    {
        return $customer->load(['lead', 'customerTypeOption', 'sourceOption', 'industryOption', 'salesUser', 'projects', 'timelines.createdBy']);
    }

    private function lockLeadForConversion(mixed $leadId): ?Lead
    {
        if (! $leadId) {
            return null;
        }

        /** @var Lead|null $lead */
        $lead = Lead::query()->whereKey($leadId)->lockForUpdate()->first();

        if (! $lead) {
            throw new NotFoundHttpException('Lead không tồn tại');
        }

        $existingCustomer = Customer::query()->where('lead_id', $lead->id)->first();

        if ($lead->converted_customer_id || $existingCustomer) {
            throw new ConflictHttpException('Lead này đã được chuyển thành khách hàng');
        }

        return $lead;
    }

    private function completeLeadConversion(Lead $lead, Customer $customer): void
    {
        $lead->update([
            'converted_customer_id' => $customer->id,
            'closed_date' => $lead->closed_date?->toDateString() ?? now()->toDateString(),
        ]);

        $quotationIds = DB::table('quotations')
            ->where('lead_id', $lead->id)
            ->whereNull('deleted_at')
            ->pluck('id');

        DB::table('quotations')
            ->whereIn('id', $quotationIds)
            ->whereNull('customer_id')
            ->update([
                'customer_id' => $customer->id,
                'updated_at' => now(),
            ]);

        DB::table('payments')
            ->whereIn('quotation_id', $quotationIds)
            ->whereNull('customer_id')
            ->whereNull('deleted_at')
            ->update([
                'customer_id' => $customer->id,
                'updated_at' => now(),
            ]);

        CustomerTimeline::query()->create([
            'lead_id' => $lead->id,
            'customer_id' => $customer->id,
            'type' => 'convert',
            'content' => json_encode([
                'action' => 'convert_customer',
                'title' => 'Chuyển Lead thành khách hàng',
                'lead' => [
                    'id' => $lead->id,
                    'code' => $lead->lead_code,
                    'customerName' => $lead->customer_name,
                ],
                'customer' => [
                    'id' => $customer->id,
                    'code' => $customer->customer_code,
                    'customerName' => $customer->customer_name,
                ],
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'created_by' => $this->currentUser()?->id,
        ]);
    }

    private function recordTimeline(Customer $customer, string $type, array $content): void
    {
        $authUser = $this->currentUser();

        CustomerTimeline::query()->create([
            'customer_id' => $customer->id,
            'type' => $type,
            'content' => json_encode($content, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'created_by' => $authUser?->id,
        ]);
    }

    private function buildCreatedTimelineContent(Customer $customer): array
    {
        return $this->customerTimelinePayload('create', 'Tạo khách hàng', $customer);
    }

    private function buildUpdatedTimelineContent(Customer $customer, array $changes): array
    {
        return $this->customerTimelinePayload('update', 'Cập nhật khách hàng', $customer, [
            'changes' => $changes,
        ]);
    }

    private function customerTimelinePayload(string $action, string $title, Customer $customer, array $extra = []): array
    {
        $authUser = $this->currentUser();

        return array_merge([
            'action' => $action,
            'title' => $title,
            'customer' => [
                'id' => $customer->id,
                'code' => $customer->customer_code,
                'customerName' => $customer->customer_name,
            ],
            'note' => $customer->note,
            'actor' => $authUser ? [
                'id' => $authUser->id,
                'code' => $authUser->code,
                'name' => $authUser->name,
            ] : null,
        ], $extra);
    }

    private function describeCustomerChanges(Customer $before, Customer $after, array $submittedData): array
    {
        $fieldLabels = [
            'customer_code' => 'Mã khách hàng',
            'lead_id' => 'Lead',
            'customer_name' => 'Tên khách hàng',
            'customer_type' => 'Loại khách hàng text',
            'customer_type_option_id' => 'Loại khách hàng',
            'company_name' => 'Tên công ty',
            'representative_name' => 'Người đại diện',
            'tax_code' => 'Mã số thuế',
            'identity_no' => 'CCCD/CMND',
            'address' => 'Địa chỉ',
            'phone' => 'Số điện thoại',
            'email' => 'Email',
            'website' => 'Website',
            'industry' => 'Ngành nghề text',
            'industry_option_id' => 'Ngành nghề',
            'birthday' => 'Ngày sinh',
            'source_option_id' => 'Nguồn phát sinh',
            'sales_user_id' => 'Nhân sự sales',
            'note' => 'Note',
        ];

        $changes = [];

        foreach ($fieldLabels as $field => $label) {
            if (! array_key_exists($field, $submittedData)) {
                continue;
            }

            $oldValue = $this->displayFieldValue($before, $field);
            $newValue = $this->displayFieldValue($after, $field);

            if ($oldValue === $newValue) {
                continue;
            }

            $changes[] = [
                'field' => $field,
                'label' => $label,
                'old' => $oldValue,
                'new' => $newValue,
            ];
        }

        return $changes;
    }

    private function displayFieldValue(Customer $customer, string $field): string
    {
        return match ($field) {
            'lead_id' => $customer->lead?->customer_name ?: $this->emptyValue(),
            'customer_type_option_id' => $this->displayOption($customer->customerTypeOption),
            'source_option_id' => $this->displayOption($customer->sourceOption),
            'industry_option_id' => $this->displayOption($customer->industryOption),
            'sales_user_id' => $customer->salesUser?->name ?: $this->emptyValue(),
            'birthday' => $customer->birthday?->toDateString() ?: $this->emptyValue(),
            default => $this->stringValue($customer->{$field}),
        };
    }

    private function displayOption(?Option $option): string
    {
        return $option?->label ?: $this->emptyValue();
    }

    private function stringValue(mixed $value): string
    {
        if ($value === null || $value === '') {
            return $this->emptyValue();
        }

        return (string) $value;
    }

    private function emptyValue(): string
    {
        return 'Trống';
    }

    private function currentUser(): ?User
    {
        $user = request()->user();

        return $user instanceof User ? $user : null;
    }

    private function generateCustomerCode(): string
    {
        $lastNumber = DB::table('customers')
            ->whereNotNull('customer_code')
            ->whereRaw("customer_code ~ '^[0-9]+$'")
            ->selectRaw('MAX(CAST(customer_code AS INTEGER)) as max_code')
            ->value('max_code');

        $nextNumber = ((int) ($lastNumber ?: 0)) + 1;

        do {
            $code = str_pad((string) $nextNumber, 3, '0', STR_PAD_LEFT);
            $nextNumber++;
        } while (DB::table('customers')->where('customer_code', $code)->exists());

        return $code;
    }
}

<?php

namespace App\Services;

use App\Exceptions\DeletedCustomerCodeConflictException;
use App\Http\Resources\CustomerLookupResource;
use App\Http\Resources\CustomerResource;
use App\Models\Customer;
use App\Models\CustomerTimeline;
use App\Models\Lead;
use App\Models\Option;
use App\Repositories\CustomerRepository;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class CustomersService extends BaseService
{
    public function __construct(private readonly CustomerRepository $customers) {}

    public function findAll(array $filters = [])
    {
        return $this->apiCollection($this->customers->findAll($this->normalizeKeys($filters), $this->currentUser()), CustomerResource::class);
    }

    public function findPaginated(array $filters, int $perPage, int $page): array
    {
        return $this->apiPaginatedCollection(
            $this->customers->findPaginated($this->normalizeKeys($filters), $perPage, $page, $this->currentUser()),
            CustomerResource::class,
        );
    }

    public function findLookupPaginated(array $filters, int $perPage, int $page): array
    {
        return $this->apiPaginatedCollection(
            $this->customers->findLookupPaginated($filters, $perPage, $page, $this->currentUser()),
            CustomerLookupResource::class,
        );
    }

    public function findLookupOne(string $id): array
    {
        return $this->apiResource(
            $this->customers->findLookupOrFail($id, $this->currentUser()),
            CustomerResource::class,
        );
    }

    public function findOne(string $id): array
    {
        $customer = $this->customers->findWithRelationsOrFail($id);
        $this->authorize('view', $customer);

        return $this->apiResource($customer, CustomerResource::class);
    }

    public function create(array $data, bool $linkLead = true, bool $checkAuthorization = true): array
    {
        return $this->transaction(function () use ($data, $linkLead, $checkAuthorization): array {
            $data = $this->normalizePayload($data);
            $purgeDeletedDuplicate = (bool) ($data['purge_deleted_duplicate'] ?? false);
            unset($data['purge_deleted_duplicate']);
            $this->validateAssigneeScope('customer', $data['sales_user_id'] ?? null, 'salesUserId');
            if (! array_key_exists('customer_code', $data)) {
                $data['customer_code'] = $this->generateCustomerCode();
            }
            $lead = $linkLead ? $this->lockLeadForConversion($data['lead_id'] ?? null) : null;

            if ($lead) {
                if (! $lead->source_option_id) {
                    throw ValidationException::withMessages([
                        'sourceOptionId' => 'Lead chưa có nguồn phát sinh. Vui lòng cập nhật Lead trước khi tạo khách hàng.',
                    ]);
                }

                $data['source_option_id'] = $lead->source_option_id;
                $data['industry'] = $lead->industry;
                $data['industry_option_id'] = $lead->industry_option_id;
                $this->authorize('update', $lead);
            } elseif ($checkAuthorization) {
                $this->authorize('create', Customer::class);
            }

            $this->resolveDeletedCodeConflict(
                (string) $data['customer_code'],
                $purgeDeletedDuplicate,
            );

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
            $purgeDeletedDuplicate = (bool) ($data['purge_deleted_duplicate'] ?? false);
            unset($data['purge_deleted_duplicate']);

            $before = $this->loadCustomerRelations($this->customers->findWithRelationsOrFail($id));
            $this->authorize('update', $before);

            if (array_key_exists('customer_code', $data)) {
                $this->resolveDeletedCodeConflict(
                    (string) $data['customer_code'],
                    $purgeDeletedDuplicate,
                    (int) $before->id,
                );
            }

            if (array_key_exists('sales_user_id', $data)) {
                $this->validateAssigneeScope('customer', $data['sales_user_id'], 'salesUserId');
            }

            if ($before->lead_id && $before->lead?->source_option_id) {
                $data['source_option_id'] = $before->lead->source_option_id;
            }

            if ($before->lead_id && $before->lead) {
                $data['industry'] = $before->lead->industry;
                $data['industry_option_id'] = $before->lead->industry_option_id;
            }

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
            $this->authorize('delete', $this->customers->findOrFail($id));
            $this->customers->delete($id);

            return ['message' => 'Xóa khách hàng thành công'];
        });
    }

    private function normalizePayload(array $data): array
    {
        $data = $this->normalizeKeys($data);

        if (array_key_exists('customer_code', $data)) {
            $customerCode = trim((string) ($data['customer_code'] ?? ''));

            if ($customerCode === '') {
                unset($data['customer_code']);
            } else {
                $data['customer_code'] = $customerCode;
            }
        }

        if (array_key_exists('customer_name', $data) && is_string($data['customer_name'])) {
            $data['customer_name'] = mb_strtoupper(trim($data['customer_name']), 'UTF-8');
        }

        if (array_key_exists('company_name', $data) && is_string($data['company_name'])) {
            $data['company_name'] = mb_strtoupper(trim($data['company_name']), 'UTF-8');
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
            'identityImageUrls' => 'identity_image_urls',
            'invoiceEmail' => 'invoice_email',
            'industryOptionId' => 'industry_option_id',
            'sourceOptionId' => 'source_option_id',
            'salesUserId' => 'sales_user_id',
            'purgeDeletedDuplicate' => 'purge_deleted_duplicate',
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
        return $customer->load(['lead', 'customerTypeOption', 'sourceOption', 'industryOption', 'salesUser', 'createdBy', 'projects', 'timelines.createdBy']);
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
        $convertedCustomer = $lead->converted_customer_id
            ? Customer::query()->withTrashed()->find($lead->converted_customer_id)
            : null;

        if (($convertedCustomer && ! $convertedCustomer->trashed()) || $existingCustomer) {
            throw new ConflictHttpException('Lead này đã được chuyển thành khách hàng');
        }

        return $lead;
    }

    private function resolveDeletedCodeConflict(
        string $customerCode,
        bool $purge,
        ?int $ignoreCustomerId = null,
    ): void
    {
        /** @var Customer|null $duplicate */
        $duplicate = Customer::query()
            ->withTrashed()
            ->where('customer_code', $customerCode)
            ->when($ignoreCustomerId, fn ($query) => $query->whereKeyNot($ignoreCustomerId))
            ->lockForUpdate()
            ->first();

        if (! $duplicate) {
            return;
        }

        if (! $duplicate->trashed()) {
            throw ValidationException::withMessages([
                'customerCode' => ['Mã khách hàng đã được sử dụng.'],
            ]);
        }

        $blockers = $this->permanentDeleteBlockers($duplicate->id);
        $relatedRecords = $this->deletedCustomerRelatedRecords($duplicate->id);
        $canDelete = (bool) ($this->currentUser()?->can('delete', $duplicate) ?? false);

        if (! $purge) {
            throw new DeletedCustomerCodeConflictException(
                $duplicate,
                $canDelete,
                $blockers,
                $relatedRecords,
            );
        }

        if (! $canDelete) {
            throw new AuthorizationException(
                'Bạn không có quyền xóa vĩnh viễn khách hàng cũ.',
            );
        }

        $this->forceDeleteCustomerGraph($duplicate);
    }

    /** @return array<int, string> */
    private function permanentDeleteBlockers(int $customerId): array
    {
        $relations = [
            'projects' => 'dự án',
            'quotations' => 'báo phí',
            'payments' => 'thanh toán',
            'payment_allocations' => 'phân bổ thanh toán',
            'payment_refunds' => 'hoàn tiền',
            'contracts' => 'hợp đồng',
            'invoices' => 'hóa đơn',
            'weekly_reports' => 'báo cáo tuần',
            'meetings' => 'lịch hẹn',
        ];

        return collect($relations)
            ->filter(fn (string $label, string $table): bool => Schema::hasTable($table)
                && Schema::hasColumn($table, 'customer_id')
                && DB::table($table)->where('customer_id', $customerId)->exists())
            ->values()
            ->all();
    }

    /** @return array{projects: array<int, string>, quotations: array<int, string>} */
    private function deletedCustomerRelatedRecords(int $customerId): array
    {
        $projects = DB::table('projects')
            ->where('customer_id', $customerId)
            ->orderBy('id')
            ->get(['id', 'project_code', 'project_name']);
        $projectIds = $projects->pluck('id')->all();
        $quotations = DB::table('quotations')
            ->where(function ($query) use ($customerId, $projectIds): void {
                $query->where('customer_id', $customerId);

                if ($projectIds !== []) {
                    $query->orWhereIn('project_id', $projectIds);
                }
            })
            ->orderBy('id')
            ->pluck('quotation_code')
            ->map(fn ($code): string => trim((string) $code))
            ->filter()
            ->unique()
            ->values()
            ->all();

        return [
            'projects' => $projects
                ->map(function ($project): string {
                    $code = trim((string) $project->project_code);
                    $name = trim((string) $project->project_name);

                    return $code !== '' ? $code : ($name !== '' ? $name : '#'.$project->id);
                })
                ->unique()
                ->values()
                ->all(),
            'quotations' => $quotations,
        ];
    }

    private function forceDeleteCustomerGraph(Customer $customer): void
    {
        $customerId = (int) $customer->id;
        $projectIds = $this->relatedRecordIds('projects', $customerId);
        $quotationIds = $this->relatedRecordIds('quotations', $customerId, $projectIds);
        $paymentIds = $this->relatedRecordIds(
            'payments',
            $customerId,
            $projectIds,
            $quotationIds,
        );
        $allocationIds = $this->relatedRecordIds(
            'payment_allocations',
            $customerId,
            $projectIds,
            $quotationIds,
            $paymentIds,
        );
        $refundIds = $this->relatedRecordIds(
            'payment_refunds',
            $customerId,
            $projectIds,
            $quotationIds,
            $paymentIds,
            $allocationIds,
        );

        // Delete from the leaves first so this works with both cascade and restrict FKs.
        $this->deleteRecordsByIds('payment_refunds', $refundIds);
        $this->deleteRecordsByIds('payment_allocations', $allocationIds);
        $this->deleteRelatedRecords('invoices', $customerId, $projectIds, $quotationIds);
        $this->deleteRecordsByIds('payments', $paymentIds);
        $this->deleteRecordsByIds('quotations', $quotationIds);
        $this->deleteRelatedRecords('meetings', $customerId, $projectIds);
        $this->deleteRelatedRecords('weekly_reports', $customerId, $projectIds);
        $this->deleteRelatedRecords('contracts', $customerId, $projectIds);
        $this->deleteRecordsByIds('projects', $projectIds);

        $customer->forceDelete();
    }

    /** @return array<int, int> */
    private function relatedRecordIds(
        string $table,
        int $customerId,
        array $projectIds = [],
        array $quotationIds = [],
        array $paymentIds = [],
        array $allocationIds = [],
    ): array {
        if (! Schema::hasTable($table) || ! Schema::hasColumn($table, 'id')) {
            return [];
        }

        $filters = $this->existingRelationFilters(
            $table,
            $customerId,
            $projectIds,
            $quotationIds,
            $paymentIds,
            $allocationIds,
        );

        if ($filters === []) {
            return [];
        }

        return DB::table($table)
            ->where(function ($query) use ($filters): void {
                foreach ($filters as [$column, $values]) {
                    $query->orWhereIn($column, $values);
                }
            })
            ->pluck('id')
            ->map(static fn ($id): int => (int) $id)
            ->all();
    }

    private function deleteRelatedRecords(
        string $table,
        int $customerId,
        array $projectIds = [],
        array $quotationIds = [],
    ): void {
        $this->deleteRecordsByIds(
            $table,
            $this->relatedRecordIds($table, $customerId, $projectIds, $quotationIds),
        );
    }

    /** @param array<int, int> $ids */
    private function deleteRecordsByIds(string $table, array $ids): void
    {
        if ($ids === [] || ! Schema::hasTable($table)) {
            return;
        }

        DB::table($table)->whereIn('id', $ids)->delete();
    }

    /** @return array<int, array{0: string, 1: array<int, int>}> */
    private function existingRelationFilters(
        string $table,
        int $customerId,
        array $projectIds,
        array $quotationIds,
        array $paymentIds,
        array $allocationIds,
    ): array {
        $candidates = [
            'customer_id' => [$customerId],
            'project_id' => $projectIds,
            'quotation_id' => $quotationIds,
            'payment_id' => $paymentIds,
            'payment_allocation_id' => $allocationIds,
        ];

        $filters = [];

        foreach ($candidates as $column => $values) {
            if ($values !== [] && Schema::hasColumn($table, $column)) {
                $filters[] = [$column, $values];
            }
        }

        return $filters;
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

        DB::table('payment_allocations')
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
            'identity_image_urls' => 'Ảnh CCCD',
            'address' => 'Địa chỉ',
            'phone' => 'Số điện thoại',
            'email' => 'Email',
            'invoice_email' => 'Email nhận hóa đơn',
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
            'identity_image_urls' => count($customer->identity_image_urls ?? []).' ảnh',
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

    private function generateCustomerCode(): string
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::selectOne("SELECT pg_advisory_xact_lock(hashtext('x3crm.customer_code'))");
        }

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

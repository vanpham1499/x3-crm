<?php

namespace App\Repositories;

use App\Models\Customer;
use App\Models\Option;
use Illuminate\Database\Eloquent\Collection;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class CustomerRepository extends BaseRepository
{
    protected string $notFoundMessage = 'Khách hàng không tồn tại';

    protected function model(): string
    {
        return Customer::class;
    }

    public function findAll(array $filters = []): Collection
    {
        $keyword = trim((string) ($filters['keyword'] ?? $filters['search'] ?? ''));
        $customerTypeOptionId = $filters['customer_type_option_id'] ?? null;
        $customerType = $filters['customer_type'] ?? null;
        $sourceOptionId = $filters['source_option_id'] ?? null;
        $source = $filters['source'] ?? null;
        $industryOptionId = $filters['industry_option_id'] ?? null;
        $industry = $filters['industry_option'] ?? null;
        $salesUserId = $filters['sales_user_id'] ?? null;
        $leadId = $filters['lead_id'] ?? null;

        return $this->query()
            ->with(['lead', 'customerTypeOption', 'sourceOption', 'industryOption', 'salesUser'])
            ->when($keyword !== '', function ($query) use ($keyword): void {
                $query->where(function ($query) use ($keyword): void {
                    $query
                        ->where('customer_code', 'ilike', "%{$keyword}%")
                        ->orWhere('customer_name', 'ilike', "%{$keyword}%")
                        ->orWhere('company_name', 'ilike', "%{$keyword}%")
                        ->orWhere('representative_name', 'ilike', "%{$keyword}%")
                        ->orWhere('phone', 'ilike', "%{$keyword}%")
                        ->orWhere('email', 'ilike', "%{$keyword}%")
                        ->orWhere('tax_code', 'ilike', "%{$keyword}%");
                });
            })
            ->when($customerTypeOptionId, fn ($query) => $query->where('customer_type_option_id', $customerTypeOptionId))
            ->when($customerType, fn ($query) => $query->whereHas('customerTypeOption', fn ($subQuery) => $subQuery->where('group', Option::GROUP_CUSTOMER_TYPE)->where('key', $customerType)))
            ->when($sourceOptionId, fn ($query) => $query->where('source_option_id', $sourceOptionId))
            ->when($source, fn ($query) => $query->whereHas('sourceOption', fn ($subQuery) => $subQuery->where('group', Option::GROUP_LEAD_SOURCE)->where('key', $source)))
            ->when($industryOptionId, fn ($query) => $query->where('industry_option_id', $industryOptionId))
            ->when($industry, fn ($query) => $query->whereHas('industryOption', fn ($subQuery) => $subQuery->where('group', Option::GROUP_INDUSTRY)->where('key', $industry)))
            ->when($salesUserId, fn ($query) => $query->where('sales_user_id', $salesUserId))
            ->when($leadId, fn ($query) => $query->where('lead_id', $leadId))
            ->orderByDesc('created_at')
            ->get();
    }

    public function findWithRelationsOrFail(string $id): Customer
    {
        /** @var Customer|null $customer */
        $customer = $this->query()
            ->with(['lead', 'customerTypeOption', 'sourceOption', 'industryOption', 'salesUser', 'projects', 'invoices', 'timelines.createdBy'])
            ->whereKey($id)
            ->first();

        if (! $customer) {
            throw new NotFoundHttpException($this->notFoundMessage);
        }

        return $customer;
    }
}

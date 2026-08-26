<?php

namespace App\Exceptions;

use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class DeletedCustomerCodeConflictException extends RuntimeException
{
    /** @param array<int, string> $blockers */
    public function __construct(
        private readonly Customer $customer,
        private readonly bool $canPurge,
        private readonly array $blockers = [],
    ) {
        parent::__construct('Mã khách hàng này thuộc một hồ sơ đã xóa.');
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'message' => $this->getMessage(),
            'code' => 'deleted_customer_code_conflict',
            'deletedCustomer' => [
                'id' => $this->customer->id,
                'customerCode' => $this->customer->customer_code,
                'customerName' => $this->customer->customer_name,
                'companyName' => $this->customer->company_name,
                'displayName' => $this->customer->displayLabel('Khách hàng đã xóa'),
                'deletedAt' => $this->customer->deleted_at?->toIso8601String(),
                'canPurge' => $this->canPurge,
                'blockers' => $this->blockers,
            ],
        ], 409);
    }
}

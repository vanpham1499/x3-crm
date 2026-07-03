<?php

namespace App\Http\Controllers;

use App\Http\Requests\Customers\CreateCustomerRequest;
use App\Http\Requests\Customers\UpdateCustomerRequest;
use App\Services\CustomersService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomersController extends Controller
{
    public function __construct(private readonly CustomersService $customers) {}

    public function index(Request $request): JsonResponse
    {
        return $this->success($this->customers->findAll([
            'keyword' => $request->query('keyword'),
            'search' => $request->query('search'),
            'customerTypeOptionId' => $request->query('customer_type_option_id'),
            'customer_type' => $request->query('customer_type'),
            'sourceOptionId' => $request->query('source_option_id'),
            'source' => $request->query('source'),
            'industryOptionId' => $request->query('industry_option_id'),
            'industry_option' => $request->query('industry'),
            'salesUserId' => $request->query('sales_user_id'),
            'leadId' => $request->query('lead_id'),
        ]));
    }

    public function show(string $id): JsonResponse
    {
        return $this->success($this->customers->findOne($id));
    }

    public function store(CreateCustomerRequest $request): JsonResponse
    {
        return $this->success($this->customers->create($request->validatedData()), 201);
    }

    public function update(UpdateCustomerRequest $request, string $id): JsonResponse
    {
        return $this->success($this->customers->update($id, $request->validatedData()));
    }

    public function destroy(string $id): JsonResponse
    {
        return $this->success($this->customers->remove($id));
    }
}

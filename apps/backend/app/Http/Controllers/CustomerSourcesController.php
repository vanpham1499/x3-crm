<?php

namespace App\Http\Controllers;

use App\Http\Requests\CustomerSources\CreateCustomerSourceRequest;
use App\Http\Requests\CustomerSources\UpdateCustomerSourceRequest;
use App\Services\CustomerSourcesService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerSourcesController extends Controller
{
    public function __construct(private readonly CustomerSourcesService $sources) {}

    public function index(Request $request): JsonResponse
    {
        return $this->success($this->sources->findAll([
            'keyword' => $request->query('keyword'),
            'search' => $request->query('search'),
        ]));
    }

    public function show(string $id): JsonResponse
    {
        return $this->success($this->sources->findOne($id));
    }

    public function store(CreateCustomerSourceRequest $request): JsonResponse
    {
        return $this->success($this->sources->create($request->validatedData()), 201);
    }

    public function update(UpdateCustomerSourceRequest $request, string $id): JsonResponse
    {
        return $this->success($this->sources->update($id, $request->validatedData()));
    }

    public function destroy(string $id): JsonResponse
    {
        return $this->success($this->sources->remove($id));
    }
}

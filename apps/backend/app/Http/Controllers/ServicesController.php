<?php

namespace App\Http\Controllers;

use App\Http\Requests\Services\CreateServiceRequest;
use App\Http\Requests\Services\UpdateServiceRequest;
use App\Services\ServicesService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ServicesController extends Controller
{
    public function __construct(private readonly ServicesService $services) {}

    public function index(Request $request): JsonResponse
    {
        $filters = [
            'keyword' => $request->query('keyword'),
            'search' => $request->query('search'),
            'level' => $request->query('level'),
            'is_active' => $request->query('is_active'),
            'tree' => $request->query('tree', true),
        ];

        if ($request->has('parent_id')) {
            $filters['parent_id'] = $request->query('parent_id');
        }

        return $this->success($this->services->findAll($filters));
    }

    public function show(string $id): JsonResponse
    {
        return $this->success($this->services->findOne($id));
    }

    public function store(CreateServiceRequest $request): JsonResponse
    {
        return $this->success($this->services->create($request->validatedData()), 201);
    }

    public function update(UpdateServiceRequest $request, string $id): JsonResponse
    {
        return $this->success($this->services->update($id, $request->validatedData()));
    }

    public function destroy(string $id): JsonResponse
    {
        return $this->success($this->services->remove($id));
    }
}

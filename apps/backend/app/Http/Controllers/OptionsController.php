<?php

namespace App\Http\Controllers;

use App\Http\Requests\Options\CreateOptionRequest;
use App\Http\Requests\Options\ReorderOptionsRequest;
use App\Http\Requests\Options\UpdateOptionRequest;
use App\Services\OptionsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OptionsController extends Controller
{
    public function __construct(private readonly OptionsService $options) {}

    public function index(Request $request): JsonResponse
    {
        return $this->success($this->options->findAll([
            'keyword' => $request->query('keyword'),
            'search' => $request->query('search'),
            'group' => $request->query('group'),
            'groups' => $request->query('groups'),
            'is_active' => $request->query('is_active'),
        ]));
    }

    public function show(string $id): JsonResponse
    {
        return $this->success($this->options->findOne($id));
    }

    public function store(CreateOptionRequest $request): JsonResponse
    {
        return $this->success($this->options->create($request->validatedData()), 201);
    }

    public function update(UpdateOptionRequest $request, string $id): JsonResponse
    {
        return $this->success($this->options->update($id, $request->validatedData()));
    }

    public function reorder(ReorderOptionsRequest $request): JsonResponse
    {
        return $this->success($this->options->reorder($request->validatedData()));
    }

    public function destroy(string $id): JsonResponse
    {
        return $this->success($this->options->remove($id));
    }
}


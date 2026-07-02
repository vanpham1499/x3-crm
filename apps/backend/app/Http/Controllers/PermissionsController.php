<?php

namespace App\Http\Controllers;

use App\Services\PermissionsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PermissionsController extends Controller
{
    public function __construct(private readonly PermissionsService $permissions)
    {
    }

    public function index(Request $request): JsonResponse
    {
        return $this->success($this->permissions->findAll(
            $request->query('module'),
            $request->query('keyword'),
        ));
    }
}

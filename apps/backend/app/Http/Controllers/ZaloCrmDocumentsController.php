<?php

namespace App\Http\Controllers;

use App\Services\ZaloCrmDocuments;
use App\Services\ZaloCrmDocumentWorker;
use Illuminate\Http\Request;

class ZaloCrmDocumentsController extends Controller
{
    public function __construct(private ZaloCrmDocuments $documents) {}

    public function binding(Request $r, string $kind, int $id)
    {
        return response()->json($this->documents->binding($r->user(), $kind, $id))->header('Cache-Control', 'private, no-store');
    }

    public function saveBinding(Request $r, string $kind, int $id)
    {
        $v = $r->validate(['mode' => 'required|in:own,inherit,disabled', 'revision' => 'required|integer|min:0',
            'accountId' => 'required_if:mode,own|nullable|integer|min:1', 'peer' => ['required_if:mode,own', 'nullable', 'regex:/^g\d{1,30}$/D']]);

        return response()->json($this->documents->saveBinding($r->user(), $kind, $id, $v));
    }

    public function accounts(Request $r)
    {
        return response()->json($this->documents->accounts($r->user()))->header('Cache-Control', 'private, no-store');
    }

    public function groups(Request $r, int $account)
    {
        return response()->json($this->documents->groups($r->user(), $account))->header('Cache-Control', 'private, no-store');
    }

    public function context(Request $r, string $kind, int $id)
    {
        return response()->json($this->documents->context($r->user(), $kind, $id))->header('Cache-Control', 'private, no-store');
    }

    public function enqueue(Request $r, string $kind, int $id)
    {
        $v = $r->validate(['requestId' => 'required|uuid', 'version' => 'required|size:64', 'destinationVersion' => 'required|size:64',
            'text' => 'nullable|string|max:2000', 'file' => 'required|file|max:25600|mimetypes:application/pdf,image/png,image/jpeg']);

        return response()->json($this->documents->enqueue($r->user(), $kind, $id, $v, $r->file('file')), 202);
    }

    public function action(Request $r, string $id, ZaloCrmDocumentWorker $worker)
    {
        $v = $r->validate(['action' => 'required|in:check,retry,cancel']);

        return response()->json($worker->action($r->user(), $id, $v['action']));
    }

    public function artifact(Request $r, string $id)
    {
        $d = $this->documents->delivery($r->user(), $id);
        $asset = json_decode($d->snapshot, true)['asset'];
        abort_unless(is_file(ZaloCrmDocuments::path($id)), 410, 'Bản gửi đã hết hạn lưu.');

        return response()->download(ZaloCrmDocuments::path($id), $asset['name'], ['Content-Type' => $asset['mime'], 'Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff']);
    }
}

<?php

namespace App\Http\Controllers;

use App\Services\ZaloTeamCatalog;
use App\Services\ZaloTeamTags;
use Illuminate\Http\Request;

class ZaloTeamTagsController extends Controller
{
    public function command(Request $request, ZaloTeamCatalog $catalog, ZaloTeamTags $tags)
    {
        abort_if(config('zalo_team.maintenance'), 503, 'Đang chuyển kho Zalo lên VPS. Vui lòng thử lại sau.');
        abort_if(config('zalo_team.remote_api_url'), 409, 'Thẻ Zalo đã chuyển sang dịch vụ riêng. Tải lại Zalo Team.');
        $v = $request->validate([
            'kind' => 'required|in:read,preview,create,update,assign,archive,reorder,merge,import,rollback',
            'requestId' => 'required_unless:kind,read,preview|uuid', 'revision' => 'required_unless:kind,read,preview|integer|min:0',
            'id' => 'required_if:kind,update,assign,archive|uuid',
            'name' => 'required_if:kind,create,update|string|max:80', 'color' => ['required_if:kind,create,update', 'regex:/^#[a-fA-F0-9]{6}$/'],
            'source' => ['required_if:kind,assign', 'regex:/^[1-9]\d*:g?\d{1,30}$/'],
            'active' => 'required_if:kind,assign|boolean', 'archived' => 'required_if:kind,archive|boolean',
            'ids' => 'required_if:kind,merge,reorder|array|min:1|max:500', 'ids.*' => 'uuid|distinct',
            'targetId' => 'required_if:kind,merge|uuid', 'batchId' => 'required_if:kind,import,rollback|uuid',
            'mapping' => 'required_if:kind,import|array|max:2000', 'mapping.*.key' => 'required|string|max:120',
            'mapping.*.targetId' => 'nullable|uuid', 'mapping.*.name' => 'required|string|max:80',
            'mapping.*.color' => ['required', 'regex:/^#[a-fA-F0-9]{6}$/'], 'mapping.*.skip' => 'boolean',
        ]);
        $u = $request->user();
        if (! in_array($v['kind'], ['read', 'assign'])) {
            abort_unless($tags->canManage($u), 403, 'Bạn chưa có quyền quản lý thẻ chung.');
        }
        if ($v['kind'] === 'assign') \App\Services\ZaloTeamAccess::allow($u, (int) explode(':', $v['source'])[0], 'write');
        if (! in_array($v['kind'], ['read', 'assign'])) \App\Services\ZaloTeamAccess::admin($u);
        $scope = $catalog->load($u);
        if ($v['kind'] === 'assign') {
            foreach ($scope['groups'] as $group) {
                if (in_array($v['source'], $group['sources'], true)) {
                    foreach ($group['sources'] as $source) \App\Services\ZaloTeamAccess::allow($u, (int) explode(':', $source)[0], 'write');
                }
            }
        }
        if ($v['kind'] === 'read') {
            return response()->json($tags->read($u, $scope));
        }
        if ($v['kind'] === 'preview') {
            return response()->json($tags->preview($u, $scope));
        }
        $result = $tags->mutate($u, $v, $scope);
        \App\Services\ZaloTeamAccess::audit($u, 'tags.'.$v['kind'], isset($v['source']) ? (int) explode(':', $v['source'])[0] : null, ['requestId' => $v['requestId']]);

        return response()->json(array_merge($result, ['data' => $tags->read($u, $scope)]));
    }
}

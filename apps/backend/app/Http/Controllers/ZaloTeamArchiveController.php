<?php

namespace App\Http\Controllers;

use App\Services\ZaloTeamArchive;
use App\Services\ZaloTeamAccess;
use App\Services\ZaloTeamArchiveBackup;
use App\Services\ZaloTeamArchiveCheckpoint;
use App\Services\ZaloTeamArchiveCleanup;
use App\Services\ZaloTeamArchiveDetail;
use App\Services\ZaloTeamArchiveFiles;
use App\Services\ZaloTeamArchiveReport;
use App\Services\ZaloTeamArchiveRetry;
use App\Services\ZaloTeamArchiveSearch;
use App\Services\ZaloTeamCatalog;
use App\Services\ZaloTeamFileImport;
use App\Services\ZaloTeamPhoneSync;
use App\Services\ZaloTeamServerMetrics;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

class ZaloTeamArchiveController extends Controller
{
    #[OA\Post(path: '/zalo-team/archive', operationId: 'zaloTeamArchiveCommand', summary: 'Manage private Zalo synchronization, stored history and encrypted backups', security: [['cookieAuth' => []]], tags: ['Zalo Team'],
        requestBody: new OA\RequestBody(required: true, content: new OA\JsonContent(required: ['kind'], properties: [
            new OA\Property(property: 'kind', type: 'string', enum: ['cleanup-preview', 'cleanup-apply', 'status', 'search-messages', 'media-library', 'list-conversations', 'search-conversations', 'days', 'day-file-issues', 'configure', 'sync', 'history', 'timeline', 'hide-message', 'retry-files', 'backup', 'verify', 'restore', 'attachment-status', 'checkpoint', 'verify-checkpoint', 'file-status', 'file-pick', 'file-open', 'file-unlock', 'file-start', 'file-stop', 'phone-status', 'phone-start', 'phone-cancel']),
            new OA\Property(property: 'selectionId', type: 'string', format: 'uuid', description: 'Owner-scoped native file selection returned by file-status after file-pick. Expires after 30 minutes. file-open resolves it locally without exposing the absolute path.'),
            new OA\Property(property: 'requestId', type: 'string', format: 'uuid', description: 'Stable idempotency key for phone-start; job ID for phone-cancel. Phone commands require accountId. Transfer completion and archive persistence are separate; capabilities expose the actual Web session date range.'),
            new OA\Property(property: 'conversations', type: 'array', items: new OA\Items(type: 'string'), maxItems: 20000),
            new OA\Property(property: 'all', type: 'boolean'),
            new OA\Property(property: 'resume', type: 'boolean'),
            new OA\Property(property: 'uploadLimit', type: 'integer', nullable: true, minimum: 1048576, maximum: 10000000000000, description: 'Optional total transfer ceiling in bytes for the opened file. Null means unlimited. Applied by file-start including resume.'),
            new OA\Property(property: 'start', type: 'boolean', description: 'pc-prioritize may start an idle verified session while retaining the rest of its queue.'),
            new OA\Property(property: 'mode', type: 'string', enum: ['cleanup', 'restore']),
            new OA\Property(property: 'token', type: 'string', description: 'Owner-bound cleanup preview; expires after ten minutes.'),
            new OA\Property(property: 'assetIds', type: 'array', items: new OA\Items(type: 'string'), maxItems: 500),
            new OA\Property(property: 'retryMode', type: 'string', enum: ['scheduled', 'all']),
            new OA\Property(property: 'assetId', type: 'string'),
            new OA\Property(property: 'section', type: 'string', enum: ['overview', 'images', 'files', 'links'], description: 'media-library projects stored attachments for the requested account/conversation.'),
            new OA\Property(property: 'sender', type: 'string', description: 'search-messages: all, me, others, or a numeric sender ID.'),
            new OA\Property(property: 'days', type: 'integer', enum: [0, 7, 30, 90]),
            new OA\Property(property: 'date', type: 'string', format: 'date'), new OA\Property(property: 'checkpointId', type: 'string', format: 'uuid'),
            new OA\Property(property: 'messageIds', type: 'array', items: new OA\Items(type: 'string'), maxItems: 300),
            new OA\Property(property: 'accounts', type: 'array', items: new OA\Items(type: 'integer')),
            new OA\Property(property: 'enabled', type: 'boolean'), new OA\Property(property: 'media', type: 'boolean'), new OA\Property(property: 'daily_backup', type: 'boolean'),
            new OA\Property(property: 'source', type: 'string'), new OA\Property(property: 'accountId', type: 'integer'), new OA\Property(property: 'conversationId', type: 'string'),
            new OA\Property(property: 'offset', type: 'integer', minimum: 0),
            new OA\Property(property: 'limit', type: 'integer', minimum: 1, maximum: 100, description: 'Opt-in pagination for days; legacy clients may omit.'),
            new OA\Property(property: 'view', type: 'string', enum: ['full', 'sync', 'storage', 'backup']),
            new OA\Property(property: 'includeSources', type: 'boolean', description: 'Return date source detail; false for day list filters.'),
            new OA\Property(property: 'includeIssues', type: 'boolean', description: 'Load file issues only when expanded in sync view.'),
            new OA\Property(property: 'query', type: 'string'), new OA\Property(property: 'before', type: 'object', properties: [new OA\Property(property: 'id', type: 'string'), new OA\Property(property: 'time', type: 'string')]),
            new OA\Property(property: 'backupId', type: 'string', format: 'uuid'), new OA\Property(property: 'confirm', type: 'boolean'),
        ])), responses: [new OA\Response(response: 200, description: 'Scoped archive status/history or queued request. file-* commands require authenticated CRM owner, local Windows and loopback access. file-open accepts a local .zl.zip path and linked account. file-unlock requires confirm. file-start accepts selected conversations or all=true; resume retains committed batches. file-stop preserves progress. Legacy pc-* commands return 410. Sync/import/backup run in background.', content: new OA\JsonContent(type: 'object')), new OA\Response(response: 401, description: 'Login required'), new OA\Response(response: 403, description: 'Wrong account scope or non-local PC request'), new OA\Response(response: 409, description: 'Worker offline, archive busy or PC not ready'), new OA\Response(response: 422, description: 'Invalid request')])]
    public function command(Request $request, ZaloTeamArchive $archive, ZaloTeamCatalog $catalog, ZaloTeamArchiveBackup $backup)
    {
        if (str_starts_with((string) $request->input('kind'), 'file-')) {
            ZaloTeamAccess::admin($request->user());
            abort_unless(in_array($request->getHost(), ['localhost', '127.0.0.1', '::1']) && in_array($request->ip(), ['127.0.0.1', '::1']), 403);
            $file = $request->validate(['kind' => 'required|in:file-status,file-pick,file-open,file-unlock,file-start,file-stop',
                'path' => 'sometimes|string|max:1000', 'selectionId' => 'sometimes|uuid', 'accountId' => 'required_if:kind,file-open,file-pick|integer|min:1',
                'confirm' => 'required_if:kind,file-unlock|boolean', 'all' => 'sometimes|boolean', 'resume' => 'sometimes|boolean',
                'uploadLimit' => 'nullable|integer|min:1048576|max:10000000000000',
                'conversations' => 'sometimes|array|max:20000', 'conversations.*' => 'string|distinct|regex:/^g?\d{1,30}$/D']);

            return response()->json(app(ZaloTeamFileImport::class)->command($request->user(), $file));
        }
        if (str_starts_with((string) $request->input('kind'), 'pc-')) {
            abort(410, 'Nhập lịch sử trực tiếp từ Zalo PC đã được thay bằng Nhập từ file xuất.');
        }
        abort_if(config('zalo_team.maintenance'), 503, 'Đang chuyển kho Zalo lên VPS. Vui lòng thử lại sau.');
        if (in_array($request->input('kind'), ['inbox-preferences', 'inbox-archive'], true)) {
            $v = $request->validate([
                'kind' => 'required|in:inbox-preferences,inbox-archive',
                'sources' => 'required_if:kind,inbox-archive|array|min:1|max:30',
                'sources.*' => ['string', 'distinct', 'regex:/^[1-9][0-9]{0,14}:g?[0-9]{1,30}$/D'],
                'archived' => 'required_if:kind,inbox-archive|boolean',
            ]);
            $preferences = app(\App\Services\ZaloTeamInboxPreferences::class);
            return response()->json($v['kind'] === 'inbox-preferences'
                ? $preferences->read($request->user())
                : $preferences->set($request->user(), $v['sources'], $v['archived']))->header('Cache-Control', 'private, no-store');
        }

        $v = $request->validate([
            'kind' => 'required|in:drive-retry,server-status,cleanup-preview,cleanup-apply,status,search-messages,media-library,list-conversations,search-conversations,days,day-file-issues,configure,sync,history,timeline,hide-message,retry-files,backup,verify,restore,attachment-status,checkpoint,verify-checkpoint,phone-status,phone-start,phone-cancel',
            'mode' => 'required_if:kind,cleanup-preview|in:cleanup,restore',
            'token' => 'required_if:kind,cleanup-apply|string|max:100000',
            'assetIds' => 'required_if:kind,cleanup-apply|array|min:1|max:500',
            'assetIds.*' => 'string|distinct|regex:/^[a-f0-9]{64}$/',
            'requestId' => 'required_if:kind,phone-start,phone-cancel|uuid',
            'all' => 'sometimes|boolean',
            'resume' => 'sometimes|boolean',
            'start' => 'sometimes|boolean',
            'retryMode' => 'sometimes|in:scheduled,all',
            'assetId' => 'sometimes|string|regex:/^[a-f0-9]{64}$/',
            'conversations' => 'sometimes|array|min:1|max:20000',
            'conversations.*' => 'string|distinct|regex:/^g?\d{1,30}$/',
            'date' => 'required_if:kind,day-file-issues|nullable|date_format:Y-m-d', 'checkpointId' => 'required_if:kind,verify-checkpoint|uuid',
            'messageIds' => 'required_if:kind,attachment-status,hide-message|array|max:300',
            'messageIds.*' => 'string|regex:/^[a-zA-Z0-9_.:-]{1,200}$/',
            'enabled' => 'required_if:kind,configure|boolean', 'media' => 'required_if:kind,configure|boolean',
            'daily_backup' => 'required_if:kind,configure|boolean', 'accounts' => 'present_if:kind,configure|array|max:30',
            'accounts.*' => 'integer|min:1|distinct', 'source' => 'nullable|string|size:64',
            'accountId' => 'required_if:kind,phone-status,phone-start,phone-cancel|nullable|integer|min:1', 'conversationId' => 'nullable|string|regex:/^g?\d{1,30}$/',
            'before' => 'nullable|array:id,time', 'before.id' => 'required_with:before|string|regex:/^[a-zA-Z0-9_.:-]{1,200}$/',
            'before.time' => 'required_with:before|integer|min:0', 'query' => 'nullable|string|max:200',
            'limit' => 'sometimes|integer|min:1|max:100',
            'view' => 'sometimes|in:full,sync,storage,backup',
            'includeSources' => 'sometimes|boolean',
            'includeIssues' => 'sometimes|boolean',
            'offset' => 'nullable|integer|min:0|max:1000000',
            'section' => 'sometimes|in:overview,images,files,links', 'sender' => ['sometimes', 'string', 'regex:/^(all|me|others|[0-9]{1,30})$/'], 'days' => 'sometimes|integer|in:0,7,30,90',
            'backupId' => 'required_if:kind,verify,restore|uuid',
            'confirm' => 'required_if:kind,restore|boolean',
        ]);
        $u = $request->user();
        $owner = ZaloTeamArchive::owner($u);
        $adminKinds = ['drive-retry','server-status','cleanup-preview','cleanup-apply','backup','verify','restore','checkpoint','verify-checkpoint','hide-message'];
        if (in_array($v['kind'], $adminKinds, true)) ZaloTeamAccess::admin($u);
        $ability = in_array($v['kind'], ['sync','configure','retry-files','phone-start','phone-cancel']) ? 'sync' : 'read';
        if (! empty($v['accountId'])) ZaloTeamAccess::allow($u, (int) $v['accountId'], $ability);
        if ($ability === 'sync') {
            $allowed = ZaloTeamAccess::ids($u, 'sync');
            abort_if($allowed === [], 403, 'Bạn chưa được cấp quyền đồng bộ.');
            if ($allowed !== null) $v['allowedAccountIds'] = $allowed;
            ZaloTeamAccess::audit($u, 'archive.'.$v['kind'], $v['accountId'] ?? null);
        }
        if (in_array($v['kind'], $adminKinds, true) && $v['kind'] !== 'server-status') ZaloTeamAccess::audit($u, 'archive.'.$v['kind']);
        if (str_starts_with($v['kind'], 'phone-')) {
            return response()->json(app(ZaloTeamPhoneSync::class)->command($u, $v));
        }

        abort_if(config('zalo_team.remote_api_url'), 409, 'Kho Zalo đã chuyển sang dịch vụ riêng. Tải lại Zalo Team.');
        switch ($v['kind']) {
            case 'drive-retry':
                abort_unless(ZaloTeamServerMetrics::allowed($u), 403);
                abort_unless(\App\Services\ZaloTeamDriveStore::enabled(), 409, 'Chưa kết nối Google Drive.');
                app(\App\Services\ZaloTeamDriveStore::class)->retry($owner);
                return response()->json(['queued' => true]);
            case 'server-status':return response()->json(app(ZaloTeamServerMetrics::class)->read($u));
            case 'cleanup-preview':return response()->json(app(ZaloTeamArchiveCleanup::class)->preview($owner, $v['mode']));
            case 'cleanup-apply':return response()->json(app(ZaloTeamArchiveCleanup::class)->apply($owner, $v));
            case 'search-messages':
            case 'media-library':
                abort_unless(! empty($v['accountId']) && ! empty($v['conversationId']), 422, 'Chọn tài khoản và hội thoại.');

                return response()->json(app(ZaloTeamArchiveDetail::class)->read($u, $v));
            case 'list-conversations':return response()->json(app(ZaloTeamArchiveSearch::class)->listing($u, $v['accountId'] ?? null, $v['offset'] ?? 0));
            case 'search-conversations':return response()->json(app(ZaloTeamArchiveSearch::class)->conversations($u, $v['query'] ?? '', $v['accountId'] ?? null, $v['offset'] ?? 0));
            case 'hide-message':
                abort_unless(! empty($v['accountId']) && ! empty($v['conversationId']), 422, 'Chọn tài khoản và hội thoại.');
                DB::table('zt_archive_observations')->whereIn('source_id', DB::table('zt_archive_sources')->where('owner', $owner)->where('account_id', $v['accountId'])->where('conversation_id', $v['conversationId'])->select('id'))->whereIn('native_id', $v['messageIds'])->update(['deleted' => true]);

                return response()->json(['ok' => true]);
            case 'days':return response()->json(app(ZaloTeamArchiveReport::class)->days($u, $v['accountId'] ?? null, $v['date'] ?? null, $v['offset'] ?? 0, $v['limit'] ?? null, $v['includeSources'] ?? true));
            case 'day-file-issues':return response()->json(app(ZaloTeamArchiveReport::class)->dayFileIssues($u, $v['date'], $v['accountId'] ?? null, $v['offset'] ?? 0));
            case 'attachment-status':return response()->json($archive->attachmentStatus($u, (int) ($v['accountId'] ?? 0), $v['conversationId'] ?? '', $v['messageIds']));
            case 'checkpoint':abort_unless(! empty($v['date']), 422, 'Chọn ngày kiểm chứng.');
                app(ZaloTeamArchiveCheckpoint::class)->create($u, $v['date']);
                break;
            case 'verify-checkpoint':return response()->json(app(ZaloTeamArchiveCheckpoint::class)->verify($u, $v['checkpointId']));
            case 'timeline':
                abort_unless(! empty($v['accountId']) && ! empty($v['conversationId']), 422, 'Chọn tài khoản và hội thoại.');
                $source = DB::table('zt_archive_sources')->where('owner', $owner)->where('account_id', $v['accountId'])->where('conversation_id', $v['conversationId'])->value('id');

                return response()->json($source ? $archive->history($u, $source, $v['before'] ?? null) : ['accountId' => $v['accountId'], 'conversationId' => $v['conversationId'], 'messages' => [], 'cursor' => null, 'hasMore' => false, 'warning' => null]);
            case 'history':
                $source = $v['source'] ?? DB::table('zt_archive_sources')->where('owner', $owner)->where('account_id', $v['accountId'] ?? 0)->where('conversation_id', $v['conversationId'] ?? '')->value('id');
                abort_unless($source, 404, 'Hội thoại này chưa có dữ liệu lưu.');

                return response()->json($archive->history($u, $source, $v['before'] ?? null, $v['query'] ?? '', $v['date'] ?? null));
            case 'configure':$status = $catalog->command($u, ['action' => 'status']);
                $archive->configure($u, $v, $status['accounts'] ?? []);
                break;
            case 'sync':
                $s = $archive->settings($u);
                abort_unless($s->enabled, 409, 'Bật đồng bộ và chọn tài khoản trước.');
                // Worker sees older attempts first; this is a request, not a false completion signal.
                DB::table('zt_archive_sources')->where('owner', $owner)->when(isset($v['allowedAccountIds']), fn ($q) => $q->whereIn('account_id', $v['allowedAccountIds']))->when(isset($v['accountId']), fn ($q) => $q->where('account_id', $v['accountId']))->update(['last_attempt' => null]);
                break;
            case 'retry-files':
                $retryResult = app(ZaloTeamArchiveRetry::class)->request($owner, $v);
                break;
            case 'backup':$backup->request($u);
                break;
            case 'verify':return response()->json($backup->verify($u, $v['backupId']));
            case 'restore':abort_unless($v['confirm'] === true, 422, 'Cần xác nhận khôi phục.');

                return response()->json($backup->restore($u, $v['backupId']));
        }
        $data = $archive->status($u, $v['view'] ?? 'full', $v['includeIssues'] ?? false);
        if (isset($retryResult)) {
            $data += $retryResult;
        }
        try {
            $data['accounts'] = $catalog->command($u, ['action' => 'status'])['accounts'] ?? [];
        } catch (\Throwable) {
            $data['accounts'] = [];
        }

        return response()->json($data);
    }

    #[OA\Get(path: '/zalo-team/archive/assets/{id}', operationId: 'zaloTeamArchiveAsset', summary: 'Read a stored file owned by the current CRM user', security: [['cookieAuth' => []]], tags: ['Zalo Team'], parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', pattern: '^[a-f0-9]{64}$'))], responses: [new OA\Response(response: 200, description: 'Private file'), new OA\Response(response: 206, description: 'Byte range'), new OA\Response(response: 401, description: 'Login required'), new OA\Response(response: 404, description: 'File not accessible')])]
    public function asset(Request $request, string $id, ZaloTeamArchiveFiles $files)
    {
        abort_unless(preg_match('/^[a-f0-9]{64}$/', $id), 404);
        $owner = ZaloTeamArchive::owner($request->user());
        $a = DB::table('zt_archive_assets')->where('id', $id)->where('owner', $owner)->where('state', 'ready')->first();
        abort_unless($a, 404);
        $visible = DB::table('zt_archive_observations as o')->join('zt_archive_sources as s', 's.id', '=', 'o.source_id')->where('s.owner', $owner)->when(ZaloTeamAccess::ids($request->user()) !== null, fn ($q) => $q->whereIn('s.account_id', ZaloTeamAccess::ids($request->user())))->where('o.message_id', $a->message_id)->where('o.deleted', false)->exists();
        abort_unless($visible, 404);
        try {
            $path = $files->readPath($owner, $a->hash);
        } catch (\Throwable $e) {
            abort(503, 'Chưa tải được tệp từ kho lưu trữ. Vui lòng thử lại.');
        }
        abort_unless(is_file($path), 404, 'File đã lưu không còn trên ổ đĩa.');
        $safe = preg_match('#^(image/(jpeg|png|gif|webp|avif)|video/(mp4|webm)|audio/(mpeg|ogg|wav|mp4|x-wav))$#', $a->mime ?? '');
        $headers = ['Content-Type' => $safe ? $a->mime : 'application/octet-stream', 'Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff', 'Content-Security-Policy' => "default-src 'none'; sandbox"];

        $content = json_decode(DB::table('zt_archive_messages')->where('id', $a->message_id)->value('content'), true);
        $index = (int) explode('.', $a->slot)[1];
        $name = preg_replace('/[\x00-\x1f\x7f\\\\\/]/u', '_', $content['attachments'][$index]['name'] ?? '');
        $name = mb_substr($name, 0, 180) ?: 'file-'.$a->hash;

        return $safe ? response()->file($path, $headers) : response()->download($path, $name, $headers);
    }
}

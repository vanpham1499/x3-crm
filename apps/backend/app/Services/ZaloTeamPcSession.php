<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\Process\Process;

/** Local Windows bridge. HTTP accepts IDs only; filesystem and process arguments are server-owned. */
class ZaloTeamPcSession
{
    private int $lastLeaseRefresh = 0;

    private function root(): string
    {
        $root = config('zalo_team.pc_session_path', storage_path('app/private/zalo-pc'));
        if (! is_dir($root)) {
            mkdir($root, 0700, true);
        }

        return $root;
    }

    private function change(callable $fn): mixed
    {
        $lock = fopen($this->root().'/state.lock', 'c');
        flock($lock, LOCK_EX);
        try {
            $file = $this->root().'/session.json';
            $s = is_file($file) ? json_decode(file_get_contents($file), true, 64, JSON_THROW_ON_ERROR) : [];
            $result = $fn($s);
            if (file_put_contents($file.'.tmp', ZaloTeamArchive::json($s), LOCK_EX) === false || ! rename($file.'.tmp', $file)) {
                throw new \RuntimeException('PC_STATE_WRITE_FAILED');
            }

            return $result;
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    public function supported(): bool
    {
        return PHP_OS_FAMILY === 'Windows' && app()->environment('local');
    }

    public function status(User $u): array
    {
        return $this->change(function (&$s) use ($u) {
            clearstatcache(true, $this->root().'/heartbeat');
            $fresh = is_file($this->root().'/heartbeat') && time() - filemtime($this->root().'/heartbeat') < 90;
            if (($s['owner'] ?? ZaloTeamArchive::owner($u)) !== ZaloTeamArchive::owner($u)) {
                return ['supported' => $this->supported(), 'workerOnline' => $fresh, 'state' => in_array($s['state'], ['disconnected', 'complete', 'error']) ? 'disconnected' : 'busy'];
            }

            return array_intersect_key($s, array_flip(['state', 'accountId', 'accountName', 'conversations', 'selected', 'remaining', 'current', 'progress', 'results', 'error', 'notice', 'expires', 'stop', 'cancel', 'updatedAt', 'blockedAt', 'recoveryPaused']))
                + ['supported' => $this->supported(), 'workerOnline' => $fresh, 'state' => 'disconnected', 'heartbeat' => is_file($this->root().'/heartbeat') ? filemtime($this->root().'/heartbeat') * 1000 : null];
        });
    }

    public function command(User $u, array $v): array
    {
        $account = null;
        $session = null;
        abort_unless($this->supported(), 409, 'Nhập PC hiện chạy trên máy Windows đang cài Zalo Team local.');
        if ($v['kind'] !== 'pc-disconnect') {
            abort_unless($this->status($u)['workerOnline'], 409, 'Bộ kết nối PC chưa chạy trên máy này.');
        }
        if ($v['kind'] === 'pc-connect') {
            abort_unless($v['confirm'] ?? false, 422, 'Xác nhận khởi động lại Zalo PC để kết nối tạm.');
            $accounts = app(ZaloTeamCatalog::class)->command($u, ['action' => 'status'])['accounts'] ?? [];
            $account = collect($accounts)->first(fn ($a) => $a['id'] === $v['accountId'] && $a['status'] === 'connected');
            abort_unless($account && preg_match('/^\d+$/', $account['externalId'] ?? ''), 403, 'Tài khoản Team chưa kết nối hoặc không thuộc bạn.');
        }
        if ($v['kind'] === 'pc-import') {
            $session = $this->change(fn (&$s) => $s);
            abort_unless(($session['owner'] ?? '') === ZaloTeamArchive::owner($u), 403, 'Phiên PC không thuộc bạn.');
            $accounts = app(ZaloTeamCatalog::class)->command($u, ['action' => 'status'])['accounts'] ?? [];
            abort_unless(collect($accounts)->contains(fn ($a) => $a['id'] === $session['accountId'] && ($a['externalId'] ?? '') === $session['externalId'] && $a['status'] === 'connected'), 403, 'Liên kết tài khoản Team đã thay đổi. Kết nối lại trước khi nhập.');
        }
        $this->change(function (&$s) use ($u, $v, $account, $session) {
            $owner = ZaloTeamArchive::owner($u);
            abort_if(! empty($s['owner']) && $s['owner'] !== $owner && ! in_array($s['state'], ['disconnected', 'complete', 'error']), 409, 'Máy PC đang có phiên nhập khác.');
            if ($v['kind'] === 'pc-connect') {
                abort_unless(in_array($s['state'] ?? 'disconnected', ['disconnected', 'complete', 'error']), 409, 'Phiên PC đang hoạt động.');
                $resume = ($s['owner'] ?? '') === $owner && ($s['accountId'] ?? null) === $account['id'] && ($s['externalId'] ?? '') === $account['externalId'];
                $saved = $resume ? array_intersect_key($s, array_flip(['selected', 'remaining', 'results', 'progress', 'recoveryOnly'])) : [];
                $s = ['owner' => $owner, 'userId' => $u->id, 'accountId' => $account['id'], 'externalId' => $account['externalId'], 'accountName' => $account['name'],
                    'state' => 'queued-connect', 'conversations' => [], 'error' => null, 'sessionId' => (string) Str::uuid()] + $saved + ['results' => []];
            } else {
                abort_unless(($s['owner'] ?? '') === $owner, 403, 'Phiên PC không thuộc bạn.');
                if (isset($v['accountId'])) {
                    abort_unless($v['accountId'] === $s['accountId'], 409, 'Tài khoản PC đã thay đổi. Tải lại rồi chọn đúng tài khoản.');
                }
                if ($v['kind'] === 'pc-disconnect') {
                    $s['cancel'] = true;

                    return;
                }
                if ($v['kind'] === 'pc-stop') {
                    abort_unless(in_array($s['state'] ?? '', ['queued-import', 'exporting', 'importing']), 409, 'Không có lượt nhập đang chạy.');
                    $s['stop'] = true;

                    return;
                }
                if ($v['kind'] === 'pc-prioritize') {
                    abort_unless(in_array($s['state'] ?? '', ['ready', 'queued-import', 'exporting', 'importing']), 409, 'Kết nối lại PC để sắp xếp lượt nhập.');
                    abort_if(($s['cancel'] ?? false) || ($s['stop'] ?? false), 409, 'Đang dừng lượt nhập.');
                    abort_if(($s['state'] ?? '') === 'ready' && ($s['expires'] ?? 0) <= time(), 409, 'Phiên PC hết thời gian chờ. Kết nối lại trước.');
                    $cid = $v['conversationId'] ?? '';
                    abort_unless(in_array($cid, array_column($s['conversations'], 'conversationId'), true), 422, 'Hội thoại không thuộc danh sách PC đã kiểm tra.');
                    abort_if($cid === ($s['current'] ?? null), 409, 'Hội thoại này đang được xử lý.');
                    // Current work commits first. The next claim reads this durable queue.
                    $s['remaining'] = array_values(array_unique([$cid, ...($s['remaining'] ?? [])]));
                    $s['selected'] = array_values(array_unique([...($s['selected'] ?? []), $cid]));
                    $s['notice'] = 'Đã ưu tiên hội thoại. Sẽ xử lý sau hội thoại đang chạy; nếu đã dừng, bấm Tiếp tục hàng đợi.';
                    if (! empty($v['start']) && $s['state'] === 'ready') {
                        $s['recoveryPaused'] = false;
                        $s['state'] = 'queued-import';
                        $s['progress'] = null;
                        $s['error'] = null;
                        $s['notice'] = 'Đã xếp hội thoại cần xử lý lên đầu hàng đợi.';
                    }

                    return;
                }
                abort_unless(($s['state'] ?? '') === 'ready', 409, 'Kết nối PC trước khi nhập.');
                abort_unless(($s['sessionId'] ?? null) === ($session['sessionId'] ?? null), 409, 'Phiên PC đã thay đổi. Tải lại trước khi nhập.');
                abort_if(($s['cancel'] ?? false) || ($s['expires'] ?? 0) <= time(), 409, 'Phiên PC đang ngắt hoặc đã hết thời gian chờ.');
                $resume = ! empty($v['resume']);
                $selected = $resume ? ($s['remaining'] ?? []) : (! empty($v['all']) ? array_column($s['conversations'], 'conversationId') : array_values(array_unique($v['conversations'] ?? [])));
                abort_if(! $selected, 422, 'Chọn ít nhất một hội thoại.');
                abort_if(array_diff($selected, array_column($s['conversations'], 'conversationId')), 422, 'Hội thoại không thuộc danh sách PC đã kiểm tra.');
                $s['selected'] = $resume ? array_values(array_unique([...($s['selected'] ?? []), ...$selected])) : $selected;
                $s['remaining'] = $selected;
                $s['state'] = 'queued-import';
                if (! $resume) {
                    $s['results'] = [];
                    $s['recoveryOnly'] = [];
                }
                $s['current'] = null;
                $s['progress'] = null;
                $s['stop'] = false;
                $s['recoveryPaused'] = false;
                $s['error'] = null;
                $s['notice'] = null;
            }
        });

        return $this->status($u);
    }

    private function update(array $fields): void
    {
        $this->change(function (&$s) use ($fields) {
            $s = array_replace($s, $fields);
            $s['updatedAt'] = (int) floor(microtime(true) * 1000);
        });
    }

    protected function pulse(): void
    {
        touch($this->root().'/heartbeat');
        $this->change(function (&$s) {
            if ($s['cancel'] ?? false) {
                throw new \RuntimeException('PC_CANCELLED');
            }
            if ($s['stop'] ?? false) {
                throw new \RuntimeException('PC_STOPPED');
            }
        });
        $this->renewLease();
    }

    private function renewLease(bool $force = false): void
    {
        if (! $force && time() - $this->lastLeaseRefresh < 5) {
            return;
        }
        $this->lastLeaseRefresh = time();
        $lease = $this->root().'/lease.json';
        if (is_file($lease)) {
            $v = json_decode(ltrim(file_get_contents($lease), "\xef\xbb\xbf"), true);
            $v['expires'] = time() + 900;
            file_put_contents($lease.'.tmp', json_encode($v), LOCK_EX);
            rename($lease.'.tmp', $lease);
        }
    }

    protected function process(array $args, int $timeout = 120, ?callable $progress = null): string
    {
        $p = new Process($args, base_path('../..'), null, null, $timeout);
        $p->start();
        $buffer = '';
        $output = '';
        try {
            while ($p->isRunning()) {
                $this->pulse();
                $p->checkTimeout();
                $chunk = $p->getIncrementalOutput();
                $output .= $chunk;
                $buffer .= $chunk;
                while (($pos = strpos($buffer, "\n")) !== false) {
                    $line = substr($buffer, 0, $pos);
                    $buffer = substr($buffer, $pos + 1);
                    if ($progress && ($v = json_decode($line, true))) {
                        $progress($v);
                    }
                }
                usleep(250000);
            }
            $output .= $p->getIncrementalOutput();
            if (! $p->isSuccessful()) {
                throw new \RuntimeException(preg_match('/PC_ACCOUNT_(MISMATCH|CHANGED)/', $p->getErrorOutput()) ? 'PC_ACCOUNT_MISMATCH' : 'PC_PROCESS_FAILED');
            }

            return $output;
        } finally {
            if ($p->isRunning()) {
                $p->stop(2);
            }
        }
    }

    protected function native(string $action): void
    {
        // Closing must still run after cancellation; no pulse callback here.
        $p = new Process(['powershell.exe', '-NoProfile', '-File', base_path('integrations/zalo/pc/session.ps1'), '-Action', $action,
            '-Install', config('zalo_team.pc_install'), '-Lease', $this->root().'/lease.json'], null, null, null, 45);
        $p->mustRun();
    }

    public function tick(): void
    {
        touch($this->root().'/heartbeat');
        $s = $this->change(fn (&$s) => $s);
        if (! $s || in_array($s['state'], ['complete', 'disconnected', 'error'])) {
            return;
        }
        try {
            if (($s['cancel'] ?? false) || ($s['state'] === 'ready' && time() > ($s['expires'] ?? 0))) {
                $this->native('Close');
                $this->update(['state' => 'disconnected', 'cancel' => false, 'conversations' => []]);

                return;
            }
            if ($s['stop'] ?? false) {
                throw new \RuntimeException('PC_STOPPED');
            }
            if (in_array($s['state'], ['connecting', 'exporting', 'importing'])) {
                // Worker died while owning this state. Preserve the queue and
                // require an explicit reconnect; never replay a live session.
                throw new \RuntimeException('PC_INTERRUPTED');
            }
            $u = app(ZaloTeamIdentity::class)->worker((int) ($s['userId']));
            if ($s['state'] === 'ready') {
                $this->scheduleRecovery();
                $s = $this->change(fn (&$s) => $s);
            }
            $base = ['node', base_path('integrations/zalo/pc/export-history.mjs')];
            if ($s['state'] === 'queued-connect') {
                $this->update(['state' => 'connecting']);
                $this->process([...$base, 'inspect', '--install', config('zalo_team.pc_install')]);
                $this->native('Open');
                $until = time() + 75;
                do {
                    try {
                        $catalog = json_decode($this->process([...$base, 'list', '--account', $s['externalId'], '--install', config('zalo_team.pc_install')]), true, 64, JSON_THROW_ON_ERROR);
                        break;
                    } catch (\Throwable $e) {
                        if (in_array($e->getMessage(), ['PC_CANCELLED', 'PC_ACCOUNT_MISMATCH']) || time() >= $until) {
                            throw $e;
                        } $this->pulse();
                        sleep(2);
                    }
                } while (true);
                $this->update(['state' => 'ready', 'expires' => time() + 900, 'conversations' => $catalog['conversations']]);
            } elseif ($s['state'] === 'queued-import') {
                $this->update(['state' => 'exporting']);
                while ($claim = $this->claimNext()) {
                    $this->pulse();
                    $cid = $claim['current'];
                    $c = collect($s['conversations'])->firstWhere('conversationId', $cid);
                    if (! $c) {
                        throw new \RuntimeException('PC_CATALOG_CHANGED');
                    }
                    $progress = ['conversation' => $c['name'], 'conversationId' => $cid, 'index' => count($claim['results'] ?? []) + 1, 'count' => count($claim['results'] ?? []) + count($claim['remaining']), 'messages' => 0, 'files' => 0];
                    $this->update(['state' => 'exporting', 'progress' => $progress]);
                    $directory = $this->root().'/'.Str::uuid();
                    $sourceId = hash('sha256', $s['owner'].':'.$s['externalId'].':'.$cid);
                    $remote = app(ZaloTeamPcRemote::class);
                    if (! $remote->enabled()) {
                        DB::table('zt_archive_sources')->insertOrIgnore(['id' => $sourceId, 'owner' => $s['owner'], 'account_id' => $s['accountId'], 'external_id' => $s['externalId'],
                            'conversation_id' => $cid, 'canonical' => 'source:'.$sourceId, 'name' => $c['name'], 'account_name' => $s['accountName'], 'accessible' => false]);
                    }
                    $indexFile = $directory.'.index.json';
                    try {
                        if ($remote->enabled()) {
                            $prepared = $remote->call($u, 'prepare', ['accountId' => $s['accountId'], 'externalId' => $s['externalId'], 'conversationId' => $cid, 'name' => $c['name'], 'recoveryOnly' => ! empty($claim['recoveryOnly'][$cid])], fn () => $this->pulse());
                            if ($prepared['source'] !== $sourceId) {
                                throw new \RuntimeException('PC_ACCOUNT_MISMATCH');
                            }
                            $index = $prepared['index'];
                            $receipts = $prepared['receipts'];
                        } else {
                            $source = app(ZaloTeamArchive::class)->source($u, $sourceId);
                            $index = app(ZaloTeamPcIndex::class)->build($source);
                            if (! empty($claim['recoveryOnly'][$cid])) {
                                $index['recoveryIds'] = app(ZaloTeamPcRecovery::class)->messageIds($s['owner'], $sourceId);
                            }
                            $receipts = app(ZaloTeamPcRecovery::class)->receipts($s['owner'], $sourceId);
                        }
                        if (file_put_contents($indexFile, ZaloTeamArchive::json($index), LOCK_EX) === false) {
                            throw new \RuntimeException('PC_INDEX_WRITE_FAILED');
                        }
                        $this->process([...$base, 'export', '--account', $s['externalId'], '--conversation', $cid, '--out', $directory, '--index', $indexFile, '--install', config('zalo_team.pc_install'), '--media-root', config('zalo_team.pc_media_root')], 7200,
                            fn ($v) => $this->update(['progress' => array_replace($progress, ['messages' => $v['scanned'] ?? $v['total'] ?? 0, 'files' => $v['files'] ?? $v['assets'] ?? 0, 'unchanged' => $v['unchanged'] ?? 0, 'mode' => $v['mode'] ?? 'reconcile-missing'])]));
                    } finally {
                        if (is_file($indexFile)) {
                            unlink($indexFile);
                        }
                    }
                    $this->update(['state' => 'importing']);
                    do {
                        try {
                            $r = $remote->enabled() ? $remote->upload($u, $sourceId, $directory, function () use ($progress) {
                                $this->pulse();
                                $this->update(['progress' => array_replace($progress, ['phase' => 'uploading'])]);
                            }) : app(ZaloTeamPcImport::class)->run($u, $sourceId, $directory, true, function ($v) use ($progress) {
                                $this->pulse();
                                $this->update(['progress' => array_replace($progress, ['messages' => $v['processed'], 'total' => $v['total'], 'files' => $v['files'], 'phase' => $v['phase'] ?? 'messages'])]);
                            });
                            break;
                        } catch (HttpException $e) {
                            if ($e->getStatusCode() !== 409) {
                                throw $e;
                            }
                            $this->update(['progress' => array_replace($progress, ['phase' => 'waiting-lock'])]);
                            $this->pulse();
                            sleep(2);
                        }
                    } while (true);
                    if (empty($r['summary']['coverage']['complete'])) {
                        throw new \RuntimeException('PC_RECOVERY_INCOMPLETE');
                    }
                    if ($remote->enabled()) {
                        $remote->call($u, 'checked', ['source' => $sourceId, 'batch' => hash_file('sha256', $directory.'/manifest.json'), 'receipts' => $receipts, 'checks' => $r['summary']['coverage']['mediaChecks'] ?? []]);
                    } else {
                        app(ZaloTeamPcRecovery::class)->checked($s['owner'], $receipts, $r['summary']['coverage']['mediaChecks'] ?? []);
                    }
                    unset($r['summary']['coverage']['mediaChecks']);
                    $this->completeCurrent($cid, ['source' => $sourceId, 'conversationId' => $cid, 'name' => $c['name'], 'state' => $r['state'], 'summary' => $r['summary']]);
                    $this->update(['progress' => array_replace($progress, ['messages' => $r['summary']['processed'], 'total' => $r['summary']['total'], 'files' => $r['summary']['files'], 'phase' => 'complete'])]);
                    // Bundles are transient. Blob bytes now live in the private archive.
                    $resolved = realpath($directory);
                    $root = realpath($this->root());
                    if ($resolved && $root && dirname($resolved) === $root && Str::isUuid(basename($resolved))) {
                        File::deleteDirectory($resolved);
                    }
                }
                $this->finishBatch();
            }
        } catch (\Throwable $e) {
            if ($e->getMessage() === 'PC_STOPPED') {
                $this->update(['stop' => false]);
                // Cancellation is separate: stopping a batch keeps the verified session usable.
                $this->finishBatch(true);

                return;
            }
            Log::warning('Zalo PC import session failed', ['class' => get_class($e), 'reason' => $e->getMessage()]);
            $closed = true;
            try {
                $this->native('Close');
            } catch (\Throwable) {
                $closed = false;
            }
            $message = match ($e->getMessage()) {
                'PC_ACCOUNT_MISMATCH' => 'Tài khoản đang đăng nhập Zalo PC khác tài khoản đã chọn. Đổi tài khoản trên PC rồi kết nối lại.',
                'PC_CANCELLED' => 'Đã dừng. Các tin và tệp đã nhập vẫn được giữ trong kho.',
                'PC_INTERRUPTED' => 'Tiến trình bị gián đoạn. Kết nối lại để nhập tiếp; dữ liệu đã lưu không bị nhân đôi.',
                'PC_PROCESS_FAILED' => 'Không đọc được Zalo PC. Kiểm tra ứng dụng còn mở và đúng tài khoản, rồi kết nối lại và tiếp tục hàng đợi.',
                'PC_CATALOG_CHANGED' => 'Hội thoại trong hàng đợi không còn trong danh sách PC. Kiểm tra tài khoản và chọn lại hội thoại.',
                'PC_RECOVERY_INCOMPLETE' => 'Lượt đọc PC còn mục bỏ qua. Dữ liệu đã nhập được giữ; chưa đánh dấu kiểm tra xong. Kết nối lại để tiếp tục.',
                default => 'Chưa hoàn tất nhập PC. Kiểm tra Zalo đã đăng nhập, đúng phiên bản hỗ trợ và còn dung lượng ổ đĩa rồi thử lại.',
            };
            $blockedAt = $this->change(fn (&$state) => $state['state'] ?? $s['state']);
            $this->update(['state' => 'error', 'cancel' => false, 'stop' => false, 'blockedAt' => $blockedAt, 'error' => $message.($closed ? '' : ' Không đóng được phiên tạm; hãy thoát Zalo PC. Phiên có bộ tự đóng sau 15 phút.')]);
        }
    }

    protected function finishBatch(bool $stopped = false): void
    {
        $this->renewLease(true);
        $this->change(function (&$s) use ($stopped) {
            $s['current'] = null;
            $s['state'] = 'ready';
            $s['expires'] = time() + 900;
            $s['error'] = null;
            $s['notice'] = $stopped ? 'Đã dừng lượt nhập. Kết nối PC được giữ để tiếp tục phần còn lại.' : null;
            $s['recoveryPaused'] = $stopped;
        });
    }

    protected function claimNext(): ?array
    {
        $this->scheduleRecovery();

        return $this->change(function (&$s) {
            if (($s['cancel'] ?? false) || ($s['stop'] ?? false)) {
                throw new \RuntimeException(($s['cancel'] ?? false) ? 'PC_CANCELLED' : 'PC_STOPPED');
            }
            if (empty($s['remaining'])) {
                return null;
            }
            $s['current'] = $s['remaining'][0];

            return $s;
        });
    }

    protected function scheduleRecovery(): void
    {
        $this->change(function (&$s) {
            if (! in_array($s['state'] ?? '', ['ready', 'queued-import', 'exporting', 'importing'])
                || ($s['stop'] ?? false) || ($s['cancel'] ?? false) || ($s['recoveryPaused'] ?? false)
                || ($s['state'] === 'ready' && ($s['expires'] ?? 0) <= time())) {
                return;
            }
            $remote = app(ZaloTeamPcRemote::class);
            if ($remote->enabled()) {
                $u = app(ZaloTeamIdentity::class)->worker((int) $s['userId']);
                $ids = $remote->call($u, 'recoveries', array_intersect_key($s, array_flip(['accountId', 'externalId', 'conversations'])))['conversations'];
            } else {
                $recovery = app(ZaloTeamPcRecovery::class);
                $recovery->seed($s['owner']);
                $ids = $recovery->conversations($s);
            }
            if (! $ids) {
                return;
            }
            foreach (array_diff($ids, $s['remaining'] ?? []) as $cid) {
                $s['recoveryOnly'][$cid] = true;
            }
            $s['remaining'] = array_values(array_unique([...($s['remaining'] ?? []), ...$ids]));
            $s['selected'] = array_values(array_unique([...($s['selected'] ?? []), ...$ids]));
            if ($s['state'] === 'ready') {
                $s['state'] = 'queued-import';
                $s['progress'] = null;
                $s['notice'] = 'Đang tự kiểm tra nguồn tệp trên PC theo tài khoản đã kết nối.';
            }
        });
    }

    protected function completeCurrent(string $cid, array $result): void
    {
        $this->change(function (&$s) use ($cid, $result) {
            // Remove by identity, never by offset: priority may change during export.
            $s['results'] = array_values(array_filter($s['results'] ?? [], fn ($r) => ($r['source'] ?? '') !== $result['source']));
            $s['results'][] = $result;
            $s['remaining'] = array_values(array_filter($s['remaining'] ?? [], fn ($id) => $id !== $cid));
            $s['current'] = null;
        });
    }

    public function work(bool $watch): void
    {
        abort_unless($this->supported(), 409, 'PC worker chỉ chạy trên Windows local.');
        $lock = fopen($this->root().'/worker.lock', 'c');
        if (! flock($lock, LOCK_EX | LOCK_NB)) {
            return;
        }
        try {
            do {
                $this->tick();
                if ($watch) {
                    sleep(2);
                }
            } while ($watch);
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }
}

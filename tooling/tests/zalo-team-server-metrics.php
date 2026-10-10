<?php
putenv('ZALO_TEAM_REMOTE_API_URL=');
require __DIR__.'/../../apps/backend/vendor/autoload.php';
$app = require __DIR__.'/../../apps/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use App\Models\ZaloTeamIdentityUser;
use App\Services\ZaloTeamServerMetrics;
$path = tempnam(sys_get_temp_dir(), 'zt-metrics-');
config(['zalo_team.metrics_path' => $path]);
$reader = new ZaloTeamServerMetrics;
$user = new ZaloTeamIdentityUser;
$user->forceFill(['can_monitor_server' => true]);
$checks = 0;
function checkMetric($ok) { global $checks; if (!$ok) throw new Exception('Check '.($checks + 1).' failed'); $checks++; }
function deniedMetric($fn, $status) { try { $fn(); } catch (Symfony\Component\HttpKernel\Exception\HttpException $e) { checkMetric($e->getStatusCode() === $status); return; } throw new Exception('Expected rejection'); }
try {
    $ordinary = new ZaloTeamIdentityUser;
    deniedMetric(fn() => $reader->read($ordinary), 403);
    $ordinary->forceFill(['can_monitor_server' => 'true']);
    deniedMetric(fn() => $reader->read($ordinary), 403);
    file_put_contents($path, '{}');
    deniedMetric(fn() => $reader->read($user), 503);
    $data = ['version' => 1, 'sampledAt' => time(), 'host' => ['cores' => 10], 'secret' => 'not-public'];
    file_put_contents($path, json_encode($data));
    checkMetric($reader->read($user)['stale'] === false);
    checkMetric(!isset($reader->read($user)['secret']));
    $data['sampledAt'] = time() - 100;
    file_put_contents($path, json_encode($data));
    checkMetric($reader->read($user)['stale'] === true);
    $data['sampledAt'] = time() + 100;
    file_put_contents($path, json_encode($data));
    checkMetric($reader->read($user)['stale'] === true);
    file_put_contents($path, str_repeat(' ', 1048577));
    deniedMetric(fn() => $reader->read($user), 503);
    unlink($path);
    deniedMetric(fn() => $reader->read($user), 503);
    echo "PASS $checks server metrics checks\n";
} finally { if (is_file($path)) unlink($path); }

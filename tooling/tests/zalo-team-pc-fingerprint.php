<?php
require __DIR__.'/../../apps/backend/app/Services/ZaloTeamPcIndex.php';
$messages = json_decode(stream_get_contents(STDIN), false, 512, JSON_THROW_ON_ERROR);
echo json_encode(array_map(fn ($m) => App\Services\ZaloTeamPcIndex::fingerprint($m), $messages), JSON_THROW_ON_ERROR);

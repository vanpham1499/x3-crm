$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$apiPort=9340
foreach($envFile in @('apps/frontend/.env.local','apps/backend/.env')) {
  $envPath=Join-Path $repo $envFile
  if((Test-Path $envPath) -and (Select-String -LiteralPath $envPath -Pattern '^ZALO_TEAM_(API_URL|REMOTE_API_URL)=http://(localhost|127\.0\.0\.1):9345/' -Quiet)) {$apiPort=9345}
}
function Test-Tunnel {
  foreach($port in @(9250,$apiPort,9262)) {
    $client=[Net.Sockets.TcpClient]::new()
    try {
      $attempt=$client.ConnectAsync('127.0.0.1',$port)
      if(!$attempt.Wait(500) -or !$client.Connected){return $false}
    } catch {return $false} finally {$client.Dispose()}
  }
  try {
    $health=Invoke-RestMethod -Uri "http://127.0.0.1:$apiPort/api/health" -TimeoutSec 2
    return $health.service -eq 'zalo-team' -and $health.status -eq 'ok'
  } catch {return $false}
}
if(Test-Tunnel){Write-Host '[Zalo Team] VPS connection ready.';exit 0}
$key=Join-Path $repo 'tooling/deployment/.work/zalo-vps/id_ed25519'
$hosts=Join-Path $repo 'tooling/deployment/.work/server/known_hosts'
if(!(Test-Path -LiteralPath $key) -or !(Test-Path -LiteralPath $hosts)) {
  Write-Warning '[Zalo Team] VPS tunnel credentials are not configured. CRM can still start.'
  exit 0
}
Write-Host '[Zalo Team] Reconnecting VPS tunnel...'
try {
  $task=Get-ScheduledTask -TaskName 'X3 Zalo VPS Tunnel' -ErrorAction Stop
  if($task.State -ne 'Running'){Start-ScheduledTask -InputObject $task}
} catch {Write-Verbose 'Scheduled task unavailable; starting the configured tunnel directly.'}
for($i=0;$i -lt 3;$i++) {if(Test-Tunnel){Write-Host '[Zalo Team] VPS connection ready.';exit 0};Start-Sleep -Seconds 1}
# The tunnel owns a mutex: simultaneous frontend/backend starts cannot open duplicate connections.
$powershell=Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
$script=Join-Path $PSScriptRoot 'tunnel.ps1'
Start-Process -FilePath $powershell -ArgumentList @('-NoProfile','-NonInteractive','-WindowStyle','Hidden','-ExecutionPolicy','Bypass','-File',('"'+$script+'"'),'-Watch') -WorkingDirectory $repo -WindowStyle Hidden
for($i=0;$i -lt 15;$i++) {if(Test-Tunnel){Write-Host '[Zalo Team] VPS connection ready.';exit 0};Start-Sleep -Seconds 1}
Write-Warning '[Zalo Team] VPS is not reachable yet; the tunnel will keep reconnecting. Check tooling/deployment/.work/zalo-vps/tunnel.log. CRM can still start.'

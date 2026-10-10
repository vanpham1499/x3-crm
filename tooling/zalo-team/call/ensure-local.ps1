param([string]$NodePath)
$ErrorActionPreference = 'Stop'
$callRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
function Get-CallHealth {
  try { return Invoke-RestMethod -Uri 'http://127.0.0.1:9260/health' -TimeoutSec 1 } catch { return $null }
}
function Assert-Ready($health) {
  if ($null -eq $health) { return $false }
  if ($health.callReady -eq $true -and $health.provider -eq 'zrtc') { return $true }
  throw 'CALL_PORT_IN_USE'
}
if (Assert-Ready (Get-CallHealth)) { Write-Output 'Call gateway ready.'; exit 0 }
$callMutex = [Threading.Mutex]::new($false, 'Local\X3ZaloCallGatewayStartup9260')
$callLocked = $false
try {
  try { $callLocked = $callMutex.WaitOne(10000) } catch [Threading.AbandonedMutexException] { $callLocked = $true }
  if (!$callLocked) { throw 'CALL_START_TIMEOUT' }
  if (Assert-Ready (Get-CallHealth)) { Write-Output 'Call gateway ready.'; exit 0 }
  if (!$NodePath) { $NodePath = (Get-Command node.exe -ErrorAction Stop).Source }
  $callLogs = Join-Path $callRoot '.local/zalo-call-assets'
  New-Item -ItemType Directory -Force -Path $callLogs | Out-Null
  $callShell = Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
  $callScript = Join-Path $PSScriptRoot 'start-local.ps1'
  $callProcess = Start-Process -FilePath $callShell -ArgumentList @('-NoProfile','-NonInteractive','-WindowStyle','Hidden','-ExecutionPolicy','Bypass','-File',('"'+$callScript+'"'),'-NodePath',('"'+$NodePath+'"')) -WorkingDirectory $callRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $callLogs 'gateway-local.stdout.log') -RedirectStandardError (Join-Path $callLogs 'gateway-local.stderr.log') -PassThru
  $callDeadline = [DateTime]::UtcNow.AddSeconds(8)
  while ([DateTime]::UtcNow -lt $callDeadline) {
    if (Assert-Ready (Get-CallHealth)) { Write-Output 'Call gateway ready.'; exit 0 }
    $callProcess.Refresh()
    if ($callProcess.HasExited) { throw 'CALL_START_FAILED' }
    Start-Sleep -Milliseconds 250
  }
  throw 'CALL_START_TIMEOUT'
} finally {
  if ($callLocked) { $callMutex.ReleaseMutex() }
  $callMutex.Dispose()
}

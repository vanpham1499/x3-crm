param([ValidateSet('Open','Close','Guard')][string]$Action, [string]$Install, [string]$Lease, [string]$SessionId)
$ErrorActionPreference = 'Stop'
$exe = [IO.Path]::GetFullPath((Join-Path $Install 'Zalo.exe'))
if (-not (Test-Path -LiteralPath $exe)) { throw 'PC_INSTALL_NOT_FOUND' }
function Close-Session([string]$ExpectedId = '') {
  $mutex = New-Object Threading.Mutex($false, 'Local\X3ZaloTeamPc9333')
  $held = $false
  try {
  try { $held = $mutex.WaitOne(30000) } catch [Threading.AbandonedMutexException] { $held = $true }
  if (-not $held) { throw 'PC_SESSION_LOCK_BUSY' }
  if (-not (Test-Path -LiteralPath $Lease)) { return }
  $entry = Get-Content -LiteralPath $Lease -Raw | ConvertFrom-Json
  if ($ExpectedId -and ($entry.sessionId -ne $ExpectedId -or [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() -le $entry.expires)) { return }
  $running = @(Get-CimInstance Win32_Process -Filter "Name = 'Zalo.exe'" | Where-Object { $_.ExecutablePath -eq $exe })
  $main = $running | Where-Object { $_.ProcessId -eq $entry.pid -and $_.CommandLine -match '--remote-debugging-port=9333' }
  # Consume this lease while holding the same lock as Open/other closers.
  # Old guards must never close a newly connected session or restart twice.
  Remove-Item -LiteralPath $Lease -ErrorAction Stop
  if ($main) {
    # Stop only the process tree of the temporary instance we launched.
    $ids = @([int]$entry.pid)
    do { $before = $ids.Count; $ids += @($running | Where-Object { $_.ParentProcessId -in $ids -and $_.ProcessId -notin $ids } | ForEach-Object { [int]$_.ProcessId }); } while ($ids.Count -gt $before)
    $running | Where-Object { $_.ProcessId -in $ids } | ForEach-Object { Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue }
    Start-Sleep -Milliseconds 800
    Start-Process -FilePath $exe -WindowStyle Hidden
  }
  } finally { if ($held) { $mutex.ReleaseMutex() }; $mutex.Dispose() }
}
if ($Action -eq 'Close') { Close-Session; exit }
if ($Action -eq 'Guard') {
  while (Test-Path -LiteralPath $Lease) {
    try {
      $entry = Get-Content -LiteralPath $Lease -Raw | ConvertFrom-Json
      if ($entry.sessionId -ne $SessionId) { break }
      if ([DateTimeOffset]::UtcNow.ToUnixTimeSeconds() -gt $entry.expires) { Close-Session $SessionId; break }
    } catch { }
    Start-Sleep -Seconds 5
  }
  exit
}
$openMutex = New-Object Threading.Mutex($false, 'Local\X3ZaloTeamPc9333')
$openHeld = $false
try {
try { $openHeld = $openMutex.WaitOne(30000) } catch [Threading.AbandonedMutexException] { $openHeld = $true }
if (-not $openHeld) { throw 'PC_SESSION_LOCK_BUSY' }
if (Test-Path -LiteralPath $Lease) { throw 'PC_SESSION_ALREADY_EXISTS' }
if (Get-NetTCPConnection -LocalPort 9333 -State Listen -ErrorAction SilentlyContinue) { throw 'PC_PORT_IN_USE' }
$running = @(Get-CimInstance Win32_Process -Filter "Name = 'Zalo.exe'" | Where-Object { $_.ExecutablePath -eq $exe })
if ($running | Where-Object { $_.CommandLine -notmatch '--type=' -and $_.CommandLine -match '--user-data-dir|--remote-debugging' }) { throw 'PC_CUSTOM_SESSION_IN_USE' }
# The UI explicitly confirms restarting this installed personal client.
$running | ForEach-Object { Stop-Process -Id $_.ProcessId -ErrorAction Stop }
Start-Sleep -Milliseconds 800
$proc = Start-Process -FilePath $exe -ArgumentList '--remote-debugging-address=127.0.0.1','--remote-debugging-port=9333' -WindowStyle Hidden -PassThru
$SessionId = [guid]::NewGuid().ToString()
@{pid=$proc.Id; sessionId=$SessionId; expires=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds()+900} | ConvertTo-Json -Compress | Set-Content -LiteralPath $Lease -Encoding UTF8
$guardArgs = @('-NoProfile','-File',('"'+$PSCommandPath+'"'),'-Action','Guard','-Install',('"'+$Install+'"'),'-Lease',('"'+$Lease+'"'),'-SessionId',$SessionId)
Start-Process powershell.exe -ArgumentList $guardArgs -WindowStyle Hidden
Write-Output 'opened'
} finally { if ($openHeld) { $openMutex.ReleaseMutex() }; $openMutex.Dispose() }

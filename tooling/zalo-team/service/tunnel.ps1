param([switch]$Watch)
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$state=Join-Path $repo 'tooling/deployment/.work/zalo-vps'
$mutex=[Threading.Mutex]::new($false,'Local\X3ZaloVpsTunnel')
$acquired=$false
try { $acquired=$mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $acquired=$true }
if(!$acquired){$mutex.Dispose();exit 0}
try {
  $opts=@('-N','-T','-i',"$state/id_ed25519",'-o','IdentitiesOnly=yes','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes',
    '-o',"UserKnownHostsFile=$repo/tooling/deployment/.work/server/known_hosts",'-o','ExitOnForwardFailure=yes',
    '-o','ConnectTimeout=15','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=3',
    '-L','127.0.0.1:9250:127.0.0.1:9250','-L','127.0.0.1:9340:127.0.0.1:9340',
    '-L','127.0.0.1:9345:127.0.0.1:9345',
    '-L','127.0.0.1:9262:127.0.0.1:9260',
    '-R','127.0.0.1:9341:127.0.0.1:4000','root@14.225.198.183')
  do {
    if((Test-Path "$state/tunnel.log") -and (Get-Item "$state/tunnel.log").Length -gt 1048576){
      Move-Item -LiteralPath "$state/tunnel.log" -Destination "$state/tunnel.previous.log" -Force
    }
    # Windows PowerShell treats native stderr as ErrorRecord. Do not abort SSH
    # on its first diagnostic line or replace the real failure with a generic log.
    $previousErrorAction=$ErrorActionPreference
    try {
      $ErrorActionPreference='Continue'
      & C:/Windows/System32/OpenSSH/ssh.exe @opts 2>> "$state/tunnel.log"
      $sshExit=$LASTEXITCODE
      Add-Content -LiteralPath "$state/tunnel.log" -Value "$(Get-Date -Format o) SSH exited ($sshExit); reconnecting=$Watch."
    } finally {$ErrorActionPreference=$previousErrorAction}
    if($Watch){Start-Sleep -Seconds 10}
  }while($Watch)
} finally {$mutex.ReleaseMutex();$mutex.Dispose()}

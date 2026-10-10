$ErrorActionPreference='Stop'
$root=Join-Path ([IO.Path]::GetTempPath()) ('zt-pc-guard-'+[guid]::NewGuid())
$null=New-Item -ItemType Directory -Path $root
$exe=Join-Path $root 'Zalo.exe';[IO.File]::WriteAllText($exe,'fixture')
$lease=Join-Path $root 'lease.json'
$calls=[pscustomobject]@{starts=0;stops=0}
function Get-CimInstance { param($ClassName,$Filter) @([pscustomobject]@{ExecutablePath=$exe;ProcessId=424242;ParentProcessId=0;CommandLine='Zalo.exe --remote-debugging-port=9333'}) }
function Stop-Process { param($Id,$ErrorAction) if($Id -ne 424242){throw 'Wrong process'};$calls.stops++ }
function Start-Process { param($FilePath,$WindowStyle) if($FilePath -ne $exe -or $WindowStyle -ne 'Hidden'){throw 'Wrong restart'};$calls.starts++ }
function Start-Sleep { param($Milliseconds,$Seconds) }
$scriptFile=Join-Path $PSScriptRoot '../../apps/backend/integrations/zalo/pc/session.ps1'
try {
 @{pid=424242;sessionId='current';expires=0} | ConvertTo-Json | Set-Content -LiteralPath $lease
 & $scriptFile -Action Guard -Install $root -Lease $lease -SessionId 'older'
 if($calls.stops -ne 0 -or !(Test-Path -LiteralPath $lease)){throw 'Old guard affected current lease'}
 & $scriptFile -Action Guard -Install $root -Lease $lease -SessionId 'current'
 if($calls.stops -ne 1 -or $calls.starts -ne 1 -or (Test-Path -LiteralPath $lease)){throw 'Expired lease not closed exactly once'}
 & $scriptFile -Action Close -Install $root -Lease $lease
 if($calls.stops -ne 1 -or $calls.starts -ne 1){throw 'Duplicate close restarted native PC'}
 'PASS 3 native guard lifecycle checks (mock processes)'
} finally {
 foreach($file in @($lease,$exe)){if(Test-Path -LiteralPath $file){Remove-Item -LiteralPath $file}}
 Remove-Item -LiteralPath $root
}

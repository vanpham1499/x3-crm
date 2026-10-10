param([Parameter(Mandatory=$true)][ValidateSet('exec','upload','download')][string]$Action,[Parameter(Mandatory=$true)][string]$Source,[string]$Destination)
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$key=Join-Path $repo 'tooling/deployment/.work/zalo-vps/id_ed25519'
$known=Join-Path $repo 'tooling/deployment/.work/server/known_hosts'
$opts=@('-i',$key,'-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o',"UserKnownHostsFile=$known",'-o','ConnectTimeout=15','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=3')
if($Action -eq 'exec') { & C:/Windows/System32/OpenSSH/ssh.exe @opts root@14.225.198.183 $Source }
elseif($Action -eq 'upload') { & C:/Windows/System32/OpenSSH/scp.exe @opts $Source "root@14.225.198.183:$Destination" }
else { & C:/Windows/System32/OpenSSH/scp.exe @opts "root@14.225.198.183:$Source" $Destination }
if($LASTEXITCODE -ne 0){throw "VPS $Action failed ($LASTEXITCODE)"}

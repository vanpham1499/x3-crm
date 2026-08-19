[CmdletBinding()]
param(
    [string]$Server = '45.252.251.120',
    [string]$SshUser = 'root',
    [string]$RemoteDir = '/opt/x3crm',
    [string]$PublicUrl = 'https://crm.x3sales.com',
    [string]$SshKey = ''
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$RepoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$BackendRoot = [IO.Path]::GetFullPath((Join-Path $RepoRoot 'apps\backend'))
$FrontendRoot = [IO.Path]::GetFullPath((Join-Path $RepoRoot 'apps\frontend'))
$DeployRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'production'))
$WorkRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '.work'))
$BackendContext = [IO.Path]::GetFullPath((Join-Path $WorkRoot 'backend-context'))
$FrontendContext = [IO.Path]::GetFullPath((Join-Path $WorkRoot 'frontend-context'))
$ArtifactDir = [IO.Path]::GetFullPath((Join-Path $WorkRoot 'artifacts'))
$SshExe = 'C:\Windows\System32\OpenSSH\ssh.exe'
$ScpExe = 'C:\Windows\System32\OpenSSH\scp.exe'
$AskPassExe = Join-Path $PSScriptRoot 'ssh-askpass.cmd'
$Target = "$SshUser@$Server"
$SshOptions = @('-o', 'StrictHostKeyChecking=yes')
$PublicUrl = $PublicUrl.TrimEnd('/')
$PublicUri = $null

if (-not [Uri]::TryCreate($PublicUrl, [UriKind]::Absolute, [ref]$PublicUri) -or $PublicUri.Scheme -ne 'https') {
    throw "PublicUrl must be an absolute HTTPS URL. [$PublicUrl] given."
}
function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Assert-LastExitCode([string]$Action) {
    if ($LASTEXITCODE -ne 0) {
        throw "$Action failed with exit code $LASTEXITCODE."
    }
}

function Assert-ChildPath([string]$Path, [string]$Parent) {
    $resolvedPath = [IO.Path]::GetFullPath($Path).TrimEnd('\')
    $resolvedParent = [IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'
    if (-not $resolvedPath.StartsWith($resolvedParent, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Unsafe path outside expected workspace: $resolvedPath"
    }
}

function Invoke-Remote([string]$Script) {
    $normalizedScript = $Script.Replace("`r`n", "`n").Replace("`r", "`n")
    $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($normalizedScript))
    $remoteScriptPath = "/tmp/x3crm-deploy-$([Guid]::NewGuid().ToString('N')).sh"
    $remoteCommand = "printf %s $encoded | base64 -d > $remoteScriptPath; bash $remoteScriptPath; status=`$?; rm -f $remoteScriptPath; exit `$status"
    & $SshExe @SshOptions $Target $remoteCommand
    Assert-LastExitCode 'Remote command'
}

foreach ($required in @($SshExe, $ScpExe, $BackendRoot, $FrontendRoot, $DeployRoot)) {
    if (-not (Test-Path -LiteralPath $required)) {
        throw "Required path not found: $required"
    }
}

if ($SshKey) {
    if (-not (Test-Path -LiteralPath $SshKey)) {
        throw "SSH key not found: $SshKey"
    }
    $SshOptions += @('-i', $SshKey, '-o', 'BatchMode=yes')
} else {
    if (-not (Test-Path -LiteralPath $AskPassExe)) {
        throw "SSH askpass helper not found: $AskPassExe"
    }
    if (-not $env:X3_DEPLOY_PASSWORD) {
        $securePassword = Read-Host "SSH password for $Target" -AsSecureString
        $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
        try {
            $env:X3_DEPLOY_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
        } finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
        }
    }
    $env:SSH_ASKPASS = $AskPassExe
    $env:SSH_ASKPASS_REQUIRE = 'force'
    $env:DISPLAY = 'x3crm-deploy'
    $SshOptions += @('-o', 'PubkeyAuthentication=no')
}

$backendTar = $null
$frontendTar = $null

Push-Location $BackendRoot
try {
    $commit = (& git -C $RepoRoot rev-parse --short HEAD).Trim()
    Assert-LastExitCode 'Read git commit'
    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $release = "$timestamp-$commit"
    $backendTar = Join-Path $ArtifactDir "x3crm-backend-$release.tar"
    $frontendTar = Join-Path $ArtifactDir "x3crm-frontend-$release.tar"

    Write-Host "Deploy release: $release" -ForegroundColor Green

    $status = & git -C $RepoRoot status --short
    if ($status) {
        Write-Warning 'Working tree has local changes; the current filesystem state will be deployed.'
    }

    Write-Step 'Checking Docker and SSH access'
    & docker version --format '{{.Server.Version}}' | Out-Host
    Assert-LastExitCode 'Docker check'
    & $SshExe @SshOptions $Target 'echo SSH_OK'
    Assert-LastExitCode 'SSH check'

    Write-Step 'Preparing clean backend and frontend build contexts'
    Assert-ChildPath $BackendContext $WorkRoot
    Assert-ChildPath $FrontendContext $WorkRoot
    Assert-ChildPath $ArtifactDir $WorkRoot
    if (Test-Path -LiteralPath $BackendContext) {
        Remove-Item -LiteralPath $BackendContext -Recurse -Force
    }
    if (Test-Path -LiteralPath $FrontendContext) {
        Remove-Item -LiteralPath $FrontendContext -Recurse -Force
    }
    New-Item -ItemType Directory -Path $BackendContext -Force | Out-Null
    New-Item -ItemType Directory -Path $FrontendContext -Force | Out-Null
    New-Item -ItemType Directory -Path $ArtifactDir -Force | Out-Null

    & robocopy $BackendRoot $BackendContext /E `
        /XD vendor node_modules dist .git .agents `
        storage\logs storage\framework\cache storage\framework\sessions storage\framework\views `
        public\uploads `
        /XF .env '*.log' | Out-Host
    if ($LASTEXITCODE -gt 7) {
        throw "Backend staging failed with robocopy exit code $LASTEXITCODE."
    }
    Copy-Item -LiteralPath (Join-Path $DeployRoot 'backend.Dockerfile') -Destination (Join-Path $BackendContext 'Dockerfile') -Force
    Copy-Item -LiteralPath (Join-Path $DeployRoot 'opcache.ini') -Destination (Join-Path $BackendContext 'opcache.ini') -Force

    & robocopy $FrontendRoot $FrontendContext /E /XD node_modules .next .git /XF '*.tsbuildinfo' | Out-Host
    if ($LASTEXITCODE -gt 7) {
        throw "Frontend staging failed with robocopy exit code $LASTEXITCODE."
    }
    Copy-Item -LiteralPath (Join-Path $DeployRoot 'frontend.Dockerfile') -Destination (Join-Path $FrontendContext 'Dockerfile') -Force
    Copy-Item -LiteralPath (Join-Path $DeployRoot 'next.config.production.js') -Destination (Join-Path $FrontendContext 'next.config.production.js') -Force

    Write-Step 'Building backend image'
    & docker build --platform linux/amd64 -f (Join-Path $BackendContext 'Dockerfile') -t x3crm-backend:deploy $BackendContext
    Assert-LastExitCode 'Backend image build'

    Write-Step 'Building frontend image'
    & docker build --platform linux/amd64 `
        --build-arg "NEXT_PUBLIC_API_URL=$PublicUrl/api" `
        --build-arg "NEXT_PUBLIC_MEDIA_URL=$PublicUrl" `
        --build-arg "NEXT_PUBLIC_REVERB_ENABLED=true" `
        --build-arg "NEXT_PUBLIC_REVERB_APP_KEY=x3crm-production-key" `
        --build-arg "NEXT_PUBLIC_REVERB_HOST=$($PublicUri.Host)" `
        --build-arg "NEXT_PUBLIC_REVERB_PORT=443" `
        --build-arg "NEXT_PUBLIC_REVERB_SCHEME=https" `
        -t x3crm-frontend:deploy $FrontendContext
    Assert-LastExitCode 'Frontend image build'

    Write-Step 'Saving Docker images'
    & docker save -o $backendTar x3crm-backend:deploy
    Assert-LastExitCode 'Save backend image'
    & docker save -o $frontendTar x3crm-frontend:deploy
    Assert-LastExitCode 'Save frontend image'

    Write-Step 'Checking production configuration'
    Invoke-Remote @"
set -euo pipefail
cd '$RemoteDir'
if ! grep -Eq '^REVERB_APP_SECRET=.+$' .env; then
  printf '\nREVERB_APP_SECRET=%s\n' "`$(openssl rand -hex 32)" >> .env
fi
grep -Eq '^PAYMENT_WEBHOOK_SECRET=.+$' .env || {
  echo 'PAYMENT_WEBHOOK_SECRET is missing in $RemoteDir/.env' >&2
  exit 1
}
"@

    Write-Step 'Removing stale deployment artifacts from server'
    Invoke-Remote @"
set -euo pipefail
cd '$RemoteDir'
find . -maxdepth 1 -type f \( -name 'x3crm-backend-*.tar' -o -name 'x3crm-frontend-*.tar' \) -delete
if [ -d backups ]; then
  find backups -maxdepth 1 -type f -name 'pre-deploy-*.dump' -delete
fi
"@

    Write-Step 'Uploading images and deployment configuration'
    & $ScpExe @SshOptions $backendTar "${Target}:${RemoteDir}/x3crm-backend-$release.tar"
    Assert-LastExitCode 'Upload backend image'
    & $ScpExe @SshOptions $frontendTar "${Target}:${RemoteDir}/x3crm-frontend-$release.tar"
    Assert-LastExitCode 'Upload frontend image'
    & $ScpExe @SshOptions (Join-Path $DeployRoot 'compose.yml') "${Target}:${RemoteDir}/compose.yml"
    Assert-LastExitCode 'Upload compose.yml'
    & $ScpExe @SshOptions (Join-Path $DeployRoot 'nginx.conf') "${Target}:${RemoteDir}/nginx.conf"
    Assert-LastExitCode 'Upload nginx.conf'
    & $ScpExe @SshOptions (Join-Path $DeployRoot 'reset-keep-accounts-services.sql') "${Target}:${RemoteDir}/reset-keep-accounts-services.sql"
    Assert-LastExitCode 'Upload reset database script'

    Write-Step 'Loading images and restarting application'
    Invoke-Remote @"
set -euo pipefail
cd '$RemoteDir'
trap "rm -f 'x3crm-backend-$release.tar' 'x3crm-frontend-$release.tar'" EXIT
docker load -i 'x3crm-backend-$release.tar'
docker load -i 'x3crm-frontend-$release.tar'
docker compose config -q
docker compose up -d --no-deps db
docker compose up -d --force-recreate backend scheduler reverb queue-worker frontend nginx
docker image prune -f
docker compose ps
"@

    Write-Step 'Waiting for HTTP health check'
    $healthUrls = @("$PublicUrl/", "$PublicUrl/api/")
    $healthy = $false
    for ($attempt = 1; $attempt -le 30; $attempt++) {
        try {
            $statuses = foreach ($healthUrl in $healthUrls) {
                (Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 10).StatusCode
            }
            if (($statuses | Where-Object { $_ -ne 200 }).Count -eq 0) {
                $healthy = $true
                break
            }
        } catch {
            Start-Sleep -Seconds 2
        }
    }
    if (-not $healthy) {
        throw "Deployment did not become healthy at $($healthUrls -join ', ')."
    }

    Write-Step 'Waiting for Reverb health check'
    Invoke-Remote @"
set -euo pipefail
cd '$RemoteDir'
reverb_healthy=false
for attempt in `$(seq 1 30); do
    reverb_id=`$(docker compose ps -q reverb)
    if [ -n "`$reverb_id" ] \
        && [ "`$(docker inspect -f '{{.State.Running}}' "`$reverb_id")" = "true" ] \
        && docker compose exec -T nginx nc -z -w 2 reverb 8080; then
        reverb_healthy=true
        break
    fi
    sleep 2
done
if [ "`$reverb_healthy" != "true" ]; then
    docker compose ps reverb nginx
    docker compose logs --tail=100 reverb
    exit 1
fi
"@

    Write-Step 'Verifying public WebSocket handshake'
    $webSocketHealthUrl = "$PublicUrl/app/x3crm-production-key?protocol=7&client=js&version=8.6.0&flash=false"
    $webSocketOrigin = "$($PublicUri.Scheme)://$($PublicUri.Authority)"
    $webSocketHealthy = $false
    for ($attempt = 1; $attempt -le 10; $attempt++) {
        $webSocketResponse = & curl.exe -sS -i --http1.1 --max-time 3 `
            -H "Origin: $webSocketOrigin" `
            -H 'Connection: Upgrade' `
            -H 'Upgrade: websocket' `
            -H 'Sec-WebSocket-Version: 13' `
            -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' `
            $webSocketHealthUrl 2>$null
        if (($webSocketResponse -join "`n") -match '101 Switching Protocols' `
            -and ($webSocketResponse -join "`n") -match 'pusher:connection_established') {
            $webSocketHealthy = $true
            break
        }
        Start-Sleep -Seconds 2
    }
    if (-not $webSocketHealthy) {
        throw "WebSocket handshake did not become healthy at $webSocketHealthUrl."
    }

    Write-Step 'Verifying containers and migrations'
    Invoke-Remote @"
set -euo pipefail
cd '$RemoteDir'
docker compose ps
docker compose exec -T backend php artisan migrate:status --no-ansi | tail -n 12
"@

    Write-Host "`nDEPLOY SUCCESS: $PublicUrl" -ForegroundColor Green
    Write-Host "Release: $release"
    Remove-Item -LiteralPath $backendTar, $frontendTar -Force -ErrorAction SilentlyContinue
} finally {
    Pop-Location
    if ($backendTar -or $frontendTar) {
        Remove-Item -LiteralPath @($backendTar, $frontendTar) -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $FrontendContext) {
        Assert-ChildPath $FrontendContext $WorkRoot
        Remove-Item -LiteralPath $FrontendContext -Recurse -Force
    }
    if (Test-Path -LiteralPath $BackendContext) {
        Assert-ChildPath $BackendContext $WorkRoot
        Remove-Item -LiteralPath $BackendContext -Recurse -Force
    }
    if (-not $SshKey) {
        Remove-Item Env:X3_DEPLOY_PASSWORD -ErrorAction SilentlyContinue
        Remove-Item Env:SSH_ASKPASS -ErrorAction SilentlyContinue
        Remove-Item Env:SSH_ASKPASS_REQUIRE -ErrorAction SilentlyContinue
        Remove-Item Env:DISPLAY -ErrorAction SilentlyContinue
    }
}
